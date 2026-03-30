/**
 * pdfCanvas.js
 * Renders a pdf document to canvas elements in a given container using mupdf.
 */

import $ from 'jquery';
import * as mupdf from 'mupdf';

const SCALE = 1.5;

export async function renderPDFToCanvas(bytes, containerId = 'pdf-canvas-container') {
    const $container = $(`#${containerId}`);
    if (!$container.length) return { wrappers: [], numPages: 0 };
    $container.empty();

    const wrappers = [];
    let numPages = 0;
    
    try {
        const pdfDoc = mupdf.Document.openDocument(bytes, "application/pdf");
        numPages = pdfDoc.countPages();

        for (let pageNum = 0; pageNum < numPages; pageNum++) {
            const page = pdfDoc.loadPage(pageNum);
            const bounds = page.getBounds();
            const width = (bounds[2] - bounds[0]) * SCALE;
            const height = (bounds[3] - bounds[1]) * SCALE;

            const $wrapper = $('<div>', {
                class: 'page-wrapper',
                css: { width, height, position: 'relative', overflow: 'hidden', marginBottom: '20px' },
                'data-page': pageNum + 1,
                contentEditable: 'true'
            });

            const $canvas = $('<canvas>', {
                css: { display: 'block', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 },
                contentEditable: 'false'
            });
            $canvas[0].width = width;
            $canvas[0].height = height;
            $wrapper.append($canvas);

            const $textLayer = $('<div>', { class: 'editable-text-layer', css: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }});
            $wrapper.append($textLayer);

            $container.append($wrapper);
            wrappers.push($wrapper[0]);

            // Draw image Pixmap to canvas
            const matrix = mupdf.Matrix.scale(SCALE, SCALE);
            const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true);
            const imgData = new ImageData(
                new Uint8ClampedArray(pixmap.getPixels()),
                pixmap.getWidth(),
                pixmap.getHeight()
            );
            const ctx = $canvas[0].getContext('2d');
            ctx.putImageData(imgData, 0, 0);

            // Build structural text
            const stext = page.toStructuredText("preserve-images");
            buildTextLayer(stext, SCALE, $textLayer);
        }
    } catch(err) {
        console.error("mupdf render error:", err);
    }

    return { wrappers, numPages };
}

function buildTextLayer(stext, scale, $layerEl) {
    try {
        const jsonStr = stext.asJSON();
        const data = JSON.parse(jsonStr);
        if (!data.blocks) return;
        
        data.blocks.forEach(block => {
            if (block.type !== 'text' || !block.lines) return;
            block.lines.forEach(line => {
                if (!line.chars || line.chars.length === 0) return;
                
                // Construct string from char array
                let text = '';
                line.chars.forEach(c => {
                    text += String.fromCharCode(c.c);
                });
                
                const firstChar = line.chars[0];
                const size = firstChar.size * scale;
                const x = line.bbox[0] * scale;
                const y = line.bbox[1] * scale;
                
                const $span = $('<span>').text(text).css({
                    left: x,
                    top: y,
                    fontSize: size + 'px',
                    position: 'absolute',
                    color: 'transparent',
                    whiteSpace: 'pre'
                });
                // Note: The text layer must be transparent exactly like the original code,
                // capturing selection overlaid on the canvas.
                $layerEl.append($span);
            });
        });
    } catch (e) {
        console.warn("Failed to parse stext", e);
    }
}
