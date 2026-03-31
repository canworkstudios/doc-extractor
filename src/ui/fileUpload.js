/**
 * fileUpload.js
 * Handles file input events, loads PDF documents, drives extraction via the
 * OS Worker Broker (backend → local WASM fallback), and populates all views.
 */

import $ from 'jquery';
import { state } from '../state.js';
import { renderPDFToCanvas } from './pdfCanvas.js';
import { showStatus, hideStatus, enableDiffTab, disableDiffTab } from './viewController.js';
import { registerPages } from './pageNav.js';
import { markDiffDirty } from './visualDiff.js';
import { initTableFeatures } from '../utils/tableLogic.js';
import { showToast } from './toast.js';
import { cwsBroker } from '@os/worker-broker.js';

let brokerReady = false;

export function initFileInputs() {
    // Create the local pipeline worker here where Vite can resolve the path,
    // then hand it to the broker for fallback use.
    const localWorker = new Worker(
        new URL('../workers/pipelineWorker.js', import.meta.url),
        { type: 'module' }
    );
    cwsBroker.registerLocalWorker(localWorker);

    // Initialize the broker (pings backend, discovers if online)
    cwsBroker.init().then(() => {
        brokerReady = true;
        const status = cwsBroker.getBackendStatus() ? 'Cloud' : 'Local WASM';
        console.log(`[FileUpload] Broker ready — extraction mode: ${status}`);
    });

    $('#file1-input').on('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0], 1);
    });

    $('#file2-input').on('change', e => {
        if (e.target.files[0]) handleFile(e.target.files[0], 2);
    });
}

/**
 * Unified handler for both PDF slots. Uses the Worker Broker which
 * automatically tries backend first, falls back to local WASM worker,
 * and enforces timeouts on both paths.
 */
async function handleFile(file, pdfIndex) {
    const pdfState = pdfIndex === 1 ? state.pdf1 : state.pdf2;
    const label = pdfIndex === 1 ? 'file1' : 'file2';

    pdfState.file = file;
    $(`#${label}-name`).text(file.name);
    $(`#${label}-input`).closest('.file-btn').addClass('loaded');

    showStatus('Loading PDF…');
    try {
        const buf = await file.arrayBuffer();
        pdfState.bytes = new Uint8Array(buf.slice(0));

        // Render PDF canvas (primary file only)
        if (pdfIndex === 1) {
            const { wrappers, numPages } = await renderPDFToCanvas(pdfState.bytes, 'pdf-canvas-container');
            registerPages(wrappers, numPages);
        }

        // Build FormData for the broker
        const formData = new FormData();
        formData.append('file', file);

        const useAiLayout = document.getElementById('ai-layout-toggle')?.checked;
        const apiKey = document.getElementById('ai-api-key')?.value;
        if (useAiLayout) {
            formData.append('use_ai_layout', 'true');
            if (apiKey) formData.append('api_key', apiKey);
        }

        // Wait for broker init if it hasn't completed yet
        if (!brokerReady) {
            showStatus('Connecting to extraction service…');
            await cwsBroker.init();
            brokerReady = true;
        }

        // Extract via broker (backend with timeout → local WASM fallback)
        const data = await cwsBroker.extractPdf(formData, (msg) => showStatus(msg));

        // If the local worker returned raw docTags instead of HTML, parse them
        if (data.source === 'local' && data.text && !data.html) {
            const { parseDocTags } = await import('../extraction/parser/index.js');
            const parsed = parseDocTags(data.text);
            data.html = parsed.html;
            data.text = parsed.text;
        }

        pdfState.extractedHTML = data.html;
        pdfState.extractedText = data.text;

        if (pdfIndex === 1) {
            populateHTMLPreview(pdfState.extractedHTML, 'html-preview');
            state.monacoEditor?.getModel()?.setValue(pdfState.extractedHTML);
            markDiffDirty();
            if (state.pdf2.bytes) refreshCodeDiff();
        } else {
            refreshCodeDiff();
            enableDiffTab();
        }

        const source = data.source === 'local' ? 'Local WASM' : 'Cloud Backend';
        const warnSuffix = data.warning ? ` (${data.warning})` : '';
        showToast(`PDF loaded via ${source}${warnSuffix}`, 'success');
        hideStatus();

    } catch (err) {
        console.error(`Error loading PDF ${pdfIndex}:`, err);
        hideStatus();
        showToast('Extraction Error: ' + (err.message || err.toString()), 'error');
        if (pdfIndex === 2) disableDiffTab();
    }
}

async function handleExtractionComplete(index, docTagsStr) {
    const pdfState = index === 1 ? state.pdf1 : state.pdf2;
    
    // Parse using our Stage 1, 2, 3 parser
    const { parseDocTags } = await import('../extraction/parser/index.js');
    const { html, text } = parseDocTags(docTagsStr);
    
    pdfState.extractedHTML = html;
    pdfState.extractedText = text;
    
    if (index === 1) {
        populateHTMLPreview(pdfState.extractedHTML, 'html-preview');
        state.monacoEditor?.getModel()?.setValue(pdfState.extractedHTML);
        markDiffDirty();
        showToast('PDF loaded successfully', 'success');
        
        if (state.pdf2.bytes) refreshCodeDiff();
    } else {
        refreshCodeDiff();
        enableDiffTab();
        showToast('Comparison PDF loaded', 'success');
    }
}

export function populateHTMLPreview(html, containerId = 'html-preview') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const clean = typeof DOMPurify !== 'undefined'
        ? DOMPurify.sanitize(html, { ADD_TAGS: ['img'], ALLOW_DATA_ATTR: true })
        : html;
    el.innerHTML = clean;
    initTableFeatures(el);
}

function refreshCodeDiff() {
    import('../ui/diffViewController.js').then(m => {
        m.refreshCompareDiff();
    });
}

export function downloadExtractedHTML() {
    const html = state.pdf1.extractedHTML;
    if (!html) { showToast('No extracted HTML yet; load a PDF first', 'error'); return; }
    const blob = new Blob(
        [`<!doctype html><html><head><meta charset="utf-8"/></head><body>\n${html}\n</body></html>`],
        { type: 'text/html' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.pdf1.file?.name?.replace(/\.pdf$/i, '') || 'extracted') + '.html';
    a.click();
    URL.revokeObjectURL(a.href);
}

export function exportExtractedPDF() {
    const preview = document.getElementById('html-preview');
    if (!preview?.innerHTML?.trim()) { showToast('No content to export', 'error'); return; }
    window.print();
}
