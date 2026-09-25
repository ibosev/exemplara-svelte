<script lang="ts">
  import { PAGE_PRESETS } from '../core/presets.js';
  import type { Orientation, PagePreset } from '../core/types.js';
  import type { EditorContext } from './context.svelte.js';
  import {
    IconContinuousPages,
    IconDocument,
    IconLandscape,
    IconPortrait,
  } from './icons.js';

  type ControlSet = 'all' | 'size' | 'orientation' | 'flow';

  interface Props {
    editor: EditorContext;
    placement?: 'toolbar' | 'panel';
    controls?: ControlSet;
  }

  let { editor, placement = 'toolbar', controls = 'all' }: Props = $props();
  const page = $derived(editor.activePage);
  const autoFlowEnabled = $derived(editor.doc.pagination.mode === 'auto');
  const showSize = $derived(controls === 'all' || controls === 'size');
  const showOrientation = $derived(controls === 'all' || controls === 'orientation');
  const showFlow = $derived(controls === 'all' || controls === 'flow');

  function setPagePreset(preset: string): void {
    if (!page) return;
    const size = preset === 'custom'
      ? { ...page.size, preset: 'custom' as const }
      : {
          ...PAGE_PRESETS[preset as Exclude<PagePreset, 'custom'>],
          preset: preset as PagePreset,
        };
    editor.engine.execute({ type: 'page:update', payload: { pageId: page.id, changes: { size } } });
  }

  function setOrientation(orientation: Orientation): void {
    if (!page) return;
    editor.engine.execute({
      type: 'page:update',
      payload: { pageId: page.id, changes: { orientation } },
    });
  }

  function toggleOrientation(): void {
    if (!page) return;
    setOrientation(page.orientation === 'portrait' ? 'landscape' : 'portrait');
  }

  function setCustomDimension(dimension: 'width' | 'height', raw: number): void {
    if (!page || !Number.isFinite(raw)) return;
    const value = Math.max(20, Math.min(2_000, raw));
    editor.engine.execute({
      type: 'page:update',
      payload: {
        pageId: page.id,
        changes: { size: { ...page.size, preset: 'custom', [dimension]: value } },
      },
    });
  }
</script>

{#if page}
  <div
    class="exs-page-layout-controls exs-page-layout-controls--{placement} exs-page-layout-controls--{controls}"
    aria-label={`Page ${editor.activePageIndex + 1} layout`}
  >
    {#if placement === 'panel'}
      <div class="exs-page-layout-controls__heading">
        <span><IconPortrait size={14} /> Paper & flow</span>
        <small>Page {editor.activePageIndex + 1}</small>
      </div>
    {/if}

    {#if showSize}
      <label class="exs-field exs-page-layout-controls__field" title={`Paper size for page ${editor.activePageIndex + 1}`}>
        {#if placement === 'panel'}
          <span>Page size</span>
        {:else}
          <IconDocument size={14} aria-hidden="true" />
        {/if}
        <select
          aria-label={`Page ${editor.activePageIndex + 1} paper size`}
          value={page.size.preset ?? 'custom'}
          onchange={(event) => setPagePreset(event.currentTarget.value)}
        >
          {#each ['A3', 'A4', 'A5', 'Letter', 'Legal', 'custom'] as preset (preset)}
            <option value={preset}>{preset === 'custom' ? 'Custom' : preset}</option>
          {/each}
        </select>
      </label>
    {/if}

    {#if showOrientation}
      {#if placement === 'toolbar'}
        <button
          type="button"
          class="exs-btn exs-btn--icon exs-page-layout-controls__orientation"
          aria-label={`Page ${editor.activePageIndex + 1} orientation: ${page.orientation}. Switch to ${page.orientation === 'portrait' ? 'landscape' : 'portrait'}`}
          title={`Page ${editor.activePageIndex + 1}: ${page.orientation} — switch to ${page.orientation === 'portrait' ? 'landscape' : 'portrait'}`}
          onclick={toggleOrientation}
        >
          {#if page.orientation === 'portrait'}
            <IconPortrait size={15} aria-hidden="true" />
          {:else}
            <IconLandscape size={15} aria-hidden="true" />
          {/if}
        </button>
      {:else}
        <label class="exs-field exs-page-layout-controls__field" title={`Orientation for page ${editor.activePageIndex + 1}`}>
          <span>Orientation</span>
          <select
            aria-label="Page orientation"
            value={page.orientation}
            onchange={(event) => setOrientation(event.currentTarget.value as Orientation)}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
      {/if}
    {/if}

    {#if placement === 'panel' && showSize && page.size.preset === 'custom'}
      <label class="exs-field exs-page-layout-controls__field">
        <span>Width (mm)</span>
        <input
          type="number"
          min="20"
          max="2000"
          step="0.1"
          value={page.size.width}
          onchange={(event) => setCustomDimension('width', event.currentTarget.valueAsNumber)}
        />
      </label>
      <label class="exs-field exs-page-layout-controls__field">
        <span>Height (mm)</span>
        <input
          type="number"
          min="20"
          max="2000"
          step="0.1"
          value={page.size.height}
          onchange={(event) => setCustomDimension('height', event.currentTarget.valueAsNumber)}
        />
      </label>
    {/if}

    {#if showFlow}
      <button
        type="button"
        class="exs-page-layout-controls__flow"
        class:exs-page-layout-controls__flow--active={autoFlowEnabled}
        aria-label={autoFlowEnabled ? 'Disable continuous page flow' : 'Enable continuous page flow'}
        aria-pressed={autoFlowEnabled}
        title={autoFlowEnabled
          ? 'Continuous page flow is on — content continues onto generated pages'
          : 'Continuous page flow is off — pages are managed manually'}
        onclick={() => editor.toggleAutoFlow()}
      >
        <IconContinuousPages size={15} aria-hidden="true" />
        {#if placement === 'panel'}
          <span>
            <strong>Continuous page flow</strong>
            <small>{autoFlowEnabled ? 'On · content continues onto generated pages' : 'Off · pages are managed manually'}</small>
          </span>
        {/if}
      </button>
    {/if}
  </div>
{/if}
