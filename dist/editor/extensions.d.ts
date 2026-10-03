import { EditorExtensionRegistry as CoreRegistry } from "exemplara-core/editor";
import type { ComponentRegistry } from "../core/registry.js";
import type { CapabilityPolicy } from "../core/capabilities.js";
import { type RenderRuntime } from "../renderer/runtime.js";
import { type ComponentIconRegistry } from "./icons.js";
import type { EditorContext } from "./context.svelte.js";
import type { ComponentNode } from "../core/types.js";
import type { EditorStyleField } from "./style-fields.js";
import type { EditorExtension, EditorPanelDefinition, EditorInspectorSectionDefinition, EditorToolbarClusterDefinition, EditorCanvasDecorationDefinition, EditorBlockDefinition, EditorOutlineAction } from "./extension-types.js";
import type { EditorCommandContext, EditorCommandDefinition, EditorKeyInput, EditorMenuLocation, ResolvedEditorMenuItem } from "./actions.js";
export * from "./extension-types.js";
export type { EditorCommandContext, EditorCommandDefinition, EditorKeybindingDefinition, EditorKeyInput, EditorMenuItemDefinition, EditorMenuLocation, ResolvedEditorMenuItem, } from "./actions.js";
export interface EditorExtensionRegistryOptions {
    policy?: CapabilityPolicy;
    services?: Readonly<Record<string, unknown>>;
    renderRuntime?: RenderRuntime;
    iconRegistry?: ComponentIconRegistry;
    core?: CoreRegistry;
    installedPlugins?: readonly string[];
    extensionIds?: readonly string[];
    editor?: () => EditorContext;
}
/** Svelte contribution components wrapped around the session's portable registry. */
export declare class EditorExtensionRegistry {
    #private;
    readonly core: CoreRegistry;
    constructor(registry: ComponentRegistry, extensions?: readonly EditorExtension[], options?: EditorExtensionRegistryOptions);
    destroy(): void;
    get panels(): EditorPanelDefinition[];
    panelsFor(placement: EditorPanelDefinition["placement"]): EditorPanelDefinition[];
    panel(id: string): EditorPanelDefinition | undefined;
    get selectionPanel(): EditorPanelDefinition | undefined;
    inspectorSections(editor: EditorContext, node: ComponentNode): EditorInspectorSectionDefinition[];
    toolbarClusters(editor: EditorContext): EditorToolbarClusterDefinition[];
    canvasDecorations(editor: EditorContext, placement: EditorCanvasDecorationDefinition["placement"]): EditorCanvasDecorationDefinition[];
    get commands(): EditorCommandDefinition[];
    command(id: string): EditorCommandDefinition | undefined;
    menuItems(location: EditorMenuLocation, editor: EditorContext, context?: EditorCommandContext): ResolvedEditorMenuItem[];
    runCommand(id: string, editor: EditorContext, context?: EditorCommandContext): Promise<boolean>;
    resolveKeybinding(event: EditorKeyInput, editor: EditorContext, context?: EditorCommandContext): string | null;
    get blocks(): EditorBlockDefinition[];
    block(id: string): EditorBlockDefinition | undefined;
    get outlineActions(): EditorOutlineAction[];
    get autocompleteProviders(): import("exemplara-core/editor").EditorAutocompleteProvider[];
    styleFieldsFor(editor: EditorContext, node: ComponentNode): EditorStyleField[];
    get formatters(): import("exemplara-core/shared").TemplateExpressionFormatter[];
    get expressionRuntime(): import("exemplara-core/shared").TemplateExpressionRuntime;
}
