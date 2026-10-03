import { composeEditor as composeCore } from "exemplara-core/editor";
import type {
  EditorPlugin as CoreEditorPlugin,
  EditorPluginMetadata,
  EditorComposition as CoreComposition,
  ComposeEditorOptions as CoreOptions,
} from "exemplara-core/editor";
import type {
  EditorExtension,
  EditorExtensionApi,
  EditorExtensionDisposer,
} from "./extensions.js";
export {
  isPluginCapabilityEnabled,
  EditorCompositionError,
} from "exemplara-core/editor";
export type {
  EditorServiceMap,
  EditorCompositionErrorCode,
} from "exemplara-core/editor";

export interface EditorPlugin extends EditorPluginMetadata {
  /** Portable behavior runs once; setup supplies Svelte views. */
  core?: CoreEditorPlugin;
  setup(api: EditorExtensionApi): void | EditorExtensionDisposer;
}
export type EditorComposition = CoreComposition<EditorPlugin>;
export type ComposeEditorOptions = CoreOptions<EditorPlugin>;
export function adaptEditorExtension(
  extension: EditorExtension,
  id: string,
): EditorPlugin {
  return { id, version: "1.0.0", core: extension.core, setup: extension };
}

/** Build the same session behavior while discarding Svelte setup functions. */
export function toCoreComposition(
  composition: EditorComposition,
): CoreComposition {
  return composeCore({
    ...composition,
    plugins: composition.plugins.map(({ core, setup: _view, ...metadata }) => ({
      ...metadata,
      setup: core?.setup ?? (() => {}),
    })),
  });
}

export function composeEditor<T extends EditorPlugin = EditorPlugin>(
  options: CoreOptions<T> = {},
): CoreComposition<T> {
  return composeCore(options);
}
export function defineEditorPlugin<T extends EditorPlugin>(plugin: T): T {
  return plugin;
}
