# exemplara-svelte

The document engine, renderer, and editor state now live in the separate MIT package `exemplara-core`. This package supplies the Svelte view. Existing `exemplara-svelte/core`, `/renderer`, and `/shared` imports re-export the canonical implementations.

For a host-owned session that survives view unmounts:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { EditorSession } from 'exemplara-core/editor';
  import ComposableEditor from 'exemplara-svelte/editor/composable';
  import { createFullEditorPreset, toCoreComposition } from 'exemplara-svelte/editor';

  const composition = createFullEditorPreset();
  const session = new EditorSession({ composition: toCoreComposition(composition) });
  onDestroy(() => session.destroy());
</script>

<ComposableEditor {composition} {session} />
```

Without `session`, the view creates and disposes its own session. Supply the same composition's Svelte views when attaching an existing session. `EditorContext` retains its existing properties and methods as a thin `fromStore()` facade; new portable plugins target `EditorSession` from `exemplara-core/editor`. Svelte plugins expose their portable plugin as `.core` and register components/icons in their Svelte `setup`. Legacy extensions remain supported; callbacks that use Svelte/DOM APIs must be migrated before using them in another wrapper. All mutable editor and feature state, including component drafts, filters, confirmations, sidebar geometry, disclosures, uploads, and version-history progress, belongs to `EditorSession` and its `ui` models in the core package. Svelte keeps DOM references, component registrations, caret insertion, browser resource handles, and derived rendering projections. `bindUiState()` bridges the typed core models through `fromStore()`; it defines no state.

`pnpm check:state` audits state ownership across the wrapper, private plugins, and playground. `pnpm test:packages` certifies isolated tarball consumers, strict headless declarations, Svelte compilation/runtime, and Chromium PDF output. On a host without browser networking, `EXEMPLARA_STATIC_ONLY=1 pnpm test:packages` runs packaging, headless execution/types, and Svelte compilation only; it explicitly reports the skipped runtime/PDF checks.

Sibling development requires `../exemplara-core` and, for consumer certification, `../exemplara-plugins` and `../exemplara-playground`. The local pnpm override links core; published dependencies use `^0.1.0`. Run `pnpm check`, `pnpm test:run`, `pnpm test:packages`, and `pnpm test:browser` (Chrome defaults to `/usr/bin/google-chrome`, override `EXEMPLARA_CHROMIUM_PATH`). Shablonix consumes pinned public tarballs under `vendor/exemplara` until npm publication. Its private plugin submodule must be updated along with the public package inputs.

Drag-and-drop builder for print-first PDF templates and responsive websites. The editor is Svelte 5. The document model, command engine, renderer, and pagination planner are plain TypeScript.

Documents are a versioned JSON AST (schema `1.5.0`). The same document can be edited on a canvas, rendered to HTML, or printed to PDF through headless Chromium. A document is either `print` or `web`.

## Install

```bash
npm install exemplara-svelte
```

`svelte` `^5.29.0` is a peer dependency supplied by the host app; editor attachments require Svelte 5.29 or newer. `@lucide/svelte` and `exemplara-core` are runtime dependencies installed with the package. Build, type-check, test, and browser-certification tools stay in `devDependencies` and are not installed for consumers.

Local development uses Node 22.12+ on the 22.x line, Node 24.x, or Node 26+. TypeScript stays on the latest 6.x release supported by `svelte-check` and `@sveltejs/package`; TypeScript 7's compiler API is not compatible with these tools yet.

The private `exemplara-plugins/pdf` export supplies PDF and PNG generation. It loads `playwright` or `playwright-core` at call time, or you can pass `engine.browser` / `engine.launch`. Neither browser package is installed for you.

## Entry points

| Import | Role |
|---|---|
| `exemplara-svelte` | Editor component, document factories, renderer, and shared helpers |
| `exemplara-svelte/core` | Document model, commands, registry, serialization |
| `exemplara-svelte/renderer` | AST to HTML/CSS, including website preview and Handlebars publication |
| `exemplara-svelte/shared` | Binding, pagination measurement, import, and editor geometry helpers |
| `exemplara-svelte/editor` | Editor shell components and the structural preset |
| `exemplara-svelte/editor/composable` | Editor shell with no plugins installed |
| `exemplara-svelte/editor/composition` | `composeEditor()` |
| `exemplara-svelte/plugins/*` | Structural plugins (`core-panels`, `core-canvas`, `core-editing`, …) |

The npm tarball publishes `dist/` only. `dist/` is also committed so a GitHub install can resolve the package exports without running a build.

## Editor

```svelte
<script lang="ts">
  import { Editor, createDocument } from 'exemplara-svelte';

  const doc = createDocument({ name: 'My Invoice' });
</script>

<Editor document={doc} onchange={(doc) => console.log('changed', doc)} />
```

`Editor` is the full preset. For a smaller bundle, compose plugins yourself. `ComposableEditor` does not import the full preset:

```svelte
<script lang="ts">
  import ComposableEditor from 'exemplara-svelte/editor/composable';
  import { composeEditor } from 'exemplara-svelte/editor/composition';
  import { createCorePanelsPlugin } from 'exemplara-svelte/plugins/core-panels';
  import { createCoreInspectorPlugin } from 'exemplara-svelte/plugins/core-inspector';
  import { createCoreEditingPlugin } from 'exemplara-svelte/plugins/core-editing';

  const composition = composeEditor({
    plugins: [
      createCorePanelsPlugin(),
      createCoreInspectorPlugin(),
      createCoreEditingPlugin(),
    ],
  });
</script>

<ComposableEditor document={doc} {composition} />
```

`Editor` installs that structural shell. Product features such as print authoring, data binding, assets, and website routes are host plugins registered through `composeEditor()`.

## Documents and HTML

```ts
import { DocumentEngine, defaultRegistry } from 'exemplara-svelte/core';
import { render } from 'exemplara-svelte/renderer';

const engine = new DocumentEngine();
const page = engine.doc.pages[0]!;

engine.execute({
  type: 'component:add',
  payload: {
    parentId: page.regions.body.id,
    node: defaultRegistry.createNode('text', { content: 'Hello, Exemplara!', fontSize: 24 }),
  },
});

const { fullHtml } = render(engine.doc, {
  dataContext: {
    customer: { name: 'Acme Corp' },
    items: [{ description: 'Widget', qty: 3, price: '$10.00' }],
  },
});
```

`fullHtml` is a standalone page with `@page` size and margins in millimetres.

Built-in print components include `text`, `image`, `container`, `columns`, `spacer`, `divider`, `table`, `page-break`, `watermark`, `repeater`, and `conditional`.

With `document.pagination.mode === 'auto'`, body content flows onto continuation sheets. Rich text fragments on measured line boundaries, tables fragment between rows and repeat their header, and vertical containers partition while keeping their styled shells.

Data-bound text uses `{{path.to.value}}`, including formatter pipelines such as `{{invoice.totalValue | currency("EUR")}}`.

## Websites

Web documents share the AST, history, data binding, and inspector with print templates. They use routes, responsive viewports, and SEO metadata instead of paper geometry.

```ts
import { createWebDocument, createNode } from 'exemplara-svelte/core';
import { renderWeb, renderWebTemplate } from 'exemplara-svelte/renderer';
import { createWebEditorPreset } from 'exemplara-svelte/editor';

const website = createWebDocument({
  name: 'Acme Website',
  slug: '',
  description: 'Acme products and services',
});

website.pages[0]!.regions.body.children.push(
  createNode('web-section', { element: 'section' }, [
    createNode('text', { content: '<h1>Hello {{company.name}}</h1>' }),
    createNode('web-link', { label: 'Get started', href: '/sign-up' }),
  ]),
);

const preview = renderWeb(website, { dataContext: { company: { name: 'Acme' } } });
const publication = renderWebTemplate(website);
const composition = createWebEditorPreset();
```

`renderWeb()` resolves sample data for preview. `renderWebTemplate()` keeps expressions and emits static Handlebars and CSS. Publishing, routing, and the website authoring panels stay in the host.

## Develop

```bash
pnpm install
pnpm test:run
pnpm check
pnpm package    # refresh the committed dist/
```

Run `pnpm package` and commit `dist/` when the library source changes. `npm publish` ships that committed build.

## License

MIT © Ivaylo Bosev
