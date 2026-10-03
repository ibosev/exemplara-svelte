import { getContext, setContext } from "svelte";
import type { Readable } from "svelte/store";
import { fromStore } from "svelte/store";
import {
  EditorSession,
  type EditorSessionOptions,
} from "exemplara-core/editor";
import {
  EditorExtensionRegistry,
  type EditorExtension,
  type EditorHostConfig,
} from "./extensions.js";
import {
  composeEditor,
  adaptEditorExtension,
  toCoreComposition,
  type EditorComposition,
} from "./composition.js";
import { createComponentIconRegistry, type ComponentIcon } from "./icons.js";
export type {
  LeftTab,
  RightTab,
  ContextMenuState,
} from "exemplara-core/editor";

export interface EditorInit
  extends Omit<EditorSessionOptions, "composition" | "extensions"> {
  composition?: EditorComposition;
  extensions?: readonly EditorExtension[];
  /** Externally owned sessions survive view detach. Composition supplies their Svelte views. */
  session?: EditorSession;
  host?: EditorHostConfig;
}
type StoreViews = {
  [K in keyof EditorSession["stores"]]: {
    readonly current: ReturnType<EditorSession["stores"][K]["get"]>;
  };
};

/** Thin reactive Svelte facade over a portable Nano Stores session. */
export class EditorContext {
  readonly session: EditorSession;
  readonly composition: EditorComposition;
  readonly extensions: EditorExtensionRegistry;
  readonly iconRegistry;
  readonly #values: StoreViews;
  readonly #ownsSession: boolean;
  readonly #detach: () => void;
  #destroyed = false;
  canvasSurface: HTMLElement | null = $state(null);
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
  get stores(): EditorSession["stores"] {
    return this.session.stores;
  }
  componentIcon(type: string): ComponentIcon | null {
    return this.iconRegistry.get(type);
  }
  get drag(): ReturnType<EditorSession["stores"]["drag"]["get"]> {
    return this.#values.drag.current;
  }

  constructor(init: EditorInit = {}) {
    const base = init.composition ?? composeEditor();
    this.composition = init.extensions?.length
      ? composeEditor({
          ...base,
          plugins: [
            ...base.plugins,
            ...init.extensions.map((extension, i) =>
              adaptEditorExtension(
                extension,
                "legacy.context-extension." + (i + 1),
              ),
            ),
          ],
        })
      : base;
    this.#ownsSession = !init.session;
    if (init.session?.destroyed)
      throw new Error("Cannot attach a destroyed editor session.");
    if (init.session) {
      const installed = new Set(init.session.composition.plugins.map((p) => p.id));
      const missing = this.composition.plugins.find(
        (p) => p.core && !installed.has(p.id) && !installed.has(p.core.id),
      );
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
    this.#values = Object.fromEntries(
      Object.entries(this.session.stores).map(([key, store]) => [
        key,
        fromStore(store as Readable<unknown>),
      ]),
    ) as StoreViews;
    this.iconRegistry = createComponentIconRegistry(
      this.composition.inheritLegacyRegistrations,
    );
    try {
      this.extensions = new EditorExtensionRegistry(
        this.registry,
        this.composition.plugins.map((p) => p.setup),
        {
          policy: this.session.composition.policy,
          services: this.session.composition.services,
          renderRuntime: this.renderRuntime,
          iconRegistry: this.iconRegistry,
          core: this.session.extensions,
          extensionIds: this.composition.plugins.map((p) => p.id),
          installedPlugins: init.session
            ? this.session.composition.plugins.flatMap((p) => { const view = this.composition.plugins.find(v => v.id === p.id); return view?.core ? [p.id, view.core.id] : [p.id]; })
            : this.composition.plugins.flatMap((p) =>
                p.core ? [p.core.id] : [],
              ),
          editor: () => this,
        },
      );
      this.session.extensions.start(this.session);
      if (!this.session.leftTab)
        this.session.leftTab = this.extensions.panelsFor("left")[0]?.id ?? "";
      if (!this.session.rightTab)
        this.session.rightTab = this.extensions.panelsFor("right")[0]?.id ?? "";
    } catch (error) {
      if (this.#ownsSession) this.session.destroy();
      throw error;
    }
    this.#detach = this.session.registerViewAdapter({
      viewportWidth: () => this.canvasSurface?.clientWidth ?? 0,
      revealNode: (nodeId) =>
        requestAnimationFrame(() => {
          if (this.#destroyed) return;
          this.canvasSurface
            ?.querySelector<HTMLElement>(
              '[data-node-id="' + CSS.escape(nodeId) + '"]',
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "nearest",
            });
        }),
    });
  }
  /** Track portable predicates invoked through the facade inside Svelte reactions. */
  track(): void {
    for (const store of Object.values(this.#values)) store.current;
  }
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#detach();
    this.canvasSurface = null;
    try {
      this.extensions.destroy();
    } finally {
      if (this.#ownsSession) this.session.destroy();
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
  set documentEpoch(value: EditorSession["documentEpoch"]) {
    this.session.documentEpoch = value;
  }
  get registryRevision() {
    return this.#values.registryRevision.current;
  }
  set registryRevision(value: EditorSession["registryRevision"]) {
    this.session.registryRevision = value;
  }
  get selectedId() {
    return this.#values.selectedId.current;
  }
  set selectedId(value: EditorSession["selectedId"]) {
    this.session.selectedId = value;
  }
  get hoveredId() {
    return this.#values.hoveredId.current;
  }
  set hoveredId(value: EditorSession["hoveredId"]) {
    this.session.hoveredId = value;
  }
  get activePageIndex() {
    return this.#values.activePageIndex.current;
  }
  set activePageIndex(value: EditorSession["activePageIndex"]) {
    this.session.activePageIndex = value;
  }
  get clipboard() {
    return this.#values.clipboard.current;
  }
  set clipboard(value: EditorSession["clipboard"]) {
    this.session.clipboard = value;
  }
  get zoom() {
    return this.#values.zoom.current;
  }
  set zoom(value: EditorSession["zoom"]) {
    this.session.zoom = value;
  }
  get editingId() {
    return this.#values.editingId.current;
  }
  set editingId(value: EditorSession["editingId"]) {
    this.session.editingId = value;
  }
  get leftTab() {
    return this.#values.leftTab.current;
  }
  set leftTab(value: EditorSession["leftTab"]) {
    this.session.leftTab = value;
  }
  get rightTab() {
    return this.#values.rightTab.current;
  }
  set rightTab(value: EditorSession["rightTab"]) {
    this.session.rightTab = value;
  }
  get leftPanelCompact() {
    return this.#values.leftPanelCompact.current;
  }
  set leftPanelCompact(value: EditorSession["leftPanelCompact"]) {
    this.session.leftPanelCompact = value;
  }
  get rightPanelCompact() {
    return this.#values.rightPanelCompact.current;
  }
  set rightPanelCompact(value: EditorSession["rightPanelCompact"]) {
    this.session.rightPanelCompact = value;
  }
  get printPosition() {
    return this.#values.printPosition.current;
  }
  set printPosition(value: EditorSession["printPosition"]) {
    this.session.printPosition = value;
  }
  get printVariant() {
    return this.#values.printVariant.current;
  }
  set printVariant(value: EditorSession["printVariant"]) {
    this.session.printVariant = value;
  }
  get printPreviewPage() {
    return this.#values.printPreviewPage.current;
  }
  set printPreviewPage(value: EditorSession["printPreviewPage"]) {
    this.session.printPreviewPage = value;
  }
  get printEditing() {
    return this.#values.printEditing.current;
  }
  set printEditing(value: EditorSession["printEditing"]) {
    this.session.printEditing = value;
  }
  get blockedFlowPageIds() {
    return this.#values.blockedFlowPageIds.current;
  }
  set blockedFlowPageIds(value: EditorSession["blockedFlowPageIds"]) {
    this.session.blockedFlowPageIds = value;
  }
  get previewOpen() {
    return this.#values.previewOpen.current;
  }
  set previewOpen(value: EditorSession["previewOpen"]) {
    this.session.previewOpen = value;
  }
  get dataWorkspaceOpen() {
    return this.#values.dataWorkspaceOpen.current;
  }
  set dataWorkspaceOpen(value: EditorSession["dataWorkspaceOpen"]) {
    this.session.dataWorkspaceOpen = value;
  }
  get contextMenu() {
    return this.#values.contextMenu.current;
  }
  set contextMenu(value: EditorSession["contextMenu"]) {
    this.session.contextMenu = value;
  }
  get layerRevealRevision() {
    return this.#values.layerRevealRevision.current;
  }
  set layerRevealRevision(value: EditorSession["layerRevealRevision"]) {
    this.session.layerRevealRevision = value;
  }
  get dark() {
    return this.#values.dark.current;
  }
  set dark(value: EditorSession["dark"]) {
    this.session.dark = value;
  }
  get dataPreviewEnabled() {
    return this.#values.dataPreviewEnabled.current;
  }
  set dataPreviewEnabled(value: EditorSession["dataPreviewEnabled"]) {
    this.session.dataPreviewEnabled = value;
  }
  get hostThemeRevision() {
    return this.#values.hostThemeRevision.current;
  }
  set hostThemeRevision(value: EditorSession["hostThemeRevision"]) {
    this.session.hostThemeRevision = value;
  }
  get historicalPreviewDocument() {
    return this.#values.historicalPreviewDocument.current;
  }
  set historicalPreviewDocument(
    value: EditorSession["historicalPreviewDocument"],
  ) {
    this.session.historicalPreviewDocument = value;
  }
  get historicalPreviewVersionId() {
    return this.#values.historicalPreviewVersionId.current;
  }
  set historicalPreviewVersionId(
    value: EditorSession["historicalPreviewVersionId"],
  ) {
    this.session.historicalPreviewVersionId = value;
  }
  get hostStatus() {
    return this.#values.hostStatus.current;
  }
  set hostStatus(value: EditorSession["hostStatus"]) {
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
  snapshot(
    ...args: Parameters<EditorSession["snapshot"]>
  ): ReturnType<EditorSession["snapshot"]> {
    this.track();
    return this.session.snapshot(...args);
  }
  setActivePage(
    ...args: Parameters<EditorSession["setActivePage"]>
  ): ReturnType<EditorSession["setActivePage"]> {
    this.track();
    return this.session.setActivePage(...args);
  }
  setZoom(
    ...args: Parameters<EditorSession["setZoom"]>
  ): ReturnType<EditorSession["setZoom"]> {
    this.track();
    return this.session.setZoom(...args);
  }
  setDrag(
    ...args: Parameters<EditorSession["setDrag"]>
  ): ReturnType<EditorSession["setDrag"]> {
    this.track();
    return this.session.setDrag(...args);
  }
  applyDragPayload(
    ...args: Parameters<EditorSession["applyDragPayload"]>
  ): ReturnType<EditorSession["applyDragPayload"]> {
    this.track();
    return this.session.applyDragPayload(...args);
  }
  getDefinition(
    ...args: Parameters<EditorSession["getDefinition"]>
  ): ReturnType<EditorSession["getDefinition"]> {
    this.track();
    return this.session.getDefinition(...args);
  }
  get expressionRuntime() {
    this.track();
    return this.session.expressionRuntime;
  }
  hasPlugin(
    ...args: Parameters<EditorSession["hasPlugin"]>
  ): ReturnType<EditorSession["hasPlugin"]> {
    this.track();
    return this.session.hasPlugin(...args);
  }
  isProvidedCapabilityEnabled(
    ...args: Parameters<EditorSession["isProvidedCapabilityEnabled"]>
  ): ReturnType<EditorSession["isProvidedCapabilityEnabled"]> {
    this.track();
    return this.session.isProvidedCapabilityEnabled(...args);
  }
  autocompleteSuggestions(
    ...args: Parameters<EditorSession["autocompleteSuggestions"]>
  ): ReturnType<EditorSession["autocompleteSuggestions"]> {
    this.track();
    return this.session.autocompleteSuggestions(...args);
  }
  setHostStatus(
    ...args: Parameters<EditorSession["setHostStatus"]>
  ): ReturnType<EditorSession["setHostStatus"]> {
    this.track();
    return this.session.setHostStatus(...args);
  }
  replaceDocument(
    ...args: Parameters<EditorSession["replaceDocument"]>
  ): ReturnType<EditorSession["replaceDocument"]> {
    this.track();
    return this.session.replaceDocument(...args);
  }
  previewHistoricalDocument(
    ...args: Parameters<EditorSession["previewHistoricalDocument"]>
  ): ReturnType<EditorSession["previewHistoricalDocument"]> {
    this.track();
    return this.session.previewHistoricalDocument(...args);
  }
  clearHistoricalPreview(
    ...args: Parameters<EditorSession["clearHistoricalPreview"]>
  ): ReturnType<EditorSession["clearHistoricalPreview"]> {
    this.track();
    return this.session.clearHistoricalPreview(...args);
  }
  isDarkChrome(
    ...args: Parameters<EditorSession["isDarkChrome"]>
  ): ReturnType<EditorSession["isDarkChrome"]> {
    this.track();
    return this.session.isDarkChrome(...args);
  }
  toggleChromeTheme(
    ...args: Parameters<EditorSession["toggleChromeTheme"]>
  ): ReturnType<EditorSession["toggleChromeTheme"]> {
    this.track();
    return this.session.toggleChromeTheme(...args);
  }
  openPanel(
    ...args: Parameters<EditorSession["openPanel"]>
  ): ReturnType<EditorSession["openPanel"]> {
    this.track();
    return this.session.openPanel(...args);
  }
  isPanelCompact(
    ...args: Parameters<EditorSession["isPanelCompact"]>
  ): ReturnType<EditorSession["isPanelCompact"]> {
    this.track();
    return this.session.isPanelCompact(...args);
  }
  setPanelCompact(
    ...args: Parameters<EditorSession["setPanelCompact"]>
  ): ReturnType<EditorSession["setPanelCompact"]> {
    this.track();
    return this.session.setPanelCompact(...args);
  }
  togglePanelCompact(
    ...args: Parameters<EditorSession["togglePanelCompact"]>
  ): ReturnType<EditorSession["togglePanelCompact"]> {
    this.track();
    return this.session.togglePanelCompact(...args);
  }
  openDataWorkspace(
    ...args: Parameters<EditorSession["openDataWorkspace"]>
  ): ReturnType<EditorSession["openDataWorkspace"]> {
    this.track();
    return this.session.openDataWorkspace(...args);
  }
  closeDataWorkspace(
    ...args: Parameters<EditorSession["closeDataWorkspace"]>
  ): ReturnType<EditorSession["closeDataWorkspace"]> {
    this.track();
    return this.session.closeDataWorkspace(...args);
  }
  setAutoFlow(
    ...args: Parameters<EditorSession["setAutoFlow"]>
  ): ReturnType<EditorSession["setAutoFlow"]> {
    this.track();
    return this.session.setAutoFlow(...args);
  }
  toggleAutoFlow(
    ...args: Parameters<EditorSession["toggleAutoFlow"]>
  ): ReturnType<EditorSession["toggleAutoFlow"]> {
    this.track();
    return this.session.toggleAutoFlow(...args);
  }
  canRunCommand(
    ...args: Parameters<EditorSession["canRunCommand"]>
  ): ReturnType<EditorSession["canRunCommand"]> {
    this.track();
    return this.session.canRunCommand(...args);
  }
  runCommand(
    ...args: Parameters<EditorSession["runCommand"]>
  ): ReturnType<EditorSession["runCommand"]> {
    this.track();
    return this.session.runCommand(...args);
  }
  canRunExtensionCommand(
    ...args: Parameters<EditorSession["canRunExtensionCommand"]>
  ): ReturnType<EditorSession["canRunExtensionCommand"]> {
    this.track();
    return this.session.canRunExtensionCommand(...args);
  }
  runExtensionCommand(
    ...args: Parameters<EditorSession["runExtensionCommand"]>
  ): ReturnType<EditorSession["runExtensionCommand"]> {
    this.track();
    return this.session.runExtensionCommand(...args);
  }
  saveToHost(
    ...args: Parameters<EditorSession["saveToHost"]>
  ): ReturnType<EditorSession["saveToHost"]> {
    this.track();
    return this.session.saveToHost(...args);
  }
  select(
    ...args: Parameters<EditorSession["select"]>
  ): ReturnType<EditorSession["select"]> {
    this.track();
    return this.session.select(...args);
  }
  selectAndRevealNode(
    ...args: Parameters<EditorSession["selectAndRevealNode"]>
  ): ReturnType<EditorSession["selectAndRevealNode"]> {
    this.track();
    return this.session.selectAndRevealNode(...args);
  }
  selectParent(
    ...args: Parameters<EditorSession["selectParent"]>
  ): ReturnType<EditorSession["selectParent"]> {
    this.track();
    return this.session.selectParent(...args);
  }
  revealInLayers(
    ...args: Parameters<EditorSession["revealInLayers"]>
  ): ReturnType<EditorSession["revealInLayers"]> {
    this.track();
    return this.session.revealInLayers(...args);
  }
  openContextMenu(
    ...args: Parameters<EditorSession["openContextMenu"]>
  ): ReturnType<EditorSession["openContextMenu"]> {
    this.track();
    return this.session.openContextMenu(...args);
  }
  closeContextMenu(
    ...args: Parameters<EditorSession["closeContextMenu"]>
  ): ReturnType<EditorSession["closeContextMenu"]> {
    this.track();
    return this.session.closeContextMenu(...args);
  }
  setDataPreview(
    ...args: Parameters<EditorSession["setDataPreview"]>
  ): ReturnType<EditorSession["setDataPreview"]> {
    this.track();
    return this.session.setDataPreview(...args);
  }
  getDataContext(
    ...args: Parameters<EditorSession["getDataContext"]>
  ): ReturnType<EditorSession["getDataContext"]> {
    this.track();
    return this.session.getDataContext(...args);
  }
  addComponent(
    ...args: Parameters<EditorSession["addComponent"]>
  ): ReturnType<EditorSession["addComponent"]> {
    this.track();
    return this.session.addComponent(...args);
  }
  addBlock(
    ...args: Parameters<EditorSession["addBlock"]>
  ): ReturnType<EditorSession["addBlock"]> {
    this.track();
    return this.session.addBlock(...args);
  }
  insertAssetImage(
    ...args: Parameters<EditorSession["insertAssetImage"]>
  ): ReturnType<EditorSession["insertAssetImage"]> {
    this.track();
    return this.session.insertAssetImage(...args);
  }
  applyAssetToImage(
    ...args: Parameters<EditorSession["applyAssetToImage"]>
  ): ReturnType<EditorSession["applyAssetToImage"]> {
    this.track();
    return this.session.applyAssetToImage(...args);
  }
  registerInlineExpressionTarget(
    ...args: Parameters<EditorSession["registerInlineExpressionTarget"]>
  ): ReturnType<EditorSession["registerInlineExpressionTarget"]> {
    this.track();
    return this.session.registerInlineExpressionTarget(...args);
  }
  insertExpression(
    ...args: Parameters<EditorSession["insertExpression"]>
  ): ReturnType<EditorSession["insertExpression"]> {
    this.track();
    return this.session.insertExpression(...args);
  }
  moveNode(
    ...args: Parameters<EditorSession["moveNode"]>
  ): ReturnType<EditorSession["moveNode"]> {
    this.track();
    return this.session.moveNode(...args);
  }
  updateProps(
    ...args: Parameters<EditorSession["updateProps"]>
  ): ReturnType<EditorSession["updateProps"]> {
    this.track();
    return this.session.updateProps(...args);
  }
  commitRichTextAuthoring(
    ...args: Parameters<EditorSession["commitRichTextAuthoring"]>
  ): ReturnType<EditorSession["commitRichTextAuthoring"]> {
    this.track();
    return this.session.commitRichTextAuthoring(...args);
  }
  commitPropAuthoring(
    ...args: Parameters<EditorSession["commitPropAuthoring"]>
  ): ReturnType<EditorSession["commitPropAuthoring"]> {
    this.track();
    return this.session.commitPropAuthoring(...args);
  }
  updatePaginationRules(
    ...args: Parameters<EditorSession["updatePaginationRules"]>
  ): ReturnType<EditorSession["updatePaginationRules"]> {
    this.track();
    return this.session.updatePaginationRules(...args);
  }
  beginRichTextEdit(
    ...args: Parameters<EditorSession["beginRichTextEdit"]>
  ): ReturnType<EditorSession["beginRichTextEdit"]> {
    this.track();
    return this.session.beginRichTextEdit(...args);
  }
  setStyleBinding(
    ...args: Parameters<EditorSession["setStyleBinding"]>
  ): ReturnType<EditorSession["setStyleBinding"]> {
    this.track();
    return this.session.setStyleBinding(...args);
  }
  setStyleRuleAttachment(
    ...args: Parameters<EditorSession["setStyleRuleAttachment"]>
  ): ReturnType<EditorSession["setStyleRuleAttachment"]> {
    this.track();
    return this.session.setStyleRuleAttachment(...args);
  }
  createReusableStyleClass(
    ...args: Parameters<EditorSession["createReusableStyleClass"]>
  ): ReturnType<EditorSession["createReusableStyleClass"]> {
    this.track();
    return this.session.createReusableStyleClass(...args);
  }
  getStyleBinding(
    ...args: Parameters<EditorSession["getStyleBinding"]>
  ): ReturnType<EditorSession["getStyleBinding"]> {
    this.track();
    return this.session.getStyleBinding(...args);
  }
  removeNode(
    ...args: Parameters<EditorSession["removeNode"]>
  ): ReturnType<EditorSession["removeNode"]> {
    this.track();
    return this.session.removeNode(...args);
  }
  duplicateNode(
    ...args: Parameters<EditorSession["duplicateNode"]>
  ): ReturnType<EditorSession["duplicateNode"]> {
    this.track();
    return this.session.duplicateNode(...args);
  }
  moveBy(
    ...args: Parameters<EditorSession["moveBy"]>
  ): ReturnType<EditorSession["moveBy"]> {
    this.track();
    return this.session.moveBy(...args);
  }
  createSymbolFromNode(
    ...args: Parameters<EditorSession["createSymbolFromNode"]>
  ): ReturnType<EditorSession["createSymbolFromNode"]> {
    this.track();
    return this.session.createSymbolFromNode(...args);
  }
  insertSymbolInstance(
    ...args: Parameters<EditorSession["insertSymbolInstance"]>
  ): ReturnType<EditorSession["insertSymbolInstance"]> {
    this.track();
    return this.session.insertSymbolInstance(...args);
  }
  detachSymbol(
    ...args: Parameters<EditorSession["detachSymbol"]>
  ): ReturnType<EditorSession["detachSymbol"]> {
    this.track();
    return this.session.detachSymbol(...args);
  }
  renameSymbol(
    ...args: Parameters<EditorSession["renameSymbol"]>
  ): ReturnType<EditorSession["renameSymbol"]> {
    this.track();
    return this.session.renameSymbol(...args);
  }
  removeSymbol(
    ...args: Parameters<EditorSession["removeSymbol"]>
  ): ReturnType<EditorSession["removeSymbol"]> {
    this.track();
    return this.session.removeSymbol(...args);
  }
  copyNode(
    ...args: Parameters<EditorSession["copyNode"]>
  ): ReturnType<EditorSession["copyNode"]> {
    this.track();
    return this.session.copyNode(...args);
  }
  pasteClipboard(
    ...args: Parameters<EditorSession["pasteClipboard"]>
  ): ReturnType<EditorSession["pasteClipboard"]> {
    this.track();
    return this.session.pasteClipboard(...args);
  }
  addPage(
    ...args: Parameters<EditorSession["addPage"]>
  ): ReturnType<EditorSession["addPage"]> {
    this.track();
    return this.session.addPage(...args);
  }
  duplicatePage(
    ...args: Parameters<EditorSession["duplicatePage"]>
  ): ReturnType<EditorSession["duplicatePage"]> {
    this.track();
    return this.session.duplicatePage(...args);
  }
  ensureWebChrome(
    ...args: Parameters<EditorSession["ensureWebChrome"]>
  ): ReturnType<EditorSession["ensureWebChrome"]> {
    this.track();
    return this.session.ensureWebChrome(...args);
  }
  promoteSelectionToSiteChrome(
    ...args: Parameters<EditorSession["promoteSelectionToSiteChrome"]>
  ): ReturnType<EditorSession["promoteSelectionToSiteChrome"]> {
    this.track();
    return this.session.promoteSelectionToSiteChrome(...args);
  }
  removePage(
    ...args: Parameters<EditorSession["removePage"]>
  ): ReturnType<EditorSession["removePage"]> {
    this.track();
    return this.session.removePage(...args);
  }
  openPrintChrome(
    ...args: Parameters<EditorSession["openPrintChrome"]>
  ): ReturnType<EditorSession["openPrintChrome"]> {
    this.track();
    return this.session.openPrintChrome(...args);
  }
  updatePrintVariantForPage(
    ...args: Parameters<EditorSession["updatePrintVariantForPage"]>
  ): ReturnType<EditorSession["updatePrintVariantForPage"]> {
    this.track();
    return this.session.updatePrintVariantForPage(...args);
  }
  startPrintSection(
    ...args: Parameters<EditorSession["startPrintSection"]>
  ): ReturnType<EditorSession["startPrintSection"]> {
    this.track();
    return this.session.startPrintSection(...args);
  }
  removePrintSectionBreak(
    ...args: Parameters<EditorSession["removePrintSectionBreak"]>
  ): ReturnType<EditorSession["removePrintSectionBreak"]> {
    this.track();
    return this.session.removePrintSectionBreak(...args);
  }
  setPrintSectionLinked(
    ...args: Parameters<EditorSession["setPrintSectionLinked"]>
  ): ReturnType<EditorSession["setPrintSectionLinked"]> {
    this.track();
    return this.session.setPrintSectionLinked(...args);
  }
  updatePrintSection(
    ...args: Parameters<EditorSession["updatePrintSection"]>
  ): ReturnType<EditorSession["updatePrintSection"]> {
    this.track();
    return this.session.updatePrintSection(...args);
  }
  updateParagraphFormatting(
    ...args: Parameters<EditorSession["updateParagraphFormatting"]>
  ): ReturnType<EditorSession["updateParagraphFormatting"]> {
    this.track();
    return this.session.updateParagraphFormatting(...args);
  }
  applyPageFlow(
    ...args: Parameters<EditorSession["applyPageFlow"]>
  ): ReturnType<EditorSession["applyPageFlow"]> {
    this.track();
    return this.session.applyPageFlow(...args);
  }
  setPageBackground(
    ...args: Parameters<EditorSession["setPageBackground"]>
  ): ReturnType<EditorSession["setPageBackground"]> {
    this.track();
    return this.session.setPageBackground(...args);
  }
  toggleRegion(
    ...args: Parameters<EditorSession["toggleRegion"]>
  ): ReturnType<EditorSession["toggleRegion"]> {
    this.track();
    return this.session.toggleRegion(...args);
  }
  zoomToFit(
    ...args: Parameters<EditorSession["zoomToFit"]>
  ): ReturnType<EditorSession["zoomToFit"]> {
    this.track();
    return this.session.zoomToFit(...args);
  }
  undo(
    ...args: Parameters<EditorSession["undo"]>
  ): ReturnType<EditorSession["undo"]> {
    this.track();
    return this.session.undo(...args);
  }
  redo(
    ...args: Parameters<EditorSession["redo"]>
  ): ReturnType<EditorSession["redo"]> {
    this.track();
    return this.session.redo(...args);
  }
}

// A stable key keeps barrel and leaf imports connected when Vite reloads a linked package.
// Each Svelte component tree still owns its context value.
const EDITOR_CONTEXT = Symbol.for("exemplara.editor.context");
export function setEditorContext(editor: EditorContext): EditorContext {
  setContext(EDITOR_CONTEXT, editor);
  return editor;
}
export function getEditorContext(): EditorContext {
  const editor = getContext<EditorContext | undefined>(EDITOR_CONTEXT);
  if (!editor) throw new Error('Exemplara editor context not found — is this component inside <Editor>?');
  return editor;
}
