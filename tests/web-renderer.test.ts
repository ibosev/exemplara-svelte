import { describe, expect, it } from 'vitest';
import { applyCommand, createNode, createRegion, createWebDocument, createWebPage } from '../src/lib/core/index.js';
import { renderScopedDocumentStyles, renderWeb, renderWebTemplate } from '../src/lib/renderer/index.js';
import { bindImportedCssToDesignTokens } from '../src/lib/shared/html-import.js';

describe('web document renderer', () => {
  it('renders a standalone responsive page with route metadata', () => {
    const doc = createWebDocument({
      name: 'Acme homepage',
      slug: 'home',
      description: 'Automated documents for every team.',
    });
    doc.pages[0]!.regions.body.children.push(
      createNode('web-section', { element: 'section', background: '#111111', color: '#ffffff' }, [
        createNode('text', { content: '<h1>Documents. Automated.</h1>' }),
        createNode('web-link', { label: 'Start building', href: '/register' }),
      ]),
    );

    const result = renderWeb(doc);
    expect(result.slug).toBe('home');
    expect(result.fullHtml).toContain('<!DOCTYPE html>');
    expect(result.fullHtml).toContain('<title>Acme homepage</title>');
    expect(result.fullHtml).toContain('name="viewport"');
    expect(result.fullHtml).toContain('Automated documents for every team.');
    expect(result.html).toContain('<section');
    expect(result.html).toContain('href="/register"');
    expect(result.css).toContain('.ex-web-page');
  });

  it('renders shared website chrome on every route', () => {
    const doc = createWebDocument({ name: 'Restaurant' });
    doc.meta.web!.header = createRegion({
      children: [createNode('text', { content: 'Shared nav' })],
    });
    const contact = createWebPage({ slug: 'contact' });
    contact.regions.body.children.push(createNode('text', { content: 'Phone' }));
    applyCommand(doc, { type: 'page:add', payload: { page: contact } });

    const home = renderWeb(doc, { pageIndex: 0 });
    const other = renderWeb(doc, { pageIndex: 1 });
    expect(home.html).toContain('Shared nav');
    expect(other.html).toContain('Shared nav');
    expect(other.html).toContain('Phone');
    expect(other.slug).toBe('contact');
  });

  it('preserves expressions and emits Handlebars controls for publication', () => {
    const doc = createWebDocument({ name: 'Catalog' });
    doc.pages[0]!.regions.body.children.push(
      createNode('repeater', { path: 'products' }, [
        createNode('text', { content: '<strong>{{name}}</strong>' }),
      ]),
    );

    const result = renderWebTemplate(doc);
    expect(result.html).toContain('{{#each products}}');
    expect(result.html).toContain('{{name}}');
    expect(result.html).toContain('{{/each}}');
  });

  it('renders imported HTML without editor-owned layout wrappers or presentation CSS', () => {
    const doc = createWebDocument({
      name: 'Imported site',
      settings: {
        importMode: 'lossless-html',
        customCss: ':root { --ink: #201c18; } body.atelier-template { color: var(--ink); } .hero > h1 { font-family: serif; }',
      },
      page: { className: 'atelier-template' },
    });
    const conditional = createNode('conditional', {
      conditions: [{ field: 'visible', operator: 'exists' }],
    }, [createNode('html-element', { tagName: 'span' }, [createNode('html-text', { content: 'Visible' })])]);
    conditional.slots = {
      else: [createNode('html-element', { tagName: 'span' }, [createNode('html-text', { content: 'Hidden' })])],
    };
    doc.pages[0]!.regions.body.children.push(
      createNode('html-element', {
        tagName: 'main',
        className: 'hero',
        attributes: { 'aria-label': 'Welcome', onclick: 'alert(1)' },
      }, [
        createNode('html-element', { tagName: 'h1' }, [
          createNode('html-text', { content: 'Orbita & Atelier' }),
        ]),
        createNode('html-element', {
          tagName: 'a',
          attributes: { href: 'javascript:alert(1)' },
        }, [createNode('html-text', { content: 'Menu' })]),
        createNode('html-element', {
          tagName: 'menu-card',
          attributes: { part: 'content', 'x-client-state': 'open' },
        }, [createNode('html-text', { content: 'Custom element' })]),
      ]),
      conditional,
      createNode('repeater', { path: 'items' }, [
        createNode('html-element', { tagName: 'em' }, [createNode('html-text', { content: '{{name}}' })]),
      ]),
      createNode('html-element', {
        tagName: 'div',
        className: 'photo',
        inlineStyle: "background-image: url('{{hero.imageUrl}}')",
      }),
      createNode('html-element', {
        tagName: 'header',
        attributeBlocks: ['{{#if hero.imageUrl}} style="background-image: url(\'{{hero.imageUrl}}\')"{{/if}}'],
        previewInlineStyle: "background-image: url('https://images.test/hero.jpg')",
      }),
    );
    doc.dataSources.push({
      id: 'sample',
      name: 'Sample',
      type: 'static',
      sampleData: {
        visible: true,
        items: [{ name: 'First' }, { name: 'Second' }],
        hero: { imageUrl: 'https://images.test/hero.jpg' },
      },
    });

    const result = renderWeb(doc);
    expect(result.fullHtml).toContain('<body class="atelier-template">');
    expect(result.html).toContain('<main aria-label="Welcome" class="hero"');
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Orbita &amp; Atelier');
    expect(result.html).not.toContain('onclick=');
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('ex-web-document');
    expect(result.html).not.toContain('ex-region');
    expect(result.html).not.toContain('ex-conditional');
    expect(result.html).not.toContain('ex-repeater');
    expect(result.html).not.toContain('data-node-id');
    expect(result.html).toContain('<menu-card part="content" x-client-state="open">');
    expect(result.html).toContain('<span');
    expect(result.html).toContain('First');
    expect(result.html).toContain('Second');
    expect(result.html).toContain('background-image: url(&#39;https://images.test/hero.jpg&#39;)');
    expect(result.css).toContain('body.atelier-template');
    expect(result.css).not.toContain('.ex-web-page');

    const template = renderWebTemplate(doc);
    expect(template.html).toContain('background-image: url(&#39;{{hero.imageUrl}}&#39;)');
    expect(template.html).toContain('{{#if visible}}');
    expect(template.html).toContain('{{else}}<span>Hidden</span>{{/if}}');
    expect(template.html).toContain('<header{{#if hero.imageUrl}} style=');
  });

  it('keeps native imported websites on original page chrome', () => {
    const doc = createWebDocument({
      name: 'Girl and Goat',
      settings: {
        importMode: 'native',
        customCss: 'body.gtg-template { color: #f5f0e8; } .gtg-header { background: #111; }',
      },
      page: { className: 'gtg-template' },
    });
    doc.pages[0]!.regions.body.children.push(
      createNode('web-section', { element: 'header', className: 'gtg-header' }, [
        createNode('text', { content: 'Lumina' }),
        createNode('web-link', { label: 'Menu', href: '#menu', appearance: 'text', className: 'gtg-nav__link' }),
      ]),
    );

    const result = renderWeb(doc);
    expect(result.fullHtml).toContain('<body class="gtg-template">');
    expect(result.html).toContain('<header');
    expect(result.html).toContain('gtg-header');
    expect(result.html).toContain('gtg-nav__link');
    expect(result.html).not.toContain('ex-web-document');
    expect(result.html).not.toContain('ex-region');
    expect(result.css).toContain('body.gtg-template');
    expect(result.css).not.toContain('.ex-web-page');

    const scoped = renderScopedDocumentStyles(doc, '.proof-editor .exs-web-page');
    expect(scoped).toContain(':scope.gtg-template');
    expect(scoped).not.toContain('color: var(--color-text, #1f2937)');
  });

  it('binds imported template CSS variables to the document design system', () => {
    const doc = createWebDocument({
      name: 'Mujo',
      settings: {
        importMode: 'lossless-html',
        customCss: [
          ':root {',
          '  --mujo-nav-bg: var(--mujo-bg, transparent);',
          '  --mujo-bg: #040404;',
          '  --mujo-accent: #d4b374;',
          '  --mujo-font-heading: "Cormorant Garamond", serif;',
          '  --mujo-font-body: "IBM Plex Sans", sans-serif;',
          '}',
          'body.mujo-template { background: var(--mujo-bg); color: var(--mujo-accent); font-family: var(--mujo-font-body); }',
        ].join('\n'),
      },
    });

    doc.pages[0]!.web = {
      ...doc.pages[0]!.web!,
      inlineStyle: '--mujo-accent: #d4b374; display: block',
    };
    doc.pages[0]!.regions.body.style = { '--mujo-bg': '#040404', display: 'block' };

    expect(bindImportedCssToDesignTokens(doc)).toBe(true);
    expect(doc.styles.tokens.colors['mujo-bg']).toBe('#040404');
    expect(doc.pages[0]?.web?.inlineStyle).toBe('display: block');
    expect(doc.pages[0]?.regions.body.style?.['--mujo-bg']).toBeUndefined();
    expect(doc.pages[0]?.regions.body.style?.display).toBe('block');
    expect(doc.styles.tokens.colors['mujo-accent']).toBe('#d4b374');
    expect(doc.styles.tokens.colors.primary).toBeUndefined();
    expect(doc.meta.web?.customCss).toContain('--mujo-bg: var(--color-mujo-bg)');
    expect(doc.meta.web?.customCss).toContain('--mujo-nav-bg: var(--mujo-bg, transparent)');
    expect(doc.styles.tokens.typography.heading.fontFamily).toContain('Cormorant Garamond');
    expect(doc.styles.tokens.typography.body.fontFamily).toContain('IBM Plex Sans');
    expect(bindImportedCssToDesignTokens(doc)).toBe(false);

    applyCommand(doc, {
      type: 'style:update-tokens',
      payload: { path: 'colors.mujo-accent', value: '#ff2bd6' },
    });
    expect(doc.styles.tokens.colors['mujo-accent']).toBe('#ff2bd6');
    expect(doc.meta.web?.customCss).toContain('--mujo-accent: #ff2bd6');

    const result = renderWeb(doc);
    expect(result.css).toContain('--color-mujo-accent: #ff2bd6');
    expect(result.css).toContain('--mujo-accent: #ff2bd6');
    expect(result.css).toContain('background: var(--mujo-bg)');
    expect(result.css.lastIndexOf('--mujo-accent: #ff2bd6')).toBeGreaterThan(
      result.css.indexOf('--mujo-accent: #ff2bd6'),
    );

    const scoped = renderScopedDocumentStyles(doc, '.proof-editor .exs-web-page');
    expect(scoped).toContain('--mujo-accent: #ff2bd6');
    expect(scoped.lastIndexOf('--mujo-accent: #ff2bd6')).toBeGreaterThan(scoped.indexOf('@scope'));
  });

  it('reties a baked page background to the design-system bg token', () => {
    const doc = createWebDocument({
      name: 'Mujo baked',
      settings: {
        importMode: 'lossless-html',
        customCss: [
          ':root { --mujo-bg: #040404; --mujo-accent: #d4b374; }',
          'body.mujo-template {',
          '  background:',
          '    radial-gradient(circle at top, rgba(212, 179, 116, 0.08), transparent 24%),',
          '    linear-gradient(180deg, #020202 0%, #080808 40%, #050505 100%);',
          '}',
        ].join('\n'),
      },
    });

    expect(bindImportedCssToDesignTokens(doc)).toBe(true);
    expect(doc.meta.web?.customCss).toContain('var(--color-mujo-bg)');
    expect(doc.meta.web?.customCss).not.toContain('#020202');
    expect(doc.meta.web?.customCss).toContain('radial-gradient(circle at top');
    expect(doc.meta.web?.customCss).toContain('var(--mujo-accent)');
    expect(bindImportedCssToDesignTokens(doc)).toBe(false);

    applyCommand(doc, {
      type: 'style:update-tokens',
      payload: { path: 'colors.mujo-bg', value: '#ff2bd6' },
    });
    const scoped = renderScopedDocumentStyles(doc, '.proof-editor .exs-web-page');
    expect(scoped).toContain('--color-mujo-bg: #ff2bd6');
    expect(scoped).toContain('var(--color-mujo-bg)');
    expect(scoped).toContain('background-color: #ff2bd6');
  });

  it('harmonizes leftover baked greys and golds onto template tokens', () => {
    const doc = createWebDocument({
      name: 'Mujo leftover',
      settings: {
        importMode: 'lossless-html',
        customCss: [
          ':root { --mujo-bg: #040404; --mujo-surface: rgba(10, 10, 10, 0.82); --mujo-text: #f4edde; --mujo-accent: #d4b374; }',
          '.mujo-header__veil { background: linear-gradient(180deg, rgba(2, 2, 2, 0.56) 0%, rgba(2, 2, 2, 0.96) 100%); }',
          '.mujo-section { background: linear-gradient(180deg, rgba(18, 18, 18, 0.92) 0%, rgba(10, 10, 10, 0.98) 100%); }',
          '.mujo-stage__copy span { color: rgba(244, 237, 222, 0.82); }',
        ].join('\n'),
      },
    });
    doc.styles.rules.push({
      id: 'veil',
      selectors: ['.ex-r-veil'],
      properties: { background: 'linear-gradient(180deg, rgba(2, 2, 2, 0.56) 0%, rgba(2, 2, 2, 0.96) 100%)' },
    });

    expect(bindImportedCssToDesignTokens(doc)).toBe(true);
    expect(doc.styles.tokens.colors['mujo-surface']).toContain('var(--color-mujo-bg)');
    expect(doc.meta.web?.customCss).toContain('var(--mujo-bg)');
    expect(doc.meta.web?.customCss).not.toContain('rgba(2, 2, 2');
    expect(doc.meta.web?.customCss).not.toContain('rgba(18, 18, 18');
    expect(doc.meta.web?.customCss).toContain('var(--mujo-text)');
    expect(doc.styles.rules[0]?.properties.background).toContain('var(--mujo-bg)');
  });

  it('renders the imported conditional fallback when its condition does not match', () => {
    const doc = createWebDocument({
      name: 'Fallback',
      settings: { importMode: 'lossless-html' },
    });
    const conditional = createNode('conditional', {
      conditions: [{ field: 'visible', operator: 'truthy' }],
    }, [createNode('html-text', { content: 'Then' })]);
    conditional.slots = { else: [createNode('html-text', { content: 'Else' })] };
    doc.pages[0]!.regions.body.children.push(conditional);

    expect(renderWeb(doc, { dataContext: {} }).html).toBe('Else');
    expect(renderWeb(doc, { dataContext: { visible: false } }).html).toBe('Else');
    expect(renderWeb(doc, { dataContext: { visible: true } }).html).toBe('Then');
  });

  it('applies guided design bindings to lossless HTML elements', () => {
    const doc = createWebDocument({
      name: 'Styled import',
      settings: { importMode: 'lossless-html' },
    });
    const image = createNode('html-element', {
      tagName: 'img',
      className: 'menu-photo',
      attributes: { src: '/menu.jpg', alt: 'Menu' },
      inlineStyle: 'display: block;',
    });
    image.styleBindings = [
      { property: 'object-fit', value: 'cover' },
      { property: 'class', ruleId: 'rounded-photo' },
    ];
    doc.pages[0]!.regions.body.children.push(image);

    const result = renderWeb(doc);
    expect(result.html).toContain('class="menu-photo ex-r-rounded-photo"');
    expect(result.html).toContain('style="display: block; object-fit: cover"');
  });
});
