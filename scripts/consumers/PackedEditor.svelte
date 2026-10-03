<script lang="ts">
  import ComposableEditor from 'exemplara-svelte/editor/composable';
  import { EditorApplication } from 'exemplara-core/editor';
  import { createDocument } from 'exemplara-core';
  import { toCoreComposition } from 'exemplara-svelte/editor/composition';
  import { createFullEditorPreset } from 'exemplara-plugins/presets';
  import { fromStore } from 'svelte/store';
  import { onDestroy } from 'svelte';
  const composition = createFullEditorPreset();
  const applications = [1, 2].map(i => new EditorApplication({ features: {}, document: createDocument({ name: `Document ${i}` }), createComposition: () => toCoreComposition(composition), documentForFeatures: () => createDocument() }));
  const sessions = applications.map(app => app.stores.session.get());
  const view = fromStore(applications[0].stores.view);
  const visible = $derived(view.current === 'editor');
  onDestroy(() => applications.forEach(app => app.destroy()));
</script>
<button onclick={() => applications[0].setView(visible ? 'json' : 'editor')}>Toggle first view</button>
{#each sessions as session, i}
  <section data-session={i}>
    {#if i !== 0 || visible}<ComposableEditor {composition} {session} />{/if}
  </section>
{/each}
