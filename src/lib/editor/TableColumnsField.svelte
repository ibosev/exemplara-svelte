<script lang="ts">
  import { extractSampleDataPaths, formatDataPreview } from '../shared/data-browser.js';
  import {
    resolveTableDataSelection,
    tableColumns,
    tableRowFields,
    type TableColumnValue,
  } from '../shared/table-data.js';
  import type { ComponentNode } from '../core/types.js';
  import type { EditorContext } from './context.svelte.js';

  interface Props {
    editor: EditorContext;
    node: ComponentNode;
  }

  let { editor, node }: Props = $props();

  const displayFormats = [
    { value: '', label: 'As provided' },
    { value: 'currency("USD")', label: 'Currency · USD' },
    { value: 'currency("EUR")', label: 'Currency · EUR' },
    { value: 'currency("GBP")', label: 'Currency · GBP' },
    { value: 'number("en-GB")', label: 'Number' },
    { value: 'date("en-GB")', label: 'Date' },
    { value: 'percent', label: 'Percentage' },
  ] as const;

  const paths = $derived(extractSampleDataPaths(editor.doc.dataSources));
  const selection = $derived(resolveTableDataSelection(node, paths));
  const columns = $derived(tableColumns(node));
  const fields = $derived(tableRowFields(selection.rows));
  const exampleRow = $derived(selection.rows.find((row) => row && typeof row === 'object' && !Array.isArray(row)) as Record<string, unknown> | undefined);

  function commit(next: TableColumnValue[]): void {
    editor.updateProps(node.id, { columns: next });
  }

  function update(index: number, changes: Partial<TableColumnValue>): void {
    commit(columns.map((column, columnIndex) => columnIndex === index ? { ...column, ...changes } : column));
  }

  function addColumn(): void {
    const unused = fields.find((field) => !columns.some((column) => column.key === field));
    const key = unused ?? `column_${columns.length + 1}`;
    const label = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    commit([...columns, { key, label }]);
  }

  function move(index: number, direction: -1 | 1): void {
    const next = [...columns];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    next[index] = destination;
    next[target] = current;
    commit(next);
  }

  function remove(index: number): void {
    commit(columns.filter((_, columnIndex) => columnIndex !== index));
  }
</script>

<section class="exs-table-columns" aria-label="Table columns">
  <div class="exs-table-columns__heading">
    <strong>Columns</strong>
    {#if fields.length}<span>{columns.filter((column) => fields.includes(column.key)).length}/{columns.length} mapped</span>{/if}
  </div>
  <p class="exs-field__help">
    {fields.length
      ? 'Choose which field appears in each column, then set the reader-facing header.'
      : 'Set a data key and the header your readers will see.'}
  </p>

  <div class="exs-structured-list">
    {#each columns as column, index (index)}
      <article class="exs-structured-item">
        <header class="exs-structured-item__header">
          <strong>Column {index + 1}</strong>
          <div class="exs-structured-item__actions">
            <button type="button" class="exs-icon-btn" aria-label={`Move column ${index + 1} up`} disabled={index === 0} onclick={() => move(index, -1)}>↑</button>
            <button type="button" class="exs-icon-btn" aria-label={`Move column ${index + 1} down`} disabled={index === columns.length - 1} onclick={() => move(index, 1)}>↓</button>
            <button type="button" class="exs-icon-btn exs-icon-btn--danger" aria-label={`Remove column ${index + 1}`} onclick={() => remove(index)}>×</button>
          </div>
        </header>
        <div class="exs-structured-item__fields">
          <label class="exs-structured-control">
            <span>Data field</span>
            {#if fields.length}
              <select value={column.key} onchange={(event) => update(index, { key: event.currentTarget.value })}>
                {#if !fields.includes(column.key)}<option value={column.key}>Missing · {column.key}</option>{/if}
                {#each fields as field (field)}
                  <option value={field}>{field} · {formatDataPreview(exampleRow?.[field])}</option>
                {/each}
              </select>
            {:else}
              <input type="text" value={column.key} placeholder="e.g. description" onchange={(event) => update(index, { key: event.currentTarget.value })} />
            {/if}
          </label>
          <label class="exs-structured-control">
            <span>Header label</span>
            <input type="text" value={column.label ?? ''} placeholder="What readers see" onchange={(event) => update(index, { label: event.currentTarget.value })} />
          </label>
          <label class="exs-structured-control">
            <span>Display format</span>
            <select value={column.format ?? ''} onchange={(event) => update(index, { format: event.currentTarget.value || undefined })}>
              {#if column.format && !displayFormats.some((option) => option.value === column.format)}
                <option value={column.format}>Current · {column.format}</option>
              {/if}
              {#each displayFormats as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
        </div>
      </article>
    {/each}
    <button type="button" class="exs-btn exs-structured-list__add" onclick={addColumn}>+ Add column</button>
  </div>
</section>
