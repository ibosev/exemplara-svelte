<script lang="ts">
  import { IconEye, IconSave } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();

</script>

<div class="exs-toolbar__group">
  {#if editor.host.onSave}
    <button
      type="button"
      class="exs-btn exs-btn--icon"
      title="Save document"
      aria-label="Save document"
      onclick={() => void editor.runCommand('document.save')}
    >
      <IconSave size={14} />
    </button>
  {/if}
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    class:exs-btn--active={editor.previewOpen}
    title={editor.previewOpen ? 'Close preview' : 'Open preview'}
    aria-label={editor.previewOpen ? 'Close preview' : 'Open preview'}
    aria-pressed={editor.previewOpen}
    onclick={() => (editor.previewOpen = !editor.previewOpen)}
  >
    <IconEye size={14} />
  </button>
</div>
