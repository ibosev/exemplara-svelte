# Changelog

## 0.3.3 — 2026-10-10

Architecture review follow-up, paired with `exemplara-core@0.1.1`. The aim was to support the Solid wrapper while preserving Svelte and Shablonix editing behavior. Recorded on 2026-10-11 from the implementation, regression tests, and release verification logs.

### Changes

- Delegated plugin installation and view-registration cleanup to Core's scoped attachment API. Removed the wrapper's duplicate installed-view tracking, which could retain callbacks from the first mount.
- Portable `.core` setup and fallback `api.installCore()` calls run once per session. Legacy view setup runs for each attachment, with callbacks bound to that attachment's `EditorContext`. Failed replacement leaves the previous view usable; component-icon overrides are restored on cleanup.
- Composition distinguishes view metadata from portable installation, including plugins whose view and portable IDs differ and fallback plugins that share a view ID.
- Narrowed reactive reads for component definitions, document data, theme, and panel state so unrelated hover/zoom changes do not invalidate them. Command predicates keep tracking session state so enabled/disabled actions remain current.
- Escaped unknown component type names before displaying them in canvas HTML, so an unrecognized type is shown as text instead of interpreted as markup.
- Added browser regressions for escaping and reactive getters. Package certification now runs the Svelte checker from the isolated consumer, preventing source-checkout types from masking package problems.

Implementation: [composition adapter](src/lib/editor/composition.ts), [view extensions](src/lib/editor/extensions.ts), [Svelte context](src/lib/editor/context.svelte.ts), and [node rendering](src/lib/editor/NodeView.svelte).

### Compatibility and migration

- Requires `exemplara-core@^0.1.1`; update direct Core dependencies alongside this wrapper. The sibling Core link in `pnpm-workspace.yaml` is for local development; published consumers resolve the npm dependency.
- Existing `<Editor>` and `<ComposableEditor>` hosts with view-owned sessions need no migration. Existing `/core`, `/renderer`, and `/shared` compatibility imports still re-export Core.
- A host-owned session survives view unmounts, including its document, history, and session-owned drafts/preferences. Legacy view registrations are removed on detach and recreated on remount. Move commands needed while detached into `.core`.
- Legacy Svelte extensions remain supported. Extensions that capture Svelte or DOM APIs need adaptation before reuse in another framework. Setup must clean up external resources it acquires before throwing.

### Verification completed

Release validation on 2026-10-10 passed **231 Svelte tests** and typechecking with **0 errors and 0 warnings**. Three added [session-adapter tests](tests/session-adapter.test.ts) cover fresh callbacks after remount, failed attachment/retry, and portable fallback installation.

[Browser certification](scripts/certify-browser.mjs) passed escaping/reactivity regressions, insertion, content editing, Inspector, selection, zoom, undo/redo, view reattachment, private panels, sidebar widths, disclosures, JSON/rich-text drafts, and application feature replacement. [Package certification](scripts/certify-packages.mjs) passed isolated consumer compilation, independent editor state/keyboard handling, reattachment, and headless PDF generation.

Related checks passed: Core **27 tests**, private plugins **52 tests**, and Solid **9 browser regression cases**. Published Core/Svelte `dist/` contents matched the tested builds byte for byte.

### Consumer rollout and Shablonix follow-up

Shablonix's editor/backend and private-plugin dependency requirements were updated to Core 0.1.1 and Svelte 0.3.3 where applicable. The standalone private-plugin and playground requirements were updated too. Shablonix required dependency/lockfile updates, with no application API migration for this package upgrade. Editor/backend deployment, demo mounting/data switching, and invoice-PDF smoke checks passed.

The later currency report exposed two pre-existing Shablonix bugs:

- CRM data supplied `invoice.total` as a formatted string such as `€22,032.00`. Shablonix's custom currency helper converted it with `Number(...)`, producing `NaN`. The helper now preserves nonnumeric input while continuing to format numbers and numeric strings. The original failure reproduced with both Core 0.1.0 and 0.1.1.
- The formatting panel inserted on both `mousedown` and `click`. It now inserts only on click while preserving the caret on mousedown.

Both fixes were deployed from Shablonix; no further Core/Svelte release was needed. The expression-engine suite passed **3 tests**, and a new browser regression confirmed **one expression per Insert click**. Tenant-isolation checks passed **5 tests**, and the live demo/PDF smoke check passed. Existing duplicate expressions in saved templates still require removing the extra copy.

These are historical validation results, not checks rerun when this record was written. The initial smoke checks missed the formatter Insert interaction; it now has regression coverage. Shablonix typechecking retained **35 existing warnings** with no errors, the broader state-ownership audit still had existing findings, and authenticated production account workflows were not retested.
