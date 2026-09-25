class DragState {
    active = $state(null);
    /** Drop target currently hovered, for indicator rendering. */
    over = $state(null);
    get isDragging() {
        return this.active !== null;
    }
}
export const dragState = new DragState();
const MIME = 'application/x-exemplara';
/** Attachment: makes an element a drag source for a payload. */
export function draggable(payload) {
    return (element) => {
        element.draggable = true;
        const onDragStart = (event) => {
            const data = payload();
            dragState.active = data;
            event.dataTransfer?.setData(MIME, JSON.stringify(data));
            if (event.dataTransfer)
                event.dataTransfer.effectAllowed = data.kind === 'move' ? 'move' : 'copy';
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
function sameTarget(a, b) {
    return !!a && !!b && a.parentId === b.parentId && a.index === b.index && a.slot === b.slot;
}
/** Apply one drag payload to a resolved canvas insertion point. */
export function applyDragPayload(editor, payload, target) {
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
export function dropzone(options) {
    return (element) => {
        const onDragOver = (event) => {
            const { target } = options();
            const resolved = target(event);
            if (!resolved || !dragState.active)
                return;
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = dragState.active.kind === 'move' ? 'move' : 'copy';
            }
            if (!sameTarget(dragState.over, resolved))
                dragState.over = resolved;
        };
        const onDragLeave = (event) => {
            // Only clear when truly leaving this element (not entering a child).
            if (event.currentTarget === event.target && !element.contains(event.relatedTarget)) {
                dragState.over = null;
            }
        };
        const onDrop = (event) => {
            const { editor, target } = options();
            const resolved = target(event);
            const payload = dragState.active ??
                JSON.parse(event.dataTransfer?.getData(MIME) || 'null');
            dragState.over = null;
            dragState.active = null;
            if (!resolved || !payload)
                return;
            event.preventDefault();
            event.stopPropagation();
            try {
                applyDragPayload(editor, payload, resolved);
            }
            catch (error) {
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
