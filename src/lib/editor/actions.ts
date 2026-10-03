import { createEditorActionRegistry as createRegistry } from "exemplara-core/editor/actions";
import type * as core from "exemplara-core/editor/actions";
import type { EditorContext } from "./context.svelte.js";
import type { ComponentIcon } from "./icons.js";
export type {
  EditorCommandContext,
  EditorMenuLocation,
  EditorKeyInput,
} from "exemplara-core/editor/actions";
export type EditorCommandDefinition = core.EditorCommandDefinition<
  EditorContext,
  ComponentIcon
>;
export type EditorMenuItemDefinition =
  core.EditorMenuItemDefinition<EditorContext>;
export type ResolvedEditorMenuItem = core.ResolvedEditorMenuItem<
  EditorContext,
  ComponentIcon
>;
export type EditorKeybindingDefinition =
  core.EditorKeybindingDefinition<EditorContext>;
export type EditorActionRegistry = core.EditorActionRegistry<
  EditorContext,
  ComponentIcon
>;
export function createEditorActionRegistry(): EditorActionRegistry {
  return createRegistry<EditorContext, ComponentIcon>();
}
