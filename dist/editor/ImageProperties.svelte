<script lang="ts">
  import type { ComponentNode } from '../core/types.js';
  import type { EditorContext } from './context.svelte.js';

  interface Props {
    editor: EditorContext;
    node: ComponentNode;
  }

  let { editor, node }: Props = $props();

  const htmlImage = $derived(
    node.type === 'html-element' && String(node.props.tagName ?? '').toLowerCase() === 'img',
  );
  const attributes = $derived(
    htmlImage && node.props.attributes && typeof node.props.attributes === 'object'
      && !Array.isArray(node.props.attributes)
      ? node.props.attributes as Record<string, unknown>
      : {},
  );
  const imageAssets = $derived(editor.doc.assets.filter((asset) =>
    asset.type === 'image' || asset.type === 'svg'));
  const source = $derived(String(htmlImage ? attributes.src ?? '' : node.props.src ?? ''));
  const alt = $derived(String(htmlImage ? attributes.alt ?? '' : node.props.alt ?? ''));
  const currentAsset = $derived(imageAssets.find((asset) => asset.src === source));
  const sourceFileName = $derived(source.split(/[?#]/, 1)[0]?.split('/').pop()?.toLowerCase() ?? '');
  const matchingAsset = $derived(!currentAsset && sourceFileName
    ? imageAssets.find((asset) => asset.name.toLowerCase() === sourceFileName)
    : undefined);
  const assetChoice = $derived(currentAsset?.id ?? (source ? '__custom' : ''));

  function updateValue(name: string, value: string, keepEmpty = false): void {
    if (!htmlImage) {
      editor.updateProps(node.id, { [name]: value });
      return;
    }
    const updated = { ...attributes };
    if (value || keepEmpty) updated[name] = value;
    else delete updated[name];
    editor.updateProps(node.id, { attributes: updated });
  }

  function chooseAsset(value: string): void {
    if (!value || value === '__custom') return;
    editor.applyAssetToImage(value, node.id);
  }

  function setSource(value: string): void {
    if (!value.trim() && currentAsset) return;
    updateValue('src', value.trim());
  }

  function styleValue(property: string): string {
    return editor.getStyleBinding(node.id, property) ?? '';
  }
</script>

<div class="exs-image-editor">
  <div class="exs-image-preview" class:exs-image-preview--empty={!source}>
    {#if source}
      <img src={source} alt="" />
    {:else}
      <span>No image selected</span>
    {/if}
    <div>
      <strong>{currentAsset?.name ?? (source ? 'Imported or external image' : 'Choose an image')}</strong>
      <span>{currentAsset ? 'Uploaded asset' : (source || 'No source')}</span>
    </div>
  </div>

  <label class="exs-field">
    <span class="exs-field__label">Uploaded image</span>
    <select
      value={assetChoice}
      aria-label="Uploaded image"
      onchange={(event) => chooseAsset(event.currentTarget.value)}
    >
      <option value="">Choose an uploaded image…</option>
      {#if source && !currentAsset}<option value="__custom">Current imported image</option>{/if}
      {#each imageAssets as asset (asset.id)}
        <option value={asset.id}>{asset.name}</option>
      {/each}
    </select>
    <span class="exs-field__help">
      You can also select an image here, then click an asset in the Assets panel to replace it.
    </span>
    {#if matchingAsset}
      <button
        type="button"
        class="exs-btn exs-image-use-match"
        onclick={() => editor.applyAssetToImage(matchingAsset.id, node.id)}
      >Use matching upload: {matchingAsset.name}</button>
    {/if}
  </label>

  <label class="exs-field">
    <span class="exs-field__label">Alternative text</span>
    <input
      type="text"
      value={alt}
      placeholder="Describe the image for screen readers"
      onchange={(event) => updateValue('alt', event.currentTarget.value, true)}
    />
    <span class="exs-field__help">Leave empty only when the image is purely decorative.</span>
  </label>

  <div class="exs-image-controls">
    <label class="exs-field">
      <span class="exs-field__label">Fit</span>
      <select
        value={styleValue('object-fit')}
        onchange={(event) => editor.setStyleBinding(node.id, 'object-fit', event.currentTarget.value || undefined)}
      >
        <option value="">From template</option>
        <option value="cover">Crop to fill</option>
        <option value="contain">Fit entire image</option>
        <option value="fill">Stretch to fill</option>
        <option value="none">Original size</option>
        <option value="scale-down">Scale down only</option>
      </select>
    </label>
    <label class="exs-field">
      <span class="exs-field__label">Position</span>
      <select
        value={styleValue('object-position')}
        onchange={(event) => editor.setStyleBinding(node.id, 'object-position', event.currentTarget.value || undefined)}
      >
        <option value="">From template</option>
        <option value="center">Center</option>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
        <option value="left top">Top left</option>
        <option value="right top">Top right</option>
        <option value="left bottom">Bottom left</option>
        <option value="right bottom">Bottom right</option>
      </select>
    </label>
    <label class="exs-field">
      <span class="exs-field__label">Shape</span>
      <select
        value={styleValue('border-radius')}
        onchange={(event) => editor.setStyleBinding(node.id, 'border-radius', event.currentTarget.value || undefined)}
      >
        <option value="">From template</option>
        <option value="0">Square</option>
        <option value="4px">Slightly rounded</option>
        <option value="8px">Rounded</option>
        <option value="16px">Very rounded</option>
        <option value="9999px">Circle / pill</option>
      </select>
    </label>
    <label class="exs-field">
      <span class="exs-field__label">Aspect ratio</span>
      <select
        value={styleValue('aspect-ratio')}
        onchange={(event) => editor.setStyleBinding(node.id, 'aspect-ratio', event.currentTarget.value || undefined)}
      >
        <option value="">From template</option>
        <option value="auto">Natural</option>
        <option value="1 / 1">Square (1:1)</option>
        <option value="4 / 5">Portrait (4:5)</option>
        <option value="4 / 3">Landscape (4:3)</option>
        <option value="3 / 2">Photo (3:2)</option>
        <option value="16 / 9">Widescreen (16:9)</option>
      </select>
    </label>
  </div>

  <details class="exs-details exs-image-advanced">
    <summary>Image source and browser options</summary>
    <div class="exs-image-advanced__body">
      <label class="exs-field">
        <span class="exs-field__label">Image URL</span>
        <input
          type="text"
          value={currentAsset ? '' : source}
          placeholder={currentAsset ? `Embedded asset: ${currentAsset.name}` : 'https://example.com/image.jpg'}
          onchange={(event) => setSource(event.currentTarget.value)}
        />
      </label>

      {#if htmlImage}
        <label class="exs-field">
          <span class="exs-field__label">Tooltip</span>
          <input type="text" value={String(attributes.title ?? '')} onchange={(event) => updateValue('title', event.currentTarget.value)} />
        </label>
        <div class="exs-image-controls">
          <label class="exs-field">
            <span class="exs-field__label">Loading</span>
            <select value={String(attributes.loading ?? '')} onchange={(event) => updateValue('loading', event.currentTarget.value)}>
              <option value="">Browser default</option>
              <option value="lazy">Lazy</option>
              <option value="eager">Eager</option>
            </select>
          </label>
          <label class="exs-field">
            <span class="exs-field__label">Decoding</span>
            <select value={String(attributes.decoding ?? '')} onchange={(event) => updateValue('decoding', event.currentTarget.value)}>
              <option value="">Browser default</option>
              <option value="async">Async</option>
              <option value="sync">Sync</option>
              <option value="auto">Auto</option>
            </select>
          </label>
          <label class="exs-field">
            <span class="exs-field__label">Original width</span>
            <input type="number" min="1" value={String(attributes.width ?? '')} placeholder="Auto" onchange={(event) => updateValue('width', event.currentTarget.value)} />
          </label>
          <label class="exs-field">
            <span class="exs-field__label">Original height</span>
            <input type="number" min="1" value={String(attributes.height ?? '')} placeholder="Auto" onchange={(event) => updateValue('height', event.currentTarget.value)} />
          </label>
        </div>
      {/if}
    </div>
  </details>
</div>
