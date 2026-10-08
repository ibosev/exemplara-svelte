<script lang="ts">
  import { bindUiState } from './ui-state.js';
  import { getEditorContext } from './context.svelte.js';
  import { getPageDimensions } from '../core/presets.js';
  import { addParagraphTabStop, resolveParagraphFormatting, rulerPercent } from '../shared/ruler.js';
  import type { TabStopAlignment } from '../core/types.js';

  const editor = getEditorContext();
  const node = $derived(editor.selectedNode?.type === 'text' ? editor.selectedNode : null);
  const page = $derived(editor.activePage);
  const formatting = $derived(resolveParagraphFormatting(node));
  const pageWidth = $derived.by(() => {
    if (!page) return 210;
    return getPageDimensions(page.size, page.orientation).width;
  });
  const marginLeft = $derived(page?.margins.left ?? 0);
  const marginRight = $derived(page?.margins.right ?? 0);
  const contentWidth = $derived(Math.max(0, pageWidth - marginLeft - marginRight));
  const uiModel = $derived(editor.session.ui.get('ruler'));
  const ui = $derived(bindUiState(uiModel));
  let host = $state<HTMLElement | null>(null);
  let bar = $state<HTMLElement | null>(null);
  let tabs = $state<HTMLElement | null>(null);
  let barLeft = $state(0);
  let barWidth = $state(0);
  let barAboveTabs = $state(false);

  function measurePage(): void {
    const surface = editor.canvasSurface ?? host?.parentElement?.querySelector<HTMLElement>('.exs-canvas__surface');
    const pageEl = surface?.querySelector<HTMLElement>('.exs-page--active')
      ?? surface?.querySelector<HTMLElement>('.exs-page');
    if (!host || !pageEl) return;
    const hostRect = host.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    barLeft = pageRect.left - hostRect.left;
    barWidth = pageRect.width;
    const tabsWidth = tabs?.getBoundingClientRect().width ?? 0;
    const gapBefore = barLeft;
    const gapAfter = hostRect.width - (barLeft + barWidth);
    const room = Math.max(gapBefore, gapAfter);
    barAboveTabs = room < tabsWidth + 8;
    if (!tabs) return;
    if (!barAboveTabs && gapAfter > gapBefore) {
      tabs.style.left = 'auto';
      tabs.style.right = '8px';
    } else {
      tabs.style.left = '8px';
      tabs.style.right = 'auto';
    }
  }

  $effect(() => {
    editor.zoom;
    editor.activePageIndex;
    pageWidth;
    const surface = editor.canvasSurface ?? host?.parentElement?.querySelector<HTMLElement>('.exs-canvas__surface');
    measurePage();
    const observer = new ResizeObserver(() => measurePage());
    if (host) observer.observe(host);
    if (surface) observer.observe(surface);
    // The sheet's layout box stays 210mm; zoom grows the shell around it.
    surface?.querySelectorAll<HTMLElement>('.exs-page').forEach((pageEl) => {
      observer.observe(pageEl);
      if (pageEl.parentElement) observer.observe(pageEl.parentElement);
    });
    surface?.addEventListener('scroll', measurePage, { passive: true });
    window.addEventListener('resize', measurePage);
    return () => {
      observer.disconnect();
      surface?.removeEventListener('scroll', measurePage);
      window.removeEventListener('resize', measurePage);
    };
  });

  function positionFor(event: PointerEvent | MouseEvent): number | null {
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const pageMm = ((event.clientX - rect.left) / rect.width) * pageWidth;
    if (pageMm < marginLeft || pageMm > pageWidth - marginRight) return null;
    return pageMm - marginLeft;
  }

  function addTab(event: MouseEvent): void {
    if (!node || (event.target as HTMLElement).closest('button')) return;
    const position = positionFor(event);
    if (position === null) return;
    editor.updateParagraphFormatting(
      node.id,
      addParagraphTabStop(formatting, position, ui.tabAlignment, contentWidth),
    );
  }

  function startDrag(kind: 'left' | 'first' | 'right', event: PointerEvent): void {
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    ui.dragging = true;
    const move = (moveEvent: PointerEvent) => {
      const position = positionFor(moveEvent);
      if (position === null) return;
      if (kind === 'left') ui.draftLeft = Math.min(position, ui.draftRight - 5);
      else if (kind === 'first') ui.draftFirst = Math.max(0, Math.min(position, ui.draftRight));
      else ui.draftRight = Math.max(ui.draftLeft + 5, position);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      ui.dragging = false;
      editor.updateParagraphFormatting(node.id, {
        leftIndent: ui.draftLeft,
        firstLineIndent: ui.draftFirst - ui.draftLeft,
        rightIndent: contentWidth - ui.draftRight,
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  }
</script>

<div
  class="exs-ruler"
  class:exs-ruler--disabled={!node}
  class:exs-ruler--bar-above={barAboveTabs}
  aria-label="Page ruler"
  title={node ? 'Click the ruler to add a tab. Drag the indent markers.' : 'Select text to edit paragraph geometry.'}
  bind:this={host}
>
  <div class="exs-ruler__tabs" aria-label="Tab alignment" bind:this={tabs}>
    {#each [['left', 'L'], ['center', '┴'], ['right', '⅃'], ['decimal', '·']] as [value, label] (value)}
      <button type="button" class:exs-ruler__tab-mode--active={ui.tabAlignment === value} title={`${value} tab`} onclick={() => (ui.tabAlignment = value as TabStopAlignment)}>{label}</button>
    {/each}
  </div>
  <div
    class="exs-ruler__bar"
    bind:this={bar}
    style:left={`${barLeft}px`}
    style:width={`${barWidth}px`}
    style:--exs-ruler-step={`${rulerPercent(10, pageWidth)}%`}
    onclick={addTab}
    role="presentation"
  >
    <div class="exs-ruler__ticks"></div>
    {#if marginLeft > 0}
      <div class="exs-ruler__margin" style:width={`${rulerPercent(marginLeft, pageWidth)}%`}></div>
    {/if}
    {#if marginRight > 0}
      <div class="exs-ruler__margin exs-ruler__margin--end" style:width={`${rulerPercent(marginRight, pageWidth)}%`}></div>
    {/if}
    {#each Array.from({ length: Math.floor(pageWidth / 10) + 1 }, (_, index) => index) as tick (tick)}
      <span class="exs-ruler__number" style:left={`${rulerPercent(tick * 10, pageWidth)}%`}>{tick}</span>
    {/each}
    {#if node}
      <button type="button" class="exs-ruler__marker exs-ruler__marker--first" style:left={`${rulerPercent(marginLeft + ui.draftFirst, pageWidth)}%`} title={`First line: ${(ui.draftFirst - ui.draftLeft).toFixed(1)}mm`} aria-label="First-line indent" onpointerdown={(event) => startDrag('first', event)}></button>
      <button type="button" class="exs-ruler__marker exs-ruler__marker--left" style:left={`${rulerPercent(marginLeft + ui.draftLeft, pageWidth)}%`} title={`Left indent: ${ui.draftLeft.toFixed(1)}mm`} aria-label="Left indent" onpointerdown={(event) => startDrag('left', event)}></button>
      <button type="button" class="exs-ruler__marker exs-ruler__marker--right" style:left={`${rulerPercent(marginLeft + ui.draftRight, pageWidth)}%`} title={`Right indent: ${(contentWidth - ui.draftRight).toFixed(1)}mm`} aria-label="Right indent" onpointerdown={(event) => startDrag('right', event)}></button>
      {#each formatting.tabStops as tab (tab.id)}
        <button type="button" class="exs-ruler__tab-stop" data-alignment={tab.alignment} style:left={`${rulerPercent(marginLeft + tab.position, pageWidth)}%`} title={`${tab.alignment} tab · ${tab.position}mm · double-click to remove`} aria-label={`${tab.alignment} tab at ${tab.position} millimetres`} ondblclick={(event) => { event.stopPropagation(); editor.updateParagraphFormatting(node.id, { tabStops: formatting.tabStops.filter((candidate) => candidate.id !== tab.id) }); }}>{tab.alignment === 'left' ? 'L' : tab.alignment === 'center' ? '┴' : tab.alignment === 'right' ? '⅃' : '·'}</button>
      {/each}
    {/if}
  </div>
</div>
