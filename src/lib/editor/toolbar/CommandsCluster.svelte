<script lang="ts">
  import { IconSparkles } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
  const toolbarCommands = $derived(
    editor.extensions.commands.filter((command) => command.placement === 'toolbar'),
  );
</script>

{#each toolbarCommands as command (command.id)}
  {@const CommandIcon = command.icon ?? IconSparkles}
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    title={command.description ?? command.label}
    aria-label={command.label}
    disabled={!editor.canRunCommand(command.id)}
    onclick={() => void editor.runCommand(command.id)}
  >
    <CommandIcon size={14} />
  </button>
{/each}
