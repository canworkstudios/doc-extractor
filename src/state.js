/**
 * state.js
 * Shared application state using jQuery paradigm where possible.
 */

export const state = {
    pdf1: { file: null, doc: null, bytes: null, extractedHTML: '', extractedText: '' },
    pdf2: { file: null, doc: null, bytes: null, extractedHTML: '', extractedText: '' },
    activeView: 'pdf',
    monacoEditor: null,   // monaco.editor instance (HTML editor)
    
    // Compare Diff sub-settings
    diffLayout: 'split',      // 'split' | 'unified'
    diffPrecision: 'word',    // 'word' | 'char'
    diffActiveView: 'rich-text' // 'rich-text' | 'plain-text'
};
