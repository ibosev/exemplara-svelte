# Data-bound authoring and document outline

The Svelte editor treats data as part of the document authoring model rather
than as a preview-only overlay. The playground is a reference fixture for the
complete workflow: define nested JSON, bind component properties, author
`{{path}}` expressions, inspect resolved values, navigate the real hierarchy,
and export the same resolved document.

## Binding model

Two related forms are supported:

- `ComponentNode.dataBindings` is the explicit AST form. It records the target
  property, source id, path, optional transform, and fallback.
- `{{path}}` interpolation can appear inside ordinary string/rich-text props
  when static and dynamic text need to be mixed.

The editor presents an explicit binding with the familiar curly syntax. For
example, a node stored as:

```ts
{
  props: { content: 'Company name' },
  dataBindings: [{
    targetProp: 'content',
    sourceId: 'branding',
    path: 'company.name',
    transform: 'uppercase',
    fallback: 'Company name',
  }],
}
```

opens as `{{company.name}}` when the user double-clicks it. Committing a single
expression updates the explicit binding while retaining its transform and
fallback. Committing mixed content such as `Hello {{customer.name}}` stores the
rich text and removes only the conflicting explicit binding for that property.

The Inspector follows the same rule, so it no longer shows the fallback label
while the canvas shows a resolved value.

## Curly-brace autocomplete

Typing `{{` in the inline rich-text editor opens a live path popup built from
the document's current data sources. It shows path, source, type, and sample
value. Continue typing to filter, use Up/Down to navigate, Enter or Tab to
insert, and Escape to close without leaving the editing session.

Typing a pipe after a path, for example `{{invoice.totalValue | cur`, switches
the same popup to formatter mode. Suggestions come from the editor's extension
registry and insert the complete safe expression. The built-in evaluator
supports pipelines and simple helper syntax without `eval`; hosts can add
formatters or delegate unsupported expressions to their own deterministic
evaluator. The canvas, preview, HTML renderer, expression inventory, and native
PDF header/footer renderer all receive the same runtime.

The reusable logic is in `shared/binding-authoring.ts`:

- open-token detection and pure string completion;
- source-aware path suggestions;
- canonical `{{path}}` formatting;
- exact-expression parsing;
- AST commit behavior that preserves transforms/fallbacks.

`BindingAutocomplete.svelte` handles only presentation, caret anchoring, and
keyboard/mouse events. This separation lets another framework reuse the same
authoring rules.

![Curly-brace autocomplete using current sample data](./images/proof-binding-autocomplete.jpg)

![Formatter autocomplete inside an existing binding](./images/proof-template-formatter-autocomplete.png)

## Data tab

The Data tab now contains three connected views:

1. A template-wide inventory of explicit bindings, including resolved or
   unresolved previews. Clicking an entry selects and reveals its component.
2. A nested object/array tree for every data source. A path can be bound to the
   selected component's primary property with one click.
3. Editable source names and JSON sample data.

Portable functions in `shared/data-browser.ts` build the trees, extract paths,
resolve previews, map sample data by source, and inventory document bindings.

![Binding inventory and nested JSON data tree](./images/proof-nested-data-bindings.jpg)

## Hierarchical outline

The Layers panel is a complete document outline, not a flat list of the active
body. Its hierarchy is:

```text
Document
└── Page
    └── Region
        └── Component
            ├── child component
            └── named slot
                └── component
```

It includes every physical sheet, generated continuation state, optional page
regions, nested containers, named column slots, binding counts, lock/visibility
state, and selection synchronized with the canvas. `shared/layer-tree.ts`
builds this representation without Svelte or DOM dependencies.

Selected and hovered component rows expose quick actions for selecting the
parent, duplicating, hiding/showing, and opening the full action menu. Right
click provides Parent, Edit text, Open data bindings, Duplicate, Copy/Paste,
Move, Create symbol, Lock, Hide, and Delete. All document changes use the same
undoable command engine.

The editor uses two related controls. The Layers context menu provides the
complete command set, while a selected-element strip provides Edit, Select
parent, Duplicate, extension actions, and More. That strip is rendered once at
canvas level—not inside every node—and follows the selected node vertically in
the visible paper gutter. At constrained widths it collapses to one More button.
Both placements are collision-tested against the selected node and paper, so a
small nested text component cannot cover adjacent content with its controls.
The whole node remains draggable. Rename remains an Inspector/document-model
concern. Save as section is an extension-provided action that delegates storage
to its host callback.

![Full hierarchy with selected-row quick actions](./images/proof-hierarchical-layer-stack.png)

![Rich outline context menu](./images/proof-outline-actions-menu.png)

![Selected canvas element with a full gutter action strip](./images/proof-canvas-selection-actions.jpg)

![Compact gutter control at constrained width](./images/proof-selection-toolbar-compact.png)

![Host outline action registered through the template-authoring plugin](./images/proof-template-outline-actions.jpg)

## Playground fixture

`tests/fixtures/demo-document.ts` intentionally exercises the feature set
rather than acting as a minimal hello-world example:

- two nested JSON sources (`branding` and `invoice`);
- 20 logical explicit bindings, including source-specific transforms and a
  table-row array binding;
- customer, company, address, invoice, project, milestone, payment, and
  34-line-item structures;
- nested containers and named column slots;
- conditional bank-transfer content;
- long rich text and table content that produce four scrollable pages and
  continuation fragments;
- first/odd/even native print headers and footers with data and page tokens.

The runtime binding inventory can be larger than the logical count when a
bound author node has been split into physical continuation fragments. The
logical fixture and renderer tests operate on the author-owned model.

## Plugin boundary decision

The typed extension API now exists, but the split remains intentional:

- data sources, explicit bindings, resolution, the Data tab, and hierarchy are
  base document/editor semantics;
- formatters, helper evaluation, extra autocomplete providers, optional panels,
  reusable block libraries, and product toolbar commands are extensions;
- parent/duplicate/order/visibility remain standard outline actions;
- persistence actions such as Save as section are extension actions
  backed by a host callback.

`createTemplateAuthoringPlugin()` demonstrates the boundary with Utils,
Library, and Live expression panels, data-oriented blocks, host commands, and
Save as section. It does not contain authentication or persistence code. See
[Editor extensions](./editor-extensions.md). A consumer-specific schema and
service migration belongs in the consuming application rather than this
playground or plugin.
