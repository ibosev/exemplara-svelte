import { flushSync, mount, tick, unmount } from 'svelte';
import { createDocument, createNode } from 'exemplara-core/core';
import ComposableEditor from '../src/lib/editor/ComposableEditor.svelte';
import { EditorContext } from '../src/lib/editor/context.svelte.js';
import { createFullEditorPreset } from '../src/lib/editor/presets.js';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function escapedUnknownNode() {
  const doc = createDocument();
  doc.pagination.mode = 'manual';
  const payload = '<img src="data:," onerror="globalThis.__exemplaraXss=1"> & <script>bad()</script>';
  doc.pages[0]!.regions.body.children.push(createNode(payload));
  const target = document.createElement('div');
  document.body.append(target);
  const editor = mount(ComposableEditor, { target, props: { document: doc, composition: createFullEditorPreset() } });
  try {
    await tick();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    assert(target.querySelector('img, script') === null, 'Unknown node type injected HTML');
    assert(Reflect.get(globalThis, '__exemplaraXss') !== 1, 'Unknown type executed an event handler');
    assert(target.querySelector('.exs-node')?.textContent?.includes(payload), 'Unknown type must remain visible as literal text');
  } finally {
    await unmount(editor);
    target.remove();
    Reflect.deleteProperty(globalThis, '__exemplaraXss');
  }
}

function selectiveReads() {
  const doc = createDocument();
  doc.pagination.mode = 'manual';
  const node = createNode('text', { content: 'Text' });
  doc.pages[0]!.regions.body.children.push(node);
  const core = { id: 'test.data', version: '1', provides: ['data.resolve'] as const, setup() {} };
  const composition = createFullEditorPreset({ plugins: [{ ...core, core, setup: api => api.installCore(core) }] });
  const editor = new EditorContext({ document: doc, composition });
  let definitions = 0, data = 0, immutable = 0, theme = 0, panels = 0;
  let paste = false;
  const stop = $effect.root(() => {
    $effect(() => { editor.getDefinition('text'); definitions++; });
    $effect(() => { editor.getDataContext(); data++; });
    $effect(() => { editor.expressionRuntime; editor.hasPlugin('test.data'); editor.isProvidedCapabilityEnabled('data.resolve'); immutable++; });
    $effect(() => { editor.isDarkChrome(); theme++; });
    $effect(() => { editor.isPanelCompact('left'); panels++; });
    $effect(() => { paste = editor.canRunCommand('node.paste-after'); });
  });
  try {
    flushSync();
    editor.session.hoveredId = node.id;
    editor.session.zoom = 1.25;
    flushSync();
    assert(definitions === 1 && data === 1 && immutable === 1 && theme === 1 && panels === 1, 'Unrelated hover/zoom invalidated render getters');
    editor.session.engine.execute({ type: 'data:add-source', payload: { source: {
      id: 'customer', name: 'Customer', type: 'static', sampleData: { customer: { name: 'Jane' } },
    } } });
    flushSync();
    assert(data === 2 && definitions === 1 && immutable === 1, 'Data changes did not update only the relevant render getters');
    assert((editor.getDataContext().customer as { name: string }).name === 'Jane', 'Data getter returned stale data');
    editor.registryRevision++;
    flushSync();
    assert(definitions === 2 && data === 2, 'Definition getter did not track registry revisions');
    editor.session.dark = !editor.session.dark;
    editor.session.leftPanelCompact = !editor.session.leftPanelCompact;
    flushSync();
    assert(theme === 2 && panels === 2, 'Theme/panel getters lost their dependencies');
    editor.session.clipboard = node;
    flushSync();
    assert(paste, 'Command predicates must keep tracking arbitrary session state');
    editor.session.clipboard = null;
    flushSync();
    assert(!paste, 'Command predicates retained stale enabled state');
  } finally { stop(); editor.destroy(); }
}

export async function runRegressions() {
  const results: { name: string; error?: string }[] = [];
  for (const test of [escapedUnknownNode, selectiveReads]) {
    try { await test(); results.push({ name: test.name }); }
    catch (error) { results.push({ name: test.name, error: String(error) }); }
  }
  return results;
}
