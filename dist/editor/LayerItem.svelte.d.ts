import LayerItem from './LayerItem.svelte';
import type { LayerTreeNode } from '../shared/layer-tree.js';
interface Props {
    node: LayerTreeNode;
    depth: number;
    isExpanded: (node: LayerTreeNode) => boolean;
    ontoggle: (node: LayerTreeNode) => void;
}
declare const LayerItem: import("svelte").Component<Props, {}, "">;
type LayerItem = ReturnType<typeof LayerItem>;
export default LayerItem;
