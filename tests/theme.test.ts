import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderEditorThemeStyle } from '../src/lib/editor/theme.js';

describe('host editor theme', () => {
  it('renders typed host tokens as scoped editor properties', () => {
    expect(renderEditorThemeStyle({
      accent: '#ea580c',
      selectionOutline: '#c2410c',
      editingOutline: '#c2410c',
      radius: '2px',
      radiusLarge: '2px',
    })).toBe([
      '--exs-accent: #ea580c',
      '--exs-selection-outline: #c2410c',
      '--exs-editing-outline: #c2410c',
      '--exs-radius: 2px',
      '--exs-radius-lg: 2px',
    ].join('; '));
  });

  it('omits empty and missing theme values', () => {
    expect(renderEditorThemeStyle()).toBeUndefined();
    expect(renderEditorThemeStyle({ accent: '  ' })).toBeUndefined();
  });

  it('uses theme tokens for selected and editing outlines', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, '../src/lib/editor/theme.css'),
      'utf8',
    );
    expect(css).toContain('outline: 2px solid var(--exs-selection-outline)');
    expect(css).toContain('outline: 2px solid var(--exs-editing-outline)');
    expect(css).not.toContain('.exs-node--editing {\n  outline: 2px solid var(--exs-success)');
  });
});
