<script lang="ts">
  import { tick, untrack } from 'svelte';
  import LayerItem from './LayerItem.svelte';
  import { getEditorContext } from './context.svelte.js';
  import {
    buildDocumentLayerTree,
    countLayerTreeNodes,
    findLayerTreePath,
  } from '../shared/layer-tree.js';
  import type { LayerTreeNode } from '../shared/layer-tree.js';

  const editor = getEditorContext();
  let expansion = $state<Record<string, boolean>>({});
  let layersElement = $state<HTMLElement | null>(null);

  const tree = $derived(buildDocumentLayerTree(editor.doc, (type) => editor.getDefinition(type)));
  const componentCount = $derived(countLayerTreeNodes(tree, 'component'));

  function defaultExpanded(node: LayerTreeNode): boolean {
    if (node.kind === 'document') return true;
    if (node.kind === 'page') return node.pageIndex === editor.activePageIndex;
    return node.pageIndex === editor.activePageIndex && node.children.length > 0;
  }

  function isExpanded(node: LayerTreeNode): boolean {
    return expansion[node.id] ?? defaultExpanded(node);
  }

  function toggle(node: LayerTreeNode): void {
    expansion = { ...expansion, [node.id]: !isExpanded(node) };
  }

  $effect(() => {
    const selectedId = editor.selectedId;
    editor.layerRevealRevision;
    if (!selectedId || editor.leftTab !== 'layers') return;

    const path = findLayerTreePath(tree, selectedId);
    if (!path) return;
    let changed = false;
    // Expansion changes are user-controlled. Reading them without tracking
    // prevents this reveal effect from immediately undoing a manual collapse.
    const nextExpansion = { ...untrack(() => expansion) };
    for (const ancestor of path.slice(0, -1)) {
      if (ancestor.children.length > 0 && nextExpansion[ancestor.id] !== true) {
        nextExpansion[ancestor.id] = true;
        changed = true;
      }
    }
    if (changed) expansion = nextExpansion;

    void tick().then(() => {
      layersElement
        ?.querySelector<HTMLElement>(`[data-layer-node-id="${CSS.escape(selectedId)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
</script>

<div class="exs-layer-panel__heading">
  <div>
    <h3 class="exs-panel-title">Document outline</h3>
    <span>Pages, regions, slots, and components</span>
  </div>
  <span class="exs-layer-panel__count">{componentCount}</span>
</div>

<div bind:this={layersElement} class="exs-layers" role="tree" aria-label="Document layer hierarchy">
  <LayerItem node={tree} depth={0} {isExpanded} ontoggle={toggle} />
</div>
