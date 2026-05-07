// analyzePanel.js
// Analyze tab — renders PDF metadata, per-page geometry canvas, and structure stats.
//
// Canvas legend:
//   Blue   — horizontal path segments
//   Green  — vertical path segments
//   Gray   — diagonal / other paths
//   Orange — closed rectangle candidates (potential table frames)
//   Red    — image / bitmap regions
//   Yellow — text item baseline positions

import { analyzePDF } from '../extraction/vector/pdfAnalyzer.js';

let _analysis = null;
let _currentPage = 0;

// ── Entry point ───────────────────────────────────────────────────────────────

export function initAnalyzePanel() {
    document.getElementById('analyze-page-prev')?.addEventListener('click', () => {
        if (!_analysis || _currentPage <= 0) return;
        _currentPage--;
        _renderPage(_currentPage);
    });
    document.getElementById('analyze-page-next')?.addEventListener('click', () => {
        if (!_analysis || _currentPage >= _analysis.pages.length - 1) return;
        _currentPage++;
        _renderPage(_currentPage);
    });
}

/**
 * Run analysis on a PDF file and populate the Analyze tab.
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
export async function runAnalysis(bytes, filename) {
    const panel = document.getElementById('view-analyze');
    if (!panel) return;

    _setStatus(panel, `Analyzing ${filename}…`);

    try {
        _analysis = await analyzePDF(bytes, (p, total) => {
            _setStatus(panel, `Analyzing page ${p} / ${total}…`);
        });
        _currentPage = 0;
        _renderMetadata(_analysis.metadata, filename);
        _renderPage(0);
    } catch (err) {
        _setStatus(panel, `Analysis error: ${err.message}`);
    }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

function _renderMetadata(m, filename) {
    const el = document.getElementById('analyze-meta');
    if (!el) return;

    const field = (label, val) => val
        ? `<span class="ameta-field"><span class="ameta-key">${label}</span><span class="ameta-val">${_esc(val)}</span></span>`
        : '';

    el.innerHTML = `
        <div class="ameta-row">
            ${field('File', filename)}
            ${field('PDF', 'v' + m.pdfVersion)}
            ${field('Size', m.fileSize)}
            ${field('Pages', m.numPages)}
        </div>
        <div class="ameta-row">
            ${field('Title', m.title)}
            ${field('Author', m.author)}
            ${field('Creator', m.creator)}
            ${field('Producer', m.producer)}
        </div>
        ${m.created ? `<div class="ameta-row">${field('Created', m.created)}${field('Modified', m.modified)}</div>` : ''}
    `;
}

// ── Page render ───────────────────────────────────────────────────────────────

function _renderPage(idx) {
    if (!_analysis?.pages?.length) return;
    const pg = _analysis.pages[idx];

    _renderStats(pg);
    _renderCanvas(pg);
    _updatePageNav(idx, _analysis.pages.length);
}

function _renderStats(pg) {
    const el = document.getElementById('analyze-stats');
    if (!el) return;

    const row = (label, val, color) =>
        `<tr><td class="astat-key">${label}</td><td class="astat-val" style="color:${color || 'inherit'}">${val}</td></tr>`;

    el.innerHTML = `
        <table class="astat-table">
            <tbody>
                ${row('Page size', `${pg.widthPt}×${pg.heightPt} pt (${pg.widthIn}"×${pg.heightIn}")`)}
                ${row('Viewport', `${Math.round(pg.widthPx)}×${Math.round(pg.heightPx)} px`)}
                ${row('Text items', pg.textItemCount, '#eab308')}
                ${row('H segments', pg.hSegCount, '#3b82f6')}
                ${row('V segments', pg.vSegCount, '#10b981')}
                ${row('Diagonal segs', pg.diagSegCount, '#9ca3af')}
                ${row('Closed rects', pg.closedRectCount, '#f97316')}
                ${row('Image regions', pg.imageCount, '#ef4444')}
            </tbody>
        </table>
    `;
}

function _renderCanvas(pg) {
    const canvas = document.getElementById('analyze-canvas');
    if (!canvas) return;

    // Scale to fit panel width (max 540px)
    const maxW = Math.min(540, canvas.parentElement?.clientWidth || 540);
    const scale = maxW / pg.widthPx;
    canvas.width  = Math.round(pg.widthPx  * scale);
    canvas.height = Math.round(pg.heightPx * scale);

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Page border
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    const tx = x => x * scale;
    const ty = y => y * scale;

    // ── Image regions (red, behind everything) ─────────────────────────────
    ctx.fillStyle = 'rgba(239,68,68,0.15)';
    ctx.strokeStyle = 'rgba(239,68,68,0.7)';
    ctx.lineWidth = 1.5;
    for (const r of pg.imageRegions) {
        ctx.fillRect(tx(r.x), ty(r.y), tx(r.w), ty(r.h));
        ctx.strokeRect(tx(r.x), ty(r.y), tx(r.w), ty(r.h));
    }

    // ── Closed rect candidates (orange fill) ───────────────────────────────
    ctx.fillStyle = 'rgba(249,115,22,0.08)';
    ctx.strokeStyle = 'rgba(249,115,22,0.75)';
    ctx.lineWidth = 1;
    for (const r of pg.closedRects) {
        ctx.fillRect(tx(r.x), ty(r.y), tx(r.w), ty(r.h));
        ctx.strokeRect(tx(r.x), ty(r.y), tx(r.w), ty(r.h));
    }

    // ── Diagonal segments (gray) ───────────────────────────────────────────
    ctx.strokeStyle = 'rgba(107,114,128,0.3)';
    ctx.lineWidth = 0.5;
    for (const s of pg.diagSegs) {
        ctx.beginPath();
        ctx.moveTo(tx(s.x1), ty(s.y1));
        ctx.lineTo(tx(s.x2), ty(s.y2));
        ctx.stroke();
    }

    // ── Horizontal segments (blue) ─────────────────────────────────────────
    ctx.strokeStyle = 'rgba(59,130,246,0.75)';
    ctx.lineWidth = 1;
    for (const s of pg.hSegs) {
        ctx.beginPath();
        ctx.moveTo(tx(s.x1), ty(s.y1));
        ctx.lineTo(tx(s.x2), ty(s.y2));
        ctx.stroke();
    }

    // ── Vertical segments (green) ──────────────────────────────────────────
    ctx.strokeStyle = 'rgba(16,185,129,0.75)';
    ctx.lineWidth = 1;
    for (const s of pg.vSegs) {
        ctx.beginPath();
        ctx.moveTo(tx(s.x1), ty(s.y1));
        ctx.lineTo(tx(s.x2), ty(s.y2));
        ctx.stroke();
    }

    // ── Text item baselines (yellow dots) ──────────────────────────────────
    ctx.fillStyle = 'rgba(234,179,8,0.55)';
    const vpT = pg.viewport.transform;
    for (const item of pg.textItems) {
        if (!item.str?.trim()) continue;
        // Use viewport.transform directly for consistency with ctmAdapter coordinates
        const pdfX = item.transform[4], pdfY = item.transform[5];
        const sx = vpT[0] * pdfX + vpT[2] * pdfY + vpT[4];
        const sy = vpT[1] * pdfX + vpT[3] * pdfY + vpT[5];
        ctx.beginPath();
        ctx.arc(tx(sx), ty(sy), 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function _updatePageNav(idx, total) {
    const counter = document.getElementById('analyze-page-counter');
    if (counter) counter.textContent = `Page ${idx + 1} of ${total}`;
    const prev = document.getElementById('analyze-page-prev');
    const next = document.getElementById('analyze-page-next');
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === total - 1;
}

function _setStatus(panel, msg) {
    const el = document.getElementById('analyze-status');
    if (el) el.textContent = msg;
}

function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
