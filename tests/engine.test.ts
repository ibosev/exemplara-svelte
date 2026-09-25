import { describe, expect, it } from 'vitest';
import { DocumentEngine } from '../src/lib/core/engine.js';
import { createDocument, createNode, createPage } from '../src/lib/core/create.js';
import { findNode } from '../src/lib/core/tree.js';

function makeEngine() {
  const doc = createDocument({ name: 'Engine test', withInitialPage: false });
  const page = createPage({ label: 'P1' });
  doc.pages.push(page);
  const engine = new DocumentEngine({ document: doc });
  return { engine, page };
}

describe('DocumentEngine (portable)', () => {
  it('executes commands and advances its portable revision', () => {
    const { engine, page } = makeEngine();
    const node = createNode('text', { content: 'hello' });
    engine.execute({ type: 'component:add', payload: { parentId: page.regions.body.id, node } });
    expect(findNode(engine.doc, node.id)?.props.content).toBe('hello');
    expect(engine.revision).toBe(1);
  });

  it('increments revision once for batches and history navigation', () => {
    const { engine, page } = makeEngine();
    engine.batch([
      { type: 'component:add', payload: { parentId: page.regions.body.id, node: createNode('text', {}) } },
      { type: 'component:add', payload: { parentId: page.regions.body.id, node: createNode('text', {}) } },
    ]);
    expect(engine.revision).toBe(1);
    engine.undo();
    expect(engine.revision).toBe(2);
    engine.redo();
    expect(engine.revision).toBe(3);
  });

  it('undoes and redoes', () => {
    const { engine, page } = makeEngine();
    expect(engine.canUndo).toBe(false);

    const node = createNode('text', { content: 'hello' });
    engine.execute({ type: 'component:add', payload: { parentId: page.regions.body.id, node } });
    expect(engine.canUndo).toBe(true);

    engine.undo();
    expect(findNode(engine.doc, node.id)).toBeNull();
    expect(engine.canRedo).toBe(true);

    engine.redo();
    expect(findNode(engine.doc, node.id)?.props.content).toBe('hello');
  });

  it('treats a batch as one undo step', () => {
    const { engine, page } = makeEngine();
    const n1 = createNode('text', { content: '1' });
    const n2 = createNode('text', { content: '2' });
    engine.batch([
      { type: 'component:add', payload: { parentId: page.regions.body.id, node: n1 } },
      { type: 'component:add', payload: { parentId: page.regions.body.id, node: n2 } },
    ]);
    expect(engine.doc.pages[0]!.regions.body.children).toHaveLength(2);

    engine.undo();
    expect(engine.doc.pages[0]!.regions.body.children).toHaveLength(0);
  });

  it('rolls back a failed command without polluting history', () => {
    const { engine, page } = makeEngine();
    const node = createNode('text', { content: 'ok' });
    engine.execute({ type: 'component:add', payload: { parentId: page.regions.body.id, node } });

    expect(() =>
      engine.execute({ type: 'component:remove', payload: { nodeId: 'does-not-exist' } }),
    ).toThrow();

    // Document unchanged, and a single undo removes the first node.
    expect(engine.doc.pages[0]!.regions.body.children).toHaveLength(1);
    engine.undo();
    expect(engine.doc.pages[0]!.regions.body.children).toHaveLength(0);
    expect(engine.canUndo).toBe(false);
  });

  it('clears redo on new command', () => {
    const { engine, page } = makeEngine();
    engine.execute({
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('spacer', {}) },
    });
    engine.undo();
    expect(engine.canRedo).toBe(true);
    engine.execute({
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('divider', {}) },
    });
    expect(engine.canRedo).toBe(false);
  });

  it('caps history at the configured limit', () => {
    const doc = createDocument({ withInitialPage: false });
    doc.pages.push(createPage());
    const engine = new DocumentEngine({ document: doc, historyLimit: 3 });
    const bodyId = engine.doc.pages[0]!.regions.body.id;
    for (let i = 0; i < 6; i++) {
      engine.execute({
        type: 'component:add',
        payload: { parentId: bodyId, node: createNode('spacer', { height: i }) },
      });
    }
    let undos = 0;
    while (engine.undo()) undos++;
    expect(undos).toBe(3);
  });

  it('load() replaces the document and clears history', () => {
    const { engine, page } = makeEngine();
    engine.execute({
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('spacer', {}) },
    });
    engine.load(createDocument({ name: 'Fresh' }));
    expect(engine.doc.name).toBe('Fresh');
    expect(engine.canUndo).toBe(false);
    expect(engine.canRedo).toBe(false);
  });

  it('detaches reactive proxies when documents enter the engine', () => {
    const initial = createDocument({ name: 'Reactive initial document' });
    const proxiedInitial = new Proxy(initial, {});
    expect(() => structuredClone(proxiedInitial)).toThrow();

    const engine = new DocumentEngine({ document: proxiedInitial });
    expect(engine.doc).not.toBe(proxiedInitial);
    expect(engine.snapshot().name).toBe('Reactive initial document');

    const replacement = createDocument({ name: 'Reactive replacement document' });
    const proxiedReplacement = new Proxy(replacement, {});
    engine.load(proxiedReplacement);

    expect(engine.doc).not.toBe(proxiedReplacement);
    expect(engine.snapshot().name).toBe('Reactive replacement document');
  });
});
