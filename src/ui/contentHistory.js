/**
 * contentHistory.js
 * Ported from table-formatter/src/js/components/tableHistory.js.
 * Adapted: ES module, no jQuery UI coupling, no window globals.
 *
 * Covers structural DOM mutations that bypass contentEditable's native
 * undo stack (zone reorder/split/group, insert-box, add-page).
 * Typing / bold / italic / alignment use the browser's own Ctrl+Z.
 */
export class ContentHistory {
    constructor(maxHistory = 50) {
        this._stack        = [];
        this._index        = -1;
        this._maxHistory   = maxHistory;
        this._isRestoring  = false;
    }

    /** Save an innerHTML snapshot. No-op if restoring or unchanged. */
    push(snapshot) {
        if (this._isRestoring) return;
        if (!snapshot || snapshot.trim() === '') return;
        if (this._index >= 0 && this._stack[this._index] === snapshot) return;

        // Discard redo tail
        this._stack = this._stack.slice(0, this._index + 1);
        this._stack.push(snapshot);

        if (this._stack.length > this._maxHistory) {
            this._stack.shift();
        } else {
            this._index++;
        }
    }

    /** Return the previous snapshot or null if at the beginning. */
    undo() {
        if (!this.canUndo()) return null;
        this._index--;
        return this._stack[this._index];
    }

    /** Return the next snapshot or null if at the end. */
    redo() {
        if (!this.canRedo()) return null;
        this._index++;
        return this._stack[this._index];
    }

    canUndo()  { return this._index > 0; }
    canRedo()  { return this._index < this._stack.length - 1; }

    /** Reset on new PDF load. */
    clear() {
        this._stack  = [];
        this._index  = -1;
    }

    get isRestoring() { return this._isRestoring; }
    set isRestoring(v) { this._isRestoring = v; }
}
