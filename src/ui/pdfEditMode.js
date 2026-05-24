/**
 * pdfEditMode.js
 * Tracks which .editable-text-layer is currently focused in the PDF view.
 * Provides getActivePDFTarget() for fmt() routing in pageNav.js.
 *
 * Edit mode is active whenever the PDF tab is visible — the text-layer is
 * always contenteditable. We just track last-focused layer for execCommand
 * routing.
 */

let _activePDFLayer = null;

/**
 * Call once after PDF canvas is rendered.
 * Attaches focusin listeners to all .editable-text-layer elements inside
 * the given container so we always know which layer is active.
 */
export function registerPDFLayers(containerEl) {
    if (!containerEl) return;

    containerEl.addEventListener('focusin', e => {
        const layer = e.target.closest('.editable-text-layer');
        if (layer) _activePDFLayer = layer;
    }, true);

    // Default to first layer
    const first = containerEl.querySelector('.editable-text-layer');
    if (first) _activePDFLayer = first;
}

/**
 * Returns the last focused .editable-text-layer, or the first one in
 * #pdf-canvas-container as a fallback.
 */
export function getActivePDFTarget() {
    if (_activePDFLayer && document.contains(_activePDFLayer)) {
        return _activePDFLayer;
    }
    // Fallback: pick first available layer
    const fallback = document.querySelector('#pdf-canvas-container .editable-text-layer');
    if (fallback) _activePDFLayer = fallback;
    return fallback;
}

/**
 * Reset tracking (e.g. when a new PDF is loaded).
 */
export function resetPDFLayers() {
    _activePDFLayer = null;
}

/**
 * Call from app.js to wire initial tab state.
 */
export function initPDFEditMode() {
    // Wire focusin on the main PDF container right away;
    // layers are re-registered after each render via registerPDFLayers().
    const container = document.getElementById('pdf-canvas-container');
    if (container) registerPDFLayers(container);
}
