<script lang="ts">
  import { getEditorContext } from './context.svelte.js';
  import { draggable } from './dnd.svelte.js';
  import { IconGrip } from './icons.js';
  import { isWebDocument } from '../core/web.js';

  let { showBlocks = true }: { showBlocks?: boolean } = $props();

  const editor = getEditorContext();

  const EMAIL_ATOM_TYPES = new Set(['text', 'image', 'divider', 'table', 'repeater', 'web-link']);

  const categories = $derived.by(() => {
	const webDocument = isWebDocument(editor.doc);
	const emailDocument =
		(editor.doc.meta.tags ?? []).includes('email') || (editor.doc.meta.tags ?? []).includes('email-atoms');
	return [...editor.registryCategories.entries()]
	  .filter(([category]) => category !== 'internal')
	  .map(([category, definitions]) => [
		category,
		definitions.filter((definition) => {
			if (emailDocument) return EMAIL_ATOM_TYPES.has(definition.type);
			if (webDocument && ['page-break', 'watermark'].includes(definition.type)) return false;
			return true;
		}),
	  ] as const)
	  .filter(([, definitions]) => definitions.length > 0);
  });
  const blockCategories = $derived.by(() => {
    const grouped = new Map<string, typeof editor.extensions.blocks>();
    for (const block of editor.extensions.blocks) {
      const blocks = grouped.get(block.category) ?? [];
      blocks.push(block);
      grouped.set(block.category, blocks);
    }
    return grouped;
  });

  /** Click-to-add fallback: appends to the active page body. */
  function addToBody(type: string) {
    const page = editor.activePage;
    if (!page) return;
    editor.addComponent(type, page.regions.body.id);
  }

  function addBlockToBody(blockId: string) {
    const page = editor.activePage;
    if (!page) return;
    editor.addBlock(blockId, page.regions.body.id);
  }
</script>

<h3 class="exs-panel-title">Atoms</h3>
<div class="exs-palette">
  {#each categories as [category, definitions] (category)}
    <div class="exs-palette__group">
      <div class="exs-palette__category">{category}</div>
      {#each definitions as definition (definition.type)}
        {@const Icon = editor.componentIcon(definition.type)}
        <div
          role="button"
          tabindex="0"
          class="exs-palette__item"
          title={`Drag onto the page or click to add “${definition.label}”`}
          onclick={() => addToBody(definition.type)}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              addToBody(definition.type);
            }
          }}
          {@attach draggable(() => ({ kind: 'new', componentType: definition.type }))}
        >
          <span class="exs-palette__icon">
            {#if Icon}
              <Icon size={15} />
            {:else}
              {definition.icon ?? '▫️'}
            {/if}
          </span>
          <span class="exs-palette__label">{definition.label}</span>
          <span class="exs-palette__grip" aria-hidden="true"><IconGrip size={12} /></span>
        </div>
      {/each}
    </div>
  {/each}
  {#if showBlocks}
    {#each blockCategories as [category, blocks] (`blocks:${category}`)}
      <div class="exs-palette__group exs-palette__group--blocks">
        <div class="exs-palette__category">{category} · blocks</div>
        {#each blocks as block (block.id)}
          {@const Icon = block.icon}
          <div
            role="button"
            tabindex="0"
            class="exs-palette__item exs-palette__item--block"
            title={block.description ?? `Insert ${block.label}`}
            onclick={() => addBlockToBody(block.id)}
            onkeydown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                addBlockToBody(block.id);
              }
            }}
            {@attach draggable(() => ({ kind: 'block', blockId: block.id }))}
          >
            <span class="exs-palette__icon">{#if Icon}<Icon size={15} />{:else}▫️{/if}</span>
            <span class="exs-palette__label">
              {block.label}
              {#if block.preview}<small>{block.preview}</small>{/if}
            </span>
            <span class="exs-palette__grip" aria-hidden="true"><IconGrip size={12} /></span>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>
