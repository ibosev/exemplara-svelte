import { describe, expect, it } from 'vitest';
import {
  clamp,
  contrastRatio,
  dropTargetFor,
  fitZoom,
  formatPageNumber,
  isDark,
  mmToPx,
  parseColor,
  placeFloatingControls,
  pxToMm,
  resolveDropPosition,
  roundTo,
  sanitizeHtml,
  sanitizeImportedDeclarations,
  stepZoom,
  toAlpha,
  toHex,
  toPlainText,
  toRoman,
  wcagLevel,
} from '../src/lib/shared/index.js';
import { auditDocument } from '../src/lib/shared/audit.js';
import { groupImportedPageNodes } from '../src/lib/shared/html-import.js';
import { applyCommand, createDocument, createNode, createPage } from '../src/lib/core/index.js';

describe('math', () => {
  it('converts between mm and px at 96dpi', () => {
    expect(roundTo(mmToPx(25.4))).toBe(96);
    expect(roundTo(pxToMm(96))).toBe(25.4);
  });

  it('clamps and steps zoom', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(0.25, -1)).toBe(0.25);
    expect(stepZoom(3, 1)).toBe(3);
  });

  it('computes fit zoom', () => {
    expect(fitZoom(794, 1000, 64)).toBe(1); // A4 at 96dpi fits a 1000px viewport
    expect(fitZoom(2000, 1000, 0)).toBe(0.5);
  });

  it('formats page numbers', () => {
    expect(toRoman(4)).toBe('iv');
    expect(toRoman(1987)).toBe('mcmlxxxvii');
    expect(toAlpha(1)).toBe('a');
    expect(toAlpha(27)).toBe('aa');
    expect(formatPageNumber(3, 'roman')).toBe('iii');
    expect(formatPageNumber(2, 'alpha')).toBe('b');
    expect(formatPageNumber(7)).toBe('7');
  });
});

describe('box values', () => {
  it('parses CSS shorthands', async () => {
    const { parseBoxValues } = await import('../src/lib/shared/box.js');
    expect(parseBoxValues('8px')).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
    expect(parseBoxValues('4px 8px')).toEqual({ top: 4, right: 8, bottom: 4, left: 8 });
    expect(parseBoxValues('1px 2px 3px')).toEqual({ top: 1, right: 2, bottom: 3, left: 2 });
    expect(parseBoxValues('1px 2px 3px 4px')).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(parseBoxValues(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('formats to the shortest shorthand', async () => {
    const { formatBoxValues } = await import('../src/lib/shared/box.js');
    expect(formatBoxValues({ top: 8, right: 8, bottom: 8, left: 8 })).toBe('8px');
    expect(formatBoxValues({ top: 4, right: 8, bottom: 4, left: 8 })).toBe('4px 8px');
    expect(formatBoxValues({ top: 1, right: 2, bottom: 3, left: 4 })).toBe('1px 2px 3px 4px');
  });
});

describe('color', () => {
  it('parses hex and rgb colors', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#2563eb')).toEqual({ r: 37, g: 99, b: 235 });
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseColor('bogus')).toBeNull();
    expect(toHex({ r: 37, g: 99, b: 235 })).toBe('#2563eb');
  });

  it('computes WCAG contrast', () => {
    expect(roundTo(contrastRatio('#000000', '#ffffff')!, 1)).toBe(21);
    expect(contrastRatio('#777777', '#ffffff')!).toBeLessThan(4.5);
    expect(wcagLevel(21)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(3.2)).toBe('AA-large');
    expect(wcagLevel(3.2, true)).toBe('AA');
    expect(wcagLevel(1.5)).toBe('fail');
  });

  it('classifies dark colors', () => {
    expect(isDark('#000000')).toBe(true);
    expect(isDark('#ffffff')).toBe(false);
  });
});

describe('drop geometry', () => {
  const rect = { top: 100, height: 100 };

  it('resolves before/after for leaf nodes', () => {
    expect(resolveDropPosition(110, rect, false)).toBe('before');
    expect(resolveDropPosition(190, rect, false)).toBe('after');
    expect(resolveDropPosition(150, rect, false)).toBe('after'); // mid = second half boundary
  });

  it('resolves inside for containers in the middle band', () => {
    expect(resolveDropPosition(150, rect, true)).toBe('inside');
    expect(resolveDropPosition(105, rect, true)).toBe('before');
    expect(resolveDropPosition(195, rect, true)).toBe('after');
  });

  it('maps positions to insertion targets', () => {
    const input = { parentId: 'p', index: 2, slot: 's', nodeId: 'n', childCount: 3 };
    expect(dropTargetFor('before', input)).toEqual({ parentId: 'p', index: 2, slot: 's' });
    expect(dropTargetFor('after', input)).toEqual({ parentId: 'p', index: 3, slot: 's' });
    expect(dropTargetFor('inside', input)).toEqual({ parentId: 'n', index: 3 });
  });
});

describe('floating selection controls', () => {
  const viewport = { top: 100, right: 1000, bottom: 800, left: 0 };
  const target = { top: 240, right: 760, bottom: 260, left: 220 };

  it('uses paper gutters and collapses instead of covering compact content', () => {
    expect(placeFloatingControls(
      target,
      { top: 140, right: 800, bottom: 760, left: 180 },
      viewport,
      120,
      26,
    )).toEqual({ mode: 'full', side: 'right', x: 808, y: 240 });

    expect(placeFloatingControls(
      target,
      { top: 140, right: 950, bottom: 760, left: 40 },
      viewport,
      120,
      26,
    )).toEqual({ mode: 'compact', side: 'right', x: 958, y: 240 });

    expect(placeFloatingControls(
      { ...target, top: 820, bottom: 840 },
      { top: 140, right: 800, bottom: 900, left: 180 },
      viewport,
      120,
      26,
    ).mode).toBe('hidden');

    expect(placeFloatingControls(
      { ...target, left: 1010, right: 1080 },
      { top: 140, right: 800, bottom: 760, left: 180 },
      viewport,
      120,
      26,
    ).mode).toBe('hidden');
  });
});

describe('richtext sanitizer', () => {
  it('strips scripts and event handlers', () => {
    expect(sanitizeHtml('<b>hi</b><script>alert(1)</script>')).toBe('<b>hi</b>');
    expect(sanitizeHtml('<span onclick="evil()">x</span>')).toBe('<span>x</span>');
    expect(sanitizeHtml('<a href="javascript:evil()">x</a>')).toBe('<a>x</a>');
  });

  it('keeps allowed formatting and safe attributes', () => {
    expect(sanitizeHtml('<b>a</b> <i>b</i> <u>c</u><br>')).toBe('<b>a</b> <i>b</i> <u>c</u><br />');
    expect(sanitizeHtml('<span style="color: red">x</span>')).toBe('<span style="color: red">x</span>');
    expect(sanitizeHtml('<a href="https://x.test">x</a>')).toBe('<a href="https://x.test">x</a>');
  });

  it('drops unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<video>text</video>')).toBe('text');
  });

  it('removes editor and framework comment markers', () => {
    expect(sanitizeHtml('Hello<!----><!-- --> world')).toBe('Hello world');
  });

  it('extracts plain text', () => {
    expect(toPlainText('<b>Hello</b>  <i>world</i>')).toBe('Hello world');
  });
});

describe('HTML import CSS boundary', () => {
  it('keeps presentation declarations without network-loading values', () => {
    expect(sanitizeImportedDeclarations(
      'color: #123456; padding: 8px; background-image: url(https://evil.test/pixel); position: fixed',
    )).toEqual({ color: '#123456', padding: '8px', position: 'fixed' });
  });

  it('allows explicit image URLs only for the lossless web import path', () => {
    expect(sanitizeImportedDeclarations(
      'background-image: url("https://images.test/hero.jpg"); background-size: cover',
      true,
    )).toEqual({
      'background-image': 'url("https://images.test/hero.jpg")',
      'background-size': 'cover',
    });
    expect(sanitizeImportedDeclarations(
      'background-image: url("javascript:alert(1)")',
      true,
    )).toEqual({});
    expect(sanitizeImportedDeclarations(
      'background-image: url("{{hero.imageUrl}}")',
      true,
    )).toEqual({ 'background-image': 'url("{{hero.imageUrl}}")' });
  });

  it('rejects executable and malformed values', () => {
    expect(sanitizeImportedDeclarations(
      'width: expression(alert(1)); color: javascript:evil; font-size: 18px; border: 1px solid #ddd',
    )).toEqual({ 'font-size': '18px', border: '1px solid #ddd' });
  });

  it('rejects CSS network-load bypasses and indirect values', () => {
    expect(sanitizeImportedDeclarations([
      'background: u/**/rl(https://evil.test/pixel)',
      'background-color: var(--external-value)',
      'background: image-set("//evil.test/image.png" 1x)',
      'color: rgb(10 20 30)',
    ].join(';'))).toEqual({ color: 'rgb(10 20 30)' });
  });

  it('retains grid layout declarations used by imported page sections', () => {
    expect(sanitizeImportedDeclarations(
      'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; place-items: center',
    )).toEqual({
      display: 'grid',
      'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
      gap: '18px',
      'place-items': 'center',
    });
  });

  it('splits structural landing pages while keeping navigation with the hero', () => {
    const navigation = createNode('container');
    const hero = createNode('container');
    const pricing = createNode('container');
    const footer = createNode('container');
    expect(groupImportedPageNodes([
      { node: navigation, tag: 'nav' },
      { node: hero, tag: 'section' },
      { node: pricing, tag: 'section' },
      { node: footer, tag: 'footer' },
    ], true)).toEqual([
      [navigation, hero],
      [pricing],
      [footer],
    ]);
    expect(groupImportedPageNodes([
      { node: navigation, tag: 'h1' },
      { node: hero, tag: 'p' },
    ], false)).toEqual([[navigation, hero]]);
    expect(groupImportedPageNodes([
      { node: navigation, tag: 'header' },
      { node: hero, tag: 'section' },
      { node: pricing, tag: 'table' },
      { node: footer, tag: 'footer' },
    ], true, 'single')).toEqual([[navigation, hero, pricing, footer]]);
  });
});

describe('audit', () => {
  function makeDoc() {
    const doc = createDocument({ withInitialPage: false });
    const page = createPage();
    applyCommand(doc, { type: 'page:add', payload: { page } });
    return { doc, page };
  }

  it('flags low-contrast text', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: 'faint', color: '#eeeeee', fontSize: 12 }),
      },
    });
    const issues = auditDocument(doc);
    expect(issues.some((i) => i.rule === 'contrast' && i.severity === 'error')).toBe(true);
  });

  it('uses container background for contrast', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('container', { background: '#000000' }, [
          createNode('text', { content: 'light on dark', color: '#ffffff', fontSize: 12 }),
        ]),
      },
    });
    const issues = auditDocument(doc);
    expect(issues.filter((i) => i.rule === 'contrast')).toHaveLength(0);
  });

  it('flags missing image alt/src, tiny and empty text', () => {
    const { doc, page } = makeDoc();
    applyCommand(doc, {
      type: 'component:add',
      payload: { parentId: page.regions.body.id, node: createNode('image', { src: '', alt: '' }) },
    });
    applyCommand(doc, {
      type: 'component:add',
      payload: {
        parentId: page.regions.body.id,
        node: createNode('text', { content: '', fontSize: 6 }),
      },
    });
    const rules = auditDocument(doc).map((i) => i.rule);
    expect(rules).toContain('image-src');
    expect(rules).toContain('image-alt');
    expect(rules).toContain('font-size');
    expect(rules).toContain('empty-text');
  });

  it('skips hidden nodes', () => {
    const { doc, page } = makeDoc();
    const node = createNode('image', { src: '', alt: '' });
    node.hidden = true;
    applyCommand(doc, { type: 'component:add', payload: { parentId: page.regions.body.id, node } });
    expect(auditDocument(doc)).toHaveLength(0);
  });
});
