import { applyCommand, type Command } from './commands.js';
import { createDocument } from './create.js';
import type { ExemplaraDocument } from './types.js';

export interface DocumentEngineOptions {
  document?: ExemplaraDocument;
  /** Maximum undo depth (default 100). */
  historyLimit?: number;
}

export interface DocumentEngineState {
  document: ExemplaraDocument;
  revision: number;
  canUndo: boolean;
  canRedo: boolean;
}

export type DocumentEngineListener = (state: DocumentEngineState) => void;

/**
 * The document model is deliberately JSON-serializable. A JSON round-trip
 * also detaches framework proxies (for example Svelte $state) that cannot be
 * passed to structuredClone and must never become engine-owned state.
 */
function detachDocument(document: ExemplaraDocument): ExemplaraDocument {
  return JSON.parse(JSON.stringify(document)) as ExemplaraDocument;
}

/**
 * Framework-independent command engine with snapshot undo/redo history.
 *
 * The engine intentionally has no UI-framework or DOM dependency.
 * UI packages can bridge `subscribe()` into their native reactive primitive
 * while sharing identical mutation, transaction, and history semantics.
 */
export class DocumentEngine {
  doc: ExemplaraDocument;
  revision = 0;

  readonly #undoStack: ExemplaraDocument[] = [];
  readonly #redoStack: ExemplaraDocument[] = [];
  readonly #listeners = new Set<DocumentEngineListener>();
  readonly #historyLimit: number;

  constructor(options: DocumentEngineOptions = {}) {
    this.doc = detachDocument(options.document ?? createDocument());
    this.#historyLimit = Math.max(0, options.historyLimit ?? 100);
  }

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Plain, detached deep snapshot of the current document. */
  snapshot(): ExemplaraDocument {
    return structuredClone(this.doc);
  }

  /**
   * Observe successful document/history changes. The current state is emitted
   * immediately by default, which makes store adapters deterministic.
   */
  subscribe(listener: DocumentEngineListener, emitCurrent = true): () => void {
    this.#listeners.add(listener);
    if (emitCurrent) listener(this.state());
    return () => this.#listeners.delete(listener);
  }

  state(): DocumentEngineState {
    return {
      document: this.doc,
      revision: this.revision,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    };
  }

  #emit(): void {
    const state = this.state();
    for (const listener of this.#listeners) listener(state);
  }

  #recordHistory(document: ExemplaraDocument): void {
    if (this.#historyLimit === 0) return;
    this.#undoStack.push(document);
    if (this.#undoStack.length > this.#historyLimit) this.#undoStack.shift();
  }

  #commit(run: (document: ExemplaraDocument) => void): void {
    const before = this.snapshot();
    const next = structuredClone(this.doc);
    try {
      run(next);
    } catch (error) {
      throw error;
    }
    this.doc = next;
    this.#recordHistory(before);
    this.#redoStack.length = 0;
    this.revision += 1;
    this.#emit();
  }

  /** Execute a single command as one undoable step. */
  execute(command: Command): void {
    this.#commit((document) => applyCommand(document, command));
  }

  /** Execute several commands atomically as one undoable step. */
  batch(commands: Command[]): void {
    if (commands.length === 0) return;
    this.#commit((document) => {
      for (const command of commands) applyCommand(document, command);
    });
  }

  undo(): boolean {
    const previous = this.#undoStack.pop();
    if (!previous) return false;
    this.#redoStack.push(this.snapshot());
    this.doc = previous;
    this.revision += 1;
    this.#emit();
    return true;
  }

  redo(): boolean {
    const next = this.#redoStack.pop();
    if (!next) return false;
    this.#undoStack.push(this.snapshot());
    this.doc = next;
    this.revision += 1;
    this.#emit();
    return true;
  }

  /** Replace the document and clear history (for example after loading a file). */
  load(document: ExemplaraDocument): void {
    this.doc = detachDocument(document);
    this.#undoStack.length = 0;
    this.#redoStack.length = 0;
    this.revision += 1;
    this.#emit();
  }
}
