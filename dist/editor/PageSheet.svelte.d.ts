import type { Page } from '../core/types.js';
interface Props {
    page: Page;
    index: number;
    zoom: number;
    blocked?: boolean;
    onpageelement?: (pageId: string, element: HTMLElement | null) => void;
}
declare const PageSheet: import("svelte").Component<Props, {}, "">;
type PageSheet = ReturnType<typeof PageSheet>;
export default PageSheet;
