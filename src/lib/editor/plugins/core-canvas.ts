import type { Component } from 'svelte';
import type { EditorPlugin } from '../composition.js';
import type { EditorCanvasDecorationProps } from '../extension-types.js';
import HorizontalRuler from '../HorizontalRuler.svelte';
import { isWebDocument } from '../../core/web.js';

// Core decorations read EditorContext from Svelte context and declare no
// props; the canvas host passes `editor` uniformly, which they ignore.
const asDecoration = (
  component: Component<Record<string, never>> | Component<EditorCanvasDecorationProps>,
) => component as Component<EditorCanvasDecorationProps>;

/**
 * Registers the standard canvas decorations: the paragraph ruler above the
 * sheet surface. Optional action overlays belong to action-surfaces.
 */
export function createCoreCanvasPlugin(): EditorPlugin {
  return {
    id: 'exemplara.core-canvas',
    version: '1.0.0',
    setup(api) {
      api.addCanvasDecoration({
        id: 'ruler',
        placement: 'above',
        order: 10,
        visible: (editor) => !editor?.doc || !isWebDocument(editor.doc),
        component: asDecoration(HorizontalRuler),
      });
    },
  };
}
