/**
 * visualDiff.js
 * Visual Diff view handling its own resizable panes with jQuery.
 */

import $ from 'jquery';
import { state } from '../state.js';
import { renderPDFToCanvas } from './pdfCanvas.js';
import { registerPages } from './pageNav.js';

let _rendered = false;

export async function activateVisualDiff() {
    if (!state.pdf1.bytes) {
        $('#visual-diff-pdf').html('<p class="empty-hint">Open a PDF first.</p>');
        return;
    }

    if (!_rendered || state.pdf1._diffDirty) {
        await renderPDFToCanvas(state.pdf1.bytes, 'visual-diff-pdf');
        _rendered = true;
        state.pdf1._diffDirty = false;
    }

    const $rightPane = $('#visual-diff-html');
    if ($rightPane.length && state.pdf1.extractedHTML) {
        const clean = typeof DOMPurify !== 'undefined'
            ? DOMPurify.sanitize(state.pdf1.extractedHTML, { ADD_TAGS: ['img'], ALLOW_DATA_ATTR: true })
            : state.pdf1.extractedHTML;
        $rightPane.html(clean);
    }

    const wrappers = $('#visual-diff-pdf .page-wrapper').toArray();
    if (wrappers.length) registerPages(wrappers, wrappers.length);
}

export function markDiffDirty() {
    _rendered = false;
    if (state.pdf1) state.pdf1._diffDirty = true;
}

export function initDividerResize() {
    const $divider = $('#vd-divider');
    const $layout = $('.visual-diff-layout');
    if (!$divider.length || !$layout.length) return;

    let dragging = false;
    let startX = 0;
    let startLeftW = 0;

    $divider.on('mousedown', function(e) {
        dragging = true;
        startX = e.clientX;
        startLeftW = $layout.find('.vd-pane').first().outerWidth();
        $(this).addClass('dragging');
        $('body').css({ userSelect: 'none', cursor: 'col-resize' });
    });

    $(document).on('mousemove', function(e) {
        if (!dragging) return;
        const delta = e.clientX - startX;
        const totalW = $layout.outerWidth();
        const newLeftW = Math.max(240, Math.min(totalW - 240, startLeftW + delta));
        const leftPct = (newLeftW / totalW) * 100;
        
        const $panes = $layout.find('.vd-pane');
        $panes.eq(0).css('flex', `0 0 ${leftPct}%`);
        $panes.eq(1).css('flex', `0 0 ${100 - leftPct}%`);
    });

    $(document).on('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        $divider.removeClass('dragging');
        $('body').css({ userSelect: '', cursor: '' });
    });
}
