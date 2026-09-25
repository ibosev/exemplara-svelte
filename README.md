# exemplara-svelte

Drag-and-drop builder for print-first PDF templates and responsive websites. The editor is Svelte 5. The document model, command engine, renderer, and pagination planner are plain TypeScript.

Documents are a versioned JSON AST (schema `1.5.0`). The same document can be edited on a canvas, rendered to HTML, or printed to PDF through headless Chromium. A document is either `print` or `web`.

## Install

```bash
npm install exemplara-svelte
```

`svelte` `^5` is a peer dependency. `@lucide/svelte` and `pdf-lib` are installed with the package.

PDF and PNG export load `playwright` or `playwright-core` at call time, or you can pass `engine.browser` / `engine.launch`. Neither browser package is installed for you.

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

`Editor` installs that structural shell. Product features such as print authoring, data binding, assets, and website routes are host plugins registered through `composeEditor()`. See [Editor extensions](./docs/editor-extensions.md) and [Composable editor architecture](./docs/composable-editor-architecture.md).

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

With `document.pagination.mode === 'auto'`, body content flows onto continuation sheets. Rich text fragments on measured line boundaries, tables fragment between rows and repeat their header, and vertical containers partition while keeping their styled shells. See [Word-like pagination](./docs/word-like-pagination.md) and [Ruler and paragraph formatting](./docs/ruler-paragraph-formatting.md).

Data-bound text uses `{{path.to.value}}`, including formatter pipelines such as `{{invoice.totalValue | currency("EUR")}}`. See [Data-bound authoring and document outline](./docs/data-bindings-and-outline.md).

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
