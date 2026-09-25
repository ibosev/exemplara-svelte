<script lang="ts">
  import { IconLogo } from '../icons.js';
  import type { EditorToolbarClusterProps } from '../extension-types.js';

  let { editor }: EditorToolbarClusterProps = $props();
  const brand = $derived(editor.host.brand);
</script>

<div class="exs-toolbar__group">
  <button
    type="button"
    class="exs-toolbar__logo"
    title={brand?.label ?? 'Exemplara'}
    aria-label={brand?.onClick ? `Open ${brand.label ?? 'brand home'}` : (brand?.label ?? 'Exemplara')}
    disabled={!brand?.onClick}
    onclick={() => brand?.onClick?.()}
  >
    {#if brand?.logoUrl}
      <img src={brand.logoUrl} alt="" />
    {:else if brand?.mark}
      <span>{brand.mark}</span>
    {:else}
      <IconLogo size={18} />
    {/if}
  </button>
  {#if brand?.label}<span class="exs-toolbar__brand-label">{brand.label}</span>{/if}
  <input
    class="exs-toolbar__name"
    type="text"
    aria-label="Document name"
    value={editor.doc.name}
    onchange={(event) => editor.engine.execute({
      type: 'document:update',
      payload: { changes: { name: event.currentTarget.value } },
    })}
  />
</div>
