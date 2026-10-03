<script lang="ts">
  import ComposableEditor from './ComposableEditor.svelte';
  import { createFullEditorPreset } from './presets.js';
  import type { ComponentRegistry } from '../core/registry.js';
  import type { ExemplaraDocument } from '../core/types.js';
  import type { EditorExtension, EditorHostConfig } from './extensions.js';
  import type { EditorComposition } from './composition.js';

  import type { EditorSession } from 'exemplara-core/editor';

  interface Props {
    session?: EditorSession;
    document?: ExemplaraDocument;
    registry?: ComponentRegistry;
    extensions?: readonly EditorExtension[];
    /** Immutable composition. When omitted, the backward-compatible full preset is used. */
    composition?: EditorComposition;
    host?: EditorHostConfig;
    onchange?: (doc: ExemplaraDocument) => void;
  }

  let { session, document, registry, extensions, composition, host, onchange }: Props = $props();

  // svelte-ignore state_referenced_locally -- the editor composition is immutable for one mount
  const resolvedComposition = composition ?? createFullEditorPreset({ extensions });
</script>

<ComposableEditor
  {session}
  {document}
  {registry}
  composition={resolvedComposition}
  {host}
  {onchange}
/>
