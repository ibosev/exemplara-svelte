import { describe, expect, it, vi } from 'vitest';
import { createEditorActionRegistry } from '../src/lib/editor/actions.js';
import type { EditorContext } from '../src/lib/editor/context.svelte.js';

const editor = {} as EditorContext;

describe('editor action contributions', () => {
  it('orders menu groups and keeps explicitly visible disabled commands', () => {
    const actions = createEditorActionRegistry();
    actions.addCommand({ id: 'enabled', label: 'Enabled', execute: () => true });
    actions.addCommand({ id: 'disabled', label: 'Disabled', canRun: () => false, execute: () => true });
    actions.addMenuItem({
      id: 'late',
      commandId: 'enabled',
      location: 'node.context',
      group: '20.edit',
      order: 20,
    });
    actions.addMenuItem({
      id: 'disabled-visible',
      commandId: 'disabled',
      location: 'node.context',
      group: '10.contextual',
      showWhenDisabled: true,
    });
    actions.addMenuItem({
      id: 'disabled-hidden',
      commandId: 'disabled',
      location: 'node.context',
    });

    expect(actions.menuItems('node.context', editor)).toMatchObject([
      { id: 'disabled-visible', enabled: false },
      { id: 'late', enabled: true },
    ]);
  });

  it('runs one command implementation from menus and keybindings', async () => {
    const execute = vi.fn(() => true);
    const actions = createEditorActionRegistry();
    actions.addCommand({ id: 'node.duplicate', label: 'Duplicate', execute });
    actions.addMenuItem({
      id: 'node.context.duplicate',
      commandId: 'node.duplicate',
      location: 'node.context',
    });
    actions.addKeybinding({
      id: 'node.duplicate',
      commandId: 'node.duplicate',
      key: 'd',
      mod: true,
    });

    expect(actions.resolveKeybinding({ key: 'd', ctrlKey: true }, editor, { nodeId: 'node-1' }))
      .toBe('node.duplicate');
    expect(actions.resolveKeybinding({ key: 'd' }, editor)).toBeNull();
    await actions.runCommand('node.duplicate', editor, { nodeId: 'node-1' });
    expect(execute).toHaveBeenCalledWith(editor, { nodeId: 'node-1' });
  });

  it('rejects duplicate contribution ids instead of silently replacing plugins', () => {
    const actions = createEditorActionRegistry();
    actions.addCommand({ id: 'node.copy', label: 'Copy', execute: () => true });
    expect(() => actions.addCommand({
      id: 'node.copy',
      label: 'Different copy',
      execute: () => true,
    })).toThrow('Duplicate editor command id: node.copy');

    actions.addMenuItem({
      id: 'node.copy.context',
      commandId: 'node.copy',
      location: 'node.context',
    });
    expect(() => actions.addMenuItem({
      id: 'node.copy.context',
      commandId: 'node.copy',
      location: 'node.inline',
    })).toThrow('Duplicate editor menu item id: node.copy.context');

    actions.addKeybinding({
      id: 'node.copy.shortcut',
      commandId: 'node.copy',
      key: 'c',
      mod: true,
    });
    expect(() => actions.addKeybinding({
      id: 'node.copy.shortcut',
      commandId: 'node.copy',
      key: 'Insert',
      mod: true,
    })).toThrow('Duplicate editor keybinding id: node.copy.shortcut');
  });
});
