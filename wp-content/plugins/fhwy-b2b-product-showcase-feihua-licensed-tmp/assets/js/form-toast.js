/**
 * Form result toast — the confirmation and error banner for the popup forms.
 *
 * Shared by the Leave a Message panel and the mobile bottom-menu Message
 * overlay. Both used to write the result into a <div> sitting under the submit
 * button, inside a panel that is capped at 70–90vh and scrolls. On a laptop in
 * a short window, or on a phone with the keyboard still up, that div lands
 * below the fold: the visitor submits, sees nothing happen, and submits again.
 *
 * This puts the result in a fixed banner pinned to the top of the viewport
 * instead, so it is on screen whatever the panel is doing — including after
 * the panel auto-closes, which is when the confirmation matters most.
 *
 * The styles are injected from here rather than living in a stylesheet. The
 * two callers load different sheets (leave-message.css / mobile-menu.css) and
 * each of those is enqueued on its own conditions; a shared component that
 * depends on someone else's sheet is exactly how the mobile search dropdown
 * ended up unstyled on non-plugin pages in 2.1.71. Self-contained is the only
 * arrangement that cannot drift.
 *
 * @since 2.1.82
 * @package Fhwy_B2B_Product_Showcase
 */
(function () {
    'use strict';

    var HOST_ID = 'cxb-b2b-form-toast';
    var STYLE_ID = 'cxb-b2b-form-toast-css';

    /* Long enough to read a sentence, short enough not to linger. Errors get
       more time because they usually ask the visitor to go and fix something. */
    var DURATION = { success: 6000, error: 10000 };

    var host = null;
    var hideTimer = null;

    /* ------------------------------------------------------------------
       译文解析：从页面上的可翻译副本里取这句话的当前语言版本。

       提示语是 admin-ajax.php 用 JSON 回来的，TranslatePress / Weglot 这类
       DOM 型翻译插件只翻页面 HTML，翻不到 JSON，也翻不到 <script> 里的
       window.cxbB2BI18n——所以提交成功提示语在它们的字符串列表里根本不
       出现，站长无从翻译。

       PHP 端 output_frontend_translatable_strings() 会在页脚打印一个隐藏
       容器 #cxb-b2b-tp-strings，把这几条提示语写成真正的文本节点；页面以
       哪种语言渲染，节点里就已经是哪种语言。这里做的就是查一次这张表：
       优先按服务端给的 message_key 查，没有键就拿原文去对 data-cxb-src，
       两条都落空就原样用服务端那句（等于没装翻译插件时的旧行为）。

       容器不存在时不写缓存——它在 wp_footer 打印，而本文件也在页脚加载，
       理论上先于任何一次提交就绪；万一被别的插件挪了位置，下次提交还能
       再试一遍。
       ------------------------------------------------------------------ */
    var BAG_ID = 'cxb-b2b-tp-strings';
    var bag = null;

    function trim(s) {
        return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
    }

    function readBag() {
        if (bag) { return bag; }

        var root = document.getElementById(BAG_ID);
        if (!root) { return null; }

        var nodes = root.querySelectorAll('.cxb-b2b-tp-string');
        if (!nodes.length) { return null; }

        var map = { byKey: {}, bySrc: {} };
        for (var i = 0; i < nodes.length; i++) {
            var el    = nodes[i];
            var entry = {
                /* 文本节点：翻译插件翻过的，就是当前语言的说法。 */
                text: trim(el.textContent),
                /* 属性：翻译插件不碰自定义 data-* 属性，所以这里始终是原文。 */
                src:  trim(el.getAttribute('data-cxb-src'))
            };
            if (!entry.text) { continue; }

            var key = el.getAttribute('data-cxb-key');
            if (key) { map.byKey[key] = entry; }
            if (entry.src) { map.bySrc[entry.src] = entry; }
        }

        bag = map;
        return bag;
    }

    /**
     * @param {string} message 服务端返回的原文。
     * @param {string} [key]   服务端返回的 message_key，可为空。
     * @return {string} 当前语言下应当显示的文案。
     */
    function resolve(message, key) {
        var map = readBag();
        if (!map) { return message; }

        var entry = (key && map.byKey[key]) ? map.byKey[key] : null;
        if (!entry) {
            entry = map.bySrc[trim(message)] || null;
        }
        if (!entry) { return message; }

        /* 页面上这条没有被翻译（译文与原文一字不差）时，用服务端刚回来的那句。

           两种情况会走到这儿：一是访客看的就是默认语言，本来也不需要换；
           二是后台刚改过提示语、而这个页面还是改之前的缓存——这时服务端
           那句才是新的，拿缓存里的旧句子覆盖它就是倒退。 */
        if (entry.text === entry.src) { return message; }

        return entry.text;
    }

    var CSS = [
        '#' + HOST_ID + '{',
        'position:fixed;top:0;left:0;right:0;z-index:1000100;',
        'display:flex;justify-content:center;',
        'padding:16px 12px;pointer-events:none;',
        '}',

        '#' + HOST_ID + ' .cxb-toast{',
        'position:relative;overflow:hidden;',
        'display:flex;align-items:flex-start;gap:12px;',
        'width:100%;max-width:460px;box-sizing:border-box;',
        'padding:14px 16px;',
        'background:#ffffff;border-radius:14px;',
        'border:1px solid rgba(15,23,42,0.08);',
        /* Two layers: a wide soft one to lift it off the page, a tight one so
           its edge stays legible against a busy background. */
        'box-shadow:0 16px 36px -12px rgba(15,23,42,0.30),0 2px 6px -2px rgba(15,23,42,0.12);',
        'pointer-events:auto;',
        'opacity:0;transform:translateY(-12px);',
        'transition:opacity .24s ease,transform .24s cubic-bezier(.2,.9,.3,1.2);',
        '}',

        '#' + HOST_ID + ' .cxb-toast.is-visible{opacity:1;transform:translateY(0);}',

        /* A coloured strip down the left edge carries the success/error meaning
           at a glance, before any text is read. It reads currentColor, which is
           set per variant on the card; the text and icon set their own colours
           so they do not follow it. */
        '#' + HOST_ID + ' .cxb-toast::before{',
        'content:"";position:absolute;left:0;top:0;bottom:0;width:4px;',
        'background:currentColor;',
        '}',

        '#' + HOST_ID + ' .cxb-toast--success{color:#16a34a;}',
        '#' + HOST_ID + ' .cxb-toast--error{color:#dc2626;}',

        /* No background:currentColor here: the rule also sets color:#fff for the
           glyph, so currentColor would resolve to white and the badge would
           vanish if the variant rules below were ever dropped. Stated per
           variant instead. */
        '#' + HOST_ID + ' .cxb-toast__icon{',
        'flex:0 0 auto;display:flex;align-items:center;justify-content:center;',
        'width:26px;height:26px;border-radius:50%;',
        'background:#6b7280;color:#fff;margin-top:1px;',
        '}',
        '#' + HOST_ID + ' .cxb-toast--success .cxb-toast__icon{background:#16a34a;}',
        '#' + HOST_ID + ' .cxb-toast--error .cxb-toast__icon{background:#dc2626;}',
        '#' + HOST_ID + ' .cxb-toast__icon svg{display:block;width:15px;height:15px;}',

        '#' + HOST_ID + ' .cxb-toast__text{',
        'flex:1;min-width:0;margin:0;padding:0;',
        'font-size:14px;line-height:1.5;font-weight:500;color:#14171f;',
        'overflow-wrap:break-word;',
        '}',

        '#' + HOST_ID + ' .cxb-toast__close{',
        'flex:0 0 auto;width:26px;height:26px;padding:0;margin:0;',
        'display:flex;align-items:center;justify-content:center;',
        'border:0;border-radius:50%;background:transparent;',
        'color:#9aa1ab;font-size:19px;line-height:1;cursor:pointer;',
        '-webkit-appearance:none;appearance:none;',
        '}',
        '#' + HOST_ID + ' .cxb-toast__close:hover{background:#f2f4f7;color:#14171f;}',

        '@media (max-width:600px){',
        '#' + HOST_ID + '{padding:10px 10px;}',
        '#' + HOST_ID + ' .cxb-toast{padding:12px 14px;border-radius:12px;}',
        '#' + HOST_ID + ' .cxb-toast__text{font-size:13.5px;}',
        '}',

        '@media (prefers-reduced-motion:reduce){',
        '#' + HOST_ID + ' .cxb-toast{transition:opacity .2s ease;transform:none;}',
        '#' + HOST_ID + ' .cxb-toast.is-visible{transform:none;}',
        '}'
    ].join('');

    var ICON = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
    };

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) { return; }
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.appendChild(document.createTextNode(CSS));
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureHost() {
        if (host && host.parentNode) { return host; }
        injectStyle();
        host = document.createElement('div');
        host.id = HOST_ID;
        /* aria-live so the result is announced even though it is not where the
           focus is; polite rather than assertive because the visitor has just
           acted and is not being interrupted. */
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
        return host;
    }

    function hide() {
        if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
        if (!host) { return; }
        var card = host.firstChild;
        if (!card) { return; }
        card.className = card.className.replace(' is-visible', '');
        window.setTimeout(function () {
            if (host && card.parentNode === host) { host.removeChild(card); }
        }, 260);
    }

    function show(message, type, key) {
        if (!message) { return; }
        type = (type === 'error') ? 'error' : 'success';

        /* 换成当前语言的说法。查不到就是原样返回，不影响未装翻译插件的站点。 */
        var resolved = resolve(message, key);

        var root = ensureHost();
        root.innerHTML = '';

        var card = document.createElement('div');
        card.className = 'cxb-toast cxb-toast--' + type;

        var icon = document.createElement('span');
        icon.className = 'cxb-toast__icon';
        icon.innerHTML = ICON[type];

        /* textContent, not innerHTML: the string comes back from the server and
           may carry a site-authored custom message. */
        var text = document.createElement('p');
        text.className = 'cxb-toast__text';
        text.textContent = String(resolved).replace(/<[^>]*>/g, '');

        /* 已经拿到译文了，就挡住翻译插件的 DOM 监听器，别再对着这段译文
           翻第二次——TranslatePress 支持的正是这个属性；没翻到时不加，
           让它的动态翻译还有机会兜底。 */
        if (resolved !== message) {
            text.setAttribute('data-no-dynamic-translation', '');
            text.setAttribute('data-no-auto-translation', '');
        }

        var close = document.createElement('button');
        close.type = 'button';
        close.className = 'cxb-toast__close';
        close.setAttribute('aria-label', 'Close');
        close.innerHTML = '&times;';
        close.addEventListener('click', hide);

        card.appendChild(icon);
        card.appendChild(text);
        card.appendChild(close);
        root.appendChild(card);

        /* One frame before adding the class, so the transition has a start
           state to move from — set both in the same frame and it jumps. */
        window.requestAnimationFrame(function () {
            card.className += ' is-visible';
        });

        if (hideTimer) { window.clearTimeout(hideTimer); }
        hideTimer = window.setTimeout(hide, DURATION[type]);
    }

    /* resolve 一并导出：询价请求页、Elementor 表单小部件这些不走顶部提示条
       的地方，如果也要吃到译文，直接 cxbB2BFormToast.resolve(msg, key)。 */
    window.cxbB2BFormToast = { show: show, hide: hide, resolve: resolve };
})();
