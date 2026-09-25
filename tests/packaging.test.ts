import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DocumentEngine,
  UnsupportedDocumentCapabilitiesError,
  createCapabilityPolicy,
  defaultRegistry,
} from '../src/lib/core/index.js';
import { render } from '../src/lib/renderer/index.js';

function dynamicDocument() {
  const engine = new DocumentEngine();
  const page = engine.doc.pages[0]!;
  engine.execute({
    type: 'component:add',
    payload: {
      parentId: page.regions.body.id,
      node: defaultRegistry.createNode('text', { content: 'Hi {{customer.name}}' }),
    },
  });
  return engine.doc;
}

// Allows everything the default blank document needs except data resolution.
const staticPolicy = createCapabilityPolicy([
  'document.edit',
  'export.pdf',
  'print.layout',
  'print.header-footer',
  'print.pagination',
]);

describe('server-side capability enforcement (stage 7)', () => {
  it('render() rejects documents whose requirements the policy disables', () => {
    const doc = dynamicDocument();
    expect(() => render(doc, { policy: staticPolicy }))
      .toThrow(UnsupportedDocumentCapabilitiesError);
    expect(() => render(doc)).not.toThrow();
    expect(() => render(new DocumentEngine().doc, { policy: staticPolicy })).not.toThrow();
  });

});

describe('plugin packaging (stage 7)', () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
  ) as { exports: Record<string, Record<string, string>> };

  it('publishes every plugin as a subpath export', () => {
    const subpath = packageJson.exports['./plugins/*'];
    expect(subpath?.import).toBe('./dist/editor/plugins/*.js');
    expect(subpath?.types).toBe('./dist/editor/plugins/*.d.ts');
    expect(packageJson.exports['./editor/composable']?.svelte)
      .toBe('./dist/editor/ComposableEditor.svelte');
    expect(packageJson.exports['./editor/composition']?.import)
      .toBe('./dist/editor/composition.js');
  });

  const PLUGIN_DIR = resolve(import.meta.dirname, '../src/lib/editor/plugins');

  /** All source files transitively imported by `entry` via relative specifiers. */
  function importGraph(entry: string, seen = new Set<string>()): Set<string> {
    if (seen.has(entry)) return seen;
    seen.add(entry);
    let source: string;
    try {
      source = readFileSync(entry, 'utf8');
    } catch {
      return seen; // e.g. resolved .js for a .ts source; retried by caller mapping
    }
    // Type-only imports are erased at build time and never reach a bundle.
    for (const match of source.matchAll(/import\s+(type\s+)?[\s\S]*?from\s+'(\.\.?\/[^']+)'/g)) {
      if (match[1]) continue;
      const specifier = match[2]!;
      const base = resolve(dirname(entry), specifier);
      const candidates = specifier.endsWith('.svelte')
        ? [base]
        : [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.svelte.ts'), base];
      for (const candidate of candidates) {
        try {
          readFileSync(candidate, 'utf8');
          importGraph(candidate, seen);
          break;
        } catch { /* try next candidate */ }
      }
    }
    return seen;
  }

  const FEATURE_MODULES: Record<string, string> = {
    design: 'panels/DesignPanel.svelte',
    print: 'panels/PrintPanel.svelte',
    assets: 'panels/AssetsPanel.svelte',
    symbols: 'panels/SymbolsPanel.svelte',
    audit: 'panels/AuditPanel.svelte',
    'data-binding': 'panels/DataPanel.svelte',
    export: 'toolbar/ExportCluster.svelte',
  };

  it('keeps feature panels out of the core shell plugins', () => {
    for (const core of ['action-surfaces', 'core-panels', 'core-inspector', 'core-editing', 'core-toolbar', 'core-canvas']) {
      const graph = [...importGraph(resolve(PLUGIN_DIR, `${core}.ts`))];
      for (const featureModule of Object.values(FEATURE_MODULES)) {
        expect(
          graph.some((file) => file.endsWith(featureModule)),
          `${core} must not pull in ${featureModule}`,
        ).toBe(false);
      }
    }
  });

  it('keeps optional action overlays out of the core canvas plugin', () => {
    const actionGraph = [...importGraph(resolve(PLUGIN_DIR, 'action-surfaces.ts'))];
    expect(actionGraph.some((file) => file.endsWith('/editor/SelectionToolbar.svelte')))
      .toBe(true);
    expect(actionGraph.some((file) => file.endsWith('/editor/ContextMenu.svelte')))
      .toBe(true);

    const coreCanvasGraph = [...importGraph(resolve(PLUGIN_DIR, 'core-canvas.ts'))];
    expect(coreCanvasGraph.some((file) => file.endsWith('/editor/SelectionToolbar.svelte')))
      .toBe(false);
    expect(coreCanvasGraph.some((file) => file.endsWith('/editor/ContextMenu.svelte')))
      .toBe(false);
  });

  it('keeps the composable editor entry point free of presets and feature panels', () => {
    const graph = [...importGraph(resolve(
      import.meta.dirname,
      '../src/lib/editor/ComposableEditor.svelte',
    ))];
    expect(graph.some((file) => file.endsWith('/editor/presets.ts'))).toBe(false);
    for (const featureModule of Object.values(FEATURE_MODULES)) {
      expect(
        graph.some((file) => file.endsWith(featureModule)),
        `ComposableEditor must not pull in ${featureModule}`,
      ).toBe(false);
    }
  });
});
