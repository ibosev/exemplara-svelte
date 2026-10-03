import assert from 'node:assert/strict';
import { createDocument, createNode } from 'exemplara-core';
import { render } from 'exemplara-core/renderer';
import { generatePdf } from 'exemplara-plugins/pdf';

export async function generatePackedPdf(browser) {
  const document = createDocument({ name: 'Packed PDF' });
  document.pages[0].regions.body.children.push(createNode('text', { content: 'Portable PDF content' }));
  const result = await generatePdf(document, { engine: { browser } });
  assert.equal(result.html, render(document).fullHtml);
  return result;
}
