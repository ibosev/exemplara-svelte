<script lang="ts">
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
</script>

{#if editor.hostStatus}
  <span class="exs-toolbar__host-status" data-tone={editor.hostStatus.tone}>{editor.hostStatus.message}</span>
{/if}
