# Ruler and Paragraph Formatting

Schema `1.4.0` adds optional paragraph geometry to text nodes. The model and
normalization helpers are plain TypeScript so the same behavior can be used by
the Svelte editor or a headless template tool.

## Document model

```ts
interface ParagraphFormatting {
  leftIndent: number;       // millimetres from the printable left edge
  rightIndent: number;      // millimetres from the printable right edge
  firstLineIndent: number;  // signed offset relative to leftIndent
  spaceBefore: number;      // millimetres
  spaceAfter: number;       // millimetres
  lineHeight: number;       // unitless CSS line height
  tabStops: ParagraphTabStop[];
}

interface ParagraphTabStop {
  id: string;
  position: number;         // millimetres from the printable left edge
  alignment: 'left' | 'center' | 'right' | 'decimal';
}

interface ComponentNode {
  paragraph?: ParagraphFormatting;
}
```

Omitting `paragraph` preserves the existing renderer defaults. The editor
materializes normalized values only when a paragraph control is changed.
`normalizeParagraphFormatting()` clamps indents and tab positions to the active
page's printable width and sorts tab stops deterministically.

## Reusable APIs

Import these functions from `exemplara-svelte/shared`:

- `resolveParagraphFormatting()` returns complete defaults for a node;
- `normalizeParagraphFormatting()` constrains user input to page geometry;
- `addParagraphTabStop()`, `updateParagraphTabStop()`, and
  `removeParagraphTabStop()` perform immutable tab edits;
- `rulerPercent()` maps millimetres into renderer-independent ruler geometry;
- `paragraphStyleMap()` produces the CSS styles consumed by HTML/PDF rendering.

The Svelte context sends normalized paragraph changes through the same undoable
component command engine used by the rest of the document. If the selected node
is a flowed text continuation, its logical fragment group is collapsed before
formatting so one author-owned node remains the source of truth.

## Editor workflow

1. Select a text component. The horizontal ruler activates above the continuous
   paper stack.
2. Drag the upper marker for first-line indent, the lower-left marker for left
   indent, or the right marker for right indent.
3. Choose a left, center, right, or decimal tab mode and click the ruler to add
   a stop. Double-click a stop to remove it.
4. Use **Inspector → Paragraph** for exact millimetre values, line spacing,
   before/after spacing, tab position, and tab alignment.

The ruler width tracks the selected page's physical size, orientation, margins,
and editor zoom. Paragraph styles are emitted by the renderer, so the canvas,
HTML export, print preview, and PDF content use the same geometry.

![Word-style ruler and paragraph controls](./images/proof-word-ruler-paragraph.png)

## Current tab behavior

Plain-text tab characters render with preserved whitespace. Browser CSS does
not natively expose Word's independently aligned tab-stop layout; the renderer
therefore uses the first authored stop to derive a compatible CSS `tab-size`
while retaining all positions and alignments in the AST for richer renderers.
The ruler and Inspector already edit the complete portable model. A future text
layout engine can consume center/right/decimal stops without a schema change.
