import type { EditorUiModel } from 'exemplara-core/editor';
/** View accessors only. Nano Stores and their defaults belong to exemplara-core. */
export declare function bindUiState<T extends object>(model: EditorUiModel<T>): T;
