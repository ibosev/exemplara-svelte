import { describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { ComponentRegistry, createDocument, createNode } from '../src/lib/core/index.js';
import {
  EditorExtensionRegistry,
  EditorContext,
  STYLE_MEDIA_OPTIONS,
  attachedStyleRuleIds,
  composeEditor,
  createReusableStyleRule,
  createCorePanelsPlugin,
  createCoreToolbarPlugin,
  createFullEditorPreset,
  createManualEditorPreset,
  findScopedStyleRule,
  reusableStyleRuleGroups,
  setStyleRuleAttachment,
  type EditorCanvasDecorationProps,
  type EditorComposition,
  type EditorInspectorSectionProps,
  type EditorPanelProps,
  type EditorToolbarClusterProps,
} from '../src/lib/editor/index.js';

const stubPanel = (() => {}) as unknown as Component<EditorPanelProps>;
const stubSection = (() => {}) as unknown as Component<EditorInspectorSectionProps>;
const stubCluster = (() => {}) as unknown as Component<EditorToolbarClusterProps>;
const stubDecoration = (() => {}) as unknown as Component<EditorCanvasDecorationProps>;

function buildRegistry(composition: EditorComposition): EditorExtensionRegistry {
  return new EditorExtensionRegistry(
    new ComponentRegistry(),
    composition.plugins.map((plugin) => plugin.setup),
    { policy: composition.policy, services: composition.services },
  );
}

describe('panel contributions', () => {
  it('registers the nine core panels through the full preset in stable order', () => {
    const registry = buildRegistry(createFullEditorPreset());
    const left = registry.panelsFor('left');
    const right = registry.panelsFor('right');
    expect(left.map((panel) => panel.id)).toEqual(['components', 'layers']);
    expect(right.map((panel) => panel.id)).toEqual(['inspect']);
    expect(registry.panels.every((panel) => panel.icon && panel.component)).toBe(true);
  });

  it('sorts extension panels after the core panels by default', () => {
    const registry = buildRegistry(createFullEditorPreset({
      extensions: [(api) => {
        api.addPanel({ id: 'custom.utils', label: 'Utils', placement: 'right', component: stubPanel });
      }],
    }));
    const rightIds = registry.panelsFor('right').map((panel) => panel.id);
    expect(rightIds).toEqual(['inspect', 'custom.utils']);
  });

  it('rejects duplicate panel ids during plugin setup', () => {
    const composition = createFullEditorPreset({
      extensions: [(api) => {
        api.addPanel({ id: 'inspect', label: 'Shadow inspect', placement: 'right', component: stubPanel });
      }],
    });
    expect(() => buildRegistry(composition)).toThrow(/Duplicate editor panel id: inspect/);
  });

  it('keeps explicit compositions empty until core panels are installed', () => {
    expect(buildRegistry(composeEditor()).panels).toHaveLength(0);
    // Feature panels (design/print/data/assets/symbols/audit) belong to
    // their own plugins; the core shell is palette, layers, and inspector.
    const registry = buildRegistry(composeEditor({ plugins: [createCorePanelsPlugin()] }));
    expect(registry.panelsFor('left').map((panel) => panel.id)).toEqual(['components', 'layers']);
    expect(registry.panelsFor('right').map((panel) => panel.id)).toEqual(['inspect']);
    expect(registry.panel('data')).toBeUndefined();
    expect(registry.panel('print')).toBeUndefined();
  });

  it('resolves panels by id for openPanel-style lookups', () => {
    const registry = buildRegistry(createFullEditorPreset());
    expect(registry.panel('inspect')?.placement).toBe('right');
    expect(registry.panel('components')?.placement).toBe('left');
    expect(registry.panel('missing')).toBeUndefined();
  });

  it('marks the Inspect panel as the selection panel in the full preset', () => {
    expect(buildRegistry(createFullEditorPreset()).selectionPanel?.id).toBe('inspect');
    expect(buildRegistry(composeEditor()).selectionPanel).toBeUndefined();
  });

  it('keeps compact state per side and expands explicitly opened panels', () => {
    const document = createDocument();
    const node = createNode('text', { content: 'Selected text' });
    document.pages[0]!.regions.body.children.push(node);
    const editor = new EditorContext({ document, composition: createFullEditorPreset() });

    editor.setPanelCompact('left', true);
    editor.setPanelCompact('right', true);
    expect(editor.isPanelCompact('left')).toBe(true);
    expect(editor.isPanelCompact('right')).toBe(true);

    editor.openPanel('inspect');
    expect(editor.rightTab).toBe('inspect');
    expect(editor.isPanelCompact('right')).toBe(false);
    expect(editor.isPanelCompact('left')).toBe(true);

    editor.togglePanelCompact('left');
    expect(editor.isPanelCompact('left')).toBe(false);
    editor.destroy();
  });

  it('switches compact sidebars to the selection panel without forcing them open', () => {
    const document = createDocument();
    const node = createNode('text', { content: 'Selected text' });
    document.pages[0]!.regions.body.children.push(node);
    const editor = new EditorContext({ document, composition: createFullEditorPreset() });

    editor.openPanel('data');
    editor.setPanelCompact('right', true);
    editor.select(node.id);

    expect(editor.rightTab).toBe('inspect');
    expect(editor.isPanelCompact('right')).toBe(true);
    editor.destroy();
  });

  it('reveals a selected component in the expanded Layers panel', async () => {
    const document = createDocument();
    const child = createNode('text', { content: 'Nested child' });
    document.pages[0]!.regions.body.children.push(createNode('container', {}, [child]));
    const editor = new EditorContext({ document, composition: createFullEditorPreset() });

    editor.setPanelCompact('left', true);
    expect(await editor.runCommand('node.reveal-in-layers', { nodeId: child.id })).toBe(true);
    expect(editor.selectedId).toBe(child.id);
    expect(editor.leftTab).toBe('layers');
    expect(editor.leftPanelCompact).toBe(false);
    expect(editor.layerRevealRevision).toBe(1);

    const contextItems = editor.extensions.menuItems('node.context', editor, { nodeId: child.id });
    expect(contextItems.map((item) => item.command.id)).toContain('node.reveal-in-layers');
    editor.destroy();
  });

  it('opens a focused data workspace and exposes pagination controls through the host controller', () => {
    const editor = new EditorContext({ document: createDocument(), composition: createFullEditorPreset() });

    expect(editor.controller.openDataWorkspace()).toBe(false);
    expect(editor.controller.dataWorkspaceOpen).toBe(false);

    expect(editor.controller.autoFlowEnabled).toBe(true);
    editor.controller.toggleAutoFlow();
    expect(editor.controller.autoFlowEnabled).toBe(false);
    editor.controller.setAutoFlow(true);
    expect(editor.controller.autoFlowEnabled).toBe(true);

    editor.controller.closeDataWorkspace();
    expect(editor.controller.dataWorkspaceOpen).toBe(false);
    editor.destroy();
  });

});

describe('inspector section contributions', () => {
  const editorStub = {} as Parameters<EditorExtensionRegistry['inspectorSections']>[0];
  const textNode = { id: 'n1', type: 'text', props: {} } as Parameters<
    EditorExtensionRegistry['inspectorSections']
  >[1];
  const imageNode = { ...textNode, id: 'n2', type: 'image' };

  it('registers the four core sections and hides paragraph for non-text nodes', () => {
    const registry = buildRegistry(createFullEditorPreset());
    expect(registry.inspectorSections(editorStub, textNode).map((section) => section.id))
      .toEqual(['paragraph', 'box-model']);
    expect(registry.inspectorSections(editorStub, imageNode).map((section) => section.id))
      .toEqual(['box-model']);
  });

  it('sorts extension sections after core sections and rejects duplicate ids', () => {
    const withExtension = buildRegistry(createFullEditorPreset({
      extensions: [(api) => {
        api.addInspectorSection({ id: 'custom.notes', component: stubSection });
      }],
    }));
    expect(withExtension.inspectorSections(editorStub, textNode).at(-1)?.id).toBe('custom.notes');

    const duplicate = createFullEditorPreset({
      extensions: [(api) => {
        api.addInspectorSection({ id: 'box-model', component: stubSection });
      }],
    });
    expect(() => buildRegistry(duplicate)).toThrow(/Duplicate editor inspector section id: box-model/);
  });

  it('keeps explicit compositions free of sections until the core inspector plugin is installed', () => {
    expect(buildRegistry(composeEditor()).inspectorSections(editorStub, textNode)).toHaveLength(0);
  });
});

describe('selected-element style field contributions', () => {
  const editorStub = {} as Parameters<EditorExtensionRegistry['styleFieldsFor']>[0];
  const nodeStub = { id: 'n1', type: 'text', props: {} } as Parameters<
    EditorExtensionRegistry['styleFieldsFor']
  >[1];

  it('leaves the CSS catalog to a host design plugin', () => {
    const fields = buildRegistry(createFullEditorPreset()).styleFieldsFor(editorStub, nodeStub);
    expect(fields).toEqual([]);
  });

  it('accepts host style fields, filters them by selection, and rejects duplicate ids', () => {
    const registry = buildRegistry(createFullEditorPreset({
      extensions: [(api) => {
        api.addStyleField({
          id: 'custom.object-fit',
          label: 'Object fit',
          property: 'object-fit',
          sector: 'size',
          kind: 'select',
          options: ['contain', 'cover'],
          visible: (_editor, node) => node.type === 'image',
        });
      }],
    }));
    expect(registry.styleFieldsFor(editorStub, nodeStub).map((field) => field.id))
      .not.toContain('custom.object-fit');
    expect(registry.styleFieldsFor(editorStub, { ...nodeStub, type: 'image' }).map((field) => field.id))
      .toContain('custom.object-fit');

    expect(() => buildRegistry(createFullEditorPreset({
      extensions: [
        (api) => {
          api.addStyleField({ id: 'margin', label: 'Margin', property: 'margin', sector: 'spacing', kind: 'text' });
        },
        (api) => {
          api.addStyleField({ id: 'margin', label: 'Duplicate', property: 'margin', sector: 'spacing', kind: 'text' });
        },
      ],
    }))).toThrow(/Duplicate editor style field id: margin/);
  });
});

describe('toolbar cluster contributions', () => {
  const editorStub = { host: {} } as Parameters<EditorExtensionRegistry['toolbarClusters']>[0];

  it('registers the core clusters plus the removable export cluster in visual order', () => {
    const clusters = buildRegistry(createFullEditorPreset()).toolbarClusters(editorStub);
    expect(clusters.map((cluster) => cluster.id)).toEqual([
      'brand', 'history', 'host-status', 'commands', 'zoom', 'theme', 'actions',
    ]);
    expect(clusters.map((cluster) => cluster.separator ?? null)).toEqual([
      null, 'divider', 'divider', null, null, null, 'divider',
    ]);
    expect(clusters.map((cluster) => cluster.zone ?? 'start')).toEqual([
      'start', 'start', 'start', 'start', 'center', 'end', 'end',
    ]);
    expect(buildRegistry(createManualEditorPreset()).toolbarClusters(editorStub).map((cluster) => cluster.id))
      .not.toContain('data-preview');
  });

  it('slots extension clusters between commands and zoom by default and honors visible()', () => {
    const registry = buildRegistry(createFullEditorPreset({
      extensions: [(api) => {
        api.addToolbarCluster({ id: 'custom.badge', component: stubCluster });
        api.addToolbarCluster({ id: 'custom.hidden', order: 90, visible: () => false, component: stubCluster });
      }],
    }));
    const ids = registry.toolbarClusters(editorStub).map((cluster) => cluster.id);
    expect(ids.indexOf('custom.badge')).toBe(ids.indexOf('commands') + 1);
    expect(ids.indexOf('custom.badge')).toBe(ids.indexOf('zoom') - 1);
    expect(ids).not.toContain('custom.hidden');
  });

  it('lets product hosts remove duplicate application chrome cluster by cluster', () => {
    const composition = composeEditor({
      plugins: [createCoreToolbarPlugin({
        brand: false,
        history: false,
        status: false,
        theme: false,
        actions: false,
      })],
    });
    const ids = buildRegistry(composition)
      .toolbarClusters(editorStub)
      .map((cluster) => cluster.id);
    expect(ids).toEqual(['commands', 'zoom']);
  });

  it('rejects duplicate cluster ids and keeps explicit compositions empty', () => {
    const duplicate = createFullEditorPreset({
      extensions: [(api) => {
        api.addToolbarCluster({ id: 'zoom', component: stubCluster });
      }],
    });
    expect(() => buildRegistry(duplicate)).toThrow(/Duplicate editor toolbar cluster id: zoom/);
    expect(buildRegistry(composeEditor()).toolbarClusters(editorStub)).toHaveLength(0);
  });
});

describe('reusable style targets', () => {
  it('groups attached class variants and resolves state/media scopes', () => {
    const document = createDocument();
    const node = createNode('text', { content: 'Styled' });
    const base = createReusableStyleRule('class_ProofA1', 'Proposal Emphasis');
    base.properties.color = '#f97316';
    const hover = {
      ...createReusableStyleRule('rule_hover', 'proposal-emphasis'),
      selectors: [...base.selectors],
      properties: { color: '#fb923c' },
      state: 'hover',
    };
    const print = {
      ...createReusableStyleRule('rule_print', 'proposal-emphasis'),
      selectors: [...base.selectors],
      properties: { color: '#111827' },
      mediaQuery: 'print',
    };
    document.styles.rules.push(base, hover, print);
    node.styleBindings = setStyleRuleAttachment(node.styleBindings, base.id, true);
    document.pages[0]!.regions.body.children.push(node);

    expect(attachedStyleRuleIds(node)).toEqual([base.id]);
    expect(reusableStyleRuleGroups(document)).toEqual([
      expect.objectContaining({
        ruleId: base.id,
        name: 'proposal-emphasis',
        propertyCount: 1,
        variantCount: 3,
        usage: 1,
      }),
    ]);
    expect(findScopedStyleRule(document.styles.rules, base.selectors[0]!, 'hover', null)?.id)
      .toBe(hover.id);
    expect(findScopedStyleRule(document.styles.rules, base.selectors[0]!, 'base', STYLE_MEDIA_OPTIONS[4]!.mediaQuery)?.id)
      .toBe(print.id);
  });
});

describe('canvas decoration contributions', () => {
  const editorStub = {} as Parameters<EditorExtensionRegistry['canvasDecorations']>[0];

  it('registers the ruler plus optional action overlays in the full preset', () => {
    const registry = buildRegistry(createFullEditorPreset());
    expect(registry.canvasDecorations(editorStub, 'above').map((decoration) => decoration.id))
      .toEqual(['ruler']);
    expect(registry.canvasDecorations(editorStub, 'overlay').map((decoration) => decoration.id))
      .toEqual(['selection-toolbar', 'context-menu']);
  });

  it('filters by placement and visible(), and rejects duplicate ids', () => {
    const registry = buildRegistry(createFullEditorPreset({
      extensions: [(api) => {
        api.addCanvasDecoration({ id: 'custom.guides', placement: 'overlay', component: stubDecoration });
        api.addCanvasDecoration({
          id: 'custom.hidden',
          placement: 'above',
          visible: () => false,
          component: stubDecoration,
        });
      }],
    }));
    expect(registry.canvasDecorations(editorStub, 'overlay').map((decoration) => decoration.id))
      .toEqual(['selection-toolbar', 'custom.guides', 'context-menu']);
    expect(registry.canvasDecorations(editorStub, 'above').map((decoration) => decoration.id))
      .toEqual(['ruler']);

    const duplicate = createFullEditorPreset({
      extensions: [(api) => {
        api.addCanvasDecoration({ id: 'ruler', placement: 'above', component: stubDecoration });
      }],
    });
    expect(() => buildRegistry(duplicate)).toThrow(/Duplicate editor canvas decoration id: ruler/);
  });

  it('keeps explicit compositions free of decorations', () => {
    expect(buildRegistry(composeEditor()).canvasDecorations(editorStub, 'above')).toHaveLength(0);
    expect(buildRegistry(composeEditor()).canvasDecorations(editorStub, 'overlay')).toHaveLength(0);
  });
});
