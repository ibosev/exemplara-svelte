<script lang="ts">
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
  const source = $derived(renderEditablePrintTemplateDocument(document, position, html));

  function connect(): void {
    cleanup?.();
    const surface = frame?.contentDocument?.querySelector<HTMLElement>('.ex-print-template');
    if (!surface) return;
    surface.contentEditable = 'true';
    surface.setAttribute('role', 'textbox');
    surface.setAttribute('aria-label', `Edit ${position}`);
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      oncommit(sanitizePrintTemplateHtml(surface.innerHTML));
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        committed = true;
        oncancel();
      } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    };
    surface.addEventListener('blur', commit);
    surface.addEventListener('keydown', keydown);
    cleanup = () => {
      surface.removeEventListener('blur', commit);
      surface.removeEventListener('keydown', keydown);
    };
    requestAnimationFrame(() => {
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
