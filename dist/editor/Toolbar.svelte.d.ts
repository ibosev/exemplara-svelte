import type { EditorToolbarZone } from './extension-types.js';
interface Props {
    compact?: boolean;
    zone?: EditorToolbarZone;
}
declare const Toolbar: import("svelte").Component<Props, {}, "">;
type Toolbar = ReturnType<typeof Toolbar>;
export default Toolbar;
