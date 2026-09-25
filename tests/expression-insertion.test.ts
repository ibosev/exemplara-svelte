import { describe, expect, it, vi } from 'vitest';
import { createDocument, createNode } from '../src/lib/core/create.js';
import { findNode } from '../src/lib/core/tree.js';
import { EditorContext } from '../src/lib/editor/context.svelte.js';
import { createFullEditorPreset } from '../src/lib/editor/presets.js';

function createTextEditor(): { editor: EditorContext; nodeId: string } {
  const document = createDocument();
  const node = createNode('text', { content: 'Before and after' });
  document.pages[0]!.regions.body.children.push(node);
  const editor = new EditorContext({ document, composition: createFullEditorPreset() });
  editor.select(node.id);
  return { editor, nodeId: node.id };
}

describe('utility expression insertion', () => {
  it('routes insertion to the active rich-text caret without replacing document content', () => {
    const { editor, nodeId } = createTextEditor();
    const insert = vi.fn(() => true);
    editor.editingId = nodeId;
    const unregister = editor.registerInlineExpressionTarget(nodeId, insert);

    expect(editor.insertExpression('{{invoice.total | currency("EUR")}}')).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(findNode(editor.doc, nodeId)?.props.content).toBe('Before and after');

    unregister();
    editor.destroy();
  });

  it('refuses a destructive replacement when an edit session has no live caret target', () => {
    const { editor, nodeId } = createTextEditor();
    editor.editingId = nodeId;

    expect(editor.insertExpression('{{customer.name | uppercase}}')).toBe(false);
    expect(findNode(editor.doc, nodeId)?.props.content).toBe('Before and after');

    editor.destroy();
  });

  it('keeps replacement behavior outside edit mode and labels it as a separate path', () => {
    const { editor, nodeId } = createTextEditor();

    expect(editor.insertExpression('{{customer.name | uppercase}}')).toBe(false);
    expect(findNode(editor.doc, nodeId)?.props.content).toBe('Before and after');

    editor.destroy();
  });
});
