// Central Lucide icon wiring for the editor chrome.
// Component definitions keep their string `icon` field (emoji) so the
// core stays UI-framework-agnostic; the Svelte editor maps component
// types to Lucide glyphs here, falling back to the definition's string.
import Type from '@lucide/svelte/icons/type';
import Image from '@lucide/svelte/icons/image';
import Box from '@lucide/svelte/icons/box';
import Columns2 from '@lucide/svelte/icons/columns-2';
import StretchVertical from '@lucide/svelte/icons/stretch-vertical';
import Minus from '@lucide/svelte/icons/minus';
import Table from '@lucide/svelte/icons/table';
import Scissors from '@lucide/svelte/icons/scissors';
import Droplets from '@lucide/svelte/icons/droplets';
import Repeat2 from '@lucide/svelte/icons/repeat-2';
import GitBranch from '@lucide/svelte/icons/git-branch';
/** Map of built-in component types to Lucide icons. */
const BUILTIN_COMPONENT_ICONS = {
    text: Type,
    image: Image,
    container: Box,
    columns: Columns2,
    spacer: StretchVertical,
    divider: Minus,
    table: Table,
    'page-break': Scissors,
    watermark: Droplets,
    repeater: Repeat2,
    conditional: GitBranch,
};
function iconRegistryFrom(entries) {
    const icons = new Map(entries);
    return {
        get: (type) => icons.get(type) ?? null,
        register: (type, icon) => icons.set(type, icon),
        unregister: (type) => icons.delete(type),
        entries: () => [...icons.entries()],
    };
}
/** Mutable compatibility registry for the original process-wide API. */
export const legacyComponentIconRegistry = iconRegistryFrom(Object.entries(BUILTIN_COMPONENT_ICONS));
export function createComponentIconRegistry(inheritLegacy = false) {
    return iconRegistryFrom(inheritLegacy
        ? legacyComponentIconRegistry.entries()
        : Object.entries(BUILTIN_COMPONENT_ICONS));
}
/** Lucide icon for a component type, or null (caller falls back to the definition's string icon). */
export function componentIcon(type) {
    return legacyComponentIconRegistry.get(type);
}
/** Register a Lucide icon for a custom component type. */
export function registerComponentIcon(type, icon) {
    legacyComponentIconRegistry.register(type, icon);
}
// --- Chrome icons (re-exported so editor components import from one place) ---
export { default as IconUndo } from '@lucide/svelte/icons/undo-2';
export { default as IconRedo } from '@lucide/svelte/icons/redo-2';
export { default as IconZoomIn } from '@lucide/svelte/icons/zoom-in';
export { default as IconZoomOut } from '@lucide/svelte/icons/zoom-out';
export { default as IconFit } from '@lucide/svelte/icons/maximize-2';
export { default as IconMoon } from '@lucide/svelte/icons/moon';
export { default as IconSun } from '@lucide/svelte/icons/sun';
export { default as IconEye } from '@lucide/svelte/icons/eye';
export { default as IconEyeOff } from '@lucide/svelte/icons/eye-off';
export { default as IconJson } from '@lucide/svelte/icons/braces';
export { default as IconContinuousPages } from './ContinuousPagesIcon.svelte';
// Retain the former name for long-running dev servers with a cached consumer
// module while the package is rebuilt underneath them.
export { default as IconWorkflow } from '@lucide/svelte/icons/workflow';
export { default as IconExport } from '@lucide/svelte/icons/file-down';
export { default as IconPrinter } from '@lucide/svelte/icons/printer';
export { default as IconDownload } from '@lucide/svelte/icons/download';
export { default as IconLogo } from '@lucide/svelte/icons/layout-template';
export { default as IconPlus } from '@lucide/svelte/icons/plus';
export { default as IconAtom } from '@lucide/svelte/icons/atom';
export { default as IconBlocks } from '@lucide/svelte/icons/blocks';
export { default as IconLayers } from '@lucide/svelte/icons/layers';
export { default as IconImages } from '@lucide/svelte/icons/images';
export { default as IconDiamond } from '@lucide/svelte/icons/diamond';
export { default as IconInspect } from '@lucide/svelte/icons/sliders-horizontal';
export { default as IconPalette } from '@lucide/svelte/icons/palette';
export { default as IconPrintLayout } from '@lucide/svelte/icons/panel-top';
export { default as IconHeader } from '@lucide/svelte/icons/panel-top';
export { default as IconFooter } from '@lucide/svelte/icons/panel-bottom';
export { default as IconCode } from '@lucide/svelte/icons/code-xml';
export { default as IconSparkles } from '@lucide/svelte/icons/sparkles';
export { default as IconDatabase } from '@lucide/svelte/icons/database';
export { default as IconAudit } from '@lucide/svelte/icons/shield-check';
export { default as IconCopy } from '@lucide/svelte/icons/copy';
export { default as IconPaste } from '@lucide/svelte/icons/clipboard-paste';
export { default as IconDuplicate } from '@lucide/svelte/icons/copy-plus';
export { default as IconArrowUp } from '@lucide/svelte/icons/arrow-up';
export { default as IconArrowDown } from '@lucide/svelte/icons/arrow-down';
export { default as IconLock } from '@lucide/svelte/icons/lock';
export { default as IconUnlock } from '@lucide/svelte/icons/lock-open';
export { default as IconTrash } from '@lucide/svelte/icons/trash-2';
export { default as IconBold } from '@lucide/svelte/icons/bold';
export { default as IconItalic } from '@lucide/svelte/icons/italic';
export { default as IconUnderline } from '@lucide/svelte/icons/underline';
export { default as IconStrikethrough } from '@lucide/svelte/icons/strikethrough';
export { default as IconClearFormat } from '@lucide/svelte/icons/remove-formatting';
export { default as IconUpload } from '@lucide/svelte/icons/upload';
export { default as IconClose } from '@lucide/svelte/icons/x';
export { default as IconGrip } from '@lucide/svelte/icons/grip-vertical';
export { default as IconChevronDown } from '@lucide/svelte/icons/chevron-down';
export { default as IconChevronLeft } from '@lucide/svelte/icons/chevron-left';
export { default as IconChevronRight } from '@lucide/svelte/icons/chevron-right';
export { default as IconDocument } from '@lucide/svelte/icons/file-text';
export { default as IconPanel } from '@lucide/svelte/icons/panels-top-left';
export { default as IconColumns } from '@lucide/svelte/icons/columns-2';
export { default as IconLink } from '@lucide/svelte/icons/link-2';
export { default as IconSearch } from '@lucide/svelte/icons/search';
export { default as IconParent } from '@lucide/svelte/icons/corner-up-left';
export { default as IconMore } from '@lucide/svelte/icons/ellipsis';
export { default as IconEdit } from '@lucide/svelte/icons/pencil';
export { default as IconSave } from '@lucide/svelte/icons/save';
export { default as IconLibrary } from '@lucide/svelte/icons/library';
export { default as IconFunction } from '@lucide/svelte/icons/function-square';
export { default as IconFileStack } from '@lucide/svelte/icons/files';
export { default as IconHistory } from '@lucide/svelte/icons/history';
export { default as IconRotateCcw } from '@lucide/svelte/icons/rotate-ccw';
export { default as IconLoader } from '@lucide/svelte/icons/loader-circle';
export { default as IconImport } from '@lucide/svelte/icons/import';
export { default as IconBadgeDollar } from '@lucide/svelte/icons/badge-dollar-sign';
export { default as IconCalendar } from '@lucide/svelte/icons/calendar-days';
export { default as IconPortrait } from '@lucide/svelte/icons/rectangle-vertical';
export { default as IconLandscape } from '@lucide/svelte/icons/rectangle-horizontal';
export { default as IconGlobe } from '@lucide/svelte/icons/globe-2';
export { default as IconMonitor } from '@lucide/svelte/icons/monitor';
export { default as IconTablet } from '@lucide/svelte/icons/tablet';
export { default as IconPhone } from '@lucide/svelte/icons/smartphone';
export { default as IconExternalLink } from '@lucide/svelte/icons/external-link';
