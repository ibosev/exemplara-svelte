import { describe, expect, it } from 'vitest';
import { EditorSession, createFullEditorPreset } from 'exemplara-core/editor';
import { resolveSectionTemplate } from '../src/lib/core/print-sections.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('core-owned component state', () => {
  it('keeps upload progress accurate across concurrent imports', async () => {
    const editor = new EditorSession({ composition: createFullEditorPreset() });
    const first = deferred<{ src: string }>(), second = deferred<{ src: string }>();
    const one = editor.ui.importAssets([{ name: 'one.png', type: 'image/png', read: () => first.promise }]);
    const two = editor.ui.importAssets([{ name: 'two.png', type: 'image/png', read: () => second.promise }]);
    const progress = editor.ui.get('assets').store;
    expect(progress.get().pendingImports).toBe(2);
    first.resolve({ src: 'data:image/png;base64,AA==' }); await one;
    expect(progress.get().uploading).toBe(true);
    expect(progress.get().pendingImports).toBe(1);
    second.resolve({ src: 'data:image/png;base64,AQ==' }); await two;
    expect(progress.get().uploading).toBe(false);
    expect(progress.get().pendingImports).toBe(0);
    expect(editor.doc.assets.map(asset => asset.name)).toEqual(['one.png', 'two.png']);
    editor.destroy();
  });

  it('resets print drafts from the canonical document after committing', () => {
    const editor = new EditorSession({ composition: createFullEditorPreset() });
    const target = resolveSectionTemplate(editor.doc, 'header', 0);
    const model = editor.ui.get('printChrome', JSON.stringify(['header', 0, target.variant]));
    expect(model.store.get().draftHtml).toBe(target.html);
    model.set('draftHtml', '<strong>Draft</strong>');
    editor.updatePrintVariantForPage('header', 0, target.variant, '<strong>Applied</strong>');
    model.reset();
    expect(model.store.get().draftHtml).toBe('<strong>Applied</strong>');
    const source = editor.ui.get('printSourceDraft');
    source.set('cssDraft', '.pending { color: red; }');
    const detach = editor.registerViewAdapter({}); detach();
    expect(source.store.get().cssDraft).toBe('.pending { color: red; }');
    editor.destroy();
  });
});
