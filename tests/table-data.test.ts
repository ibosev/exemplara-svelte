import { describe, expect, it } from 'vitest';
import { createNode } from '../src/lib/core/create.js';
import type { SampleDataPath } from '../src/lib/shared/data-browser.js';
import {
  preferredBindingTarget,
  replaceBindingTarget,
  resolveTableDataSelection,
  tableRowFields,
} from '../src/lib/shared/table-data.js';

const itemsPath: SampleDataPath = {
  sourceId: 'proposal',
  sourceName: 'Proposal payload',
  path: 'proposal.items',
  type: 'array',
  value: [
    { phase: '01', service: 'Discovery', amount: 3800 },
    { phase: '02', service: 'Design', amount: 6400, optional: true },
  ],
  preview: 'Array(2)',
};

describe('table data authoring model', () => {
  it('resolves canonical bindings and their row fields', () => {
    const table = createNode('table', { rows: [] });
    table.dataBindings = [{
      targetProp: 'rows',
      sourceId: 'proposal',
      path: 'proposal.items',
      fallback: [],
    }];

    const selection = resolveTableDataSelection(table, [itemsPath]);
    expect(selection).toMatchObject({ mode: 'connected', path: itemsPath, rows: itemsPath.value });
    expect(tableRowFields(selection.rows)).toEqual(['phase', 'service', 'amount', 'optional']);
  });

  it('replaces only the selected binding target', () => {
    const contentBinding = { targetProp: 'content', sourceId: 'proposal', path: 'title' };
    expect(replaceBindingTarget([contentBinding], 'rows', {
      targetProp: 'rows', sourceId: 'proposal', path: 'proposal.items', fallback: [],
    })).toEqual([
      contentBinding,
      { targetProp: 'rows', sourceId: 'proposal', path: 'proposal.items', fallback: [] },
    ]);
  });

  it('only offers array paths as the primary binding target for tables', () => {
    expect(preferredBindingTarget('table', ['columns', 'rows'], 'array')).toBe('rows');
    expect(preferredBindingTarget('table', ['columns', 'rows'], 'string')).toBeNull();
    expect(preferredBindingTarget('text', ['content', 'color'], 'string')).toBe('content');
  });
});
