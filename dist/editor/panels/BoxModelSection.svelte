<script lang="ts">
  import BoxModel from './BoxModel.svelte';
  import type { EditorInspectorSectionProps } from '../extension-types.js';

  let { node }: EditorInspectorSectionProps = $props();
</script>

<details class="exs-details">
  <summary>Box model</summary>
  <div class="exs-field">
    <BoxModel {node} />
    <span class="exs-field__label" style="font-weight: 400">
      Values are written as style bindings and render inline in print output.
    </span>
  </div>
</details>
