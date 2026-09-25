import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createDocument,
  createNode,
  createPage,
  planRemovePrintSectionBreak,
  planSetPrintSectionLinked,
  planStartPrintSection,
  planUpdatePrintVariant,
  resolvePrintSection,
  resolveSectionTemplate,
} from '../src/lib/core/index.js';
import {
  addParagraphTabStop,
  normalizeParagraphFormatting,
  removeParagraphTabStop,
  resolveParagraphFormatting,
  updateParagraphTabStop,
} from '../src/lib/shared/index.js';
import { render } from '../src/lib/renderer/index.js';

function apply(doc: ReturnType<typeof createDocument>, commands: ReturnType<typeof planStartPrintSection>['commands']) {
  commands.forEach((command) => applyCommand(doc, command));
}

function fourPageDocument() {
  const doc = createDocument({ withInitialPage: false });
  for (let index = 0; index < 4; index++) doc.pages.push(createPage({ label: `Page ${index + 1}` }));
  doc.print.header.variants.default = '<div>GLOBAL</div>';
  doc.print.header.variants.first = '<div>FIRST</div>';
  doc.print.header.variants.odd = '<div>ODD</div>';
  doc.print.header.variants.even = '<div>EVEN</div>';
  return doc;
}

describe('Word-style print sections', () => {
  it('inherits a new section and resolves its first page locally', () => {
    const doc = fourPageDocument();
    const plan = planStartPrintSection(doc, 2);
    apply(doc, plan.commands);

    expect(resolvePrintSection(doc, 1).section.label).toBe('Section 1');
    expect(resolvePrintSection(doc, 2)).toMatchObject({ sectionPageIndex: 0, explicitStart: true });
    expect(resolvePrintSection(doc, 3)).toMatchObject({ sectionPageIndex: 1, explicitStart: false });
    expect(resolveSectionTemplate(doc, 'header', 2)).toMatchObject({
      variant: 'first',
      html: '<div>FIRST</div>',
      contentSectionIndex: 0,
    });
    expect(resolveSectionTemplate(doc, 'header', 3).variant).toBe('even');
  });

  it('links headers and footers independently and materializes inherited content on unlink', () => {
    const doc = fourPageDocument();
    apply(doc, planStartPrintSection(doc, 2).commands);
    const second = resolvePrintSection(doc, 2).section;

    apply(doc, planSetPrintSectionLinked(doc, second.id, 'header', false).commands);
    apply(doc, planUpdatePrintVariant(doc, 'header', 2, 'first', '<div>SECTION TWO</div>').commands);

    expect(resolveSectionTemplate(doc, 'header', 2).html).toBe('<div>SECTION TWO</div>');
    expect(resolveSectionTemplate(doc, 'header', 0).html).toBe('<div>FIRST</div>');
    expect(resolveSectionTemplate(doc, 'footer', 2).contentSectionIndex).toBe(0);
    expect(resolvePrintSection(doc, 2).section.header.linkedToPrevious).toBe(false);
    expect(resolvePrintSection(doc, 2).section.footer.linkedToPrevious).toBe(true);
  });

  it('removes a section break and its unused section definition', () => {
    const doc = fourPageDocument();
    apply(doc, planStartPrintSection(doc, 2).commands);
    expect(doc.print.sections).toHaveLength(2);
    apply(doc, planRemovePrintSectionBreak(doc, 2).commands);
    expect(doc.pages[2]!.sectionId).toBeUndefined();
    expect(doc.print.sections).toHaveLength(1);
    expect(resolvePrintSection(doc, 3).section.label).toBe('Section 1');
  });
});

describe('portable paragraph and ruler model', () => {
  it('clamps paragraph geometry and maintains sorted editable tab stops', () => {
    let formatting = normalizeParagraphFormatting({
      leftIndent: 30,
      rightIndent: 200,
      firstLineIndent: -50,
      lineHeight: 9,
    }, 170);
    expect(formatting).toMatchObject({ leftIndent: 30, rightIndent: 135, firstLineIndent: -30, lineHeight: 4 });

    formatting = addParagraphTabStop(formatting, 42, 'decimal', 170);
    formatting = addParagraphTabStop(formatting, 18, 'left', 170);
    expect(formatting.tabStops?.map((tab) => tab.position)).toEqual([18, 42]);
    const decimal = formatting.tabStops?.find((tab) => tab.alignment === 'decimal')!;
    formatting = updateParagraphTabStop(formatting, decimal.id, { position: 55, alignment: 'right' }, 170);
    expect(formatting.tabStops?.at(-1)).toMatchObject({ position: 55, alignment: 'right' });
    formatting = removeParagraphTabStop(formatting, decimal.id, 170);
    expect(formatting.tabStops).toHaveLength(1);
  });

  it('renders paragraph geometry through the same HTML used for PDF output', () => {
    const doc = createDocument();
    const node = createNode('text', { content: 'Indented paragraph' });
    node.paragraph = {
      leftIndent: 12,
      rightIndent: 8,
      firstLineIndent: 5,
      spaceBefore: 3,
      spaceAfter: 4,
      lineHeight: 1.75,
    };
    doc.pages[0]!.regions.body.children.push(node);
    const { html } = render(doc);
    expect(html).toContain('margin-left: 12mm');
    expect(html).toContain('margin-right: 8mm');
    expect(html).toContain('text-indent: 5mm');
    expect(html).toContain('line-height: 1.75');
    expect(resolveParagraphFormatting(node).spaceAfter).toBe(4);
  });
});
