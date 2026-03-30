/**
 * viewController.js
 * Manages the 5-tab view system: PDF | HTML | Editor | Visual Diff | Compare Diff
 */

import $ from 'jquery';
import { state } from '../state.js';

const VIEWS = ['pdf', 'html', 'editor', 'visual-diff', 'diff'];

export function initViewTabs() {
    $('.tab-btn[data-view]').on('click', function() {
        if ($(this).prop('disabled')) return;
        switchView($(this).data('view'));
    });
}

export async function switchView(viewName) {
    if (!VIEWS.includes(viewName)) return;

    VIEWS.forEach(v => {
        $(`#view-${v}`).toggleClass('active', v === viewName);
    });

    $('.tab-btn[data-view]').each(function() {
        $(this).toggleClass('active', $(this).data('view') === viewName);
    });

    state.activeView = viewName;

    // Monaco needs layout() call when made visible
    if (viewName === 'editor' && state.monacoEditor) state.monacoEditor.layout();

    // Visual diff needs its own activation logic
    if (viewName === 'visual-diff') {
        const { activateVisualDiff } = await import('./visualDiff.js');
        activateVisualDiff();
    }
}

export function enableDiffTab() {
    $('#diff-tab-btn').prop('disabled', false);
}

export function disableDiffTab() {
    const btn = $('#diff-tab-btn');
    btn.prop('disabled', true);
    if (state.activeView === 'diff') switchView('pdf');
}

export function showStatus(msg, progress = '') {
    $('#status-bar').show();
    $('#status-msg').text(msg);
    $('#status-progress').text(progress);
}

export function hideStatus() {
    $('#status-bar').hide();
}
