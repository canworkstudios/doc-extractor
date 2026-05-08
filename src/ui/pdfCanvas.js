/**
 * pdfCanvas.js
 * Renders a pdf document to canvas elements in a given container using pdfjs-dist.
 */

import $ from 'jquery';
import * as pdfjsLib from 'pdfjs-dist';
// Global worker source is already configured in pdfAnalyzer.js or geometryWorker.js,
// but just in case, it should be available.

const SCALE = 1.5;

export async function renderPDFToCanvas(bytes, containerId = 'pdf-canvas-container') {
    const $container = $(`#${containerId}`);
    if (!$container.length) return { wrappers: [], numPages: 0 };
    $container.empty();

    const wrappers = [];
    let numPages = 0;
    
    try {
        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
        numPages = pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: SCALE });
            
            const $wrapper = $('<div>', {
                class: 'page-wrapper',
                css: { width: viewport.width, height: viewport.height, position: 'relative', overflow: 'hidden', marginBottom: '20px' },
                'data-page': pageNum,
                contentEditable: 'true'
            });

            const $canvas = $('<canvas>', {
                css: { display: 'block', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 },
                contentEditable: 'false'
            });
            $canvas[0].width = viewport.width;
            $canvas[0].height = viewport.height;
            $wrapper.append($canvas);

            const $textLayer = $('<div>', { class: 'editable-text-layer', css: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }});
            $wrapper.append($textLayer);

            $container.append($wrapper);
            wrappers.push($wrapper[0]);

            // Render PDF to canvas
            const ctx = $canvas[0].getContext('2d');
            
            // Render text layer
            const textContent = await page.getTextContent();
            buildTextLayer(textContent, viewport, $textLayer);
            
            await page.render({ canvasContext: ctx, viewport }).promise;
        }
    } catch(err) {
        console.error("pdfjs render error:", err);
    }

    return { wrappers, numPages };
}

function buildTextLayer(textContent, viewport, $layerEl) {
    try {
        const positionedItems = textContent.items.map(item => {
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const fontSize = Math.hypot(item.transform[0], item.transform[1]) * viewport.scale;

            return {
                str: item.str,
                x,
                y,
                fontSize,
                fontFamily: item.fontName || 'sans-serif'
            };
        });

        positionedItems.forEach(it => {
            if (!it.str.trim()) return; // Skip empty whitespace
            
            const $span = $('<span>').text(it.str).css({
                left: it.x,
                top: it.y - it.fontSize,
                fontSize: it.fontSize + 'px',
                fontFamily: it.fontFamily,
                position: 'absolute',
                color: 'transparent',
                whiteSpace: 'pre'
            });
            
            // Note: The text layer must be transparent to allow selection
            // while showing the actual PDF rendering beneath it.
            $layerEl.append($span);
        });
    } catch (e) {
        console.warn("Failed to build pdfjs text layer", e);
    }
}
