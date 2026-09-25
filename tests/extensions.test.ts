import { describe, expect, it, vi } from 'vitest';
import { ComponentRegistry } from '../src/lib/core/registry.js';
import { CAPABILITY_IDS, createCapabilityPolicy } from '../src/lib/core/capabilities.js';
import { createNode } from '../src/lib/core/create.js';
import { render } from '../src/lib/renderer/render.js';
import {
  evaluateTemplateExpression,
  interpolateTemplateExpressions,
} from '../src/lib/shared/expression.js';
import { collectTemplateExpressions } from '../src/lib/shared/expression-inventory.js';
import {
  completeBindingAutocomplete,
  findBindingAutocompleteTrigger,
} from '../src/lib/shared/binding-authoring.js';
import { resolveEditorShortcut } from '../src/lib/shared/editor.js';
import {
  EditorExtensionRegistry,
  type EditorExtensionApi,
} from '../src/lib/editor/extensions.js';
import { buildDemoDocument } from './fixtures/demo-document.js';

describe('portable template expressions', () => {
  const data = {
    customer: { name: 'Jane Doe' },
    invoice: { totalValue: 10728, issueDateIso: '2026-07-13', taxRate: 0.2 },
    items: [{ description: 'Design services', unitPrice: 1250 }],
  };

  it('evaluates formatter pipelines and simple helper syntax without eval', () => {
    expect(evaluateTemplateExpression('customer.name | uppercase', data)).toBe('JANE DOE');
    expect(evaluateTemplateExpression('uppercase customer.name', data)).toBe('JANE DOE');
    expect(String(evaluateTemplateExpression('invoice.totalValue | currency("EUR")', data)))
      .toContain('10,728');
    expect(evaluateTemplateExpression('invoice.taxRate | percent', data)).toBe('20%');
    expect(interpolateTemplateExpressions('Hello {{customer.name | uppercase}}', data))
      .toBe('Hello JANE DOE');
  });

  it('resolves imported numeric bracket paths with formatter pipelines', () => {
    expect(evaluateTemplateExpression('items[0].description', data)).toBe('Design services');
    expect(String(evaluateTemplateExpression('items[0].unitPrice | currency("USD")', data)))
      .toContain('1,250');
    expect(interpolateTemplateExpressions('{{items[0].description}}', data))
      .toBe('Design services');
  });

  it('resolves inline Handlebars conditions and repeater metadata in attributes', () => {
    const context = { item: { name: 'First' }, '@first': true, active: false };
    expect(interpolateTemplateExpressions(
      'card {{#if @first}}is-first{{/if}} {{#if active}}active{{else}}inactive{{/if}} {{this.name}}',
      context,
    )).toBe('card is-first inactive First');
  });

  it('evaluates safe multi-argument call and Handlebars helper forms', () => {
    const runtime = {
      formatters: [{
        name: 'add',
        label: 'Add',
        category: 'Math',
        description: 'Add two values.',
        example: '{{add(invoice.subtotal, invoice.tax)}}',
        usage: 'call' as const,
        format: (value: unknown, args: unknown[]) => Number(value) + Number(args[0]),
      }],
    };
    const values = { invoice: { subtotal: 90, tax: 10 } };
    expect(evaluateTemplateExpression('add(invoice.subtotal, invoice.tax)', values, runtime)).toBe(100);
    expect(evaluateTemplateExpression('add invoice.subtotal invoice.tax', values, runtime)).toBe(100);
  });

  it('lets a host evaluator override helper-heavy expressions', () => {
    const evaluator = vi.fn((expression: string) => expression === 'custom customer.name' ? 'Host result' : undefined);
    expect(evaluateTemplateExpression('custom customer.name', data, { evaluator })).toBe('Host result');
    expect(evaluator).toHaveBeenCalled();
  });

  it('detects and completes formatter autocomplete after a pipe', () => {
    const input = '{{invoice.totalValue | cur';
    const trigger = findBindingAutocompleteTrigger(input, input.length)!;
    expect(trigger).toEqual({
      kind: 'formatter',
      start: 0,
      end: input.length,
      query: 'cur',
      expressionPrefix: 'invoice.totalValue',
    });
    expect(completeBindingAutocomplete(input, trigger, 'currency("EUR")').value)
      .toBe('{{invoice.totalValue | currency("EUR")}}');

    const closed = '{{customer.name | upp}}';
    const closedTrigger = findBindingAutocompleteTrigger(closed, closed.length - 2)!;
    expect(closedTrigger.end).toBe(closed.length);
    expect(completeBindingAutocomplete(closed, closedTrigger, 'uppercase').value)
      .toBe('{{customer.name | uppercase}}');
  });

  it('renders formatted body and print expressions and inventories them', () => {
    const doc = buildDemoDocument();
    const explicitCurrency = createNode('text', { content: 'currency fallback' });
    explicitCurrency.dataBindings = [{
      targetProp: 'content',
      sourceId: 'invoice',
      path: 'invoice.totalValue',
      transform: 'currency("EUR")',
    }];
    doc.pages[0]!.regions.body.children.push(explicitCurrency);
    doc.print.header.variants.first = '<div>{{invoice.totalValue | currency("EUR")}}</div>';
    const result = render(doc).html;
    expect(result).toContain('Tax rate 20%');
    expect(result).toContain('13 Jul 2026');
    expect(result).toContain('€10,728.00');
    const explicitStart = result.indexOf(`data-node-id="${explicitCurrency.id}"`);
    expect(explicitStart).toBeGreaterThan(-1);
    expect(result.slice(explicitStart, explicitStart + 200)).toContain('€10,728.00');
    const expressions = collectTemplateExpressions(doc);
    expect(expressions.some((entry) => entry.expression === 'invoice.taxRate | percent' && entry.resolved)).toBe(true);
    expect(expressions.some((entry) => entry.kind === 'print' && entry.expression.includes('currency'))).toBe(true);
  });
});

describe('Svelte editor extension registry', () => {
  it('keeps save keyboard mapping framework-neutral', () => {
    expect(resolveEditorShortcut(
      { key: 's', ctrlKey: true },
      { hasSelection: false, hasClipboard: false, contextMenuOpen: false, canSave: true },
    )).toBe('save');
    expect(resolveEditorShortcut(
      { key: 's', ctrlKey: true },
      { hasSelection: false, hasClipboard: false, contextMenuOpen: false },
    )).toBeNull();
  });

  it('rejects duplicate block, provider, formatter, and evaluator registrations', () => {
    const duplicateContributions = (api: EditorExtensionApi) => {
      const block = {
        id: 'example.block',
        label: 'Example',
        category: 'Example',
        create: () => createNode('text'),
      };
      api.addBlock(block);
      api.addBlock(block);
    };
    expect(() => new EditorExtensionRegistry(
      new ComponentRegistry(),
      [duplicateContributions],
    )).toThrow('Duplicate editor block id: example.block');

    expect(() => new EditorExtensionRegistry(new ComponentRegistry(), [(api) => {
      const provider = { id: 'example.paths', suggest: () => [] };
      api.addAutocompleteProvider(provider);
      api.addAutocompleteProvider(provider);
    }])).toThrow('Duplicate editor autocomplete provider id: example.paths');

    expect(() => new EditorExtensionRegistry(new ComponentRegistry(), [(api) => {
      api.addFormatter({
        name: 'currency',
        label: 'Replacement',
        category: 'Test',
        description: 'Duplicate built-in',
        example: '{{value | currency}}',
        format: (value) => value,
      });
    }])).toThrow('Duplicate editor formatter id: currency');

    expect(() => new EditorExtensionRegistry(new ComponentRegistry(), [(api) => {
      api.setExpressionEvaluator(() => undefined);
      api.setExpressionEvaluator(() => undefined);
    }])).toThrow('Duplicate editor expression evaluator registration.');
  });

  it('lets a host deliberately replace a portable formatter', () => {
    const registry = new EditorExtensionRegistry(new ComponentRegistry(), [(api) => {
      api.replaceFormatter({
        name: 'percent',
        label: 'Percentage of value',
        category: 'Math',
        description: 'Calculate a percentage of a base value.',
        example: '{{percent(invoice.subtotal, 20)}}',
        usage: 'call',
        format: (value, args) => Number(value) * (Number(args[0]) / 100),
      });
    }]);

    expect(evaluateTemplateExpression(
      'percent(invoice.subtotal, 20)',
      { invoice: { subtotal: 250 } },
      registry.expressionRuntime,
    )).toBe(50);
    expect(registry.formatters.find((formatter) => formatter.name === 'percent')?.usage)
      .toBe('call');
  });

  it('rejects replacement of an unknown formatter', () => {
    expect(() => new EditorExtensionRegistry(new ComponentRegistry(), [(api) => {
      api.replaceFormatter({
        name: 'unknown',
        label: 'Unknown',
        category: 'Test',
        description: 'Unknown formatter.',
        example: '{{value | unknown}}',
        format: (value) => value,
      });
    }])).toThrow('Cannot replace unknown editor formatter id: unknown');
  });
});
