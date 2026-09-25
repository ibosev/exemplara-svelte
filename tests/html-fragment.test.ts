import { describe, expect, it } from 'vitest';
import { createDocument, createNode, createPage, createWebDocument } from '../src/lib/core/index.js';
import { applyHtmlImportFragment } from '../src/lib/shared/html-fragment.js';

function importedFragment() {
  const document = createDocument({ name: 'Fragment' });
  const node = createNode('container', {}, [
    createNode('text', { content: 'AI approval block' }),
  ]);
  node.styleBindings = [{ property: 'class', ruleId: 'approval' }];
  document.pages[0]!.regions.body.children = [node];
  document.styles.rules = [{
    id: 'approval',
    name: 'approval',
    selectors: ['.ex-r-approval'],
    properties: { border: '1px solid #111' },
  }];
  return { document, warnings: ['Unsupported selector omitted'] };
}

function importedWebFragment() {
  const fragment = importedFragment();
  fragment.document.meta.medium = 'web';
  fragment.document.meta.web = {
    ...createWebDocument().meta.web!,
    customCss: '.catalog-card { display: grid; }',
    importMode: 'lossless-html',
  };
  return fragment;
}

describe('HTML fragment application', () => {
  it('inserts after a nested selected node without replacing its siblings', () => {
    const document = createDocument({ name: 'Target' });
    const first = createNode('text', { content: 'First' });
    const selected = createNode('text', { content: 'Selected' });
    const last = createNode('text', { content: 'Last' });
    const container = createNode('container', {}, [first, selected, last]);
    document.pages[0]!.regions.body.children = [container];

    const result = applyHtmlImportFragment(document, importedFragment(), {
      selectedNodeId: selected.id,
      activePageId: document.pages[0]!.id,
    });

    expect(result.insertedAfterSelection).toBe(true);
    expect(result.replacedSelection).toBe(false);
    expect(result.document.pages[0]!.regions.body.children[0]!.children?.map((node) => node.id))
      .toEqual([first.id, selected.id, result.nodeIds[0], last.id]);
    expect(document.pages[0]!.regions.body.children[0]!.children).toHaveLength(3);
  });

  it('replaces a nested selected node in place', () => {
    const document = createDocument({ name: 'Target' });
    const first = createNode('text', { content: 'First' });
    const selected = createNode('text', { content: 'Selected' });
    const last = createNode('text', { content: 'Last' });
    const container = createNode('container', {}, [first, selected, last]);
    document.pages[0]!.regions.body.children = [container];

    const result = applyHtmlImportFragment(document, importedFragment(), {
      selectedNodeId: selected.id,
      placement: 'replace',
    });

    expect(result.replacedSelection).toBe(true);
    expect(result.insertedAfterSelection).toBe(false);
    expect(result.document.pages[0]!.regions.body.children[0]!.children?.map((node) => node.id))
      .toEqual([first.id, result.nodeIds[0], last.id]);
    expect(document.pages[0]!.regions.body.children[0]!.children?.map((node) => node.id))
      .toEqual([first.id, selected.id, last.id]);
  });

  it('inserts beside a selection in a print region instead of falling back to the body', () => {
    const document = createDocument({ name: 'Target' });
    const header = createNode('text', { content: 'Header' });
    document.pages[0]!.regions.header = {
      id: crypto.randomUUID(),
      children: [header],
    };

    const result = applyHtmlImportFragment(document, importedFragment(), {
      selectedNodeId: header.id,
    });

    expect(result.insertedAfterSelection).toBe(true);
    expect(result.document.pages[0]!.regions.header?.children.map((node) => node.id))
      .toEqual([header.id, result.nodeIds[0]]);
    expect(result.document.pages[0]!.regions.body.children).toHaveLength(0);
  });

  it('does not silently append when a replacement selection is missing', () => {
    const document = createDocument({ name: 'Target' });

    expect(() => applyHtmlImportFragment(document, importedFragment(), {
      selectedNodeId: 'missing',
      placement: 'replace',
    })).toThrow('selected element is no longer available');
  });

  it('uses the active page when there is no selection', () => {
    const document = createDocument({ name: 'Target' });
    const secondPage = createPage({ label: 'Second' });
    document.pages.push(secondPage);

    const result = applyHtmlImportFragment(document, importedFragment(), {
      activePageId: secondPage.id,
    });

    expect(result.document.pages[0]!.regions.body.children).toHaveLength(0);
    expect(result.document.pages[1]!.regions.body.children.map((node) => node.id))
      .toEqual(result.nodeIds);
  });

  it('remaps imported style ids and carries conversion warnings', () => {
    const document = createDocument({ name: 'Target' });
    document.styles.rules = [{
      id: 'approval',
      selectors: ['.ex-r-approval'],
      properties: { color: 'red' },
    }];

    const result = applyHtmlImportFragment(document, importedFragment());
    const importedRule = result.document.styles.rules[1]!;
    const importedNode = result.document.pages[0]!.regions.body.children[0]!;

    expect(importedRule.id).not.toBe('approval');
    expect(importedRule.selectors).toEqual([`.ex-r-${importedRule.id}`]);
    expect(importedNode.styleBindings?.[0]?.ruleId).toBe(importedRule.id);
    expect(result.warnings).toEqual(['Unsupported selector omitted']);
  });

  it('merges fragment CSS into an existing web document without duplicating it', () => {
    const document = createWebDocument({ name: 'Website' });
    document.meta.web!.customCss = '.existing { color: red; }';

    const once = applyHtmlImportFragment(document, importedWebFragment());
    const twice = applyHtmlImportFragment(once.document, importedWebFragment());

    expect(once.document.meta.web?.customCss).toContain('.existing { color: red; }');
    expect(once.document.meta.web?.customCss).toContain('.catalog-card { display: grid; }');
    expect(twice.document.meta.web?.customCss?.match(/\.catalog-card/g)).toHaveLength(1);
  });
});
