import { applyCommand } from '../../src/lib/core/commands.js';
import {
  createDocument,
  createNode,
  createPage,
  createPrintSettings,
} from '../../src/lib/core/create.js';
import type {
  ComponentNode,
  DataBinding,
  ExemplaraDocument,
} from '../../src/lib/core/types.js';

const textProps = (content: string, overrides: Record<string, unknown> = {}) => ({
  content,
  fontSize: 12,
  fontWeight: 'normal',
  color: '#374151',
  align: 'left',
  ...overrides,
});

function boundText(
  label: string,
  sourceId: string,
  path: string,
  overrides: Record<string, unknown> = {},
  binding: Partial<DataBinding> = {},
): ComponentNode {
  const node = createNode('text', textProps(label, overrides));
  node.dataBindings = [{
    targetProp: 'content',
    sourceId,
    path,
    fallback: label,
    ...binding,
  }];
  return node;
}

function fieldRow(label: string, value: ComponentNode): ComponentNode {
  const row = createNode('container', {
    direction: 'row',
    gap: 12,
    padding: 0,
    background: '',
    align: 'center',
    justify: 'space-between',
  }, [
    createNode('text', textProps(label, { fontSize: 11, color: '#6b7280' })),
    value,
  ]);
  row.pagination = { keepTogether: true };
  return row;
}

/** Comprehensive playground fixture for hierarchy, data, flow, print, and styling. */
export function buildDemoDocument(): ExemplaraDocument {
  const doc = createDocument({ name: 'Northstar Consulting · Invoice', withInitialPage: false });
  const page = createPage({ label: 'Invoice', withBackground: true });
  applyCommand(doc, { type: 'page:add', payload: { page } });

  applyCommand(doc, {
    type: 'data:add-source',
    payload: {
      source: {
        id: 'branding',
        name: 'Brand profile',
        type: 'static',
        sampleData: {
          company: {
            name: 'Northstar Consulting',
            legalName: 'Northstar Consulting Ltd.',
            vatId: 'BG204812345',
            address: {
              line1: '15 Vitosha Boulevard',
              city: 'Sofia',
              postalCode: '1000',
              country: 'Bulgaria',
            },
            contact: { email: 'billing@northstar.example', phone: '+359 2 555 0142' },
          },
          theme: { accent: '#0d9488', locale: 'en-BG' },
        },
      },
    },
  });
  applyCommand(doc, {
    type: 'data:add-source',
    payload: {
      source: {
        id: 'invoice',
        name: 'Invoice payload',
        type: 'static',
        sampleData: {
          invoice: {
            number: 'INV-2026-0713',
            issueDate: '13 July 2026',
            dueDate: '12 August 2026',
            status: 'approved',
            currency: 'EUR',
            totalValue: 10728,
            taxRate: 0.2,
            issueDateIso: '2026-07-13',
            subtotal: '€8,940.00',
            tax: '€1,788.00',
            total: '€10,728.00',
            notes: 'Thank you for partnering with Northstar Consulting.',
          },
          customer: {
            name: 'Jane Doe',
            company: 'Acme Manufacturing GmbH',
            email: 'jane.doe@acme.example',
            address: {
              line1: '42 Innovation Park',
              city: 'Berlin',
              postalCode: '10115',
              country: 'Germany',
              formatted: '10115 Berlin, Germany',
            },
          },
          project: {
            name: 'Global document automation rollout',
            reference: 'ACME-DOC-2026-Q3',
            milestones: [
              { title: 'Discovery', owner: 'Mila Petrova', complete: true },
              { title: 'Template system', owner: 'Ivan Kolev', complete: true },
              { title: 'Production rollout', owner: 'Elena Marinova', complete: false },
            ],
          },
          payment: {
            method: 'bank_transfer',
            iban: 'BG80 BNBG 9661 1020 3456 78',
            swift: 'BNBGBGSD',
            reference: 'INV-2026-0713',
          },
          items: Array.from({ length: 34 }, (_, index) => ({
            description: `${String(index + 1).padStart(2, '0')} · ${[
              'Discovery workshop',
              'Design system refinement',
              'Template implementation',
              'Accessibility review',
              'PDF quality assurance',
            ][index % 5]}`,
            category: ['Strategy', 'Design', 'Engineering'][index % 3],
            qty: (index % 4) + 1,
            unitPrice: `€${(125 + index * 17).toFixed(2)}`,
            price: `€${(((index % 4) + 1) * (125 + index * 17)).toFixed(2)}`,
          })),
        },
      },
    },
  });

  const background = page.regions.background!;
  const watermark = createNode('watermark', {
    text: 'APPROVED',
    opacity: 0.035,
    fontSize: 88,
    color: '#0d9488',
    rotation: -32,
  });
  applyCommand(doc, { type: 'component:add', payload: { parentId: background.id, node: watermark } });

  const body = page.regions.body;
  const brandName = boundText(
    'Company name',
    'branding',
    'company.name',
    { fontSize: 12, fontWeight: '700', color: '#0f766e' },
    { transform: 'uppercase' },
  );
  const header = createNode('container', {
    direction: 'row', gap: 12, padding: 0, background: '', align: 'center', justify: 'space-between',
  }, [
    brandName,
    createNode('text', textProps('INVOICE', { fontSize: 26, fontWeight: '700', color: '#0d9488', align: 'right' })),
  ]);
  header.pagination = { keepTogether: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: header } });
  applyCommand(doc, {
    type: 'component:add',
    payload: { parentId: body.id, node: createNode('divider', { thickness: 2, color: '#0d9488', style: 'solid' }) },
  });

  const customerCard = createNode('container', {
    direction: 'column', gap: 4, padding: 12, background: '#f8fafc', align: 'stretch', justify: 'flex-start',
  }, [
    createNode('text', textProps('BILL TO', { fontSize: 10, fontWeight: '700', color: '#0f766e' })),
    boundText('Customer name', 'invoice', 'customer.name', { fontSize: 16, fontWeight: '700', color: '#111827' }),
    boundText('Customer company', 'invoice', 'customer.company', { fontSize: 12 }),
    boundText('Customer address', 'invoice', 'customer.address.line1', { fontSize: 11, color: '#6b7280' }),
    boundText('Customer city and country', 'invoice', 'customer.address.formatted', { fontSize: 11, color: '#6b7280' }),
    boundText('Customer email', 'invoice', 'customer.email', { fontSize: 11, color: '#0f766e' }),
  ]);

  const metaCard = createNode('container', {
    direction: 'column', gap: 5, padding: 12, background: '#f0fdfa', align: 'stretch', justify: 'flex-start',
  }, [
    fieldRow('Invoice number', boundText('Invoice number', 'invoice', 'invoice.number', { fontSize: 11, fontWeight: '700', align: 'right' })),
    fieldRow('Issued', boundText('Issue date', 'invoice', 'invoice.issueDate', { fontSize: 11, align: 'right' })),
    fieldRow('Due', boundText('Due date', 'invoice', 'invoice.dueDate', { fontSize: 11, align: 'right' })),
    fieldRow('Status', boundText('Invoice status', 'invoice', 'invoice.status', { fontSize: 11, fontWeight: '700', color: '#047857', align: 'right' }, { transform: 'uppercase' })),
    fieldRow('Project', boundText('Project reference', 'invoice', 'project.reference', { fontSize: 11, align: 'right' })),
  ]);

  const summary = createNode('columns', { ratios: [1.15, 0.85], gap: 16 });
  summary.slots = { col1: [customerCard], col2: [metaCard] };
  summary.pagination = { keepTogether: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: summary } });
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: createNode('spacer', { height: 20 }) } });

  const projectHeading = boundText('Project name', 'invoice', 'project.name', {
    fontSize: 18, fontWeight: '700', color: '#1a1d23',
  });
  projectHeading.pagination = { keepWithNext: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: projectHeading } });

  const deliveryTopics = [
    'Discovery and scope', 'Information architecture', 'Component design', 'Template authoring',
    'Content validation', 'Accessibility review', 'PDF output verification', 'Stakeholder acceptance',
  ];
  const narrative = Array.from({ length: 24 }, (_, index) => `
    <p><strong>${String(index + 1).padStart(2, '0')} · ${deliveryTopics[index % deliveryTopics.length]}</strong><br>
    The delivery team reviewed the source material, documented the decision, and verified the result against the approved template. Supporting notes remain attached to the project record for the final handoff.</p>
  `).join('');
  const narrativeNode = createNode('text', textProps(narrative, { fontSize: 12 }));
  narrativeNode.pagination = { orphanLines: 3, widowLines: 3 };
  narrativeNode.styleBindings = [{ property: 'line-height', value: '1.55' }];
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: narrativeNode } });

  const lineItemsHeading = createNode('text', textProps('Detailed line items', { fontSize: 18, fontWeight: '700', color: '#1a1d23' }));
  lineItemsHeading.pagination = { keepWithNext: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: lineItemsHeading } });
  const lineItems = createNode('table', {
    columns: [
      { key: 'description', label: 'Description' },
      { key: 'category', label: 'Category' },
      { key: 'qty', label: 'Qty' },
      { key: 'unitPrice', label: 'Unit' },
      { key: 'price', label: 'Total' },
    ],
    rows: [], striped: true, showHeader: true,
  });
  lineItems.dataBindings = [{ targetProp: 'rows', sourceId: 'invoice', path: 'items', fallback: [] }];
  lineItems.pagination = { keepTogether: false };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: lineItems } });

  const totalsCard = createNode('container', {
    direction: 'column', gap: 5, padding: 12, background: '#f8fafc', align: 'stretch', justify: 'flex-start',
  }, [
    fieldRow('Subtotal', boundText('Subtotal', 'invoice', 'invoice.subtotal', { fontSize: 12, align: 'right' })),
    fieldRow('Tax 20%', boundText('Tax', 'invoice', 'invoice.tax', { fontSize: 12, align: 'right' })),
    createNode('divider', { thickness: 1, color: '#99f6e4', style: 'solid' }),
    fieldRow('Amount due', boundText('Invoice total', 'invoice', 'invoice.total', { fontSize: 16, fontWeight: '700', color: '#0f766e', align: 'right' })),
    createNode('text', textProps('Tax rate {{invoice.taxRate | percent}} · Posted {{invoice.issueDateIso | date("en-GB")}}', {
      fontSize: 10, color: '#64748b', align: 'right',
    })),
  ]);
  const totals = createNode('columns', { ratios: [1.25, 0.75], gap: 16 });
  totals.slots = { col1: [], col2: [totalsCard] };
  totals.pagination = { keepTogether: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: totals } });

  const bankDetails = createNode('conditional', {
    conditions: [{ field: 'payment.method', operator: 'eq', value: 'bank_transfer' }],
    conditionLogic: 'and', showWhen: true,
  }, [
    createNode('text', textProps('BANK TRANSFER', { fontSize: 10, fontWeight: '700', color: '#0f766e' })),
    fieldRow('IBAN', boundText('IBAN', 'invoice', 'payment.iban', { fontSize: 11, fontWeight: '700', align: 'right' })),
    fieldRow('SWIFT', boundText('SWIFT', 'invoice', 'payment.swift', { fontSize: 11, align: 'right' })),
    fieldRow('Reference', boundText('Payment reference', 'invoice', 'payment.reference', { fontSize: 11, align: 'right' })),
  ]);
  bankDetails.pagination = { keepTogether: true };
  applyCommand(doc, { type: 'component:add', payload: { parentId: body.id, node: bankDetails } });
  applyCommand(doc, {
    type: 'component:add',
    payload: { parentId: body.id, node: boundText('Invoice note', 'invoice', 'invoice.notes', { fontSize: 11, color: '#6b7280', align: 'center' }) },
  });

  const print = createPrintSettings();
  print.header.variants.first = '<div class="print-header print-header--first"><strong>{{company.name}}</strong><span>{{invoice.number}}</span></div>';
  print.header.variants.odd = '<div class="print-header"><span>{{project.reference}}</span><strong>{{company.name}}</strong></div>';
  print.header.variants.even = '<div class="print-header"><strong>{{company.name}}</strong><span>{{project.reference}}</span></div>';
  print.footer.variants.odd = '<div class="print-footer"><span>Page {{page.number}} of {{page.total}}</span><span>{{invoice.status}}</span></div>';
  print.footer.variants.even = '<div class="print-footer"><span>{{invoice.status}}</span><span>Page {{page.number}} of {{page.total}}</span></div>';
  print.css = [
    '.ex-print-template { color:#6b7280;font:9px/1.35 Inter,Arial,sans-serif; }',
    '.print-header,.print-footer { width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px; }',
    '.print-header { border-bottom:1px solid #99f6e4;padding-bottom:2.5mm; }',
    '.print-header strong { color:#0f766e;font-size:10px;letter-spacing:.06em; }',
    '.print-header--first strong { font-size:11px; }',
    '.print-footer { border-top:1px solid #d1d5db;padding-top:2.5mm;text-transform:capitalize; }',
  ].join('\n');
  doc.print = print;
  return doc;
}
