import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  CommandError,
  cloneNodeDeep,
  clonePageDeep,
  createDocument,
  createWebDocument,
  createWebPage,
  uniqueWebSlug,
  resolveWebRouteHref,
  createNode,
  createPage,
  deserialize,
  findNode,
  getPageDimensions,
  isDirectBodyNode,
  locateNode,
  createRegion,
  serialize,
  validateDocument,
} from '../src/lib/core/index.js';

function docWithNodes() {
  const doc = createDocument({ name: 'Test', withInitialPage: false });
  const page = createPage({ label: 'P1', withHeader: true });
  applyCommand(doc, { type: 'page:add', payload: { page } });
  const a = createNode('text', { content: 'A' });
  const b = createNode('container', {}, []);
  const c = createNode('text', { content: 'C' });
  applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: a } });
  applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: b } });
  applyCommand(doc, { type: 'component:add', payload: { parentId: b.id, node: c } });
  return { doc, page, a, b, c };
}

describe('factories', () => {
  it('creates a document with one initial A4 page by default', () => {
    const doc = createDocument();
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages[0]!.size.preset).toBe('A4');
    expect(doc.version).toBe('1.5.0');
    expect(doc.meta.medium).toBe('print');
    expect(doc.pagination).toEqual({ mode: 'auto', removeEmptyPages: true });
    expect(doc.styles.tokens.colors.primary).toBeTruthy();
    expect(doc.print.enabled).toBe(true);
    expect(doc.print.footer.variants.default).toContain('{{page.number}}');
  });

  it('creates a responsive website document without print pagination', () => {
    const doc = createWebDocument({ name: 'Website', slug: 'home' });
    expect(doc.version).toBe('1.5.0');
    expect(doc.meta.medium).toBe('web');
    expect(doc.meta.web?.viewportWidth).toBe(1440);
    expect(doc.pages[0]?.web).toMatchObject({ slug: 'home', title: 'Website' });
    expect(doc.pagination.mode).toBe('manual');
    expect(doc.print.enabled).toBe(false);
  });

  it('creates extra website routes with unique slugs and no print margins', () => {
    const doc = createWebDocument({ name: 'Restaurant' });
    const contact = createWebPage({ slug: 'contact' });
    const alsoContact = createWebPage({ slug: uniqueWebSlug([...doc.pages, contact], 'contact') });
    applyCommand(doc, { type: 'page:add', payload: { page: contact } });
    applyCommand(doc, { type: 'page:add', payload: { page: alsoContact } });
    expect(contact.web).toMatchObject({ slug: 'contact', title: 'Contact' });
    expect(contact.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(alsoContact.web?.slug).toBe('contact-2');
    expect(uniqueWebSlug(doc.pages, '')).toBe('page');
    expect(uniqueWebSlug(doc.pages, 'contact', contact.id)).toBe('contact');
    expect(resolveWebRouteHref(doc, '#contact')).toBe(1);
    expect(resolveWebRouteHref(doc, '/contact')).toBe(1);
    expect(resolveWebRouteHref(doc, '#menu')).toBeNull();
  });

  it('clones a page with fresh ids', () => {
    const page = createWebPage({ slug: 'about' });
    page.regions.body.children.push(createNode('text', { content: 'Hello' }));
    const clone = clonePageDeep(page);
    expect(clone.id).not.toBe(page.id);
    expect(clone.regions.body.id).not.toBe(page.regions.body.id);
    expect(clone.regions.body.children[0]?.id).not.toBe(page.regions.body.children[0]?.id);
    expect(clone.regions.body.children[0]?.props.content).toBe('Hello');
    expect(clone.web?.slug).toBe('about');
  });

  it('finds nodes stored in shared website chrome', () => {
    const doc = createWebDocument({ name: 'Restaurant' });
    const nav = createNode('text', { content: 'Nav' });
    doc.meta.web!.header = createRegion({ children: [nav] });
    expect(locateNode(doc, nav.id)?.parentId).toBe(doc.meta.web?.header?.id);
    expect(locateNode(doc, nav.id)?.pageId).toBe(doc.id);
  });

  it('honours orientation in page dimensions', () => {
    expect(getPageDimensions({ width: 210, height: 297, preset: 'A4' }, 'portrait')).toEqual({
      width: 210,
      height: 297,
    });
    expect(getPageDimensions({ width: 210, height: 297, preset: 'A4' }, 'landscape')).toEqual({
      width: 297,
      height: 210,
    });
  });

  it('deep-clones nodes with fresh ids', () => {
    const original = createNode('container', {}, [createNode('text', { content: 'x' })]);
    const clone = cloneNodeDeep(original);
    expect(clone.id).not.toBe(original.id);
    expect(clone.children![0]!.id).not.toBe(original.children![0]!.id);
    expect(clone.children![0]!.props.content).toBe('x');
  });
});

describe('tree operations', () => {
  it('finds nested nodes', () => {
    const { doc, c } = docWithNodes();
    expect(findNode(doc, c.id)?.props.content).toBe('C');
    expect(findNode(doc, 'nope')).toBeNull();
  });

  it('locates nodes with their siblings and parent', () => {
    const { doc, b, c } = docWithNodes();
    const location = locateNode(doc, c.id);
    expect(location?.parentId).toBe(b.id);
    expect(location?.index).toBe(0);
    expect(location?.region).toBe('body');
  });

  it('distinguishes direct page-body blocks from nested content', () => {
    const { doc, b, c } = docWithNodes();
    expect(isDirectBodyNode(doc, b.id)).toBe(true);
    expect(isDirectBodyNode(doc, c.id)).toBe(false);
    expect(isDirectBodyNode(doc, 'missing')).toBe(false);
  });
});

describe('commands', () => {
  it('adds at an index and clamps out-of-range indices', () => {
    const { doc, page } = docWithNodes();
    const n = createNode('spacer', {});
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, index: 999, node: n },
    });
    const body = doc.pages[0]!.regions.body;
    expect(body.children[body.children.length - 1]!.id).toBe(n.id);
  });

  it('removes nodes', () => {
    const { doc, a } = docWithNodes();
    applyCommand(doc, { type: 'component:remove', payload: { nodeId: a.id } });
    expect(findNode(doc, a.id)).toBeNull();
  });

  it('moves nodes between parents', () => {
    const { doc, a, b } = docWithNodes();
    applyCommand(doc, {
      type: 'component:move',
      payload: { nodeId: a.id, targetParentId: b.id, targetIndex: 0 },
    });
    expect(locateNode(doc, a.id)?.parentId).toBe(b.id);
  });

  it('adjusts index when moving forward within the same parent', () => {
    const { doc, page, a, b } = docWithNodes();
    // body children: [a, b] → move a after b
    applyCommand(doc, {
      type: 'component:move',
      payload: { nodeId: a.id, targetParentId: page.regions.body.id, targetIndex: 2 },
    });
    const ids = doc.pages[0]!.regions.body.children.map((n) => n.id);
    expect(ids).toEqual([b.id, a.id]);
  });

  it('rejects moving a node into its own subtree', () => {
    const { doc, b, c } = docWithNodes();
    expect(() =>
      applyCommand(doc, {
        type: 'component:move',
        payload: { nodeId: b.id, targetParentId: c.id, targetIndex: 0 },
      }),
    ).toThrow(CommandError);
  });

  it('merges prop updates without clobbering other props', () => {
    const { doc, a } = docWithNodes();
    applyCommand(doc, {
      type: 'component:update',
      payload: { nodeId: a.id, changes: { props: { fontSize: 20 } } },
    });
    const node = findNode(doc, a.id)!;
    expect(node.props.fontSize).toBe(20);
    expect(node.props.content).toBe('A');
  });

  it('duplicates a node right after the original', () => {
    const { doc, a, page } = docWithNodes();
    applyCommand(doc, { type: 'component:duplicate', payload: { nodeId: a.id } });
    const children = doc.pages[0]!.regions.body.children;
    expect(children).toHaveLength(3);
    expect(children[1]!.props.content).toBe('A');
    expect(children[1]!.id).not.toBe(a.id);
    expect(page.regions.body.children).toBe(children);
  });

  it('reorders pages', () => {
    const doc = createDocument({ withInitialPage: false });
    const p1 = createPage({ label: 'One' });
    const p2 = createPage({ label: 'Two' });
    applyCommand(doc, { type: 'page:add', payload: { page: p1 } });
    applyCommand(doc, { type: 'page:add', payload: { page: p2 } });
    applyCommand(doc, { type: 'page:reorder', payload: { pageId: p2.id, newIndex: 0 } });
    expect(doc.pages.map((p) => p.label)).toEqual(['Two', 'One']);
  });

  it('updates design tokens via dot paths', () => {
    const doc = createDocument();
    applyCommand(doc, {
      type: 'style:update-tokens',
      payload: { path: 'colors.primary', value: '#ff0000' },
    });
    expect(doc.styles.tokens.colors.primary).toBe('#ff0000');
  });

  it('writes color tokens back onto imported template CSS variables', () => {
    const doc = createWebDocument({
      name: 'Mujo',
      settings: {
        customCss: ':root { --mujo-bg: #040404; --mujo-accent: var(--color-mujo-accent); }',
      },
    });
    doc.styles.tokens.colors['mujo-accent'] = '#d4b374';
    applyCommand(doc, {
      type: 'style:update-tokens',
      payload: { path: 'colors.mujo-accent', value: '#ff2bd6' },
    });
    expect(doc.styles.tokens.colors['mujo-accent']).toBe('#ff2bd6');
    expect(doc.meta.web?.customCss).toContain('--mujo-accent: #ff2bd6');
    expect(doc.meta.web?.customCss).toContain('--mujo-bg: #040404');
  });

  it('renames saved blocks and rejects empty labels', () => {
    const doc = createDocument();
    doc.symbols.push({
      id: 'symbol-card',
      label: 'Card',
      definition: createNode('container', {}),
      overridableProps: [],
    });

    applyCommand(doc, {
      type: 'symbol:rename',
      payload: { symbolId: 'symbol-card', label: '  Summary card  ' },
    });

    expect(doc.symbols[0]?.label).toBe('Summary card');
    expect(() => applyCommand(doc, {
      type: 'symbol:rename',
      payload: { symbolId: 'symbol-card', label: '   ' },
    })).toThrow(CommandError);
  });

  it('deletes saved blocks without deleting placed instances', () => {
    const { doc, a, b } = docWithNodes();
    a.symbolId = 'symbol-card';
    b.symbolId = 'symbol-card';
    const nestedDefinition = createNode('container', {}, [
      { ...createNode('text', { content: 'Nested instance' }), symbolId: 'symbol-card' },
    ]);
    doc.symbols.push(
      {
        id: 'symbol-card',
        label: 'Card',
        definition: createNode('container', {}),
        overridableProps: [],
      },
      {
        id: 'symbol-section',
        label: 'Section',
        definition: nestedDefinition,
        overridableProps: [],
      },
    );

    applyCommand(doc, { type: 'symbol:remove', payload: { symbolId: 'symbol-card' } });

    expect(doc.symbols.map((symbol) => symbol.id)).toEqual(['symbol-section']);
    expect(findNode(doc, a.id)?.symbolId).toBeUndefined();
    expect(findNode(doc, b.id)?.symbolId).toBeUndefined();
    expect(nestedDefinition.children?.[0]?.symbolId).toBeUndefined();
    expect(doc.pages[0]?.regions.body.children).toHaveLength(2);
  });

  it('throws CommandError for unknown ids', () => {
    const doc = createDocument();
    expect(() => applyCommand(doc, { type: 'component:remove', payload: { nodeId: 'nope' } })).toThrow(
      CommandError,
    );
    expect(() => applyCommand(doc, { type: 'page:remove', payload: { pageId: 'nope' } })).toThrow(
      CommandError,
    );
  });

  it('touches meta.updatedAt on every command', () => {
    const doc = createDocument();
    const before = doc.meta.updatedAt;
    applyCommand(doc, {
      type: 'style:update-tokens',
      payload: { path: 'colors.primary', value: '#123456' },
    });
    expect(doc.meta.updatedAt >= before).toBe(true);
  });
});

describe('serialization', () => {
  it('round-trips a document', () => {
    const { doc } = docWithNodes();
    const restored = deserialize(serialize(doc));
    expect(restored).toEqual(doc);
  });

  it('rejects invalid JSON and invalid documents', () => {
    expect(() => deserialize('{oops')).toThrow(/Invalid JSON/);
    expect(() => deserialize('{"version":"9.9.9"}')).toThrow(/No migration path/);
    expect(() => deserialize('{"version":"9.9.9"}', { migrate: false })).toThrow(/Invalid document/);
  });

  it('flags duplicate node ids', () => {
    const { doc, a } = docWithNodes();
    const raw = JSON.parse(serialize(doc));
    raw.pages[0].regions.body.children[1].children.push({ id: a.id, type: 'text', props: {} });
    const result = validateDocument(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('Duplicate node id'))).toBe(true);
  });

  it('rejects malformed nested collections without throwing during validation', () => {
    const { doc } = docWithNodes();
    const raw = JSON.parse(serialize(doc));
    raw.pages[0].regions.body.children[0].children = { unsafe: true };
    raw.styles.rules = [{ id: 'unsafe', selectors: '.not-an-array', properties: null }];

    const result = validateDocument(raw);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path.endsWith('.children'))).toBe(true);
    expect(result.issues.some((issue) => issue.path === 'styles.rules[0].selectors')).toBe(true);
    expect(() => deserialize(JSON.stringify(raw))).toThrow(/Invalid document/);
  });
});
