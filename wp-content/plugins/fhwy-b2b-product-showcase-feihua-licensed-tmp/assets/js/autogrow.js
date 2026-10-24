/**
 * Auto-growing textareas for the popup message forms.
 *
 * Shared by the Leave a Message panel (bottom-right and centered) and by the
 * mobile bottom-menu Message overlay. All three carry the same field, and it
 * is the tallest thing in a small panel, so it opens at a single line and
 * follows its own content from there. The stylesheets own the metrics — see
 * the note above the textarea block in leave-message.css — and cap the growth
 * with max-height, past which the field scrolls inside itself.
 *
 * Vanilla and standalone: the mobile menu script has no jQuery dependency,
 * and this file is enqueued from both feature paths (the mobile overlay is
 * rendered even when the floating widget is switched off).
 *
 * @since 2.1.61
 * @package Fhwy_B2B_Product_Showcase
 */
(function () {
    'use strict';

    var HOOK     = 'nbb2b-autogrow';
    var SELECTOR = 'textarea.' + HOOK;
    var MANAGED  = 'nbb2b-ta-auto';

    function isField(el) {
        return !!el && el.tagName === 'TEXTAREA' &&
               (' ' + el.className + ' ').indexOf(' ' + HOOK + ' ') !== -1;
    }

    /* Marks the field as script-managed, which is what takes the drag handle
       away in CSS. Done on first contact rather than at load, so a field the
       script never actually reaches keeps its handle. */
    function mark(el) {
        if ((' ' + el.className + ' ').indexOf(' ' + MANAGED + ' ') === -1) {
            el.className += ' ' + MANAGED;
        }
    }

    /* The height is written with !important because the stylesheets pin
       `height: auto !important` to keep theme rules out of it, and an inline
       declaration with !important is the only thing above that. */
    function fit(el) {
        if (!el || !el.style) { return; }

        /* A hidden field reports scrollHeight 0. Fitting one would collapse it
           to its min-height and, worse, leave that behind as the answer — so
           hidden fields are left alone and re-fitted when their panel opens.
           getClientRects() is empty for anything display:none, at any depth. */
        if (!el.getClientRects().length) { return; }

        var cs = window.getComputedStyle(el);

        /* A textarea never reports a scrollHeight smaller than its current
           height, so the box has to be released before it is measured.
           Without this the field could only ever grow: deleting text would
           leave it at whatever the longest draft needed. */
        el.style.setProperty('height', 'auto', 'important');

        var height = el.scrollHeight;
        if (cs.boxSizing === 'border-box') {
            height += (parseFloat(cs.borderTopWidth) || 0) +
                      (parseFloat(cs.borderBottomWidth) || 0);
        }

        el.style.setProperty('height', height + 'px', 'important');
    }

    function fitAll(root) {
        var scope = (root && root.querySelectorAll) ? root : document;
        var list  = scope.querySelectorAll(SELECTOR);
        for (var i = 0; i < list.length; i++) {
            mark(list[i]);
            fit(list[i]);
        }
    }

    function handle(e) {
        if (isField(e.target)) {
            mark(e.target);
            fit(e.target);
        }
    }

    /* Delegated on the document rather than bound per field: the panels are
       printed in the footer, the centered one is moved under <body> after
       load, and none of them should have to know this file exists. */
    document.addEventListener('input', handle);

    /* Focus is the cheap moment to re-check a field whose value arrived from
       somewhere other than the keyboard — a restored draft, an autofill, or a
       panel that was reopened while holding text. */
    document.addEventListener('focusin', handle);

    /* After a successful submit the panel scripts call form.reset(), which
       clears the value without firing `input`; the field would keep the height
       of the message that was just sent. The reset event arrives before the
       fields are actually cleared, hence the deferred pass. */
    document.addEventListener('reset', function (e) {
        var form = e.target;
        if (!form || !form.querySelectorAll) { return; }
        setTimeout(function () { fitAll(form); }, 0);
    });

    /* A width change rewraps the text, which changes how many lines it needs. */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () { fitAll(); }, 150);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { fitAll(); });
    } else {
        fitAll();
    }

    /* Exposed for the one thing this file cannot observe on its own: a panel
       going from hidden to visible. Both panel scripts call it on open. */
    window.cxbB2BAutoGrow = { fit: fit, fitAll: fitAll };
})();
