<script lang="ts">
  import NodeView from './NodeView.svelte';
  import RichTextEditor from './RichTextEditor.svelte';
  import { getEditorContext } from './context.svelte.js';
  import { draggable, dropzone, dragState, type DropTarget } from './dnd.svelte.js';
  import { resolveDropPosition, dropTargetFor } from '../shared/drop.js';
  import type { RenderContext } from '../renderer/registry.js';
  import {
    evaluateCondition,
    resolveNodeData,
    resolvePath,
    type DataContext,
  } from '../renderer/data.js';
  import {
    columnPresentation,
    columnsPresentation,
    containerPresentation,
    nodePresentation,
  } from '../renderer/presentation.js';
  import { styleString } from '../renderer/escape.js';
  import {
    losslessHtmlAttributes,
    losslessHtmlTag,
    webSectionAttributes,
    webSectionTag,
  } from '../renderer/web-components.js';
  import { isWebDocument, resolveWebRouteHref, usesImportedSiteChrome } from '../core/web.js';
  import { sampleDataBySource } from '../shared/data-browser.js';
  import type { ComponentNode } from '../core/types.js';

  interface Props {
    node: ComponentNode;
    parentId: string;
    index: number;
    slot?: string;
    dataContext?: DataContext;
    pageIndex?: number;
    totalPages?: number;
  }

  let { node, parentId, index, slot, dataContext, pageIndex, totalPages }: Props = $props();

  const editor = getEditorContext();

  const definition = $derived(editor.getDefinition(node.type));
  const isContainer = $derived(definition?.acceptsChildren === true);
  const isRepeater = $derived(node.type === 'repeater');
  const isConditional = $derived(node.type === 'conditional');
  const isPlainContainer = $derived(isContainer && !isRepeater && !isConditional);
  const hasSlots = $derived(!!definition?.slots);
  const isSelected = $derived(editor.selectedId === node.id);
  const isHovered = $derived(editor.hoveredId === node.id);
  const isEditing = $derived(editor.editingId === node.id);
  const isRichText = $derived(definition?.propSchema.content?.type === 'richtext');
  const losslessHtmlMode = $derived(editor.doc.meta.web?.importMode === 'lossless-html');
  const importedSiteChrome = $derived(usesImportedSiteChrome(editor.doc.meta.web));
  const isHtmlElement = $derived(losslessHtmlMode && node.type === 'html-element');
  const isHtmlText = $derived(losslessHtmlMode && node.type === 'html-text');
  const isImportedWebSection = $derived(importedSiteChrome && node.type === 'web-section');
  const currentDataContext = $derived(dataContext ?? editor.getDataContext());
  const currentPageIndex = $derived(pageIndex ?? editor.activePageIndex);
  const currentTotalPages = $derived(totalPages ?? editor.doc.pages.length);
  const dataResolutionEnabled = $derived(
    editor.isProvidedCapabilityEnabled('data.resolve') && editor.dataPreviewEnabled,
  );
  const sources = $derived(dataResolutionEnabled
    ? sampleDataBySource(editor.doc.dataSources)
    : {});
  const resolvedNode = $derived(dataResolutionEnabled
    ? resolveNodeData(
        node,
        currentDataContext,
        sources,
        editor.expressionRuntime,
        editor.renderRuntime.transforms,
      )
    : node);
  const containerView = $derived(containerPresentation(resolvedNode));
  const columnsView = $derived(columnsPresentation(resolvedNode));
  const repeaterView = $derived(nodePresentation(resolvedNode, 'ex-repeater'));
  const conditionalView = $derived(nodePresentation(resolvedNode, 'ex-conditional'));
  const htmlTag = $derived(isImportedWebSection ? webSectionTag(resolvedNode) : losslessHtmlTag(resolvedNode));
  const htmlAttributes = $derived(isImportedWebSection
    ? webSectionAttributes(resolvedNode, dataResolutionEnabled)
    : losslessHtmlAttributes(resolvedNode, dataResolutionEnabled));

  /**
   * Empty containers that carry real geometry (absolute accents, logo tiles)
   * are decorative chrome — not drop targets. Showing "Drop components here"
   * plus empty min-height/padding destroys print fidelity on HTML import.
   */
  const isDecorativeEmptyContainer = $derived.by(() => {
    if (!isPlainContainer || (resolvedNode.children ?? []).length > 0) return false;
    const style = containerView.style;
    const position = String(style.position ?? '');
    if (position === 'absolute' || position === 'fixed') return true;
    const hasBox =
      (style.width !== undefined && style.width !== '')
      || (style.height !== undefined && style.height !== '')
      || (style['min-width'] !== undefined && style['min-width'] !== '')
      || (style['min-height'] !== undefined && style['min-height'] !== '');
    const hasFill =
      (style.background !== undefined && style.background !== '')
      || (style['background-color'] !== undefined && style['background-color'] !== '')
      || (style.border !== undefined && style.border !== '');
    return hasBox && hasFill;
  });

  /**
   * `.exs-node` is always `position: relative` for selection chrome. That makes
   * it the containing block for absolutely positioned containers, so the
   * absolute styles must live on the outer wrapper — otherwise accents pin to
   * a zero-height shell at the start of the parent flex flow (orange bar on top).
   */
  const nodeShellStyle = $derived.by(() => {
    if (!isPlainContainer) return undefined;
    const style = containerView.style;
    const position = String(style.position ?? '');
    if (position !== 'absolute' && position !== 'fixed') return undefined;
    const keys = [
      'position', 'top', 'right', 'bottom', 'left', 'inset', 'z-index',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    ] as const;
    const shell: Record<string, string | number | undefined> = {};
    for (const key of keys) {
      if (style[key] !== undefined && style[key] !== '') shell[key] = style[key];
    }
    return styleString(shell) || undefined;
  });

  const conditionalVisible = $derived.by(() => {
    if (!isConditional) return true;
    if (!dataResolutionEnabled) return true;
    const conditions = Array.isArray(resolvedNode.props.conditions)
      ? resolvedNode.props.conditions as Array<{ field: string; operator?: string; value?: unknown }>
      : [];
    const logic = String(resolvedNode.props.conditionLogic ?? 'and');
    const matches = conditions.length === 0 || (logic === 'or'
      ? conditions.some((condition) => evaluateCondition(
          currentDataContext,
          condition.field,
          (condition.operator ?? 'exists') as Parameters<typeof evaluateCondition>[2],
          condition.value,
        ))
      : conditions.every((condition) => evaluateCondition(
          currentDataContext,
          condition.field,
          (condition.operator ?? 'exists') as Parameters<typeof evaluateCondition>[2],
          condition.value,
        )));
    return matches === (resolvedNode.props.showWhen !== false);
  });

  const repeatedContexts = $derived.by(() => {
    if (!isRepeater) return [];
    if (!dataResolutionEnabled) return [currentDataContext];
    const path = String(resolvedNode.props.path ?? '');
    const value = path ? resolvePath(currentDataContext, path) : undefined;
    let items = Array.isArray(value) ? value : [];
    const maxItems = Number(resolvedNode.props.maxItems) || 0;
    if (maxItems > 0) items = items.slice(0, maxItems);
    return items.map((item, repeatedIndex) => ({
      ...currentDataContext,
      ...(item && typeof item === 'object' && !Array.isArray(item) ? item as DataContext : {}),
      item,
      index: repeatedIndex,
      count: items.length,
      first: repeatedIndex === 0,
      last: repeatedIndex === items.length - 1,
      '@index': repeatedIndex,
      '@first': repeatedIndex === 0,
      '@last': repeatedIndex === items.length - 1,
    }));
  });

  // Drop indicator states derived from the shared drag store.
  const dropBefore = $derived(
    dragState.over?.parentId === parentId && dragState.over.index === index && dragState.over.slot === slot,
  );
  const dropInside = $derived(dragState.over?.parentId === node.id);

  /**
   * Leaf nodes reuse the string renderer so the canvas matches print
   * output exactly. The normal canvas resolves sample-data bindings; the
   * contenteditable session still receives the author-owned raw node.
   */
  const leafHtml = $derived.by(() => {
    if (isContainer || hasSlots) return '';
    const entry = editor.renderRuntime.renderers.get(node.type);
    if (!entry) return `<em style="color:#999">unknown: ${node.type}</em>`;
    const ctx: RenderContext = {
      dataContext: currentDataContext,
      sources,
      resolveData: dataResolutionEnabled,
      pageIndex: currentPageIndex,
      totalPages: currentTotalPages,
      expressionRuntime: editor.expressionRuntime,
      renderers: editor.renderRuntime.renderers,
      transforms: editor.renderRuntime.transforms,
      renderChildren: () => '',
    };
    try {
      return entry.render(resolvedNode, '', ctx);
    } catch {
      return `<em style="color:#c00">render error: ${node.type}</em>`;
    }
  });

  function resolveDropTarget(event: DragEvent): DropTarget | null {
    if (node.locked) return null;
    // Never allow dropping a node into itself.
    if (dragState.active?.kind === 'move' && dragState.active.nodeId === node.id) return null;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const position = resolveDropPosition(event.clientY, rect, isContainer);
    return dropTargetFor(position, {
      parentId,
      index,
      slot,
      nodeId: node.id,
      childCount: node.children?.length ?? 0,
    });
  }

  function onClick(event: MouseEvent) {
    event.stopPropagation();
    const href = (event.target as HTMLElement | null)?.closest?.('a')?.getAttribute('href');
    if (href && isWebDocument(editor.doc)) {
      const routeIndex = resolveWebRouteHref(editor.doc, href);
      if (routeIndex !== null) {
        event.preventDefault();
        editor.activePageIndex = routeIndex;
      }
    }
    editor.select(node.id);
  }

  function onDblClick(event: MouseEvent) {
    if (!isRichText || node.locked) return;
    event.stopPropagation();
    editor.beginRichTextEdit(node.id);
  }

  function onContextMenu(event: MouseEvent) {
    if (!editor.hasPlugin('exemplara.action-surfaces')) return;
    event.preventDefault();
    event.stopPropagation();
    editor.openContextMenu(event.clientX, event.clientY, node.id);
  }

  function onMouseOver(event: MouseEvent) {
    event.stopPropagation();
    editor.hoveredId = node.id;
  }

  function onMouseOut() {
    if (editor.hoveredId === node.id) editor.hoveredId = null;
  }

</script>

{#if isHtmlText}
  {String(resolvedNode.props.content ?? '')}
{:else if isHtmlElement || isImportedWebSection}
  <svelte:element
    this={htmlTag}
    {...htmlAttributes}
    data-node-id={node.id}
    data-exs-selected={isSelected ? 'true' : undefined}
    data-exs-hovered={isHovered && !isSelected ? 'true' : undefined}
    onclick={onClick}
    ondblclick={onDblClick}
    oncontextmenu={onContextMenu}
    onmouseover={onMouseOver}
    onmouseout={onMouseOut}
    {@attach draggable(() => ({ kind: 'move', nodeId: node.id }))}
    {@attach dropzone(() => ({ editor, target: resolveDropTarget }))}
  >
    {#each node.children ?? [] as child, childIndex (child.id)}
      <NodeView node={child} parentId={node.id} index={childIndex} dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
    {/each}
  </svelte:element>
{:else if importedSiteChrome && isRepeater}
  {#each repeatedContexts as repeatedData, repeatedIndex (repeatedIndex)}
    {#each node.children ?? [] as child, childIndex (`${repeatedIndex}:${child.id}`)}
      <NodeView node={child} parentId={node.id} index={childIndex} dataContext={repeatedData} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
    {/each}
  {/each}
{:else if importedSiteChrome && isConditional}
  {#if conditionalVisible}
    {#each node.children ?? [] as child, childIndex (child.id)}
      <NodeView node={child} parentId={node.id} index={childIndex} dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
    {/each}
  {:else}
    {#each node.slots?.else ?? [] as child, childIndex (child.id)}
      <NodeView node={child} parentId={node.id} index={childIndex} slot="else" dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
    {/each}
  {/if}
{:else}
{#if dropBefore}
  <div class="exs-drop-indicator"></div>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_mouse_events_have_key_events -->
<div
  class="exs-node"
  class:exs-node--selected={isSelected}
  class:exs-node--hovered={isHovered && !isSelected}
  class:exs-node--locked={node.locked}
  class:exs-node--hidden-flag={node.hidden}
  class:exs-node--symbol={!!node.symbolId}
  class:exs-node--editing={isEditing}
  class:exs-node--decorative-empty={isDecorativeEmptyContainer}
  data-node-id={node.id}
  style={nodeShellStyle}
  onclick={onClick}
  ondblclick={onDblClick}
  oncontextmenu={onContextMenu}
  onmouseover={onMouseOver}
  onmouseout={onMouseOut}
  {@attach draggable(() => ({ kind: 'move', nodeId: node.id }))}
  {@attach dropzone(() => ({ editor, target: resolveDropTarget }))}
>
  {#if isEditing}
    <RichTextEditor {node} />
  {:else if isPlainContainer}
    {@const children = node.children ?? []}
    {@const showEmptyChrome = children.length === 0 && !isDecorativeEmptyContainer}
    <div
      class={containerView.classes.join(' ')}
      class:exs-node__container--empty={showEmptyChrome}
      class:exs-node__container--decorative={isDecorativeEmptyContainer}
      class:exs-region--droptarget={dropInside && !isDecorativeEmptyContainer}
      data-node-id={node.id}
      id={String(resolvedNode.props.htmlId ?? '') || undefined}
      style={styleString(containerView.style)}
    >
      {#if showEmptyChrome}
        <span>Drop components here</span>
      {:else if children.length > 0}
        {#each children as child, childIndex (child.id)}
          <NodeView node={child} parentId={node.id} index={childIndex} dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
        {/each}
      {/if}
    </div>
  {:else if hasSlots && definition?.slots}
    <div class={columnsView.classes.join(' ')} data-node-id={node.id} style={styleString(columnsView.style)}>
      {#each Object.entries(definition.slots) as [slotName, slotConfig] (slotName)}
        {@const slotChildren = node.slots?.[slotName] ?? []}
        {@const slotIndex = Number(slotName.replace(/\D+/g, '')) - 1}
        {@const columnView = columnPresentation(resolvedNode.props.ratios, resolvedNode.props.gap, slotIndex)}
        <div
          class={`${columnView.classes.join(' ')} exs-node__slot`}
          class:exs-node__container--empty={slotChildren.length === 0}
          class:exs-region--droptarget={dragState.over?.parentId === node.id && dragState.over.slot === slotName}
          style={styleString(columnView.style)}
          {@attach dropzone(() => ({
            editor,
            target: () => ({ parentId: node.id, slot: slotName, index: node.slots?.[slotName]?.length ?? 0 }),
          }))}
        >
          {#if slotChildren.length === 0}
            <span>{slotConfig.label ?? slotName}</span>
          {:else}
            {#each slotChildren as child, childIndex (child.id)}
              <NodeView node={child} parentId={node.id} index={childIndex} slot={slotName} dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {:else if isRepeater}
    <div class={repeaterView.classes.join(' ')} data-node-id={node.id} style={styleString(repeaterView.style)}>
      {#each repeatedContexts as repeatedData, repeatedIndex (repeatedIndex)}
        {#each node.children ?? [] as child, childIndex (`${repeatedIndex}:${child.id}`)}
          <NodeView node={child} parentId={node.id} index={childIndex} dataContext={repeatedData} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
        {/each}
      {/each}
    </div>
  {:else if isConditional}
    <div class={conditionalView.classes.join(' ')} data-node-id={node.id} style={styleString(conditionalView.style)}>
      {#if conditionalVisible}
        {#each node.children ?? [] as child, childIndex (child.id)}
          <NodeView node={child} parentId={node.id} index={childIndex} dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
        {/each}
      {:else}
        {#each node.slots?.else ?? [] as child, childIndex (child.id)}
          <NodeView node={child} parentId={node.id} index={childIndex} slot="else" dataContext={currentDataContext} pageIndex={currentPageIndex} totalPages={currentTotalPages} />
        {/each}
      {/if}
    </div>
  {:else}
    {@html leafHtml}
  {/if}
</div>
{/if}
