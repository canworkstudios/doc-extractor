// test-sec.mjs — diagnostic run for SEC filing pages 44-59
// Usage: node test-sec.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

import { extractPaths }                                          from './src/extraction/vector/ctmAdapter.js';
import { classifyPage }                                          from './src/extraction/vector/contextClassifier.js';
import { assemblePage, createFontRegistry, generateDocumentStyles } from './src/extraction/vector/pageAssembler.js';
import { PageScale }                                             from './src/extraction/vector/pageScale.js';
import { detectStreamTables }                                    from './src/extraction/vector/streamDetector.js';
import { LatticeReconstructor }                                  from './src/extraction/vector/latticeReconstructor.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
pdfjsLib.GlobalWorkerOptions.workerSrc =
    path.join(__dir, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

const { OPS } = pdfjsLib;
const OUTDIR  = path.join(__dir, 'test-out');
mkdirSync(OUTDIR, { recursive: true });

const FILE      = path.join(os.homedir(), 'Downloads/0000059478-26-000013.pdf');
const START_PAGE = 44;
const END_PAGE   = 59;

const bytes = new Uint8Array(readFileSync(FILE));
const pdf   = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
console.log(`\nSEC filing: ${pdf.numPages} total pages — diagnosing pages ${START_PAGE}-${END_PAGE}\n`);

const fontRegistry = createFontRegistry();
const htmlParts    = [];

for (let p = START_PAGE; p <= Math.min(END_PAGE, pdf.numPages); p++) {
    const page      = await pdf.getPage(p);
    const viewport  = page.getViewport({ scale: 1.5 });
    const pageWidthPt = page.view[2] - page.view[0];

    const [opList, textContent] = await Promise.all([
        page.getOperatorList(),
        page.getTextContent(),
    ]);

    const { segments, imageMeta, filledRects } = extractPaths(opList, viewport, OPS);
    const hSegs = segments.filter(s => Math.abs(s.y2-s.y1) <= 4 && Math.abs(s.x2-s.x1) > 4);
    const vSegs = segments.filter(s => Math.abs(s.x2-s.x1) <= 4 && Math.abs(s.y2-s.y1) > 4);

    const { regions, textMeta, columnSplits } = classifyPage(
        segments, textContent.items, viewport, pageWidthPt, imageMeta,
        { filledRects }
    );

    const scale = new PageScale(textMeta.filter(i => i.str?.trim()), viewport);

    // ── Summary ──────────────────────────────────────────────────────────────
    const lattice = regions.filter(r => r.type === 'LATTICE_TABLE');
    const stream  = regions.filter(r => r.type === 'STREAM_TABLE');
    const boxes   = regions.filter(r => r.type === 'BOX');
    const others  = regions.filter(r => !['LATTICE_TABLE','STREAM_TABLE','BOX'].includes(r.type));

    console.log(`${'═'.repeat(68)}`);
    console.log(`Page ${p}  segs: H=${hSegs.length} V=${vSegs.length}  textItems=${textContent.items.length}  filledRects=${filledRects?.length ?? 0}`);
    console.log(`  S=${scale.S.toFixed(1)}  yBandTol=${scale.yBandTolPx.toFixed(1)}  streamGap=${scale.streamGapPx.toFixed(1)}  colTol=${scale.colTolPx.toFixed(1)}`);

    if (lattice.length) {
        lattice.forEach(r => {
            const l = r.lattice;
            console.log(`  LATTICE_TABLE  rows=${l?.rows?.length ?? '?'} cols=${l?.cols?.length ?? '?'}  items=${r.textItemIndices?.length}  clusterEps=${l?.clusterEps ?? '?'}`);
        });
    } else {
        console.log(`  [!] NO LATTICE TABLE detected`);
    }

    if (stream.length) {
        stream.forEach(r => {
            const l = r.lattice;
            console.log(`  STREAM_TABLE   conf=${l?.confidence?.toFixed(2) ?? '?'}  rows=${l?.rows?.length ?? '?'} cols=${l?.cols?.length ?? '?'}  items=${r.textItemIndices?.length}`);
        });
    } else {
        console.log(`  [!] NO STREAM TABLE detected`);
    }

    if (boxes.length)  console.log(`  BOX ×${boxes.length}`);
    if (others.length) console.log(`  other: ${others.map(r => r.type + '(' + (r.textItemIndices?.length ?? 0) + ')').join('  ')}`);

    // ── Raw lattice reconstruction directly ───────────────────────────────────
    console.log(`\n  ── Raw LatticeReconstructor (eps=5) ──`);
    const recon = new LatticeReconstructor(segments, { eps: 5, scale, textMeta, pageHeight: viewport.height });
    const allLattices = recon.reconstructAll();
    if (!allLattices.length) {
        console.log(`  no lattices found  (hSegs=${hSegs.length} vSegs=${vSegs.length})`);
        // Show why: segment lengths
        const hLens = hSegs.map(s => Math.round(Math.abs(s.x2-s.x1))).sort((a,b)=>b-a);
        const vLens = vSegs.map(s => Math.round(Math.abs(s.y2-s.y1))).sort((a,b)=>b-a);
        if (hLens.length) console.log(`    hSeg lengths (top 10): ${hLens.slice(0,10).join(', ')}`);
        if (vLens.length) console.log(`    vSeg lengths (top 10): ${vLens.slice(0,10).join(', ')}`);
    } else {
        allLattices.forEach((l, i) => {
            const rr = l?.rows?.length ?? '?';
            const cc = l?.cols?.length ?? '?';
            const d  = l ? (l.rows?.length * l.cols?.length > 0
                ? (l.intersections?.length / (l.rows.length * l.cols.length)).toFixed(2)
                : '?') : '?';
            const isSingleCol = (l?.cols?.length ?? 0) <= 2;
            console.log(`  lattice[${i}]  ${rr}r × ${cc}c  density≈${d}  singleCol=${isSingleCol}  bbox=(${Math.round(l?.bbox?.x)},${Math.round(l?.bbox?.y)} ${Math.round(l?.bbox?.w)}×${Math.round(l?.bbox?.h)})`);
        });
    }

    // ── Raw stream detection directly ──────────────────────────────────────────
    console.log(`\n  ── Raw StreamDetector (unclaimed) ──`);
    const allUnclaimedMeta = textMeta.filter(tm => tm.str.trim());
    const streamDirect = detectStreamTables(allUnclaimedMeta, scale, regions, segments);
    if (!streamDirect.length) {
        console.log(`  no stream tables found`);

        // Diagnose: show band count and column anchor count
        const sorted = [...allUnclaimedMeta.filter(i=>i.str.trim())].sort((a,b) => a.vy - b.vy);
        const bands = [];
        for (const tm of sorted) {
            let b = bands.find(b => Math.abs(b.y - tm.vy) <= scale.yBandTolPx);
            if (b) { const n = b.items.length; b.y=(b.y*n+tm.vy)/(n+1); b.items.push(tm); }
            else bands.push({ y: tm.vy, items: [tm] });
        }
        console.log(`  bands=${bands.length}  S=${scale.S.toFixed(1)}  streamGap=${scale.streamGapPx.toFixed(1)}`);

        // Show band X distribution
        bands.slice(0, 15).forEach((b, i) => {
            const xs = b.items.map(tm => Math.round(tm.vx)).sort((a,b)=>a-b);
            const gap = i < bands.length-1 ? Math.round(bands[Math.min(i+1, bands.length-1)].y - b.y) : 0;
            console.log(`    band[${i.toString().padStart(2)}] y=${Math.round(b.y).toString().padStart(4)}  n=${b.items.length}  gap→next=${gap}px  xs=[${xs.slice(0,6).join(',')}${xs.length>6?'…':''}]`);
        });
        if (bands.length > 15) console.log(`    ... ${bands.length-15} more bands`);
    } else {
        streamDirect.forEach((l, i) => {
            console.log(`  stream[${i}] conf=${l.confidence?.toFixed(2)}  rows=${l.rows?.length} cols=${l.cols?.length}`);
        });
    }

    // ── Assemble HTML ─────────────────────────────────────────────────────────
    const extractedImages = {};
    const result = assemblePage(
        regions, textMeta, textContent.items,
        viewport, pageWidthPt, p,
        fontRegistry, columnSplits, extractedImages,
    );
    if (result.html) htmlParts.push(result.html);

    page.cleanup();
    console.log('');
}

// Write output
const styles   = generateDocumentStyles(fontRegistry);
const fullHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>SEC Filing Pages ${START_PAGE}-${END_PAGE}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-size: 14px; line-height: 1.5; padding: 24px; max-width: 1000px; margin: 0 auto; }
.pdf-page-content { border: 1px solid #ddd; padding: 16px; margin-bottom: 24px; border-radius: 4px; }
.page-label { font-size: 11px; color: #888; margin-bottom: 10px; }
h3, h4 { margin: 10px 0 4px; }
${styles}
</style>
</head>
<body>
${htmlParts.join('\n')}
</body>
</html>`;

const outFile = path.join(OUTDIR, 'sec-filing.html');
writeFileSync(outFile, fullHtml, 'utf8');
console.log(`\n✓ wrote ${outFile}`);
