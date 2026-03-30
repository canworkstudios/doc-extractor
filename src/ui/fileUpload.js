/**
 * fileUpload.js
 * Handles file input events, loads PDF documents, drives extraction pipeline via Web Worker,
 * and populates all views.
 */

import $ from 'jquery';
import { state } from '../state.js';
import { renderPDFToCanvas } from './pdfCanvas.js';
import { showStatus, hideStatus, enableDiffTab, disableDiffTab } from './viewController.js';
import { registerPages } from './pageNav.js';
import { markDiffDirty } from './visualDiff.js';
import { initTableFeatures } from '../utils/tableLogic.js';
import { showToast } from './toast.js';

let pipelineWorker = null;

export function initFileInputs() {
    pipelineWorker = new Worker(new URL('../workers/pipelineWorker.js', import.meta.url), { type: 'module' });
    
    pipelineWorker.onmessage = async (e) => {
        const { type, pdfIndex, docTags, progress, total, status, error } = e.data;
        
        if (type === 'progress') {
            if (total) showStatus(status, `${progress} / ${total} pages`);
            else showStatus(`Extracting: ${status}…`);
        } else if (type === 'complete') {
            await handleExtractionComplete(pdfIndex, docTags);
            hideStatus();
        } else if (type === 'error') {
            console.error('Worker Error:', error);
            showStatus('Error: ' + error);
            showToast('Extraction failed', 'error');
            hideStatus();
        }
    };

    $('#file1-input').on('change', e => {
        if (e.target.files[0]) handleFile1(e.target.files[0]);
    });
    
    $('#file2-input').on('change', e => {
        if (e.target.files[0]) handleFile2(e.target.files[0]);
    });
}

async function handleFile1(file) {
    state.pdf1.file = file;
    $('#file1-name').text(file.name);
    $('#file1-input').closest('.file-btn').addClass('loaded');

    showStatus('Loading PDF…');
    try {
        const buf = await file.arrayBuffer();
        state.pdf1.bytes = new Uint8Array(buf.slice(0));

        // PDF View; render canvas via mupdf
        const { wrappers, numPages } = await renderPDFToCanvas(state.pdf1.bytes, 'pdf-canvas-container');
        registerPages(wrappers, numPages);

        showStatus('Extracting HTML via Docling…');
        
        // Start Extraction Pipeline
        pipelineWorker.postMessage({
            type: 'process',
            pdfIndex: 1,
            bytes: state.pdf1.bytes
        });

    } catch (err) {
        console.error('Error loading PDF 1:', err);
        showStatus('Error: ' + (err.message || err));
        showToast('Failed to load PDF', 'error');
        return;
    }
}

async function handleFile2(file) {
    state.pdf2.file = file;
    $('#file2-name').text(file.name);
    $('#file2-input').closest('.file-btn').addClass('loaded');

    showStatus('Loading comparison PDF…');
    try {
        const buf = await file.arrayBuffer();
        state.pdf2.bytes = new Uint8Array(buf.slice(0));

        showStatus('Extracting comparison HTML via Docling…');
        
        // Start Extraction Pipeline
        pipelineWorker.postMessage({
            type: 'process',
            pdfIndex: 2,
            bytes: state.pdf2.bytes
        });

    } catch (err) {
        console.error('Error loading PDF 2:', err);
        showStatus('Error: ' + (err.message || err));
        showToast('Failed to load comparison PDF', 'error');
        disableDiffTab();
        return;
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
