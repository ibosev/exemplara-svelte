<script lang="ts">
  import { stepZoom } from '../../shared/math.js';
  import { IconZoomIn, IconZoomOut, IconFit } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
</script>

<div class="exs-toolbar__group exs-toolbar__zoom">
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    title="Zoom out"
    aria-label="Zoom out"
    onclick={() => (editor.zoom = stepZoom(editor.zoom, -1))}
  >
    <IconZoomOut size={15} />
  </button>
  <button
    type="button"
    class="exs-toolbar__zoom-label"
    title="Reset zoom to 100%"
    onclick={() => (editor.zoom = 1)}
  >
    {Math.round(editor.zoom * 100)}%
  </button>
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    title="Zoom in"
    aria-label="Zoom in"
    onclick={() => (editor.zoom = stepZoom(editor.zoom, 1))}
  >
    <IconZoomIn size={15} />
  </button>
  <button
    type="button"
    class="exs-btn exs-btn--icon"
    title="Fit page width"
    aria-label="Fit page width"
    onclick={() => editor.zoomToFit()}
  >
    <IconFit size={14} />
  </button>
</div>
