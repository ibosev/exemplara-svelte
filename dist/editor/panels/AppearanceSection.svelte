<script lang="ts">
  import { parseColor, toHex } from '../../shared/color.js';
  import { getEditorContext } from '../context.svelte.js';
  import { friendlyElementLabel } from '../friendly-labels.js';

  const editor = getEditorContext();
  const node = $derived(editor.selectedNode);
  const revision = $derived(editor.engineRevision);

  function bound(property: string): string {
    revision;
    if (!node) return '';
    return node.styleBindings?.find((binding) => binding.property === property && binding.value !== undefined)?.value ?? '';
  }

  function swatch(value: string): string | null {
    const rgb = parseColor(value);
    return rgb ? toHex(rgb) : null;
  }

  function setColor(property: string, value: string): void {
    if (!node) return;
    const hex = value.trim();
    if (!hex) {
      editor.setStyleBinding(node.id, property, undefined);
      if (property === 'background-color') editor.setStyleBinding(node.id, 'background', undefined);
      return;
    }
    editor.setStyleBinding(node.id, property, hex);
    if (property === 'background-color') editor.setStyleBinding(node.id, 'background', hex);
  }

  const background = $derived(bound('background-color') || bound('background'));
  const textColor = $derived(bound('color'));
  const backgroundSwatch = $derived(swatch(background));
  const textSwatch = $derived(swatch(textColor));
</script>

{#if node}
  <div class="exs-appearance">
    <p class="exs-appearance__lede">Change how this {friendlyElementLabel(node).toLowerCase()} looks. These colors apply only to the selected block.</p>
    <div class="exs-appearance__row">
      <span class="exs-appearance__label">Background</span>
      <div class="exs-field__color">
        <input
          type="color"
          value={backgroundSwatch ?? '#ffffff'}
          aria-label="Background color"
          oninput={(event) => setColor('background-color', event.currentTarget.value)}
        />
        <input
          type="text"
          value={background}
          placeholder="From template"
          aria-label="Background color value"
          oninput={(event) => setColor('background-color', event.currentTarget.value)}
        />
        {#if background}
          <button type="button" class="exs-appearance__clear" onclick={() => setColor('background-color', '')}>Reset</button>
        {/if}
      </div>
    </div>
    <div class="exs-appearance__row">
      <span class="exs-appearance__label">Text</span>
      <div class="exs-field__color">
        <input
          type="color"
          value={textSwatch ?? '#111111'}
          aria-label="Text color"
          oninput={(event) => setColor('color', event.currentTarget.value)}
        />
        <input
          type="text"
          value={textColor}
          placeholder="From template"
          aria-label="Text color value"
          oninput={(event) => setColor('color', event.currentTarget.value)}
        />
        {#if textColor}
          <button type="button" class="exs-appearance__clear" onclick={() => setColor('color', '')}>Reset</button>
        {/if}
      </div>
    </div>
  </div>
{/if}
