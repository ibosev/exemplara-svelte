<script lang="ts">
  import { IconUndo, IconRedo } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
</script>

<div class="exs-toolbar__group">
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    disabled={!editor.canRunCommand('history.undo')}
    onclick={() => void editor.runCommand('history.undo')}
    title="Undo (Ctrl+Z)"
    aria-label="Undo"
  >
    <IconUndo size={15} />
  </button>
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    disabled={!editor.canRunCommand('history.redo')}
    onclick={() => void editor.runCommand('history.redo')}
    title="Redo (Ctrl+Shift+Z)"
    aria-label="Redo"
  >
    <IconRedo size={15} />
  </button>
</div>
