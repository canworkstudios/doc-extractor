// src/extraction/emitters/json.js
// Stage 3c: AST → JSON string

/**
 * Emit an AST as pretty-printed JSON.
 * @param {{ type: 'document', children: Array }} ast
 * @returns {string}
 */
export function emitJSON(ast) {
    return JSON.stringify(ast, null, 2);
}
