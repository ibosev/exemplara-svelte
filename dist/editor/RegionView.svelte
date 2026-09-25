<script lang="ts">
  import NodeView from './NodeView.svelte';
  import { getEditorContext } from './context.svelte.js';
  import { dropzone, dragState } from './dnd.svelte.js';
  import { styleString } from '../renderer/escape.js';
  import type { DataContext } from '../renderer/data.js';
  import type { Region, RegionName } from '../core/types.js';

  interface Props {
    region: Region;
    name: RegionName;
    variantClass?: string;
    dataContext?: DataContext;
    pageIndex?: number;
    totalPages?: number;
  }

  let { region, name, variantClass = '', dataContext, pageIndex, totalPages }: Props = $props();

  const editor = getEditorContext();

  const isDropTarget = $derived(dragState.over?.parentId === region.id);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class={`exs-region exs-region--${name} ex-region ex-region--${name}${variantClass ? ` ${variantClass}` : ''}`}
  class:exs-region--empty={region.children.length === 0}
  class:exs-region--droptarget={isDropTarget}
  data-region-id={region.id}
  style={styleString(region.style ?? {})}
  onclick={(event) => {
    event.stopPropagation();
    editor.select(null);
  }}
  {@attach dropzone(() => ({
    editor,
    target: () => ({ parentId: region.id, index: region.children.length }),
  }))}
>
  <span class="exs-region__label">{name}</span>
  {#if region.children.length === 0}
    <span>Drop components into the {name}</span>
  {:else}
    {#each region.children as child, index (child.id)}
      <NodeView node={child} parentId={region.id} {index} {dataContext} {pageIndex} {totalPages} />
    {/each}
  {/if}
</div>
