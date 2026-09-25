import Palette from '../Palette.svelte';
import ComponentsOnlyPalette from '../ComponentsOnlyPalette.svelte';
import LayerPanel from '../LayerPanel.svelte';
import Inspector from '../Inspector.svelte';
import { IconAtom, IconInspect, IconLayers } from '../icons.js';
// Built-in panels read EditorContext from Svelte context; the panel host passes
// `editor` uniformly, while the palette wrapper may also configure local props.
const asPanel = (component) => component;
export function createCorePanelsPlugin(options = {}) {
    return {
        id: 'exemplara.core-panels',
        version: '1.0.0',
        setup(api) {
            api.addPanel({
                id: 'components',
                label: 'Atoms',
                placement: 'left',
                order: 10,
                icon: IconAtom,
                component: asPanel(options.includeBlocksInAdd === false ? ComponentsOnlyPalette : Palette),
            });
            api.addPanel({ id: 'layers', label: 'Layers', placement: 'left', order: 20, icon: IconLayers, component: asPanel(LayerPanel) });
            api.addPanel({ id: 'inspect', label: 'Selected', placement: 'right', order: 10, icon: IconInspect, activateOnSelection: true, component: asPanel(Inspector) });
        },
    };
}
