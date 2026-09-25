<script lang="ts">
  import { IconDatabase, IconSearch } from './icons.js';
  import type { EditorAutocompleteSuggestion } from './extensions.js';
  import type { BindingAutocompleteTrigger } from '../shared/binding-authoring.js';

  interface Props {
    suggestions: EditorAutocompleteSuggestion[];
    kind: BindingAutocompleteTrigger['kind'];
    query: string;
    highlightedIndex: number;
    left: number;
    top: number;
    onselect: (suggestion: EditorAutocompleteSuggestion) => void;
    onhighlight: (index: number) => void;
  }

  let {
    suggestions,
    kind,
    query,
    highlightedIndex,
    left,
    top,
    onselect,
    onhighlight,
  }: Props = $props();
  const formatterMode = $derived(kind === 'formatter');

  function typeGlyph(type: string, kind: EditorAutocompleteSuggestion['kind']): string {
    if (kind === 'formatter' || kind === 'helper') return 'ƒ';
    if (type === 'string') return 'T';
    if (type === 'number') return '#';
    if (type === 'boolean') return '?';
    if (type === 'array') return '[]';
    if (type === 'object') return '{}';
    return '·';
  }
</script>

<div
  class="exs-binding-autocomplete"
  style:left={`${left}px`}
  style:top={`${top}px`}
  role="dialog"
  tabindex="-1"
  aria-label="Insert data binding"
  onmousedown={(event) => event.preventDefault()}
>
  <div class="exs-binding-autocomplete__header">
    <span class="exs-binding-autocomplete__braces">{formatterMode ? '|' : '{{'}</span>
    <strong>{formatterMode ? 'Apply formatter' : 'Insert data binding'}</strong>
    <span class="exs-binding-autocomplete__source"><IconDatabase size={11} /> {formatterMode ? 'Template utils' : 'Live JSON'}</span>
  </div>
  <div class="exs-binding-autocomplete__query">
    <IconSearch size={12} />
    <span>{query || (formatterMode ? 'All formatters' : 'All available paths')}</span>
  </div>
  <div class="exs-binding-autocomplete__list" role="listbox" aria-label="Data path suggestions">
    {#if suggestions.length === 0}
      <div class="exs-binding-autocomplete__empty">No matching {formatterMode ? 'formatters' : 'data paths'}</div>
    {:else}
      {#each suggestions as suggestion, index (suggestion.id)}
        <button
          type="button"
          role="option"
          aria-selected={index === highlightedIndex}
          class="exs-binding-autocomplete__option"
          class:exs-binding-autocomplete__option--active={index === highlightedIndex}
          onmouseenter={() => onhighlight(index)}
          onmousedown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onselect(suggestion);
          }}
        >
          <span class="exs-binding-autocomplete__type" data-type={suggestion.type}>{typeGlyph(suggestion.type, suggestion.kind)}</span>
          <span class="exs-binding-autocomplete__path">{suggestion.label}</span>
          <span class="exs-binding-autocomplete__preview">{suggestion.preview ?? suggestion.description ?? ''}</span>
          <span class="exs-binding-autocomplete__source-name">{suggestion.sourceName ?? suggestion.kind}</span>
        </button>
      {/each}
    {/if}
  </div>
  <div class="exs-binding-autocomplete__footer">
    <span>↑↓ navigate</span><span>↵ insert</span><span>esc close</span>
  </div>
</div>
