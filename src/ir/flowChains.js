/**
 * flowChains.js
 * Reading-order helpers shared by the GxDoc importer (htmlToGxDoc.js) and the
 * app's semantic exporters. Engine-side so the IR never imports from the UI.
 */

// ── Flow-chain merge (reading-order rejoin) ───────────────────────────────────
//
// The assembler links paragraphs that continue across column/zone seams: the
// FIRST <p> of a continuation region carries data-flow-prev + data-continuation,
// and the head <p> carries data-flow-next (see flowLinker.js / pageAssembler.js).
// The spatial HTML keeps every fragment in its own column, but the semantic
// exports (Markdown/XML) must present one continuous paragraph. This pre-pass
// walks each chain head-first and folds every continuation <p> into the head,
// mirroring the assembler's _joinFlowText join semantics, then removes the
// now-empty continuation <p> so the recursive emitter never sees it.

// Trailing hyphen forms the dehyphenate join strips: ASCII, unicode, soft.
const FLOW_HYPHEN_END_RE = /[-‐‑­]\s*$/;

/** Deepest last non-empty text node in an element (for seam joining). */
function _lastTextNode(el) {
    for (let i = el.childNodes.length - 1; i >= 0; i--) {
        const n = el.childNodes[i];
        if (n.nodeType === Node.TEXT_NODE) {
            if (n.textContent && n.textContent.trim()) return n;
        } else if (n.nodeType === Node.ELEMENT_NODE) {
            const found = _lastTextNode(n);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Fold continuation <p> `cont` into head <p> `head`, honoring the join kind
 * (mirrors pageAssembler._joinFlowText): 'dehyphenate' strips the trailing
 * hyphen and butts the words together, 'hyphen-keep' butts with the hyphen
 * intact, 'space' (default) inserts a single separating space. Inline markup
 * (bold/italic spans) is preserved by moving nodes rather than text.
 */
function _absorbFlow(head, cont, join, doc) {
    const last = _lastTextNode(head);
    if (join === 'dehyphenate') {
        if (last) last.textContent = last.textContent.replace(FLOW_HYPHEN_END_RE, '');
    } else if (join === 'hyphen-keep') {
        if (last) last.textContent = last.textContent.replace(/\s+$/, '');
    } else {
        if (last) last.textContent = last.textContent.replace(/\s+$/, '');
        head.appendChild(doc.createTextNode(' '));
    }
    let first = true;
    while (cont.firstChild) {
        const child = cont.firstChild;
        if (first && child.nodeType === Node.TEXT_NODE) {
            child.textContent = child.textContent.replace(/^\s+/, '');
        }
        head.appendChild(child);
        first = false;
    }
}

/** Merge all paragraph flow chains in-place, removing absorbed continuations. */
export function mergeFlowChains(doc) {
    const byId = new Map();
    doc.querySelectorAll('[id]').forEach(el => byId.set(el.getAttribute('id'), el));

    // Chain heads: have a next link but no continuation link that resolves in
    // this document (a true head, not a mid-chain node).
    const heads = [...doc.querySelectorAll('[data-flow-next]')].filter(el => {
        const prev = el.getAttribute('data-flow-prev');
        return !prev || !byId.has(prev);
    });

    for (const head of heads) {
        const seen = new Set([head]);
        let nextId = head.getAttribute('data-flow-next');
        while (nextId) {
            const cont = byId.get(nextId);
            if (!cont || seen.has(cont)) break; // dangling ref or cycle guard
            seen.add(cont);
            const following = cont.getAttribute('data-flow-next'); // read before removal
            const join = cont.getAttribute('data-flow-join') || 'space';
            _absorbFlow(head, cont, join, doc);
            cont.remove();
            nextId = following;
        }
        head.removeAttribute('data-flow-next');
        head.removeAttribute('data-flow-prev');
        head.removeAttribute('data-flow-join');
        head.removeAttribute('data-continuation');
    }
}

// Structural wrappers the semantic exporters descend through — reading order is
// child order within each (page-row → col → zone → region → figure), so a plain
// depth-first walk over children yields blocks in reading order.
//
// `pdf-figure` is the <figure> a picture gets once _mergeFigureCaptions has
// paired it with its caption. Leaving it out stopped the walk ON the figure,
// so the whole thing — image and caption — collapsed into one paragraph.
// `pdf-box-block` is one classified child of a callout — a heading, list,
// paragraph or nested table the box-interior pass recovered. It is a wrapper
// that carries the child's address, never a leaf: stopping on it would emit the
// whole child as prose, which is the flattening the interior pass removed.
export const FLOW_WRAPPER_RE = /\bpdf-(page-row|col|zone|region|figure|box-block)\b/;

// A picture leaf. `pdf-image-stack` is the wrapper a picture gets when the
// classifier recovered its own labels (callouts, axis ticks) and positioned
// them over the crop as `.pdf-image-textlayer`. It is NOT a flow wrapper — the
// walkers stop on it — so matching only `pdf-image-placeholder` sent every
// labelled figure down the paragraph branch, which emitted the label glyphs as
// prose and dropped the image entirely.
export const IMAGE_BLOCK_RE = /\bpdf-image-(placeholder|stack)\b/;
