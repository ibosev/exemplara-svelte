import { applyCommand } from './commands.js';
import { createDocument } from './create.js';
/**
 * The document model is deliberately JSON-serializable. A JSON round-trip
 * also detaches framework proxies (for example Svelte $state) that cannot be
 * passed to structuredClone and must never become engine-owned state.
 */
function detachDocument(document) {
    return JSON.parse(JSON.stringify(document));
}
/**
 * Framework-independent command engine with snapshot undo/redo history.
 *
 * The engine intentionally has no UI-framework or DOM dependency.
 * UI packages can bridge `subscribe()` into their native reactive primitive
 * while sharing identical mutation, transaction, and history semantics.
 */
export class DocumentEngine {
    doc;
    revision = 0;
    #undoStack = [];
    #redoStack = [];
    #listeners = new Set();
    #historyLimit;
    constructor(options = {}) {
        this.doc = detachDocument(options.document ?? createDocument());
        this.#historyLimit = Math.max(0, options.historyLimit ?? 100);
    }
    get canUndo() {
        return this.#undoStack.length > 0;
    }
    get canRedo() {
        return this.#redoStack.length > 0;
    }
    /** Plain, detached deep snapshot of the current document. */
    snapshot() {
        return structuredClone(this.doc);
    }
    /**
     * Observe successful document/history changes. The current state is emitted
     * immediately by default, which makes store adapters deterministic.
     */
    subscribe(listener, emitCurrent = true) {
        this.#listeners.add(listener);
        if (emitCurrent)
            listener(this.state());
        return () => this.#listeners.delete(listener);
    }
    state() {
        return {
            document: this.doc,
            revision: this.revision,
            canUndo: this.canUndo,
            canRedo: this.canRedo,
        };
    }
    #emit() {
        const state = this.state();
        for (const listener of this.#listeners)
            listener(state);
    }
    #recordHistory(document) {
        if (this.#historyLimit === 0)
            return;
        this.#undoStack.push(document);
        if (this.#undoStack.length > this.#historyLimit)
            this.#undoStack.shift();
    }
    #commit(run) {
        const before = this.snapshot();
        const next = structuredClone(this.doc);
        try {
            run(next);
        }
        catch (error) {
            throw error;
        }
        this.doc = next;
        this.#recordHistory(before);
        this.#redoStack.length = 0;
        this.revision += 1;
        this.#emit();
    }
    /** Execute a single command as one undoable step. */
    execute(command) {
        this.#commit((document) => applyCommand(document, command));
    }
    /** Execute several commands atomically as one undoable step. */
    batch(commands) {
        if (commands.length === 0)
            return;
        this.#commit((document) => {
            for (const command of commands)
                applyCommand(document, command);
        });
    }
    undo() {
        const previous = this.#undoStack.pop();
        if (!previous)
            return false;
        this.#redoStack.push(this.snapshot());
        this.doc = previous;
        this.revision += 1;
        this.#emit();
        return true;
    }
    redo() {
        const next = this.#redoStack.pop();
        if (!next)
            return false;
        this.#undoStack.push(this.snapshot());
        this.doc = next;
        this.revision += 1;
        this.#emit();
        return true;
    }
    /** Replace the document and clear history (for example after loading a file). */
    load(document) {
        this.doc = detachDocument(document);
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
        this.revision += 1;
        this.#emit();
    }
}
