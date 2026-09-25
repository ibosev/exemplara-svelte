<script lang="ts">
  import { getEditorContext } from './context.svelte.js';
  import { render } from '../renderer/render.js';
  import { renderWeb } from '../renderer/web.js';
  import { isWebDocument } from '../core/web.js';
  import { findSheetOverflows, type SheetOverflow } from '../shared/preview.js';
  import { IconPrinter, IconClose } from './icons.js';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  const editor = getEditorContext();
  const dataResolutionEnabled = editor.isProvidedCapabilityEnabled('data.resolve');
  const webDocument = $derived(isWebDocument(editor.doc));

  let withData = $state(dataResolutionEnabled);
  /** Print-accurate sheets (exact paper height, pinned footers, clipping) vs free-flowing pages. */
  let sheetMode = $state(true);
  let showGuides = $state(true);
  let iframe = $state<HTMLIFrameElement | null>(null);

  let overflows = $state<SheetOverflow[]>([]);

  const PREVIEW_CSS = `
@media screen {
  body { background: #52525b; display: flex; flex-direction: column; align-items: center; padding: 32px; gap: 24px; }
  .ex-page { box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35); }
}`;

  // Fully rendered document, live-updated while the preview is open.
  const fullHtml = $derived.by(() => {
    const dataContext = withData ? editor.getDataContext() : {};
    if (webDocument) {
      return renderWeb(editor.engine.snapshot(), {
        pageIndex: editor.activePageIndex,
        dataContext,
        resolveData: dataResolutionEnabled && withData,
        expressionRuntime: editor.expressionRuntime,
        runtime: editor.renderRuntime,
        extraCss: 'body { min-height: 100vh; }',
      }).fullHtml;
    }
    return render(editor.engine.snapshot(), {
      dataContext,
      resolveData: dataResolutionEnabled && withData,
      sheetMode: sheetMode ? 'fixed' : 'flow',
      showMarginGuides: showGuides,
      expressionRuntime: editor.expressionRuntime,
      runtime: editor.renderRuntime,
      extraCss: PREVIEW_CSS,
    }).fullHtml;
  });

  /**
   * After each iframe render, compare every sheet's content height to
   * the paper height — anything taller would be clipped (or spill) in
   * the printed PDF.
   */
  async function measureOverflow() {
    const doc = iframe?.contentDocument;
    if (!doc) return;
    await doc.fonts?.ready;
    const pages = Array.from(doc.querySelectorAll<HTMLElement>('.ex-page'));
    overflows = findSheetOverflows(
      pages,
      editor.doc.pages.map((page) => page.label),
    );
  }

  function print() {
    iframe?.contentWindow?.print();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') editor.previewOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="exs-preview" role="dialog" aria-label={webDocument ? 'Website preview' : 'Print preview'}>
  <div class="exs-preview__bar">
    <strong>{webDocument ? 'Website preview' : 'Print preview'}</strong>
    {#if dataResolutionEnabled}
      <label class="exs-preview__toggle">
        <input type="checkbox" bind:checked={withData} />
        Sample data
      </label>
    {/if}
    {#if !webDocument}
      <label class="exs-preview__toggle" title="Exact paper size: footers pin to the sheet bottom and overflow clips, matching the printed PDF">
        <input type="checkbox" bind:checked={sheetMode} />
        Exact sheets
      </label>
      <label class="exs-preview__toggle" title="Dashed outline of the printable area inside the page margins (never printed)">
        <input type="checkbox" bind:checked={showGuides} />
        Margin guides
      </label>
    {/if}

    {#if !webDocument && sheetMode && overflows.length > 0}
      <span class="exs-preview__warning" role="alert">
        <TriangleAlert size={13} />
        {#each overflows as o, i (o.sheet)}{i > 0 ? ' · ' : ''}“{o.label}” overflows by ~{o.byMm}mm{/each}
        — will be cut off in print
      </span>
    {/if}

    <span class="exs-toolbar__spacer"></span>
    {#if !webDocument}<button type="button" class="exs-btn" onclick={print}><IconPrinter size={14} /> Print / PDF</button>{/if}
    <button type="button" class="exs-btn exs-btn--primary" onclick={() => (editor.previewOpen = false)}>
      <IconClose size={14} /> Close
    </button>
  </div>
  <iframe
    class="exs-preview__frame"
    title="Document preview"
    bind:this={iframe}
    srcdoc={fullHtml}
    onload={measureOverflow}
  ></iframe>
</div>
