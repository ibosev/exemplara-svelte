import type { Page } from '../core/types.js';
interface Props {
    page: Page;
    index: number;
    zoom: number;
    onpageelement?: (pageId: string, element: HTMLElement | null) => void;
}
declare const WebPageSheet: import("svelte").Component<Props, {}, "">;
type WebPageSheet = ReturnType<typeof WebPageSheet>;
export default WebPageSheet;
