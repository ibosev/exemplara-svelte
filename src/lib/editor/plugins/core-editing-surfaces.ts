import { registerCoreEditingMenus as menus, registerCoreEditingKeybindings as keybindings } from 'exemplara-core/editor/plugins/core-editing-surfaces';
import type { EditorExtensionApi as CoreApi } from 'exemplara-core/editor';
import type { EditorExtensionApi } from '../extensions.js';

export function registerCoreEditingMenus(api: EditorExtensionApi): void { menus(api as unknown as CoreApi); }
export function registerCoreEditingKeybindings(api: EditorExtensionApi): void { keybindings(api as unknown as CoreApi); }
