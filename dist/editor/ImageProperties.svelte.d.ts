import type { ComponentNode } from '../core/types.js';
import type { EditorContext } from './context.svelte.js';
interface Props {
    editor: EditorContext;
    node: ComponentNode;
}
declare const ImageProperties: import("svelte").Component<Props, {}, "">;
type ImageProperties = ReturnType<typeof ImageProperties>;
export default ImageProperties;
