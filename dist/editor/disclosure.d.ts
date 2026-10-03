import type { Attachment } from 'svelte/attachments';
import type { EditorContext } from './context.svelte.js';
/** Browser adapter for disclosure state owned by the editor session. */
export declare function persistentDisclosure(key: string, editor: EditorContext, initiallyOpen?: boolean): Attachment<HTMLDetailsElement>;
