import type { ComponentNode } from '../core/types.js';
import type { EditorContext } from './context.svelte.js';
interface Props {
    editor: EditorContext;
    node: ComponentNode;
}
declare const TableRowsField: import("svelte").Component<Props, {}, "">;
type TableRowsField = ReturnType<typeof TableRowsField>;
export default TableRowsField;
