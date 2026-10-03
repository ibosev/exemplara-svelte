import { registerCoreEditingMenus as menus, registerCoreEditingKeybindings as keybindings } from 'exemplara-core/editor/plugins/core-editing-surfaces';
export function registerCoreEditingMenus(api) { menus(api); }
export function registerCoreEditingKeybindings(api) { keybindings(api); }
