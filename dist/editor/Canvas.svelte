<script lang="ts">
  import { onMount, tick } from 'svelte';
  import PageSheet from './PageSheet.svelte';
  import WebPageSheet from './WebPageSheet.svelte';
  import Toolbar from './Toolbar.svelte';
  import PageLayoutControls from './PageLayoutControls.svelte';
  import { getEditorContext } from './context.svelte.js';
  import { IconDuplicate, IconPlus } from './icons.js';
  import { measurePageFlowDom, pageFlowResizeTargets } from '../shared/page-flow-dom.js';
  import { flowFragmentCount } from '../core/pagination.js';
  import { activePageAtY, pageScrollTop, viewportReadingY } from '../shared/page-view.js';
  import { isWebDocument } from '../core/web.js';

  const editor = getEditorContext();
  const pageElements = new Map<string, HTMLElement>();
  let reflowPending = false;
  let scrollSyncPending = false;
  let resizeObserver: ResizeObserver | null = null;
  let lastPrintFocus = -1;
  const editingEnabled = $derived(
    editor.hasPlugin('exemplara.core-editing')
      && editor.composition.policy.allows('document.edit')
      && !editor.historicalPreviewActive,
  );
  const paginationAuthoringEnabled = $derived(
    editor.hasPlugin('exemplara.print')
      && editor.composition.policy.allows('print.pagination')
      && !editor.historicalPreviewActive,
  );
  const webDocument = $derived(isWebDocument(editor.doc));

  function registerPage(pageId: string, element: HTMLElement | null): void {
    if (element) pageElements.set(pageId, element);
    else pageElements.delete(pageId);
    scheduleReflow();
  }

  function focusPage(index: number): void {
    const page = editor.doc.pages[index];
    if (!page) return;
    editor.activePageIndex = index;
    const shell = pageElements.get(page.id)?.parentElement;
    const surface = editor.canvasSurface;
    if (!shell || !surface) return;
    const surfaceRect = surface.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    surface.scrollTo({
      top: pageScrollTop(surface.scrollTop + shellRect.top - surfaceRect.top),
      left: surface.scrollLeft,
      behavior: 'smooth',
    });
    surface.focus({ preventScroll: true });
  }

  /** Keep the page navigator in sync with the sheet nearest the viewport focus line. */
  function syncActivePageFromScroll(): void {
    if (editor.printEditing || scrollSyncPending || typeof requestAnimationFrame === 'undefined') return;
    scrollSyncPending = true;
    requestAnimationFrame(() => {
      scrollSyncPending = false;
      const surface = editor.canvasSurface;
      if (!surface || editor.doc.pages.length === 0) return;

      const surfaceRect = surface.getBoundingClientRect();
      // A line one third down the viewport feels natural when reading forward,
      // while still selecting the next page shortly after it enters the view.
      const focusY = viewportReadingY({ top: surfaceRect.top, bottom: surfaceRect.bottom });
      const rects = editor.doc.pages.map((page) => {
        const rect = pageElements.get(page.id)?.parentElement?.getBoundingClientRect();
        return rect
          ? { top: rect.top, bottom: rect.bottom }
          : { top: Number.POSITIVE_INFINITY, bottom: Number.POSITIVE_INFINITY };
      });
      const nearestIndex = activePageAtY(rects, focusY, editor.activePageIndex);

      if (nearestIndex !== editor.activePageIndex) editor.activePageIndex = nearestIndex;
    });
  }

  function observeFlowNodes(): void {
    resizeObserver?.disconnect();
    if (!resizeObserver) return;
    for (const node of pageFlowResizeTargets(pageElements.values())) resizeObserver.observe(node);
  }

  function scheduleReflow(): void {
    if (
      reflowPending
      || webDocument
      || editor.editingId
      || !paginationAuthoringEnabled
      || editor.doc.pagination.mode !== 'auto'
      || typeof requestAnimationFrame === 'undefined'
    ) return;
    reflowPending = true;
    requestAnimationFrame(async () => {
      await tick();
      requestAnimationFrame(() => {
        reflowPending = false;
        // An edit can begin after this pass was scheduled. Never mutate the
        // fragment AST underneath an active contenteditable session.
        if (editor.editingId) return;
        observeFlowNodes();
        const changed = editor.applyPageFlow(measurePageFlowDom(editor.doc, pageElements));
        if (changed) scheduleReflow();
      });
    });
  }

  $effect(() => {
    // The engine revision makes every successful command schedule one
    // post-DOM pagination pass without serializing a potentially large AST.
    editor.engineRevision;
    editor.doc.pagination.mode;
    editor.editingId;
    scheduleReflow();
  });

  $effect(() => {
    if (!editor.printEditing || editor.activePageIndex === lastPrintFocus) return;
    lastPrintFocus = editor.activePageIndex;
    requestAnimationFrame(() => focusPage(editor.activePageIndex));
  });

  $effect(() => {
    if (!editor.printEditing) lastPrintFocus = -1;
  });

  onMount(() => {
	const handleResize = () => {
	  if (webDocument) editor.zoomToFit();
	  else scheduleReflow();
	};
    resizeObserver = new ResizeObserver(handleResize);
	if (editor.canvasSurface) resizeObserver.observe(editor.canvasSurface);
	requestAnimationFrame(handleResize);
    return () => resizeObserver?.disconnect();
  });
</script>

<div class="exs-canvas">
  <div class="exs-canvas__tabs">
    <div class="exs-canvas__topbar-zone exs-canvas__topbar-zone--start">
      <span class="exs-canvas__document-label">{webDocument ? 'Website' : 'Document'}</span>
      {#each editor.doc.pages as page, index (page.id)}
        <button
          type="button"
          class="exs-canvas__tab"
          class:exs-canvas__tab--active={index === editor.activePageIndex}
          aria-current={index === editor.activePageIndex ? 'page' : undefined}
          title={webDocument ? `${page.label} /${page.web?.slug ?? ''}` : `Scroll to page ${index + 1}`}
          onclick={() => focusPage(index)}
        >
          {webDocument ? (page.label || page.web?.slug || `Route ${index + 1}`) : index + 1}
        </button>
      {/each}
      {#if editingEnabled}
        {#if webDocument}
          <button type="button" class="exs-canvas__tab exs-canvas__tab--add" title="Duplicate route" aria-label="Duplicate route" onclick={() => editor.duplicatePage()}>
            <IconDuplicate size={13} />
          </button>
        {/if}
        <button type="button" class="exs-canvas__tab exs-canvas__tab--add" title={webDocument ? 'Add route' : 'Add page'} aria-label={webDocument ? 'Add route' : 'Add page'} onclick={() => editor.addPage()}>
          <IconPlus size={13} />
        </button>
      {/if}
      {#if editor.host.toolbarPlacement === 'canvas-tabs'}
        <Toolbar compact zone="start" />
      {/if}
    </div>

    <div class="exs-canvas__topbar-zone exs-canvas__topbar-zone--center">
      {#if editor.host.toolbarPlacement === 'canvas-tabs'}
        {#if paginationAuthoringEnabled && !webDocument}
          <PageLayoutControls {editor} controls="size" />
        {/if}
        <Toolbar compact zone="center" />
        {#if paginationAuthoringEnabled && !webDocument}
          <PageLayoutControls {editor} controls="orientation" />
        {/if}
      {/if}
    </div>

    <div class="exs-canvas__topbar-zone exs-canvas__topbar-zone--end">
      {#if editor.host.toolbarPlacement === 'canvas-tabs'}
        <Toolbar compact zone="end" />
      {/if}
      {#if editor.capabilityDiagnostics.length > 0}
        <span
          class="exs-canvas__flow-warning"
          role="status"
          title={editor.capabilityDiagnostics
            .map((diagnostic) => `${diagnostic.path}: ${diagnostic.reason}`)
            .join('\n')}
        >
          {editor.capabilityDiagnostics.length} dynamic
          feature{editor.capabilityDiagnostics.length === 1 ? '' : 's'} disabled by policy
        </span>
      {/if}
      {#if !webDocument && editor.blockedFlowPageIds.length > 0}
        <span class="exs-canvas__flow-warning" role="status">
          {editor.blockedFlowPageIds.length} oversized block{editor.blockedFlowPageIds.length === 1 ? '' : 's'}
        </span>
      {/if}
      {#if !webDocument && flowFragmentCount(editor.doc) > 0}
        <span class="exs-canvas__flow-status" role="status">
          {flowFragmentCount(editor.doc)} flowing fragment{flowFragmentCount(editor.doc) === 1 ? '' : 's'}
        </span>
      {/if}
      {#if paginationAuthoringEnabled && !webDocument}
        <PageLayoutControls
          {editor}
          controls={editor.host.toolbarPlacement === 'canvas-tabs' ? 'flow' : 'all'}
        />
      {/if}
      <span class="exs-canvas__page-count">{editor.doc.pages.length} {webDocument ? `route${editor.doc.pages.length === 1 ? '' : 's'}` : `page${editor.doc.pages.length === 1 ? '' : 's'}`}</span>
    </div>
  </div>

  {#each editor.extensions.canvasDecorations(editor, 'above') as decoration (decoration.id)}
    {@const Decoration = decoration.component}
    <Decoration {editor} />
  {/each}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
  <div
    class="exs-canvas__surface"
    bind:this={editor.canvasSurface}
    tabindex="0"
    role="region"
    aria-label="Scrollable document pages"
    onscroll={syncActivePageFromScroll}
    onclick={() => editor.select(null)}
  >
    {#if editor.doc.pages.length > 0}
      <div class="exs-canvas__page-stack">
        {#each editor.doc.pages as page, index (page.id)}
          {#if webDocument}
            <WebPageSheet {page} {index} zoom={editor.zoom} onpageelement={registerPage} />
          {:else}
            <PageSheet
              {page}
              {index}
              zoom={editor.zoom}
              blocked={editor.blockedFlowPageIds.includes(page.id)}
              onpageelement={registerPage}
            />
          {/if}
        {/each}
      </div>
    {:else}
      <p>No pages yet.</p>
    {/if}
  </div>
  {#each editor.extensions.canvasDecorations(editor, 'overlay') as decoration (decoration.id)}
    {@const Decoration = decoration.component}
    <Decoration {editor} />
  {/each}
</div>
