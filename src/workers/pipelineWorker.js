// src/workers/pipelineWorker.js
import * as mupdf from 'mupdf';
import { env, AutoProcessor, AutoModelForVision2Seq, RawImage } from '@huggingface/transformers';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

let processor = null;
let model = null;

async function getDocling() {
    if (!processor || !model) {
        try {
            processor = await AutoProcessor.from_pretrained('onnx-community/granite-docling-258M-ONNX', { device: 'webgpu' });
            model = await AutoModelForVision2Seq.from_pretrained('onnx-community/granite-docling-258M-ONNX', { device: 'webgpu' });
        } catch (e) {
            console.warn("WebGPU not available, falling back to WASM");
            processor = await AutoProcessor.from_pretrained('onnx-community/granite-docling-258M-ONNX', { device: 'wasm' });
            model = await AutoModelForVision2Seq.from_pretrained('onnx-community/granite-docling-258M-ONNX', { device: 'wasm' });
        }
    }
    return { processor, model };
}

self.onmessage = async (e) => {
    if (e.data.type !== 'process') return;
    const { pdfIndex, bytes } = e.data;
    
    try {
        const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
        const numPages = doc.countPages();
        let fullXML = '';
        
        self.postMessage({ type: 'progress', pdfIndex, status: 'Loading AI Model', progress: 0, total: numPages });
        const { processor, model } = await getDocling();
        
        for (let i = 0; i < numPages; i++) {
            self.postMessage({ type: 'progress', pdfIndex, status: 'Rendering Image', progress: i + 1, total: numPages });
            const page = doc.loadPage(i);
            
            // Render to RGBA pixels at ~150 DPI for transformers input
            const pixmap = page.toPixmap(mupdf.Matrix.scale(150/72, 150/72), mupdf.ColorSpace.DeviceRGB, true);
            
            // Raw pixels buffer from mupdf
            const rgbaPixels = new Uint8ClampedArray(pixmap.getPixels());
            
            // Transformer needs either raw pixel array or standard JS Image object or Canvas.
            // But from worker, we must pass raw RGBA using Transformers JS RawImage format.
            const rawImage = new RawImage(rgbaPixels, pixmap.getWidth(), pixmap.getHeight(), 4);
            
            self.postMessage({ type: 'progress', pdfIndex, status: 'Running Interface Inference', progress: i + 1, total: numPages });
            
            // Idefics3 Processor is processor(text, images)
            const inputs = await processor("<image>", rawImage);
            
            const outputIds = await model.generate({
                ...inputs,
                max_new_tokens: 1024
            });
            
            const generated_text = processor.batch_decode(outputIds, { skip_special_tokens: false })[0] || '';

            // Strip only the leading BOS / EOS wrapper tokens, keep DocTags intact
            const cleaned = generated_text
                .replace(/^<s>\s*/, '')
                .replace(/\s*<\/s>$/, '')
                .trim();

            console.log(`[Docling] Page ${i + 1} raw output (${cleaned.length} chars):`, cleaned.slice(0, 200));

            fullXML += `\n<page number="${i + 1}">\n${cleaned}\n</page>\n`;
        }
        
        self.postMessage({ type: 'complete', pdfIndex, docTags: fullXML });
    } catch (err) {
        self.postMessage({ type: 'error', pdfIndex, error: err.stack || err.message });
    }
};
