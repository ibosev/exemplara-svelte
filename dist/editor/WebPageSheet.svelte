<script lang="ts">
  import { cssCustomPropertyDeclarations, stripCssCustomProperties } from '../core/custom-css-tokens.js';
  import { DEFAULT_WEB_DOCUMENT_SETTINGS, usesImportedSiteChrome } from '../core/web.js';
  import type { Page } from '../core/types.js';
  import RegionView from './RegionView.svelte';
  import NodeView from './NodeView.svelte';
  import { getEditorContext } from './context.svelte.js';

  interface Props {
    page: Page;
    index: number;
    zoom: number;
    onpageelement?: (pageId: string, element: HTMLElement | null) => void;
  }

  let { page, index, zoom, onpageelement }: Props = $props();
  const editor = getEditorContext();
  const web = $derived({ ...DEFAULT_WEB_DOCUMENT_SETTINGS, ...(editor.doc.meta.web ?? {}) });
  const active = $derived(editor.activePageIndex === index);
  const losslessHtml = $derived(usesImportedSiteChrome(web));
  const dataContext = $derived({
    ...editor.getDataContext(),
    page: { number: index + 1, total: editor.doc.pages.length },
  });
  const pageClassName = $derived((page.web?.className ?? '').split(/\s+/).filter((name) => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)).join(' '));
  const pageInlineStyle = $derived.by(() => {
    editor.engineRevision;
    if (!losslessHtml) return undefined;
    const authored = stripCssCustomProperties(page.web?.inlineStyle ?? '');
    const tokens = cssCustomPropertyDeclarations(editor.doc.styles.tokens.colors);
    return [authored, tokens].filter(Boolean).join('; ') || undefined;
  });

  function bindPage(element: HTMLElement) {
    onpageelement?.(page.id, element);
    return { destroy: () => onpageelement?.(page.id, null) };
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<section
  class="exs-web-page-shell"
  class:exs-web-page-shell--active={active}
  style:width={`${web.viewportWidth * zoom}px`}
  style:min-height={`${web.minHeight * zoom}px`}
  style:background={web.canvasBackground}
  onclick={(event) => {
    event.stopPropagation();
    editor.activePageIndex = index;
  }}
  onmousedown={() => (editor.activePageIndex = index)}
>
  <div class="exs-web-page-shell__label">
    <strong>{page.label}</strong>
    <span>/{page.web?.slug ?? ''}</span>
    <em>{web.viewportWidth}px</em>
  </div>
  <main
    class={`exs-web-page ${pageClassName}`.trim()}
    class:exs-web-page--active={active}
    data-page-id={page.id}
    data-page-index={index}
    id={losslessHtml ? page.web?.htmlId || undefined : undefined}
    style={pageInlineStyle}
    style:width={`${web.viewportWidth}px`}
    style:min-height={`${web.minHeight}px`}
    style:background={losslessHtml ? undefined : web.bodyBackground}
    style:container-type="inline-size"
    style:container-name="exemplara-page-preview"
    style:zoom={zoom}
    use:bindPage
  >
    {#if losslessHtml}
      {#each web.header?.children ?? [] as child, childIndex (child.id)}
        <NodeView
          node={child}
          parentId={web.header!.id}
          index={childIndex}
          {dataContext}
          pageIndex={index}
          totalPages={editor.doc.pages.length}
        />
      {/each}
      {#each page.regions.body.children as child, childIndex (child.id)}
        <NodeView
          node={child}
          parentId={page.regions.body.id}
          index={childIndex}
          {dataContext}
          pageIndex={index}
          totalPages={editor.doc.pages.length}
        />
      {/each}
      {#each web.footer?.children ?? [] as child, childIndex (child.id)}
        <NodeView
          node={child}
          parentId={web.footer!.id}
          index={childIndex}
          {dataContext}
          pageIndex={index}
          totalPages={editor.doc.pages.length}
        />
      {/each}
    {:else if page.regions.background}
      <RegionView region={page.regions.background} name="background" {dataContext} pageIndex={index} totalPages={editor.doc.pages.length} />
      <RegionView region={page.regions.body} name="body" {dataContext} pageIndex={index} totalPages={editor.doc.pages.length} />
    {:else}
      {#if web.header}
        <RegionView region={web.header} name="header" {dataContext} pageIndex={index} totalPages={editor.doc.pages.length} />
      {/if}
      <RegionView region={page.regions.body} name="body" {dataContext} pageIndex={index} totalPages={editor.doc.pages.length} />
      {#if web.footer}
        <RegionView region={web.footer} name="footer" {dataContext} pageIndex={index} totalPages={editor.doc.pages.length} />
      {/if}
    {/if}
  </main>
</section>
