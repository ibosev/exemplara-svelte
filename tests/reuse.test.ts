import { describe, expect, it, vi } from 'vitest';
import {
  ComponentRegistry,
  DocumentEngine,
  PRINT_PRESETS,
  createDocument,
  createNode,
  createPrintPreset,
} from '../src/lib/core/index.js';
import {
  activePageAtY,
  appendDataBinding,
  findSheetOverflows,
  mergeSampleData,
  nodeDisplayLabel,
  pageScrollTop,
  friendlyDataType,
  humanizeDataPath,
  parseImportedSampleData,
  parseJsonRecord,
  parseSampleFieldValue,
  parseSelectorList,
  printVariantForPage,
  normalizeTokenName,
  removeDataBinding,
  resolveEditorShortcut,
  sampleFieldType,
  updateDataBinding,
  viewportReadingY,
} from '../src/lib/shared/index.js';

describe('framework-independent editor building blocks', () => {
  it('publishes portable engine state without a UI runtime', () => {
    const engine = new DocumentEngine({ document: createDocument({ name: 'Before' }) });
    const initialDocument = engine.doc;
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 0, canUndo: false }));

    engine.execute({ type: 'document:update', payload: { changes: { name: 'After' } } });
    expect(engine.doc.name).toBe('After');
    expect(engine.doc).not.toBe(initialDocument);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 1, canUndo: true }));

    unsubscribe();
    engine.undo();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps failed transactions atomic and preserves redo history', () => {
    const engine = new DocumentEngine({ document: createDocument({ name: 'One' }) });
    engine.execute({ type: 'document:update', payload: { changes: { name: 'Two' } } });
    engine.undo();
    expect(engine.canRedo).toBe(true);

    expect(() => engine.execute({
      type: 'component:remove',
      payload: { nodeId: 'missing' },
    })).toThrow();
    expect(engine.doc.name).toBe('One');
    expect(engine.canRedo).toBe(true);
  });

  it('publishes registry updates and creates detached default props', () => {
    const registry = new ComponentRegistry([]);
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.register({
      type: 'portable-card',
      label: 'Portable card',
      category: 'Layout',
      icon: 'card',
      defaultProps: { title: 'Hello', nested: { enabled: true } },
      propSchema: {},
    });
    expect(listener).toHaveBeenLastCalledWith(1);
    expect(registry.categories.get('Layout')?.[0]?.type).toBe('portable-card');
    const first = registry.createNode('portable-card');
    const second = registry.createNode('portable-card');
    expect(first.props).toEqual(second.props);
    expect(first.props).not.toBe(second.props);
  });

  it('exposes reusable print presets as fresh settings objects', () => {
    expect(PRINT_PRESETS.map((preset) => preset.id)).toEqual(['professional', 'minimal', 'editorial']);
    const first = createPrintPreset('editorial');
    const second = createPrintPreset('editorial');
    first.header.variants.first = 'changed';
    expect(second.header.variants.first).toContain('First edition');
    expect(second.footer.variants.even).toContain('{{page.number}}');
  });

  it('shares editor labels, sample data, and print variant selection', () => {
    const node = createNode('text', { content: '<strong>A reusable label longer than expected</strong>' });
    expect(nodeDisplayLabel(node, undefined, 12)).toBe('A reusable l…');
    expect(nodeDisplayLabel(createNode('html-element', {
      tagName: 'menu-card',
      className: 'featured compact',
    }), undefined, 32)).toBe('<menu-card> .featured.compact');
    expect(nodeDisplayLabel(createNode('repeater', { path: 'menu.sections' }), undefined, 32))
      .toBe('Each menu.sections');
    expect(mergeSampleData([
      { id: 'a', name: 'A', type: 'static', sampleData: { customer: 'Ada' } },
      { id: 'b', name: 'B', type: 'static', sampleData: { total: 42 } },
    ])).toEqual({ customer: 'Ada', total: 42 });
    expect([0, 1, 2, 3].map(printVariantForPage)).toEqual(['first', 'even', 'odd', 'even']);
  });

  it('shares keyboard mappings across editor frameworks', () => {
    const state = { hasSelection: true, hasClipboard: true, contextMenuOpen: false };
    expect(resolveEditorShortcut({ key: 'z', metaKey: true }, state)).toBe('undo');
    expect(resolveEditorShortcut({ key: 'z', ctrlKey: true, shiftKey: true }, state)).toBe('redo');
    expect(resolveEditorShortcut({ key: 'ArrowDown', altKey: true }, state)).toBe('move-down');
    expect(resolveEditorShortcut({ key: 'Escape' }, state)).toBe('clear-selection');
  });

  it('shares continuous-canvas page geometry', () => {
    const viewport = { top: 100, bottom: 700 };
    expect(viewportReadingY(viewport)).toBe(300);
    expect(activePageAtY([
      { top: 120, bottom: 250 },
      { top: 290, bottom: 620 },
    ], 300)).toBe(1);
    expect(pageScrollTop(300)).toBe(282);
    expect(pageScrollTop(10)).toBe(0);
  });

  it('shares exact-sheet overflow warning calculations', () => {
    expect(findSheetOverflows([
      { scrollHeight: 1000, clientHeight: 1000 },
      { scrollHeight: 1100, clientHeight: 1000 },
    ], ['Cover', 'Details'])).toEqual([
      { sheet: 2, label: 'Details', byMm: 27 },
    ]);
  });

  it('shares form parsing and data-binding edits', () => {
    expect(normalizeTokenName(' Brand / Accent ')).toBe('brand-accent');
    expect(parseSelectorList('.a, .b, .a')).toEqual(['.a', '.b']);
    expect(parseJsonRecord('{"ok":true}')).toEqual({ ok: true, value: { ok: true } });
    expect(parseJsonRecord('[]')).toEqual({ ok: false, error: 'Expected a JSON object' });
    expect(parseImportedSampleData('{"company":{"name":"Northwind"}}')).toEqual({
      ok: true,
      value: { company: { name: 'Northwind' } },
    });
    expect(parseImportedSampleData('[{"name":"Ada"}]')).toEqual({
      ok: true,
      value: { items: [{ name: 'Ada' }] },
    });
    expect(parseImportedSampleData('[]').ok).toBe(false);
    expect(parseImportedSampleData('{').ok).toBe(false);
    expect(humanizeDataPath('company.name')).toBe('Company name');
    expect(humanizeDataPath('shipment.trackingNumber')).toBe('Shipment Tracking Number');
    expect(friendlyDataType('array')).toBe('List');
    expect(friendlyDataType('boolean')).toBe('Yes/no');
    expect(sampleFieldType(12)).toBe('number');
    expect(sampleFieldType(['one'])).toBe('json');
    expect(parseSampleFieldValue('12.5', 'number')).toEqual({ ok: true, value: 12.5 });
    expect(parseSampleFieldValue('nope', 'number')).toEqual({ ok: false, error: 'Enter a valid number' });
    expect(parseSampleFieldValue('false', 'boolean')).toEqual({ ok: true, value: false });
    expect(parseSampleFieldValue('{"active":true}', 'json')).toEqual({ ok: true, value: { active: true } });

    const added = appendDataBinding(undefined, 'content', 'customer');
    const updated = updateDataBinding(added, 0, { path: 'name' });
    expect(updated[0]).toEqual({
      targetProp: 'content', sourceId: 'customer', path: 'name', fallback: '',
    });
    expect(removeDataBinding(updated, 0)).toEqual([]);
    expect(added[0]?.path).toBe('');
  });
});
