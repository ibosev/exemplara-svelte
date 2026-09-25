import type { ComponentRegistry } from '../core/registry.js';
import type { ExemplaraDocument } from '../core/types.js';
import type { EditorExtension, EditorHostConfig } from './extensions.js';
import type { EditorComposition } from './composition.js';
interface Props {
    document?: ExemplaraDocument;
    registry?: ComponentRegistry;
    extensions?: readonly EditorExtension[];
    /** Immutable composition. When omitted, the backward-compatible full preset is used. */
    composition?: EditorComposition;
    host?: EditorHostConfig;
    onchange?: (doc: ExemplaraDocument) => void;
}
declare const Editor: import("svelte").Component<Props, {}, "">;
type Editor = ReturnType<typeof Editor>;
export default Editor;
