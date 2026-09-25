import { describe, expect, it, vi } from 'vitest';
import { ComponentRegistry, createCapabilityPolicy } from '../src/lib/core/index.js';
import { createRenderRuntime } from '../src/lib/renderer/index.js';
import {
  createComponentIconRegistry,
  EditorCompositionError,
  EditorExtensionRegistry,
  composeEditor,
  createFullEditorPreset,
  createWebEditorPreset,
  defineEditorPlugin,
  type EditorExtension,
} from '../src/lib/editor/index.js';

describe('editor composition', () => {
  it('orders dependencies before dependants', () => {
    const base = defineEditorPlugin({ id: 'test.base', version: '1.0.0', setup: () => {} });
    const feature = defineEditorPlugin({
      id: 'test.feature',
      version: '1.0.0',
      dependsOn: ['test.base'],
      setup: () => {},
    });
    const composition = composeEditor({ plugins: [feature, base] });
    expect(composition.plugins.map((plugin) => plugin.id)).toEqual(['test.base', 'test.feature']);
  });

  it('fails fast for duplicate ids, missing dependencies, and dependency cycles', () => {
    const plugin = defineEditorPlugin({ id: 'test.same', version: '1.0.0', setup: () => {} });
    expect(() => composeEditor({ plugins: [plugin, plugin] })).toThrow(EditorCompositionError);

    expect(() => composeEditor({
      plugins: [{ id: 'test.child', version: '1.0.0', dependsOn: ['test.missing'], setup: () => {} }],
    })).toThrow(/missing plugin/);

    expect(() => composeEditor({
      plugins: [
        { id: 'test.a', version: '1.0.0', dependsOn: ['test.b'], setup: () => {} },
        { id: 'test.b', version: '1.0.0', dependsOn: ['test.a'], setup: () => {} },
      ],
    })).toThrow(/cycle/);
  });

  it('rejects plugins whose semantic capabilities are disabled', () => {
    const policy = createCapabilityPolicy(['document.edit']);
    expect(() => composeEditor({
      policy,
      plugins: [{
        id: 'test.data',
        version: '1.0.0',
        provides: ['data.bind.author'],
        setup: () => {},
      }],
    })).toThrow(/disabled capability data.bind.author/);
  });

  it('adapts legacy extensions in the full preset and disposes plugin resources', () => {
    const dispose = vi.fn();
    const extension = vi.fn((api) => {
      expect(api.hasCapability('data.resolve')).toBe(true);
      api.addCommand({
        id: 'test.command',
        label: 'Test',
        execute: () => true,
      });
      return dispose;
    });
    const composition = createFullEditorPreset({ extensions: [extension] });
    const registry = new EditorExtensionRegistry(
      new ComponentRegistry(),
      composition.plugins.map((plugin) => plugin.setup),
    );

    expect(composition.policy.allows('data.resolve')).toBe(true);
    expect(registry.command('test.command')).toBeDefined();
    registry.destroy();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps plugin render, transform, and icon contributions session-scoped', () => {
    const firstRuntime = createRenderRuntime();
    const secondRuntime = createRenderRuntime();
    const firstIcons = createComponentIconRegistry();
    const secondIcons = createComponentIconRegistry();
    const textIcon = firstIcons.get('text')!;
    const extension: EditorExtension = (api) => {
      api.addComponent({
        type: 'test.tenant',
        label: 'Tenant component',
        category: 'Test',
        defaultProps: {},
        propSchema: {},
      }, () => '<div>tenant</div>');
      api.addBindingTransform('test.tenant', (value) => `tenant:${String(value)}`);
      api.addComponentIcon('test.tenant', textIcon);
    };

    new EditorExtensionRegistry(new ComponentRegistry(), [extension], {
      renderRuntime: firstRuntime,
      iconRegistry: firstIcons,
    });

    expect(firstRuntime.renderers.get('test.tenant')).toBeDefined();
    expect(firstRuntime.transforms.get('test.tenant')?.('value')).toBe('tenant:value');
    expect(firstIcons.get('test.tenant')).toBe(textIcon);
    expect(secondRuntime.renderers.get('test.tenant')).toBeUndefined();
    expect(secondRuntime.transforms.get('test.tenant')).toBeUndefined();
    expect(secondIcons.get('test.tenant')).toBeNull();
  });

});
