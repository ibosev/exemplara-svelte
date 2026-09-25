# Word-like Paged Editing and Automatic Overflow

Exemplara Svelte schema `1.4.0` provides a continuous, Word-like editor workspace
without replacing the print-first AST. The document still contains explicit
pages; the editor creates and removes those pages deterministically as measured
content crosses sheet boundaries.

## Canvas behavior

- Every page appears in one vertically scrolling stack.
- The canvas owns the scroll viewport, so the main toolbar and both side panels
  remain fixed while mouse-wheel, trackpad, touch, and keyboard scrolling move
  through the document.
- The numbered strip jumps to a sheet without hiding the others.
- Scrolling updates the active-page outline and numbered strip automatically,
  using the sheet nearest the reading position in the viewport.
- Page wrappers reserve scaled width and height, so zoom does not collapse the
  space between sheets.
- The active sheet receives a subtle theme-accent outline and printable-frame guide.
- Generated continuation sheets are marked `Auto`.
- Header and footer margin zones reveal Word-style section labels on hover.
- Double-clicking a margin edits its section-aware safe HTML directly on the
  paper at the correct position, page, and first/odd/even variant.
- A horizontal millimetre ruler follows page width, margins, orientation, and
  zoom; selecting text exposes draggable indents and authored tab stops.

## Playground screenshots

The current checked-in browser captures show:

- [rich text continuing onto a generated sheet](./images/proof-rich-text-fragmentation.png);
- [a table continuing by complete rows with its header repeated](./images/proof-table-row-pagination.png);
- [the selected continuation and its Page flow controls](./images/proof-page-flow-controls.png).
- [a section-specific header being edited directly on Page 2](./images/proof-direct-section-header-edit.png);
- [paragraph geometry controlled through the ruler and Inspector](./images/proof-word-ruler-paragraph.png).

Earlier captures remain available for the original continuous-canvas work:
[page 1](./images/svelte-word-scroll-page-1.png), the
[page boundary](./images/svelte-word-scroll-page-boundary.png), and the first
[generated continuation page](./images/svelte-word-scroll-page-2.png).

## Pagination settings

```ts
interface PaginationSettings {
  mode: 'manual' | 'auto';
  removeEmptyPages: boolean;
}
```

New documents default to automatic flow. Existing `1.1.0` documents receive
the defaults through migration. The canvas toolbar exposes an **Auto flow**
checkbox for switching modes through the undoable command engine.

Each component can also carry author-owned rules:

```ts
interface ComponentPaginationRules {
  breakBefore?: boolean;
  keepTogether?: boolean;
  keepWithNext?: boolean;
  orphanLines?: number; // text; default 2
  widowLines?: number;  // text; default 2
}
```

These are exposed in the Inspector's **Page flow** section. They are plain AST
metadata, so another editor package can reuse them without Svelte.

## Reflow algorithm

After a document edit or component resize, the standard-DOM adapter measures:

- the body frame's top and bottom boundaries;
- every direct body child's outer rectangle, including vertical margins;
- child boundaries inside ordinary vertical containers, recursively;
- safe rich-text word/line split candidates using DOM `Range` rectangles;
- safe table split indices using complete rendered rows.

The pure `planPageFlow()` core function then plans one stable mutation:

1. Recombine adjacent fragments from the same logical component.
2. Respect the earliest explicit `breakBefore` or measured overflow point.
3. Move a `keepWithNext` component with its following component when both fit
   on a fresh body frame.
4. Split rich text at a fitting word boundary while preserving local paragraph
   widow/orphan minimums, split a table between complete rows, or partition an
   ordinary vertical container at either of those boundaries.
5. Otherwise move the overflowing whole component and its following siblings.
6. Create a continuation sheet immediately after the source page unless the
   next page is already auto-generated.
7. Measure the new DOM and repeat one mutation at a time until stable.
8. When space becomes available, pull one complete component/fragment backward.
9. Remove empty auto-generated sheets when configured.

Every planned pass executes as one undoable command batch. The planner has no
DOM dependency and is covered independently by unit tests. The browser adapter
is `shared/fragment-dom.ts` plus `shared/page-flow-dom.ts`; it has no Svelte
imports and can be called from any standard DOM host.

## Rich text and table fragments

Fragment metadata is internal document state:

```ts
interface ComponentFlowFragment {
  groupId: string;
  kind: 'text' | 'table' | 'container';
  continuation: boolean;
  originalContent?: string;
  tableRange?: { start: number; end: number };
}
```

Rich-text fragments retain the original sanitized source for lossless
recombination. Double-clicking any continuation collapses the group before
opening the contenteditable surface; automatic reflow pauses for that editing
session and resumes when editing ends. Tables keep their complete `rows` prop
and render only the fragment's half-open source range, so data-bound and static
tables retain stable source order and stripe parity. Each table fragment renders
its `<thead>`, which repeats the header naturally.

The playground browser verification stabilizes at four sheets with two rich
text fragments and three table fragments. It asserts that 24 narrative sections
and 34 rows appear exactly once, three table headers are present, no node crosses
a body boundary, and no console/page error occurs.

## Manual and authored pages

Auto flow never treats an authored next page as continuation storage. If a
manual page follows an overflowing page, the editor inserts a generated sheet
before it. This preserves the authored page's content and order.

Manual mode disables all measured movement. Users can still add, delete,
reorder, and populate explicit pages normally.

## Nested and indivisible content

Ordinary block or column-direction containers are transparent to page flow.
The engine recursively partitions their child sequence, duplicates only the
required styled container shells on continuation sheets, and preserves child
order. Nested rich text still fragments at measured line boundaries and nested
tables still fragment between rows with their header repeated. Editing any
fragment first recombines the complete logical container, so no content is lost.

Horizontal flex rows, grids, Columns components, repeaters, conditionals,
images, watermarks, and custom components remain whole flow units because
splitting their layout shell would change its geometry or data semantics.
`keepTogether` deliberately makes a supported text, table, or vertical
container whole as well. A first whole component taller than the printable body
cannot move forward safely—it would create pages forever—so the editor leaves it
in place and shows an oversized-block warning.

The Inspector enables **Keep together** and text widow/orphan controls for
content nested through vertical containers. Explicit **Page break before** and
**Keep with next** remain rules for direct body blocks, where their sibling
relationship is unambiguous. Importers that receive a generated whole-page
wrapper can still opt into
`promoteSinglePageRoot: true` to move that wrapper's presentation onto the page
body, plus `pageStrategy: 'single'` to keep its children on one authored sheet.
This leaves root-level text and tables available to automatic pagination while
preserving the wrapper's padding, background, grid, and typography styles.

## PDF relationship

Auto-pagination updates the same AST pages consumed by HTML preview and
`generatePdf()`. The native Chromium header/footer pipeline therefore receives
the final global page count and resolves first/odd/even variants after reflow.
There is no separate hidden PDF pagination model.
