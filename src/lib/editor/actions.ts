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
  execute: (
    editor: EditorContext,
    context: EditorCommandContext,
  ) => boolean | void | Promise<boolean | void>;
}

export type EditorMenuLocation =
  | 'node.context'
  | 'node.inline'
  | 'layer.inline'
  | 'inspector.actions';

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
  menuItems(
    location: EditorMenuLocation,
    editor: EditorContext,
    context?: EditorCommandContext,
  ): ResolvedEditorMenuItem[];
  runCommand(
    id: string,
    editor: EditorContext,
    context?: EditorCommandContext,
  ): Promise<boolean>;
  resolveKeybinding(
    event: EditorKeyInput,
    editor: EditorContext,
    context?: EditorCommandContext,
  ): string | null;
}

export function createEditorActionRegistry(): EditorActionRegistry {
  const commands = new Map<string, EditorCommandDefinition>();
  const menuItems = new Map<string, EditorMenuItemDefinition>();
  const keybindings = new Map<string, EditorKeybindingDefinition>();

  function addUnique<T>(kind: string, entries: Map<string, T>, id: string, value: T): void {
    if (entries.has(id)) throw new Error(`Duplicate editor ${kind} id: ${id}`);
    entries.set(id, value);
  }

  return {
    addCommand: (command) => addUnique('command', commands, command.id, command),
    addMenuItem: (item) => addUnique('menu item', menuItems, item.id, item),
    addKeybinding: (keybinding) => addUnique('keybinding', keybindings, keybinding.id, keybinding),
    commands: () => [...commands.values()],
    command: (id) => commands.get(id),
    menuItems(location, editor, context = {}) {
      return [...menuItems.values()]
        .filter((item) => item.location === location)
        .filter((item) => item.when?.(editor, context) ?? true)
        .map((item) => ({ item, command: commands.get(item.commandId) }))
        .filter((entry): entry is {
          item: EditorMenuItemDefinition;
          command: EditorCommandDefinition;
        } => !!entry.command)
        .map(({ item, command }) => {
          const enabled = command.canRun?.(editor, context) ?? true;
          return {
            id: item.id,
            group: item.group ?? '50.default',
            order: item.order ?? 50,
            enabled,
            command,
            visible: enabled || item.showWhenDisabled === true,
          };
        })
        .filter((entry) => entry.visible)
        .map(({ visible: _visible, ...entry }) => entry)
        .sort((a, b) =>
          a.group.localeCompare(b.group) || a.order - b.order || a.id.localeCompare(b.id));
    },
    async runCommand(id, editor, context = {}) {
      const command = commands.get(id);
      if (!command || !(command.canRun?.(editor, context) ?? true)) return false;
      return (await command.execute(editor, context)) !== false;
    },
    resolveKeybinding(event, editor, context = {}) {
      const mod = !!(event.metaKey || event.ctrlKey);
      const candidates = [...keybindings.values()].sort(
        (a, b) => (a.order ?? 50) - (b.order ?? 50),
      );
      for (const binding of candidates) {
        if (binding.key.toLowerCase() !== event.key.toLowerCase()) continue;
        if ((binding.mod ?? false) !== mod) continue;
        if ((binding.shift ?? false) !== !!event.shiftKey) continue;
        if ((binding.alt ?? false) !== !!event.altKey) continue;
        if (!(binding.when?.(editor, context) ?? true)) continue;
        const command = commands.get(binding.commandId);
        if (command && (command.canRun?.(editor, context) ?? true)) return command.id;
      }
      return null;
    },
  };
}
