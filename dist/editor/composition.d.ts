import type { EditorPlugin as CoreEditorPlugin, EditorPluginMetadata, EditorComposition as CoreComposition, ComposeEditorOptions as CoreOptions } from "exemplara-core/editor";
import type { EditorExtension, EditorExtensionApi, EditorExtensionDisposer } from "./extensions.js";
export { isPluginCapabilityEnabled, EditorCompositionError, } from "exemplara-core/editor";
export type { EditorServiceMap, EditorCompositionErrorCode, } from "exemplara-core/editor";
export interface EditorPlugin extends EditorPluginMetadata {
    /** Portable behavior runs once; setup supplies Svelte views. */
    core?: CoreEditorPlugin;
    setup(api: EditorExtensionApi): void | EditorExtensionDisposer;
}
export type EditorComposition = CoreComposition<EditorPlugin>;
export type ComposeEditorOptions = CoreOptions<EditorPlugin>;
export declare function adaptEditorExtension(extension: EditorExtension, id: string): EditorPlugin;
/** Build the same session behavior while discarding Svelte setup functions. */
export declare function toCoreComposition(composition: EditorComposition): CoreComposition;
export declare function composeEditor<T extends EditorPlugin = EditorPlugin>(options?: CoreOptions<T>): CoreComposition<T>;
export declare function defineEditorPlugin<T extends EditorPlugin>(plugin: T): T;
