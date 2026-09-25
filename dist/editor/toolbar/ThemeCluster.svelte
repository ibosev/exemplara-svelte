<script lang="ts">
  import { IconMoon, IconSun } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
  const dark = $derived(editor.isDarkChrome());
</script>

<div class="exs-toolbar__group">
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    title={dark ? 'Switch to light chrome' : 'Switch to dark chrome'}
    aria-label="Toggle dark mode"
    onclick={() => editor.toggleChromeTheme()}
  >
    {#if dark}
      <IconSun size={15} />
    {:else}
      <IconMoon size={15} />
    {/if}
  </button>
</div>
