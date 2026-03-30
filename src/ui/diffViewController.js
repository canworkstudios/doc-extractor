/**
 * diffViewController.js
 * Controls the Diffchecker style interface inside the "Compare Diff" tab
 */

import $ from 'jquery';
import * as jsdiff from 'diff';
import { state } from '../state.js';

export function initDiffTabsAndLayout() {
    // Mode tabs: Rich Text / Plain Text
    $('.cmp-tab').on('click', function() {
        $('.cmp-tab').removeClass('active');
        $(this).addClass('active');
        
        state.diffActiveView = $(this).data('cmp-view');
        refreshCompareDiff();
    });

    // Layout toggles: Split / Unified
    $('#layout-split').on('click', function() {
        $('#layout-unified').removeClass('active');
        $(this).addClass('active');
        $('#diff-container').removeClass('unified-view').addClass('split-view');
        
        state.diffLayout = 'split';
        refreshCompareDiff();
    });
    
    $('#layout-unified').on('click', function() {
        $('#layout-split').removeClass('active');
        $(this).addClass('active');
        $('#diff-container').removeClass('split-view').addClass('unified-view');
        
        state.diffLayout = 'unified';
        refreshCompareDiff();
    });

    // Precision toggles: Word / Char
    $('#precision-word, #precision-char').on('click', function() {
        $('#precision-word, #precision-char').removeClass('active');
        $(this).addClass('active');
        
        state.diffPrecision = $(this).attr('id') === 'precision-word' ? 'word' : 'char';
        refreshCompareDiff();
    });

    // Handle divider resize inside diff view
    initDiffDividerResize();
}

export function refreshCompareDiff() {
    const useHtml = state.diffActiveView === 'rich-text';
    const content1 = useHtml ? state.pdf1.extractedHTML : state.pdf1.extractedText;
    const content2 = useHtml ? state.pdf2.extractedHTML : state.pdf2.extractedText;

    if (!content1 && !content2) {
        $('#content-left').html('<div class="empty-state">Load Original PDF</div>');
        $('#content-right').html('<div class="empty-state">Load Modified PDF</div>');
        return;
    }

    if (!content2) {
        $('#content-left').html(useHtml ? content1 : `<pre>${escapeHtml(content1)}</pre>`);
        $('#content-right').html('<div class="empty-state">Load Modified PDF to compare</div>');
        return;
    }

    const diffMethod = state.diffPrecision === 'word' ? 'diffWords' : 'diffChars';
    
    let diffs;
    if (useHtml) {
        diffs = jsdiff.diffLines(content1 || '', content2 || '');
    } else {
        diffs = jsdiff[diffMethod](content1 || '', content2 || '');
    }

    let leftHTML = '';
    let rightHTML = '';
    let unifiedHTML = '';
    let additions = 0;
    let removals = 0;

    diffs.forEach(part => {
        const val = useHtml ? part.value : escapeHtml(part.value);
        if (part.added) {
            rightHTML += `<span class="diff-added">${val}</span>`;
            unifiedHTML += `<span class="diff-added">${val}</span>`;
            additions++;
        } else if (part.removed) {
            leftHTML += `<span class="diff-removed">${val}</span>`;
            unifiedHTML += `<span class="diff-removed">${val}</span>`;
            removals++;
        } else {
            leftHTML += `<span class="diff-unchanged">${val}</span>`;
            rightHTML += `<span class="diff-unchanged">${val}</span>`;
            unifiedHTML += `<span class="diff-unchanged">${val}</span>`;
        }
    });
    
    if (state.diffLayout === 'split') {
        $('#content-left').html(useHtml ? leftHTML : `<pre>${leftHTML}</pre>`);
        $('#content-right').html(useHtml ? rightHTML : `<pre>${rightHTML}</pre>`);
    } else {
        $('#content-left').html(useHtml ? unifiedHTML : `<pre>${unifiedHTML}</pre>`);
        $('#content-right').html('<div class="empty-state">Unified View active</div>');
    }

    $('#stat-added-count').text(additions);
    $('#stat-removed-count').text(removals);
}

function initDiffDividerResize() {
    let dragging = false;
    let startX = 0;
    let startLeftW = 0;

    $('#pane-resizer').on('mousedown', function(e) {
        dragging = true;
        startX = e.clientX;
        startLeftW = $('#pane-left').outerWidth();
        $(this).addClass('dragging');
        $('body').css({ userSelect: 'none', cursor: 'col-resize' });
    });

    $(document).on('mousemove', function(e) {
        if (!dragging) return;
        const delta = e.clientX - startX;
        const totalW = $('#diff-container').outerWidth();
        const newLeftW = Math.max(200, Math.min(totalW - 200, startLeftW + delta));
        const leftPct = (newLeftW / totalW) * 100;
        
        $('#pane-left').css('flex', `0 0 ${leftPct}%`);
        $('#pane-right').css('flex', `0 0 ${100 - leftPct}%`);
    });

    $(document).on('mouseup', function() {
        if (!dragging) return;
        dragging = false;
        $('#pane-resizer').removeClass('dragging');
        $('body').css({ userSelect: '', cursor: '' });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
