import type { Attachment } from 'svelte/attachments';
import type { EditorContext } from './context.svelte.js';

/** Browser adapter for disclosure state owned by the editor session. */
export function persistentDisclosure(key: string, editor: EditorContext, initiallyOpen = false): Attachment<HTMLDetailsElement> {
  return element => {
    const model = editor.session.ui.get('disclosures');
    if (!(key in model.store.get().expanded))
      model.set('expanded', { ...model.store.get().expanded, [key]: initiallyOpen });
    const stop = model.store.subscribe(state => { element.open = state.expanded[key] ?? initiallyOpen; });
    const toggle = () => {
      if (model.store.get().expanded[key] !== element.open)
        model.set('expanded', { ...model.store.get().expanded, [key]: element.open });
    };
    element.addEventListener('toggle', toggle);
    return () => { stop(); element.removeEventListener('toggle', toggle); };
  };
}
