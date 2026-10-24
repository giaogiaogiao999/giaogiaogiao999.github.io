/**
 * 模板1 顶部横向分类导航 · 触屏与窄屏的展开控制
 *
 * 指针设备上二级菜单仍然由 CSS 的 :hover 负责，见 frontend.css 里
 * @media (hover: hover) and (pointer: fine) 那一段。这个脚本只管没有悬停
 * 可用的场合：触屏设备，以及窗口被缩到 768px 以下的桌面浏览器 —— 那一档
 * CSS 已经把面板改成铺在整条导航下方的抽屉，需要一个明确的开合动作。
 *
 * 交互约定是「第一次点开、第二次进入」：带子分类的胶囊第一次点击拦下跳转
 * 并展开面板，再点一次才跳到该分类页。没有子分类的胶囊一如既往直接跳转。
 * 这样一次点击只做一件事，不会像裸 :hover 那样面板闪一下、页面同时跳走。
 *
 * @since 2.2.3
 * @package Fhwy_B2B_Product_Showcase
 */
(function () {
    'use strict';

    var OPEN_CLASS = 'is-open';
    var ITEM_SEL = '.cxb-b2b-template1-category-item';
    var LINK_SEL = '.cxb-b2b-template1-category-link';
    var NAV_SEL = '.cxb-b2b-template1-category-nav';

    // Element.closest 在目标浏览器里都有，但 IE11 没有。缺了就整个不接管，
    // 让 CSS 的 :hover 独自工作 —— 那些浏览器也不是触屏。
    if (!document.querySelector || !Element.prototype.closest) {
        return;
    }

    /**
     * 当前是否该由点击接管。
     *
     * 两个条件任一成立即可：设备没有真正的悬停（触屏），或者视口已经窄到
     * CSS 把面板改成抽屉式的那一档。第二个条件是给桌面浏览器缩窗口用的 ——
     * 那时鼠标还在，但面板的定位基准已经换成整条导航，靠悬停开合会让指针
     * 从胶囊移向面板的途中穿过其它胶囊，面板一路闪烁。
     */
    function tapMode() {
        if (!window.matchMedia) {
            return false;
        }
        var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        var narrow = window.matchMedia('(max-width: 768px)').matches;
        return !hoverable || narrow;
    }

    function closeAll(except) {
        var open = document.querySelectorAll(ITEM_SEL + '.' + OPEN_CLASS);
        for (var i = 0; i < open.length; i++) {
            if (open[i] !== except) {
                open[i].classList.remove(OPEN_CLASS);
            }
        }
    }

    document.addEventListener('click', function (e) {
        // 合成事件里 target 未必是 Element（可能是 document / window）
        if (!e.target || typeof e.target.closest !== 'function') {
            return;
        }

        var link = e.target.closest(LINK_SEL);

        // 点在导航之外：收起一切。点在面板里的子分类链接上不受影响，
        // 那些链接不匹配 LINK_SEL，会走到这里并正常跳转。
        if (!link) {
            if (!e.target.closest(NAV_SEL)) {
                closeAll(null);
            }
            return;
        }

        var item = link.closest(ITEM_SEL);
        if (!item || !item.classList.contains('has-children')) {
            return;
        }

        if (!tapMode()) {
            return; // 指针设备上交给 :hover，链接照常跳转
        }

        if (item.classList.contains(OPEN_CLASS)) {
            return; // 第二次点击：放行，跳到分类页
        }

        e.preventDefault();
        closeAll(item);
        item.classList.add(OPEN_CLASS);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
            closeAll(null);
        }
    });

    /*
     * 窗口被拉宽回指针档时收起面板。
     *
     * 不收的话，.is-open 会和 :hover 同时生效：鼠标已经移开，面板却因为
     * 类名还在而一直挂着，看上去像卡住了。
     */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) {
            window.clearTimeout(resizeTimer);
        }
        resizeTimer = window.setTimeout(function () {
            if (!tapMode()) {
                closeAll(null);
            }
        }, 150);
    });
})();
