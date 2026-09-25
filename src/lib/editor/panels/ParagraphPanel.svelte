<script lang="ts">
  import { getEditorContext } from '../context.svelte.js';
  import {
    addParagraphTabStop,
    removeParagraphTabStop,
    resolveParagraphFormatting,
    updateParagraphTabStop,
  } from '../../shared/ruler.js';
  import { getPageDimensions } from '../../core/presets.js';
  import type { ComponentNode, ParagraphFormatting, TabStopAlignment } from '../../core/types.js';

  interface Props { node: ComponentNode }
  let { node }: Props = $props();
  const editor = getEditorContext();
  const formatting = $derived(resolveParagraphFormatting(node));
  const contentWidth = $derived.by(() => {
    const page = editor.activePage;
    if (!page) return 170;
    const dimensions = getPageDimensions(page.size, page.orientation);
    return dimensions.width - page.margins.left - page.margins.right;
  });

  function update(changes: Partial<ParagraphFormatting>): void {
    editor.updateParagraphFormatting(node.id, changes);
  }
</script>

<details class="exs-details" open>
  <summary>Paragraph</summary>
  <div class="exs-field exs-paragraph-panel">
    <div class="exs-paragraph-panel__grid">
      <label class="exs-field"><span class="exs-field__label">Left indent (mm)</span><input type="number" min="0" step="1" value={formatting.leftIndent} onchange={(event) => update({ leftIndent: event.currentTarget.valueAsNumber || 0 })} /></label>
      <label class="exs-field"><span class="exs-field__label">Right indent (mm)</span><input type="number" min="0" step="1" value={formatting.rightIndent} onchange={(event) => update({ rightIndent: event.currentTarget.valueAsNumber || 0 })} /></label>
      <label class="exs-field"><span class="exs-field__label">First line (mm)</span><input type="number" step="1" value={formatting.firstLineIndent} onchange={(event) => update({ firstLineIndent: event.currentTarget.valueAsNumber || 0 })} /></label>
      <label class="exs-field"><span class="exs-field__label">Line spacing</span><input type="number" min="0.8" max="4" step="0.05" value={formatting.lineHeight} onchange={(event) => update({ lineHeight: event.currentTarget.valueAsNumber || 1.5 })} /></label>
      <label class="exs-field"><span class="exs-field__label">Before (mm)</span><input type="number" min="0" step="1" value={formatting.spaceBefore} onchange={(event) => update({ spaceBefore: event.currentTarget.valueAsNumber || 0 })} /></label>
      <label class="exs-field"><span class="exs-field__label">After (mm)</span><input type="number" min="0" step="1" value={formatting.spaceAfter} onchange={(event) => update({ spaceAfter: event.currentTarget.valueAsNumber || 0 })} /></label>
    </div>
    <div class="exs-paragraph-panel__tabs-head">
      <span class="exs-field__label">Tab stops</span>
      <button type="button" class="exs-btn" onclick={() => update(addParagraphTabStop(formatting, Math.min(25, contentWidth), 'left', contentWidth))}>+ Tab</button>
    </div>
    {#each formatting.tabStops as tab (tab.id)}
      <div class="exs-paragraph-panel__tab">
        <input type="number" min="0" max={contentWidth} step="1" value={tab.position} aria-label="Tab position in millimetres" onchange={(event) => update(updateParagraphTabStop(formatting, tab.id, { position: event.currentTarget.valueAsNumber || 0 }, contentWidth))} />
        <select value={tab.alignment} aria-label="Tab alignment" onchange={(event) => update(updateParagraphTabStop(formatting, tab.id, { alignment: event.currentTarget.value as TabStopAlignment }, contentWidth))}>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="decimal">Decimal</option>
        </select>
        <button type="button" class="exs-icon-btn" aria-label="Remove tab" title="Remove tab" onclick={() => update(removeParagraphTabStop(formatting, tab.id, contentWidth))}>×</button>
      </div>
    {:else}
      <span class="exs-field__label" style="font-weight:400">Click the ruler to add a tab stop.</span>
    {/each}
  </div>
</details>
