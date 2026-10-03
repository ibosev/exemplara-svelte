<script lang="ts">
  import { untrack } from 'svelte';
  import { getEditorContext } from './context.svelte.js';
  import { renderEditablePrintTemplateDocument } from '../renderer/print-templates.js';
  import { sanitizePrintTemplateHtml } from '../renderer/print-templates.js';
  import type { ExemplaraDocument } from '../core/types.js';

  interface Props {
    document: ExemplaraDocument;
    position: 'header' | 'footer';
    html: string;
    title: string;
    oncommit: (html: string) => void;
    oncancel: () => void;
  }

  let { document, position, html, title, oncommit, oncancel }: Props = $props();
  let frame = $state<HTMLIFrameElement | null>(null);
  let cleanup: (() => void) | null = null;
  const editor = getEditorContext();
  const uiModel = $derived(editor.session.ui.get('printChrome', JSON.stringify([position, editor.effectivePrintPreviewPage, editor.printVariant])));
  const source = $derived(renderEditablePrintTemplateDocument(document, position, untrack(() => uiModel.store.get().draftHtml)));

  function connect(): void {
    cleanup?.();
    const surface = frame?.contentDocument?.querySelector<HTMLElement>('.ex-print-template');
    if (!surface) return;
    surface.contentEditable = 'true';
    surface.setAttribute('role', 'textbox');
    surface.setAttribute('aria-label', `Edit ${position}`);
    const state = uiModel.values, current = uiModel.capture();
    state.committed = false;
    const input = () => { if (current()) state.draftHtml = sanitizePrintTemplateHtml(surface.innerHTML); };
    const commit = () => {
      if (!current() || state.committed) return;
      input();
      state.committed = true;
      oncommit(state.draftHtml);
      uiModel.reset();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        state.committed = true;
        oncancel();
        uiModel.reset();
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    };
    surface.addEventListener('input', input);
    surface.addEventListener('blur', commit);
    surface.addEventListener('keydown', keydown);
    cleanup = () => {
      surface.removeEventListener('input', input);
      surface.removeEventListener('blur', commit);
      surface.removeEventListener('keydown', keydown);
    };
    requestAnimationFrame(() => {
      if (!current() || !surface.isConnected) return;
      surface.focus();
      const range = frame?.contentDocument?.createRange();
      const selection = frame?.contentWindow?.getSelection();
      if (!range || !selection) return;
      range.selectNodeContents(surface);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }

  $effect(() => () => cleanup?.());
</script>

<div class="exs-print-inline-editor">
  <div class="exs-print-inline-editor__bar">
    <span>{title}</span>
    <span>Ctrl/⌘+Enter to apply · Esc to cancel</span>
  </div>
  <iframe
    bind:this={frame}
    class="exs-page__print-chrome exs-print-inline-editor__frame"
    title={`Direct ${position} editor`}
    srcdoc={source}
    onload={connect}
    style:height={`${document.print[position].height}mm`}
  ></iframe>
</div>
