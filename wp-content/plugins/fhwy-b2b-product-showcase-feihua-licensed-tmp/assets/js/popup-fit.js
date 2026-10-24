/**
 * 弹窗表单自适应紧凑 / Popup form auto-fit
 * ---------------------------------------------------------------------------
 * 量一次弹窗主体：装得下就什么都不做，装不下就逐档收紧，收到装得下为止。
 *
 *   第 1 档  轻压间距。
 *   第 2 档  重压间距，控件压薄，字段名字号收小。
 *   第 3 档  字段文字移进控件内部（label 写进 placeholder）。
 *   第 4 档  能压的全压到底。四档都装不下，才交给面板自己滚动。
 *
 * 每次都从第 0 档重新试起，而不是在当前档位上加减。这样档位完全由「当前内容 +
 * 当前视口」决定：删掉几个字段、收起产品清单、横屏转竖屏，面板都会自己回到该在的
 * 那一档，不会一路只紧不松。代价是一次测量最多跑五轮，而这五轮全在同一帧里同步
 * 完成，浏览器不会绘制中间状态，看不到闪烁。
 *
 * 与 MutationObserver 的死循环：这个脚本改的类名和 placeholder 就落在它自己监听的
 * 子树里，改完观察器就会通知自己，然后再改一遍。所以测量前先 disconnect（会一并清空
 * 已排队的记录），测完再重新连上。
 *
 * 纯原生、无依赖：右下角浮窗那套用 jQuery，移动端底部菜单那套不用，而这两处的弹窗
 * 共用同一个表单结构。
 *
 * @since 2.1.85
 * @package Fhwy_B2B_Product_Showcase
 */
(function () {
    'use strict';

    var ATTR       = 'data-cxb-fit';        /* 档位，0 档时整个移除 */
    var SPACE_ATTR = 'data-cxb-fit-space';  /* 已量出可用高度的标记 */
    var PH_ATTR    = 'data-cxb-fit-ph';     /* 备份控件原本的 placeholder */
    var OPT_ATTR   = 'data-cxb-fit-opt';    /* 标记被脚本填过文字的空占位项 */
    var HIDE_CLS   = 'cxb-fit-hide-label';
    var INLINE_CLS = 'cxb-fit-inline-label';

    var MAX_LEVEL  = 4;
    var COMPACT_AT = 3;   /* 从这一档起把字段文字移进控件内部 */
    var SLACK      = 2;   /* px。scrollHeight 与 clientHeight 之间的舍入误差 */
    var DEBOUNCE   = 120; /* ms */

    /* 能承载 placeholder 的控件。复选框、单选、隐藏域（Turnstile / reCAPTCHA 的
       令牌）都不在内——它们要么没有 placeholder，要么根本不该被碰。 */
    var CTRL_SEL = 'input[type="text"], input[type="email"], input[type="tel"], ' +
                   'input[type="url"], input[type="number"], input[type="search"], ' +
                   'input:not([type]), textarea, select';

    var TARGETS = [
        {
            /* 右下角浮窗，以及它的居中弹窗形态（同一个 DOM，居中时被搬到 body 下） */
            panel:  '#nbb2b-lm-panel',
            body:   '.nbb2b-lm-panel-body',
            header: '.nbb2b-lm-panel-header',
            field:  '.nbb2b-lm-field',
            group:  '.nbb2b-lm-checkbox-group',
            watch:  ['#nbb2b-lm-panel', '#nbb2b-leave-message-widget'],
            space:  spaceForLm
        },
        {
            /* 移动端底部菜单的「留言」弹窗 */
            panel:  '.nbb2b-mm-message-modal',
            body:   '.nbb2b-mm-message-body',
            header: '.nbb2b-mm-message-header',
            field:  '.nbb2b-mm-msg-field',
            group:  '.nbb2b-mm-msg-checkbox-group',
            watch:  ['#nbb2b-mm-message-overlay'],
            space:  spaceForMm
        }
    ];

    /* ─────────────────────────────────────────────────────────────
       小工具
       ───────────────────────────────────────────────────────────── */

    function visible(el) {
        return !!el && !!el.getClientRects && el.getClientRects().length > 0;
    }

    function viewportH() {
        return window.innerHeight ||
               (document.documentElement && document.documentElement.clientHeight) || 0;
    }

    /* label 的可读文字。必填星号是 label 里的一个 <span>，textContent 已经把它带上，
       所以「Email *」是一次取到的，不用再拼。 */
    function labelText(label) {
        return (label.textContent || '').replace(/\s+/g, ' ').trim();
    }

    /* 字段自己的那个 label，只认直接子元素：复选框组里每个选项也是 <label>，
       用后代选择器会把它们一起抓进来。 */
    function ownLabel(field) {
        for (var i = 0; i < field.children.length; i++) {
            if (field.children[i].tagName === 'LABEL') {
                return field.children[i];
            }
        }
        return null;
    }

    /* ─────────────────────────────────────────────────────────────
       可用高度
       ─────────────────────────────────────────────────────────────

       两个弹窗都在样式表里按 90vh 估算过一次上限，这里把估算换成量出来的值：
       标题栏的真实高度 + 当前视口的真实高度（innerHeight 在移动端反映的是去掉
       浏览器工具条之后的可视高度，比 vh 单位准）。 */

    function spaceForLm(panel, headerH) {
        var vh = viewportH();
        if (vh < 200) { return null; }

        /* 居中弹窗上下都要留白；右下角浮窗贴着底边，只需要在顶部留一点。 */
        var isCenter = !!(panel.closest && panel.closest('.nbb2b-lm-widget--center'));
        var panelMax = isCenter ? (vh - 24) : (vh - 12);

        return {
            panel: panelMax,
            body:  Math.max(80, panelMax - headerH)
        };
    }

    function spaceForMm(panel, headerH) {
        var vh = viewportH();
        if (vh < 200) { return null; }
        /* 主体是 flex:1，剩多少吃多少，不需要单独给上限。 */
        return { panel: vh - 16, body: null };
    }

    function updateSpace(cfg, panel) {
        var header = cfg.header ? panel.querySelector(cfg.header) : null;
        var headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
        var space;

        try {
            space = cfg.space(panel, headerH);
        } catch (e) {
            space = null;
        }

        if (!space) { return; }

        panel.style.setProperty('--cxb-fit-panel-max', Math.round(space.panel) + 'px');
        if (space.body !== null && space.body !== undefined) {
            panel.style.setProperty('--cxb-fit-body-max', Math.round(space.body) + 'px');
        }
        if (!panel.hasAttribute(SPACE_ATTR)) {
            panel.setAttribute(SPACE_ATTR, '');
        }
    }

    /* ─────────────────────────────────────────────────────────────
       字段文字进出控件
       ───────────────────────────────────────────────────────────── */

    function labelIn(field, label, cfg) {
        /* 复选框组：没有可写的 placeholder，字段名改排在选项左侧。 */
        if (cfg.group && field.querySelector(cfg.group)) {
            field.classList.add(INLINE_CLS);
            return;
        }

        var ctrl = field.querySelector(CTRL_SEL);
        if (!ctrl) { return; }

        var text = labelText(label);
        if (!text) { return; }

        if (ctrl.tagName === 'SELECT') {
            /* 下拉的第一项本来就写着「-- 字段名 --」，字段名不会丢。只有那一项
               恰好是空文字时才补上，否则收起 label 之后这一栏就没有名字了。 */
            var first = ctrl.options && ctrl.options.length ? ctrl.options[0] : null;
            if (first && first.value === '' && !first.textContent.trim()) {
                first.setAttribute(OPT_ATTR, '');
                first.textContent = text;
            }
        } else if (!ctrl.hasAttribute(PH_ATTR)) {
            /* 原来的 placeholder 先备份再覆盖。本插件渲染的字段没有 placeholder，
               但 Elementor、翻译插件、主题都可能事后加一个。 */
            ctrl.setAttribute(PH_ATTR, ctrl.getAttribute('placeholder') || '');
            ctrl.setAttribute('placeholder', text);
        }

        field.classList.add(HIDE_CLS);
    }

    function labelOut(field) {
        field.classList.remove(HIDE_CLS);
        field.classList.remove(INLINE_CLS);

        var ctrl = field.querySelector(CTRL_SEL);
        if (!ctrl) { return; }

        if (ctrl.hasAttribute(PH_ATTR)) {
            var original = ctrl.getAttribute(PH_ATTR);
            if (original) {
                ctrl.setAttribute('placeholder', original);
            } else {
                ctrl.removeAttribute('placeholder');
            }
            ctrl.removeAttribute(PH_ATTR);
        }

        if (ctrl.tagName === 'SELECT' && ctrl.options) {
            for (var i = 0; i < ctrl.options.length; i++) {
                if (ctrl.options[i].hasAttribute(OPT_ATTR)) {
                    ctrl.options[i].textContent = '';
                    ctrl.options[i].removeAttribute(OPT_ATTR);
                }
            }
        }
    }

    function setLabels(cfg, panel, inside) {
        var fields = panel.querySelectorAll(cfg.field);
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            var label = ownLabel(field);
            /* 没有自己的 label 的字段（提交按钮、人机验证、reCAPTCHA 声明）
               本来就不占标签的高度，跳过。 */
            if (!label) { continue; }
            if (inside) {
                labelIn(field, label, cfg);
            } else {
                labelOut(field);
            }
        }
    }

    /* ─────────────────────────────────────────────────────────────
       档位
       ───────────────────────────────────────────────────────────── */

    function applyLevel(cfg, panel, level) {
        if (level > 0) {
            if (panel.getAttribute(ATTR) !== String(level)) {
                panel.setAttribute(ATTR, String(level));
            }
        } else if (panel.hasAttribute(ATTR)) {
            panel.removeAttribute(ATTR);
        }

        setLabels(cfg, panel, level >= COMPACT_AT);
    }

    /* 档位换了之后留言框的字号、内边距和高度上限都变了，autogrow 上一次算出的
       行内高度对不上了，重算一次再测。 */
    function regrow(panel) {
        if (window.cxbB2BAutoGrow && window.cxbB2BAutoGrow.fitAll) {
            try {
                window.cxbB2BAutoGrow.fitAll(panel);
            } catch (e) { /* 量高度不该拖垮弹窗 */ }
        }
    }

    function overflows(body) {
        return (body.scrollHeight - body.clientHeight) > SLACK;
    }

    function fitPanel(cfg, panel) {
        if (!visible(panel)) { return; }

        var body = panel.querySelector(cfg.body);
        if (!body) { return; }

        updateSpace(cfg, panel);

        /* clientHeight 为 0 说明这一帧还没排好版（面板刚显示、字体还没到位）。
           这时候的测量结果没有意义，留给下一次触发。 */
        if (body.clientHeight <= 0) { return; }

        for (var level = 0; ; level++) {
            applyLevel(cfg, panel, level);
            /* 每一档都重新量一次可用高度：标题栏的内边距本身也跟着档位收，
               拿上一档的标题栏高度去算这一档的主体上限，会差出几像素，而面板是
               overflow:hidden，差出来的那几像素是被裁掉而不是能滚到的。 */
            updateSpace(cfg, panel);
            regrow(panel);
            if (level >= MAX_LEVEL) { break; }
            /* 读 scrollHeight 会强制同步重排，档位因此是按真实排版结果选的，
               不是按估算。 */
            if (!overflows(body)) { break; }
        }
    }

    /* ─────────────────────────────────────────────────────────────
       触发
       ───────────────────────────────────────────────────────────── */

    var observers = [];
    var timer     = null;
    var running   = false;

    function stopWatching() {
        for (var i = 0; i < observers.length; i++) {
            try { observers[i].disconnect(); } catch (e) { /* noop */ }
        }
        observers = [];
    }

    function startWatching() {
        if (typeof window.MutationObserver !== 'function') { return; }

        for (var t = 0; t < TARGETS.length; t++) {
            var cfg = TARGETS[t];
            var panel = document.querySelector(cfg.panel);
            if (!panel) { continue; }

            /* 开关弹窗：右下角浮窗靠 jQuery 写行内 style，移动端弹窗靠遮罩上的
               class，所以两种都盯着。 */
            for (var w = 0; w < cfg.watch.length; w++) {
                var node = document.querySelector(cfg.watch[w]);
                if (!node) { continue; }
                var attrObs = new MutationObserver(schedule);
                attrObs.observe(node, {
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
                observers.push(attrObs);
            }

            /* 内容变化：产品摘要会在询盘清单变动时整块重绘，字段也可能被其他脚本
               增删。只盯 childList，不盯属性——行内高度、聚焦态那些每敲一下键盘
               就变的东西不该触发重排。 */
            var body = panel.querySelector(cfg.body);
            if (body) {
                var treeObs = new MutationObserver(schedule);
                treeObs.observe(body, { childList: true, subtree: true });
                observers.push(treeObs);
            }
        }
    }

    function fitAll() {
        if (running) { return; }
        running = true;

        /* 观察器全程挂起：下面这几行改的东西正是它们在盯的。 */
        stopWatching();
        try {
            for (var i = 0; i < TARGETS.length; i++) {
                var cfg = TARGETS[i];
                var panels = document.querySelectorAll(cfg.panel);
                for (var j = 0; j < panels.length; j++) {
                    try {
                        fitPanel(cfg, panels[j]);
                    } catch (e) {
                        if (window.console && window.console.warn) {
                            window.console.warn('[cxb-b2b] popup-fit:', e);
                        }
                    }
                }
            }
        } finally {
            startWatching();
            running = false;
        }
    }

    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(fitAll, DEBOUNCE);
    }

    function insidePanel(node) {
        if (!node || !node.closest) { return false; }
        for (var i = 0; i < TARGETS.length; i++) {
            if (node.closest(TARGETS[i].panel)) { return true; }
        }
        return false;
    }

    /* 视口变了，可用高度就变了。移动端弹出键盘同样走这里。 */
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    /* 留言框会随着输入长高，长到某一行就装不下了。 */
    document.addEventListener('input', function (e) {
        if (insidePanel(e.target)) { schedule(); }
    });

    /* 询盘清单变动会换掉弹窗顶部的产品摘要。 */
    document.addEventListener('cxb:quote:updated', schedule);

    function init() {
        startWatching();
        fitAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* 面板从隐藏变可见的那一刻自己是量不出来的，两个弹窗脚本在打开时会调它。
       refresh() 合并抖动，refreshNow() 立刻算。 */
    window.cxbB2BPopupFit = {
        refresh:    schedule,
        refreshNow: fitAll
    };
})();
