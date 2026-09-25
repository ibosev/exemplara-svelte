# Editor plugins, extensions, and host integration

> The editor is migrating from function-style additive extensions to validated,
> capability-driven compositions. Existing extensions remain supported through
> the backward-compatible full preset. See
> [Composable editor architecture](./composable-editor-architecture.md) for the
> target boundaries and implementation sequence.

For the complete built-in inventory—including factory imports, stable plugin
ids, capabilities, dependencies, mutually exclusive print variants, presets,
and runtime toggling—see the [plugin and extension reference](./plugin-reference.md).

The Svelte editor exposes a typed extension boundary for product-specific UI
without coupling the document engine to authentication, persistence, or HTTP
services. An extension can register components, renderers, blocks, panels,
commands, outline actions, autocomplete providers, formatters, and an optional
expression evaluator. Each `Editor` receives its own component, renderer,
binding-transform, icon, and UI registries, so two instances can use the same
contribution ids with different implementations. Deprecated process-wide
renderer/transform/icon functions remain available for legacy integrations;
new plugins register through the extension API.

## Basic setup

```svelte
<script lang="ts">
  import {
    Editor,
    createTemplateAuthoringPlugin,
    type EditorHostConfig,
  } from 'exemplara-svelte';

  const templateAuthoring = createTemplateAuthoringPlugin({
    blockExpressions: {
      dynamicText: '{{customer.name}}',
      currency: '{{invoice.total | currency("EUR")}}',
      date: '{{invoice.issuedAt | date("en-GB")}}',
      dataRow: '{{invoice.total | currency("EUR")}}',
    },
    onGeneratePdf: async (document) => {
      await api.generatePdf(document);
    },
    onSaveAsSection: async ({ node, document }) => {
      await api.saveSection({ node, documentId: document.id });
    },
  });

  const host: EditorHostConfig = {
    brand: { mark: 'T', label: 'Template Studio' },
    onReady: (controller) => controller.setStatus('Ready', 'success'),
    onSave: (document) => api.saveTemplate(document),
  };
</script>

<Editor
  document={template}
  extensions={[templateAuthoring]}
  {host}
  onchange={(document) => (template = document)}
/>
```

`onchange` reports normal undoable document edits. `host.onSave` is explicit;
the base editor does not assume a persistence protocol or silently autosave.

## Validated composition

New integrations should define identified plugins and pass an immutable
composition. Plugin setup uses the same contribution API while adding
dependency validation, capability policy, host services, and lifecycle cleanup.

```ts
const composition = composeEditor({
  policy: createCapabilityPolicy(['document.edit', 'export.pdf']),
  plugins: [pdfExportPlugin],
  services: { pdf: pdfService },
});
```

The host resolves client entitlements before composing the editor. Plugins do
not read subscription plans or authentication state. For plugin-owned
features, runtime availability requires both policy permission and an
installed plugin that declares the capability in `provides`; policy permission
does not manufacture behavior when that plugin is absent.

### Autosave and durable version history

Undo/redo and version history are deliberately separate. `DocumentEngine`
owns fast, in-memory command history for the current editing session. Durable
autosave, named snapshots, and restore operations are installed with
`createVersionHistoryPlugin()` and delegated to a host persistence service:

```ts
import {
  DOCUMENT_VERSION_SERVICE_ID,
  composeEditor,
  type DocumentVersionService,
} from 'exemplara-svelte/editor';
import { createCoreEditingPlugin } from 'exemplara-svelte/plugins/core-editing';
import { createVersionHistoryPlugin } from 'exemplara-svelte/plugins/version-history';

const versions: DocumentVersionService = {
  autosaveDelayMs: 10_000,
  maxEntries: 10,
  list: ({ limit = 10 } = {}) => api.listVersions(documentId, limit),
  getDocument: (versionId) => api.loadVersionDocument(documentId, versionId),
  saveDraft: (document, options) => api.saveDraft(documentId, document, options),
  createSnapshot: (document, options) => api.createSnapshot(documentId, document, options),
  restore: (versionId, options) => api.restoreVersion(documentId, versionId, options),
};

const composition = composeEditor({
  services: { [DOCUMENT_VERSION_SERVICE_ID]: versions },
  plugins: [
    createCoreEditingPlugin(),
    createVersionHistoryPlugin({ toolbar: false }),
  ],
});
```

The plugin contributes an always-mounted autosave lifecycle, a right-side
History panel, and the public commands `document.version-history`,
`document.snapshot`, and `document.version-history.mark-saved`. Selecting a
snapshot uses `getDocument()` to render the complete version on the canvas
without loading it into `DocumentEngine`; undo history, dirty state, and the
editable draft remain untouched until Restore is confirmed. A product shell
can expose the first two commands in its own menus and toolbar. `toolbar: false`
keeps the command available without duplicating product chrome.

Autosave updates the working draft after a 10-second debounce and requests no
snapshot. Explicit Save can pass `createSnapshot: true` to checkpoint the
previous state; Save snapshot creates a named restore point; restore asks the
service to checkpoint the current state before replacing the document. The
package never assumes HTTP routes, authentication, storage, or retention
policy. A server adapter can call version APIs, while an offline host can use
IndexedDB or local storage behind the same contract.

For actual bundle omission, mount the dedicated lean entry point and import the
composition mechanism separately:

```ts
import ComposableEditor from 'exemplara-svelte/editor/composable';
import { composeEditor } from 'exemplara-svelte/editor/composition';
import { createCoreEditingPlugin } from 'exemplara-svelte/plugins/core-editing';
```

The backward-compatible `Editor` component statically owns the full preset by
design. Passing a composition to `Editor` changes runtime behavior but cannot
remove that preset from its module graph; use `ComposableEditor` when bundle
size and feature-code omission matter.

## Extension API

An `EditorExtension` is a function that receives `EditorExtensionApi`:

```ts
import type { EditorExtension } from 'exemplara-svelte/editor';

export const accountingExtension: EditorExtension = (api) => {
  api.addFormatter({
    name: 'accounting',
    label: 'Accounting amount',
    category: 'Numbers',
    description: 'Show a signed two-decimal amount.',
    example: '{{invoice.total | accounting("EUR")}}',
    format: (value, [currency = 'EUR']) =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: String(currency),
        minimumFractionDigits: 2,
      }).format(Number(value)),
  });

  api.addCommand({
    id: 'accounting.validate',
    label: 'Validate',
    placement: 'toolbar',
    execute: async (editor) => {
      const ok = await validate(editor.engine.snapshot());
      editor.setHostStatus(ok ? 'Valid' : 'Review required', ok ? 'success' : 'warning');
      return ok;
    },
  });
};
```

Available registration methods:

| Method | Purpose |
|---|---|
| `addComponent` | Register a typed AST component and optional HTML renderer |
| `addComponentIcon` | Register a session-scoped Lucide component icon |
| `addBindingTransform` | Register a session-scoped explicit-binding transform |
| `addBlock` | Add a typed reusable document fragment to Add and host block surfaces |
| `addPanel` | Add a Svelte panel to the left or right editor rail; the built-in panels are the same contributions, registered by `createCorePanelsPlugin()` |
| `addInspectorSection` | Add a section below the Inspector's prop fields, with optional per-selection `visible(editor, node)`; the built-in sections are registered by `createCoreInspectorPlugin()` |
| `addToolbarCluster` | Add a control group to the top toolbar with an optional leading `divider`/`spacer` separator and `visible(editor)`; the built-in toolbar is registered by `createCoreToolbarPlugin()` |
| `addCanvasDecoration` | Add chrome around the sheet surface (`above` the surface or floating `overlay`); the ruler is registered by `createCoreCanvasPlugin()`, while optional selection/context overlays belong to `createActionSurfacesPlugin()` |
| `addCommand` | Register one executable action and its shared availability rule |
| `addMenuItem` | Present a command in context, selection, Layers, or Inspector actions |
| `addKeybinding` | Map a keyboard gesture to an existing command |
| `addOutlineAction` | Add a selected-node toolbar/context-menu action |
| `addAutocompleteProvider` | Append path/helper suggestions to rich-text autocomplete |
| `addStyleField` | Add a selected-element CSS control to the Design panel, optionally filtered by `visible(editor, node)` |
| `addFormatter` | Register a safe expression-pipeline formatter; duplicate names fail fast |
| `replaceFormatter` | Deliberately replace an existing formatter when a host product owns that name's contract |
| `setExpressionEvaluator` | Delegate unsupported expressions to a host engine |

Components, blocks, commands, panels, and providers should use stable,
namespaced ids. Commands, menus, keybindings, panels, Inspector sections,
toolbar clusters, canvas decorations, blocks, autocomplete providers, style fields,
formatters, outline actions, and the expression evaluator are
collision-checked; duplicates fail during editor
setup instead of silently depending on plugin order. The full preset reserves
the built-in panel ids (`components`, `layers`, `inspect` via
`createCorePanelsPlugin()`; `design`, `print`, `assets`, `symbols`, `audit`
via their feature plugins; `data` via `createDataBindingPlugin()`), the
built-in inspector-section ids (`paragraph`, `box-model` via
`createCoreInspectorPlugin()`; `page-flow` via `createPrintPlugin()`;
`data-bindings` via `createDataBindingPlugin()`), and the core toolbar-cluster ids
(`brand`, `history`, `host-status`, `commands`, `zoom`, `theme`, `actions`
via `createCoreToolbarPlugin()`; `data-preview` via
`createDataBindingPlugin()`; `export` via `createExportPlugin()`), and the canvas-decoration ids
(`ruler` via `createCoreCanvasPlugin()`; `selection-toolbar`, `context-menu`
via `createActionSurfacesPlugin()`). Core
contributions use order below 50;
extension contributions default to 50 — after panels and sections, and
between the `commands` and `zoom` toolbar clusters. A panel flagged
`activateOnSelection: true` opens when a node is selected (the core Inspect
panel sets it; the first flagged panel by order wins). `addOutlineAction`
remains a compatibility helper and is internally adapted to a command plus
menu contributions.

### Host-owned product chrome

An embedding application can keep the package toolbar for canvas controls
without repeating product identity and application actions. Every built-in
toolbar cluster is enabled by default and can be omitted explicitly:

```ts
createCoreToolbarPlugin({
  brand: false,
  history: false,
  status: false,
  theme: false,
  actions: false,
  // `commands` and `zoom` remain enabled.
});
```

This is preferable to hiding package controls with selectors: omitted
clusters do not mount, contributed toolbar commands still compose normally,
and the host can expose the same public commands through its own product bar.
The host can also make the embedded editor match its product system without
global CSS overrides:

```ts
const theme = {
  current: () => productTheme,
  toggle: () => toggleProductTheme(),
  tokens: () => ({
    accent: productTheme === 'dark' ? '#fb923c' : '#ea580c',
    accentStrong: productTheme === 'dark' ? '#fdba74' : '#c2410c',
    selectionOutline: productTheme === 'dark' ? '#fb923c' : '#ea580c',
    editingOutline: productTheme === 'dark' ? '#fb923c' : '#ea580c',
    focusRing: productTheme === 'dark' ? '#fb923c' : '#ea580c',
    radius: '2px',
    radiusLarge: '2px',
    controlHeight: '28px',
    toolbarHeight: '34px',
  }),
};
```

Pass this object as `host.theme`. Any omitted token retains the Exemplara
default. `selectionOutline` and `editingOutline` let a customer brand direct
selection and rich-text edit mode independently; edit mode defaults to the
selection accent. The host remains responsible for accessible labels,
responsive overflow, and calling commands through `EditorController`.

### Vertical side-panel rails

Panels contributed on either side render as vertical icon rails. The active
panel occupies the remaining sidebar width. Users can collapse each side
independently into a compact icon-only rail by clicking the bottom chevron or
the already-active tab. Selecting another tab expands that side again.

Hosts can control the same state without DOM selectors:

```ts
controller.setPanelCompact('left', true);
controller.togglePanelCompact('right');
controller.isPanelCompact('left'); // true
controller.openPanel('data'); // selects Data and expands the right side
```

Canvas selection may update the active Inspector tab while a side is compact,
but it does not override the user's collapsed layout choice.

### Selected-element CSS controls

`createDesignPlugin()` installs a reusable field catalog grouped into Layout,
Spacing, Size, Typography, and Decorations. The target switcher applies those
fields to one of three portable document-model targets:

- **Element / Inline** writes value-backed `styleBindings` on one node.
- **Component** writes `StyleRule` variants for the renderer's stable
  `.ex-{type}` selector.
- **Reusable class** attaches a rule id through `styleBindings` and edits the
  corresponding `.ex-r-{ruleId}` rule group. Classes stay in the project
  library after detaching and report document-wide usage.

Component and reusable-class targets support Base, Hover, and Focus states plus
global, ≤1200px, ≤900px, ≤600px, print, and arbitrary media queries. All of
these are existing `StyleRule.state` / `StyleRule.mediaQuery` data—not
editor-only CSS—so canvas, preview, HTML, and PDF consume the same rules. Empty
values remove the declaration and restore the next cascade/default value.

Product plugins can extend the catalog without replacing the Design panel:

```ts
api.addStyleField({
  id: 'media.object-fit',
  label: 'Object fit',
  property: 'object-fit',
  sector: 'size',
  kind: 'select',
  options: ['contain', 'cover'],
  visible: (_editor, node) => node.type === 'image',
});
```

Style-field ids are collision-checked. This makes plan- or product-specific
CSS controls composable while leaving the core document and renderer generic.

### Data preview versus document preview

The full preset's `createDataBindingPlugin()` contributes the `data-preview`
toolbar cluster and `data.toggle-preview` command. Its braces icon switches the canvas,
including header/footer margin previews, between resolved sample data and raw
`{{expression}}` authoring syntax. It does not open the document preview. The
separate product/core Preview action renders the full multi-page output.

Hosts can expose either control in their own chrome:

```ts
controller.setDataPreview(false); // show {{customer.name}}
await controller.runCommand('data.toggle-preview'); // show sample data again
```

Omitting `createDataBindingPlugin()` removes this cluster and command together
with the Data panel and binding autocomplete.

### Data workspace and PDF page controls

The template-authoring `Data` toolbar command opens a focused workspace over
the editor. It reuses the Data plugin's source editor and binding browser, so
operators can import JSON, create sources and fields, edit sample values, bind
paths to the selected component, inspect existing bindings, and review resolved
expressions without working inside a narrow sidebar. Closing the workspace
keeps the Data panel selected for continued work.

Hosts can open or close this surface directly:

```ts
controller.openDataWorkspace();
controller.closeDataWorkspace();
```

If the Data panel is not installed, `openDataWorkspace()` returns `false`; the
legacy `onImportData` callback remains available as a host fallback for custom
compositions.

The PDF canvas toolbar and Print panel share the same page-layout control. It
edits the active page's size and orientation and exposes automatic page flow as
an icon toggle instead of a checkbox. The same state is available to hosts:

```ts
controller.setAutoFlow(false);
controller.toggleAutoFlow();
controller.autoFlowEnabled; // current document setting
```

### One action, multiple surfaces

Commands own behavior and `canRun`. Menus and keybindings only decide where and
how that command is exposed:

```ts
api.addCommand({
  id: 'accounting.duplicate-line',
  label: 'Duplicate line',
  execute: (editor, { nodeId }) => nodeId ? editor.duplicateNode(nodeId) : false,
});

api.addMenuItem({
  id: 'accounting.duplicate-line.context',
  commandId: 'accounting.duplicate-line',
  location: 'node.context',
  group: '20.edit',
  order: 40,
});

api.addKeybinding({
  id: 'accounting.duplicate-line.shortcut',
  commandId: 'accounting.duplicate-line',
  key: 'd',
  mod: true,
  shift: true,
});
```

The full preset installs the core editing plugin, which contributes history,
selection, clipboard, ordering, visibility, lock, deletion, save, and Escape
behavior this way. `createActionSurfacesPlugin()` exposes those commands in
context, selection, Layers, and Inspector chrome; omit it to retain keyboard
commands without those visual action surfaces. Symbol actions remain in
`createSymbolsPlugin()`. A custom composition must include
`createCoreEditingPlugin()` explicitly before the action-surfaces plugin.

### Blocks and saved selections

For customer-facing products, **Blocks** is the recommended label for reusable
content. Atomic nodes still belong in **Add**. A host can combine its typed block
catalog with document-local saved selections in one panel:

```ts
createCorePanelsPlugin({
  includeBlocksInAdd: false,
});

createTemplateAuthoringPlugin({
  blocks: productBlocks,
  includeLibrary: false,
});

createSymbolsPlugin({
  combinedBlocksPanel: true,
  panelLabel: 'Blocks',
});
```

`includeBlocksInAdd` defaults to `true` for compatibility. Turn it off when the
composition includes the dedicated Blocks panel so Add remains an atomic
component palette.

Internally the document retains its existing symbol identifiers for schema
compatibility. Saved selections are independent snapshots: inserting one makes
a copy, and later edits do not propagate to existing copies. A future linked
component feature should therefore use a different model and name rather than
implying that these snapshots synchronize.

## Host controller

`host.onReady` receives an `EditorController` with the integration-safe subset
of editor operations:

- read `document` and `selectedNodeId`;
- take an isolated `snapshot()`;
- `replaceDocument()` after loading or importing;
- select a node or open a panel;
- run an extension command;
- insert an expression into selected text;
- obtain the session render/expression runtimes for local HTML/PDF generation;
- publish a non-document status message.

The controller avoids exposing Svelte runes or internal DOM state. A host can
keep it in route state without depending on the editor's internal component
tree.

## Expression runtime

Portable expressions never use `eval`. The built-in evaluator supports:

- paths: `{{customer.contact.name}}`;
- formatter pipelines: `{{invoice.totalValue | currency("EUR")}}`;
- direct helpers: `{{add(invoice.subtotal, invoice.tax)}}`;
- Handlebars-style helpers: `{{add invoice.subtotal invoice.tax}}`;
- formatter arguments containing strings, numbers, booleans, `null`, or paths.

Built-in formatters are `uppercase`, `lowercase`, `capitalize`, `number`,
`currency`, `percent`, `date`, `default`, and `json`. They are used consistently
by the canvas, preview, deterministic renderer, and native PDF header/footer
templates. Typing a pipe inside an open curly expression changes autocomplete
from data paths to registered formatters.

Formatter definitions can declare `usage: 'pipe' | 'call' | 'both'`. Pipe-only
surfaces such as the Data binding transform selector exclude call helpers, while
the Utils panel shows both forms with searchable examples and Copy/Insert
actions. Hosts can add a dedicated autocomplete provider for call helpers.

For host-only helpers, pass `expressionEvaluator`. Return a value when the
host engine understands the expression and `undefined` to fall back to the
portable path/pipeline evaluator:

```ts
createTemplateAuthoringPlugin({
  expressionEvaluator: (expression, context) =>
    hostExpressions.canEvaluate(expression)
      ? hostExpressions.evaluate(expression, context)
      : undefined,
});
```

The evaluator must be deterministic and treat template input as untrusted.

## Template-authoring plugin

`createTemplateAuthoringPlugin()` packages optional, reusable authoring
capabilities on top of the same public extension API:

- Utils panel with searchable pipe/call examples and Copy/Insert actions;
- optional typed block catalog panel;
- Live panel inventorying inline, explicit-binding, and print expressions;
- dynamic text, currency, date, and data-row blocks;
- command-only `data.open-browser` and `data.insert-expression` actions;
- Data workspace and optional PDF toolbar commands;
- optional Save as section action in both the selected-node toolbar and rich
  context menu;
- host blocks, formatter providers, autocomplete providers, and evaluator.

The plugin deliberately does not own authentication, template/block storage,
AI endpoints, publishing, or a PDF HTTP route. Those remain host callbacks so
the package stays reusable and product-neutral. Block expressions and host
blocks are supplied as options; the defaults use generic `data.*` paths.

## HTML chunk boundary

Arbitrary HTML/CSS chunks and typed `ComponentNode` blocks are not interchangeable. Importing markup has to parse and sanitize it, map known tags and styles onto typed nodes and document style rules, and report unsupported tags, attributes, selectors, and CSS instead of dropping them. Save a block only after that conversion succeeds.

## Extension surface

| Host need | API |
|---|---|
| components and renderers | `addComponent` |
| blocks | `addBlock` |
| left/right panels | `addPanel` |
| commands and toolbar actions | `addCommand` with `placement: 'toolbar'` |
| formatter completion | `addFormatter` and `addAutocompleteProvider` |
| expression evaluation | `setExpressionEvaluator` |
| save as section | `addOutlineAction` plus a host callback |
| brand, theme, export policy | `EditorHostConfig` |
| save and ready lifecycle | `EditorHostConfig.onSave` / `onReady` |
| imperative builder context | `EditorController` |

The package and playground do not include product authentication, storage, or branding. A host composes this API and keeps its schema adapter, routes, and credentials in the application. Add a new extension point only when a consumer needs behavior the typed model cannot express.
