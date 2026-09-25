<script lang="ts">
  import { extractSampleDataPaths } from '../shared/data-browser.js';
  import {
    replaceBindingTarget,
    resolveTableDataSelection,
    tableArrayPaths,
    tableColumns,
    tableRowFields,
  } from '../shared/table-data.js';
  import type { ComponentNode } from '../core/types.js';
  import type { EditorContext } from './context.svelte.js';

  interface Props {
    editor: EditorContext;
    node: ComponentNode;
  }

  let { editor, node }: Props = $props();
  let modeOverride = $state<'connected' | 'manual' | null>(null);

  const paths = $derived(extractSampleDataPaths(editor.doc.dataSources));
  const arrayPaths = $derived(tableArrayPaths(paths));
  const selection = $derived(resolveTableDataSelection(node, paths));
  const columns = $derived(tableColumns(node));
  const rowFields = $derived(tableRowFields(selection.rows));
  const mode = $derived(modeOverride ?? (
    selection.mode === 'connected' ? 'connected' : 'manual'
  ));
  const selectedValue = $derived(selection.path
    ? `${selection.path.sourceId}:${selection.path.path}`
    : '');
  const unmappedColumns = $derived(columns.filter((column) => !rowFields.includes(column.key)));

  function selectRows(value: string): void {
    modeOverride = 'connected';
    const option = arrayPaths.find((candidate) => `${candidate.sourceId}:${candidate.path}` === value);
    const nextBindings = replaceBindingTarget(
      node.dataBindings,
      'rows',
      option ? {
        targetProp: 'rows',
        sourceId: option.sourceId,
        path: option.path,
        fallback: [],
      } : undefined,
    );
    editor.commitPropAuthoring(node.id, 'rows', [], nextBindings);
    editor.setHostStatus(option
      ? `Table connected to ${option.sourceName} · ${option.path}`
      : 'Table data connection removed', 'success');
  }

  function useManualRows(): void {
    const copiedRows = selection.rows.map((row) => structuredClone(row));
    modeOverride = 'manual';
    editor.commitPropAuthoring(
      node.id,
      'rows',
      copiedRows,
      replaceBindingTarget(node.dataBindings, 'rows'),
    );
    editor.setHostStatus(
      copiedRows.length ? `Copied ${copiedRows.length} rows into the template` : 'Manual table rows enabled',
      'success',
    );
  }

  function useConnectedRows(): void {
    modeOverride = 'connected';
  }

  function editSourceData(): void {
    editor.rightTab = 'data';
  }

  function manualRows(): unknown[] {
    return Array.isArray(node.props.rows) ? node.props.rows : [];
  }

  function commitManualRows(rows: unknown[]): void {
    editor.commitPropAuthoring(
      node.id,
      'rows',
      rows,
      replaceBindingTarget(node.dataBindings, 'rows'),
    );
  }

  function addManualRow(): void {
    const row = Object.fromEntries((columns.length ? columns : [{ key: 'value' }]).map((column) => [column.key, '']));
    commitManualRows([...manualRows(), row]);
  }

  function updateManualCell(index: number, key: string, value: string): void {
    commitManualRows(manualRows().map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const record = row && typeof row === 'object' && !Array.isArray(row)
        ? row as Record<string, unknown>
        : {};
      return { ...record, [key]: value };
    }));
  }

  function moveManualRow(index: number, direction: -1 | 1): void {
    const rows = [...manualRows()];
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    commitManualRows(rows);
  }

  function removeManualRow(index: number): void {
    commitManualRows(manualRows().filter((_, rowIndex) => rowIndex !== index));
  }
</script>

<section class="exs-table-data" aria-label="Table data">
  <div class="exs-table-data__heading">
    <div>
      <strong>Table data</strong>
      <span>Choose where the repeating rows come from.</span>
    </div>
    <span class="exs-tag">{selection.rows.length} rows</span>
  </div>

  <div class="exs-table-data__modes" role="group" aria-label="Table data mode">
    <button type="button" class:active={mode === 'connected'} onclick={useConnectedRows}>Use sample data</button>
    <button type="button" class:active={mode === 'manual'} onclick={useManualRows}>Enter rows</button>
  </div>

  {#if mode === 'connected'}
    <label class="exs-field">
      <span class="exs-field__label">Repeat one row for every item in</span>
      <select aria-label="Table row source" value={selectedValue} onchange={(event) => selectRows(event.currentTarget.value)}>
        <option value="">Choose a list…</option>
        {#each arrayPaths as path (`${path.sourceId}:${path.path}`)}
          <option value={`${path.sourceId}:${path.path}`}>
            {path.sourceName} › {path.path} ({Array.isArray(path.value) ? path.value.length : 0} rows)
          </option>
        {/each}
      </select>
    </label>

    {#if selection.path}
      <div class="exs-table-data__summary">
        <div><span>Source</span><strong>{selection.path.sourceName}</strong></div>
        <div><span>List</span><strong>{selection.path.path}</strong></div>
        <div><span>Detected fields</span><strong>{rowFields.length}</strong></div>
      </div>
      {#if rowFields.length}
        <div class="exs-table-data__fields" aria-label="Detected row fields">
          {#each rowFields as field (field)}<span>{field}</span>{/each}
        </div>
      {/if}
      {#if unmappedColumns.length}
        <p class="exs-table-data__warning">
          {unmappedColumns.length} column{unmappedColumns.length === 1 ? '' : 's'} do not match the selected data. Choose a detected field in Columns above.
        </p>
      {/if}
    {:else}
      <p class="exs-field__help">Choose an array from sample data. The editor repeats the table row automatically.</p>
    {/if}

    <button type="button" class="exs-btn" onclick={editSourceData}>
      {arrayPaths.length ? 'Edit source data' : 'Add sample data'}
    </button>
  {:else}
    <p class="exs-field__help">These values are stored directly in the template. Switch to sample data when the rows should come from an API payload.</p>
    <div class="exs-table-manual-rows">
      {#if manualRows().length === 0}
        <div class="exs-structured-list__empty">No rows yet</div>
      {/if}
      {#each manualRows() as row, index (index)}
        <article class="exs-table-manual-row">
          <header>
            <strong>Row {index + 1}</strong>
            <div class="exs-structured-item__actions">
              <button type="button" class="exs-icon-btn" aria-label={`Move row ${index + 1} up`} disabled={index === 0} onclick={() => moveManualRow(index, -1)}>↑</button>
              <button type="button" class="exs-icon-btn" aria-label={`Move row ${index + 1} down`} disabled={index === manualRows().length - 1} onclick={() => moveManualRow(index, 1)}>↓</button>
              <button type="button" class="exs-icon-btn exs-icon-btn--danger" aria-label={`Remove row ${index + 1}`} onclick={() => removeManualRow(index)}>×</button>
            </div>
          </header>
          <div class="exs-table-manual-row__cells">
            {#each columns.length ? columns : [{ key: 'value', label: 'Value' }] as column (column.key)}
              <label class="exs-structured-control">
                <span>{column.label ?? column.key}</span>
                <input
                  type="text"
                  value={String(row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>)[column.key] ?? '' : '')}
                  onchange={(event) => updateManualCell(index, column.key, event.currentTarget.value)}
                />
              </label>
            {/each}
          </div>
        </article>
      {/each}
    </div>
    <button type="button" class="exs-btn" onclick={addManualRow}>+ Add row</button>
  {/if}
</section>
