/**
 * historyController.js
 * Wires #btn-undo / #btn-redo toolbar buttons and Ctrl+Z / Ctrl+Y keyboard
 * shortcut to the structural ContentHistory stack.
 *
 * Scope: structural mutations only (zone reorder/split/group, insert-box,
 * add-page). Typing / bold / italic use the browser's native undo — this
 * controller never intercepts keystrokes while a contenteditable element
 * is focused.
 */

import $ from 'jquery';
import { state } from '../state.js';
import { ContentHistory } from './contentHistory.js';
import { applyHtmlEverywhere } from './htmlSync.js';
import { initTableFeatures } from '../utils/tableLogic.js';
import { refreshZoneToolbar } from './zoneToolbar.js';
import { showToast } from './toast.js';

// One shared history instance for the HTML surface.
export const htmlHistory = new ContentHistory(50);

// ── Public API used by mutation sites ────────────────────────────────────────

/**
 * Call BEFORE any structural mutation to save the pre-change state.
 * Reads innerHTML from #html-preview (the canonical source of truth).
 */
export function pushSnapshot() {
    const el = document.getElementById('html-preview');
    if (el && !htmlHistory.isRestoring) htmlHistory.push(el.innerHTML);
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initHistoryController() {
    $('#btn-undo').on('click', performUndo);
    $('#btn-redo').on('click', performRedo);

    // Keyboard: only intercept when NOT inside a contenteditable element
    // so the browser's native undo stack is never stomped while typing.
    document.addEventListener('keydown', (e) => {
        const view = state.activeView;
        if (view !== 'html' && view !== 'visual-diff') return;

        const active = document.activeElement;
        const isContentEditable = active?.isContentEditable;
        if (isContentEditable) return; // let browser handle it

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            performUndo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
            e.preventDefault();
            performRedo();
        }
    });

    syncUndoRedoUI();
}

// ── Core actions ──────────────────────────────────────────────────────────────

export function performUndo() {
    const snapshot = htmlHistory.undo();
    if (!snapshot) { showToast('Nothing to undo', 'info'); return; }
    _restore(snapshot);
    showToast('Undo', 'success');
}

export function performRedo() {
    const snapshot = htmlHistory.redo();
    if (!snapshot) { showToast('Nothing to redo', 'info'); return; }
    _restore(snapshot);
    showToast('Redo', 'success');
}

/**
 * Apply a snapshot to all surfaces and re-wire features.
 * Mirrors the pattern from tableHistory.js's performUndo/performRedo.
 */
function _restore(snapshot) {
    htmlHistory.isRestoring = true;
    try {
        applyHtmlEverywhere(snapshot, null);
        const el = document.getElementById('html-preview');
        if (el) initTableFeatures(el);
        refreshZoneToolbar();
    } finally {
        htmlHistory.isRestoring = false;
    }
    syncUndoRedoUI();
}

export function syncUndoRedoUI() {
    const canUndo = htmlHistory.canUndo();
    const canRedo = htmlHistory.canRedo();
    $('#btn-undo').prop('disabled', !canUndo).toggleClass('disabled', !canUndo);
    $('#btn-redo').prop('disabled', !canRedo).toggleClass('disabled', !canRedo);
}
