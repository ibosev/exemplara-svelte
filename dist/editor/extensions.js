import { EditorExtensionRegistry as CoreRegistry, } from "exemplara-core/editor";
import { legacyRenderRuntime, } from "../renderer/runtime.js";
import { legacyComponentIconRegistry, } from "./icons.js";
import { resolveIcon } from "./icon-tokens.js";
export * from "./extension-types.js";
const attachedFacades = new WeakMap();
const installedViews = new WeakMap();
/** Svelte contribution components wrapped around the session's portable registry. */
export class EditorExtensionRegistry {
    core;
    #ownsCore;
    #editor;
    #panels = new Map();
    #sections = new Map();
    #clusters = new Map();
    #decorations = new Map();
    #icons = new Map();
    #disposers = [];
    constructor(registry, extensions = [], options = {}) {
        this.#ownsCore = !options.core;
        this.core =
            options.core ??
                new CoreRegistry(registry, [], {
                    ...options,
                    renderRuntime: options.renderRuntime ?? legacyRenderRuntime(),
                });
        const core = this.core;
        const installed = installedViews.get(core) ?? new Set();
        installedViews.set(core, installed);
        for (const id of options.installedPlugins ?? [])
            installed.add(id);
        this.#editor = options.editor?.();
        if (this.#editor)
            attachedFacades.set(core, this.#editor);
        let reusing = false;
        const facade = (session) => attachedFacades.get(core) ?? session;
        const rememberIcon = (id, icon) => {
            if (icon)
                this.#icons.set(id, icon);
            return undefined;
        };
        const addView = (kind, map, value) => {
            if (map.has(value.id))
                throw new Error(`Duplicate editor ${kind} id: ${value.id}`);
            map.set(value.id, value);
        };
        const api = {
            ...core.api,
            installCore: (plugin) => {
                if (installed.has(plugin.id))
                    return;
                installed.add(plugin.id);
                const dispose = plugin.setup(core.api);
                if (dispose)
                    this.#disposers.push(dispose);
            },
            addContributionIcon: (id, icon) => { this.#icons.set(id, icon); },
            addComponentIcon: (type, icon) => (options.iconRegistry ?? legacyComponentIconRegistry).register(type, icon),
            addPanel: ({ component, icon, ...panel }) => {
                addView("panel", this.#panels, { ...panel, icon, component });
                if (!core.panel(panel.id))
                    core.api.addPanel(panel);
            },
            addInspectorSection: ({ component, visible, ...section }) => {
                addView("inspector section", this.#sections, {
                    ...section,
                    component,
                    visible,
                });
                if (!core.hasViewContribution("inspector-section", section.id))
                    core.api.addInspectorSection({
                        ...section,
                        visible: visible && ((editor, node) => visible(facade(editor), node)),
                    });
            },
            addToolbarCluster: ({ component, visible, ...cluster }) => {
                addView("toolbar cluster", this.#clusters, {
                    ...cluster,
                    component,
                    visible,
                });
                if (!core.hasViewContribution("toolbar-cluster", cluster.id))
                    core.api.addToolbarCluster({
                        ...cluster,
                        visible: visible && ((editor) => visible(facade(editor))),
                    });
            },
            addCanvasDecoration: ({ component, visible, ...decoration }) => {
                addView("canvas decoration", this.#decorations, {
                    ...decoration,
                    component,
                    visible,
                });
                if (!core.hasViewContribution("canvas-decoration", decoration.id))
                    core.api.addCanvasDecoration({
                        ...decoration,
                        visible: visible && ((editor) => visible(facade(editor))),
                    });
            },
            addCommand: ({ icon, canRun, execute, ...command }) => core.api.addCommand({
                ...command,
                icon: rememberIcon(command.id, icon),
                canRun: canRun && ((editor, context) => canRun(facade(editor), context)),
                execute: (editor, context) => execute(facade(editor), context),
            }),
            addMenuItem: ({ when, ...item }) => core.api.addMenuItem({
                ...item,
                when: when && ((editor, context) => when(facade(editor), context)),
            }),
            addKeybinding: ({ when, ...binding }) => core.api.addKeybinding({
                ...binding,
                when: when && ((editor, context) => when(facade(editor), context)),
            }),
            addOutlineAction: ({ icon, canRun, execute, ...action }) => core.api.addOutlineAction({
                ...action,
                icon: rememberIcon(action.id, icon),
                canRun: canRun && ((editor, node) => canRun(facade(editor), node)),
                execute: (editor, node) => execute(facade(editor), node),
            }),
            addBlock: ({ icon, insert, ...block }) => core.api.addBlock({
                ...block,
                icon: rememberIcon(block.id, icon),
                insert: insert &&
                    ((context) => insert({ ...context, editor: facade(context.editor) })),
            }),
            addStyleField: ({ visible, ...field }) => core.api.addStyleField({
                ...field,
                visible: visible && ((editor, node) => visible(facade(editor), node)),
            }),
        };
        const behaviorMethods = [
            "addComponent",
            "addBindingTransform",
            "addBlock",
            "addCommand",
            "addMenuItem",
            "addKeybinding",
            "addOutlineAction",
            "addAutocompleteProvider",
            "addStyleField",
            "addFormatter",
            "replaceFormatter",
            "setExpressionEvaluator",
        ];
        for (const method of behaviorMethods) {
            const original = api[method];
            Object.assign(api, {
                [method]: (...args) => {
                    if (!reusing)
                        original(...args);
                },
            });
        }
        try {
            extensions.forEach((extension, index) => {
                const id = options.extensionIds?.[index];
                reusing = !!id && installed.has("view:" + id);
                const dispose = extension(api);
                if (dispose)
                    this.#disposers.push(dispose);
                if (id)
                    installed.add("view:" + id);
            });
        }
        catch (error) {
            this.destroy();
            throw error;
        }
    }
    destroy() {
        if (attachedFacades.get(this.core) === this.#editor)
            attachedFacades.delete(this.core);
        const errors = [];
        for (const dispose of this.#disposers.splice(0).reverse()) {
            try {
                dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (this.#ownsCore) {
            try {
                this.core.destroy();
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (errors.length)
            throw new AggregateError(errors, "Editor view cleanup failed.");
    }
    #session(editor) {
        editor.track?.();
        return editor.session ?? editor;
    }
    #icon(id, token) {
        return this.#icons.get(id) ?? resolveIcon(token);
    }
    get panels() {
        return this.core.panels.flatMap((p) => {
            const view = this.#panels.get(p.id);
            return view ? [view] : [];
        });
    }
    panelsFor(placement) {
        return this.panels.filter((p) => p.placement === placement);
    }
    panel(id) {
        return this.#panels.get(id);
    }
    get selectionPanel() {
        return this.panels.find((p) => p.activateOnSelection);
    }
    inspectorSections(editor, node) {
        return this.core
            .inspectorSections(this.#session(editor), node)
            .flatMap((s) => {
            const view = this.#sections.get(s.id);
            return view ? [view] : [];
        });
    }
    toolbarClusters(editor) {
        return this.core.toolbarClusters(this.#session(editor)).flatMap((c) => {
            const view = this.#clusters.get(c.id);
            return view ? [view] : [];
        });
    }
    canvasDecorations(editor, placement) {
        return this.core
            .canvasDecorations(this.#session(editor), placement)
            .flatMap((d) => {
            const view = this.#decorations.get(d.id);
            return view ? [view] : [];
        });
    }
    get commands() {
        return this.core.commands.map((c) => ({
            ...c,
            icon: this.#icon(c.id, c.icon),
            canRun: c.canRun && ((e, ctx) => c.canRun(this.#session(e), ctx)),
            execute: (e, ctx) => c.execute(this.#session(e), ctx),
        }));
    }
    command(id) {
        return this.commands.find((c) => c.id === id);
    }
    menuItems(location, editor, context = {}) {
        return this.core
            .menuItems(location, this.#session(editor), context)
            .map((item) => ({ ...item, command: this.command(item.command.id) }));
    }
    runCommand(id, editor, context = {}) {
        return this.core.runCommand(id, this.#session(editor), context);
    }
    resolveKeybinding(event, editor, context = {}) {
        return this.core.resolveKeybinding(event, this.#session(editor), context);
    }
    get blocks() {
        return this.core.blocks.map((b) => ({
            ...b,
            icon: this.#icon(b.id, b.icon),
            insert: b.insert &&
                ((ctx) => b.insert({ ...ctx, editor: this.#session(ctx.editor) })),
        }));
    }
    block(id) {
        return this.blocks.find((b) => b.id === id);
    }
    get outlineActions() {
        return this.core.outlineActions.map((a) => ({
            ...a,
            icon: this.#icon(a.id, a.icon),
            canRun: a.canRun && ((e, n) => a.canRun(this.#session(e), n)),
            execute: (e, n) => a.execute(this.#session(e), n),
        }));
    }
    get autocompleteProviders() {
        return this.core.autocompleteProviders;
    }
    styleFieldsFor(editor, node) {
        return this.core
            .styleFieldsFor(this.#session(editor), node)
            .map((f) => ({
            ...f,
            visible: f.visible && ((e, n) => f.visible(this.#session(e), n)),
        }));
    }
    get formatters() {
        return this.core.formatters;
    }
    get expressionRuntime() {
        return this.core.expressionRuntime;
    }
}
