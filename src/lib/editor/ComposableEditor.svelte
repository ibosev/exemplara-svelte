<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Toolbar from './Toolbar.svelte';
  import Canvas from './Canvas.svelte';
  import PreviewPanel from './PreviewPanel.svelte';
  import { EditorContext, setEditorContext } from './context.svelte.js';
  import { isEditableTarget } from '../shared/dom.js';
  import { createId } from '../core/id.js';
  import { renderScopedDocumentStyles } from '../renderer/styles.js';
  import { IconChevronLeft, IconChevronRight, IconSparkles } from './icons.js';
  import type { ComponentRegistry } from '../core/registry.js';
  import type { ExemplaraDocument } from '../core/types.js';
  import type { EditorHostConfig } from './extensions.js';
  import type { EditorComposition } from './composition.js';
  import { renderEditorThemeStyle } from './theme.js';
  import { isWebDocument } from '../core/web.js';
  import './theme.css';

  interface Props {
    document?: ExemplaraDocument;
    registry?: ComponentRegistry;
    /** Required so this entry point never imports the batteries-included preset. */
    composition: EditorComposition;
    host?: EditorHostConfig;
    onchange?: (doc: ExemplaraDocument) => void;
  }

  let { document, registry, composition, host, onchange }: Props = $props();

  // svelte-ignore state_referenced_locally -- props intentionally read once; the editor owns the session after init
  const editor = new EditorContext({ document, registry, composition, host });
  const styleScope = createId('editor');
  const pageStyleSelector = $derived(
    `.exs-editor[data-exs-editor-scope="${styleScope}"] ${isWebDocument(editor.doc) ? '.exs-web-page' : '.exs-page'}`,
  );
  const documentStyles = $derived.by(() => {
    editor.engineRevision;
    return renderScopedDocumentStyles(editor.doc, pageStyleSelector);
  });
  // Chrome does not reparse a <style> element when Svelte updates its text
  // node. Assigning textContent forces the stylesheet to take the new CSS.
  let documentStyleEl: HTMLStyleElement | undefined = $state();
  $effect(() => {
    const el = documentStyleEl;
    const css = documentStyles;
    if (el && el.textContent !== css) el.textContent = css;
  });
  setEditorContext(editor);
  onDestroy(() => editor.destroy());

  let firstRun = true;
  $effect(() => {
    editor.engineRevision;
    const snapshot = editor.engine.snapshot();
    if (firstRun) {
      firstRun = false;
      return;
    }
    onchange?.(snapshot);
  });

  const leftPanels = editor.extensions.panelsFor('left');
  const rightPanels = editor.extensions.panelsFor('right');
  const darkChrome = $derived(editor.isDarkChrome());
  const hostThemeStyle = $derived(renderEditorThemeStyle(editor.host.theme?.tokens?.()));
  const DEFAULT_SIDEBAR_WIDTH = { left: 286, right: 344 } as const;
  const MIN_SIDEBAR_WIDTH = { left: 240, right: 280 } as const;
  const MAX_SIDEBAR_WIDTH = 840;
  const MIN_CANVAS_WIDTH = 360;
  const SIDEBAR_WIDTH_STORAGE_KEY = 'exemplara:editor:sidebar-widths:v1';
  let mainElement = $state<HTMLElement | null>(null);
  let sidebarWidths = $state<Record<'left' | 'right', number>>({ ...DEFAULT_SIDEBAR_WIDTH });
  let resizingSide = $state<'left' | 'right' | null>(null);
  let resizeStartX = 0;
  let resizeStartWidth = 0;

  function onKeydown(event: KeyboardEvent) {
    if (isEditableTarget(event.target) || editor.editingId) return;
    const context = editor.selectedId ? { nodeId: editor.selectedId } : {};
    const commandId = editor.extensions.resolveKeybinding(event, editor, context);
    if (!commandId) return;
    event.preventDefault();
    void editor.runCommand(commandId, context);
  }

  function activatePanel(side: 'left' | 'right', panelId: string, active: boolean): void {
    if (active && !editor.isPanelCompact(side)) {
      editor.setPanelCompact(side, true);
      return;
    }
    editor.openPanel(panelId);
  }

  function sidebarMaximum(side: 'left' | 'right'): number {
    const otherSide = side === 'left' ? 'right' : 'left';
    const otherWidth = editor.isPanelCompact(otherSide) ? 52 : sidebarWidths[otherSide];
    const available = (mainElement?.clientWidth ?? 1440) - otherWidth - MIN_CANVAS_WIDTH;
    return Math.max(MIN_SIDEBAR_WIDTH[side], Math.min(MAX_SIDEBAR_WIDTH, available));
  }

  function setSidebarWidth(side: 'left' | 'right', width: number): void {
    sidebarWidths[side] = Math.round(Math.max(
      MIN_SIDEBAR_WIDTH[side],
      Math.min(sidebarMaximum(side), width),
    ));
  }

  function restoreSidebarWidths(): void {
    try {
      const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<Record<'left' | 'right', unknown>>;
      for (const side of ['left', 'right'] as const) {
        const width = parsed[side];
        if (typeof width === 'number' && Number.isFinite(width)) setSidebarWidth(side, width);
      }
    } catch {
      // Storage can be disabled or contain stale data; defaults remain usable.
    }
  }

  function persistSidebarWidths(): void {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, JSON.stringify(sidebarWidths));
    } catch {
      // Resizing remains functional when storage is unavailable.
    }
  }

  function startSidebarResize(side: 'left' | 'right', event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    resizeStartX = event.clientX;
    resizeStartWidth = sidebarWidths[side];
    resizingSide = side;
    event.preventDefault();
  }

  function continueSidebarResize(side: 'left' | 'right', event: PointerEvent): void {
    if (resizingSide !== side) return;
    const delta = side === 'left' ? event.clientX - resizeStartX : resizeStartX - event.clientX;
    setSidebarWidth(side, resizeStartWidth + delta);
  }

  function stopSidebarResize(side: 'left' | 'right', event: PointerEvent): void {
    if (resizingSide !== side) return;
    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    resizingSide = null;
    persistSidebarWidths();
  }

  function resizeSidebarWithKeyboard(side: 'left' | 'right', event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'Home') {
      setSidebarWidth(side, DEFAULT_SIDEBAR_WIDTH[side]);
    } else if (event.key === 'ArrowLeft') {
      setSidebarWidth(side, sidebarWidths[side] + (side === 'left' ? -step : step));
    } else if (event.key === 'ArrowRight') {
      setSidebarWidth(side, sidebarWidths[side] + (side === 'left' ? step : -step));
    } else {
      return;
    }
    persistSidebarWidths();
    event.preventDefault();
  }

  function resetSidebarWidth(side: 'left' | 'right'): void {
    setSidebarWidth(side, DEFAULT_SIDEBAR_WIDTH[side]);
    persistSidebarWidths();
  }

  onMount(() => {
    restoreSidebarWidths();
    host?.onReady?.(editor.controller);
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div
  class="exs-editor"
  class:exs-editor--dark={darkChrome}
  class:exs-editor--history-preview={editor.historicalPreviewActive}
  class:exs-editor--resizing-sidebar={resizingSide !== null}
  data-exs-editor-scope={styleScope}
  style={hostThemeStyle}
>
  <svelte:element this={'style'} bind:this={documentStyleEl}>{documentStyles}</svelte:element>
  {#if editor.host.toolbarPlacement !== 'canvas-tabs'}
    <Toolbar />
  {/if}
  <div class="exs-editor__main" bind:this={mainElement}>
    {#if leftPanels.length > 0}
      {@render sidebar('left', leftPanels)}
    {/if}

    <Canvas />

    {#if rightPanels.length > 0}
      {@render sidebar('right', rightPanels)}
    {/if}
  </div>

  {#snippet sidebar(side: 'left' | 'right', panels: typeof leftPanels)}
    {@const activeTab = side === 'left' ? editor.leftTab : editor.rightTab}
    {@const activePanel = panels.find((panel) => panel.id === activeTab)}
    {@const compact = editor.isPanelCompact(side)}
    <aside
      class="exs-editor__sidebar exs-editor__{side}"
      class:exs-editor__sidebar--compact={compact}
      class:exs-editor__sidebar--resizing={resizingSide === side}
      aria-label="{side === 'left' ? 'Left' : 'Right'} editor sidebar"
      style:width={compact ? undefined : `${sidebarWidths[side]}px`}
    >
      <div class="exs-panel-rail">
        <nav class="exs-tabs" aria-label="{side === 'left' ? 'Left' : 'Right'} panels">
          {#each panels as panel (panel.id)}
            {@const Icon = panel.icon ?? IconSparkles}
            <button
              type="button"
              id={`exs-${styleScope}-${side}-tab-${panel.id}`}
              class="exs-tabs__tab"
              class:exs-tabs__tab--active={activeTab === panel.id}
              title={`${panel.label}${activeTab === panel.id && !compact ? ' — collapse panel' : ''}`}
              aria-pressed={activeTab === panel.id}
              onclick={() => activatePanel(side, panel.id, activeTab === panel.id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{panel.label}</span>
            </button>
          {/each}
        </nav>
        <button
          type="button"
          class="exs-panel-rail__toggle"
          title={`${compact ? 'Expand' : 'Collapse'} ${side} panel`}
          aria-label={`${compact ? 'Expand' : 'Collapse'} ${side} panel`}
          aria-expanded={!compact}
          onclick={() => editor.togglePanelCompact(side)}
        >
          {#if (side === 'left' && compact) || (side === 'right' && !compact)}
            <IconChevronRight size={17} aria-hidden="true" />
          {:else}
            <IconChevronLeft size={17} aria-hidden="true" />
          {/if}
        </button>
      </div>
      {#if activePanel && !compact}
        {@const ActivePanel = activePanel.component}
        <section
          class="exs-editor__panel-body"
          aria-labelledby={`exs-${styleScope}-${side}-tab-${activePanel.id}`}
        >
          {#key editor.documentEpoch}
            <ActivePanel {editor} />
          {/key}
        </section>
      {/if}
      {#if !compact}
        <div
          class="exs-editor__sidebar-resizer"
          role="slider"
          tabindex="0"
          aria-orientation="horizontal"
          aria-label={`Resize ${side} editor sidebar`}
          aria-valuemin={MIN_SIDEBAR_WIDTH[side]}
          aria-valuemax={sidebarMaximum(side)}
          aria-valuenow={sidebarWidths[side]}
          title={`Drag to resize the ${side} panel · double-click to reset`}
          onpointerdown={(event) => startSidebarResize(side, event)}
          onpointermove={(event) => continueSidebarResize(side, event)}
          onpointerup={(event) => stopSidebarResize(side, event)}
          onpointercancel={(event) => stopSidebarResize(side, event)}
          onkeydown={(event) => resizeSidebarWithKeyboard(side, event)}
          ondblclick={() => resetSidebarWidth(side)}
        ></div>
      {/if}
    </aside>
  {/snippet}

  {#if editor.previewOpen}
    <PreviewPanel />
  {/if}
</div>
