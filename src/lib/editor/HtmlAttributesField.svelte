<script lang="ts">
  interface Props {
    value: unknown;
    onchange: (value: Record<string, string>) => void;
    exclude?: readonly string[];
    label?: string;
  }

  let { value, onchange, exclude = [], label = 'Attributes' }: Props = $props();

  const attributes = $derived(
    value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {},
  );
  const excluded = $derived(new Set(exclude.map((name) => name.toLowerCase())));
  const entries = $derived(Object.entries(attributes)
    .filter(([name]) => !excluded.has(name.toLowerCase()))
    .map(([name, item]) => [name, String(item ?? '')] as const));

  function nextName(): string {
    let suffix = 1;
    while (attributes[suffix === 1 ? 'data-attribute' : `data-attribute-${suffix}`] !== undefined) suffix += 1;
    return suffix === 1 ? 'data-attribute' : `data-attribute-${suffix}`;
  }

  function addAttribute(): void {
    onchange({ ...attributes, [nextName()]: '' } as Record<string, string>);
  }

  function renameAttribute(previous: string, next: string): void {
    const normalized = next.trim().toLowerCase();
    if (!normalized || normalized === previous) return;
    const updated: Record<string, string> = {};
    for (const [name, item] of Object.entries(attributes)) {
      updated[name === previous ? normalized : name] = String(item ?? '');
    }
    onchange(updated);
  }

  function updateAttribute(name: string, next: string): void {
    onchange({ ...attributes, [name]: next } as Record<string, string>);
  }

  function removeAttribute(name: string): void {
    const updated = { ...attributes };
    delete updated[name];
    onchange(Object.fromEntries(Object.entries(updated).map(([key, item]) => [key, String(item ?? '')])));
  }
</script>

<div class="exs-field">
  <span class="exs-field__label">{label}</span>
  <div class="exs-structured-list" aria-label="HTML attributes">
    {#if entries.length === 0}
      <div class="exs-structured-list__empty">No additional attributes</div>
    {/if}
    {#each entries as [name, attributeValue] (name)}
      <div class="exs-html-attribute">
        <input
          type="text"
          value={name}
          aria-label="Attribute name"
          title="Attribute name"
          onchange={(event) => renameAttribute(name, event.currentTarget.value)}
        />
        <input
          type="text"
          value={attributeValue}
          aria-label={`${name} value`}
          title={`${name} value`}
          onchange={(event) => updateAttribute(name, event.currentTarget.value)}
        />
        <button
          type="button"
          class="exs-icon-btn exs-icon-btn--danger"
          title={`Remove ${name}`}
          aria-label={`Remove ${name}`}
          onclick={() => removeAttribute(name)}
        >×</button>
      </div>
    {/each}
    <button type="button" class="exs-btn exs-structured-list__add" onclick={addAttribute}>+ Add attribute</button>
  </div>
  <span class="exs-field__help">Event handlers and unsafe URLs are omitted from preview and export.</span>
</div>
