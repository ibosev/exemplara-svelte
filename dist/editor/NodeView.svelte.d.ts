import NodeView from './NodeView.svelte';
import { type DataContext } from '../renderer/data.js';
import type { ComponentNode } from '../core/types.js';
interface Props {
    node: ComponentNode;
    parentId: string;
    index: number;
    slot?: string;
    dataContext?: DataContext;
    pageIndex?: number;
    totalPages?: number;
}
declare const NodeView: import("svelte").Component<Props, {}, "">;
type NodeView = ReturnType<typeof NodeView>;
export default NodeView;
