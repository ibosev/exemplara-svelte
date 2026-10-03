import { describe, expect, it } from 'vitest';
import { EditorSession, createFullEditorPreset as corePreset } from 'exemplara-core/editor';
import { DocumentEngine } from 'exemplara-core/core';
import { EditorContext } from '../src/lib/editor/context.svelte.js';
import { createFullEditorPreset } from '../src/lib/editor/presets.js';
import { toCoreComposition } from '../src/lib/editor/composition.js';
import { DocumentEngine as CompatibilityEngine } from '../src/lib/core/engine.js';

describe('Svelte session adapter', () => {
  it('reuses canonical constructor identities through existing imports', () => { expect(CompatibilityEngine).toBe(DocumentEngine); });
  it('retains selection, history and zoom across detach and reattach', () => {
    const composition = createFullEditorPreset();
    const session = new EditorSession({ composition: toCoreComposition(composition) });
    const first = new EditorContext({ composition, session });
    const node = first.addComponent('text', first.activePage!.regions.body.id);
    first.zoom = 1.25;
    expect(first.selectedNode?.id).toBe(node.id);
    first.destroy(); expect(session.destroyed).toBe(false);
    const second = new EditorContext({ composition, session });
    expect(second.engine).toBe(first.engine);
    expect(second.selectedNode?.id).toBe(node.id); expect(second.zoom).toBe(1.25);
    second.undo(); expect(second.doc.pages[0]!.regions.body.children).toHaveLength(0);
    second.destroy(); session.destroy();
  });
  it('owns only internally created sessions and supports headless preset sessions', () => {
    const external = new EditorSession({ composition: corePreset() });
    const view = new EditorContext({ session: external, composition: createFullEditorPreset() });
    expect(view.extensions.panels).toHaveLength(3); view.destroy(); expect(external.destroyed).toBe(false); external.destroy();
    const own = new EditorContext(); own.destroy(); expect(own.session.destroyed).toBe(true);
  });
  it('rejects mismatched externally owned compositions before installing behavior', () => {
    const session = new EditorSession();
    expect(() => new EditorContext({ session, composition: createFullEditorPreset() })).toThrow(/matching core composition/);
    expect(session.destroyed).toBe(false); session.destroy();
  });
  it('starts portable lifecycle once while two successive views attach', () => {
    let starts = 0, stops = 0;
    const core = { id: 'test.lifecycle', version: '1', setup(api: import('exemplara-core/editor').EditorExtensionApi) { api.onSession(() => { starts++; return () => stops++; }); } };
    const composition = createFullEditorPreset({ plugins: [{ ...core, core, setup: api => api.installCore(core) }] });
    const session = new EditorSession({ composition: toCoreComposition(composition) });
    const first = new EditorContext({ session, composition }); first.destroy();
    const second = new EditorContext({ session, composition }); second.destroy();
    expect(starts).toBe(1); expect(stops).toBe(0); session.destroy(); expect(stops).toBe(1);
  });
  it('installs identified behavior once behind an adapted legacy extension id', () => {
    let setups = 0;
    const core = { id: 'portable.legacy', version: '1', setup(api: import('exemplara-core/editor').EditorExtensionApi) { setups++; api.addCommand({ id: 'portable.command', label: 'Portable', execute: () => true }); } };
    const extension = Object.assign((api: import('../src/lib/editor/extensions.js').EditorExtensionApi) => api.installCore(core), { core });
    const composition = createFullEditorPreset({ extensions: [extension] });
    const session = new EditorSession({ composition: toCoreComposition(composition) });
    const first = new EditorContext({ session, composition }); first.destroy();
    const second = new EditorContext({ session, composition });
    expect(second.extensions.command('portable.command')).toBeDefined();
    second.destroy(); expect(setups).toBe(1); session.destroy();
  });

});
