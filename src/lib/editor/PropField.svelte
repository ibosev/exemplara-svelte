<script lang="ts">
  import type { PropSchema } from '../core/types.js';
  import { parseJsonValue } from '../shared/forms.js';

  interface Props {
    name: string;
    schema: PropSchema;
    value: unknown;
    onchange: (value: unknown) => void;
  }

  let { name, schema, value, onchange }: Props = $props();

  let jsonError = $state('');

  const arrayValue = $derived(Array.isArray(value) ? value : []);

  function defaultValue(itemSchema: PropSchema | undefined): unknown {
    if (!itemSchema) return '';
    if (itemSchema.default !== undefined) return structuredClone(itemSchema.default);
    if (itemSchema.type === 'object') {
      return Object.fromEntries(
        Object.entries(itemSchema.properties ?? {}).map(([key, property]) => [key, defaultValue(property)]),
      );
    }
    if (itemSchema.type === 'number') return itemSchema.min ?? 0;
    if (itemSchema.type === 'boolean') return false;
    if (itemSchema.type === 'array') return [];
    return itemSchema.enumValues?.[0] ?? '';
  }

  function addArrayItem(): void {
    onchange([...arrayValue, defaultValue(schema.itemSchema)]);
  }

  function updateArrayItem(index: number, next: unknown): void {
    onchange(arrayValue.map((item, itemIndex) => itemIndex === index ? next : item));
  }

  function updateObjectProperty(index: number, key: string, next: unknown): void {
    const item = arrayValue[index];
    const record = item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    updateArrayItem(index, { ...record, [key]: next });
  }

  function removeArrayItem(index: number): void {
    onchange(arrayValue.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveArrayItem(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= arrayValue.length) return;
    const next = [...arrayValue];
    [next[index], next[target]] = [next[target], next[index]];
    onchange(next);
  }

  function primitiveValue(raw: string, itemSchema: PropSchema): unknown {
    if (itemSchema.type === 'number') return raw === '' ? (itemSchema.default ?? itemSchema.min ?? 0) : Number(raw);
    return raw;
  }

  function onJsonChange(event: Event) {
    const raw = (event.currentTarget as HTMLTextAreaElement).value;
    const parsed = parseJsonValue(raw, schema.default);
    if (!parsed.ok) {
      jsonError = parsed.error;
      return;
    }
    onchange(parsed.value);
    jsonError = '';
  }
</script>

<div class="exs-field" class:exs-field--row={schema.type === 'boolean'}>
  <label class="exs-field__label" for={`exs-prop-${name}`}>{schema.label}</label>

  {#if schema.type === 'boolean'}
    <input
      id={`exs-prop-${name}`}
      type="checkbox"
      checked={value === true}
      onchange={(event) => onchange(event.currentTarget.checked)}
    />
  {:else if schema.type === 'number'}
    <input
      id={`exs-prop-${name}`}
      type="number"
      value={value === undefined || value === null ? '' : Number(value)}
      min={schema.min}
      max={schema.max}
      onchange={(event) => onchange(event.currentTarget.value === '' ? schema.default : Number(event.currentTarget.value))}
    />
  {:else if schema.type === 'enum'}
    <select
      id={`exs-prop-${name}`}
      value={String(value ?? schema.default ?? '')}
      onchange={(event) => onchange(event.currentTarget.value)}
    >
      {#each schema.enumValues ?? [] as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
  {:else if schema.type === 'color'}
    <div class="exs-field__color">
      <input
        type="color"
        value={typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
        oninput={(event) => onchange(event.currentTarget.value)}
      />
      <input
        id={`exs-prop-${name}`}
        type="text"
        placeholder="inherit"
        value={String(value ?? '')}
        onchange={(event) => onchange(event.currentTarget.value)}
      />
    </div>
  {:else if schema.type === 'richtext' || schema.multiline}
    <textarea
      id={`exs-prop-${name}`}
      value={String(value ?? '')}
      onchange={(event) => onchange(event.currentTarget.value)}
    ></textarea>
  {:else if schema.type === 'string' || schema.type === 'image'}
    <input
      id={`exs-prop-${name}`}
      type="text"
      value={String(value ?? '')}
      onchange={(event) => onchange(event.currentTarget.value)}
    />
  {:else if schema.type === 'array' && schema.itemSchema}
    <div class="exs-structured-list" aria-label={schema.label}>
      {#if arrayValue.length === 0}
        <div class="exs-structured-list__empty">No {schema.itemSchema.label.toLowerCase()}s yet</div>
      {/if}
      {#each arrayValue as item, index (index)}
        <div class="exs-structured-item">
          <div class="exs-structured-item__header">
            <strong>{schema.itemSchema.label} {index + 1}</strong>
            <div class="exs-structured-item__actions">
              <button type="button" class="exs-icon-btn" title="Move up" aria-label={`Move ${schema.itemSchema.label} up`} disabled={index === 0} onclick={() => moveArrayItem(index, -1)}>↑</button>
              <button type="button" class="exs-icon-btn" title="Move down" aria-label={`Move ${schema.itemSchema.label} down`} disabled={index === arrayValue.length - 1} onclick={() => moveArrayItem(index, 1)}>↓</button>
              <button type="button" class="exs-icon-btn exs-icon-btn--danger" title="Remove" aria-label={`Remove ${schema.itemSchema.label}`} onclick={() => removeArrayItem(index)}>×</button>
            </div>
          </div>
          {#if schema.itemSchema.type === 'object' && schema.itemSchema.properties}
            <div class="exs-structured-item__fields">
              {#each Object.entries(schema.itemSchema.properties) as [key, property] (key)}
                <label class="exs-structured-control">
                  <span>{property.label}</span>
                  {#if property.type === 'enum'}
                    <select value={String((item as Record<string, unknown>)?.[key] ?? property.default ?? '')} onchange={(event) => updateObjectProperty(index, key, event.currentTarget.value)}>
                      {#each property.enumValues ?? [] as option (option)}<option value={option}>{option}</option>{/each}
                    </select>
                  {:else}
                    <input
                      type={property.type === 'number' ? 'number' : 'text'}
                      value={String((item as Record<string, unknown>)?.[key] ?? property.default ?? '')}
                      placeholder={property.required ? 'Required' : 'Optional'}
                      min={property.min}
                      max={property.max}
                      onchange={(event) => updateObjectProperty(index, key, primitiveValue(event.currentTarget.value, property))}
                    />
                  {/if}
                </label>
              {/each}
            </div>
          {:else}
            <input
              type={schema.itemSchema.type === 'number' ? 'number' : 'text'}
              value={String(item ?? '')}
              min={schema.itemSchema.min}
              max={schema.itemSchema.max}
              aria-label={`${schema.itemSchema.label} ${index + 1}`}
              onchange={(event) => updateArrayItem(index, primitiveValue(event.currentTarget.value, schema.itemSchema!))}
            />
          {/if}
        </div>
      {/each}
      <button type="button" class="exs-btn exs-structured-list__add" onclick={addArrayItem}>+ Add {schema.itemSchema.label.toLowerCase()}</button>
    </div>
  {:else}
    <!-- object / array / spacing: edit as JSON -->
    <textarea id={`exs-prop-${name}`} value={JSON.stringify(value ?? schema.default ?? null, null, 2)} onchange={onJsonChange}
    ></textarea>
    {#if jsonError}
      <span class="exs-field__error">{jsonError}</span>
    {/if}
  {/if}

  {#if schema.description}
    <span class="exs-field__label" style="font-weight: 400">{schema.description}</span>
  {/if}
</div>
