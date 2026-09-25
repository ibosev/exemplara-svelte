# Composable editor architecture

> **Status (2026-07-14):** stages 1–7 of the refactoring sequence below are
> complete — see reports [26](../../reports/26-composable-editor-foundation.md),
> [27](../../reports/27-instance-scoped-render-runtime.md),
> [28](../../reports/28-unified-command-contributions.md), reports
> [29](../../reports/29-generic-panel-host.md)–[32](../../reports/32-canvas-decoration-host.md)
> for the four stage-4 hosts,
> [report 33](../../reports/33-data-binding-plugin.md) for the removable
> data-binding plugin and `createManualEditorPreset()`, and
> [report 34](../../reports/34-feature-plugin-extraction.md) for the
> design/print/assets/symbols/audit feature plugins, and
> [report 35](../../reports/35-server-enforcement-packaging.md) for
> server-side policy enforcement and plugin packaging, and
> [report 36](../../reports/36-takeover-quality-audit.md) for the runtime and
> bundle-boundary corrective review. Stage 8 (consumer
> migration) is next.

The Svelte editor is moving from additive extensions to an immutable,
capability-driven composition. This lets a host assemble different editor
products without putting subscriptions, authentication, or tenant logic in the
library.

## Vocabulary

| Concept | Meaning |
|---|---|
| Kernel | AST, commands, history, migrations, serialization, capability analysis |
| Contribution point | A location for panels, commands, menus, inspector sections, renderers, and other additions |
| Plugin | A cohesive vertical feature which registers contributions |
| Capability | A stable semantic permission such as `data.bind.author` or `export.pdf` |
| Entitlement | Host-side mapping from a client or plan to allowed capabilities |
| Host service | Persistence, assets, imports, PDF endpoints, and other I/O |
| Preset | A tested plugin collection and policy |

The editor receives an already-resolved policy. It does not know why a
capability is enabled and does not contain plan names.

## Composition contract

```ts
import { createCapabilityPolicy } from 'exemplara-svelte/core';
import {
  composeEditor,
  defineEditorPlugin,
} from 'exemplara-svelte/editor/composition';

const dataBinding = defineEditorPlugin({
  id: 'example.data-binding',
  version: '1.0.0',
  provides: ['data.sources.manage', 'data.bind.author', 'data.resolve'],
  setup(api) {
    const source = api.getService<DataSourceService>('data-source');
    api.addCommand({ /* ... */ });
  },
});

const composition = composeEditor({
  policy: createCapabilityPolicy([
    'document.edit',
    'data.sources.manage',
    'data.bind.author',
    'data.resolve',
  ]),
  plugins: [dataBinding],
  services: { 'data-source': dataSourceService },
});
```

Composition validates plugin identities, dependencies, dependency cycles, and
disabled capabilities before any setup function runs. Setup can return a
disposer. A composition is immutable for an editor instance; a host remounts
the editor when a client's resolved entitlements change.

The original function-style `extensions` prop remains supported through
`createFullEditorPreset()`. It is a migration bridge, not the final plugin
contract.

## Document capability policy

`analyzeDocumentCapabilities(document)` reports semantic runtime requirements
with document paths and node ids. The first implemented requirements cover:

- native print header/footer rendering;
- automatic pagination;
- inline and explicit data expressions;
- conditional/repeated data behavior;
- symbol-linked nodes;
- data expressions in global or section print templates.

Native print tokens such as `{{page.number}}`, `{{page.total}}`,
`{{page.label}}`, `{{document.title}}`, and `{{date}}` do not require the
optional `data.resolve` capability.

Hosts and server-side render/PDF entry points will use the same analyzer.
Hiding UI is not an authorization boundary.

## Data capability split

Data functionality intentionally uses three capabilities:

| Capability | Behavior |
|---|---|
| `data.sources.manage` | Data panel, JSON editing, data import |
| `data.bind.author` | Inspector binding controls, autocomplete, dynamic blocks |
| `data.resolve` | Canvas, preview, HTML, and PDF expression evaluation |

This permits manual-only, read-only-rendering, and full-authoring products.
Documents which use disabled runtime features must produce diagnostics. They
must not be silently stripped or evaluated.

## Refactoring sequence

1. **Foundation — complete:** capability model, analyzer, plugin identity,
   dependency validation, lifecycle, services, full preset compatibility.
2. **Instance-scoped runtime — complete:** editor sessions own renderer,
   transform, and component-icon registries. Deprecated global calls remain
   available only through the compatibility runtime.
3. **Commands and menus — complete:** one command implementation is presented
   through toolbar, context, layer, selection, Inspector, and keyboard
   contributions. Duplicate contribution ids fail during setup.
4. **Generic Svelte hosts — complete:** panels, inspector sections, toolbar
   clusters, and canvas decorations all render from registries. Sidebars come
   from panel contributions (`createCorePanelsPlugin()`; empty sides render
   no sidebar); Inspector sections have per-selection visibility
   (`createCoreInspectorPlugin()`) and selection opens the first panel
   flagged `activateOnSelection`; the toolbar renders clusters with
   declarative divider/spacer separators (`createCoreToolbarPlugin()`); the
   ruler and floating action controls are `above`/`overlay` canvas
   decorations (`createCoreCanvasPlugin()` owns the ruler;
   `createActionSurfacesPlugin()` owns the selection and context overlays).
   Duplicate ids for every contribution kind fail during setup.
5. **Data-binding proof plugin — complete:** `createDataBindingPlugin()` owns
   the Data panel, data-bindings Inspector section, path-autocomplete provider,
   and Open data bindings command. `createManualEditorPreset()` disables the
   `data.*` capabilities. Canvas, preview, HTML, and PDF paths use an explicit
   `resolveData` gate so document sample sources cannot bypass the policy;
   authored fallback values remain visible and dynamic requirements appear in
   `capabilityDiagnostics`. Data behavior requires both a providing plugin and
   policy permission, so plugin omission is effective even under an allow-all
   policy.
6. **Feature extraction — complete for current editor surfaces:** design,
   print (including the `page-flow` pagination section), assets, symbols (including the
   create/detach commands), audit, JSON/HTML export, and visual node-action
   surfaces are plugins. `createActionSurfacesPlugin()` removes context,
   selection, Layers, and Inspector action chrome while retaining core
   commands and keyboard access. `createExportPlugin()` owns JSON and
   deterministic HTML/CSS downloads.
7. **Server enforcement and packaging — complete:** `RenderOptions.policy`
   makes `render()` (and therefore every PDF/image entry point) throw
   `UnsupportedDocumentCapabilitiesError` with per-path diagnostics before
   producing output; plugins are importable via the `./plugins/*` subpath
   exports. `Editor` deliberately owns the batteries-included default;
   `ComposableEditor` is published at `editor/composable`, with the mechanism
   at `editor/composition`, and neither imports `presets.ts` or feature panels.
   Source-graph tests enforce that lean boundary. Portable AST rendering stays
   compatible regardless of which editor UI plugins are shipped.
8. **Consumer migration:** full/standard/manual presets, adapter guidance,
   golden tests, screenshots, and staged rollout.

At every stage `createFullEditorPreset()` must preserve the current playground,
editor/preview/PDF parity, and the existing public extension path.

## Acceptance tests

- Native print tokens are not misclassified as data binding.
- Dynamic document features produce path-specific diagnostics.
- Policies can reject unsupported documents.
- Duplicate plugins, missing dependencies, dependency cycles, and disabled
  capabilities fail before setup.
- Dependency setup order is deterministic.
- Plugin disposers run when the editor registry is destroyed.
- Legacy extensions still run under the full preset.
- Two runtimes can register the same component/transform ids independently.
- Canvas, preview, HTML export, and PDF render options share one session runtime.
- Menus and keybindings resolve the same command implementation and `canRun`
  predicate.
- Context, inline-selection, layer, and Inspector surfaces are populated from
  declarative menu contributions.
- Duplicate command, menu-item, keybinding, and panel ids fail instead of
  silently changing behavior based on plugin order.
- Sidebars and tab rails render purely from panel contributions; the full
  preset restores the standard nine panels and an empty composition renders no
  sidebars.
- Inspector sections render from contributions with per-selection visibility;
  the paragraph section appears only for text nodes, and node selection
  activates the first `activateOnSelection` panel rather than a hard-coded id.
- The toolbar renders from cluster contributions in declared order with
  leading divider/spacer separators; the full preset reproduces the previous
  toolbar exactly, and an empty composition renders no toolbar.
- The ruler and floating action chrome are canvas decorations with
  `above`/`overlay` placements. Core canvas owns only the ruler;
  `createActionSurfacesPlugin()` owns the selection toolbar and context menu,
  so omitting it removes their component code as well as their contributions.
  An empty composition renders a bare sheet surface.
- The data-authoring feature is behaviorally removable: the manual preset has
  no Data panel, bindings section, command, autocomplete, or sample-data
  resolution in canvas, preview, HTML, PDF body, or PDF chrome;
  composing the data plugin under a data-disabled policy fails at compose
  time; and dynamic documents produce path-specific policy diagnostics.
- Omitting the data provider plugin under an allow-all policy still disables
  resolution, authoring, and autocomplete and produces dynamic-document
  diagnostics; policy permission alone never supplies a feature.
- Every feature is à la carte: a bare core-shell composition has only
  palette/layers/inspector with paragraph and box-model sections, and each
  feature plugin restores exactly its own panels, sections, and commands;
  composing a feature under a policy that disables its capability fails at
  compose time.
- Server rendering enforces policies: a dynamic document under a restricted
  `renderOptions.policy` is rejected with diagnostics before any output or
  browser launch. `ComposableEditor` and each plugin subpath have isolated
  import graphs, so lean compositions omit unused feature panels and plugins.
- Export controls and visual node-action surfaces are independently removable;
  Inspector buttons execute the same commands as every other surface.

The next slice (stage 8) is consumer migration: preset guidance, adapters,
golden tests, and staged rollout.
