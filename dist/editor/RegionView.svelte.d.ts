import type { DataContext } from '../renderer/data.js';
import type { Region, RegionName } from '../core/types.js';
interface Props {
    region: Region;
    name: RegionName;
    variantClass?: string;
    dataContext?: DataContext;
    pageIndex?: number;
    totalPages?: number;
}
declare const RegionView: import("svelte").Component<Props, {}, "">;
type RegionView = ReturnType<typeof RegionView>;
export default RegionView;
