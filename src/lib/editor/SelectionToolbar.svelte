<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getEditorContext } from './context.svelte.js';
  import { placeFloatingControls, type FloatingControlsPlacement } from '../shared/floating-controls.js';
  import { IconMore } from './icons.js';

  const editor = getEditorContext();
  const contextMenuEnabled = editor.hasPlugin('exemplara.action-surfaces');
  const node = $derived(editor.selectedNode);
  const definition = $derived(editor.selectedDefinition);
  const inlineActions = $derived(node
    ? editor.extensions.menuItems('node.inline', editor, { nodeId: node.id })
    : []);
  const toolbarSignature = $derived([
    node?.id ?? '',
    node?.locked ? 'locked' : '',
    ...inlineActions.map((action) => action.id),
  ].join('|'));

  let toolbar = $state<HTMLElement | null>(null);
  let placement = $state<FloatingControlsPlacement>({ mode: 'hidden', side: 'viewport', x: 0, y: 0 });
  let fullWidth = 0;
  let measuredSignature = '';
  let updateFrame = 0;
  let resizeObserver: ResizeObserver | null = null;

  function selectedElement(): HTMLElement | null {
    if (!node || !editor.canvasSurface) return null;
    return editor.canvasSurface.querySelector<HTMLElement>(
      `[data-node-id="${CSS.escape(node.id)}"]`,
    );
  }

  function updatePosition(): void {
    updateFrame = 0;
    const target = selectedElement();
    const page = target?.closest<HTMLElement>('.exs-page, .exs-web-page');
    const surface = editor.canvasSurface;
    if (!target || !page || !surface || !toolbar || editor.editingId || editor.contextMenu) {
      placement = { mode: 'hidden', side: 'viewport', x: 0, y: 0 };
      return;
    }
    if (placement.mode !== 'compact') fullWidth = Math.max(fullWidth, toolbar.getBoundingClientRect().width);
    const height = toolbar.getBoundingClientRect().height || 26;
    placement = placeFloatingControls(
      target.getBoundingClientRect(),
      page.getBoundingClientRect(),
      surface.getBoundingClientRect(),
      fullWidth || 112,
      height,
    );
  }

  function schedulePosition(): void {
    if (updateFrame) cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(updatePosition);
  }

  function openActions(event: MouseEvent): void {
    if (!node) return;
    event.stopPropagation();
    const rect = event.currentTarget instanceof HTMLElement
      ? event.currentTarget.getBoundingClientRect()
      : { right: event.clientX, bottom: event.clientY };
    editor.openContextMenu(rect.right, rect.bottom + 4, node.id);
  }

  function runAction(commandId: string): void {
    if (!node) return;
    void editor.runCommand(commandId, { nodeId: node.id });
  }

  $effect(() => {
    const signature = toolbarSignature;
    if (signature !== measuredSignature) {
      measuredSignature = signature;
      fullWidth = 0;
      // Render the complete button set for one layout pass before deciding
      // whether this selection needs the compact gutter control.
      placement = { mode: 'hidden', side: 'viewport', x: 0, y: 0 };
    }
    editor.selectedId;
    editor.engineRevision;
    editor.zoom;
    editor.editingId;
    editor.contextMenu;
    void tick().then(() => {
      resizeObserver?.disconnect();
      const target = selectedElement();
      if (target) resizeObserver?.observe(target);
      if (editor.canvasSurface) resizeObserver?.observe(editor.canvasSurface);
      schedulePosition();
    });
  });

  onMount(() => {
    const surface = editor.canvasSurface;
    resizeObserver = new ResizeObserver(schedulePosition);
    surface?.addEventListener('scroll', schedulePosition, { passive: true });
    window.addEventListener('resize', schedulePosition);
    schedulePosition();
    return () => {
      if (updateFrame) cancelAnimationFrame(updateFrame);
      resizeObserver?.disconnect();
      surface?.removeEventListener('scroll', schedulePosition);
      window.removeEventListener('resize', schedulePosition);
    };
  });
</script>

{#if node && definition && !editor.editingId && (inlineActions.length > 0 || contextMenuEnabled)}
  <div
    bind:this={toolbar}
    class="exs-selection-toolbar"
    class:exs-selection-toolbar--compact={placement.mode === 'compact'}
    data-side={placement.side}
    role="toolbar"
    aria-label={`${definition.label} actions`}
    title={placement.mode === 'compact' ? `${definition.label} actions` : undefined}
    style:left={`${placement.x}px`}
    style:top={`${placement.y}px`}
    style:visibility={placement.mode === 'hidden' ? 'hidden' : 'visible'}
  >
    {#if placement.mode === 'compact' && contextMenuEnabled}
      <button type="button" title="More actions" aria-label={`More actions for ${definition.label}`} onclick={openActions}><IconMore size={13} /></button>
    {:else}
      {#each inlineActions as action (action.id)}
        {@const ActionIcon = action.command.icon ?? IconMore}
        <button
          type="button"
          title={action.command.label}
          aria-label={`${action.command.label} ${definition.label}`}
          onclick={() => runAction(action.command.id)}
        ><ActionIcon size={12} /></button>
      {/each}
      {#if contextMenuEnabled}
        <button type="button" title="More actions" aria-label={`More actions for ${definition.label}`} onclick={openActions}><IconMore size={13} /></button>
      {/if}
    {/if}
  </div>
{/if}
