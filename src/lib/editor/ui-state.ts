import { fromStore } from 'svelte/store';
import type { EditorUiModel } from 'exemplara-core/editor';

/** View accessors only. Nano Stores and their defaults belong to exemplara-core. */
export function bindUiState<T extends object>(model: EditorUiModel<T>): T {
  const view = fromStore(model.store);
  return Object.defineProperties({}, Object.fromEntries(
    Object.keys(model.store.get()).map(key => [key, {
      enumerable: true,
      get: () => view.current[key as keyof T],
      set: (value: T[keyof T]) => model.set(key as keyof T, value),
    }]),
  )) as T;
}
