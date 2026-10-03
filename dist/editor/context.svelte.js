import { getContext, setContext } from "svelte";
import { fromStore } from "svelte/store";
import { EditorSession, } from "exemplara-core/editor";
import { EditorExtensionRegistry, } from "./extensions.js";
import { composeEditor, adaptEditorExtension, toCoreComposition, } from "./composition.js";
import { createComponentIconRegistry } from "./icons.js";
/** Thin reactive Svelte facade over a portable Nano Stores session. */
export class EditorContext {
    session;
    composition;
    extensions;
    iconRegistry;
    #values;
    #ownsSession;
    #detach;
    #destroyed = false;
    canvasSurface = $state(null);
    get engine() {
        return this.session.engine;
    }
    get registry() {
        return this.session.registry;
    }
    get renderRuntime() {
        return this.session.renderRuntime;
    }
    get host() {
        return this.session.host;
    }
    get controller() {
        return this.session.controller;
    }
    get stores() {
        return this.session.stores;
    }
    componentIcon(type) {
        return this.iconRegistry.get(type);
    }
    get drag() {
        return this.#values.drag.current;
    }
    constructor(init = {}) {
        const base = init.composition ?? composeEditor();
        this.composition = init.extensions?.length
            ? composeEditor({
                ...base,
                plugins: [
                    ...base.plugins,
                    ...init.extensions.map((extension, i) => adaptEditorExtension(extension, "legacy.context-extension." + (i + 1))),
                ],
            })
            : base;
        this.#ownsSession = !init.session;
        if (init.session?.destroyed)
            throw new Error("Cannot attach a destroyed editor session.");
        if (init.session) {
            const installed = new Set(init.session.composition.plugins.map((p) => p.id));
            const missing = this.composition.plugins.find((p) => p.core && !installed.has(p.id) && !installed.has(p.core.id));
            if (missing)
                throw new Error(`Editor session is missing plugin ${missing.id}; create it with the matching core composition.`);
        }
        this.session =
            init.session ??
                new EditorSession({
                    ...init,
                    extensions: undefined,
                    composition: toCoreComposition(this.composition),
                });
        this.#values = Object.fromEntries(Object.entries(this.session.stores).map(([key, store]) => [
            key,
            fromStore(store),
        ]));
        this.iconRegistry = createComponentIconRegistry(this.composition.inheritLegacyRegistrations);
        try {
            this.extensions = new EditorExtensionRegistry(this.registry, this.composition.plugins.map((p) => p.setup), {
                policy: this.session.composition.policy,
                services: this.session.composition.services,
                renderRuntime: this.renderRuntime,
                iconRegistry: this.iconRegistry,
                core: this.session.extensions,
                extensionIds: this.composition.plugins.map((p) => p.id),
                installedPlugins: init.session
                    ? this.session.composition.plugins.flatMap((p) => { const view = this.composition.plugins.find(v => v.id === p.id); return view?.core ? [p.id, view.core.id] : [p.id]; })
                    : this.composition.plugins.flatMap((p) => p.core ? [p.core.id] : []),
                editor: () => this,
            });
            this.session.extensions.start(this.session);
            if (!this.session.leftTab)
                this.session.leftTab = this.extensions.panelsFor("left")[0]?.id ?? "";
            if (!this.session.rightTab)
                this.session.rightTab = this.extensions.panelsFor("right")[0]?.id ?? "";
        }
        catch (error) {
            if (this.#ownsSession)
                this.session.destroy();
            throw error;
        }
        this.#detach = this.session.registerViewAdapter({
            viewportWidth: () => this.canvasSurface?.clientWidth ?? 0,
            revealNode: (nodeId) => requestAnimationFrame(() => {
                if (this.#destroyed)
                    return;
                this.canvasSurface
                    ?.querySelector('[data-node-id="' + CSS.escape(nodeId) + '"]')
                    ?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "nearest",
                });
            }),
        });
    }
    /** Track portable predicates invoked through the facade inside Svelte reactions. */
    track() {
        for (const store of Object.values(this.#values))
            store.current;
    }
    destroy() {
        if (this.#destroyed)
            return;
        this.#destroyed = true;
        this.#detach();
        this.canvasSurface = null;
        try {
            this.extensions.destroy();
        }
        finally {
            if (this.#ownsSession)
                this.session.destroy();
        }
    }
    get destroyed() {
        this.track();
        return this.session.destroyed;
    }
    get engineRevision() {
        return this.#values.engineState.current.revision;
    }
    get documentEpoch() {
        return this.#values.documentEpoch.current;
    }
    set documentEpoch(value) {
        this.session.documentEpoch = value;
    }
    get registryRevision() {
        return this.#values.registryRevision.current;
    }
    set registryRevision(value) {
        this.session.registryRevision = value;
    }
    get selectedId() {
        return this.#values.selectedId.current;
    }
    set selectedId(value) {
        this.session.selectedId = value;
    }
    get hoveredId() {
        return this.#values.hoveredId.current;
    }
    set hoveredId(value) {
        this.session.hoveredId = value;
    }
    get activePageIndex() {
        return this.#values.activePageIndex.current;
    }
    set activePageIndex(value) {
        this.session.activePageIndex = value;
    }
    get clipboard() {
        return this.#values.clipboard.current;
    }
    set clipboard(value) {
        this.session.clipboard = value;
    }
    get zoom() {
        return this.#values.zoom.current;
    }
    set zoom(value) {
        this.session.zoom = value;
    }
    get editingId() {
        return this.#values.editingId.current;
    }
    set editingId(value) {
        this.session.editingId = value;
    }
    get leftTab() {
        return this.#values.leftTab.current;
    }
    set leftTab(value) {
        this.session.leftTab = value;
    }
    get rightTab() {
        return this.#values.rightTab.current;
    }
    set rightTab(value) {
        this.session.rightTab = value;
    }
    get leftPanelCompact() {
        return this.#values.leftPanelCompact.current;
    }
    set leftPanelCompact(value) {
        this.session.leftPanelCompact = value;
    }
    get rightPanelCompact() {
        return this.#values.rightPanelCompact.current;
    }
    set rightPanelCompact(value) {
        this.session.rightPanelCompact = value;
    }
    get printPosition() {
        return this.#values.printPosition.current;
    }
    set printPosition(value) {
        this.session.printPosition = value;
    }
    get printVariant() {
        return this.#values.printVariant.current;
    }
    set printVariant(value) {
        this.session.printVariant = value;
    }
    get printPreviewPage() {
        return this.#values.printPreviewPage.current;
    }
    set printPreviewPage(value) {
        this.session.printPreviewPage = value;
    }
    get printEditing() {
        return this.#values.printEditing.current;
    }
    set printEditing(value) {
        this.session.printEditing = value;
    }
    get blockedFlowPageIds() {
        return this.#values.blockedFlowPageIds.current;
    }
    set blockedFlowPageIds(value) {
        this.session.blockedFlowPageIds = value;
    }
    get previewOpen() {
        return this.#values.previewOpen.current;
    }
    set previewOpen(value) {
        this.session.previewOpen = value;
    }
    get dataWorkspaceOpen() {
        return this.#values.dataWorkspaceOpen.current;
    }
    set dataWorkspaceOpen(value) {
        this.session.dataWorkspaceOpen = value;
    }
    get contextMenu() {
        return this.#values.contextMenu.current;
    }
    set contextMenu(value) {
        this.session.contextMenu = value;
    }
    get layerRevealRevision() {
        return this.#values.layerRevealRevision.current;
    }
    set layerRevealRevision(value) {
        this.session.layerRevealRevision = value;
    }
    get dark() {
        return this.#values.dark.current;
    }
    set dark(value) {
        this.session.dark = value;
    }
    get dataPreviewEnabled() {
        return this.#values.dataPreviewEnabled.current;
    }
    set dataPreviewEnabled(value) {
        this.session.dataPreviewEnabled = value;
    }
    get hostThemeRevision() {
        return this.#values.hostThemeRevision.current;
    }
    set hostThemeRevision(value) {
        this.session.hostThemeRevision = value;
    }
    get historicalPreviewDocument() {
        return this.#values.historicalPreviewDocument.current;
    }
    set historicalPreviewDocument(value) {
        this.session.historicalPreviewDocument = value;
    }
    get historicalPreviewVersionId() {
        return this.#values.historicalPreviewVersionId.current;
    }
    set historicalPreviewVersionId(value) {
        this.session.historicalPreviewVersionId = value;
    }
    get hostStatus() {
        return this.#values.hostStatus.current;
    }
    set hostStatus(value) {
        this.session.hostStatus = value;
    }
    get doc() {
        return this.#values.doc.current;
    }
    get canUndo() {
        return this.#values.canUndo.current;
    }
    get canRedo() {
        return this.#values.canRedo.current;
    }
    get historicalPreviewActive() {
        return this.#values.historicalPreviewActive.current;
    }
    get isPrintTabActive() {
        return this.#values.isPrintTabActive.current;
    }
    get effectivePrintPreviewPage() {
        return this.#values.effectivePrintPreviewPage.current;
    }
    get activePage() {
        return this.#values.activePage.current;
    }
    get selectedNode() {
        return this.#values.selectedNode.current;
    }
    get selectedDefinition() {
        return this.#values.selectedDefinition.current;
    }
    get registryCategories() {
        return this.#values.registryCategories.current;
    }
    get capabilityDiagnostics() {
        return this.#values.capabilityDiagnostics.current;
    }
    snapshot(...args) {
        this.track();
        return this.session.snapshot(...args);
    }
    setActivePage(...args) {
        this.track();
        return this.session.setActivePage(...args);
    }
    setZoom(...args) {
        this.track();
        return this.session.setZoom(...args);
    }
    setDrag(...args) {
        this.track();
        return this.session.setDrag(...args);
    }
    applyDragPayload(...args) {
        this.track();
        return this.session.applyDragPayload(...args);
    }
    getDefinition(...args) {
        this.track();
        return this.session.getDefinition(...args);
    }
    get expressionRuntime() {
        this.track();
        return this.session.expressionRuntime;
    }
    hasPlugin(...args) {
        this.track();
        return this.session.hasPlugin(...args);
    }
    isProvidedCapabilityEnabled(...args) {
        this.track();
        return this.session.isProvidedCapabilityEnabled(...args);
    }
    autocompleteSuggestions(...args) {
        this.track();
        return this.session.autocompleteSuggestions(...args);
    }
    setHostStatus(...args) {
        this.track();
        return this.session.setHostStatus(...args);
    }
    replaceDocument(...args) {
        this.track();
        return this.session.replaceDocument(...args);
    }
    previewHistoricalDocument(...args) {
        this.track();
        return this.session.previewHistoricalDocument(...args);
    }
    clearHistoricalPreview(...args) {
        this.track();
        return this.session.clearHistoricalPreview(...args);
    }
    isDarkChrome(...args) {
        this.track();
        return this.session.isDarkChrome(...args);
    }
    toggleChromeTheme(...args) {
        this.track();
        return this.session.toggleChromeTheme(...args);
    }
    openPanel(...args) {
        this.track();
        return this.session.openPanel(...args);
    }
    isPanelCompact(...args) {
        this.track();
        return this.session.isPanelCompact(...args);
    }
    setPanelCompact(...args) {
        this.track();
        return this.session.setPanelCompact(...args);
    }
    togglePanelCompact(...args) {
        this.track();
        return this.session.togglePanelCompact(...args);
    }
    openDataWorkspace(...args) {
        this.track();
        return this.session.openDataWorkspace(...args);
    }
    closeDataWorkspace(...args) {
        this.track();
        return this.session.closeDataWorkspace(...args);
    }
    setAutoFlow(...args) {
        this.track();
        return this.session.setAutoFlow(...args);
    }
    toggleAutoFlow(...args) {
        this.track();
        return this.session.toggleAutoFlow(...args);
    }
    canRunCommand(...args) {
        this.track();
        return this.session.canRunCommand(...args);
    }
    runCommand(...args) {
        this.track();
        return this.session.runCommand(...args);
    }
    canRunExtensionCommand(...args) {
        this.track();
        return this.session.canRunExtensionCommand(...args);
    }
    runExtensionCommand(...args) {
        this.track();
        return this.session.runExtensionCommand(...args);
    }
    saveToHost(...args) {
        this.track();
        return this.session.saveToHost(...args);
    }
    select(...args) {
        this.track();
        return this.session.select(...args);
    }
    selectAndRevealNode(...args) {
        this.track();
        return this.session.selectAndRevealNode(...args);
    }
    selectParent(...args) {
        this.track();
        return this.session.selectParent(...args);
    }
    revealInLayers(...args) {
        this.track();
        return this.session.revealInLayers(...args);
    }
    openContextMenu(...args) {
        this.track();
        return this.session.openContextMenu(...args);
    }
    closeContextMenu(...args) {
        this.track();
        return this.session.closeContextMenu(...args);
    }
    setDataPreview(...args) {
        this.track();
        return this.session.setDataPreview(...args);
    }
    getDataContext(...args) {
        this.track();
        return this.session.getDataContext(...args);
    }
    addComponent(...args) {
        this.track();
        return this.session.addComponent(...args);
    }
    addBlock(...args) {
        this.track();
        return this.session.addBlock(...args);
    }
    insertAssetImage(...args) {
        this.track();
        return this.session.insertAssetImage(...args);
    }
    applyAssetToImage(...args) {
        this.track();
        return this.session.applyAssetToImage(...args);
    }
    registerInlineExpressionTarget(...args) {
        this.track();
        return this.session.registerInlineExpressionTarget(...args);
    }
    insertExpression(...args) {
        this.track();
        return this.session.insertExpression(...args);
    }
    moveNode(...args) {
        this.track();
        return this.session.moveNode(...args);
    }
    updateProps(...args) {
        this.track();
        return this.session.updateProps(...args);
    }
    commitRichTextAuthoring(...args) {
        this.track();
        return this.session.commitRichTextAuthoring(...args);
    }
    commitPropAuthoring(...args) {
        this.track();
        return this.session.commitPropAuthoring(...args);
    }
    updatePaginationRules(...args) {
        this.track();
        return this.session.updatePaginationRules(...args);
    }
    beginRichTextEdit(...args) {
        this.track();
        return this.session.beginRichTextEdit(...args);
    }
    setStyleBinding(...args) {
        this.track();
        return this.session.setStyleBinding(...args);
    }
    setStyleRuleAttachment(...args) {
        this.track();
        return this.session.setStyleRuleAttachment(...args);
    }
    createReusableStyleClass(...args) {
        this.track();
        return this.session.createReusableStyleClass(...args);
    }
    getStyleBinding(...args) {
        this.track();
        return this.session.getStyleBinding(...args);
    }
    removeNode(...args) {
        this.track();
        return this.session.removeNode(...args);
    }
    duplicateNode(...args) {
        this.track();
        return this.session.duplicateNode(...args);
    }
    moveBy(...args) {
        this.track();
        return this.session.moveBy(...args);
    }
    createSymbolFromNode(...args) {
        this.track();
        return this.session.createSymbolFromNode(...args);
    }
    insertSymbolInstance(...args) {
        this.track();
        return this.session.insertSymbolInstance(...args);
    }
    detachSymbol(...args) {
        this.track();
        return this.session.detachSymbol(...args);
    }
    renameSymbol(...args) {
        this.track();
        return this.session.renameSymbol(...args);
    }
    removeSymbol(...args) {
        this.track();
        return this.session.removeSymbol(...args);
    }
    copyNode(...args) {
        this.track();
        return this.session.copyNode(...args);
    }
    pasteClipboard(...args) {
        this.track();
        return this.session.pasteClipboard(...args);
    }
    addPage(...args) {
        this.track();
        return this.session.addPage(...args);
    }
    duplicatePage(...args) {
        this.track();
        return this.session.duplicatePage(...args);
    }
    ensureWebChrome(...args) {
        this.track();
        return this.session.ensureWebChrome(...args);
    }
    promoteSelectionToSiteChrome(...args) {
        this.track();
        return this.session.promoteSelectionToSiteChrome(...args);
    }
    removePage(...args) {
        this.track();
        return this.session.removePage(...args);
    }
    openPrintChrome(...args) {
        this.track();
        return this.session.openPrintChrome(...args);
    }
    updatePrintVariantForPage(...args) {
        this.track();
        return this.session.updatePrintVariantForPage(...args);
    }
    startPrintSection(...args) {
        this.track();
        return this.session.startPrintSection(...args);
    }
    removePrintSectionBreak(...args) {
        this.track();
        return this.session.removePrintSectionBreak(...args);
    }
    setPrintSectionLinked(...args) {
        this.track();
        return this.session.setPrintSectionLinked(...args);
    }
    updatePrintSection(...args) {
        this.track();
        return this.session.updatePrintSection(...args);
    }
    updateParagraphFormatting(...args) {
        this.track();
        return this.session.updateParagraphFormatting(...args);
    }
    applyPageFlow(...args) {
        this.track();
        return this.session.applyPageFlow(...args);
    }
    setPageBackground(...args) {
        this.track();
        return this.session.setPageBackground(...args);
    }
    toggleRegion(...args) {
        this.track();
        return this.session.toggleRegion(...args);
    }
    zoomToFit(...args) {
        this.track();
        return this.session.zoomToFit(...args);
    }
    undo(...args) {
        this.track();
        return this.session.undo(...args);
    }
    redo(...args) {
        this.track();
        return this.session.redo(...args);
    }
}
// A stable key keeps barrel and leaf imports connected when Vite reloads a linked package.
// Each Svelte component tree still owns its context value.
const EDITOR_CONTEXT = Symbol.for("exemplara.editor.context");
export function setEditorContext(editor) {
    setContext(EDITOR_CONTEXT, editor);
    return editor;
}
export function getEditorContext() {
    const editor = getContext(EDITOR_CONTEXT);
    if (!editor)
        throw new Error('Exemplara editor context not found — is this component inside <Editor>?');
    return editor;
}
