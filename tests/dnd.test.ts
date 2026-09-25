import { describe, expect, it, vi } from 'vitest';
import { createDocument, createNode } from '../src/lib/core/create.js';
import { findNode } from '../src/lib/core/tree.js';
import { EditorContext } from '../src/lib/editor/context.svelte.js';
import { applyDragPayload } from '../src/lib/editor/dnd.svelte.js';

describe('Blocks and Assets drag payloads', () => {
  it('dispatches asset and saved-block payloads to the resolved canvas target', () => {
    const editor = {
      insertAssetImage: vi.fn(),
      insertSymbolInstance: vi.fn(),
    } as unknown as EditorContext;
    const target = { parentId: 'columns-1', index: 2, slot: 'col2' };

    applyDragPayload(editor, { kind: 'asset', assetId: 'asset-1' }, target);
    applyDragPayload(editor, { kind: 'symbol', symbolId: 'symbol-1' }, target);

    expect(editor.insertAssetImage).toHaveBeenCalledWith('asset-1', 'columns-1', 2, 'col2');
    expect(editor.insertSymbolInstance).toHaveBeenCalledWith('symbol-1', 'columns-1', 2, 'col2');
  });

  it('creates an image node from a document asset at an explicit position', () => {
    const document = createDocument();
    document.assets.push({
      id: 'asset-logo',
      type: 'svg',
      name: 'Company logo',
      src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      width: 640,
    });
    const editor = new EditorContext({ document });
    const body = editor.doc.pages[0]!.regions.body;
    body.children.push(createNode('text', { content: 'Existing' }));

    const image = editor.insertAssetImage('asset-logo', body.id, 0);

    expect(body.children).toHaveLength(1); // The engine owns a cloned document after insertion.
    expect(editor.doc.pages[0]!.regions.body.children[0]).toMatchObject({
      id: image?.id,
      type: 'image',
      props: {
        src: document.assets[0]!.src,
        alt: 'Company logo',
        width: '400px',
      },
    });
    editor.destroy();
  });

  it('delegates host-backed block insertion to the block adapter', () => {
    const document = createDocument();
    const bodyId = document.pages[0]!.regions.body.id;
    const inserted = createNode('container', {}, [createNode('text', { content: 'Server block' })]);
    const insert = vi.fn(({ editor, parentId, index, slot }) => {
      editor.engine.execute({
        type: 'component:add',
        payload: { parentId, index, slot, node: inserted },
      });
      return inserted;
    });
    const editor = new EditorContext({
      document,
      extensions: [(api) => api.addBlock({
        id: 'server.block',
        label: 'Server block',
        category: 'Catalog',
        insert,
      })],
    });

    expect(editor.addBlock('server.block', bodyId, 0)).toBe(inserted);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      editor,
      parentId: bodyId,
      index: 0,
    }));
    expect(editor.doc.pages[0]!.regions.body.children[0]?.id).toBe(inserted.id);
    editor.destroy();
  });

  it('replaces native and imported HTML image sources with an existing asset', () => {
    const document = createDocument();
    const asset = {
      id: 'asset-photo',
      type: 'image' as const,
      name: 'Team photo',
      src: 'data:image/png;base64,photo',
    };
    const nativeImage = createNode('image', { src: 'missing.jpg', alt: '' });
    const htmlImage = createNode('html-element', {
      tagName: 'img',
      attributes: { src: 'images/missing.jpg', alt: '', srcset: 'images/missing@2x.jpg 2x' },
      previewAttributes: { src: 'https://preview.test/missing.jpg' },
    });
    document.assets.push(asset);
    document.pages[0]!.regions.body.children.push(nativeImage, htmlImage);
    const editor = new EditorContext({ document });

    expect(editor.applyAssetToImage(asset.id, nativeImage.id)).toBe(true);
    expect(findNode(editor.doc, nativeImage.id)?.props).toMatchObject({
      src: asset.src,
      alt: asset.name,
    });

    expect(editor.applyAssetToImage(asset.id, htmlImage.id)).toBe(true);
    expect(findNode(editor.doc, htmlImage.id)?.props).toMatchObject({
      attributes: { src: asset.src, alt: asset.name },
      previewAttributes: {},
    });
    expect((findNode(editor.doc, htmlImage.id)?.props.attributes as Record<string, unknown>).srcset)
      .toBeUndefined();
    editor.destroy();
  });

  it('inserts a fresh saved-block instance inside a nested container', () => {
    const document = createDocument();
    const container = createNode('container', {});
    document.pages[0]!.regions.body.children.push(container);
    document.symbols.push({
      id: 'saved-callout',
      label: 'Callout',
      definition: createNode('text', { content: 'Reusable callout' }),
      overridableProps: [],
    });
    const editor = new EditorContext({ document });

    const instance = editor.insertSymbolInstance('saved-callout', container.id, 0);
    const insertedContainer = findNode(editor.doc, container.id);

    expect(insertedContainer?.children?.[0]).toMatchObject({
      id: instance?.id,
      type: 'text',
      symbolId: 'saved-callout',
      props: { content: 'Reusable callout' },
    });
    expect(instance?.id).not.toBe(document.symbols[0]!.definition.id);
    editor.destroy();
  });
});
