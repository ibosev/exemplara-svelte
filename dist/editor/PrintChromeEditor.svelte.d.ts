import type { ExemplaraDocument } from '../core/types.js';
interface Props {
    document: ExemplaraDocument;
    position: 'header' | 'footer';
    html: string;
    title: string;
    oncommit: (html: string) => void;
    oncancel: () => void;
}
declare const PrintChromeEditor: import("svelte").Component<Props, {}, "">;
type PrintChromeEditor = ReturnType<typeof PrintChromeEditor>;
export default PrintChromeEditor;
