import { createCoreEditingPlugin as createPortablePlugin } from 'exemplara-core/editor';
import type { EditorPlugin } from '../composition.js';

export function createCoreEditingPlugin(): EditorPlugin {
  const core = createPortablePlugin();
  return { ...core, core, setup: api => api.installCore(core) };
}
