import type { Attachment } from "svelte/attachments";
import { type DragPayload, type DropTarget } from "exemplara-core/editor/drag";
import { type EditorContext } from "./context.svelte.js";
export type { DragPayload, DropTarget } from "exemplara-core/editor/drag";
/** @deprecated Use editor.drag and editor.session.setDrag for isolated editors. */
export declare const dragState: {
    active: DragPayload | null;
    over: DropTarget | null;
    readonly isDragging: boolean;
};
/** Native HTML5 event adapter; the editor session owns the drag state. */
export declare function draggable(payload: () => DragPayload, owner?: EditorContext): Attachment<HTMLElement>;
export interface DropZoneOptions {
    editor: EditorContext;
    target: (event: DragEvent) => DropTarget | null;
}
export declare function applyDragPayload(editor: EditorContext, payload: DragPayload, target: DropTarget): void;
export declare function dropzone(options: () => DropZoneOptions): Attachment<HTMLElement>;
