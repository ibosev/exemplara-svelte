import { describe, expect, it } from 'vitest';
import { createDocument, createNode } from '../src/lib/core/create.js';
import { defaultRegistry } from '../src/lib/core/registry.js';
import { findParentNode } from '../src/lib/core/tree.js';
import { render } from '../src/lib/renderer/render.js';
import {
  buildDocumentLayerTree,
  buildSampleDataTrees,
  bindingAutocompleteSuggestions,
  bindingAuthoringValue,
  commitBindingAuthoring,
  completeBindingAutocomplete,
  collectDocumentBindings,
  countLayerTreeNodes,
  extractSampleDataPaths,
  findLayerTreePath,
  findBindingAutocompleteTrigger,
  mergeSampleData,
} from '../src/lib/shared/index.js';
import { buildDemoDocument } from './fixtures/demo-document.js';

describe('portable document outline model', () => {
  it('preserves pages, regions, named slots, nested components, and binding metadata', () => {
    const doc = createDocument({ name: 'Hierarchy proof' });
    const columns = createNode('columns', { ratios: [1, 1], gap: 12 });
    const bound = createNode('text', { content: 'Customer' });
    bound.dataBindings = [{ targetProp: 'content', sourceId: 'local', path: 'customer.name' }];
    columns.slots = {
      col1: [createNode('container', {}, [bound])],
      col2: [],
    };
    doc.pages[0]!.regions.body.children.push(columns);

    const tree = buildDocumentLayerTree(doc, (type) => defaultRegistry.get(type));
    const page = tree.children[0]!;
    const body = page.children.find((node) => node.regionName === 'body')!;
    const columnsLayer = body.children[0]!;

    expect(tree.label).toBe('Hierarchy proof');
    expect(columnsLayer.children.map((node) => node.label)).toEqual(['Column 1', 'Column 2']);
    expect(columnsLayer.children[0]!.children[0]!.children[0]).toMatchObject({
      label: 'Customer',
      bindingCount: 1,
      componentType: 'text',
    });
    expect(countLayerTreeNodes(tree, 'component')).toBe(3);
    expect(findParentNode(doc, bound.id)?.type).toBe('container');
    expect(findParentNode(doc, columns.id)).toBeNull();
    expect(findLayerTreePath(tree, bound.id)?.map((node) => node.kind))
      .toEqual(['document', 'page', 'region', 'component', 'slot', 'component', 'component']);
    expect(findLayerTreePath(tree, 'missing')).toBeNull();
  });
});

describe('portable data-binding authoring', () => {
  const sources = [{
    id: 'invoice',
    name: 'Invoice payload',
    type: 'static' as const,
    sampleData: {
      customer: { name: 'Jane Doe', address: { city: 'Berlin' } },
      total: 10728,
    },
  }];

  it('detects and completes an open double-curly autocomplete token', () => {
    const trigger = findBindingAutocompleteTrigger('Hello {{cust', 12)!;
    expect(trigger).toEqual({ kind: 'path', start: 6, end: 12, query: 'cust' });
    expect(completeBindingAutocomplete('Hello {{cust', trigger, 'customer.name')).toEqual({
      value: 'Hello {{customer.name}}',
      caretOffset: 23,
    });
    expect(findBindingAutocompleteTrigger('Hello {{customer.name}}', 23)).toBeNull();
  });

  it('filters live JSON paths and keeps source/type/preview metadata', () => {
    expect(bindingAutocompleteSuggestions(sources, 'city')[0]).toMatchObject({
      sourceId: 'invoice',
      path: 'customer.address.city',
      type: 'string',
      preview: 'Berlin',
    });
  });

  it('shows explicit bindings as curly syntax and commits path edits without losing transforms', () => {
    const node = createNode('text', { content: 'Customer name' });
    node.dataBindings = [{
      targetProp: 'content',
      sourceId: 'invoice',
      path: 'customer.name',
      transform: 'uppercase',
      fallback: 'Customer name',
    }];
    expect(bindingAuthoringValue(node)).toBe('{{customer.name}}');

    const changed = commitBindingAuthoring(node, '{{customer.address.city}}', sources, 'invoice');
    expect(changed.content).toBe('Customer name');
    expect(changed.binding).toEqual({
      targetProp: 'content',
      sourceId: 'invoice',
      path: 'customer.address.city',
      transform: 'uppercase',
      fallback: 'Customer name',
    });

    const staticEdit = commitBindingAuthoring(node, 'A manually authored value', sources);
    expect(staticEdit).toEqual({ content: 'A manually authored value', dataBindings: undefined });
  });
});

describe('portable nested-data browser model', () => {
  it('builds nested object/array trees and resolves explicit binding previews', () => {
    const doc = createDocument();
    doc.dataSources.push({
      id: 'invoice',
      name: 'Invoice payload',
      type: 'static',
      sampleData: {
        customer: { name: 'Jane Doe', address: { city: 'Berlin' } },
        items: [{ description: 'Workshop', qty: 2 }],
      },
    });
    const bound = createNode('text', { content: 'Customer' });
    bound.dataBindings = [{ targetProp: 'content', sourceId: 'invoice', path: 'customer.name' }];
    doc.pages[0]!.regions.body.children.push(bound);

    const roots = buildSampleDataTrees(doc.dataSources);
    const customer = roots[0]!.children.find((node) => node.key === 'customer')!;
    const items = roots[0]!.children.find((node) => node.key === 'items')!;
    expect(customer.children.find((node) => node.key === 'address')?.children[0]?.path)
      .toBe('customer.address.city');
    expect(items.children[0]?.children.map((node) => node.path))
      .toEqual(['items.0.description', 'items.0.qty']);
    expect(extractSampleDataPaths(doc.dataSources).map((entry) => entry.path))
      .toContain('items.0.description');
    expect(collectDocumentBindings(doc)[0]).toMatchObject({
      resolved: true,
      preview: 'Jane Doe',
      nodeId: bound.id,
    });
  });

  it('keeps the comprehensive playground fixture data-bound and renderable', () => {
    const doc = buildDemoDocument();
    const bindings = collectDocumentBindings(doc);
    const tree = buildDocumentLayerTree(doc, (type) => defaultRegistry.get(type));
    const output = render(doc, { dataContext: mergeSampleData(doc.dataSources) }).html;

    expect(doc.dataSources).toHaveLength(2);
    expect(bindings.length).toBeGreaterThanOrEqual(20);
    expect(bindings.some((binding) => binding.targetProp === 'rows' && binding.path === 'items')).toBe(true);
    expect(countLayerTreeNodes(tree, 'slot')).toBeGreaterThanOrEqual(4);
    expect(output).toContain('NORTHSTAR CONSULTING');
    expect(output).toContain('Jane Doe');
    expect(output).toContain('INV-2026-0713');
    expect(output).toContain('Discovery workshop');
    expect(output).toContain('BG80 BNBG 9661 1020 3456 78');
  });
});
