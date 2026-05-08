// geometryWorker.js
// Local fallback extraction worker: PDF.js operator list → CTM baking
// → axis-aligned line detection → LatticeReconstructor → merged-cell HTML tables.
//
// Does not require any backend. Runs entirely in the browser.
// Handles table grids only — text paragraphs and headings are not extracted.
//
// Message in:  { type: 'process', bytes: Uint8Array }
// Messages out:
//   { type: 'progress', page: number, total: number, status: string }
//   { type: 'page',     page: number, html: string, text: string, tables: number }
//   { type: 'complete', pageCount: number, tableCount: number }
//   { type: 'error',    error: string }
//
// DESIGN NOTE: Results are streamed per-page via 'page' messages instead of
// accumulated into one massive 'complete' message. This prevents structured
// clone stack overflow on large PDFs (e.g. 76-page technical manuals).

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { extractPaths } from '../extraction/vector/ctmAdapter.js';
import { LatticeReconstructor } from '../extraction/vector/latticeReconstructor.js';
import { buildTable } from '../extraction/vector/tableBuilder.js';
import { rebuildText } from '../extraction/vector/textRebuilder.js';

// pdfjs-dist v4 — point to the ESM worker bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const { OPS } = pdfjsLib;

self.onmessage = async (e) => {
    if (e.data.type !== 'process') return;
    const { bytes } = e.data;

    try {
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const numPages = pdf.numPages;
        let totalTables = 0;

        for (let p = 1; p <= numPages; p++) {
            self.postMessage({ type: 'progress', page: p, total: numPages, status: 'Extracting…' });

            const page = await pdf.getPage(p);
            const viewport = page.getViewport({ scale: 1.5 });
            const pageWidthPt = page.view[2] - page.view[0];

            const [opList, textContent] = await Promise.all([
                page.getOperatorList(),
                page.getTextContent(),
            ]);

            // ── Table extraction (lattice/bordered grids) ─────────────────────
            const segments = extractPaths(opList, viewport, OPS);
            const reconstructor = new LatticeReconstructor(segments, { eps: 5 });
            const lattices = reconstructor.reconstructAll();

            const assignedItems = new Set();
            const tableHtmlParts = [];
            for (const lattice of lattices) {
                const tableHtml = buildTable(lattice, textContent.items, viewport, assignedItems);
                if (tableHtml) tableHtmlParts.push(tableHtml);
            }

            const pageTables = tableHtmlParts.length;
            totalTables += pageTables;

            // ── Plain text (reading-order rebuild) ───────────────────────────
            // Filter out text items that were already placed inside tables
            const nonTableItems = textContent.items.filter((_, idx) => !assignedItems.has(idx));
            
            // Generate clean HTML for the non-table text
            const textHtml = rebuildText(nonTableItems, pageWidthPt, { format: 'html' });
            
            // Also generate plain text if needed by the frontend text tab
            const plainText = rebuildText(nonTableItems, pageWidthPt, { format: 'text' });

            // Combine text HTML and table HTML for the output
            let combinedHtml = '';
            if (textHtml || pageTables > 0) {
                combinedHtml = `<section class="pdf-page-content" data-page="${p}">\n` +
                               `<h4 class="page-label">Page ${p}</h4>\n` +
                               `${textHtml}\n`;
                if (pageTables > 0) {
                    combinedHtml += `<div class="pdf-page-tables">\n${tableHtmlParts.join('\n')}\n</div>\n`;
                }
                combinedHtml += `</section>`;
            }

            // Stream per-page result — avoids accumulating huge payloads
            self.postMessage({
                type: 'page',
                page: p,
                html: combinedHtml,
                text: plainText.trim(),
                tables: pageTables,
            });

            // Release page resources
            page.cleanup();
        }

        self.postMessage({ type: 'complete', pageCount: numPages, tableCount: totalTables });
    } catch (err) {
        self.postMessage({ type: 'error', error: err.message || String(err) });
    }
};
