import { describe, expect, it } from 'vitest';
import { createNode } from '../src/lib/core/index.js';
import {
  friendlyElementLabel,
  friendlyTokenLabel,
  sortColorTokenEntries,
} from '../src/lib/editor/friendly-labels.js';

describe('friendly editor labels', () => {
  it('names imported header and navigation blocks in plain language', () => {
    expect(friendlyElementLabel(createNode('html-element', { tagName: 'header', className: 'gtg-header' }))).toBe('Header');
    expect(friendlyElementLabel(createNode('web-section', { element: 'header', className: 'gtg-header' }))).toBe('Header');
    expect(friendlyElementLabel(createNode('html-element', { tagName: 'nav', className: 'mujo-topbar' }))).toBe('Navigation');
    expect(friendlyElementLabel(createNode('html-element', { tagName: 'h1' }))).toBe('Heading');
    expect(friendlyElementLabel(createNode('html-text', { content: 'Hello' }))).toBe('Text');
  });

  it('names template color tokens without CSS variable syntax', () => {
    expect(friendlyTokenLabel('mujo-bg')).toBe('Page background');
    expect(friendlyTokenLabel('gtg-surface')).toBe('Cards');
    expect(friendlyTokenLabel('quay-accent')).toBe('Accent');
    expect(friendlyTokenLabel('primary')).toBe('Accent');
  });

  it('sorts page colors before supporting tokens', () => {
    const sorted = sortColorTokenEntries({
      'mujo-accent': '#d4b374',
      'mujo-bg': '#040404',
      'mujo-text': '#f4edde',
    });
    expect(sorted.map(([name]) => name)).toEqual(['mujo-bg', 'mujo-text', 'mujo-accent']);
  });
});
