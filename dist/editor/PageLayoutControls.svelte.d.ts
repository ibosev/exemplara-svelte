import type { EditorContext } from './context.svelte.js';
type ControlSet = 'all' | 'size' | 'orientation' | 'flow';
interface Props {
    editor: EditorContext;
    placement?: 'toolbar' | 'panel';
    controls?: ControlSet;
}
declare const PageLayoutControls: import("svelte").Component<Props, {}, "">;
type PageLayoutControls = ReturnType<typeof PageLayoutControls>;
export default PageLayoutControls;
