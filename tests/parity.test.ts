import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createDocument,
  createNode,
  createPage,
  deserialize,
  migrateDocument,
  MigrationError,
  serialize,
} from '../src/lib/core/index.js';
import { render } from '../src/lib/renderer/index.js';

// --- Migrations ---

describe('migrations', () => {
  it('imports legacy Exemplara 0.1.0 documents', () => {
    const legacy = {
      version: '0.1.0',
      id: 'doc-legacy',
      name: 'Legacy Invoice',
      pages: [
        {
          id: 'page-1',
          label: 'Page 1',
          size: { width: 210, height: 297, preset: 'A4' },
          orientation: 'portrait',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          regions: {
            body: { id: 'region-body', children: [{ id: 'n1', type: 'text', props: { content: 'Hello' } }] },
          },
          headerVariant: 'all',
          footerVariant: 'all',
        },
      ],
      styles: { tokens: { colors: { primary: '#123456' } }, rules: [] },
      dataSources: [],
      assets: [],
      symbols: [],
      meta: { createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    };

    const doc = migrateDocument(legacy);
    expect(doc.version).toBe('1.5.0');
    expect(doc.meta.medium).toBe('print');
    expect(doc.name).toBe('Legacy Invoice');
    expect(doc.styles.tokens.colors.primary).toBe('#123456');
    // Missing token groups are backfilled with defaults.
    expect(doc.styles.tokens.spacing.md).toBeTruthy();
    expect(doc.styles.tokens.fonts).toEqual([]);
    expect(doc.print.enabled).toBe(true);

    // And the migrated document round-trips through deserialize.
    const restored = deserialize(JSON.stringify(legacy));
    expect(restored.version).toBe('1.5.0');
    expect(render(restored).html).toContain('Hello');
  });

  it('throws for unknown versions', () => {
    expect(() => migrateDocument({ version: '0.0.1' })).toThrow(MigrationError);
  });

  it('passes through current documents unchanged', () => {
    const doc = createDocument();
    expect(migrateDocument(JSON.parse(serialize(doc)))).toEqual(JSON.parse(serialize(doc)));
  });
});

// --- Renderer parity features ---

describe('renderer parity', () => {
  function makeDoc() {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage({ withFooter: true });
    applyCommand(doc, { type: 'page:add', payload: { page } });
    return { doc, page };
  }

  it('exposes {{page.number}} and {{page.total}}', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, { type: 'page:add', payload: { page: createPage() } });
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.footer!.id,
        node: createNode('text', { content: 'Page {{page.number}} of {{page.total}}' }),
      },
    });
    const { html } = render(doc);
    expect(html).toContain('Page 1 of 2');
  });

  it('renders formatted page numbering', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'page:update',
      payload: {
        pageId: page.id,
        changes: {
          pageNumbering: { start: 1, format: 'roman', position: 'footer', alignment: 'center' },
        },
      },
    });
    const { html } = render(doc);
    expect(html).toContain('class="ex-page-number"');
    expect(html).toContain('i / i');
  });

  it('applies value styleBindings inline and ruleId bindings as classes', () => {
    const { doc, page } = makeDoc();
    const node = createNode('text', { content: 'styled' });
    node.styleBindings = [
      { property: 'letter-spacing', value: '2px' },
      { property: 'color', ruleId: 'brand' },
    ];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node } });
    const { html } = render(doc);
    expect(html).toContain('letter-spacing: 2px');
    expect(html).toContain('ex-r-brand');
  });

  it('sanitizes rich text content', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: '<b>bold</b><script>alert(1)</script>' }),
      },
    });
    const { html } = render(doc);
    expect(html).toContain('<b>bold</b>');
    expect(html).not.toContain('<script>');
  });
});

// --- PDF / image generation (runs only when a Chromium build is available) ---

function findChromium(): string | null {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH;
  for (const candidate of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (existsSync(candidate)) return candidate;
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    if (entry.startsWith('chromium-')) {
      const candidate = `${root}/${entry}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const chromiumPath = findChromium();

describe('header/footer variants', () => {
  function twoPageDoc() {
    const doc = createDocument({ withInitialPage: false });
    const p1 = createPage({ withHeader: true, withFooter: true });
    const p2 = createPage({ withHeader: true, withFooter: true });
    applyCommand(doc, { type: 'page:add', payload: { page: p1 } });
    applyCommand(doc, { type: 'page:add', payload: { page: p2 } });
    return { doc, p1, p2 };
  }

  it("renders 'first' variant headers only on the first page", () => {
    const { doc, p1, p2 } = twoPageDoc();
    applyCommand(doc, { type: 'page:update', payload: { pageId: p1.id, changes: { headerVariant: 'first' } } });
    applyCommand(doc, { type: 'page:update', payload: { pageId: p2.id, changes: { headerVariant: 'first' } } });
    const { html } = render(doc);
    const [first = '', second = ''] = html.split('data-page-index="1"');
    expect(first).toContain('ex-region--header');
    expect(second).not.toContain('ex-region--header');
    // Footers untouched (variant 'all')
    expect(second).toContain('ex-region--footer');
  });

  it("tags 'odd-even' variant regions with page parity classes", () => {
    const { doc, p1, p2 } = twoPageDoc();
    applyCommand(doc, { type: 'page:update', payload: { pageId: p1.id, changes: { footerVariant: 'odd-even' } } });
    applyCommand(doc, { type: 'page:update', payload: { pageId: p2.id, changes: { footerVariant: 'odd-even' } } });
    const { html } = render(doc);
    const [first = '', second = ''] = html.split('data-page-index="1"');
    expect(first).toContain('ex-region--odd');
    expect(second).toContain('ex-region--even');
  });
});

describe('per-source data bindings', () => {
  it('resolves bindings against their sourceId, not the merged context', () => {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage();
    applyCommand(doc, { type: 'page:add', payload: { page } });
    applyCommand(doc, {
      type: 'data:add-source',
      payload: { source: { id: 'crm', name: 'CRM', type: 'static', sampleData: { name: 'From CRM' } } },
    });
    applyCommand(doc, {
      type: 'data:add-source',
      payload: { source: { id: 'erp', name: 'ERP', type: 'static', sampleData: { name: 'From ERP' } } },
    });

    const crmBound = createNode('text', { content: '' });
    crmBound.dataBindings = [{ targetProp: 'content', sourceId: 'crm', path: 'name' }];
    const erpBound = createNode('text', { content: '' });
    erpBound.dataBindings = [{ targetProp: 'content', sourceId: 'erp', path: 'name' }];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: crmBound } });
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: erpBound } });

    const { html } = render(doc, { dataContext: { name: 'Ambient' } });
    expect(html).toContain('From CRM');
    expect(html).toContain('From ERP');
    expect(html).not.toContain('Ambient');
  });

  it('falls back to the ambient context for unknown sources and repeater scope', () => {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage();
    applyCommand(doc, { type: 'page:add', payload: { page } });

    const bound = createNode('text', { content: '' });
    bound.dataBindings = [{ targetProp: 'content', sourceId: 'nope', path: 'greeting', fallback: 'none' }];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: bound } });

    expect(render(doc, { dataContext: { greeting: 'Hi!' } }).html).toContain('Hi!');
    expect(render(doc).html).toContain('none');
  });

  it('overrides document sample data via options.dataSources', () => {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage();
    applyCommand(doc, { type: 'page:add', payload: { page } });
    applyCommand(doc, {
      type: 'data:add-source',
      payload: { source: { id: 'crm', name: 'CRM', type: 'static', sampleData: { name: 'Sample' } } },
    });
    const bound = createNode('text', { content: '' });
    bound.dataBindings = [{ targetProp: 'content', sourceId: 'crm', path: 'name' }];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: bound } });

    const { html } = render(doc, { dataSources: { crm: { name: 'Live!' } } });
    expect(html).toContain('Live!');
  });

  it('applies named binding transforms', () => {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage();
    applyCommand(doc, { type: 'page:add', payload: { page } });
    const bound = createNode('text', { content: '' });
    bound.dataBindings = [{ targetProp: 'content', sourceId: 'local', path: 'status', transform: 'uppercase' }];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: bound } });

    expect(render(doc, { dataContext: { status: 'paid' } }).html).toContain('PAID');
  });
});

describe('print sheet mode & margin guides', () => {
  function oneA4() {
    const doc = createDocument({ withInitialPage: false });
    applyCommand(doc, { type: 'page:add', payload: { page: createPage() } });
    return doc;
  }

  it("uses min-height in default 'flow' mode and exact height in 'fixed'", () => {
    const doc = oneA4();
    expect(render(doc).html).toContain('min-height: 297mm');
    const fixed = render(doc, { sheetMode: 'fixed' }).html;
    expect(fixed).toContain('height: 297mm');
    expect(fixed).not.toContain('min-height: 297mm');
  });

  it('draws margin guides inset by the page margins, hidden in print', () => {
    const doc = oneA4();
    const { html, css } = render(doc, { showMarginGuides: true });
    expect(html).toContain('class="ex-margin-guide"');
    expect(html).toContain('top: 20mm; right: 20mm; bottom: 20mm; left: 20mm');
    expect(css).toMatch(/@media print \{ \.ex-margin-guide \{ display: none; \} \}/);
    // Off by default
    expect(render(doc).html).not.toContain('ex-margin-guide');
  });
});

describe('page background', () => {
  it('applies background region style in rendered output', () => {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage({ withBackground: true });
    page.regions.background!.style = { background: '#fef3c7' };
    applyCommand(doc, { type: 'page:add', payload: { page } });
    const { html } = render(doc);
    expect(html).toContain('background: #fef3c7');
  });
});
