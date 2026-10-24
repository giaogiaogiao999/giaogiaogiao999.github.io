/**
 * Leave a Message — floating widget logic
 *
 * @since 2.5.0
 */
(function ($) {
    'use strict';

    // ── i18n helper: read translated strings from window.cxbB2BI18n
    // (populated by PHP via __()), with English fallbacks. Supports
    // %s / %1$s / %2$s placeholders. ──
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

    $(function () {
        var $widget  = $('#nbb2b-leave-message-widget');
        var $bar     = $('#nbb2b-lm-bar');
        var $panel   = $('#nbb2b-lm-panel');
        var $close   = $('#nbb2b-lm-close');
        var $form    = $('#nbb2b-lm-form');
        var $submit  = $('#nbb2b-lm-submit');
        var $message = $('#nbb2b-lm-message');

        /* 提交按钮的原始文案，在这里读一次存起来。

           v2.1.87 起，后台「表单字段 → 自定义提交按钮文本」可以把这个按钮
           改成任意文案。原来每次提交结束都用 t('submit','Submit') 把按钮
           写回去，那是把 PHP 渲染出来的自定义文案直接抹掉——访客提交一次
           （哪怕只是校验没过），按钮就永远变回 "Submit" 了。
           改成回填这里存下的原始文案，无论后台设成什么都不会丢。 */
        var LM_SUBMIT_LABEL = $.trim($submit.text()) || t('submit', 'Submit');

        /* 提交结果统一走顶部固定提示条。

           原来写进提交按钮下方的 #nbb2b-lm-message——而面板最高 90vh 且内部可滚动，
           窗口一矮它就在折叠线以下：访客点了提交，看不到任何变化，于是再点一次。
           成功后面板还会在 4 秒后自动收起，那条提示跟着一起消失，确认信息等于没出现过。

           固定提示条挂在 <body> 上，不受面板高度、滚动位置、关闭与否影响。
           内联那个 <div> 保留作为兑底：只有当 form-toast.js 没加载成功时才用到它。 */
        function lmResult(message, type, key) {
            if (window.cxbB2BFormToast) {
                /* key 是服务端给的 message_key，提示条据此到页面上的可翻译
                   副本里取译文；见 form-toast.js 里的 resolve()。 */
                window.cxbB2BFormToast.show(message, type, key);
                $message.hide().removeClass('nbb2b-lm-message--success nbb2b-lm-message--error').html('');
                return;
            }
            $message.html(message)
                .addClass('nbb2b-lm-message--' + (type === 'error' ? 'error' : 'success'))
                .show();
        }

        function lmClearResult() {
            if (window.cxbB2BFormToast) { window.cxbB2BFormToast.hide(); }
            $message.hide().removeClass('nbb2b-lm-message--success nbb2b-lm-message--error').html('');
        }
        var $overlay = $('#nbb2b-lm-overlay');

        if (!$widget.length) {
            return;
        }

        // Center-screen popup variant? Driven by the backend
        // "Popup Position" setting (cxb_b2b_lm_popup_position). Falls back to
        // reading the rendered class so behaviour stays correct even if the
        // localized config is unavailable.
        var cfg = (typeof cxb_b2b_leave_message !== 'undefined') ? cxb_b2b_leave_message : {};
        var isCenter = (cfg && cfg.popup_position === 'center') ||
                       $widget.hasClass('nbb2b-lm-widget--center');

        /* ── Center mode: lift the modal out of the widget ────────
           The backdrop is printed as a SIBLING of the widget while the panel
           sits INSIDE it. Anything that hides the widget therefore hides the
           panel and leaves the backdrop behind: a dimmed, blurred page with no
           popup on it. That is not a hypothetical — the widget is hidden in
           normal operation by

             • mobile-menu.css, which hides .nbb2b-lm-widget under
               body.nbb2b-has-mobile-menu at ≤768px because the bottom menu
               carries its own Message item;
             • the Elementor editor preview, which hides the widget by id;
             • any theme rule aimed at floating widgets.

           The second half of the problem is position:fixed. It means "relative
           to the viewport" only while no ancestor has a transform, filter,
           perspective, contain or will-change; themes and chat scripts set
           those on wrappers routinely, and the panel then centres itself on
           that ancestor instead — usually far below the fold. frontend.css
           carries a block of counter-measures for exactly this, but that sheet
           only loads on plugin pages, while this widget renders on every page.

           Both halves are about where the modal lives, so it is moved: a
           dedicated root appended as the last child of <body>, holding the
           backdrop and the panel together, backdrop first. Nothing between
           them and <body> can hide one without the other, and the
           containing-block risk shrinks to html/body, which the stylesheet
           neutralises for as long as the modal is open.

           The root carries nbb2b-lm-widget--center so this file's centered
           layout rules keep matching, and deliberately NOT nbb2b-lm-widget,
           so the rules listed above cannot reach it.

           Done once, here at ready — before any captcha widget is rendered
           into the panel (that happens 300ms after the launcher is clicked).
           Moving an <iframe> across the DOM reloads it, which would throw away
           a solved challenge. */
        if (isCenter && $overlay.length && $panel.length) {
            $('<div class="nbb2b-lm-modal-root nbb2b-lm-widget--center"></div>')
                .appendTo(document.body)
                .append($overlay)
                .append($panel);
        }

        /* Switches on the stylesheet's containing-block guard for html/body,
           and only while the modal is open — a theme that animates the page
           with a transform keeps working the rest of the time. */
        var MODAL_OPEN = 'nbb2b-lm-modal-open';

        /* Set by the verification pass below when it has had to override
           someone else's !important rule. */
        var FORCED = 'nbb2b-lm-panel--force';

        function clearForcedLayout() {
            var el = $panel[0];
            if (!el) { return; }
            $panel.removeClass(FORCED);
            el.style.removeProperty('top');
            el.style.removeProperty('left');
            el.style.removeProperty('transform');
        }

        /* Verification pass, run once the panel has finished fading in.

           Everything above assumes the panel ends up on screen. The move to
           <body> plus the stylesheet guard covers the failures we know about,
           but a modal that silently does not appear is a bad enough failure to
           be worth checking rather than assuming, and the check is cheap: one
           rect measurement on open.

           Nothing here guesses at causes. It looks at where the panel actually
           landed and corrects the difference, which works whatever turned out
           to be wrong. */
        function ensureVisible() {
            if (!isCenter) { return; }
            var el = $panel[0];
            if (!el || !el.getBoundingClientRect) { return; }

            /* Hidden outright: another stylesheet is winning with !important.
               Only !important of our own outranks it. */
            var cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' ||
                parseFloat(cs.opacity) === 0) {
                $panel.addClass(FORCED);
            }

            var vw = window.innerWidth  || document.documentElement.clientWidth;
            var vh = window.innerHeight || document.documentElement.clientHeight;
            var r  = el.getBoundingClientRect();

            if (r.width > 0 && r.height > 0 &&
                r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw) {
                return; /* on screen — the normal path ends here */
            }

            /* Off screen: top/left 50% resolved against something other than
               the viewport. Drop the centering transform, measure, and shift
               the panel by the difference between where it is and where the
               middle of the window is. */
            el.style.setProperty('transform', 'none', 'important');

            var probe   = el.getBoundingClientRect();
            var st      = window.getComputedStyle(el);
            var curTop  = parseFloat(st.top)  || 0;
            var curLeft = parseFloat(st.left) || 0;
            var wantTop  = Math.max(10, (vh - probe.height) / 2);
            var wantLeft = Math.max(10, (vw - probe.width)  / 2);

            el.style.setProperty('top',  Math.round(curTop  + wantTop  - probe.top)  + 'px', 'important');
            el.style.setProperty('left', Math.round(curLeft + wantLeft - probe.left) + 'px', 'important');

            /* Still nowhere to be found. Whatever is holding it down is out of
               reach from here — close up rather than leave the visitor staring
               at a blurred page with nothing on it and no obvious way back. */
            var after = el.getBoundingClientRect();
            if (after.width === 0 || after.height === 0 ||
                after.bottom <= 0 || after.top >= vh) {
                closePanel();
                if (window.console && window.console.warn) {
                    window.console.warn('[cxb-b2b] Leave a Message: the centered popup could not be placed on screen; backdrop removed.');
                }
            }
        }

        // Handle for the post-submit auto-collapse timer (armed in the success
        // branch below). It MUST be cleared whenever the panel is opened or
        // closed by any other means.
        //
        // Bug it fixes: after a successful submit the success branch armed a
        // bare setTimeout(..., 4000) that nobody owned. If the visitor closed
        // the panel and re-opened it inside those 4 seconds — easy to do via
        // the launcher bar or any .cxb-message-trigger button on the page —
        // the stale timer still fired and closed the panel the visitor had
        // just opened. From the outside that looks exactly like "the popup
        // sometimes doesn't open", and only after someone has submitted once,
        // which is why it was intermittent.
        var autoCloseTimer = null;

        function clearAutoClose() {
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
                autoCloseTimer = null;
            }
        }

        // ── Open / close helpers ─────────────────────────────────
        // Center mode fades the panel + backdrop in/out (a modal); the
        // default bottom-right mode keeps the original slide animation.
        function openPanel() {
            clearAutoClose();
            if (isCenter) {
                /* Start from a clean slate: a previous open may have left
                   corrective inline offsets behind. */
                clearForcedLayout();
                document.documentElement.classList.add(MODAL_OPEN);
                document.body.classList.add(MODAL_OPEN);

                $overlay.stop(true, true).fadeIn(180);
                $panel.stop(true, true).css('display', 'none').fadeIn(200, function () {
                    ensureVisible();

                    /* A textarea reports scrollHeight 0 while it is hidden, so
                       autogrow.js cannot size the message field until the panel
                       is on screen. Matters when the field is not empty — a
                       reopen after a failed submit, say. */
                    if (window.cxbB2BAutoGrow) {
                        window.cxbB2BAutoGrow.fitAll($panel[0]);
                    }

                    // The thumbs row could not be measured while the panel was
                    // hidden (width 0). Now that it's visible, fit the quote
                    // thumbnails to the available width.
                    var $thumbs = $('#nbb2b-lm-quote-summary .nbb2b-qs-multi .nbb2b-qs-thumbs');
                    var total = $thumbs.children('.nbb2b-qs-thumb-wrap').length;
                    if (total > 0) {
                        fitThumbsToRow($thumbs, total);
                    }

                    /* Density pass, last: it measures the finished body, so it
                       has to run after the thumbnails have taken their row and
                       the message field has been sized. Hidden panels measure
                       to nothing, which is why this cannot happen at load. */
                    if (window.cxbB2BPopupFit) {
                        window.cxbB2BPopupFit.refreshNow();
                    }
                });
            } else {
                $panel.stop(true, true).slideDown(250, function () {
                    if (window.cxbB2BPopupFit) {
                        window.cxbB2BPopupFit.refreshNow();
                    }
                });
            }
            /* Add the class AFTER the stop() calls, never before.
               stop(true, true) jumps a running close animation to its end,
               which fires that animation's callback — and that callback does
               removeClass('nbb2b-lm-bar--open'). Adding the class first meant
               a re-open during the closing animation had its class stripped
               again a moment later, leaving the launcher bar floating on top
               of the open modal. Reproduced at every interrupt point from
               10ms to 170ms into the 180ms fade-out. */
            $bar.addClass('nbb2b-lm-bar--open');
        }

        function closePanel(done) {
            clearAutoClose();
            if (isCenter) {
                /* Released before the fade, not after: the forcing class sets
                   opacity/display with !important, which would otherwise sit on
                   top of the fade-out and make it a jump cut. */
                clearForcedLayout();

                $overlay.stop(true, true).fadeOut(160);
                $panel.stop(true, true).fadeOut(180, function () {
                    document.documentElement.classList.remove(MODAL_OPEN);
                    document.body.classList.remove(MODAL_OPEN);
                    $bar.removeClass('nbb2b-lm-bar--open');
                    if (typeof done === 'function') { done(); }
                });
            } else {
                $panel.stop(true, true).slideUp(200, function () {
                    $bar.removeClass('nbb2b-lm-bar--open');
                    if (typeof done === 'function') { done(); }
                });
            }
        }

        /* The correction in ensureVisible() is measured against the viewport,
           so it has to be measured again when the viewport changes. Cleared
           first, so a window that has gone back to normal drops the override
           instead of keeping a stale offset. */
        if (isCenter) {
            var reflowTimer = null;
            $(window).on('resize.cxbLmModal', function () {
                if (!$panel.is(':visible')) { return; }
                clearTimeout(reflowTimer);
                reflowTimer = setTimeout(function () {
                    clearForcedLayout();
                    ensureVisible();
                }, 150);
            });
        }

        // ── Toggle open / close ──────────────────────────────────
        $bar.on('click', function () {
            syncQuoteSummary('lm');
            injectQuoteDataIntoElementorForm($panel);
            openPanel();
        });

        $close.on('click', function () {
            closePanel();
        });

        // Center mode: clicking the dim backdrop closes the popup.
        if (isCenter && $overlay.length) {
            $overlay.on('click', function () {
                closePanel();
            });
        }

        // Center mode: Esc closes it too. A centred overlay is a modal dialog,
        // and Esc is the expected way out; it is also the fallback if a theme
        // ever paints something over the backdrop so the click target is lost.
        if (isCenter) {
            $(document).on('keydown.cxbLmEsc', function (e) {
                if (e.key !== 'Escape' && e.keyCode !== 27) { return; }
                if (!$panel.is(':visible')) { return; }
                closePanel();
            });
        }

        // Center mode: re-fit the quote thumbnails to the row whenever the
        // viewport width changes (debounced), but only while the centered
        // panel is actually visible. The number of visible products adapts
        // to the new width; overflow is hidden behind the "+N" badge.
        if (isCenter) {
            var resizeTimer = null;
            $(window).on('resize.cxbLmThumbs', function () {
                if (resizeTimer) { clearTimeout(resizeTimer); }
                resizeTimer = setTimeout(function () {
                    if (!$panel.is(':visible')) return;
                    var $thumbs = $('#nbb2b-lm-quote-summary .nbb2b-qs-multi .nbb2b-qs-thumbs');
                    if (!$thumbs.length) return;
                    var total = $thumbs.children('.nbb2b-qs-thumb-wrap').length;
                    if (total > 0) {
                        fitThumbsToRow($thumbs, total);
                    }
                }, 150);
            });
        }

        // ── Qty badge formatter ────────────────────────────────────
        // When the number exceeds 6 digits, drop the "Qty:" prefix and
        // truncate to the first 6 digits + "…" to prevent layout overflow.
        function formatQtyBadge(val) {
            var s = String(val);
            if (s.length > 6) return s.substring(0, 6) + '\u2026';
            return t('qty_prefix', 'Qty:') + ' ' + s;
        }

        // ── Fit quote thumbnails to a single row (center popup only) ──
        // Given the thumbs container (with ALL product thumbnails already
        // rendered), hide the ones that overflow the container's width so a
        // single row remains, and append a "+N" badge showing how many were
        // hidden. Re-runnable: it first clears any previous hidden state and
        // badge, then re-measures against the current width.
        //
        // Measurement is wrapped in requestAnimationFrame so it runs after
        // layout; images may still be loading, but thumbnails have a fixed
        // CSS size (50px) so widths are stable regardless of image load.
        function fitThumbsToRow($thumbs, total) {
            if (!$thumbs || !$thumbs.length) return;

            var run = function () {
                // Reset: reveal every thumb and drop any stale "+N" badge.
                var $wraps = $thumbs.children('.nbb2b-qs-thumb-wrap');
                $wraps.removeClass('nbb2b-qs-thumb-wrap--hidden').css('display', '');
                $thumbs.children('.nbb2b-qs-more-count').remove();

                var containerWidth = $thumbs.width();
                if (!containerWidth || containerWidth <= 0) return;

                // Gap between flex items (keep in sync with the CSS gap).
                var gap = 6;

                // Width reserved on the right for the "+N" badge, only needed
                // if something ends up hidden. We measure a first pass to know
                // whether all fit; if they do, no badge and we're done.
                var thumbW = $wraps.length ? $wraps.first().outerWidth() : 50;
                if (!thumbW || thumbW <= 0) thumbW = 50;

                // How many thumbs fit on one row with NO badge?
                //   n thumbs occupy: n*thumbW + (n-1)*gap  <=  containerWidth
                var fitAll = Math.floor((containerWidth + gap) / (thumbW + gap));
                if (fitAll < 0) fitAll = 0;

                if (fitAll >= $wraps.length) {
                    // Everything fits — nothing to hide, no badge.
                    return;
                }

                // Some will be hidden, so reserve room for the "+N" badge and
                // recompute how many thumbs fit alongside it.
                var badgeW = 44; // approx width of the "+N" badge incl. gap
                var avail = containerWidth - badgeW;
                var visible = Math.floor((avail + gap) / (thumbW + gap));
                if (visible < 1) visible = 1; // always show at least one

                // Hide the overflow thumbnails.
                $wraps.each(function (idx) {
                    if (idx >= visible) {
                        $(this).addClass('nbb2b-qs-thumb-wrap--hidden').css('display', 'none');
                    }
                });

                var hiddenCount = $wraps.length - visible;
                if (hiddenCount > 0) {
                    $thumbs.append('<span class="nbb2b-qs-more-count">+' + hiddenCount + '</span>');
                }
            };

            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(run);
            } else {
                run();
            }
        }

        // ── Quote summary live-sync ────────────────────────────────
        // Reads the client-side quote cache (written by quote.js) and
        // refreshes the product summary above the form so it always
        // reflects the latest basket state — even if items were added
        // after the page loaded.
        function syncQuoteSummary(prefix, keepTableOpen) {
            var $box = $('#nbb2b-' + prefix + '-quote-summary');
            if (!$box.length) return;

            var state = null;
            try {
                var raw = localStorage.getItem('cxb_b2b_quote_cache');
                if (raw) state = JSON.parse(raw);
            } catch (e) { /* ignore */ }

            var items = (state && state.items) ? state.items : {};
            var keys  = Object.keys(items);
            var count = keys.length;

            if (count < 1) {
                $box.hide();
                return;
            }

            var $single = $box.find('.nbb2b-qs-single');
            var $multi  = $box.find('.nbb2b-qs-multi');

            if (count === 1) {
                /* ── Single product: thumbnail + inline qty input ── */
                $multi.hide();
                var item = items[keys[0]];
                var url  = (item && item.image_url) ? item.image_url : '';
                var alt  = (item && item.product_name) ? item.product_name : '';
                var qty  = parseInt((item && item.quantity) ? item.quantity : 1, 10) || 1;
                var moq  = parseInt((item && item.moq) ? item.moq : 1, 10) || 1;
                qty = Math.max(qty, moq);
                var pid  = (item && item.product_id) ? item.product_id : '';
                var name = alt || t('product_number', 'Product #%s', pid);

                var html = '<div class="nbb2b-qs-single-row">';
                html += '<div class="nbb2b-qs-single-thumb nbb2b-qs-deletable" data-item-key="' + keys[0] + '" data-product-id="' + pid + '">';
                html += '<span class="nbb2b-qs-del" title="' + t('remove', 'Remove') + '">&times;</span>';
                if (url) {
                    html += '<img class="nbb2b-qs-thumb" src="' + url + '" alt="' + alt.replace(/"/g, '&quot;') + '" />';
                } else {
                    html += '<span class="nbb2b-qs-thumb nbb2b-qs-thumb-empty"></span>';
                }
                html += '</div>';
                html += '<div class="nbb2b-qs-single-info">';
                html += '<span class="nbb2b-qs-single-name">' + $('<span>').text(name).html() + '</span>';
                html += '<label class="nbb2b-qs-single-qty-label">' + t('quantity_label', 'Quantity:') + ' ';
                html += '<input type="number" class="nbb2b-qs-qty-input" value="' + qty + '" min="' + moq + '" data-item-key="' + keys[0] + '" data-product-id="' + pid + '" />';
                html += '</label>';
                html += '</div></div>';

                $single.html(html).show();
            } else {
                /* ── Multiple products: text + Input Quantity btn + thumbs ── */
                $single.hide();

                // Update count text
                $multi.find('.nbb2b-qs-count').text(count);

                // Rebuild thumbnails.
                //   • Bottom-right popup (default): cap at 5, append an
                //     ellipsis when there are more — original behaviour.
                //   • Center-screen popup: render ALL thumbnails (no cap).
                //     fitThumbsToRow() then hides whatever overflows the
                //     single row at the current width and shows a "+N" badge.
                var maxThumbs = isCenter ? count : 5;
                var thumbHtml = '';
                for (var i = 0; i < Math.min(count, maxThumbs); i++) {
                    var item = items[keys[i]];
                    var url  = (item && item.image_url) ? item.image_url : '';
                    var alt  = (item && item.product_name) ? item.product_name : '';
                    var qty  = parseInt((item && item.quantity) ? item.quantity : 1, 10) || 1;
                    var pid  = (item && item.product_id) ? item.product_id : '';
                    thumbHtml += '<div class="nbb2b-qs-thumb-wrap nbb2b-qs-deletable" data-item-key="' + keys[i] + '" data-product-id="' + pid + '">';
                    thumbHtml += '<span class="nbb2b-qs-del" title="' + t('remove', 'Remove') + '">&times;</span>';
                    if (url) {
                        thumbHtml += '<img class="nbb2b-qs-thumb" src="' + url + '" alt="' + alt.replace(/"/g, '&quot;') + '" />';
                    } else {
                        thumbHtml += '<span class="nbb2b-qs-thumb nbb2b-qs-thumb-empty"></span>';
                    }
                    if (qty > 1) {
                        thumbHtml += '<span class="nbb2b-qs-qty">' + formatQtyBadge(qty) + '</span>';
                    }
                    thumbHtml += '</div>';
                }
                // Bottom-right popup: static overflow ellipsis. (Center mode
                // appends a dynamic "+N" badge from fitThumbsToRow() instead.)
                if (!isCenter && count > maxThumbs) {
                    thumbHtml += '<span class="nbb2b-qs-more">&hellip;</span>';
                }
                $multi.find('.nbb2b-qs-thumbs').html(thumbHtml);

                // Center mode: after the row is in the DOM, hide thumbnails
                // that overflow the available width so only a single row of
                // products shows. Deferred to the next frame so the browser
                // has laid the thumbs out and we can measure real positions.
                if (isCenter) {
                    fitThumbsToRow($multi.find('.nbb2b-qs-thumbs'), count);
                }

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
                    tbodyHtml += '<span>' + $('<span>').text(iName || t('product_number', 'Product #%s', iPid)).html() + '</span></td>';
                    tbodyHtml += '<td class="nbb2b-qs-table-qty"><input type="number" class="nbb2b-qs-qty-input" value="' + iQty + '" min="' + iMoq + '" data-item-key="' + keys[j] + '" data-product-id="' + iPid + '" /></td>';
                    tbodyHtml += '<td class="nbb2b-qs-table-del"><span class="nbb2b-qs-deletable nbb2b-qs-table-remove" data-item-key="' + keys[j] + '" data-product-id="' + iPid + '">&times;</span></td>';
                    tbodyHtml += '</tr>';
                }
                $multi.find('.nbb2b-qs-table tbody').html(tbodyHtml);

                // Hide product table by default when re-syncing (unless caller asked to keep it open)
                if (!keepTableOpen) {
                    $multi.find('.nbb2b-qs-product-table').hide();
                }
                $multi.show();
            }

            $box.show();
        }

        // ── Delete product from quote summary ────────────────────────
        // Handles clicks on the delete button or anywhere on the
        // thumbnail area.  Uses optimistic localStorage removal and
        // fires a background AJAX call so the server stays in sync.
        // Scoped to $panel so it does not interfere with mobile-menu.js.
        $panel.on('click', '.nbb2b-qs-deletable', function (e) {
            e.preventDefault();
            e.stopPropagation();

            var $wrap     = $(this);
            var itemKey   = $wrap.attr('data-item-key');
            var productId = $wrap.attr('data-product-id');
            if (!itemKey) return;

            // Determine which summary box this belongs to
            var $box    = $wrap.closest('.nbb2b-qs');
            var prefix  = 'lm'; // default
            if ($box.length && $box.attr('id')) {
                var m = $box.attr('id').match(/^nbb2b-(\w+)-quote-summary$/);
                if (m) prefix = m[1];
            }

            // Optimistic: remove from localStorage
            removeItemFromCache(itemKey, productId);

            // Check if the product table was open before re-rendering
            var wasTableOpen = $wrap.closest('.nbb2b-qs-multi').find('.nbb2b-qs-product-table').is(':visible');

            // Re-render summary (keep table open if it was visible)
            syncQuoteSummary(prefix, wasTableOpen);
            // Also re-inject quote_data into any Elementor form
            injectQuoteDataIntoElementorForm($panel);

            // Background AJAX to remove on the server
            fireRemoveAjax(itemKey, productId);
        });

        function removeItemFromCache(key, productId) {
            var state = null;
            try {
                var raw = localStorage.getItem('cxb_b2b_quote_cache');
                if (raw) state = JSON.parse(raw);
            } catch (e) { /* ignore */ }
            if (!state || !state.items || !state.items[key]) return;

            var removedPid = String(state.items[key].product_id || '');
            delete state.items[key];

            // Recalculate count
            var totalQty = 0;
            var pids = [];
            $.each(state.items, function (k, item) {
                totalQty += parseInt(item.quantity, 10) || 1;
                var p = String(item.product_id || '');
                if (p && $.inArray(p, pids) === -1) pids.push(p);
            });
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

            $.ajax({
                url: cfg.ajax_url,
                type: 'POST',
                data: {
                    action: 'cxb_b2b_quote_action',
                    cxb_b2b_quote_action: 'remove_item',
                    product_id: productId,
                    key: key,
                    nonce: cfg.nonce || ''
                }
            });
        }

        // ── "Input Quantity" button → toggle product table ────────
        // Scoped to $panel so the mobile-menu handler doesn't double-fire
        $panel.on('click', '.nbb2b-qs-input-qty-btn', function () {
            $(this).closest('.nbb2b-qs-multi').find('.nbb2b-qs-product-table').slideToggle(200);
        });

        // ── "Done" button → close product table ──────────────────
        $panel.on('click', '.nbb2b-qs-done-btn', function () {
            $(this).closest('.nbb2b-qs-product-table').slideUp(200);
        });

        // ── Quantity input UX — select-all on focus, restore on blur ──
        // Matches the Quote Request page behaviour: clicking the field
        // selects the current value so the user can type immediately
        // without manually deleting the default "1".
        $panel.on('focus', '.nbb2b-qs-qty-input', function () {
            $(this).select();
        }).on('blur', '.nbb2b-qs-qty-input', function () {
            var v = $(this).val();
            if (v === '' || isNaN(v) || parseInt(v, 10) < 1) $(this).val(1);
        });

        // ── Quantity input change → sync to localStorage ─────────
        // Scoped to $panel so it does not interfere with mobile-menu.js.
        $panel.on('change input', '.nbb2b-qs-qty-input', function () {
            var val = parseInt($(this).val(), 10);
            if (!val || val < 1) { val = 1; $(this).val(1); }
            var itemKey   = $(this).attr('data-item-key');
            var productId = $(this).attr('data-product-id');
            if (!itemKey) return;

            var totalQty = 0;
            try {
                var raw = localStorage.getItem('cxb_b2b_quote_cache');
                if (!raw) return;
                var st = JSON.parse(raw);
                if (st && st.items && st.items[itemKey]) {
                    st.items[itemKey].quantity = String(val);
                    // Recalculate total count
                    $.each(st.items, function (k, it) { totalQty += parseInt(it.quantity, 10) || 1; });
                    st.count = totalQty;
                    localStorage.setItem('cxb_b2b_quote_cache', JSON.stringify(st));
                    localStorage.setItem('cxb_b2b_quote_ts', String(Date.now()));
                }
            } catch (e) { /* ignore */ }

            // ── Live-update displayed counts (no full re-render) ─────
            // 1. Update the thumbnail qty badge for this item
            $('.nbb2b-qs-thumb-wrap[data-item-key="' + itemKey + '"]').each(function () {
                var $badge = $(this).find('.nbb2b-qs-qty');
                if (val > 1) {
                    if ($badge.length) {
                        $badge.text(formatQtyBadge(val));
                    } else {
                        $(this).append('<span class="nbb2b-qs-qty">' + formatQtyBadge(val) + '</span>');
                    }
                } else {
                    $badge.remove();
                }
            });

            // 2. Update global quote basket count badges
            if (totalQty > 0) {
                var countText = String(totalQty);
                $('.cxb-b2b-quote-basket-count').text(countText);
                $('.cxb-b2b-quote-basket-toggle-count').text(countText);
                $('.cxb-b2b-quote-basket-total-count').text(countText);
            }

            // Also fire AJAX to sync qty on the server
            var cfg = (typeof cxb_b2b_product_showcase !== 'undefined') ? cxb_b2b_product_showcase : null;
            if (cfg && cfg.ajax_url) {
                $.ajax({
                    url: cfg.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'cxb_b2b_quote_action',
                        cxb_b2b_quote_action: 'update_quantity',
                        product_id: productId,
                        key: itemKey,
                        quantity: val,
                        nonce: cfg.nonce || ''
                    }
                });
            }

            // Re-inject quote_data into Elementor form
            injectQuoteDataIntoElementorForm($panel);
        });

        // ── Elementor form: inject quote_data ──────────────────────
        // When the popup contains an Elementor form, inject the current
        // quote basket into a hidden "quote_data" field so the Elementor
        // email filters can render the product table (same mechanism as
        // the Quote Request page).
        //
        // Elementor Pro renders hidden fields as:
        //   <input name="form_fields[quote_data]" id="form-field-quote_data">
        // so we use name*="quote_data" (contains selector) to match both
        // Elementor's pattern and any raw name="quote_data" field.
        function injectQuoteDataIntoElementorForm($container) {
            var $forms = $container.find('.elementor-form');
            if (!$forms.length) return;

            var state = null;
            try {
                var raw = localStorage.getItem('cxb_b2b_quote_cache');
                if (raw) state = JSON.parse(raw);
            } catch (e) { /* ignore */ }

            var items = (state && state.items) ? state.items : {};
            if ($.isEmptyObject(items)) return;

            var json = JSON.stringify(items);
            $forms.each(function () {
                var $f = $(this);
                // Broad selector — matches both Elementor's form_fields[quote_data]
                // and plain name="quote_data" (same pattern as quote.js line 1302)
                var $field = $f.find('input[name="quote_data"], textarea[name="quote_data"], input[name*="quote_data"], textarea[name*="quote_data"]');
                if (!$field.length) {
                    // Use Elementor's naming convention so its AJAX handler includes the field
                    $field = $('<input type="hidden" name="form_fields[quote_data]" id="form-field-quote_data">');
                    $f.append($field);
                }
                $field.val(json);
            });
        }

        // ── reCAPTCHA helpers ─────────────────────────────────────
        var rcCfg = {
            enabled:  cxb_b2b_leave_message.recaptcha_enabled || false,
            type:     cxb_b2b_leave_message.recaptcha_type    || 'v2',
            siteKey:  cxb_b2b_leave_message.recaptcha_site_key|| ''
        };

        // ── Turnstile helpers ─────────────────────────────────────
        var tsCfg = {
            enabled: cxb_b2b_leave_message.turnstile_enabled || false,
            siteKey: cxb_b2b_leave_message.turnstile_site_key || ''
        };

        // Render Turnstile widget when the panel opens (turnstile may load late via lazy-loader)
        var lmTurnstileRendered = false;
        function renderTurnstileWidget() {
            if (lmTurnstileRendered) return;
            var el = document.getElementById('nbb2b-lm-turnstile');
            if (el && typeof turnstile !== 'undefined' && typeof turnstile.render === 'function') {
                try {
                    turnstile.render(el, {
                        sitekey: tsCfg.siteKey,
                        callback: function(token) {
                            var input = document.querySelector('.nbb2b-lm-turnstile-token');
                            if (input) input.value = token;
                        }
                    });
                } catch (e) { /* already rendered */ }
                lmTurnstileRendered = true;
            }
        }

        // Re-render Turnstile when panel opens (in case API loaded after page load)
        $bar.on('click.turnstile', function () {
            if (tsCfg.enabled) {
                setTimeout(renderTurnstileWidget, 300);
            }
        });

        // When Turnstile lazy-loader finishes, try to render the widget
        if (tsCfg.enabled) {
            document.addEventListener('nbb2b:turnstile:ready', function() {
                setTimeout(renderTurnstileWidget, 100);
            });
        }

        // Render v2 widget when the panel opens (grecaptcha may load late via lazy-loader)
        var lmRecaptchaRendered = false;
        function renderV2Recaptcha() {
            if (lmRecaptchaRendered) return;
            var el = document.getElementById('nbb2b-lm-recaptcha');
            if (el && typeof grecaptcha !== 'undefined' && typeof grecaptcha.render === 'function') {
                try { grecaptcha.render(el, { sitekey: rcCfg.siteKey }); } catch (e) { /* already rendered */ }
                lmRecaptchaRendered = true;
            }
        }

        // Re-render v2 when panel opens (in case API loaded after page load)
        $bar.on('click.recaptcha', function () {
            if (rcCfg.enabled && rcCfg.type === 'v2') {
                setTimeout(renderV2Recaptcha, 300);
            }
        });

        // When reCAPTCHA lazy-loader finishes, try to render the v2 widget
        // (if the panel happens to already be open)
        if (rcCfg.enabled && rcCfg.type === 'v2') {
            document.addEventListener('nbb2b:recaptcha:ready', function() {
                setTimeout(renderV2Recaptcha, 100);
            });
        }

        // ── Form submission ──────────────────────────────────────
        function doSubmit(recaptchaToken) {
            var formData = $form.serializeArray();
            formData.push({ name: 'action', value: 'cxb_b2b_submit_leave_message' });
            formData.push({ name: 'cxb_b2b_leave_message_nonce', value: cxb_b2b_leave_message.nonce });
            formData.push({ name: 'browser_language', value: (function() {
                var langs = [];
                try {
                    // 1. navigator.languages – modern desktop & mobile browsers
                    if (typeof navigator.languages === 'object' && navigator.languages.length) {
                        langs = langs.concat(Array.prototype.slice.call(navigator.languages));
                    }
                    // 2. navigator.language – broad support including older mobile
                    if (navigator.language) {
                        langs.push(navigator.language);
                    }
                    // 3. IE / legacy Edge properties (rare on mobile, covers desktop IE)
                    if (navigator.userLanguage)    langs.push(navigator.userLanguage);
                    if (navigator.browserLanguage) langs.push(navigator.browserLanguage);
                    if (navigator.systemLanguage)  langs.push(navigator.systemLanguage);
                    // 4. Intl API – works in many in-app browsers & WebViews where
                    //    navigator.languages may be empty (WeChat, Facebook, Line, etc.)
                    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                        var resolved = Intl.DateTimeFormat().resolvedOptions();
                        if (resolved && resolved.locale) {
                            langs.push(resolved.locale);
                        }
                    }
                    // 5. HTML lang attribute – last-resort signal set by WordPress/server
                    if (document.documentElement && document.documentElement.lang) {
                        langs.push(document.documentElement.lang);
                    }
                } catch (e) { /* never break form submission */ }
                // Deduplicate while preserving preference order
                var seen = {}, unique = [];
                for (var i = 0; i < langs.length; i++) {
                    var tag = String(langs[i]).replace(/_/g, '-').trim();
                    if (tag && !seen[tag.toLowerCase()]) {
                        seen[tag.toLowerCase()] = true;
                        unique.push(tag);
                    }
                }
                return unique.join(', ') || '';
            })() });
            if (recaptchaToken) {
                formData.push({ name: 'g-recaptcha-response', value: recaptchaToken });
            }
            // Include Turnstile token if available
            var turnstileToken = $('.nbb2b-lm-turnstile-token').val();
            if (turnstileToken) {
                formData.push({ name: 'cf-turnstile-response', value: turnstileToken });
            }

            // Include client-side quote data for quantity accuracy
            try {
                var cachedQuote = localStorage.getItem('cxb_b2b_quote_cache');
                if (cachedQuote) {
                    var parsed = JSON.parse(cachedQuote);
                    if (parsed && parsed.items) {
                        formData.push({ name: 'client_quote_data', value: JSON.stringify(parsed.items) });
                    }
                }
            } catch(e) { /* localStorage not available */ }

            $.ajax({
                url:      cxb_b2b_leave_message.ajax_url,
                type:     'POST',
                data:     $.param(formData),
                dataType: 'json',
                success: function (res) {
                    if (res.success) {
                        lmResult(res.data.message, 'success', res.data.message_key);
                        $form[0].reset();
                        // Reset reCAPTCHA v2 widget after successful submission
                        if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                            try { grecaptcha.reset(); } catch (e) {}
                        }
                        // Reset Turnstile widget after successful submission
                        if (tsCfg.enabled && typeof turnstile !== 'undefined') {
                            try { turnstile.reset(); } catch (e) {}
                            $('.nbb2b-lm-turnstile-token').val('');
                        }

                        // Thank You page redirect — applies the global "Settings → Form Fields → Thank You Redirect" setting.
                        // Only safe schemes (http, https, relative paths starting with /) are honored.
                        var _lmCfg = (typeof cxb_b2b_leave_message !== 'undefined') ? cxb_b2b_leave_message : {};
                        var _tyUrl = _lmCfg && _lmCfg.thankyou_redirect_url ? String(_lmCfg.thankyou_redirect_url).replace(/^\s+|\s+$/g, '') : '';
                        if (_lmCfg && _lmCfg.thankyou_redirect_enabled && _tyUrl && /^(https?:\/\/|\/)/i.test(_tyUrl)) {
                            setTimeout(function () { window.location.href = _tyUrl; }, 1000);
                            return; // Skip the auto-collapse — we're leaving the page.
                        }

                        // Auto-collapse after 4 seconds on success.
                        // Keep the handle so openPanel()/closePanel() can cancel
                        // it — see the clearAutoClose() note at the top.
                        clearAutoClose();
                        autoCloseTimer = setTimeout(function () {
                            autoCloseTimer = null;
                            /* 提示条不在这里清：面板收起之后它还要在屏幕上多停片刻，
                               那正是确认信息最需要被看到的时候；它自己会超时退场。 */
                            closePanel();
                        }, 4000);
                    } else {
                        lmResult(res.data.message, 'error', res.data.message_key);
                        // Reset reCAPTCHA v2 widget so user can retry
                        if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                            try { grecaptcha.reset(); } catch (e) {}
                        }
                        // Reset Turnstile widget so user can retry
                        if (tsCfg.enabled && typeof turnstile !== 'undefined') {
                            try { turnstile.reset(); } catch (e) {}
                            $('.nbb2b-lm-turnstile-token').val('');
                        }
                    }
                },
                error: function () {
                    lmResult(t('network_error', 'Network error. Please try again.'), 'error');
                    if (rcCfg.enabled && rcCfg.type === 'v2' && typeof grecaptcha !== 'undefined') {
                        try { grecaptcha.reset(); } catch (e) {}
                    }
                    if (tsCfg.enabled && typeof turnstile !== 'undefined') {
                        try { turnstile.reset(); } catch (e) {}
                        $('.nbb2b-lm-turnstile-token').val('');
                    }
                },
                complete: function () {
                    $submit.prop('disabled', false).text(LM_SUBMIT_LABEL);
                }
            });
        }

        $form.on('submit', function (e) {
            e.preventDefault();

            // Clear previous messages
            lmClearResult();

            // Privacy Policy acceptance (required checkbox)
            var $ppNotice = $form.find('.cxb-b2b-privacy-notice');
            $ppNotice.removeClass('cxb-b2b-privacy-notice--error');
            if ($ppNotice.length) {
                var $ppCheckbox = $ppNotice.find('input[name="cxb_b2b_privacy_accepted"]');
                if ($ppCheckbox.length && !$ppCheckbox.is(':checked')) {
                    lmResult(t('agree_privacy', 'Please agree to the Privacy Policy before submitting.'), 'error');
                    $ppNotice.addClass('cxb-b2b-privacy-notice--error');
                    return;
                }
            }

            $submit.prop('disabled', true).text(t('sending', 'Sending…'));

            // Turnstile validation (check if enabled and token is present)
            if (tsCfg.enabled && tsCfg.siteKey) {
                var turnstileToken = $('.nbb2b-lm-turnstile-token').val();
                if (!turnstileToken) {
                    lmResult(t('complete_security', 'Please complete the security verification.'), 'error');
                    $submit.prop('disabled', false).text(LM_SUBMIT_LABEL);
                    return;
                }
            }

            // reCAPTCHA validation
            if (rcCfg.enabled && rcCfg.siteKey) {
                if (rcCfg.type === 'v2') {
                    // v2: check checkbox response
                    if (typeof grecaptcha !== 'undefined' && !grecaptcha.getResponse()) {
                        lmResult(t('complete_recaptcha', 'Please complete the reCAPTCHA verification.'), 'error');
                        $submit.prop('disabled', false).text(LM_SUBMIT_LABEL);
                        return;
                    }
                    doSubmit(typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '');
                } else if (rcCfg.type === 'v3') {
                    // v3: execute invisible reCAPTCHA and get token
                    if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.execute === 'function') {
                        grecaptcha.ready(function () {
                            grecaptcha.execute(rcCfg.siteKey, { action: 'leave_message' }).then(function (token) {
                                doSubmit(token);
                            }).catch(function () {
                                // Proceed without token on failure (server will log)
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

        // ── Live-refresh when quote changes while panel is open ──
        // Two mechanisms ensure the popup product data updates in real time
        // when items are added via the "Add to Quote" buttons:
        //
        // 1. Custom event: quote.js dispatches 'cxb:quote:updated' on cache
        //    writes — gives instant updates.
        // 2. Timestamp polling: a 600 ms interval checks whether the
        //    localStorage timestamp ('cxb_b2b_quote_ts') has changed —
        //    a reliable fallback that works even if the event is missed
        //    (e.g. quote.min.js not updated, or script load order issues).
        var _lmPollTimer  = null;
        var _lmLastQuoteTs = null;

        function lmRefreshQuoteSummary() {
            // Skip re-render while the user is typing in a quantity input —
            // syncQuoteSummary rebuilds the entire HTML which would destroy
            // the focused input and lose the cursor / partial value.
            var $focused = $panel.find('.nbb2b-qs-qty-input:focus');
            if ($focused.length) return;
            syncQuoteSummary('lm', true);
            injectQuoteDataIntoElementorForm($panel);
        }

        function lmStartPolling() {
            if (_lmPollTimer) return; // already polling
            try { _lmLastQuoteTs = localStorage.getItem('cxb_b2b_quote_ts'); } catch (e) {}
            _lmPollTimer = setInterval(function () {
                try {
                    var ts = localStorage.getItem('cxb_b2b_quote_ts');
                    if (ts !== _lmLastQuoteTs) {
                        _lmLastQuoteTs = ts;
                        lmRefreshQuoteSummary();
                    }
                } catch (e) { /* private browsing */ }
            }, 600);
        }

        function lmStopPolling() {
            if (_lmPollTimer) { clearInterval(_lmPollTimer); _lmPollTimer = null; }
        }

        // Primary: instant refresh via custom event
        document.addEventListener('cxb:quote:updated', function () {
            if ($panel.is(':visible')) {
                // Update the polling baseline so the poll doesn't double-fire
                try { _lmLastQuoteTs = localStorage.getItem('cxb_b2b_quote_ts'); } catch (e) {}
                lmRefreshQuoteSummary();
            }
        });

        // Start / stop polling when panel opens / closes
        $bar.on('click.lmPoll', function () { lmStartPolling(); });
        $close.on('click.lmPoll', function () { lmStopPolling(); });

        // ── Auto-show logic ───────────────────────────────────────
        // Controlled by backend settings passed via cxb_b2b_leave_message
        (function () {
            var cfg = (typeof cxb_b2b_leave_message !== 'undefined') ? cxb_b2b_leave_message : {};
            var isMobile = window.innerWidth <= 768;

            // On mobile, only run if auto_mobile is enabled
            if (isMobile && !cfg.auto_mobile) return;
            // On desktop, need at least one trigger enabled
            if (!isMobile && !cfg.auto_exit_intent && !cfg.auto_delay && !cfg.auto_scroll) return;

            var autoTriggered = false;
            var sessionKey = 'cxb_lm_auto_shown';

            // Only show once per session
            try {
                if (sessionStorage.getItem(sessionKey)) return;
            } catch (e) { /* private browsing */ }

            function triggerAutoShow() {
                if (autoTriggered) return;
                autoTriggered = true;
                try { sessionStorage.setItem(sessionKey, '1'); } catch (e) {}

                // Desktop: open the floating widget panel
                if (!isMobile) {
                    syncQuoteSummary('lm');
                    injectQuoteDataIntoElementorForm($panel);
                    openPanel();
                }
                // Mobile: trigger the mobile message button click
                if (isMobile) {
                    var mobileBtn = document.querySelector('.nbb2b-mm-item[data-action="message"]');
                    if (mobileBtn) {
                        mobileBtn.click();
                    }
                }

                // Clean up listeners
                cleanupListeners();
            }

            var cleanupFns = [];
            function cleanupListeners() {
                for (var i = 0; i < cleanupFns.length; i++) {
                    cleanupFns[i]();
                }
                cleanupFns = [];
            }

            // 1. Exit-Intent (desktop only)
            if (!isMobile && cfg.auto_exit_intent) {
                var exitIntentHandler = function (e) {
                    // Trigger when mouse moves to top of viewport (toward address bar / close button)
                    if (e.clientY <= 5) {
                        triggerAutoShow();
                    }
                };
                document.addEventListener('mouseout', exitIntentHandler);
                cleanupFns.push(function () {
                    document.removeEventListener('mouseout', exitIntentHandler);
                });
            }

            // 2. Delayed Trigger
            if (cfg.auto_delay) {
                var seconds = parseInt(cfg.auto_delay_seconds, 10) || 15;
                var delayTimer = setTimeout(function () {
                    triggerAutoShow();
                }, seconds * 1000);
                cleanupFns.push(function () {
                    clearTimeout(delayTimer);
                });
            }

            // 3. Scroll Trigger
            if (cfg.auto_scroll) {
                var percent = parseInt(cfg.auto_scroll_percent, 10) || 50;
                var scrollHandler = function () {
                    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    var docHeight = Math.max(
                        document.body.scrollHeight,
                        document.documentElement.scrollHeight
                    );
                    var winHeight = window.innerHeight;
                    var scrollable = docHeight - winHeight;
                    if (scrollable <= 0) return;
                    var scrolled = (scrollTop / scrollable) * 100;
                    if (scrolled >= percent) {
                        triggerAutoShow();
                    }
                };
                window.addEventListener('scroll', scrollHandler, { passive: true });
                cleanupFns.push(function () {
                    window.removeEventListener('scroll', scrollHandler);
                });
            }
        })();
    });
})(jQuery);
