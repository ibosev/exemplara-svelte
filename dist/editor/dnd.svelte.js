import { fromStore } from "svelte/store";
import { createDragStore, } from "exemplara-core/editor/drag";
import { getEditorContext } from "./context.svelte.js";
const legacyStore = createDragStore();
const legacyView = fromStore(legacyStore);
/** @deprecated Use editor.drag and editor.session.setDrag for isolated editors. */
export const dragState = {
    get active() {
        return legacyView.current.active;
    },
    set active(active) {
        legacyStore.set({ ...legacyStore.get(), active });
    },
    get over() {
        return legacyView.current.over;
    },
    set over(over) {
        legacyStore.set({ ...legacyStore.get(), over });
    },
    get isDragging() {
        return legacyView.current.active !== null;
    },
};
const MIME = "application/x-exemplara";
/** Native HTML5 event adapter; the editor session owns the drag state. */
export function draggable(payload, owner) {
    // Retain one-argument use in existing Svelte components during initialization.
    let editor = owner;
    if (!editor) {
        try {
            editor = getEditorContext();
        }
        catch {
            /* standalone compatibility attachment */
        }
    }
    return (element) => {
        element.draggable = true;
        const onStart = (event) => {
            const data = payload();
            if (editor)
                editor.session.setDrag(data);
            else
                dragState.active = data;
            event.dataTransfer?.setData(MIME, JSON.stringify(data));
            if (event.dataTransfer)
                event.dataTransfer.effectAllowed =
                    data.kind === "move" ? "move" : "copy";
            event.stopPropagation();
        };
        const onEnd = () => {
            if (editor && !editor.session.destroyed)
                editor.session.setDrag(null);
            else if (!editor) {
                dragState.active = null;
                dragState.over = null;
            }
        };
        element.addEventListener("dragstart", onStart);
        element.addEventListener("dragend", onEnd);
        return () => {
            element.removeEventListener("dragstart", onStart);
            element.removeEventListener("dragend", onEnd);
            onEnd();
        };
    };
}
function sameTarget(a, b) {
    return (!!a &&
        !!b &&
        a.parentId === b.parentId &&
        a.index === b.index &&
        a.slot === b.slot);
}
export function applyDragPayload(editor, payload, target) {
    editor.session
        ? editor.session.applyDragPayload(payload, target)
        : applyLegacyPayload(editor, payload, target);
}
// Preserve the exported helper's structural compatibility with existing host controllers.
function applyLegacyPayload(editor, payload, target) {
    switch (payload.kind) {
        case "new":
            editor.addComponent(payload.componentType, target.parentId, target.index, target.slot);
            break;
        case "block":
            editor.addBlock(payload.blockId, target.parentId, target.index, target.slot);
            break;
        case "asset":
            editor.insertAssetImage(payload.assetId, target.parentId, target.index, target.slot);
            break;
        case "symbol":
            editor.insertSymbolInstance(payload.symbolId, target.parentId, target.index, target.slot);
            break;
        case "move":
            editor.moveNode(payload.nodeId, target.parentId, target.index, target.slot);
            break;
    }
}
export function dropzone(options) {
    return (element) => {
        const onOver = (event) => {
            const { editor, target } = options();
            const resolved = target(event), active = editor.drag.active;
            if (!resolved || !active)
                return;
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer)
                event.dataTransfer.dropEffect =
                    active.kind === "move" ? "move" : "copy";
            if (!sameTarget(editor.drag.over, resolved))
                editor.session.setDrag(active, resolved);
        };
        const onLeave = (event) => {
            if (event.currentTarget === event.target &&
                !element.contains(event.relatedTarget)) {
                const { editor } = options();
                editor.session.setDrag(editor.drag.active);
            }
        };
        const onDrop = (event) => {
            const { editor, target } = options();
            const resolved = target(event), payload = editor.drag.active;
            // Only a drag started by this session may mutate its document.
            editor.session.setDrag(null);
            if (!resolved || !payload)
                return;
            event.preventDefault();
            event.stopPropagation();
            try {
                editor.session.applyDragPayload(payload, resolved);
            }
            catch (error) {
                console.warn("[exemplara] drop rejected:", error);
            }
        };
        element.addEventListener("dragover", onOver);
        element.addEventListener("dragleave", onLeave);
        element.addEventListener("drop", onDrop);
        return () => {
            element.removeEventListener("dragover", onOver);
            element.removeEventListener("dragleave", onLeave);
            element.removeEventListener("drop", onDrop);
        };
    };
}
