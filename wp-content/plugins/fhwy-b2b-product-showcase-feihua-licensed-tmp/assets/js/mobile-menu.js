/**
 * Mobile Bottom Menu – Front-end behaviour
 *
 * @package Fhwy_B2B_Product_Showcase
 */
(function () {
    'use strict';

    // i18n: read translated strings from window.cxbB2BI18n (populated by PHP
    // via __()), with English fallbacks. Supports %s / %1$s / %2$s.
    var I18N = (typeof window !== 'undefined' && window.cxbB2BI18n) ? window.cxbB2BI18n : {};
    function t(key, fallback) {
        var s = (I18N && typeof I18N[key] === 'string') ? I18N[key] : fallback;
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            var i = 0;
            s = s.replace(/%(\d+)\$s/g, function(_, n) { return args[n - 1] !== undefined ? args[n - 1] : ''; });
            s = s.replace(/%s/g, function() { return args[i] !== undefined ? args[i++] : ''; });
        }
        return s;
    }

    function isMobile() {
        return window.innerWidth <= 768;
    }

    if (!isMobile()) {
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (isMobile()) initMobileMenu();
            }, 250);
        });
        return;
    }

    initMobileMenu();

    function initMobileMenu() {
        if (document.body.classList.contains('nbb2b-has-mobile-menu')) return;
        document.body.classList.add('nbb2b-has-mobile-menu');
        document.documentElement.classList.add('nbb2b-has-mobile-menu');

        initProducts();
        initList();
        initContact();
        initChat();
        initMessage();
        initBackTop();
        hideThemeBackTop();
        hideFloatingBasket();
    }

    /* ================================================================
       Hide floating quote basket toggle on mobile (JS fallback)
       quote.js injects the basket dynamically, so CSS alone may lose
       the specificity race when the stylesheet loads before the element
       exists.  This guarantees the toggle stays hidden.
       ================================================================ */
    function hideFloatingBasket() {
        function hide() {
            var el = document.querySelector('.cxb-b2b-quote-basket-toggle');
            if (el) {
                el.style.setProperty('display', 'none', 'important');
            }
        }

        hide();
        setTimeout(hide, 500);
        setTimeout(hide, 1500);

        // MutationObserver: quote.js injects the basket after DOMContentLoaded
        var observer = new MutationObserver(function () { hide(); });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { observer.disconnect(); }, 10000);
    }

    /* ================================================================
       Hide theme built-in back-to-top button (CSS + JS fallback)
       Covers dynamically-injected buttons that CSS alone cannot catch.
       ================================================================ */
    function hideThemeBackTop() {
        var selectors = [
            '#ast-scroll-top',           // Astra
            '.ast-scroll-top-icon',      // Astra alt
            '.generate-back-to-top',     // GeneratePress
            '#scroll-top',               // OceanWP
            '.flavor-back-to-top',       // flavor
            '#back-to-top',              // generic
            '.back-to-top',              // generic
            '#backtotop',
            '.backtotop',
            '#scroll-to-top',
            '.scroll-to-top',
            '.scrolltop',
            '#scrolltop',
            '.go-top',
            '#go-top',
            '.to-top',
            '#toTop',
            '#rocket-to-top',
            '.tt-back-to-top',
            '.wptt-back-to-top'
        ];

        var combined = selectors.join(',');

        // Append custom admin selector if configured
        if (typeof nbb2bCustomBacktopSelector === 'string' && nbb2bCustomBacktopSelector) {
            combined += ',' + nbb2bCustomBacktopSelector;
        }

        function hide() {
            var els = document.querySelectorAll(combined);
            for (var i = 0; i < els.length; i++) {
                // Skip our own back-to-top item inside the mobile menu
                if (els[i].closest('.nbb2b-mobile-menu')) continue;
                els[i].style.setProperty('display', 'none', 'important');
            }
        }

        // Run immediately and after common lazy-load delays
        hide();
        setTimeout(hide, 500);
        setTimeout(hide, 1500);

        // MutationObserver: catch dynamically-injected back-to-top elements
        var observer = new MutationObserver(function () { hide(); });
        observer.observe(document.body, { childList: true, subtree: true });

        // Stop observing after 10 seconds to avoid long-running overhead
        setTimeout(function () { observer.disconnect(); }, 10000);
    }

    /* ================================================================
       Products modal
       ================================================================ */
    function initProducts() {
        var overlay = document.getElementById('nbb2b-mm-products-overlay');
        var modal   = document.getElementById('nbb2b-mm-products-modal');
        var btn     = document.querySelector('.nbb2b-mm-item[data-action="products"]');
        if (!btn || !overlay || !modal) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            overlay.classList.add('nbb2b-mm-show');
            modal.classList.add('nbb2b-mm-show');
        });

        function collapseAll() {
            var open = modal.querySelectorAll('.nbb2b-mm-sub-open');
            for (var i = 0; i < open.length; i++) {
                open[i].classList.remove('nbb2b-mm-sub-open');
            }
            var toggles = modal.querySelectorAll('.nbb2b-mm-cat-toggle');
            for (var j = 0; j < toggles.length; j++) {
                toggles[j].setAttribute('aria-expanded', 'false');
                toggles[j].classList.remove('nbb2b-mm-cat-toggle--open');
            }
        }

        function close() {
            overlay.classList.remove('nbb2b-mm-show');
            modal.classList.remove('nbb2b-mm-show');
            collapseAll();
        }

        overlay.addEventListener('click', close);
        var closeBtn = modal.querySelector('.nbb2b-mm-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', close);

        /* 手风琴：就地展开子分类，而不是盖一层全屏面板。
           一次只开一组——弹层最高 70vh，两组同时展开就要一路滚，
           而在这个高度里访客看不到自己滚过了什么。 */
        var toggles = modal.querySelectorAll('.nbb2b-mm-cat-toggle');
        for (var t = 0; t < toggles.length; t++) {
            (function (btn) {
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    var id    = btn.getAttribute('data-cat-id');
                    var panel = modal.querySelector('.nbb2b-mm-sub-panel[data-cat-id="' + id + '"]');
                    if (!panel) return;

                    var willOpen = !panel.classList.contains('nbb2b-mm-sub-open');
                    collapseAll();

                    if (!willOpen) return;

                    panel.classList.add('nbb2b-mm-sub-open');
                    btn.setAttribute('aria-expanded', 'true');
                    btn.classList.add('nbb2b-mm-cat-toggle--open');

                    /* 展开的那组若一半在视口外，滚动条不动的话访客只会看到
                       箭头翻了个身。把它带到列表顶部，展开的内容就在眼前。 */
                    var body = modal.querySelector('.nbb2b-mm-products-body');
                    var item = btn.closest('.nbb2b-mm-cat-item');
                    if (body && item && typeof body.scrollTo === 'function') {
                        window.setTimeout(function () {
                            body.scrollTo({ top: item.offsetTop, behavior: 'smooth' });
                        }, 60);
                    }
                });
            })(toggles[t]);
        }
    }

    /* ================================================================
       List (Quote Basket) – real-time count sync
       ================================================================ */
    function initList() {
        // In single product inquiry mode the list is not used – skip entirely.
        var cfg = (typeof cxb_b2b_product_showcase !== 'undefined') ? cxb_b2b_product_showcase : null;
        if (cfg && cfg.quote_mode === 'single') return;

        var listBtn = document.querySelector('.nbb2b-mm-item[data-action="list"]');
        if (!listBtn) return;

        var badge = listBtn.querySelector('.nbb2b-mm-badge');
        var countObserver = null;

        // The initial visibility is set server-side by PHP (the .nbb2b-mm-list-show
        // class and badge count are baked into the HTML).  JS keeps the state in sync
        // for live changes (add/remove items without a page reload).

        function syncBadge() {
            var el = document.querySelector('.cxb-b2b-quote-basket-toggle-count');
            var count = 0;
            if (el) count = parseInt(el.textContent, 10) || 0;

            if (badge) {
                badge.textContent = count;
                if (count > 0) badge.classList.add('nbb2b-mm-badge-show');
                else badge.classList.remove('nbb2b-mm-badge-show');
            }

            // Show/hide the entire List menu item via class (no inline style)
            if (count > 0) listBtn.classList.add('nbb2b-mm-list-show');
            else listBtn.classList.remove('nbb2b-mm-list-show');
        }

        function attachCountObserver() {
            var el = document.querySelector('.cxb-b2b-quote-basket-toggle-count');
            if (el && !countObserver) {
                countObserver = new MutationObserver(syncBadge);
                countObserver.observe(el, { childList: true, characterData: true, subtree: true });
                syncBadge();
            }
        }

        // The quote basket DOM is injected by quote.js – it may not exist yet.
        // Strategy: observe the body for new nodes until we find the count element.
        var bodyObserver = new MutationObserver(function () {
            if (document.querySelector('.cxb-b2b-quote-basket-toggle-count')) {
                bodyObserver.disconnect();
                attachCountObserver();
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });

        // Also try immediately and after short delays
        attachCountObserver();
        setTimeout(attachCountObserver, 500);
        setTimeout(attachCountObserver, 1500);

        // Polling fallback: sync every 2 seconds (lightweight)
        setInterval(syncBadge, 2000);

        listBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var toggle = document.querySelector('.cxb-b2b-quote-basket-toggle');
            if (toggle) toggle.click();
        });
    }

    /* ================================================================
       Contact modal
       ================================================================ */
    function initContact() {
        var btn     = document.querySelector('.nbb2b-mm-item[data-action="contact"]');
        var overlay = document.getElementById('nbb2b-mm-contact-overlay');
        if (!btn || !overlay) return;

        btn.addEventListener('click', function (e) { e.preventDefault(); overlay.classList.add('nbb2b-mm-show'); });

        function close() { overlay.classList.remove('nbb2b-mm-show'); }
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        var closeBtn = overlay.querySelector('.nbb2b-mm-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', close);

        // Action rows
        delegate(overlay, '[data-contact-action="phone"]', function (row) {
            var v = row.getAttribute('data-value');
            if (v) window.location.href = 'tel:' + v;
        });
        delegate(overlay, '[data-contact-action="email"]', function (row) {
            var addr = row.getAttribute('data-value');
            var site = row.getAttribute('data-site') || '';
            if (addr) {
                window.location.href = 'mailto:' + addr +
                    '?subject=' + encodeURIComponent(t('quote_request_subject', 'Quote Request')) +
                    '&body=' + encodeURIComponent(t('quote_request_body', "Please reply the following information\nCountry：\nCompany Name：\nContact person：\nQuestion：\nQuantity：\n\nWe will pass the message to our sales manager.\nThank you.\n\n") + site + " " + t('marketing_team_suffix', 'Marketing Team'));
            }
        });
        delegate(overlay, '[data-contact-action="whatsapp"]', function (row) {
            var v = row.getAttribute('data-value');
            if (v) window.open('https://wa.me/' + v.replace(/[^0-9]/g, ''), '_blank', 'noopener');
        });
        delegate(overlay, '[data-contact-action="facebook"]', function (row) {
            var v = row.getAttribute('data-value');
            if (v) window.open(/^https?:\/\//i.test(v) ? v : 'https://www.facebook.com/' + v, '_blank', 'noopener');
        });
    }

    /* ================================================================
       Chat
       ================================================================ */
    function initChat() {
        var btn = document.querySelector('.nbb2b-mm-item[data-action="chat"]');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var t = btn.getAttribute('data-chat') || '';
            if (t === 'tidio' && typeof tidioChatApi !== 'undefined') { tidioChatApi.show(); tidioChatApi.open(); }
            else if (t === 'tawkto' && typeof Tawk_API !== 'undefined') { Tawk_API.maximize(); }
        });
    }

    /* ================================================================
       Message modal (dedicated form, same AJAX as Leave a Message)
       ================================================================ */
    function initMessage() {
        var btn     = document.querySelector('.nbb2b-mm-item[data-action="message"]');
        var overlay = document.getElementById('nbb2b-mm-message-overlay');
        if (!btn || !overlay) return;

        var form    = overlay.querySelector('#nbb2b-mm-msg-form');
        var submit  = overlay.querySelector('.nbb2b-mm-msg-submit');
        var result  = overlay.querySelector('.nbb2b-mm-msg-result');

        /* 提交按钮的原始文案，读一次存起来。

           v2.1.87 起，后台「表单字段 → 自定义提交按钮文本」可以改这个按钮的
           文字。原来提交结束时用 t('submit','Submit') 写回去，等于把 PHP 渲染
           的自定义文案抹掉——访客提交一次，按钮就永久变回 "Submit"。
           回填这里存下的原始文案，后台设成什么都不会丢。 */
        var MM_SUBMIT_LABEL = (submit && submit.textContent.trim()) || t('submit', 'Submit');

        /* 与留言浮窗同一套理由：结果写在提交按钮下方的那个 <div> 里，
           手机上键盘一弹就看不见了。详见 form-toast.js 顶部的说明。 */
        function mmResult(message, type, key) {
            if (window.cxbB2BFormToast) {
                /* key 是服务端给的 message_key，提示条据此到页面上的可翻译
                   副本里取译文；见 form-toast.js 里的 resolve()。 */
                window.cxbB2BFormToast.show(message, type, key);
                result.textContent = '';
                result.className = 'nbb2b-mm-msg-result';
                return;
            }
            result.textContent = message;
            result.className = 'nbb2b-mm-msg-result nbb2b-mm-msg-' + (type === 'error' ? 'error' : 'success');
        }

        // reCAPTCHA config (from cxb_b2b_mobile_msg or leave_message fallback)
        var msgCfg = (typeof cxb_b2b_mobile_msg !== 'undefined') ? cxb_b2b_mobile_msg
                   : (typeof cxb_b2b_leave_message !== 'undefined') ? cxb_b2b_leave_message
                   : {};
        var rcCfg = {
            enabled:  msgCfg.recaptcha_enabled || false,
            type:     msgCfg.recaptcha_type    || 'v2',
            siteKey:  msgCfg.recaptcha_site_key|| ''
        };

        // Turnstile config
        var tsCfg = {
            enabled: msgCfg.turnstile_enabled || false,
            siteKey: msgCfg.turnstile_site_key || ''
        };

        // Render Turnstile widget when modal opens
        var mmTurnstileRendered = false;
        var mmTurnstileWidgetId = null;
        var mmTurnstileRenderAttempts = 0;
        var mmTurnstileMaxAttempts = 20; // Try for up to 10 seconds (20 * 500ms)
        var mmTurnstilePollingTimer = null;
        
        function renderTurnstileWidget() {
            if (mmTurnstileRendered) return true;
            if (!tsCfg.enabled || !tsCfg.siteKey) return true; // Not needed
            
            var el = document.getElementById('nbb2b-mm-turnstile');
            if (!el) return false;
            
            // Check if Turnstile API is available
            if (typeof turnstile === 'undefined' || typeof turnstile.render !== 'function') {
                return false; // API not ready yet
            }
            
            try {
                // Clear any previous content
                el.innerHTML = '';
                mmTurnstileWidgetId = turnstile.render(el, {
                    sitekey: tsCfg.siteKey,
                    callback: function(token) {
                        var input = document.querySelector('.nbb2b-mm-turnstile-token');
                        if (input) input.value = token;
                    },
                    'error-callback': function() {
                        console.log('Turnstile error callback triggered');
                    },
                    'expired-callback': function() {
                        var input = document.querySelector('.nbb2b-mm-turnstile-token');
                        if (input) input.value = '';
                    }
                });
                mmTurnstileRendered = true;
                return true;
            } catch (e) {
                console.log('Turnstile render error:', e);
                return false;
            }
        }
        
        // Poll for Turnstile readiness when modal is open
        function startTurnstilePolling() {
            if (mmTurnstileRendered) return;
            if (mmTurnstilePollingTimer) return; // Already polling
            
            mmTurnstileRenderAttempts = 0;
            mmTurnstilePollingTimer = setInterval(function() {
                mmTurnstileRenderAttempts++;
                
                if (renderTurnstileWidget()) {
                    // Successfully rendered or not needed
                    clearInterval(mmTurnstilePollingTimer);
                    mmTurnstilePollingTimer = null;
                    return;
                }
                
                if (mmTurnstileRenderAttempts >= mmTurnstileMaxAttempts) {
                    // Give up after max attempts
                    clearInterval(mmTurnstilePollingTimer);
                    mmTurnstilePollingTimer = null;
                    console.log('Turnstile failed to load after max attempts');
                }
            }, 500);
        }
        
        function stopTurnstilePolling() {
            if (mmTurnstilePollingTimer) {
                clearInterval(mmTurnstilePollingTimer);
                mmTurnstilePollingTimer = null;
            }
        }
        
        // Reset Turnstile widget (for retry after submission)
        function resetTurnstileWidget() {
            if (typeof turnstile !== 'undefined' && mmTurnstileWidgetId !== null) {
                try {
                    turnstile.reset(mmTurnstileWidgetId);
                } catch (e) { /* ignore */ }
            }
            var input = document.querySelector('.nbb2b-mm-turnstile-token');
            if (input) input.value = '';
        }

        // When Turnstile lazy-loader finishes, try to render the widget
        if (tsCfg.enabled) {
            document.addEventListener('nbb2b:turnstile:ready', function() {
                // If modal is visible, render immediately
                if (overlay.classList.contains('nbb2b-mm-show')) {
                    setTimeout(renderTurnstileWidget, 100);
                }
            });
        }

        // Render v2 widget when modal opens (grecaptcha may load late via lazy-loader)
        var mmRecaptchaRendered = false;
        function renderV2Recaptcha() {
            if (mmRecaptchaRendered) return;
            var el = document.getElementById('nbb2b-mm-recaptcha');
            if (el && typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
                try { grecaptcha.render(el, { sitekey: rcCfg.siteKey }); } catch (e) { /* already rendered */ }
                mmRecaptchaRendered = true;
            }
        }

        // When reCAPTCHA lazy-loader finishes, try to render the v2 widget
        // (if the modal happens to already be open)
        if (rcCfg.enabled && rcCfg.type === 'v2') {
            document.addEventListener('nbb2b:recaptcha:ready', function() {
                setTimeout(renderV2Recaptcha, 100);
            });
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            syncQuoteSummary('mm');
            injectQuoteDataIntoElementorForm(overlay);
            overlay.classList.add('nbb2b-mm-show');
            mmStartPolling();
            /* The message field cannot be measured while the overlay is
               hidden (scrollHeight is 0), so it is sized here instead. */
            if (window.cxbB2BAutoGrow) {
                window.cxbB2BAutoGrow.fitAll(overlay);
            }
            /* Same reason as the line above: the body can only be measured
               once the overlay is on screen. Picks the form density that fits
               the viewport instead of handing the visitor a scrollbar. */
            if (window.cxbB2BPopupFit) {
                window.cxbB2BPopupFit.refreshNow();
            }
            // Render v2 reCAPTCHA after modal becomes visible
            if (rcCfg.enabled && rcCfg.type === 'v2') {
                setTimeout(renderV2Recaptcha, 300);
            }
            // Start Turnstile rendering/polling when modal opens
            if (tsCfg.enabled) {
                // Try immediate render first
                if (!renderTurnstileWidget()) {
                    // If not ready, start polling
                    startTurnstilePolling();
                }
            }
        });

        function close() { 
            overlay.classList.remove('nbb2b-mm-show'); 
            stopTurnstilePolling();
            mmStopPolling();
        }
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        var closeBtn = overlay.querySelector('.nbb2b-mm-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', close);

        // ── Live-refresh when quote changes while overlay is open ──
        // Two mechanisms ensure the overlay product data updates in real time:
        // 1. Custom event ('cxb:quote:updated') from quote.js — instant.
        // 2. Timestamp polling (600 ms) — reliable fallback.
        var _mmPollTimer  = null;
        var _mmLastQuoteTs = null;

        function mmRefreshQuoteSummary() {
            // Skip re-render while the user is typing in a quantity input
            var active = document.activeElement;
            if (active && active.classList.contains('nbb2b-qs-qty-input') && overlay.contains(active)) return;
            syncQuoteSummary('mm', true);
            injectQuoteDataIntoElementorForm(overlay);
        }

        function mmStartPolling() {
            if (_mmPollTimer) return;
            try { _mmLastQuoteTs = localStorage.getItem('cxb_b2b_quote_ts'); } catch (e) {}
            _mmPollTimer = setInterval(function () {
                try {
                    var ts = localStorage.getItem('cxb_b2b_quote_ts');
                    if (ts !== _mmLastQuoteTs) {
                        _mmLastQuoteTs = ts;
                        mmRefreshQuoteSummary();
                    }
                } catch (e) { /* private browsing */ }
            }, 600);
        }

        function mmStopPolling() {
            if (_mmPollTimer) { clearInterval(_mmPollTimer); _mmPollTimer = null; }
        }

        // Primary: instant refresh via custom event
        document.addEventListener('cxb:quote:updated', function () {
            if (overlay.classList.contains('nbb2b-mm-show')) {
                try { _mmLastQuoteTs = localStorage.getItem('cxb_b2b_quote_ts'); } catch (e) {}
                mmRefreshQuoteSummary();
            }
        });

        if (!form || !submit) return;

        function doSubmit(recaptchaToken) {
            var nonce = msgCfg.nonce || '';
            var ajaxUrl = msgCfg.ajax_url || '';
            if (!ajaxUrl) {
                ajaxUrl = (typeof ajaxurl !== 'undefined') ? ajaxurl : window.location.origin + '/wp-admin/admin-ajax.php';
            }

            var fd = new FormData(form);
            fd.append('action', 'cxb_b2b_submit_leave_message');
            fd.append('cxb_b2b_leave_message_nonce', nonce);

            // ── Browser Language Detection (cross-device) ───────────
            fd.append('browser_language', (function() {
                var langs = [];
                try {
                    if (typeof navigator.languages === 'object' && navigator.languages.length) {
                        langs = langs.concat(Array.prototype.slice.call(navigator.languages));
                    }
                    if (navigator.language) langs.push(navigator.language);
                    if (navigator.userLanguage)    langs.push(navigator.userLanguage);
                    if (navigator.browserLanguage) langs.push(navigator.browserLanguage);
                    if (navigator.systemLanguage)  langs.push(navigator.systemLanguage);
                    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                        var resolved = Intl.DateTimeFormat().resolvedOptions();
                        if (resolved && resolved.locale) langs.push(resolved.locale);
                    }
                    if (document.documentElement && document.documentElement.lang) {
                        langs.push(document.documentElement.lang);
                    }
                } catch (e) { /* never break form submission */ }
                var seen = {}, unique = [];
                for (var i = 0; i < langs.length; i++) {
                    var tag = String(langs[i]).replace(/_/g, '-').trim();
                    if (tag && !seen[tag.toLowerCase()]) {
                        seen[tag.toLowerCase()] = true;
                        unique.push(tag);
                    }
                }
                return unique.join(', ') || '';
            })());

            if (recaptchaToken) {
                fd.append('g-recaptcha-response', recaptchaToken);
            }
            // Include Turnstile token if available
            var turnstileToken = document.querySelector('.nbb2b-mm-turnstile-token');
            if (turnstileToken && turnstileToken.value) {
                fd.append('cf-turnstile-response', turnstileToken.value);
            }

            fetch(ajaxUrl, {
                method: 'POST',
                body: fd,
                credentials: 'same-origin'
            })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    mmResult(res.data.message || t('sent_success', 'Sent successfully!'), 'success', res.data.message_key);
                    form.reset();
                    if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                        try { grecaptcha.reset(); } catch (e) {}
                    }
                    // Reset Turnstile widget
                    if (tsCfg.enabled) {
                        resetTurnstileWidget();
                    }

                    // Thank You page redirect — applies the global "Settings → Form Fields → Thank You Redirect" setting.
                    // Honored when scheme is http(s) or a relative path starting with "/". Falls back to the
                    // shared cxb_b2b_leave_message config so the mobile and floating popups behave the same.
                    var _mmCfg = (typeof cxb_b2b_mobile_msg !== 'undefined') ? cxb_b2b_mobile_msg
                               : (typeof cxb_b2b_leave_message !== 'undefined') ? cxb_b2b_leave_message
                               : {};
                    var _tyUrl = _mmCfg && _mmCfg.thankyou_redirect_url ? String(_mmCfg.thankyou_redirect_url).replace(/^\s+|\s+$/g, '') : '';
                    if (_mmCfg && _mmCfg.thankyou_redirect_enabled && _tyUrl && /^(https?:\/\/|\/)/i.test(_tyUrl)) {
                        setTimeout(function () { window.location.href = _tyUrl; }, 1000);
                        return; // Skip auto-close — we're leaving the page.
                    }

                    /* 提示条不在这里清：浮层收起之后它还要在屏幕上多停片刻，
                       那正是确认信息最需要被看到的时候；它自己会超时退场。 */
                    setTimeout(close, 3000);
                } else {
                    mmResult((res.data && res.data.message) || t('send_failed', 'Failed to send. Please try again.'), 'error', res.data && res.data.message_key);
                    if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                        try { grecaptcha.reset(); } catch (e) {}
                    }
                    // Reset Turnstile widget
                    if (tsCfg.enabled) {
                        resetTurnstileWidget();
                    }
                }
            })
            .catch(function () {
                mmResult(t('network_error', 'Network error. Please try again.'), 'error');
                if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                    try { grecaptcha.reset(); } catch (e) {}
                }
                if (tsCfg.enabled) {
                    resetTurnstileWidget();
                }
            })
            .finally(function () {
                submit.disabled = false;
                submit.textContent = MM_SUBMIT_LABEL;
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!result) return;
            /* 清掉上一次的结果（含顶部提示条），再开始这一次提交。 */
            if (window.cxbB2BFormToast) { window.cxbB2BFormToast.hide(); }
            result.className = 'nbb2b-mm-msg-result';
            result.textContent = '';

            // Privacy Policy acceptance (required checkbox)
            var ppNotice = form.querySelector('.cxb-b2b-privacy-notice');
            if (ppNotice) ppNotice.classList.remove('cxb-b2b-privacy-notice--error');
            if (ppNotice) {
                var ppCheckbox = ppNotice.querySelector('input[name="cxb_b2b_privacy_accepted"]');
                if (ppCheckbox && !ppCheckbox.checked) {
                    mmResult(t('agree_privacy', 'Please agree to the Privacy Policy before submitting.'), 'error');
                    ppNotice.classList.add('cxb-b2b-privacy-notice--error');
                    return;
                }
            }

            submit.disabled = true;
            submit.textContent = t('sending', 'Sending…');

            // Turnstile validation - only validate if widget was successfully rendered
            if (tsCfg.enabled && tsCfg.siteKey && mmTurnstileRendered) {
                var turnstileToken = document.querySelector('.nbb2b-mm-turnstile-token');
                if (!turnstileToken || !turnstileToken.value) {
                    mmResult(t('complete_security', 'Please complete the security verification.'), 'error');
                    submit.disabled = false;
                    submit.textContent = MM_SUBMIT_LABEL;
                    return;
                }
            }

            // reCAPTCHA validation
            if (rcCfg.enabled && rcCfg.siteKey) {
                if (rcCfg.type === 'v2') {
                    if (typeof grecaptcha !== 'undefined' && !grecaptcha.getResponse()) {
                        mmResult(t('complete_recaptcha', 'Please complete the reCAPTCHA verification.'), 'error');
                        submit.disabled = false;
                        submit.textContent = MM_SUBMIT_LABEL;
                        return;
                    }
                    doSubmit(typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '');
                } else if (rcCfg.type === 'v3') {
                    if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.execute === 'function') {
                        grecaptcha.ready(function () {
                            grecaptcha.execute(rcCfg.siteKey, { action: 'leave_message' }).then(function (token) {
                                doSubmit(token);
                            }).catch(function () {
                                doSubmit('');
                            });
                        });
                    } else {
                        doSubmit('');
                    }
                } else {
                    doSubmit('');
                }
            } else {
                doSubmit('');
            }
        });
    }

    /* ================================================================
       Back to Top
       ================================================================ */
    function initBackTop() {
        var btn = document.querySelector('.nbb2b-mm-item[data-action="backtop"]');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ── Qty badge formatter ───────────────────────────────────
       When the number exceeds 6 digits, drop the "Qty:" prefix and
       truncate to the first 6 digits + "…" to prevent layout overflow. */
    function formatQtyBadge(val) {
        var s = String(val);
        if (s.length > 6) return s.substring(0, 6) + '\u2026';
        return t('qty_prefix', 'Qty:') + ' ' + s;
    }

    /* ================================================================
       Quote summary live-sync
       Reads the client-side quote cache (written by quote.js) and
       refreshes the product summary so it reflects the latest basket
       state — even if items were added after the page loaded.
       ================================================================ */
    function syncQuoteSummary(prefix, keepTableOpen) {
        var box = document.getElementById('nbb2b-' + prefix + '-quote-summary');
        if (!box) return;

        var state = null;
        try {
            var raw = localStorage.getItem('cxb_b2b_quote_cache');
            if (raw) state = JSON.parse(raw);
        } catch (e) { /* ignore */ }

        var items = (state && state.items) ? state.items : {};
        var keys  = Object.keys(items);
        var count = keys.length;

        if (count < 1) {
            box.style.display = 'none';
            return;
        }

        var singleEl = box.querySelector('.nbb2b-qs-single');
        var multiEl  = box.querySelector('.nbb2b-qs-multi');

        if (count === 1) {
            /* ── Single product: thumbnail + inline qty input ── */
            if (multiEl)  multiEl.style.display = 'none';
            var item = items[keys[0]];
            var url  = (item && item.image_url) ? item.image_url : '';
            var alt  = (item && item.product_name) ? item.product_name : '';
            var qty  = parseInt((item && item.quantity) ? item.quantity : 1, 10) || 1;
            var moq  = parseInt((item && item.moq) ? item.moq : 1, 10) || 1;
            qty = Math.max(qty, moq);
            var pid  = (item && item.product_id) ? item.product_id : '';
            var name = alt || t('product_number', 'Product #%s', pid);

            var esc = function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

            var html = '<div class="nbb2b-qs-single-row">';
            html += '<div class="nbb2b-qs-single-thumb nbb2b-qs-deletable" data-item-key="' + keys[0] + '" data-product-id="' + pid + '">';
            html += '<span class="nbb2b-qs-del" title="' + t('remove', 'Remove') + '">&times;</span>';
            if (url) {
                html += '<img class="nbb2b-qs-thumb" src="' + url + '" alt="' + esc(alt) + '" />';
            } else {
                html += '<span class="nbb2b-qs-thumb nbb2b-qs-thumb-empty"></span>';
            }
            html += '</div>';
            html += '<div class="nbb2b-qs-single-info">';
            html += '<span class="nbb2b-qs-single-name">' + esc(name) + '</span>';
            html += '<label class="nbb2b-qs-single-qty-label">Quantity: ';
            html += '<input type="number" class="nbb2b-qs-qty-input" value="' + qty + '" min="' + moq + '" data-item-key="' + keys[0] + '" data-product-id="' + pid + '" />';
            html += '</label>';
            html += '</div></div>';

            if (singleEl) { singleEl.innerHTML = html; singleEl.style.display = ''; }
        } else {
            /* ── Multiple products: text + Input Quantity btn + thumbs ── */
            if (singleEl) singleEl.style.display = 'none';

            // Update count
            var countEl = box.querySelector('.nbb2b-qs-count');
            if (countEl) countEl.textContent = count;

            // Rebuild thumbnails (max 5)
            var maxThumbs = 5;
            var thumbHtml = '';
            var esc = function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
            for (var i = 0; i < Math.min(count, maxThumbs); i++) {
                var item = items[keys[i]];
                var url  = (item && item.image_url) ? item.image_url : '';
                var alt  = (item && item.product_name) ? item.product_name : '';
                var qty  = parseInt((item && item.quantity) ? item.quantity : 1, 10) || 1;
                var pid  = (item && item.product_id) ? item.product_id : '';
                thumbHtml += '<div class="nbb2b-qs-thumb-wrap nbb2b-qs-deletable" data-item-key="' + keys[i] + '" data-product-id="' + pid + '">';
                thumbHtml += '<span class="nbb2b-qs-del" title="' + t('remove', 'Remove') + '">&times;</span>';
                if (url) {
                    thumbHtml += '<img class="nbb2b-qs-thumb" src="' + url + '" alt="' + esc(alt) + '" />';
                } else {
                    thumbHtml += '<span class="nbb2b-qs-thumb nbb2b-qs-thumb-empty"></span>';
                }
                if (qty > 1) {
                    thumbHtml += '<span class="nbb2b-qs-qty">' + formatQtyBadge(qty) + '</span>';
                }
                thumbHtml += '</div>';
            }
            if (count > maxThumbs) {
                thumbHtml += '<span class="nbb2b-qs-more">&hellip;</span>';
            }
            var thumbsEl = box.querySelector('.nbb2b-qs-thumbs');
            if (thumbsEl) thumbsEl.innerHTML = thumbHtml;

            // Rebuild product table body
            var tbodyHtml = '';
            for (var j = 0; j < count; j++) {
                var itm = items[keys[j]];
                var iUrl  = (itm && itm.image_url) ? itm.image_url : '';
                var iName = (itm && itm.product_name) ? itm.product_name : '';
                var iQty  = parseInt((itm && itm.quantity) ? itm.quantity : 1, 10) || 1;
                var iMoq  = parseInt((itm && itm.moq) ? itm.moq : 1, 10) || 1;
                iQty = Math.max(iQty, iMoq);
                var iPid  = (itm && itm.product_id) ? itm.product_id : '';
                tbodyHtml += '<tr>';
                tbodyHtml += '<td class="nbb2b-qs-table-product">';
                if (iUrl) {
                    tbodyHtml += '<img src="' + iUrl + '" alt="" class="nbb2b-qs-table-img" /> ';
                }
                tbodyHtml += '<span>' + esc(iName || t('product_number', 'Product #%s', iPid)) + '</span></td>';
                tbodyHtml += '<td class="nbb2b-qs-table-qty"><input type="number" class="nbb2b-qs-qty-input" value="' + iQty + '" min="' + iMoq + '" data-item-key="' + keys[j] + '" data-product-id="' + iPid + '" /></td>';
                tbodyHtml += '<td class="nbb2b-qs-table-del"><span class="nbb2b-qs-deletable nbb2b-qs-table-remove" data-item-key="' + keys[j] + '" data-product-id="' + iPid + '">&times;</span></td>';
                tbodyHtml += '</tr>';
            }
            var tbody = box.querySelector('.nbb2b-qs-table tbody');
            if (tbody) tbody.innerHTML = tbodyHtml;

            // Keep product table open if it was already open (e.g. after delete);
            // hide it only on the first render or when it was closed.
            var ptable = box.querySelector('.nbb2b-qs-product-table');
            if (ptable && !keepTableOpen) ptable.style.display = 'none';

            if (multiEl) multiEl.style.display = '';
        }

        box.style.display = '';
    }

    /* ================================================================
       Delete product from quote summary
       Handles clicks on the delete button or anywhere on the
       thumbnail area.  Uses optimistic localStorage removal and
       fires a background AJAX call so the server stays in sync.
       ================================================================ */
    document.addEventListener('click', function (e) {
        var wrap = e.target.closest('.nbb2b-qs-deletable');
        if (!wrap) return;
        e.preventDefault();
        e.stopPropagation();

        var itemKey   = wrap.getAttribute('data-item-key');
        var productId = wrap.getAttribute('data-product-id');
        if (!itemKey) return;

        // Determine which summary box this belongs to
        var boxEl   = wrap.closest('.nbb2b-qs');
        var prefix  = 'mm'; // default for mobile menu
        if (boxEl && boxEl.id) {
            var m = boxEl.id.match(/^nbb2b-(\w+)-quote-summary$/);
            if (m) prefix = m[1];
        }

        // Optimistic: remove from localStorage
        removeItemFromCache(itemKey);

        // Check if the product table was open before re-rendering
        var multiEl = wrap.closest('.nbb2b-qs-multi');
        var ptable  = multiEl ? multiEl.querySelector('.nbb2b-qs-product-table') : null;
        var wasTableOpen = ptable && ptable.style.display !== 'none';

        // Re-render summary (keep table open if it was visible)
        syncQuoteSummary(prefix, wasTableOpen);

        // Also re-inject quote_data into any Elementor form in the overlay
        var overlay = document.getElementById('nbb2b-mm-message-overlay');
        if (overlay) injectQuoteDataIntoElementorForm(overlay);

        // Background AJAX to remove on the server
        fireRemoveAjax(itemKey, productId);
    });

    function removeItemFromCache(key) {
        var state = null;
        try {
            var raw = localStorage.getItem('cxb_b2b_quote_cache');
            if (raw) state = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        if (!state || !state.items || !state.items[key]) return;

        delete state.items[key];

        // Recalculate count and productIds
        var totalQty = 0;
        var pids = [];
        var remaining = state.items;
        for (var k in remaining) {
            if (!remaining.hasOwnProperty(k)) continue;
            totalQty += parseInt(remaining[k].quantity, 10) || 1;
            var p = String(remaining[k].product_id || '');
            if (p && pids.indexOf(p) === -1) pids.push(p);
        }
        state.count = totalQty;
        state.productIds = pids;

        try {
            localStorage.setItem('cxb_b2b_quote_cache', JSON.stringify(state));
            localStorage.setItem('cxb_b2b_quote_ts', String(Date.now()));
        } catch (e) { /* ignore */ }
    }

    function fireRemoveAjax(key, productId) {
        var cfg = (typeof cxb_b2b_product_showcase !== 'undefined') ? cxb_b2b_product_showcase : null;
        if (!cfg || !cfg.ajax_url) return;

        var fd = new FormData();
        fd.append('action', 'cxb_b2b_quote_action');
        fd.append('cxb_b2b_quote_action', 'remove_item');
        fd.append('product_id', productId || '');
        fd.append('key', key);
        fd.append('nonce', cfg.nonce || '');

        fetch(cfg.ajax_url, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin'
        }).catch(function () { /* silent */ });
    }

    /* ================================================================
       "Input Quantity" button → toggle product table
       ================================================================ */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.nbb2b-qs-input-qty-btn');
        if (!btn) return;
        e.stopPropagation();
        var multi = btn.closest('.nbb2b-qs-multi');
        if (!multi) return;
        var ptable = multi.querySelector('.nbb2b-qs-product-table');
        if (!ptable) return;
        ptable.style.display = (ptable.style.display === 'none') ? '' : 'none';
    });

    /* ================================================================
       "Done" button → close product table
       ================================================================ */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.nbb2b-qs-done-btn');
        if (!btn) return;
        e.stopPropagation();
        var ptable = btn.closest('.nbb2b-qs-product-table');
        if (ptable) ptable.style.display = 'none';
    });

    /* ================================================================
       Quantity input UX — select-all on focus, restore on blur
       Matches the Quote Request page behaviour: clicking the field
       selects the current value so the user can type immediately
       without manually deleting the default "1".
       ================================================================ */
    document.addEventListener('focus', function (e) {
        if (!e.target.classList.contains('nbb2b-qs-qty-input')) return;
        e.target.select();
    }, true);
    document.addEventListener('blur', function (e) {
        if (!e.target.classList.contains('nbb2b-qs-qty-input')) return;
        var v = e.target.value;
        if (v === '' || isNaN(v) || parseInt(v, 10) < 1) e.target.value = 1;
    }, true);

    /* ================================================================
       Quantity input change → sync to localStorage + AJAX + live UI
       ================================================================ */
    function handleQtyChange(e) {
        if (!e.target.classList.contains('nbb2b-qs-qty-input')) return;
        var val = parseInt(e.target.value, 10);
        if (!val || val < 1) { val = 1; e.target.value = 1; }
        var itemKey   = e.target.getAttribute('data-item-key');
        var productId = e.target.getAttribute('data-product-id');
        if (!itemKey) return;

        var totalQty = 0;
        try {
            var raw = localStorage.getItem('cxb_b2b_quote_cache');
            if (!raw) return;
            var st = JSON.parse(raw);
            if (st && st.items && st.items[itemKey]) {
                st.items[itemKey].quantity = String(val);
                for (var k in st.items) { if (st.items.hasOwnProperty(k)) totalQty += parseInt(st.items[k].quantity, 10) || 1; }
                st.count = totalQty;
                localStorage.setItem('cxb_b2b_quote_cache', JSON.stringify(st));
                localStorage.setItem('cxb_b2b_quote_ts', String(Date.now()));
            }
        } catch (ex) { /* ignore */ }

        // ── Live-update displayed counts (no full re-render) ─────
        // 1. Update the thumbnail qty badge for this item
        var thumbWraps = document.querySelectorAll('.nbb2b-qs-thumb-wrap[data-item-key="' + itemKey + '"]');
        for (var t = 0; t < thumbWraps.length; t++) {
            var badge = thumbWraps[t].querySelector('.nbb2b-qs-qty');
            if (val > 1) {
                if (badge) {
                    badge.textContent = formatQtyBadge(val);
                } else {
                    var span = document.createElement('span');
                    span.className = 'nbb2b-qs-qty';
                    span.textContent = formatQtyBadge(val);
                    thumbWraps[t].appendChild(span);
                }
            } else if (badge) {
                badge.parentNode.removeChild(badge);
            }
        }

        // 2. Update global quote basket count badges
        if (totalQty > 0) {
            var countText = String(totalQty);
            var selectors = ['.cxb-b2b-quote-basket-count', '.cxb-b2b-quote-basket-toggle-count', '.cxb-b2b-quote-basket-total-count'];
            for (var s = 0; s < selectors.length; s++) {
                var els = document.querySelectorAll(selectors[s]);
                for (var ei = 0; ei < els.length; ei++) els[ei].textContent = countText;
            }
        }

        // AJAX sync (only on 'change' to avoid flooding)
        if (e.type === 'change') {
            var cfg = (typeof cxb_b2b_product_showcase !== 'undefined') ? cxb_b2b_product_showcase : null;
            if (cfg && cfg.ajax_url) {
                var fd = new FormData();
                fd.append('action', 'cxb_b2b_quote_action');
                fd.append('cxb_b2b_quote_action', 'update_quantity');
                fd.append('product_id', productId || '');
                fd.append('key', itemKey);
                fd.append('quantity', val);
                fd.append('nonce', cfg.nonce || '');
                fetch(cfg.ajax_url, { method: 'POST', body: fd, credentials: 'same-origin' }).catch(function () {});
            }
        }

        // Re-inject quote_data into Elementor form
        var overlay = document.getElementById('nbb2b-mm-message-overlay');
        if (overlay) injectQuoteDataIntoElementorForm(overlay);
    }
    document.addEventListener('change', handleQtyChange);
    document.addEventListener('input', handleQtyChange);

    /* ================================================================
       Elementor form: inject quote_data
       When the popup contains an Elementor form, inject the current
       quote basket into a hidden "quote_data" field so the Elementor
       email filters can render the product table.

       Elementor Pro renders hidden fields as:
         <input name="form_fields[quote_data]" id="form-field-quote_data">
       so we use name*="quote_data" (contains selector) to match both
       Elementor's pattern and any raw name="quote_data" field.
       ================================================================ */
    function injectQuoteDataIntoElementorForm(container) {
        var forms = container.querySelectorAll('.elementor-form');
        if (!forms.length) return;

        var state = null;
        try {
            var raw = localStorage.getItem('cxb_b2b_quote_cache');
            if (raw) state = JSON.parse(raw);
        } catch (e) { /* ignore */ }

        var items = (state && state.items) ? state.items : {};
        if (Object.keys(items).length === 0) return;

        var json = JSON.stringify(items);
        for (var i = 0; i < forms.length; i++) {
            var form = forms[i];
            // Broad selector — matches both Elementor's form_fields[quote_data]
            // and plain name="quote_data" (same pattern as quote.js)
            var field = form.querySelector('input[name="quote_data"], textarea[name="quote_data"], input[name*="quote_data"], textarea[name*="quote_data"]');
            if (!field) {
                // Use Elementor's naming convention so its AJAX handler includes the field
                field = document.createElement('input');
                field.type = 'hidden';
                field.name = 'form_fields[quote_data]';
                field.id = 'form-field-quote_data';
                form.appendChild(field);
            }
            field.value = json;
        }
    }

    /* ================================================================
       Helper: simple event delegation
       ================================================================ */
    function delegate(root, selector, handler) {
        root.addEventListener('click', function (e) {
            var el = e.target.closest(selector);
            if (el && root.contains(el)) handler(el);
        });
    }

})();
