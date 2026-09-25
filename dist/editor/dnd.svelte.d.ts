import type { Attachment } from 'svelte/attachments';
import type { EditorContext } from './context.svelte.js';
import type { DropTarget } from '../shared/drop.js';
export type DragPayload = {
    kind: 'new';
    componentType: string;
} | {
    kind: 'block';
    blockId: string;
} | {
    kind: 'asset';
    assetId: string;
} | {
    kind: 'symbol';
    symbolId: string;
} | {
    kind: 'move';
    nodeId: string;
};
export type { DropTarget };
declare class DragState {
    active: DragPayload | null;
    /** Drop target currently hovered, for indicator rendering. */
    over: DropTarget | null;
    get isDragging(): boolean;
}
export declare const dragState: DragState;
/** Attachment: makes an element a drag source for a payload. */
export declare function draggable(payload: () => DragPayload): Attachment<HTMLElement>;
export interface DropZoneOptions {
    editor: EditorContext;
    /** Resolve the insertion point for the current drag over this element. */
    target: (event: DragEvent) => DropTarget | null;
}
/** Apply one drag payload to a resolved canvas insertion point. */
export declare function applyDragPayload(editor: EditorContext, payload: DragPayload, target: DropTarget): void;
/** Attachment: makes an element accept palette items and moved nodes. */
export declare function dropzone(options: () => DropZoneOptions): Attachment<HTMLElement>;
