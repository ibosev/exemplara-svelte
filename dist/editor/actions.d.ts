import type { EditorContext } from './context.svelte.js';
import type { IconType } from './icons.js';
export interface EditorCommandContext {
    nodeId?: string;
}
export interface EditorCommandDefinition {
    id: string;
    label: string;
    description?: string;
    icon?: typeof IconType;
    placement?: 'toolbar' | 'command-only';
    shortcut?: string;
    danger?: boolean;
    canRun?: (editor: EditorContext, context: EditorCommandContext) => boolean;
    execute: (editor: EditorContext, context: EditorCommandContext) => boolean | void | Promise<boolean | void>;
}
export type EditorMenuLocation = 'node.context' | 'node.inline' | 'layer.inline' | 'inspector.actions';
export interface EditorMenuItemDefinition {
    id: string;
    commandId: string;
    location: EditorMenuLocation;
    group?: string;
    order?: number;
    showWhenDisabled?: boolean;
    when?: (editor: EditorContext, context: EditorCommandContext) => boolean;
}
export interface ResolvedEditorMenuItem {
    id: string;
    group: string;
    order: number;
    enabled: boolean;
    command: EditorCommandDefinition;
}
export interface EditorKeybindingDefinition {
    id: string;
    commandId: string;
    key: string;
    mod?: boolean;
    shift?: boolean;
    alt?: boolean;
    order?: number;
    when?: (editor: EditorContext, context: EditorCommandContext) => boolean;
}
export interface EditorKeyInput {
    key: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
}
export interface EditorActionRegistry {
    addCommand(command: EditorCommandDefinition): void;
    addMenuItem(item: EditorMenuItemDefinition): void;
    addKeybinding(keybinding: EditorKeybindingDefinition): void;
    commands(): EditorCommandDefinition[];
    command(id: string): EditorCommandDefinition | undefined;
    menuItems(location: EditorMenuLocation, editor: EditorContext, context?: EditorCommandContext): ResolvedEditorMenuItem[];
    runCommand(id: string, editor: EditorContext, context?: EditorCommandContext): Promise<boolean>;
    resolveKeybinding(event: EditorKeyInput, editor: EditorContext, context?: EditorCommandContext): string | null;
}
export declare function createEditorActionRegistry(): EditorActionRegistry;
