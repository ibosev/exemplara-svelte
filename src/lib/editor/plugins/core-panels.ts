import type { Component } from 'svelte';
import type { EditorPlugin } from '../composition.js';
import type { EditorPanelProps } from '../extension-types.js';
import Palette from '../Palette.svelte';
import ComponentsOnlyPalette from '../ComponentsOnlyPalette.svelte';
import LayerPanel from '../LayerPanel.svelte';
import Inspector from '../Inspector.svelte';
import { IconAtom, IconInspect, IconLayers } from '../icons.js';

// Built-in panels read EditorContext from Svelte context; the panel host passes
// `editor` uniformly, while the palette wrapper may also configure local props.
const asPanel = (
  component:
    | Component<Record<string, never>>
    | Component<{ showBlocks?: boolean }>
    | Component<EditorPanelProps>,
) => component as Component<EditorPanelProps>;

/**
 * Registers the structural editor panels — the component palette, the
 * document outline, and the Inspector. Feature panels (design, print, data,
 * assets, symbols, audit) come from their own plugins. Core panels use order
 * below DEFAULT_PANEL_ORDER (50) so extension panels follow them; the first
 * panel per side is also that side's initial tab.
 */
export interface CorePanelsPluginOptions {
  /** Keep reusable catalog blocks out of Atoms when the host exposes a dedicated Blocks panel. */
  includeBlocksInAdd?: boolean;
}

export function createCorePanelsPlugin(options: CorePanelsPluginOptions = {}): EditorPlugin {
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
