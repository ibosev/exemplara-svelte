import {
  createAllowAllCapabilityPolicy,
  type CapabilityId,
  type CapabilityPolicy,
} from '../core/capabilities.js';
import type { EditorExtension, EditorExtensionApi, EditorExtensionDisposer } from './extensions.js';

// This module owns the composition MECHANISM only. The preset DISTRIBUTIONS
// (createFullEditorPreset / createManualEditorPreset) live in presets.ts —
// the single module allowed to import every plugin — so composing hosts and
// EditorContext never pull unused plugins into their bundles.

export interface EditorPlugin {
  /** Stable, namespaced identifier such as `exemplara.data-binding`. */
  id: string;
  version: string;
  /** Plugin ids that must be installed before this plugin. */
  dependsOn?: readonly string[];
  /** Capabilities which must be allowed for this plugin to run. */
  requires?: readonly CapabilityId[];
  /** Capabilities made available by this plugin. */
  provides?: readonly CapabilityId[];
  setup(api: EditorExtensionApi): void | EditorExtensionDisposer;
}

export type EditorServiceMap = Readonly<Record<string, unknown>>;

export interface EditorComposition {
  readonly plugins: readonly EditorPlugin[];
  readonly policy: CapabilityPolicy;
  readonly services: EditorServiceMap;
  readonly inheritLegacyRegistrations: boolean;
}

export interface ComposeEditorOptions {
  plugins?: readonly EditorPlugin[];
  policy?: CapabilityPolicy;
  services?: EditorServiceMap;
  /** Compatibility only; new compositions should keep runtime registrations isolated. */
  inheritLegacyRegistrations?: boolean;
}

export type EditorCompositionErrorCode =
  | 'duplicate-plugin'
  | 'invalid-plugin'
  | 'missing-dependency'
  | 'dependency-cycle'
  | 'disabled-capability';

export class EditorCompositionError extends Error {
  constructor(
    readonly code: EditorCompositionErrorCode,
    message: string,
    readonly pluginId?: string,
  ) {
    super(message);
    this.name = 'EditorCompositionError';
  }
}

export function defineEditorPlugin(plugin: EditorPlugin): EditorPlugin {
  return plugin;
}

/** True when policy permits a capability and an installed plugin supplies it. */
export function isPluginCapabilityEnabled(
  composition: EditorComposition,
  capability: CapabilityId,
): boolean {
  return composition.policy.allows(capability)
    && composition.plugins.some((plugin) => plugin.provides?.includes(capability));
}

export function adaptEditorExtension(
  extension: EditorExtension,
  id: string,
): EditorPlugin {
  return {
    id,
    version: '1.0.0',
    setup: extension,
  };
}

function validatePlugin(plugin: EditorPlugin): void {
  if (!plugin.id.trim() || !plugin.version.trim() || typeof plugin.setup !== 'function') {
    throw new EditorCompositionError(
      'invalid-plugin',
      'Editor plugins require a non-empty id, version, and setup function.',
      plugin.id,
    );
  }
}

function orderPlugins(plugins: readonly EditorPlugin[]): EditorPlugin[] {
  const byId = new Map<string, EditorPlugin>();
  for (const plugin of plugins) {
    validatePlugin(plugin);
    if (byId.has(plugin.id)) {
      throw new EditorCompositionError(
        'duplicate-plugin',
        `Duplicate editor plugin id: ${plugin.id}`,
        plugin.id,
      );
    }
    byId.set(plugin.id, plugin);
  }

  for (const plugin of plugins) {
    for (const dependency of plugin.dependsOn ?? []) {
      if (!byId.has(dependency)) {
        throw new EditorCompositionError(
          'missing-dependency',
          `Editor plugin ${plugin.id} depends on missing plugin ${dependency}.`,
          plugin.id,
        );
      }
    }
  }

  const ordered: EditorPlugin[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (plugin: EditorPlugin): void => {
    if (visited.has(plugin.id)) return;
    if (visiting.has(plugin.id)) {
      throw new EditorCompositionError(
        'dependency-cycle',
        `Editor plugin dependency cycle includes ${plugin.id}.`,
        plugin.id,
      );
    }
    visiting.add(plugin.id);
    for (const dependency of plugin.dependsOn ?? []) visit(byId.get(dependency)!);
    visiting.delete(plugin.id);
    visited.add(plugin.id);
    ordered.push(plugin);
  };
  plugins.forEach(visit);
  return ordered;
}

export function composeEditor(options: ComposeEditorOptions = {}): EditorComposition {
  const policy = options.policy ?? createAllowAllCapabilityPolicy();
  const plugins = orderPlugins(options.plugins ?? []);
  for (const plugin of plugins) {
    for (const capability of [...(plugin.requires ?? []), ...(plugin.provides ?? [])]) {
      if (!policy.allows(capability)) {
        throw new EditorCompositionError(
          'disabled-capability',
          `Editor plugin ${plugin.id} requires disabled capability ${capability}.`,
          plugin.id,
        );
      }
    }
  }
  return Object.freeze({
    plugins: Object.freeze(plugins),
    policy,
    services: Object.freeze({ ...(options.services ?? {}) }),
    inheritLegacyRegistrations: options.inheritLegacyRegistrations ?? false,
  });
}
