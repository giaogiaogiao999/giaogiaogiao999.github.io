/**
 * 菲华伟业 Form — Frontend AJAX submission logic
 *
 * Handles:
 *  - Form validation (required fields, email / URL format, acceptance boxes)
 *  - File upload via FormData, with a progress bar
 *  - AJAX POST to the cxb_b2b_submit_cxb_form action
 *  - Success / error message display, optional scroll and redirect
 *  - Quote product attachment from localStorage, and clearing it afterwards
 *  - reCAPTCHA v2 / v3 and Cloudflare Turnstile, when enabled on the widget
 *
 * @since 4.3.0
 * @package Fhwy_B2B_Product_Showcase
 */
(function ($) {
    'use strict';

    // i18n: read translated strings from window.cxbB2BI18n (populated by PHP
    // via __()), with English fallbacks. Supports %s / %1$s / %2$s.
    var I18N = (typeof window !== 'undefined' && window.cxbB2BI18n) ? window.cxbB2BI18n : {};
    function t(key, fallback) {
        var s = (I18N && typeof I18N[key] === 'string') ? I18N[key] : fallback;
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            var i = 0;
            s = s.replace(/%(\d+)\$s/g, function (_, n) { return args[n - 1] !== undefined ? args[n - 1] : ''; });
            s = s.replace(/%s/g, function () { return args[i] !== undefined ? args[i++] : ''; });
        }
        return s;
    }

    /**
     * Only absolute http(s) URLs and SINGLE-slash site-relative paths.
     *
     * The previous test was /^(https?:\/\/|\/)/i, which accepts
     * "//evil.example" — that is a protocol-relative URL, i.e. a redirect
     * straight off the site, wearing the costume of a local path. A saved
     * setting is not a trusted input here: anyone who can edit a page can set
     * it, and the server-side check is the one that matters, but there is no
     * reason for the client to be the weaker of the two.
     */
    function isSafeRedirect(url) {
        if (!url) return false;
        if (/^https?:\/\//i.test(url)) return true;
        return url.charAt(0) === '/' && !/^[\/\\]{2}/.test(url);
    }

    /**
     * Clear the quote basket the same way quote.js does after a successful
     * submission on the Quote Request page.
     *
     * quote.js keeps clearCache() private, so the keys are repeated here. They
     * are read in only one other place (quote.js's own STORAGE_KEY constants);
     * if those are ever renamed, this list has to move with them.
     */
    function clearQuoteBasket() {
        try {
            window.localStorage.removeItem('cxb_b2b_quote_cache');
            window.localStorage.removeItem('cxb_b2b_quote_ts');
        } catch (e) { /* private mode / storage disabled */ }

        try {
            document.cookie = 'cxb_b2b_basket_n=0; path=/; max-age=0; SameSite=Lax';
        } catch (e) { /* ignore */ }

        // Every other basket-aware component (leave-message.js, mobile-menu.js,
        // popup-fit.js) listens for this, so the header counter and the popups
        // update without a reload.
        try {
            document.dispatchEvent(new CustomEvent('cxb:quote:updated'));
        } catch (e) { /* very old browsers */ }
    }

    /**
     * Ask the server for a fresh nonce.
     *
     * The nonce is printed into the page by wp_localize_script, so a page
     * served from a full-page cache carries whatever nonce was current when
     * the cache entry was written. WordPress nonces last 24 hours; a cached
     * page older than that submits a dead one and the visitor is told
     * "Security verification failed" on a form they filled in correctly.
     * admin-ajax.php is excluded from every serious page cache, so a round
     * trip here always returns a live value.
     */
    function refreshNonce() {
        return $.ajax({
            url: cxb_form_vars.ajax_url,
            type: 'POST',
            dataType: 'json',
            data: { action: 'cxb_b2b_refresh_cxb_form_nonce' }
        }).then(function (res) {
            if (res && res.success && res.data && res.data.nonce) {
                cxb_form_vars.nonce = res.data.nonce;
                return res.data.nonce;
            }
            return null;
        }, function () {
            return null;
        });
    }

    $(function () {

        /* ================================================================
         * Stamp each form with the moment it became interactive.
         *
         * Read back by the server as a cheap bot filter. It is a client
         * timestamp, so it proves nothing on its own — a script can lie about
         * it. What it does catch is the large, unsophisticated majority that
         * posts the form the instant it is parsed.
         * ================================================================ */
        function stampForms(root) {
            $(root || document).find('.cxb-form-rendered-at').each(function () {
                if (!this.value) {
                    this.value = String(Math.floor(Date.now() / 1000));
                }
            });
        }
        stampForms();

        /* ================================================================
         * CAPTCHA wiring
         * ================================================================ */
        function renderTurnstileWidgets() {
            if (typeof window.nbb2bRenderTurnstileWidget !== 'function') return;
            $('.cxb-form-turnstile').each(function () {
                var id = this.id;
                if (!id) return;
                window.nbb2bRenderTurnstileWidget(id, '#' + id + '-token', '');
            });
        }

        if (window.nbb2bTurnstileReady) {
            renderTurnstileWidgets();
        }
        document.addEventListener('nbb2b:turnstile:ready', renderTurnstileWidgets);

        /**
         * reCAPTCHA v3 produces a token per action, and tokens expire after two
         * minutes — so it has to be fetched at submit time, not at page load.
         * Resolves with null when grecaptcha never arrived (ad blocker, Google
         * unreachable in mainland China): the server treats a missing v3 token
         * as "could not verify" rather than "failed", the same graceful
         * degradation verify_turnstile_token() already applies.
         */
        function getRecaptchaV3Token(siteKey) {
            var d = $.Deferred();

            if (typeof window.grecaptcha === 'undefined' || !window.grecaptcha.execute) {
                return d.resolve(null).promise();
            }

            try {
                window.grecaptcha.ready(function () {
                    window.grecaptcha.execute(siteKey, { action: 'cxb_form' })
                        .then(function (token) { d.resolve(token || null); },
                              function () { d.resolve(null); });
                });
            } catch (e) {
                d.resolve(null);
            }

            // Never let a hung CAPTCHA hold the submission hostage.
            setTimeout(function () { d.resolve(null); }, 5000);

            return d.promise();
        }

        /* ================================================================
         * File upload drop-zone interactions
         * ================================================================ */
        $(document).on('click', '.cxb-form-file-zone', function (e) {
            // Don't trigger if clicking the remove button
            if ($(e.target).closest('.cxb-form-file-remove').length) return;
            // Don't re-trigger if the click originated from the file input itself
            if ($(e.target).hasClass('cxb-form-file-input')) return;
            // Use native click() — opens the file dialog without jQuery event bubbling issues
            var input = $(this).find('.cxb-form-file-input')[0];
            if (input) input.click();
        });

        // The zone is role="button" and focusable, so it has to answer the
        // keyboard the way a button does.
        $(document).on('keydown', '.cxb-form-file-zone', function (e) {
            if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
                e.preventDefault();
                var input = $(this).find('.cxb-form-file-input')[0];
                if (input) input.click();
            }
        });

        $(document).on('change', '.cxb-form-file-input', function () {
            var $zone = $(this).closest('.cxb-form-file-zone');
            var file  = this.files && this.files[0];
            if (file) {
                var maxMb = parseInt($zone.attr('data-max-mb'), 10) || 50;
                if (file.size > maxMb * 1024 * 1024) {
                    var $form = $(this).closest('.cxb-form');
                    var $msg  = $form.find('.cxb-form-message');
                    var text  = t('file_size_exceeds', 'File size exceeds %s MB limit.', maxMb);
                    // An alert() steals focus and cannot be styled; the form
                    // already owns a message area, so use it.
                    if ($msg.length) {
                        $msg.text(text)
                            .removeClass('cxb-form-message--success')
                            .addClass('cxb-form-message--error').show();
                    } else {
                        window.alert(text);
                    }
                    this.value = '';
                    return;
                }
                $zone.find('.cxb-form-file-placeholder').hide();
                $zone.find('.cxb-form-file-name').text(file.name);
                $zone.find('.cxb-form-file-selected').show();
                // Reset progress bar for new file selection
                $zone.find('.cxb-form-file-progress').remove();
                $zone.closest('.cxb-form-field').removeClass('cxb-form-field--error');
            }
        });

        $(document).on('click', '.cxb-form-file-remove', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var $zone  = $(this).closest('.cxb-form-file-zone');
            var $input = $zone.find('.cxb-form-file-input');
            $input.val('');
            $zone.find('.cxb-form-file-selected').hide();
            $zone.find('.cxb-form-file-placeholder').show();
            $zone.find('.cxb-form-file-progress').remove();
        });

        // Drag & drop
        $(document).on('dragover dragenter', '.cxb-form-file-zone', function (e) {
            e.preventDefault();
            $(this).addClass('cxb-form-file-zone--dragover');
        });
        $(document).on('dragleave drop', '.cxb-form-file-zone', function (e) {
            e.preventDefault();
            $(this).removeClass('cxb-form-file-zone--dragover');
        });
        $(document).on('drop', '.cxb-form-file-zone', function (e) {
            var files = e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files;
            if (files && files.length) {
                var $input = $(this).find('.cxb-form-file-input');
                // Use DataTransfer to programmatically set files
                try {
                    var dt = new DataTransfer();
                    dt.items.add(files[0]);
                    $input[0].files = dt.files;
                    $input.trigger('change');
                } catch (err) {
                    // Fallback for older browsers — cannot set .files; open the picker
                    if ($input[0]) $input[0].click();
                }
            }
        });

        /* ================================================================
         * Form submission
         * ================================================================ */
        $(document).on('submit', '.cxb-form', function (e) {
            e.preventDefault();

            var $form = $(this);

            // Inside the Elementor canvas the form is a preview, not a form.
            if ($form.closest('.cxb-form-wrap--editing').length) {
                return;
            }

            // A second submit while the first is in flight would send the same
            // inquiry twice; the button is disabled below, but Enter in a text
            // field bypasses a disabled button in some browsers.
            if ($form.data('cxbBusy')) {
                return;
            }

            var $wrap    = $form.closest('.cxb-form-wrap');
            var $submit  = $form.find('.cxb-form-submit');
            var $message = $form.find('.cxb-form-message');
            var config   = $form.data('fieldsConfig') || [];

            if (typeof config === 'string') {
                // jQuery only auto-parses data-* JSON when it is well formed;
                // if a filter mangled the attribute we would otherwise iterate
                // a string character by character.
                try { config = JSON.parse(config); } catch (ex) { config = []; }
            }
            if (!$.isArray(config)) config = [];

            var successMsg      = $.trim($form.attr('data-success-msg') || '');
            var includeQuote    = $form.attr('data-include-quote') === 'yes';
            var clearQuote      = $form.attr('data-clear-quote') === 'yes';
            var redirectUrl     = $.trim($form.attr('data-redirect-url') || '');
            var redirectDelay   = parseInt($form.attr('data-redirect-delay'), 10);
            var doScroll        = $form.attr('data-scroll') === 'yes';
            var doReset         = $form.attr('data-reset') === 'yes';
            var doHide          = $form.attr('data-hide-after') === 'yes';
            var captchaProvider = $form.attr('data-captcha') || '';
            var captchaVariant  = $form.attr('data-captcha-variant') || '';
            var captchaKey      = $form.attr('data-captcha-key') || '';
            var loadingText     = $.trim($form.attr('data-loading-text') || '') || t('sending', 'Sending…');
            var redirectPending = false;

            if (isNaN(redirectDelay) || redirectDelay < 0) redirectDelay = 1000;

            /*
             * Capture the button label HERE, not at DOMReady.
             *
             * The old code stored it once on page load. Any form that arrived
             * afterwards — an Elementor popup, a tab that renders lazily, an
             * AJAX-loaded section — had no stored label, so after a submission
             * the restore fell through to $submit.text(), which by then read
             * "Sending…". The button kept that text for the rest of the visit.
             */
            if (!$submit.data('original-html')) {
                $submit.data('original-html', $submit.html());
            }

            function showMessage(html, kind) {
                $message
                    .removeClass('cxb-form-message--success cxb-form-message--error')
                    .addClass('cxb-form-message--' + kind)
                    .html(html)
                    .show();

                if (doScroll) {
                    var el = $message[0];
                    if (el && el.scrollIntoView) {
                        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                        catch (ex) { el.scrollIntoView(); }
                    }
                }
            }

            // Clear previous state
            $message.hide().removeClass('cxb-form-message--success cxb-form-message--error').html('');
            $form.find('.cxb-form-field--error').removeClass('cxb-form-field--error');
            $form.find('[aria-invalid]').removeAttr('aria-invalid');

            /* ---- Client-side validation ---- */
            var errors = [];

            function markInvalid($field) {
                $field.closest('.cxb-form-field').addClass('cxb-form-field--error');
                $field.attr('aria-invalid', 'true');
            }

            $.each(config, function (i, field) {
                if (!field || !field.key) return true; // continue
                if (field.type === 'hidden') return true;

                var key = field.key;
                var $field = $form.find('[name="' + key + '"], [name="' + key + '[]"]');
                if (!$field.length) return true;

                var val = '';
                if (field.type === 'checkbox') {
                    val = $form.find('[name="' + key + '[]"]:checked').length > 0 ? 'yes' : '';
                } else if (field.type === 'radio' || field.type === 'acceptance') {
                    val = $field.filter(':checked').length > 0 ? 'yes' : '';
                } else if (field.type === 'file') {
                    val = ($field[0].files && $field[0].files.length > 0) ? 'yes' : '';
                } else {
                    val = $.trim($field.val() || '');
                }

                if (field.required && !val) {
                    errors.push(t('field_required', '%s is required.', field.label));
                    markInvalid($field);
                    return true; // no point format-checking an empty value
                }

                if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                    errors.push(t('valid_email_required_alt', 'Valid email address is required.'));
                    markInvalid($field);
                }

                if (field.type === 'url' && val && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(val)) {
                    errors.push(t('valid_url_required', 'Please enter a valid web address.'));
                    markInvalid($field);
                }
            });

            if (errors.length) {
                showMessage(errors.join('<br>'), 'error');
                return;
            }

            /* ---- Privacy Policy acceptance (required checkbox) ---- */
            var $ppNotice = $form.find('.cxb-b2b-privacy-notice');
            $ppNotice.removeClass('cxb-b2b-privacy-notice--error');
            if ($ppNotice.length) {
                var $ppCheckbox = $ppNotice.find('input[name="cxb_b2b_privacy_accepted"]');
                if ($ppCheckbox.length && !$ppCheckbox.is(':checked')) {
                    showMessage(t('agree_privacy', 'Please agree to the Privacy Policy before submitting.'), 'error');
                    $ppNotice.addClass('cxb-b2b-privacy-notice--error');
                    return;
                }
            }

            /* ---- CAPTCHA present but unanswered ---- */
            if (captchaProvider === 'recaptcha' && captchaVariant === 'v2') {
                if (typeof window.grecaptcha !== 'undefined' && window.grecaptcha.getResponse) {
                    var rcVal = '';
                    try { rcVal = window.grecaptcha.getResponse(); } catch (ex) { rcVal = ''; }
                    if (!rcVal) {
                        showMessage(t('complete_captcha', 'Please complete the CAPTCHA.'), 'error');
                        return;
                    }
                }
            }

            $form.data('cxbBusy', true);
            $submit.prop('disabled', true).text(loadingText);

            /* ---- Show progress bars on file zones holding a file ---- */
            $form.find('.cxb-form-file-input').each(function () {
                if (this.files && this.files.length > 0) {
                    var $z = $(this).closest('.cxb-form-file-zone');
                    $z.find('.cxb-form-file-progress').remove();
                    $z.append(
                        '<div class="cxb-form-file-progress">' +
                            '<div class="cxb-form-file-progress-bar"></div>' +
                            '<span class="cxb-form-file-progress-text">' + t('uploading_pct', 'Uploading… %s%', 0) + '</span>' +
                        '</div>'
                    );
                }
            });

            function finish() {
                $form.data('cxbBusy', false);
                if (!redirectPending) {
                    $submit.prop('disabled', false).html($submit.data('original-html'));
                }
            }

            function buildFormData() {
                var fd = new FormData($form[0]);
                fd.append('action', 'cxb_b2b_submit_cxb_form');
                fd.append('_cxb_form_nonce', cxb_form_vars.nonce);
                fd.append('fields_config', JSON.stringify(config));

                // Browser language, best-effort and de-duplicated.
                fd.append('browser_language', (function () {
                    var langs = [];
                    try {
                        if (navigator.languages && navigator.languages.length) {
                            langs = langs.concat([].slice.call(navigator.languages));
                        }
                        if (navigator.language) langs.push(navigator.language);
                    } catch (ex) { /* WebViews that strip navigator */ }

                    var seen = {}, unique = [];
                    for (var j = 0; j < langs.length; j++) {
                        // NOTE: named `tag`, not `t` — `t` is the translation
                        // helper defined at the top of this file, and shadowing
                        // it inside a closure is a trap waiting for the first
                        // person who adds a translated string in here.
                        var tag = String(langs[j]).replace(/_/g, '-').trim();
                        if (tag && !seen[tag.toLowerCase()]) {
                            seen[tag.toLowerCase()] = true;
                            unique.push(tag);
                        }
                    }
                    return unique.join(', ');
                })());

                if (includeQuote) {
                    try {
                        var raw = localStorage.getItem('cxb_b2b_quote_cache');
                        if (raw) {
                            var state = JSON.parse(raw);
                            if (state && state.items) fd.append('quote_data', JSON.stringify(state.items));
                        }
                    } catch (ex) { /* private mode / corrupt cache */ }
                }

                if (clearQuote) {
                    fd.append('cxb_form_clear_quote', '1');
                }

                return fd;
            }

            function send(fd, isRetry) {
                $.ajax({
                    url: cxb_form_vars.ajax_url,
                    type: 'POST',
                    data: fd,
                    processData: false,
                    contentType: false,
                    dataType: 'json',
                    xhr: function () {
                        var xhr = new window.XMLHttpRequest();
                        xhr.upload.addEventListener('progress', function (evt) {
                            if (evt.lengthComputable) {
                                var pct = Math.round((evt.loaded / evt.total) * 100);
                                $form.find('.cxb-form-file-progress-bar').css('width', pct + '%');
                                $form.find('.cxb-form-file-progress-text').text(
                                    pct < 100 ? t('uploading_pct', 'Uploading… %s%', pct) : t('processing', 'Processing…')
                                );
                            }
                        }, false);
                        return xhr;
                    },
                    success: function (res) {
                        if (res && res.success) {
                            $form.find('.cxb-form-file-progress-bar').css('width', '100%');
                            $form.find('.cxb-form-file-progress-text').text(t('upload_complete', 'Upload complete'));
                            $form.find('.cxb-form-file-progress').addClass('cxb-form-file-progress--success');

                            /*
                             * The widget's own Success Message wins.
                             *
                             * Until 2.1.85 this read `res.data.message || successMsg`,
                             * and the server ALWAYS sends a message — so the
                             * form-level setting could never appear. Anyone who
                             * typed their own confirmation saw the plugin default
                             * instead and had no way to tell why.
                             */
                            var msg = successMsg || (res.data && res.data.message) ||
                                      t('submitted_success', 'Submitted successfully.');
                            showMessage(msg, 'success');

                            if (doReset) {
                                $form[0].reset();
                                $form.find('.cxb-form-file-selected').hide();
                                $form.find('.cxb-form-file-placeholder').show();
                                $form.find('.cxb-form-file-progress').remove();
                                // A fresh timestamp, or a second submission
                                // straight after this one trips the time trap.
                                stampForms($form);
                            }

                            if (clearQuote) {
                                clearQuoteBasket();
                            }

                            // Reset the CAPTCHA so a second submission is possible.
                            if (captchaProvider === 'recaptcha' && captchaVariant === 'v2' &&
                                typeof window.grecaptcha !== 'undefined' && window.grecaptcha.reset) {
                                try { window.grecaptcha.reset(); } catch (ex) { /* not rendered */ }
                            }
                            if (captchaProvider === 'turnstile' &&
                                typeof window.turnstile !== 'undefined' && window.turnstile.reset) {
                                try { window.turnstile.reset(); } catch (ex) { /* not rendered */ }
                            }

                            if (doHide) {
                                $form.find('.cxb-form-fields, .cxb-form-actions, .cxb-form-captcha, .cxb-b2b-privacy-notice').hide();
                            }

                            if (isSafeRedirect(redirectUrl)) {
                                redirectPending = true;
                                setTimeout(function () {
                                    window.location.href = redirectUrl;
                                }, redirectDelay);
                            }
                            return;
                        }

                        var code = (res && res.data && res.data.code) || '';

                        // One silent retry with a fresh nonce. See refreshNonce().
                        if (code === 'invalid_nonce' && !isRetry) {
                            refreshNonce().then(function (fresh) {
                                if (fresh) {
                                    send(buildFormData(), true);
                                } else {
                                    $form.find('.cxb-form-file-progress').remove();
                                    showMessage(
                                        (res.data && res.data.message) ||
                                        t('submission_failed_short', 'Submission failed.'),
                                        'error'
                                    );
                                    finish();
                                }
                            });
                            return;
                        }

                        $form.find('.cxb-form-file-progress').remove();
                        showMessage(
                            (res && res.data && res.data.message) ||
                            t('submission_failed_short', 'Submission failed.'),
                            'error'
                        );
                        finish();
                    },
                    error: function (xhr) {
                        $form.find('.cxb-form-file-progress').remove();

                        /*
                         * A 413 means the request body was larger than the
                         * server accepts, which is a very different problem
                         * from "the network dropped" — and the one people
                         * actually hit, by attaching a big file. Saying
                         * "network error" sends them to reload the page and
                         * try the same file again.
                         */
                        var msg = (xhr && xhr.status === 413)
                            ? t('file_too_large_server', 'The attached file is larger than this server accepts. Please attach a smaller file.')
                            : t('network_error', 'Network error. Please try again.');

                        showMessage(msg, 'error');
                        finish();
                    }
                });
            }

            // reCAPTCHA v3 has to run first: its token goes into the FormData.
            if (captchaProvider === 'recaptcha' && captchaVariant === 'v3' && captchaKey) {
                getRecaptchaV3Token(captchaKey).then(function (token) {
                    if (token) {
                        $form.find('.cxb-form-recaptcha-token').val(token);
                    }
                    send(buildFormData(), false);
                });
            } else {
                send(buildFormData(), false);
            }
        });

        /*
         * Elementor renders popups and lazily-loaded sections after DOMReady,
         * so the timestamp field in those has to be filled in when they appear.
         */
        if (window.elementorFrontend && window.elementorFrontend.hooks) {
            try {
                window.elementorFrontend.hooks.addAction('frontend/element_ready/global', function ($scope) {
                    stampForms($scope);
                });
            } catch (e) { /* Elementor absent or too old */ }
        }
        $(document).on('elementor/popup/show', function () {
            stampForms();
        });
    });
})(jQuery);
