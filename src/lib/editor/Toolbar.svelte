<script lang="ts">
  import { getEditorContext } from './context.svelte.js';
  import type {
    EditorToolbarClusterDefinition,
    EditorToolbarZone,
  } from './extension-types.js';

  interface Props {
    compact?: boolean;
    zone?: EditorToolbarZone;
  }

  let { compact = false, zone }: Props = $props();
  const editor = getEditorContext();
  const clusters = $derived(editor.extensions.toolbarClusters(editor));
  const startClusters = $derived(clusters.filter((cluster) => (cluster.zone ?? 'start') === 'start'));
  const centerClusters = $derived(clusters.filter((cluster) => cluster.zone === 'center'));
  const endClusters = $derived(clusters.filter((cluster) => cluster.zone === 'end'));
  const selectedClusters = $derived(
    zone === 'center' ? centerClusters : zone === 'end' ? endClusters : startClusters,
  );
</script>

{#snippet clusterList(items: EditorToolbarClusterDefinition[])}
  {#each items as cluster, index (cluster.id)}
    {#if index > 0 && cluster.separator === 'divider'}
      <span class="exs-toolbar__divider"></span>
    {:else if index > 0 && cluster.separator === 'spacer'}
      <span class="exs-toolbar__spacer"></span>
    {/if}
    {@const Cluster = cluster.component}
    <Cluster {editor} />
  {/each}
{/snippet}

{#if zone}
  {#if selectedClusters.length > 0}
    <div class="exs-toolbar exs-toolbar--zoned" class:exs-toolbar--compact={compact} data-toolbar-zone={zone}>
      {@render clusterList(selectedClusters)}
    </div>
  {/if}
{:else if clusters.length > 0}
  <div class="exs-toolbar exs-toolbar--three-zone" class:exs-toolbar--compact={compact}>
    <div class="exs-toolbar__zone exs-toolbar__zone--start">
      {@render clusterList(startClusters)}
    </div>
    <div class="exs-toolbar__zone exs-toolbar__zone--center">
      {@render clusterList(centerClusters)}
    </div>
    <div class="exs-toolbar__zone exs-toolbar__zone--end">
      {@render clusterList(endClusters)}
    </div>
  </div>
{/if}
