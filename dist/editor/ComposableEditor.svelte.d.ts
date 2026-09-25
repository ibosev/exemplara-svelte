import type { ComponentRegistry } from '../core/registry.js';
import type { ExemplaraDocument } from '../core/types.js';
import type { EditorHostConfig } from './extensions.js';
import type { EditorComposition } from './composition.js';
import './theme.css';
interface Props {
    document?: ExemplaraDocument;
    registry?: ComponentRegistry;
    /** Required so this entry point never imports the batteries-included preset. */
    composition: EditorComposition;
    host?: EditorHostConfig;
    onchange?: (doc: ExemplaraDocument) => void;
}
declare const ComposableEditor: import("svelte").Component<Props, {}, "">;
type ComposableEditor = ReturnType<typeof ComposableEditor>;
export default ComposableEditor;
