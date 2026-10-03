<script lang="ts">
  import { bindUiState } from './ui-state.js';
  import BindingAutocomplete from './BindingAutocomplete.svelte';
  import { getEditorContext } from './context.svelte.js';
  import { applyInlineFormat, sanitizeHtml, type InlineFormat } from '../shared/richtext.js';
  import {
    findBindingAutocompleteTrigger,
  } from '../shared/binding-authoring.js';
  import {
    IconBold,
    IconItalic,
    IconUnderline,
    IconStrikethrough,
    IconClearFormat,
    type IconType,
  } from './icons.js';
  import type { ComponentNode } from '../core/types.js';

  interface Props {
    node: ComponentNode;
  }

  let { node }: Props = $props();

  const editor = getEditorContext();
  const dataAuthoringEnabled = editor.isProvidedCapabilityEnabled('data.bind.author');

  let root = $state<HTMLElement | null>(null);
  let surface = $state<HTMLElement | null>(null);
  const uiModel = $derived(editor.session.ui.get('richText', node.id));
  const ui = $derived(bindUiState(uiModel));
  // svelte-ignore state_referenced_locally -- initialize the DOM once; input publishes to the Nano Store without replacing the caret
  const initialHtml = uiModel.store.get().draftHtml;
  const suggestions = $derived(
    ui.autocomplete ? editor.autocompleteSuggestions(ui.autocomplete.trigger) : [],
  );

  $effect(() => editor.registerInlineExpressionTarget(
    node.id,
    insertExpressionAtSelection,
  ));

  $effect(() => {
    if (surface) {
      surface.focus();
      // Place the caret at the end of the content.
      const range = document.createRange();
      range.selectNodeContents(surface);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });

  function syncDraft(): void {
    if (surface) ui.draftHtml = sanitizeHtml(surface.innerHTML);
  }
  function commit(): void {
    syncDraft();
    editor.session.ui.commitRichText(node.id);
  }
  function cancel(): void { editor.session.ui.cancelRichText(node.id); }

  function caretOffsetWithin(element: HTMLElement, range: Range): number {
    const prefix = range.cloneRange();
    prefix.selectNodeContents(element);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
  }

  function caretPosition(range: Range): { left: number; top: number } {
    if (!root) return { left: 8, top: 50 };
    const caretRect = range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const scaleX = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
    const scaleY = root.offsetHeight > 0 ? rootRect.height / root.offsetHeight : scaleX;
    const width = 304;
    return {
      left: Math.max(4, Math.min((caretRect.left - rootRect.left) / scaleX, root.offsetWidth - width - 4)),
      top: Math.max(42, (caretRect.bottom - rootRect.top) / scaleY + 6),
    };
  }

  function updateAutocomplete(): void {
    syncDraft();
    if (!dataAuthoringEnabled) {
      ui.autocomplete = null;
      return;
    }
    if (!surface) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!surface.contains(range.endContainer)) return;
    const trigger = findBindingAutocompleteTrigger(
      surface.textContent ?? '',
      caretOffsetWithin(surface, range),
    );
    if (!trigger) {
      ui.autocomplete = null;
      return;
    }
    ui.autocomplete = { trigger, ...caretPosition(range) };
    ui.highlightedIndex = 0;
  }

  function textPointAtOffset(element: HTMLElement, requestedOffset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, requestedOffset);
    let current: Node | null = walker.nextNode();
    while (current) {
      const length = current.textContent?.length ?? 0;
      if (remaining <= length) return { node: current, offset: remaining };
      remaining -= length;
      current = walker.nextNode();
    }
    return { node: element, offset: element.childNodes.length };
  }

  function selectSuggestion(index = ui.highlightedIndex): void {
    if (!surface || !ui.autocomplete) return;
    const suggestion = suggestions[index];
    if (!suggestion) return;
    const start = textPointAtOffset(surface, ui.autocomplete.trigger.start);
    const end = textPointAtOffset(surface, ui.autocomplete.trigger.end);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    range.deleteContents();
    const completedExpression = ui.autocomplete.trigger.kind === 'formatter'
      ? `{{${ui.autocomplete.trigger.expressionPrefix} | ${suggestion.value}}}`
      : `{{${suggestion.value}}}`;
    const expression = document.createTextNode(completedExpression);
    range.insertNode(expression);
    range.setStartAfter(expression);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    surface.normalize();
    syncDraft();
    ui.preferredSourceId = suggestion.sourceId;
    ui.autocomplete = null;
    surface.focus();
  }

  function expressionSelectionRange(): Range | null {
    if (!surface) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!surface.contains(range.startContainer) || !surface.contains(range.endContainer)) return null;
    return range;
  }

  function insertExpressionAtSelection(expression: string): boolean {
    if (!surface) return false;
    const selection = window.getSelection();
    if (!selection) return false;
    const range = expressionSelectionRange();
    if (!range) return false;

    range.deleteContents();
    const inserted = document.createTextNode(expression);
    range.insertNode(inserted);
    range.setStartAfter(inserted);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    surface.normalize();
    syncDraft();
    ui.autocomplete = null;
    surface.focus({ preventScroll: true });
    return true;
  }

  function onKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (ui.autocomplete) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        ui.highlightedIndex = Math.min(ui.highlightedIndex + 1, Math.max(0, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        ui.highlightedIndex = Math.max(0, ui.highlightedIndex - 1);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        selectSuggestion();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        ui.autocomplete = null;
        return;
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  }

  const formats: { format: InlineFormat; icon: typeof IconType; title: string }[] = [
    { format: 'bold', icon: IconBold, title: 'Bold' },
    { format: 'italic', icon: IconItalic, title: 'Italic' },
    { format: 'underline', icon: IconUnderline, title: 'Underline' },
    { format: 'strikeThrough', icon: IconStrikethrough, title: 'Strikethrough' },
    { format: 'removeFormat', icon: IconClearFormat, title: 'Clear formatting' },
  ];
</script>

<div class="exs-richtext" bind:this={root}>
  <div class="exs-richtext__toolbar" role="toolbar" aria-label="Text formatting">
    {#each formats as { format, icon: Icon, title } (format)}
      <button
        type="button"
        class="exs-richtext__btn"
        {title}
        aria-label={title}
        onmousedown={(event) => {
          // Keep the contenteditable selection alive.
          event.preventDefault();
          applyInlineFormat(format);
          syncDraft();
        }}
      >
        <Icon size={13} />
      </button>
    {/each}
    <span class="exs-richtext__hint">
      {dataAuthoringEnabled ? `Type {{ for data · ` : ''}⌘↵ apply · Esc cancel
    </span>
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="exs-richtext__surface"
    contenteditable="true"
    bind:this={surface}
    onblur={commit}
    oninput={updateAutocomplete}
    onkeydown={onKeydown}
    onclick={(event) => event.stopPropagation()}
    ondblclick={(event) => event.stopPropagation()}
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html sanitizeHtml(initialHtml)}
  </div>
  {#if dataAuthoringEnabled && ui.autocomplete}
    <BindingAutocomplete
      {suggestions}
      kind={ui.autocomplete.trigger.kind}
      query={ui.autocomplete.trigger.query}
      highlightedIndex={ui.highlightedIndex}
      left={ui.autocomplete.left}
      top={ui.autocomplete.top}
      onselect={(suggestion) => selectSuggestion(suggestions.indexOf(suggestion))}
      onhighlight={(index) => (ui.highlightedIndex = index)}
    />
  {/if}
</div>
