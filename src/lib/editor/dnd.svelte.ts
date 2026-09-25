import type { Attachment } from 'svelte/attachments';
import type { EditorContext } from './context.svelte.js';
import type { DropTarget } from '../shared/drop.js';

// Drag & drop built on Svelte 5 attachments ({@attach …}) and native
// HTML5 drag events. A single module-level runes store tracks the active
// drag so drop zones can render highlights reactively. The positional
// math lives in shared/drop.ts (framework-agnostic).

export type DragPayload =
  | { kind: 'new'; componentType: string }
  | { kind: 'block'; blockId: string }
  | { kind: 'asset'; assetId: string }
  | { kind: 'symbol'; symbolId: string }
  | { kind: 'move'; nodeId: string };

export type { DropTarget };

class DragState {
  active: DragPayload | null = $state(null);
  /** Drop target currently hovered, for indicator rendering. */
  over: DropTarget | null = $state(null);

  get isDragging(): boolean {
    return this.active !== null;
  }
}

export const dragState = new DragState();

const MIME = 'application/x-exemplara';

/** Attachment: makes an element a drag source for a payload. */
export function draggable(payload: () => DragPayload): Attachment<HTMLElement> {
  return (element) => {
    element.draggable = true;

    const onDragStart = (event: DragEvent) => {
      const data = payload();
      dragState.active = data;
      event.dataTransfer?.setData(MIME, JSON.stringify(data));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = data.kind === 'move' ? 'move' : 'copy';
      event.stopPropagation();
    };
    const onDragEnd = () => {
      dragState.active = null;
      dragState.over = null;
    };

    element.addEventListener('dragstart', onDragStart);
    element.addEventListener('dragend', onDragEnd);
    return () => {
      element.removeEventListener('dragstart', onDragStart);
      element.removeEventListener('dragend', onDragEnd);
    };
  };
}

export interface DropZoneOptions {
  editor: EditorContext;
  /** Resolve the insertion point for the current drag over this element. */
  target: (event: DragEvent) => DropTarget | null;
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  return !!a && !!b && a.parentId === b.parentId && a.index === b.index && a.slot === b.slot;
}

/** Apply one drag payload to a resolved canvas insertion point. */
export function applyDragPayload(
  editor: EditorContext,
  payload: DragPayload,
  target: DropTarget,
): void {
  switch (payload.kind) {
    case 'new':
      editor.addComponent(payload.componentType, target.parentId, target.index, target.slot);
      return;
    case 'block':
      editor.addBlock(payload.blockId, target.parentId, target.index, target.slot);
      return;
    case 'asset':
      editor.insertAssetImage(payload.assetId, target.parentId, target.index, target.slot);
      return;
    case 'symbol':
      editor.insertSymbolInstance(payload.symbolId, target.parentId, target.index, target.slot);
      return;
    case 'move':
      editor.moveNode(payload.nodeId, target.parentId, target.index, target.slot);
  }
}

/** Attachment: makes an element accept palette items and moved nodes. */
export function dropzone(options: () => DropZoneOptions): Attachment<HTMLElement> {
  return (element) => {
    const onDragOver = (event: DragEvent) => {
      const { target } = options();
      const resolved = target(event);
      if (!resolved || !dragState.active) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = dragState.active.kind === 'move' ? 'move' : 'copy';
      }
      if (!sameTarget(dragState.over, resolved)) dragState.over = resolved;
    };

    const onDragLeave = (event: DragEvent) => {
      // Only clear when truly leaving this element (not entering a child).
      if (event.currentTarget === event.target && !element.contains(event.relatedTarget as Node)) {
        dragState.over = null;
      }
    };

    const onDrop = (event: DragEvent) => {
      const { editor, target } = options();
      const resolved = target(event);
      const payload =
        dragState.active ??
        (JSON.parse(event.dataTransfer?.getData(MIME) || 'null') as DragPayload | null);
      dragState.over = null;
      dragState.active = null;
      if (!resolved || !payload) return;
      event.preventDefault();
      event.stopPropagation();

      try {
        applyDragPayload(editor, payload, resolved);
      } catch (error) {
        // Invalid drops (e.g. moving a container into itself) are ignored.
        console.warn('[exemplara] drop rejected:', error);
      }
    };

    element.addEventListener('dragover', onDragOver);
    element.addEventListener('dragleave', onDragLeave);
    element.addEventListener('drop', onDrop);
    return () => {
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', onDragLeave);
      element.removeEventListener('drop', onDrop);
    };
  };
}
