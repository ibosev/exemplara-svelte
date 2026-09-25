import { getContext, setContext } from 'svelte';
import { DocumentEngine } from '../core/engine.js';
import { ComponentRegistry, defaultRegistry } from '../core/registry.js';
import { EditorExtensionRegistry, } from './extensions.js';
import { adaptEditorExtension, composeEditor, isPluginCapabilityEnabled, } from './composition.js';
import { cloneNodeDeep, clonePageDeep, createPage, createRegion, } from '../core/create.js';
import { createId } from '../core/id.js';
import { getPageDimensions } from '../core/presets.js';
import { findNode, findParentNode, locateNode } from '../core/tree.js';
import { planCollapseFlowGroup, planPageFlow, } from '../core/pagination.js';
import { fitZoom, mmToPx } from '../shared/math.js';
import { isImageElementNode, mergeSampleData, nodeDisplayLabel } from '../shared/editor.js';
import { normalizeParagraphFormatting } from '../shared/ruler.js';
import {} from '../shared/binding-authoring.js';
import { findUnsupportedDocumentCapabilities, } from '../core/capabilities.js';
import { resolveSectionTemplate } from '../core/print-sections.js';
import { DEFAULT_WEB_DOCUMENT_SETTINGS, createWebPage, isWebDocument, uniqueWebSlug, webPageLabelFromSlug, } from '../core/web.js';
import { planRemovePrintSectionBreak, planSetPrintSectionLinked, planStartPrintSection, planUpdatePrintSection, planUpdatePrintVariant, } from '../core/print-section-commands.js';
import { createRenderRuntime } from '../renderer/runtime.js';
import { createComponentIconRegistry, } from './icons.js';
import { createReusableStyleRule, setStyleRuleAttachment as updateStyleRuleAttachment, } from './style-targets.js';
/**
 * Central reactive editor state, shared with every editor component via
 * Svelte context. All fields are runes — components simply read them and
 * stay in sync.
 */
export class EditorContext {
    engine;
    registry;
    extensions;
    composition;
    renderRuntime;
    iconRegistry;
    host;
    controller;
    /** Reactive bridges over the portable engine and registry subscriptions. */
    engineRevision = $state(0);
    /** Increments only when the entire document is replaced, allowing form surfaces to remount. */
    documentEpoch = $state(0);
    registryRevision = $state(0);
    #stopEngine = () => { };
    #stopRegistry = () => { };
    #inlineExpressionTarget = null;
    selectedId = $state(null);
    hoveredId = $state(null);
    activePageIndex = $state(0);
    /** Copy buffer for node copy/paste. */
    clipboard = $state(null);
    /** Canvas zoom factor. */
    zoom = $state(1);
    /** Node currently in inline rich-text editing mode. */
    editingId = $state(null);
    /** Panel tabs; initialized to each side's first registered panel contribution. */
    leftTab = $state('');
    rightTab = $state('');
    /** Compact sidebars retain their vertical icon rail while hiding panel content. */
    leftPanelCompact = $state(false);
    rightPanelCompact = $state(false);
    /** Shared Print panel/canvas selection for direct header/footer editing. */
    printPosition = $state('header');
    printVariant = $state('default');
    printPreviewPage = $state(0);
    /** True while the active paper margin iframe is directly contenteditable. */
    printEditing = $state(false);
    /** Sheets containing an indivisible first block taller than the body frame. */
    blockedFlowPageIds = $state([]);
    /** Print preview overlay. */
    previewOpen = $state(false);
    /** Focused data-source and binding workspace opened from the compact toolbar. */
    dataWorkspaceOpen = $state(false);
    /** Right-click context menu (null = closed). */
    contextMenu = $state(null);
    /** Invalidates the Layers panel when a selected node must be explicitly revealed. */
    layerRevealRevision = $state(0);
    /** Dark editor chrome (documents stay light — print is print). */
    dark = $state(false);
    /** Resolve template expressions with sample data on the editable canvas. */
    dataPreviewEnabled = $state(true);
    /** Invalidates host theme getters after the host toggle callback runs. */
    hostThemeRevision = $state(0);
    /** Complete historical document rendered by the canvas without replacing the editable engine state. */
    historicalPreviewDocument = $state.raw(null);
    /** Durable version identifier associated with the active historical preview. */
    historicalPreviewVersionId = $state(null);
    /** Bound by Canvas so zoomToFit can measure the viewport. */
    canvasSurface = $state(null);
    hostStatus = $state(null);
    doc = $derived.by(() => {
        this.engineRevision;
        return this.historicalPreviewDocument ?? this.engine.doc;
    });
    historicalPreviewActive = $derived(this.historicalPreviewDocument !== null);
    canUndo = $derived.by(() => {
        this.engineRevision;
        return this.engine.canUndo;
    });
    isPrintTabActive = $derived(this.rightTab === 'print');
    /** Effective page index to use for Print previews, section resolution, and the Print panel
     *  when the Print tab is active. This derives from the editor's activePageIndex to eliminate
     *  the fragile dual-state (activePageIndex vs printPreviewPage) desync.
     *  When Print is not active, falls back to the explicit printPreviewPage state.
     */
    effectivePrintPreviewPage = $derived(this.isPrintTabActive
        ? Math.min(this.activePageIndex, Math.max(0, this.doc.pages.length - 1))
        : this.printPreviewPage);
    canRedo = $derived.by(() => {
        this.engineRevision;
        return this.engine.canRedo;
    });
    registryCategories = $derived.by(() => {
        this.registryRevision;
        return this.registry.categories;
    });
    /** Dynamic document features unavailable to this composition (never silently evaluated). */
    capabilityDiagnostics = $derived.by(() => {
        const policy = this.composition.policy;
        const dataResolutionEnabled = this.isProvidedCapabilityEnabled('data.resolve');
        return findUnsupportedDocumentCapabilities(this.doc, {
            enabled: policy.enabled,
            unsupportedDocument: policy.unsupportedDocument,
            allows: (capability) => capability === 'data.resolve'
                ? dataResolutionEnabled
                : policy.allows(capability),
        });
    });
    activePage = $derived.by(() => {
        const pages = this.doc.pages;
        return pages[Math.min(this.activePageIndex, pages.length - 1)] ?? null;
    });
    selectedNode = $derived.by(() => this.selectedId ? findNode(this.doc, this.selectedId) : null);
    selectedDefinition = $derived.by(() => this.selectedNode ? (this.getDefinition(this.selectedNode.type) ?? null) : null);
    constructor(init = {}) {
        this.engine = new DocumentEngine({ document: init.document });
        // Avoid leaking extension registrations between independent editor instances.
        this.registry = init.registry ?? new ComponentRegistry(defaultRegistry.all);
        // The full-featured default lives in Editor.svelte (presets.ts is the
        // only module that may import every plugin); a bare context is empty.
        const baseComposition = init.composition ?? composeEditor();
        this.composition = init.extensions?.length
            ? composeEditor({
                policy: baseComposition.policy,
                plugins: [
                    ...baseComposition.plugins,
                    ...init.extensions.map((extension, index) => adaptEditorExtension(extension, `legacy.context-extension.${index + 1}`)),
                ],
                services: baseComposition.services,
                inheritLegacyRegistrations: baseComposition.inheritLegacyRegistrations,
            })
            : baseComposition;
        this.renderRuntime = createRenderRuntime({
            inheritLegacy: this.composition.inheritLegacyRegistrations,
        });
        this.iconRegistry = createComponentIconRegistry(this.composition.inheritLegacyRegistrations);
        this.extensions = new EditorExtensionRegistry(this.registry, this.composition.plugins.map((plugin) => plugin.setup), {
            policy: this.composition.policy,
            services: this.composition.services,
            renderRuntime: this.renderRuntime,
            iconRegistry: this.iconRegistry,
        });
        this.leftTab = this.extensions.panelsFor('left')[0]?.id ?? '';
        this.rightTab = this.extensions.panelsFor('right')[0]?.id ?? '';
        this.host = init.host ?? {};
        const editor = this;
        this.controller = {
            get document() { return editor.doc; },
            get selectedNodeId() { return editor.selectedId; },
            get activePageId() { return editor.activePage?.id ?? null; },
            get dataPreviewEnabled() { return editor.dataPreviewEnabled; },
            get dataWorkspaceOpen() { return editor.dataWorkspaceOpen; },
            get autoFlowEnabled() { return editor.doc.pagination.mode === 'auto'; },
            get renderRuntime() { return editor.renderRuntime; },
            get expressionRuntime() { return editor.expressionRuntime; },
            snapshot: () => editor.engine.snapshot(),
            replaceDocument: (document) => editor.replaceDocument(document),
            selectNode: (nodeId) => editor.select(nodeId),
            openPanel: (panelId) => editor.openPanel(panelId),
            isPanelCompact: (side) => editor.isPanelCompact(side),
            setPanelCompact: (side, compact) => editor.setPanelCompact(side, compact),
            togglePanelCompact: (side) => editor.togglePanelCompact(side),
            openDataWorkspace: () => editor.openDataWorkspace(),
            closeDataWorkspace: () => editor.closeDataWorkspace(),
            runCommand: (commandId) => editor.runCommand(commandId),
            insertExpression: (expression) => editor.insertExpression(expression),
            setDataPreview: (enabled) => editor.setDataPreview(enabled),
            setAutoFlow: (enabled) => editor.setAutoFlow(enabled),
            toggleAutoFlow: () => editor.toggleAutoFlow(),
            setStatus: (message, tone) => editor.setHostStatus(message, tone),
        };
        this.#stopEngine = this.engine.subscribe((state) => (this.engineRevision = state.revision));
        this.#stopRegistry = this.registry.subscribe((revision) => (this.registryRevision = revision));
    }
    destroy() {
        this.#inlineExpressionTarget = null;
        this.extensions.destroy();
        this.#stopEngine();
        this.#stopRegistry();
    }
    getDefinition(type) {
        this.registryRevision;
        return this.registry.get(type);
    }
    componentIcon(type) {
        return this.iconRegistry.get(type);
    }
    get expressionRuntime() {
        return this.extensions.expressionRuntime;
    }
    hasPlugin(pluginId) {
        return this.composition.plugins.some((plugin) => plugin.id === pluginId);
    }
    /** A feature is active only when policy permits it and an installed plugin provides it. */
    isProvidedCapabilityEnabled(capability) {
        return isPluginCapabilityEnabled(this.composition, capability);
    }
    autocompleteSuggestions(trigger) {
        if (!this.isProvidedCapabilityEnabled('data.bind.author'))
            return [];
        const query = trigger.query.trim().toLowerCase();
        const formatterRank = (name, label, description) => {
            if (!query)
                return 0;
            const normalizedName = name.toLowerCase();
            const normalizedLabel = label.toLowerCase();
            if (normalizedName === query)
                return 0;
            if (normalizedName.startsWith(query))
                return 1;
            if (normalizedLabel.startsWith(query))
                return 2;
            if (normalizedName.includes(query))
                return 3;
            if (normalizedLabel.includes(query))
                return 4;
            return description.toLowerCase().includes(query) ? 5 : 6;
        };
        const base = trigger.kind === 'path'
            ? []
            : this.extensions.formatters
                .filter((formatter) => formatter.usage !== 'call')
                .filter((formatter) => !query
                || formatter.name.toLowerCase().includes(query)
                || formatter.label.toLowerCase().includes(query)
                || formatter.description.toLowerCase().includes(query))
                .sort((a, b) => formatterRank(a.name, a.label, a.description)
                - formatterRank(b.name, b.label, b.description))
                .map((formatter) => ({
                id: `formatter:${formatter.name}`,
                value: /\|\s*([^}]+)\}\}/.exec(formatter.example)?.[1]?.trim() ?? formatter.name,
                label: formatter.name,
                kind: 'formatter',
                type: 'formatter',
                sourceName: formatter.category,
                preview: formatter.example,
                description: formatter.description,
            }));
        const provided = this.extensions.autocompleteProviders.flatMap((provider) => provider.suggest({ trigger, document: this.doc, query: trigger.query }));
        const unique = new Map();
        for (const suggestion of [...base, ...provided])
            unique.set(suggestion.id, suggestion);
        return [...unique.values()].slice(0, 12);
    }
    setHostStatus(message, tone = 'neutral') {
        this.hostStatus = { message, tone };
    }
    /** Replace the whole document and reset editor-local selection/form state. */
    replaceDocument(document) {
        this.clearHistoricalPreview();
        this.selectedId = null;
        this.editingId = null;
        this.#inlineExpressionTarget = null;
        this.contextMenu = null;
        this.dataWorkspaceOpen = false;
        this.activePageIndex = Math.min(this.activePageIndex, Math.max(0, document.pages.length - 1));
        this.engine.load(document);
        this.documentEpoch += 1;
    }
    /** Render a durable snapshot without loading it into the command engine or changing undo history. */
    previewHistoricalDocument(versionId, document) {
        this.selectedId = null;
        this.hoveredId = null;
        this.editingId = null;
        this.#inlineExpressionTarget = null;
        this.contextMenu = null;
        this.printEditing = false;
        this.historicalPreviewVersionId = versionId;
        this.historicalPreviewDocument = document;
        this.activePageIndex = Math.min(this.activePageIndex, Math.max(0, document.pages.length - 1));
    }
    /** Return the canvas to the current editable draft. */
    clearHistoricalPreview() {
        if (!this.historicalPreviewDocument)
            return;
        this.historicalPreviewDocument = null;
        this.historicalPreviewVersionId = null;
        this.activePageIndex = Math.min(this.activePageIndex, Math.max(0, this.engine.doc.pages.length - 1));
    }
    isDarkChrome() {
        this.hostThemeRevision;
        return this.host.theme ? this.host.theme.current() === 'dark' : this.dark;
    }
    toggleChromeTheme() {
        if (this.host.theme) {
            this.host.theme.toggle();
            this.hostThemeRevision += 1;
        }
        else {
            this.dark = !this.dark;
        }
    }
    openPanel(panelId, expand = true) {
        const panel = this.extensions.panel(panelId);
        if (panel?.placement === 'left') {
            this.leftTab = panel.id;
            if (expand)
                this.leftPanelCompact = false;
        }
        else if (panel?.placement === 'right') {
            this.rightTab = panel.id;
            if (expand)
                this.rightPanelCompact = false;
        }
        else
            return false;
        return true;
    }
    isPanelCompact(side) {
        return side === 'left' ? this.leftPanelCompact : this.rightPanelCompact;
    }
    setPanelCompact(side, compact) {
        if (side === 'left')
            this.leftPanelCompact = compact;
        else
            this.rightPanelCompact = compact;
    }
    togglePanelCompact(side) {
        this.setPanelCompact(side, !this.isPanelCompact(side));
    }
    openDataWorkspace() {
        if (!this.openPanel('data'))
            return false;
        this.dataWorkspaceOpen = true;
        return true;
    }
    closeDataWorkspace() {
        this.dataWorkspaceOpen = false;
    }
    setAutoFlow(enabled) {
        const mode = enabled ? 'auto' : 'manual';
        if (this.doc.pagination.mode === mode)
            return;
        this.engine.execute({ type: 'pagination:update', payload: { changes: { mode } } });
    }
    toggleAutoFlow() {
        this.setAutoFlow(this.doc.pagination.mode !== 'auto');
    }
    canRunCommand(commandId, context = {}) {
        if (this.historicalPreviewActive && commandId !== 'document.version-history')
            return false;
        const command = this.extensions.command(commandId);
        return !!command && (command.canRun?.(this, context) ?? true);
    }
    runCommand(commandId, context = {}) {
        if (this.historicalPreviewActive && commandId !== 'document.version-history') {
            this.setHostStatus('Return to the current version before editing', 'warning');
            return Promise.resolve(false);
        }
        return this.extensions.runCommand(commandId, this, context);
    }
    /** @deprecated Use canRunCommand(). */
    canRunExtensionCommand(commandId) {
        return this.canRunCommand(commandId);
    }
    /** @deprecated Use runCommand(). */
    runExtensionCommand(commandId) {
        return this.runCommand(commandId);
    }
    async saveToHost() {
        if (this.historicalPreviewActive) {
            this.setHostStatus('Return to the current version before saving', 'warning');
            return false;
        }
        if (!this.host.onSave)
            return false;
        this.setHostStatus('Saving…');
        try {
            const saved = await this.host.onSave(this.engine.snapshot());
            this.setHostStatus(saved === false ? 'Save failed' : 'Saved', saved === false ? 'danger' : 'success');
            return saved !== false;
        }
        catch {
            this.setHostStatus('Save failed', 'danger');
            return false;
        }
    }
    // --- Selection ---
    select(nodeId) {
        this.selectedId = nodeId;
        const selectionPanel = this.extensions.selectionPanel;
        if (nodeId && selectionPanel)
            this.openPanel(selectionPanel.id, false);
        if (this.editingId && this.editingId !== nodeId)
            this.editingId = null;
    }
    /** Select a component and bring its rendered canvas element into view. */
    selectAndRevealNode(nodeId) {
        if (!findNode(this.doc, nodeId))
            return false;
        this.select(nodeId);
        requestAnimationFrame(() => {
            this.canvasSurface
                ?.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return true;
    }
    /** Select and reveal the nearest component parent. Region roots have no selectable parent. */
    selectParent(nodeId) {
        const parent = findParentNode(this.doc, nodeId);
        if (!parent)
            return false;
        return this.selectAndRevealNode(parent.id);
    }
    /** Open Layers and request expansion/scrolling to a component node. */
    revealInLayers(nodeId) {
        if (!findNode(this.doc, nodeId) || !this.openPanel('layers'))
            return false;
        this.select(nodeId);
        this.layerRevealRevision += 1;
        return true;
    }
    openContextMenu(x, y, nodeId) {
        this.selectedId = nodeId;
        this.contextMenu = { x, y, nodeId };
    }
    closeContextMenu() {
        this.contextMenu = null;
    }
    // --- Data context (merged sample data of all sources) ---
    setDataPreview(enabled) {
        this.dataPreviewEnabled = enabled;
    }
    /** Merge every data source's sampleData into one preview context. */
    getDataContext() {
        // Without an installed, policy-permitted data.resolve provider, no
        // sample/tenant data feeds canvas, preview, or exports;
        // capabilityDiagnostics surfaces what the document expected.
        if (!this.isProvidedCapabilityEnabled('data.resolve'))
            return {};
        return mergeSampleData(this.doc.dataSources);
    }
    // --- Node operations ---
    addComponent(type, parentId, index, slot) {
        const node = this.registry.createNode(type);
        this.engine.execute({ type: 'component:add', payload: { parentId, slot, index, node } });
        this.selectedId = node.id;
        return node;
    }
    addBlock(blockId, parentId, index, slot) {
        const block = this.extensions.block(blockId);
        if (!block)
            return null;
        if (block.insert)
            return block.insert({ editor: this, parentId, index, slot });
        if (!block.create)
            return null;
        const node = structuredClone(block.create());
        this.engine.execute({ type: 'component:add', payload: { parentId, slot, index, node } });
        this.selectedId = node.id;
        return node;
    }
    /** Insert an image node backed by a document asset at an explicit drop target. */
    insertAssetImage(assetId, parentId, index, slot) {
        const asset = this.engine.doc.assets.find((entry) => entry.id === assetId);
        if (!asset || (asset.type !== 'image' && asset.type !== 'svg'))
            return null;
        const node = this.registry.createNode('image', {
            src: asset.src,
            alt: asset.name,
            width: asset.width ? `${Math.min(asset.width, 400)}px` : '',
        });
        this.engine.execute({
            type: 'component:add',
            payload: { parentId, slot, index, node },
        });
        this.selectedId = node.id;
        return node;
    }
    /** Replace the source of an existing native or imported HTML image with a document asset. */
    applyAssetToImage(assetId, nodeId) {
        const asset = this.engine.doc.assets.find((entry) => entry.id === assetId);
        const node = findNode(this.engine.doc, nodeId);
        if (!asset || (asset.type !== 'image' && asset.type !== 'svg') || !isImageElementNode(node))
            return false;
        if (node.type === 'image') {
            this.updateProps(node.id, {
                src: asset.src,
                alt: String(node.props.alt ?? '').trim() || asset.name,
            });
            return true;
        }
        const attributes = node.props.attributes && typeof node.props.attributes === 'object'
            && !Array.isArray(node.props.attributes)
            ? { ...node.props.attributes }
            : {};
        attributes.src = asset.src;
        if (!String(attributes.alt ?? '').trim())
            attributes.alt = asset.name;
        // An uploaded asset is a single embedded source. Stale responsive sources
        // would otherwise continue to win on high-density displays.
        delete attributes.srcset;
        delete attributes.sizes;
        const previewAttributes = node.props.previewAttributes
            && typeof node.props.previewAttributes === 'object'
            && !Array.isArray(node.props.previewAttributes)
            ? { ...node.props.previewAttributes }
            : {};
        delete previewAttributes.src;
        delete previewAttributes.srcset;
        delete previewAttributes.sizes;
        this.updateProps(node.id, { attributes, previewAttributes });
        return true;
    }
    /** Register the currently mounted rich-text caret as an expression insertion target. */
    registerInlineExpressionTarget(nodeId, insert) {
        const target = { nodeId, insert };
        this.#inlineExpressionTarget = target;
        return () => {
            if (this.#inlineExpressionTarget === target)
                this.#inlineExpressionTarget = null;
        };
    }
    /** Insert at the active rich-text caret, or replace selected component content outside edit mode. */
    insertExpression(expression) {
        if (!this.isProvidedCapabilityEnabled('data.bind.author'))
            return false;
        if (this.editingId) {
            const target = this.#inlineExpressionTarget;
            if (!target || target.nodeId !== this.editingId || this.selectedId !== this.editingId)
                return false;
            return target.insert(expression);
        }
        const node = this.selectedNode;
        const definition = this.selectedDefinition;
        if (!node || !definition)
            return false;
        const targetProp = definition.propSchema.content ? 'content' : null;
        if (!targetProp)
            return false;
        const dataBindings = node.dataBindings?.filter((binding) => binding.targetProp !== targetProp);
        this.commitPropAuthoring(node.id, targetProp, expression, dataBindings?.length ? dataBindings : undefined);
        return true;
    }
    moveNode(nodeId, targetParentId, targetIndex, targetSlot) {
        this.engine.execute({
            type: 'component:move',
            payload: { nodeId, targetParentId, targetSlot, targetIndex },
        });
    }
    updateProps(nodeId, props) {
        const target = this.#editableFlowTarget(nodeId);
        this.engine.batch([
            ...target.commands,
            { type: 'component:update', payload: { nodeId: target.nodeId, changes: { props } } },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Commit rich-text content and its explicit binding metadata as one undo step. */
    commitRichTextAuthoring(nodeId, content, dataBindings) {
        const allowedBindings = this.isProvidedCapabilityEnabled('data.bind.author')
            ? dataBindings
            : dataBindings?.filter((binding) => binding.targetProp !== 'content');
        const target = this.#editableFlowTarget(nodeId);
        this.engine.batch([
            ...target.commands,
            {
                type: 'component:update',
                payload: {
                    nodeId: target.nodeId,
                    changes: { props: { content }, dataBindings: allowedBindings?.length ? allowedBindings : undefined },
                },
            },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Commit a text-like property and its binding metadata as one undo step. */
    commitPropAuthoring(nodeId, targetProp, value, dataBindings) {
        const allowedBindings = this.isProvidedCapabilityEnabled('data.bind.author')
            ? dataBindings
            : dataBindings?.filter((binding) => binding.targetProp !== targetProp);
        const target = this.#editableFlowTarget(nodeId);
        this.engine.batch([
            ...target.commands,
            {
                type: 'component:update',
                payload: {
                    nodeId: target.nodeId,
                    changes: {
                        props: { [targetProp]: value },
                        dataBindings: allowedBindings?.length ? allowedBindings : undefined,
                    },
                },
            },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Update author-owned page-flow rules, collapsing a split logical node first. */
    updatePaginationRules(nodeId, changes) {
        const target = this.#editableFlowTarget(nodeId);
        const node = findNode(this.engine.doc, target.nodeId);
        if (!node)
            return;
        const pagination = { ...node.pagination, ...changes };
        for (const [key, value] of Object.entries(pagination)) {
            if (value === undefined || value === false)
                delete pagination[key];
        }
        this.engine.batch([
            ...target.commands,
            {
                type: 'component:update',
                payload: {
                    nodeId: target.nodeId,
                    changes: { pagination: Object.keys(pagination).length > 0 ? pagination : undefined },
                },
            },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Enter lossless rich-text editing for the complete logical flow node. */
    beginRichTextEdit(nodeId) {
        const target = this.#editableFlowTarget(nodeId);
        if (target.commands.length > 0)
            this.engine.batch(target.commands);
        this.selectedId = target.nodeId;
        this.editingId = target.nodeId;
    }
    /**
     * Set (or clear with undefined) a value-based style binding on a node.
     * Value bindings are rendered as inline styles by the renderer.
     */
    setStyleBinding(nodeId, property, value) {
        const target = this.#editableFlowTarget(nodeId);
        const node = findNode(this.engine.doc, target.nodeId);
        if (!node)
            return;
        const bindings = (node.styleBindings ? structuredClone(node.styleBindings) : []).filter((b) => !(b.property === property && b.value !== undefined));
        if (value !== undefined && value !== '')
            bindings.push({ property, value });
        this.engine.batch([
            ...target.commands,
            {
                type: 'component:update',
                payload: { nodeId: target.nodeId, changes: { styleBindings: bindings } },
            },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Attach or detach a reusable document style class from a logical node. */
    setStyleRuleAttachment(nodeId, ruleId, attached) {
        const target = this.#editableFlowTarget(nodeId);
        const node = findNode(this.engine.doc, target.nodeId);
        if (!node)
            return;
        this.engine.batch([
            ...target.commands,
            {
                type: 'component:update',
                payload: {
                    nodeId: target.nodeId,
                    changes: {
                        styleBindings: updateStyleRuleAttachment(node.styleBindings, ruleId, attached),
                    },
                },
            },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Create a reusable style class and attach it in the same undoable action. */
    createReusableStyleClass(nodeId, name) {
        const target = this.#editableFlowTarget(nodeId);
        const node = findNode(this.engine.doc, target.nodeId);
        if (!node)
            return null;
        const ruleId = createId('class');
        this.engine.batch([
            ...target.commands,
            {
                type: 'style:add-rule',
                payload: { rule: createReusableStyleRule(ruleId, name) },
            },
            {
                type: 'component:update',
                payload: {
                    nodeId: target.nodeId,
                    changes: {
                        styleBindings: updateStyleRuleAttachment(node.styleBindings, ruleId, true),
                    },
                },
            },
        ]);
        this.selectedId = target.nodeId;
        return ruleId;
    }
    /** Read the current value-based style binding for a property. */
    getStyleBinding(nodeId, property) {
        const node = findNode(this.engine.doc, nodeId);
        return node?.styleBindings?.find((b) => b.property === property && b.value !== undefined)?.value;
    }
    removeNode(nodeId) {
        this.engine.execute({ type: 'component:remove', payload: { nodeId } });
        if (this.selectedId === nodeId)
            this.selectedId = null;
        if (this.hoveredId === nodeId)
            this.hoveredId = null;
    }
    duplicateNode(nodeId) {
        this.engine.execute({ type: 'component:duplicate', payload: { nodeId } });
        const original = locateNode(this.engine.doc, nodeId);
        const copy = original?.siblings[original.index + 1];
        if (copy)
            this.selectedId = copy.id;
    }
    /** Move a node one position up/down among its siblings. */
    moveBy(nodeId, delta) {
        const location = locateNode(this.engine.doc, nodeId);
        if (!location)
            return;
        const target = delta === -1 ? location.index - 1 : location.index + 2;
        if (target < 0 || target > location.siblings.length)
            return;
        this.engine.execute({
            type: 'component:move',
            payload: {
                nodeId,
                targetParentId: location.parentId,
                targetSlot: location.slot,
                targetIndex: target,
            },
        });
    }
    // --- Symbols ---
    /** Snapshot a node as a reusable symbol and tag the node as its instance. */
    createSymbolFromNode(nodeId) {
        const node = findNode(this.engine.doc, nodeId);
        if (!node)
            return;
        const definition = cloneNodeDeep(structuredClone(node));
        const label = nodeDisplayLabel(node, this.getDefinition(node.type), 32);
        const symbolId = createId('symbol');
        this.engine.batch([
            {
                type: 'symbol:create',
                payload: { symbol: { id: symbolId, label, definition, overridableProps: [] } },
            },
            { type: 'component:update', payload: { nodeId, changes: { symbolId } } },
        ]);
    }
    /** Insert a fresh symbol instance into a drop target or the active page body. */
    insertSymbolInstance(symbolId, parentId, index, slot) {
        const symbol = this.engine.doc.symbols.find((s) => s.id === symbolId);
        const page = this.activePage;
        const targetParentId = parentId ?? page?.regions.body.id;
        if (!symbol || !targetParentId)
            return null;
        const instance = cloneNodeDeep(structuredClone(symbol.definition));
        instance.symbolId = symbolId;
        this.engine.execute({
            type: 'component:add',
            payload: { parentId: targetParentId, slot, index, node: instance },
        });
        this.selectedId = instance.id;
        return instance;
    }
    detachSymbol(nodeId) {
        this.engine.execute({ type: 'symbol:detach', payload: { nodeId } });
    }
    renameSymbol(symbolId, label) {
        this.engine.execute({ type: 'symbol:rename', payload: { symbolId, label } });
    }
    /** Delete a saved definition while leaving placed instances as independent content. */
    removeSymbol(symbolId) {
        this.engine.execute({ type: 'symbol:remove', payload: { symbolId } });
    }
    copyNode(nodeId) {
        const node = findNode(this.engine.doc, nodeId);
        if (node)
            this.clipboard = structuredClone(node);
    }
    /** Paste the clipboard node next to the selected node (or into the body). */
    pasteClipboard() {
        if (!this.clipboard || !this.activePage)
            return;
        const copy = cloneNodeDeep(this.clipboard);
        const location = this.selectedId ? locateNode(this.engine.doc, this.selectedId) : null;
        const parentId = location?.parentId ?? this.activePage.regions.body.id;
        const index = location ? location.index + 1 : undefined;
        this.engine.execute({
            type: 'component:add',
            payload: { parentId, slot: location?.slot, index, node: copy },
        });
        this.selectedId = copy.id;
    }
    // --- Page operations ---
    addPage() {
        const page = isWebDocument(this.engine.doc)
            ? createWebPage({
                slug: uniqueWebSlug(this.engine.doc.pages, 'page'),
            })
            : createPage({ label: `Page ${this.engine.doc.pages.length + 1}` });
        this.engine.execute({ type: 'page:add', payload: { page } });
        this.activePageIndex = this.engine.doc.pages.length - 1;
    }
    duplicatePage(pageId = this.activePage?.id) {
        const source = this.engine.doc.pages.find((page) => page.id === pageId);
        if (!source)
            return;
        const page = clonePageDeep(source);
        if (isWebDocument(this.engine.doc)) {
            const slug = uniqueWebSlug(this.engine.doc.pages, source.web?.slug || 'page');
            page.label = webPageLabelFromSlug(slug);
            page.web = {
                slug,
                title: page.label,
                description: source.web?.description ?? '',
                className: source.web?.className,
                inlineStyle: source.web?.inlineStyle,
            };
        }
        else {
            page.label = `${source.label} copy`;
        }
        const index = this.engine.doc.pages.findIndex((item) => item.id === source.id) + 1;
        this.engine.execute({ type: 'page:add', payload: { page, index } });
        this.activePageIndex = this.engine.doc.pages.findIndex((item) => item.id === page.id);
    }
    ensureWebChrome(kind) {
        const existing = this.engine.doc.meta.web?.[kind];
        if (existing)
            return existing.id;
        const region = createRegion();
        const web = { ...DEFAULT_WEB_DOCUMENT_SETTINGS, ...(this.engine.doc.meta.web ?? {}) };
        this.engine.execute({
            type: 'document:update',
            payload: { changes: { meta: { ...this.engine.doc.meta, web: { ...web, [kind]: region } } } },
        });
        return region.id;
    }
    promoteSelectionToSiteChrome(kind) {
        const nodeId = this.selectedId;
        if (!nodeId || !isWebDocument(this.engine.doc))
            return false;
        if (!locateNode(this.engine.doc, nodeId))
            return false;
        const parentId = this.ensureWebChrome(kind);
        const index = this.engine.doc.meta.web?.[kind]?.children.length ?? 0;
        this.engine.execute({
            type: 'component:move',
            payload: { nodeId, targetParentId: parentId, targetIndex: index },
        });
        return true;
    }
    removePage(pageId) {
        if (this.engine.doc.pages.length <= 1)
            return;
        this.engine.execute({ type: 'page:remove', payload: { pageId } });
        this.activePageIndex = Math.min(this.activePageIndex, this.engine.doc.pages.length - 1);
    }
    /** Open the Print panel from a Word-like header/footer zone on a sheet. */
    openPrintChrome(position, pageIndex, editing = false) {
        // Without the Print panel there is no UI to leave print-editing mode, so
        // entering it would orphan printEditing and suppress canvas scroll sync.
        if (!this.extensions.panel('print'))
            return;
        this.activePageIndex = pageIndex;
        this.printPreviewPage = pageIndex;
        this.printPosition = position;
        this.printVariant = resolveSectionTemplate(this.engine.doc, position, pageIndex).variant;
        this.printEditing = editing;
        this.openPanel('print');
    }
    updatePrintVariantForPage(position, pageIndex, variant, value) {
        this.engine.batch(planUpdatePrintVariant(this.engine.doc, position, pageIndex, variant, value).commands);
    }
    startPrintSection(pageIndex) {
        this.engine.batch(planStartPrintSection(this.engine.doc, pageIndex).commands);
        this.printVariant = resolveSectionTemplate(this.engine.doc, this.printPosition, pageIndex).variant;
    }
    removePrintSectionBreak(pageIndex) {
        this.engine.batch(planRemovePrintSectionBreak(this.engine.doc, pageIndex).commands);
    }
    setPrintSectionLinked(sectionId, position, linkedToPrevious) {
        this.engine.batch(planSetPrintSectionLinked(this.engine.doc, sectionId, position, linkedToPrevious).commands);
    }
    updatePrintSection(sectionId, changes) {
        this.engine.batch(planUpdatePrintSection(this.engine.doc, sectionId, changes).commands);
    }
    updateParagraphFormatting(nodeId, changes) {
        const target = this.#editableFlowTarget(nodeId);
        const node = findNode(this.engine.doc, target.nodeId);
        const page = this.activePage;
        if (!node || !page)
            return;
        const dimensions = getPageDimensions(page.size, page.orientation);
        const contentWidth = dimensions.width - page.margins.left - page.margins.right;
        const paragraph = normalizeParagraphFormatting({ ...node.paragraph, ...changes }, contentWidth);
        this.engine.batch([
            ...target.commands,
            { type: 'component:update', payload: { nodeId: target.nodeId, changes: { paragraph } } },
        ]);
        this.selectedId = target.nodeId;
    }
    /** Apply one measured auto-pagination step; returns true when the AST changed. */
    applyPageFlow(measurements) {
        const plan = planPageFlow(this.engine.doc, measurements);
        this.blockedFlowPageIds = plan.blockedPageIds;
        if (plan.commands.length === 0)
            return false;
        this.engine.batch(plan.commands);
        this.#reconcileSelection();
        return true;
    }
    /** Set (or clear with '') the page background color via the background region. */
    setPageBackground(pageId, color) {
        const page = this.engine.doc.pages.find((p) => p.id === pageId);
        if (!page)
            return;
        const regions = structuredClone(page.regions);
        const background = regions.background ?? createRegion();
        const style = { ...background.style };
        if (color)
            style.background = color;
        else
            delete style.background;
        regions.background = {
            ...background,
            ...(Object.keys(style).length > 0 ? { style } : { style: undefined }),
        };
        this.engine.execute({ type: 'page:update', payload: { pageId, changes: { regions } } });
    }
    /** Add or remove an optional page region (header/footer/background). */
    toggleRegion(pageId, name) {
        const page = this.engine.doc.pages.find((p) => p.id === pageId);
        if (!page)
            return;
        const regions = structuredClone(page.regions);
        if (regions[name]) {
            delete regions[name];
        }
        else {
            regions[name] = createRegion();
        }
        this.engine.execute({ type: 'page:update', payload: { pageId, changes: { regions } } });
    }
    /** Fit the active page width into the canvas viewport. */
    zoomToFit() {
        const page = this.activePage;
        const surface = this.canvasSurface;
        if (!page || !surface)
            return;
        const contentWidth = isWebDocument(this.doc)
            ? this.doc.meta.web?.viewportWidth ?? 1440
            : mmToPx(getPageDimensions(page.size, page.orientation).width);
        this.zoom = fitZoom(contentWidth, surface.clientWidth, 48, 2);
    }
    // --- History ---
    undo() {
        this.engine.undo();
        this.#reconcileSelection();
    }
    redo() {
        this.engine.redo();
        this.#reconcileSelection();
    }
    #reconcileSelection() {
        if (this.selectedId && !findNode(this.engine.doc, this.selectedId)) {
            this.selectedId = null;
        }
        this.activePageIndex = Math.max(0, Math.min(this.activePageIndex, this.engine.doc.pages.length - 1));
    }
    #editableFlowTarget(nodeId) {
        const node = findNode(this.engine.doc, nodeId);
        if (!node?.flow)
            return { nodeId, commands: [] };
        const collapse = planCollapseFlowGroup(this.engine.doc, node.flow.groupId);
        return { nodeId: collapse.rootId ?? nodeId, commands: collapse.commands };
    }
}
const EDITOR_CONTEXT_KEY = Symbol('exemplara-editor');
export function setEditorContext(editor) {
    return setContext(EDITOR_CONTEXT_KEY, editor);
}
export function getEditorContext() {
    const editor = getContext(EDITOR_CONTEXT_KEY);
    if (!editor) {
        throw new Error('Exemplara editor context not found — is this component inside <Editor>?');
    }
    return editor;
}
