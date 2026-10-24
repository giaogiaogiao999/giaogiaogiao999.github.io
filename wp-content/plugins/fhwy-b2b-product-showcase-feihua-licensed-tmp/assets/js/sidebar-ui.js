/**
 * 菲华伟业 B2B Product Showcase — Sidebar UI
 *
 * Behaviour layer for the v2 navigation rail: category accordion, product
 * search, latest-products scroller, sticky rail. Vanilla ES5-compatible, no
 * jQuery dependency, and every enhancement degrades to the server-rendered
 * markup if the script never runs.
 *
 * Configuration arrives as `cxbSidebarUI` via wp_localize_script.
 *
 * @since 2.1.23
 */
(function () {
    'use strict';

    var CFG = window.cxbSidebarUI || {};
    /* Must match the breakpoint at which the CSS turns the desktop flyout into
       an inline accordion (product-card-ui.css section 13 / frontend.css
       .cxb-sb-v2 mobile block). If the two drift apart, the band between them
       gets the desktop `cxb-amazon-open` class while the CSS is listening for
       `cxb-sb-open`, and the branch simply will not open. */
    var MOBILE_MAX = 992;
    var OPEN = 'cxb-sb-open';

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }

    function isMobile() {
        return window.innerWidth <= MOBILE_MAX;
    }

    function debounce(fn, wait) {
        var t;
        return function () {
            var args = arguments, self = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(self, args); }, wait);
        };
    }

    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* Post titles arrive with entities already encoded, so they are decoded
       once before escaping — otherwise an ampersand in a product name would
       render as `&amp;`. Parsing happens inside a detached <textarea>, whose
       content model is text, so nothing in the string can become an element. */
    var decoder = document.createElement('textarea');

    function decodeEntities(str) {
        decoder.innerHTML = String(str == null ? '' : str);
        return decoder.value;
    }

    /* ======================================================================
       1. Category accordion
       ----------------------------------------------------------------------
       The toggle is a real <button> rendered as a sibling of the category
       link, so expanding a group never competes with following it. Opening a
       branch leaves its ancestors open — collapsing them would hide the row
       the visitor just clicked.
       ====================================================================== */
    function initCategories(rail) {
        var toggles = $$('.toggle-arrow, .amazon-arrow', rail);
        if (!toggles.length) { return; }

        function itemOf(btn) {
            return btn.closest ? btn.closest('.cxb-b2b-sidebar-category-item') : null;
        }

        function isAmazon(item) {
            return item.classList.contains('amazon');
        }

        function setOpen(item, open) {
            item.classList.toggle(OPEN, open);
            var btn = item.querySelector(':scope > .toggle-arrow, :scope > .amazon-arrow');
            if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
        }

        /* Siblings of the branch being opened close; ancestors stay put. */
        function closeSiblings(item) {
            var parentList = item.parentNode;
            if (!parentList) { return; }
            $$(':scope > .cxb-b2b-sidebar-category-item.' + OPEN, parentList).forEach(function (other) {
                if (other !== item) { setOpen(other, false); }
            });
        }

        toggles.forEach(function (btn) {
            var item = itemOf(btn);
            if (!item) { return; }

            btn.setAttribute('aria-expanded', item.classList.contains(OPEN) ? 'true' : 'false');

            /* Bound on the element itself, so stopPropagation keeps the event
               away from the legacy document-level handlers. */
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                /* Desktop flyout menus are governed by pointer geometry
                   elsewhere; the button gives that menu a click and keyboard
                   route as well. */
                if (isAmazon(item) && !isMobile()) {
                    var wasOpen = item.classList.contains('cxb-amazon-open');
                    $$('.cxb-b2b-sidebar-category-item.cxb-amazon-open', rail).forEach(function (o) {
                        if (o !== item) { o.classList.remove('cxb-amazon-open'); }
                    });
                    item.classList.toggle('cxb-amazon-open', !wasOpen);
                    btn.setAttribute('aria-expanded', !wasOpen ? 'true' : 'false');
                    return;
                }

                var open = !item.classList.contains(OPEN);
                if (open) { closeSiblings(item); }
                setOpen(item, open);
            });
        });

        /* Reveal the branch the visitor is currently inside. */
        var active = $('.cxb-b2b-sidebar-category-item.active', rail);
        if (active) {
            if (active.classList.contains('has-children')) { setOpen(active, true); }
            var node = active.parentNode;
            while (node && node !== rail) {
                if (node.classList &&
                    node.classList.contains('cxb-b2b-sidebar-category-item') &&
                    node.classList.contains('has-children')) {
                    setOpen(node, true);
                }
                node = node.parentNode;
            }
        }
    }

    /* ======================================================================
       2. Product search
       ----------------------------------------------------------------------
       The nonce embedded in the page can be stale whenever the HTML was
       served from a page cache, so it is treated as a first guess only: a
       fresh one is fetched on focus through admin-ajax (which page caches do
       not serve) and the request is retried once on `invalid_nonce`.
       ====================================================================== */
    function initSearch(rail) {
        var mount = $('#cxb-b2b-product-search-mount', rail);
        if (!mount || !CFG.ajaxUrl) { return; }

        var listId = 'cxb-sb-search-results';

        mount.innerHTML =
            '<div class="cxb-b2b-product-search-input-wrap">' +
                '<input type="search" class="cxb-b2b-product-search-input" ' +
                    'placeholder="' + esc(CFG.i18n && CFG.i18n.placeholder) + '" ' +
                    'aria-label="' + esc(CFG.i18n && CFG.i18n.placeholder) + '" ' +
                    'role="combobox" aria-expanded="false" aria-autocomplete="list" ' +
                    'aria-controls="' + listId + '" autocomplete="off" spellcheck="false">' +
                '<span class="cxb-b2b-product-search-icon" aria-hidden="true">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
                '</span>' +
                '<button type="button" class="cxb-b2b-product-search-clear" ' +
                    'aria-label="' + esc(CFG.i18n && CFG.i18n.clear) + '">' +
                    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="cxb-b2b-product-search-results" id="' + listId + '" role="listbox" hidden></div>';

        var wrapper = mount.closest('.cxb-b2b-product-search-wrapper') || mount;
        var input = $('.cxb-b2b-product-search-input', mount);
        var clear = $('.cxb-b2b-product-search-clear', mount);
        var panel = $('.cxb-b2b-product-search-results', mount);

        var activeIndex = -1;
        var items = [];
        var requestSeq = 0;

        /* ---- nonce ---- */
        function freshNonce(force) {
            if (!force && window.__cxbB2bSearchNonceCache) {
                return Promise.resolve(window.__cxbB2bSearchNonceCache);
            }
            if (window.__cxbB2bSearchNonceP) { return window.__cxbB2bSearchNonceP; }

            var fd = new FormData();
            fd.append('action', 'cxb_b2b_refresh_search_nonce');
            window.__cxbB2bSearchNonceP = fetch(CFG.ajaxUrl, {
                method: 'POST', body: fd, credentials: 'same-origin', cache: 'no-store'
            })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    window.__cxbB2bSearchNonceP = null;
                    if (res && res.success && res.data && res.data.nonce) {
                        window.__cxbB2bSearchNonceCache = res.data.nonce;
                        return res.data.nonce;
                    }
                    return null;
                })
                .catch(function () { window.__cxbB2bSearchNonceP = null; return null; });

            return window.__cxbB2bSearchNonceP;
        }

        function currentNonce() {
            return window.__cxbB2bSearchNonceCache || CFG.nonce || '';
        }

        function queryOnce(q, nonce) {
            var fd = new FormData();
            fd.append('action', 'cxb_b2b_product_search');
            fd.append('nonce', nonce);
            fd.append('query', q);
            return fetch(CFG.ajaxUrl, {
                method: 'POST', body: fd, credentials: 'same-origin', cache: 'no-store'
            }).then(function (r) { return r.json(); });
        }

        /* ---- panel ---- */
        function openPanel() {
            panel.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        }

        function closePanel() {
            panel.hidden = true;
            panel.innerHTML = '';
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
            items = [];
        }

        function showSkeleton() {
            var row = '<div class="cxb-b2b-search-skeleton" aria-hidden="true">' +
                '<span class="sk-thumb"></span><span class="sk-line"></span></div>';
            panel.innerHTML = row + row + row;
            openPanel();
        }

        function highlight(title, q) {
            var safe = esc(title);
            var needle = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!needle) { return safe; }
            try {
                return safe.replace(new RegExp('(' + needle + ')', 'gi'), '<mark>$1</mark>');
            } catch (err) {
                return safe;
            }
        }

        function render(res, q) {
            if (!res || !res.success || !res.data || !res.data.length) {
                panel.innerHTML =
                    '<div class="cxb-b2b-product-search-no-results">' +
                        '<strong>' + esc(CFG.i18n && CFG.i18n.noResults) + '</strong>' +
                        esc(CFG.i18n && CFG.i18n.noResultsHint) +
                    '</div>';
                openPanel();
                items = [];
                activeIndex = -1;
                return;
            }

            var html = '';
            res.data.forEach(function (p, i) {
                html += '<a class="cxb-b2b-product-search-result-item" role="option" aria-selected="false" ' +
                            'id="cxb-sb-opt-' + i + '" href="' + esc(p.url) + '">';
                if (p.thumbnail) {
                    html += '<span class="cxb-b2b-product-search-result-thumb">' +
                                '<img src="' + esc(p.thumbnail) + '" alt="" loading="lazy" />' +
                            '</span>';
                }
                html += '<span class="cxb-b2b-product-search-result-title">' + highlight(decodeEntities(p.title), q) + '</span>';
                html += '</a>';
            });

            panel.innerHTML = html;
            openPanel();
            items = $$('.cxb-b2b-product-search-result-item', panel);
            activeIndex = -1;
        }

        function setActive(i) {
            if (!items.length) { return; }
            if (activeIndex > -1 && items[activeIndex]) {
                items[activeIndex].classList.remove('is-active');
                items[activeIndex].setAttribute('aria-selected', 'false');
            }
            activeIndex = (i + items.length) % items.length;
            var el = items[activeIndex];
            el.classList.add('is-active');
            el.setAttribute('aria-selected', 'true');
            input.setAttribute('aria-activedescendant', el.id);

            var top = el.offsetTop;
            var bottom = top + el.offsetHeight;
            if (top < panel.scrollTop) {
                panel.scrollTop = top;
            } else if (bottom > panel.scrollTop + panel.clientHeight) {
                panel.scrollTop = bottom - panel.clientHeight;
            }
        }

        /* Late responses to abandoned keystrokes are dropped rather than
           painted over the results for the current query. */
        function search(q) {
            var seq = ++requestSeq;
            showSkeleton();

            queryOnce(q, currentNonce())
                .then(function (res) {
                    if (seq !== requestSeq) { return; }

                    var stale = (res && res.success === false && res.data && res.data.code === 'invalid_nonce') ||
                                (typeof res === 'number' && res === -1);
                    if (!stale) { render(res, q); return; }

                    window.__cxbB2bSearchNonceCache = null;
                    freshNonce(true).then(function (n) {
                        if (seq !== requestSeq) { return; }
                        if (!n) { render(res, q); return; }
                        queryOnce(q, n).then(function (r2) {
                            if (seq === requestSeq) { render(r2, q); }
                        }).catch(function () { if (seq === requestSeq) { closePanel(); } });
                    });
                })
                .catch(function () { if (seq === requestSeq) { closePanel(); } });
        }

        function submit() {
            var q = input.value.trim();
            if (!q) { return; }
            window.location.href = CFG.homeUrl + '?s=' + encodeURIComponent(q) + '&post_type=cxb_products';
        }

        var runSearch = debounce(function (q) { search(q); }, 260);

        input.addEventListener('focus', function () { freshNonce(false); });

        input.addEventListener('input', function () {
            var q = input.value.trim();
            wrapper.classList.toggle('has-query', q.length > 0);

            if (q.length < 2) {
                requestSeq++;
                closePanel();
                return;
            }
            runSearch(q);
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length) { setActive(activeIndex + 1); }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length) { setActive(activeIndex - 1); }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex > -1 && items[activeIndex]) {
                    window.location.href = items[activeIndex].getAttribute('href');
                } else {
                    submit();
                }
            } else if (e.key === 'Escape') {
                if (!panel.hidden) {
                    e.stopPropagation();
                    closePanel();
                } else if (input.value) {
                    input.value = '';
                    wrapper.classList.remove('has-query');
                }
            }
        });

        clear.addEventListener('click', function () {
            input.value = '';
            wrapper.classList.remove('has-query');
            requestSeq++;
            closePanel();
            input.focus();
        });

        document.addEventListener('click', function (e) {
            if (!mount.contains(e.target)) { closePanel(); }
        });
    }

    /* ======================================================================
       3. Latest products scroller
       ----------------------------------------------------------------------
       Native overflow scrolling rather than transform paging: rows of unequal
       height stay in step, and touch and trackpad gestures keep working.
       ====================================================================== */
    function initRecentProducts(rail) {
        var container = $('.cxb-b2b-recent-products-container', rail);
        if (!container) { return; }

        var list = $('.cxb-b2b-recent-products-list', container);
        var itemEls = $$('.cxb-b2b-recent-product-item', container);
        if (!list || itemEls.length < 2) { return; }

        var visible = parseInt(CFG.recentVisible, 10) || 5;
        if (itemEls.length <= visible) { return; }

        var reduced = window.matchMedia &&
                      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* Height of the visible window, measured from the rendered rows so a
           two-line title is accounted for. Gaps sit between rows, so there is
           one fewer of them than there are rows. */
        function measure() {
            var count = Math.min(visible, itemEls.length);
            var h = 0;
            for (var i = 0; i < count; i++) {
                h += itemEls[i].offsetHeight;
            }
            h += 2 * (count - 1);
            if (h > 0) { list.style.setProperty('--sb-recent-max', h + 'px'); }
        }

        container.classList.add('cxb-sb-scroll');
        list.style.transform = 'none';
        measure();

        var module = container.closest('.cxb-b2b-sidebar-module');
        var prev = module ? $('.cxb-sb-nav-prev', module) : null;
        var next = module ? $('.cxb-sb-nav-next', module) : null;
        if (!prev || !next) { return; }

        /* Clicks move a tracked target rather than reading scrollTop each
           time. Smooth scrolling animates scrollTop, so a second click landing
           mid-animation would otherwise measure a position the list has not
           reached yet and advance by less than a full row. */
        var target = 0;

        function pitch() {
            return itemEls[0] ? itemEls[0].offsetHeight + 2 : 80;
        }

        function maxTop() {
            return Math.max(0, list.scrollHeight - list.clientHeight);
        }

        function sync() {
            var top = list.scrollTop;
            var limit = maxTop();
            prev.disabled = top <= 1;
            next.disabled = top >= limit - 1;
        }

        function goTo(to) {
            target = Math.max(0, Math.min(to, maxTop()));
            if (list.scrollTo) {
                list.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
            } else {
                list.scrollTop = target;
            }
            /* Reflect the destination immediately; the scroll handler keeps it
               honest as the animation runs. */
            prev.disabled = target <= 1;
            next.disabled = target >= maxTop() - 1;
        }

        function onNav(direction) {
            return function (e) {
                e.preventDefault();
                e.stopPropagation();
                goTo(target + direction * pitch());
            };
        }

        prev.addEventListener('click', onNav(-1));
        next.addEventListener('click', onNav(1));

        /* Once scrolling settles — whether from a button, a wheel, or a touch
           drag — the target realigns with where the list actually is. */
        var settle = debounce(function () {
            target = list.scrollTop;
            sync();
        }, 140);

        list.addEventListener('scroll', function () {
            sync();
            settle();
        }, { passive: true });

        window.addEventListener('resize', debounce(function () {
            measure();
            target = list.scrollTop;
            sync();
        }, 150));

        /* Late-loading thumbnails can change row heights. */
        window.addEventListener('load', function () {
            measure();
            sync();
        });

        sync();
    }

    /* ======================================================================
       4. Sticky rail
       ----------------------------------------------------------------------
       The rail pins by whichever edge keeps all of it reachable.

       A rail shorter than the viewport pins by its top, `stickyOffset` below
       the viewport edge, and stays there for the rest of the scroll. That is
       the product-page case: the filter module is skipped there, so the rail
       is usually short enough.

       A taller rail — the archive rail carries the filter as well — is given
       a negative offset, which pins it by its bottom edge instead: it scrolls
       up with the page until its last module is on screen and holds there.
       Nothing is stranded out of reach, and the rail does not need a
       scrollport of its own, which is the thing product-filters.css takes
       care to avoid (see the note on the filter list's single scroller).

       Travel room is a separate question, and a CSS one: sticky only moves an
       element inside its containing block. See "Travel room for the archive /
       taxonomy templates" in frontend.css.
       ====================================================================== */
    function initSticky(rail) {
        var inner = $('.cxb-b2b-sidebar-inner', rail);
        if (!inner || CFG.sticky === false) { return; }

        var offset = parseInt(CFG.stickyOffset, 10);
        if (isNaN(offset)) { offset = 20; }

        /* Breathing room at whichever edge the rail ends up pinned to. */
        var GAP = 20;

        function evaluate() {
            if (isMobile()) {
                rail.classList.remove('is-sticky');
                return;
            }

            /* Goes negative exactly when the rail outgrows the viewport,
               which is the bottom-pinned offset wanted in that case. */
            var top = Math.min(offset, window.innerHeight - inner.offsetHeight - GAP);

            rail.style.setProperty('--sb-sticky-top', Math.round(top) + 'px');
            rail.classList.add('is-sticky');
        }

        evaluate();
        window.addEventListener('resize', debounce(evaluate, 150));

        /* An accordion, a flyout or a filter group changes the rail height,
           so the offset is recomputed rather than measured once. */
        if (window.ResizeObserver) {
            new ResizeObserver(debounce(evaluate, 150)).observe(inner);
        }
    }

    /* ====================================================================== */
    function init() {
        $$('.cxb-b2b-sidebar.cxb-sb-v2').forEach(function (rail) {
            if (rail.getAttribute('data-cxb-sb-ready') === '1') { return; }
            rail.setAttribute('data-cxb-sb-ready', '1');

            initCategories(rail);
            initSearch(rail);
            initRecentProducts(rail);
            initSticky(rail);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
