import { describe, expect, it } from 'vitest';
import { applyCommand, createDocument, createNode, createPage } from '../src/lib/core/index.js';
import {
  evaluateCondition,
  columnPresentation,
  containerPresentation,
  createRenderRuntime,
  interpolate,
  registerRenderer,
  render,
  renderPrintTemplateDocument,
  renderPrintTemplateSourceDocument,
  renderScopedDocumentStyles,
  resolvePath,
  unregisterRenderer,
} from '../src/lib/renderer/index.js';

function makeDoc() {
  const doc = createDocument({ name: 'Render test', withInitialPage: false });
  const page = createPage({ label: 'P1', withHeader: true, withFooter: true });
  applyCommand(doc, { type: 'page:add', payload: { page } });
  return { doc, page };
}

describe('data utilities', () => {
  it('resolves dot paths including array indices', () => {
    const ctx = { user: { tags: ['a', 'b'] }, n: 0 };
    expect(resolvePath(ctx, 'user.tags.1')).toBe('b');
    expect(resolvePath(ctx, 'n')).toBe(0);
    expect(resolvePath(ctx, 'user.missing.deep')).toBeUndefined();
  });

  it('interpolates {{path}} templates', () => {
    expect(interpolate('Hi {{user.name}}!', { user: { name: 'Ada' } })).toBe('Hi Ada!');
    expect(interpolate('{{missing}}', {})).toBe('');
  });

  it('evaluates conditions', () => {
    const ctx = { tier: 'premium', count: 5, empty: [], name: '' };
    expect(evaluateCondition(ctx, 'tier', 'eq', 'premium')).toBe(true);
    expect(evaluateCondition(ctx, 'count', 'gt', 3)).toBe(true);
    expect(evaluateCondition(ctx, 'count', 'lt', 3)).toBe(false);
    expect(evaluateCondition(ctx, 'tier', 'exists')).toBe(true);
    expect(evaluateCondition(ctx, 'nope', 'exists')).toBe(false);
    expect(evaluateCondition(ctx, 'empty', 'empty')).toBe(true);
    expect(evaluateCondition(ctx, 'name', 'empty')).toBe(true);
  });
});

describe('render pipeline', () => {
  it('renders pages, regions and components with stable structure', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: 'Hello', fontSize: 24 }),
      },
    });

    const { html, css, fullHtml } = render(doc);
    expect(html).toContain('class="ex-document"');
    expect(html).toContain('ex-region--body');
    expect(html).toContain('Hello');
    expect(html).toContain('font-size: 24px');
    expect(css).toContain('@page');
    expect(css).toContain('size: 210mm 297mm');
    expect(css).toContain('--color-primary');
    expect(fullHtml.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(fullHtml).toContain('<title>Render test</title>');
  });

  it('escapes plain text content', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: 'a < b & c' }),
      },
    });
    const { html } = render(doc);
    expect(html).toContain('a &lt; b &amp; c');
  });

  it('applies interpolation and data bindings', () => {
    const { doc, page } = makeDoc();
    const bound = createNode('text', { content: '' });
    bound.dataBindings = [
      { targetProp: 'content', sourceId: 'local', path: 'customer.name', fallback: 'Unknown' },
    ];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: bound } });
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: 'Total: {{total}}' }),
      },
    });

    const withData = render(doc, { dataContext: { customer: { name: 'Acme' }, total: '$12' } });
    expect(withData.html).toContain('Acme');
    expect(withData.html).toContain('Total: $12');

    const withoutData = render(doc);
    expect(withoutData.html).toContain('Unknown');
  });

  it('removes contenteditable comment markers around interpolated bindings', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', {
          content: 'Plan for {{company.name}}<!----><!-- -->',
        }),
      },
    });

    const { html } = render(doc, {
      dataContext: { company: { name: 'Shablonix Studio' } },
    });

    expect(html).toContain('Plan for Shablonix Studio');
    expect(html).not.toContain('&lt;!--');
  });

  it('renders repeater children once per item with scoped context', () => {
    const { doc, page } = makeDoc();
    const repeater = createNode('repeater', { sourceId: 'local', path: 'items', maxItems: 0 }, [
      createNode('text', { content: '{{index}}: {{item.label}}' }),
    ]);
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: repeater } });

    const { html } = render(doc, {
      dataContext: { items: [{ label: 'first' }, { label: 'second' }] },
    });
    expect(html).toContain('0: first');
    expect(html).toContain('1: second');
  });

  it('honours conditional show/hide', () => {
    const { doc, page } = makeDoc();
    const conditional = createNode(
      'conditional',
      { conditions: [{ field: 'tier', operator: 'eq', value: 'premium' }], conditionLogic: 'and', showWhen: true },
      [createNode('text', { content: 'Premium!' })],
    );
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: conditional },
    });

    expect(render(doc, { dataContext: { tier: 'premium' } }).html).toContain('Premium!');
    expect(render(doc, { dataContext: { tier: 'basic' } }).html).not.toContain('Premium!');
  });

  it('binds table rows to a data path', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: Object.assign(createNode('table', {
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'amount', label: 'Amount', format: 'currency("USD")' },
          ],
          rows: [],
          showHeader: true,
          striped: false,
        }), {
          dataBindings: [{ targetProp: 'rows', sourceId: 'local', path: 'people', fallback: [] }],
        }),
      },
    });
    const { html } = render(doc, {
      dataContext: {
        people: [
          { name: 'Ada', amount: 1250 },
          { name: 'Grace', amount: 500 },
        ],
      },
    });
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Ada</td>');
    expect(html).toContain('<td>Grace</td>');
    expect(html).toContain('1,250.00</td>');
  });

  it('interpolates expressions nested in authored table rows', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('table', {
          columns: [
            { key: 'description', label: 'Description' },
            { key: 'amount', label: 'Amount' },
          ],
          rows: [{
            description: '{{items.0.description}}',
            amount: '{{items.0.amount | currency("USD")}}',
          }],
          showHeader: true,
          striped: false,
        }),
      },
    });

    const { html } = render(doc, {
      dataContext: { items: [{ description: 'Design services', amount: 1250 }] },
    });
    expect(html).toContain('<td>Design services</td>');
    expect(html).toContain('1,250.00</td>');
    expect(html).not.toContain('{{items.0');
  });

  it('renders table flow ranges with a repeated header and stable striping', () => {
    const { doc, page } = makeDoc();
    const table = createNode('table', {
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'Ada' }, { name: 'Grace' }, { name: 'Katherine' }, { name: 'Margaret' }],
      showHeader: true,
      striped: true,
    });
    table.flow = {
      groupId: table.id,
      kind: 'table',
      continuation: true,
      tableRange: { start: 1, end: 3 },
    };
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: table },
    });

    const { html } = render(doc);
    expect(html.match(/<th>Name<\/th>/g)).toHaveLength(1);
    expect(html).not.toContain('<td>Ada</td>');
    expect(html).toContain('<td>Grace</td>');
    expect(html).toContain('<td>Katherine</td>');
    expect(html).not.toContain('<td>Margaret</td>');
    expect(html).toContain('<tr class="ex-table-row--striped"><td>Grace</td></tr>');
  });

  it('skips hidden nodes and comments unknown types', () => {
    const { doc, page } = makeDoc();
    const hidden = createNode('text', { content: 'invisible' });
    hidden.hidden = true;
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: hidden } });
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('mystery', {}) },
    });

    const { html } = render(doc);
    expect(html).not.toContain('invisible');
    expect(html).toContain('unknown component: mystery');
  });

  it('supports custom renderers', () => {
    const { doc, page } = makeDoc();
    registerRenderer('qr-code', (node) => `<div class="qr">${String(node.props.value)}</div>`);
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('qr-code', { value: 'ping' }) },
    });
    try {
      expect(render(doc).html).toContain('<div class="qr">ping</div>');
    } finally {
      unregisterRenderer('qr-code');
    }
  });

  it('isolates custom renderers and binding transforms by runtime', () => {
    const { doc, page } = makeDoc();
    const custom = createNode('tenant-value', { content: '' });
    custom.dataBindings = [{
      targetProp: 'content',
      sourceId: 'tenant',
      path: 'value',
      transform: 'tenant-label',
    }];
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: custom },
    });

    const first = createRenderRuntime();
    first.renderers.register('tenant-value', (node) => `<p>${String(node.props.content)}</p>`);
    first.transforms.register('tenant-label', (value) => `FIRST:${String(value)}`);

    const second = createRenderRuntime();
    second.renderers.register('tenant-value', (node) => `<strong>${String(node.props.content)}</strong>`);
    second.transforms.register('tenant-label', (value) => `SECOND:${String(value)}`);

    const options = { dataContext: { value: 'Ada' } };
    expect(render(doc, { ...options, runtime: first }).html).toContain('<p>FIRST:Ada</p>');
    expect(render(doc, { ...options, runtime: second }).html).toContain('<strong>SECOND:Ada</strong>');
    expect(first.renderers.get('tenant-value')).not.toBe(second.renderers.get('tenant-value'));
  });

  it('emits landscape @page dimensions', () => {
    const doc = createDocument({ withInitialPage: false });
    applyCommand(doc, {
      type: 'page:add',
      payload: { page: createPage({ orientation: 'landscape' }) },
    });
    expect(render(doc).css).toContain('size: 297mm 210mm');
  });

  it('uses one typography and style-rule contract for standalone and editor-scoped pages', () => {
    const { doc } = makeDoc();
    doc.styles.tokens.typography.body = {
      fontFamily: 'Inter, Arial, sans-serif',
      fontSize: '13px',
      fontWeight: 450,
      lineHeight: '1.6',
      letterSpacing: '0.01em',
    };
    doc.styles.rules.push({
      id: 'brand-copy',
      selectors: ['.ex-text'],
      properties: { color: '#0f766e', 'margin-top': '3px' },
    });
    doc.styles.rules.push({
      id: 'paper-copy',
      selectors: ['body'],
      properties: { 'font-variant-numeric': 'tabular-nums' },
    });

    const standalone = render(doc).css;
    const scoped = renderScopedDocumentStyles(doc, '.proof-editor .exs-page');

    expect(standalone).toContain('font-family: var(--font-body-family');
    expect(standalone).toContain('--font-body-family: Inter, Arial, sans-serif');
    expect(standalone).toContain('.ex-document h1');
    expect(scoped).toContain('.proof-editor .exs-page {');
    expect(scoped).toContain('.proof-editor .exs-page .ex-text');
    expect(scoped).toContain('.proof-editor .exs-page {\n  font-variant-numeric: tabular-nums;');
    expect(scoped).toContain('font-family: var(--font-body-family');
    expect(scoped).toContain('margin-top: 3px');
  });

  it('uses the selected web canvas width for responsive editor rules', () => {
    const doc = createDocument({ name: 'Responsive website', medium: 'web' });
    doc.styles.rules.push({
      id: 'mobile-grid',
      name: 'Mobile grid',
      selectors: ['.feature-grid'],
      properties: { 'grid-template-columns': '1fr' },
      mediaQuery: 'screen and (max-width: 640px)',
    });

    const scoped = renderScopedDocumentStyles(doc, '.proof-editor .exs-web-page');
    expect(scoped).toContain('@container exemplara-page-preview (max-width: 640px)');
    expect(scoped).toContain('.proof-editor .exs-web-page .feature-grid');
  });

  it('shares container, column, and style-binding presentation values with the renderer', () => {
    const { doc, page } = makeDoc();
    const container = createNode('container', {
      direction: 'row', gap: 12, padding: 8, background: '#f8fafc', align: 'center', justify: 'space-between',
    });
    container.styleBindings = [
      { property: 'letter-spacing', value: '2px' },
      { property: 'color', ruleId: 'brand-copy' },
    ];
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node: container } });

    const importedHeader = createNode('web-section', { element: 'header', className: 'gtg-header' });
    expect(containerPresentation(importedHeader).classes).toEqual(['ex-container', 'gtg-header']);
    expect(containerPresentation(importedHeader).style.display).toBeUndefined();
    expect(containerPresentation(importedHeader).style['flex-direction']).toBeUndefined();

    expect(containerPresentation(container)).toEqual({
      classes: ['ex-container', 'ex-r-brand-copy'],
      style: {
        display: 'flex',
        'flex-direction': 'row',
        gap: '12px',
        padding: '8px',
        background: '#f8fafc',
        'align-items': 'center',
        'justify-content': 'space-between',
        'letter-spacing': '2px',
      },
    });
    expect(columnPresentation([1.15, 0.85], 16, 0).style.flex).toBe('0 0 calc(57.5% - 16px)');
    expect(render(doc).html).toContain('class="ex-container ex-r-brand-copy"');
    expect(render(doc).html).toContain('letter-spacing: 2px');
  });

  it('carries document typography variables and font faces into isolated print templates', () => {
    const { doc } = makeDoc();
    doc.styles.tokens.typography.body = {
      fontFamily: 'Proof Sans, Arial, sans-serif',
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: '1.5',
    };
    doc.styles.tokens.fonts.push({
      family: 'Proof Sans',
      src: 'data:font/woff2;base64,AA==',
      weight: '400',
    });
    const source = renderPrintTemplateDocument(doc, 'header', {
      pageIndex: 0,
      totalPages: 1,
      pageLabel: 'P1',
      date: '2026-07-13',
    });

    expect(source).toContain('@font-face');
    expect(source).toContain("font-family: 'Proof Sans'");
    expect(source).toContain('--font-body-family: Proof Sans, Arial, sans-serif');
    expect(source).toContain('font-family: var(--font-body-family');
  });

  it('keeps print-template binding syntax visible when data preview is disabled', () => {
    const { doc } = makeDoc();
    doc.print.header.variants.default = '<div>{{customer.name}} · {{page.number}}/{{page.total}}</div>';
    const source = renderPrintTemplateDocument(doc, 'header', {
      pageIndex: 1,
      totalPages: 4,
      pageLabel: 'P2',
      date: '2026-07-15',
      dataContext: { customer: { name: 'Maya Chen' } },
      resolveData: false,
    });

    expect(source).toContain('{{customer.name}}');
    expect(source).toContain('{{page.number}}/{{page.total}}');
    expect(source).not.toContain('Maya Chen');
  });

  it('previews unsaved header HTML and CSS with resolved template data', () => {
    const { doc } = makeDoc();
    const source = renderPrintTemplateSourceDocument(
      doc,
      'header',
      '<div class="custom-header">{{customer.name}}</div>',
      '.custom-header { color: rgb(12, 34, 56); }',
      {
        pageIndex: 0,
        totalPages: 2,
        pageLabel: 'Cover',
        date: '2026-08-01',
        dataContext: { customer: { name: 'Maya Chen' } },
      },
      'first',
    );

    expect(source).toContain('data-variant="first"');
    expect(source).toContain('Maya Chen');
    expect(source).toContain('.custom-header { color: rgb(12, 34, 56); }');
  });

  it('preserves safe inline and style-block CSS in isolated PDF templates', () => {
    const { doc } = makeDoc();
    doc.print.header.variants.default = [
      '<style>.brand { color:#c2410c; } @import url("https://bad.example/style.css");</style>',
      '<div class="brand" style="display:flex; behavior:url(bad.htc)" onclick="bad()">Safe</div>',
      '<script>bad()</script>',
    ].join('');
    const source = renderPrintTemplateDocument(doc, 'header', {
      pageIndex: 0,
      totalPages: 1,
      pageLabel: 'P1',
      date: '2026-08-01',
    });

    expect(source).toContain('<style>.brand { color:#c2410c; } </style>');
    expect(source).toContain('style="display:flex;"');
    expect(source).not.toContain('@import');
    expect(source).not.toContain('behavior:');
    expect(source).not.toContain('onclick');
    expect(source).not.toContain('<script');
  });
});
