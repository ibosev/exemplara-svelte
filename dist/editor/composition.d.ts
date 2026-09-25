import { type CapabilityId, type CapabilityPolicy } from '../core/capabilities.js';
import type { EditorExtension, EditorExtensionApi, EditorExtensionDisposer } from './extensions.js';
export interface EditorPlugin {
    /** Stable, namespaced identifier such as `exemplara.data-binding`. */
    id: string;
    version: string;
    /** Plugin ids that must be installed before this plugin. */
    dependsOn?: readonly string[];
    /** Capabilities which must be allowed for this plugin to run. */
    requires?: readonly CapabilityId[];
    /** Capabilities made available by this plugin. */
    provides?: readonly CapabilityId[];
    setup(api: EditorExtensionApi): void | EditorExtensionDisposer;
}
export type EditorServiceMap = Readonly<Record<string, unknown>>;
export interface EditorComposition {
    readonly plugins: readonly EditorPlugin[];
    readonly policy: CapabilityPolicy;
    readonly services: EditorServiceMap;
    readonly inheritLegacyRegistrations: boolean;
}
export interface ComposeEditorOptions {
    plugins?: readonly EditorPlugin[];
    policy?: CapabilityPolicy;
    services?: EditorServiceMap;
    /** Compatibility only; new compositions should keep runtime registrations isolated. */
    inheritLegacyRegistrations?: boolean;
}
export type EditorCompositionErrorCode = 'duplicate-plugin' | 'invalid-plugin' | 'missing-dependency' | 'dependency-cycle' | 'disabled-capability';
export declare class EditorCompositionError extends Error {
    readonly code: EditorCompositionErrorCode;
    readonly pluginId?: string | undefined;
    constructor(code: EditorCompositionErrorCode, message: string, pluginId?: string | undefined);
}
export declare function defineEditorPlugin(plugin: EditorPlugin): EditorPlugin;
/** True when policy permits a capability and an installed plugin supplies it. */
export declare function isPluginCapabilityEnabled(composition: EditorComposition, capability: CapabilityId): boolean;
export declare function adaptEditorExtension(extension: EditorExtension, id: string): EditorPlugin;
export declare function composeEditor(options?: ComposeEditorOptions): EditorComposition;
