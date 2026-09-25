import { DocumentEngine } from '../core/engine.js';
import { ComponentRegistry } from '../core/registry.js';
import { EditorExtensionRegistry, type EditorCommandContext, type EditorController, type EditorExtension, type EditorHostConfig, type EditorStatus } from './extensions.js';
import { type EditorComposition } from './composition.js';
import { type PageFlowMeasurement } from '../core/pagination.js';
import { type BindingAutocompleteTrigger } from '../shared/binding-authoring.js';
import type { EditorAutocompleteSuggestion } from './extensions.js';
import { type CapabilityId, type UnsupportedDocumentCapability } from '../core/capabilities.js';
import { type SectionTemplatePosition } from '../core/print-sections.js';
import type { ComponentDefinition, ComponentNode, ExemplaraDocument, Page, ParagraphFormatting, PrintSection, PrintTemplateVariant, RegionName } from '../core/types.js';
import { type RenderRuntime } from '../renderer/runtime.js';
import { type ComponentIcon, type ComponentIconRegistry } from './icons.js';
export interface EditorInit {
    document?: ExemplaraDocument;
    registry?: ComponentRegistry;
    composition?: EditorComposition;
    /** @deprecated Prefer identified plugins in composition. */
    extensions?: readonly EditorExtension[];
    host?: EditorHostConfig;
}
export type LeftTab = string;
export type RightTab = string;
export interface ContextMenuState {
    x: number;
    y: number;
    nodeId: string;
}
/**
 * Central reactive editor state, shared with every editor component via
 * Svelte context. All fields are runes — components simply read them and
 * stay in sync.
 */
export declare class EditorContext {
    #private;
    readonly engine: DocumentEngine;
    readonly registry: ComponentRegistry;
    readonly extensions: EditorExtensionRegistry;
    readonly composition: EditorComposition;
    readonly renderRuntime: RenderRuntime;
    readonly iconRegistry: ComponentIconRegistry;
    readonly host: EditorHostConfig;
    readonly controller: EditorController;
    /** Reactive bridges over the portable engine and registry subscriptions. */
    engineRevision: number;
    /** Increments only when the entire document is replaced, allowing form surfaces to remount. */
    documentEpoch: number;
    registryRevision: number;
    selectedId: string | null;
    hoveredId: string | null;
    activePageIndex: number;
    /** Copy buffer for node copy/paste. */
    clipboard: ComponentNode | null;
    /** Canvas zoom factor. */
    zoom: number;
    /** Node currently in inline rich-text editing mode. */
    editingId: string | null;
    /** Panel tabs; initialized to each side's first registered panel contribution. */
    leftTab: LeftTab;
    rightTab: RightTab;
    /** Compact sidebars retain their vertical icon rail while hiding panel content. */
    leftPanelCompact: boolean;
    rightPanelCompact: boolean;
    /** Shared Print panel/canvas selection for direct header/footer editing. */
    printPosition: 'header' | 'footer';
    printVariant: PrintTemplateVariant;
    printPreviewPage: number;
    /** True while the active paper margin iframe is directly contenteditable. */
    printEditing: boolean;
    /** Sheets containing an indivisible first block taller than the body frame. */
    blockedFlowPageIds: string[];
    /** Print preview overlay. */
    previewOpen: boolean;
    /** Focused data-source and binding workspace opened from the compact toolbar. */
    dataWorkspaceOpen: boolean;
    /** Right-click context menu (null = closed). */
    contextMenu: ContextMenuState | null;
    /** Invalidates the Layers panel when a selected node must be explicitly revealed. */
    layerRevealRevision: number;
    /** Dark editor chrome (documents stay light — print is print). */
    dark: boolean;
    /** Resolve template expressions with sample data on the editable canvas. */
    dataPreviewEnabled: boolean;
    /** Invalidates host theme getters after the host toggle callback runs. */
    hostThemeRevision: number;
    /** Complete historical document rendered by the canvas without replacing the editable engine state. */
    historicalPreviewDocument: ExemplaraDocument | null;
    /** Durable version identifier associated with the active historical preview. */
    historicalPreviewVersionId: string | null;
    /** Bound by Canvas so zoomToFit can measure the viewport. */
    canvasSurface: HTMLElement | null;
    hostStatus: EditorStatus | null;
    readonly doc: ExemplaraDocument;
    readonly historicalPreviewActive: boolean;
    readonly canUndo: boolean;
    readonly isPrintTabActive: boolean;
    /** Effective page index to use for Print previews, section resolution, and the Print panel
     *  when the Print tab is active. This derives from the editor's activePageIndex to eliminate
     *  the fragile dual-state (activePageIndex vs printPreviewPage) desync.
     *  When Print is not active, falls back to the explicit printPreviewPage state.
     */
    readonly effectivePrintPreviewPage: number;
    readonly canRedo: boolean;
    readonly registryCategories: Map<string, ComponentDefinition[]>;
    /** Dynamic document features unavailable to this composition (never silently evaluated). */
    readonly capabilityDiagnostics: UnsupportedDocumentCapability[];
    readonly activePage: Page | null;
    readonly selectedNode: ComponentNode | null;
    readonly selectedDefinition: ComponentDefinition | null;
    constructor(init?: EditorInit);
    destroy(): void;
    getDefinition(type: string): ComponentDefinition | undefined;
    componentIcon(type: string): ComponentIcon | null;
    get expressionRuntime(): import("../index.js").TemplateExpressionRuntime;
    hasPlugin(pluginId: string): boolean;
    /** A feature is active only when policy permits it and an installed plugin provides it. */
    isProvidedCapabilityEnabled(capability: CapabilityId): boolean;
    autocompleteSuggestions(trigger: BindingAutocompleteTrigger): EditorAutocompleteSuggestion[];
    setHostStatus(message: string, tone?: EditorStatus['tone']): void;
    /** Replace the whole document and reset editor-local selection/form state. */
    replaceDocument(document: ExemplaraDocument): void;
    /** Render a durable snapshot without loading it into the command engine or changing undo history. */
    previewHistoricalDocument(versionId: string, document: ExemplaraDocument): void;
    /** Return the canvas to the current editable draft. */
    clearHistoricalPreview(): void;
    isDarkChrome(): boolean;
    toggleChromeTheme(): void;
    openPanel(panelId: string, expand?: boolean): boolean;
    isPanelCompact(side: 'left' | 'right'): boolean;
    setPanelCompact(side: 'left' | 'right', compact: boolean): void;
    togglePanelCompact(side: 'left' | 'right'): void;
    openDataWorkspace(): boolean;
    closeDataWorkspace(): void;
    setAutoFlow(enabled: boolean): void;
    toggleAutoFlow(): void;
    canRunCommand(commandId: string, context?: EditorCommandContext): boolean;
    runCommand(commandId: string, context?: EditorCommandContext): Promise<boolean>;
    /** @deprecated Use canRunCommand(). */
    canRunExtensionCommand(commandId: string): boolean;
    /** @deprecated Use runCommand(). */
    runExtensionCommand(commandId: string): Promise<boolean>;
    saveToHost(): Promise<boolean>;
    select(nodeId: string | null): void;
    /** Select a component and bring its rendered canvas element into view. */
    selectAndRevealNode(nodeId: string): boolean;
    /** Select and reveal the nearest component parent. Region roots have no selectable parent. */
    selectParent(nodeId: string): boolean;
    /** Open Layers and request expansion/scrolling to a component node. */
    revealInLayers(nodeId: string): boolean;
    openContextMenu(x: number, y: number, nodeId: string): void;
    closeContextMenu(): void;
    setDataPreview(enabled: boolean): void;
    /** Merge every data source's sampleData into one preview context. */
    getDataContext(): Record<string, unknown>;
    addComponent(type: string, parentId: string, index?: number, slot?: string): ComponentNode;
    addBlock(blockId: string, parentId: string, index?: number, slot?: string): ComponentNode | null;
    /** Insert an image node backed by a document asset at an explicit drop target. */
    insertAssetImage(assetId: string, parentId: string, index?: number, slot?: string): ComponentNode | null;
    /** Replace the source of an existing native or imported HTML image with a document asset. */
    applyAssetToImage(assetId: string, nodeId: string): boolean;
    /** Register the currently mounted rich-text caret as an expression insertion target. */
    registerInlineExpressionTarget(nodeId: string, insert: (expression: string) => boolean): () => void;
    /** Insert at the active rich-text caret, or replace selected component content outside edit mode. */
    insertExpression(expression: string): boolean;
    moveNode(nodeId: string, targetParentId: string, targetIndex: number, targetSlot?: string): void;
    updateProps(nodeId: string, props: Record<string, unknown>): void;
    /** Commit rich-text content and its explicit binding metadata as one undo step. */
    commitRichTextAuthoring(nodeId: string, content: string, dataBindings: ComponentNode['dataBindings']): void;
    /** Commit a text-like property and its binding metadata as one undo step. */
    commitPropAuthoring(nodeId: string, targetProp: string, value: unknown, dataBindings: ComponentNode['dataBindings']): void;
    /** Update author-owned page-flow rules, collapsing a split logical node first. */
    updatePaginationRules(nodeId: string, changes: Partial<NonNullable<ComponentNode['pagination']>>): void;
    /** Enter lossless rich-text editing for the complete logical flow node. */
    beginRichTextEdit(nodeId: string): void;
    /**
     * Set (or clear with undefined) a value-based style binding on a node.
     * Value bindings are rendered as inline styles by the renderer.
     */
    setStyleBinding(nodeId: string, property: string, value: string | undefined): void;
    /** Attach or detach a reusable document style class from a logical node. */
    setStyleRuleAttachment(nodeId: string, ruleId: string, attached: boolean): void;
    /** Create a reusable style class and attach it in the same undoable action. */
    createReusableStyleClass(nodeId: string, name: string): string | null;
    /** Read the current value-based style binding for a property. */
    getStyleBinding(nodeId: string, property: string): string | undefined;
    removeNode(nodeId: string): void;
    duplicateNode(nodeId: string): void;
    /** Move a node one position up/down among its siblings. */
    moveBy(nodeId: string, delta: 1 | -1): void;
    /** Snapshot a node as a reusable symbol and tag the node as its instance. */
    createSymbolFromNode(nodeId: string): void;
    /** Insert a fresh symbol instance into a drop target or the active page body. */
    insertSymbolInstance(symbolId: string, parentId?: string, index?: number, slot?: string): ComponentNode | null;
    detachSymbol(nodeId: string): void;
    renameSymbol(symbolId: string, label: string): void;
    /** Delete a saved definition while leaving placed instances as independent content. */
    removeSymbol(symbolId: string): void;
    copyNode(nodeId: string): void;
    /** Paste the clipboard node next to the selected node (or into the body). */
    pasteClipboard(): void;
    addPage(): void;
    duplicatePage(pageId?: string | undefined): void;
    ensureWebChrome(kind: 'header' | 'footer'): string;
    promoteSelectionToSiteChrome(kind: 'header' | 'footer'): boolean;
    removePage(pageId: string): void;
    /** Open the Print panel from a Word-like header/footer zone on a sheet. */
    openPrintChrome(position: SectionTemplatePosition, pageIndex: number, editing?: boolean): void;
    updatePrintVariantForPage(position: SectionTemplatePosition, pageIndex: number, variant: PrintTemplateVariant, value: string): void;
    startPrintSection(pageIndex: number): void;
    removePrintSectionBreak(pageIndex: number): void;
    setPrintSectionLinked(sectionId: string, position: SectionTemplatePosition, linkedToPrevious: boolean): void;
    updatePrintSection(sectionId: string, changes: Partial<Pick<PrintSection, 'label' | 'differentFirstPage' | 'differentOddEven'>>): void;
    updateParagraphFormatting(nodeId: string, changes: Partial<ParagraphFormatting>): void;
    /** Apply one measured auto-pagination step; returns true when the AST changed. */
    applyPageFlow(measurements: PageFlowMeasurement[]): boolean;
    /** Set (or clear with '') the page background color via the background region. */
    setPageBackground(pageId: string, color: string): void;
    /** Add or remove an optional page region (header/footer/background). */
    toggleRegion(pageId: string, name: Exclude<RegionName, 'body'>): void;
    /** Fit the active page width into the canvas viewport. */
    zoomToFit(): void;
    undo(): void;
    redo(): void;
}
export declare function setEditorContext(editor: EditorContext): EditorContext;
export declare function getEditorContext(): EditorContext;
