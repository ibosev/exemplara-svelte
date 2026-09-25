import { describe, expect, it } from 'vitest';
import {
  UnsupportedDocumentCapabilitiesError,
  analyzeDocumentCapabilities,
  assertDocumentCapabilities,
  createCapabilityPolicy,
  createDocument,
  createNode,
  findUnsupportedDocumentCapabilities,
} from '../src/lib/core/index.js';

describe('document capability analysis', () => {
  it('keeps native print tokens separate from optional data binding', () => {
    const document = createDocument();
    document.print.header.variants.odd = '<div>{{document.title | uppercase}}</div>';
    document.print.footer.variants.even = '<div>{{uppercase page.label}}</div>';
    const analysis = analyzeDocumentCapabilities(document);

    expect(analysis.requiredCapabilities).toContain('print.header-footer');
    expect(analysis.requiredCapabilities).toContain('print.pagination');
    expect(analysis.requiredCapabilities).not.toContain('data.resolve');
  });

  it('reports inline, explicit, conditional, print, and symbol requirements with paths', () => {
    const document = createDocument();
    const body = document.pages[0]!.regions.body;
    const dynamic = createNode('text', { content: 'Hello {{customer.name}}' });
    dynamic.dataBindings = [{
      targetProp: 'content',
      sourceId: 'customer',
      path: 'customer.name',
    }];
    dynamic.conditions = [{
      sourceId: 'customer',
      path: 'customer.active',
      operator: 'eq',
      value: true,
      action: 'show',
    }];
    dynamic.symbolId = 'symbol-contact';
    body.children.push(dynamic);
    document.print.header.variants.first = '<div>{{customer.name}}</div>';

    const analysis = analyzeDocumentCapabilities(document);
    expect(analysis.requiredCapabilities).toContain('data.resolve');
    expect(analysis.requiredCapabilities).toContain('symbols.resolve');
    expect(analysis.requirements.some((entry) => entry.nodeId === dynamic.id)).toBe(true);
    expect(analysis.requirements.some((entry) => entry.path === 'print.header.variants.first')).toBe(true);
  });

  it('returns actionable diagnostics and can reject unsupported documents', () => {
    const document = createDocument();
    document.pages[0]!.regions.body.children.push(
      createNode('text', { content: '{{customer.name}}' }),
    );
    const policy = createCapabilityPolicy(['print.header-footer', 'print.pagination']);
    const diagnostics = findUnsupportedDocumentCapabilities(document, policy);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      capability: 'data.resolve',
      reason: 'Component property contains a template expression.',
    });
    expect(() => assertDocumentCapabilities(document, policy)).toThrow(
      UnsupportedDocumentCapabilitiesError,
    );
  });
});
