import { composeEditor as composeCore } from "exemplara-core/editor";
export { isPluginCapabilityEnabled, EditorCompositionError, } from "exemplara-core/editor";
export function adaptEditorExtension(extension, id) {
    return { id, version: "1.0.0", core: extension.core, setup: extension };
}
/** Build the same session behavior while discarding Svelte setup functions. */
export function toCoreComposition(composition) {
    return composeCore({
        ...composition,
        plugins: composition.plugins.map(({ core, setup: _view, ...metadata }) => ({
            ...metadata,
            metadataOnly: !core,
            setup: core
                ? core.id === metadata.id
                    ? core.setup
                    : (api) => api.installCore(core)
                : () => { },
        })),
    });
}
export function composeEditor(options = {}) {
    return composeCore(options);
}
export function defineEditorPlugin(plugin) {
    return plugin;
}
