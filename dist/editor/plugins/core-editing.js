import { createCoreEditingPlugin as createPortablePlugin } from 'exemplara-core/editor';
export function createCoreEditingPlugin() {
    const core = createPortablePlugin();
    return { ...core, core, setup: api => api.installCore(core) };
}
