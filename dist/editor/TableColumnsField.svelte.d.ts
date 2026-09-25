import type { ComponentNode } from '../core/types.js';
import type { EditorContext } from './context.svelte.js';
interface Props {
    editor: EditorContext;
    node: ComponentNode;
}
declare const TableColumnsField: import("svelte").Component<Props, {}, "">;
type TableColumnsField = ReturnType<typeof TableColumnsField>;
export default TableColumnsField;
