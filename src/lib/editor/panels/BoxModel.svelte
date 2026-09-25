<script lang="ts">
  import { getEditorContext } from '../context.svelte.js';
  import { formatBoxValues, isZeroBox, parseBoxValues, type BoxValues } from '../../shared/box.js';
  import type { ComponentNode } from '../../core/types.js';

  interface Props {
    node: ComponentNode;
  }

  let { node }: Props = $props();

  const editor = getEditorContext();

  type Layer = 'margin' | 'border' | 'padding';
  const LAYERS: Layer[] = ['margin', 'border', 'padding'];
  const PROPERTY: Record<Layer, string> = {
    margin: 'margin',
    border: 'border-width',
    padding: 'padding',
  };

  function values(layer: Layer): BoxValues {
    const binding = node.styleBindings?.find((b) => b.property === PROPERTY[layer] && b.value !== undefined);
    return parseBoxValues(binding?.value);
  }

  function setSide(layer: Layer, side: keyof BoxValues, raw: string) {
    const box = { ...values(layer), [side]: Number(raw) || 0 };
    const property = PROPERTY[layer];
    if (isZeroBox(box)) {
      editor.setStyleBinding(node.id, property, undefined);
      if (layer === 'border') editor.setStyleBinding(node.id, 'border-style', undefined);
    } else {
      editor.setStyleBinding(node.id, property, formatBoxValues(box));
      // A border width only shows with a style; keep a sensible default.
      if (layer === 'border' && !editor.getStyleBinding(node.id, 'border-style')) {
        editor.setStyleBinding(node.id, 'border-style', 'solid');
      }
    }
  }
</script>

{#snippet sideInput(layer: Layer, side: keyof BoxValues)}
  <input
    class="exs-boxmodel__input"
    type="number"
    min="0"
    value={values(layer)[side]}
    aria-label={`${layer} ${side}`}
    onchange={(e) => setSide(layer, side, e.currentTarget.value)}
  />
{/snippet}

{#snippet layerBox(layer: Layer, inner: import('svelte').Snippet | null)}
  <div class={`exs-boxmodel__layer exs-boxmodel__layer--${layer}`}>
    <span class="exs-boxmodel__label">{layer}</span>
    {@render sideInput(layer, 'top')}
    <div class="exs-boxmodel__row">
      {@render sideInput(layer, 'left')}
      {#if inner}
        {@render inner()}
      {:else}
        <div class="exs-boxmodel__content">content</div>
      {/if}
      {@render sideInput(layer, 'right')}
    </div>
    {@render sideInput(layer, 'bottom')}
  </div>
{/snippet}

{#snippet paddingLayer()}
  {@render layerBox('padding', null)}
{/snippet}

{#snippet borderLayer()}
  {@render layerBox('border', paddingLayer)}
{/snippet}

<div class="exs-boxmodel" aria-label="Box model editor">
  {@render layerBox('margin', borderLayer)}
</div>
