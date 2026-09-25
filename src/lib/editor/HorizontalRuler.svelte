<script lang="ts">
  import { getEditorContext } from './context.svelte.js';
  import { getPageDimensions } from '../core/presets.js';
  import { addParagraphTabStop, resolveParagraphFormatting, rulerPercent } from '../shared/ruler.js';
  import { mmToPx } from '../shared/math.js';
  import type { TabStopAlignment } from '../core/types.js';

  const editor = getEditorContext();
  const node = $derived(editor.selectedNode?.type === 'text' ? editor.selectedNode : null);
  const page = $derived(editor.activePage);
  const formatting = $derived(resolveParagraphFormatting(node));
  const contentWidth = $derived.by(() => {
    if (!page) return 170;
    const dimensions = getPageDimensions(page.size, page.orientation);
    return dimensions.width - page.margins.left - page.margins.right;
  });
  let tabAlignment = $state<TabStopAlignment>('left');
  let bar = $state<HTMLElement | null>(null);
  let draftLeft = $state(0);
  let draftFirst = $state(0);
  let draftRight = $state(0);
  let dragging = $state(false);

  $effect(() => {
    if (dragging) return;
    draftLeft = formatting.leftIndent;
    draftFirst = formatting.leftIndent + formatting.firstLineIndent;
    draftRight = contentWidth - formatting.rightIndent;
  });

  function positionFor(event: PointerEvent | MouseEvent): number {
    const rect = bar?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.max(0, Math.min(contentWidth, ((event.clientX - rect.left) / rect.width) * contentWidth));
  }

  function addTab(event: MouseEvent): void {
    if (!node || (event.target as HTMLElement).closest('button')) return;
    editor.updateParagraphFormatting(
      node.id,
      addParagraphTabStop(formatting, positionFor(event), tabAlignment, contentWidth),
    );
  }

  function startDrag(kind: 'left' | 'first' | 'right', event: PointerEvent): void {
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    const move = (moveEvent: PointerEvent) => {
      const position = positionFor(moveEvent);
      if (kind === 'left') draftLeft = Math.min(position, draftRight - 5);
      else if (kind === 'first') draftFirst = Math.max(0, Math.min(position, draftRight));
      else draftRight = Math.max(draftLeft + 5, position);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      dragging = false;
      editor.updateParagraphFormatting(node.id, {
        leftIndent: draftLeft,
        firstLineIndent: draftFirst - draftLeft,
        rightIndent: contentWidth - draftRight,
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
  }
</script>

<div class="exs-ruler" class:exs-ruler--disabled={!node} aria-label="Paragraph ruler">
  <div class="exs-ruler__tabs" aria-label="Tab alignment">
    {#each [['left', 'L'], ['center', '┴'], ['right', '⅃'], ['decimal', '·']] as [value, label] (value)}
      <button type="button" class:exs-ruler__tab-mode--active={tabAlignment === value} title={`${value} tab`} onclick={() => (tabAlignment = value as TabStopAlignment)}>{label}</button>
    {/each}
  </div>
  <div
    class="exs-ruler__bar"
    bind:this={bar}
    style:width={`${mmToPx(contentWidth) * editor.zoom}px`}
    style:--exs-ruler-step={`${rulerPercent(10, contentWidth)}%`}
    onclick={addTab}
    role="presentation"
  >
    <div class="exs-ruler__ticks"></div>
    {#each Array.from({ length: Math.floor(contentWidth / 10) + 1 }, (_, index) => index) as tick (tick)}
      <span class="exs-ruler__number" style:left={`${rulerPercent(tick * 10, contentWidth)}%`}>{tick}</span>
    {/each}
    {#if node}
      <button type="button" class="exs-ruler__marker exs-ruler__marker--first" style:left={`${rulerPercent(draftFirst, contentWidth)}%`} title={`First line: ${(draftFirst - draftLeft).toFixed(1)}mm`} aria-label="First-line indent" onpointerdown={(event) => startDrag('first', event)}></button>
      <button type="button" class="exs-ruler__marker exs-ruler__marker--left" style:left={`${rulerPercent(draftLeft, contentWidth)}%`} title={`Left indent: ${draftLeft.toFixed(1)}mm`} aria-label="Left indent" onpointerdown={(event) => startDrag('left', event)}></button>
      <button type="button" class="exs-ruler__marker exs-ruler__marker--right" style:left={`${rulerPercent(draftRight, contentWidth)}%`} title={`Right indent: ${(contentWidth - draftRight).toFixed(1)}mm`} aria-label="Right indent" onpointerdown={(event) => startDrag('right', event)}></button>
      {#each formatting.tabStops as tab (tab.id)}
        <button type="button" class="exs-ruler__tab-stop" data-alignment={tab.alignment} style:left={`${rulerPercent(tab.position, contentWidth)}%`} title={`${tab.alignment} tab · ${tab.position}mm · double-click to remove`} aria-label={`${tab.alignment} tab at ${tab.position} millimetres`} ondblclick={(event) => { event.stopPropagation(); editor.updateParagraphFormatting(node.id, { tabStops: formatting.tabStops.filter((candidate) => candidate.id !== tab.id) }); }}>{tab.alignment === 'left' ? 'L' : tab.alignment === 'center' ? '┴' : tab.alignment === 'right' ? '⅃' : '·'}</button>
      {/each}
    {/if}
  </div>
  <span class="exs-ruler__hint">{node ? 'Click to add tab · drag indents' : 'Select text to edit paragraph geometry'}</span>
</div>
