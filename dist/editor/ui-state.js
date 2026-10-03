import { fromStore } from 'svelte/store';
/** View accessors only. Nano Stores and their defaults belong to exemplara-core. */
export function bindUiState(model) {
    const view = fromStore(model.store);
    return Object.defineProperties({}, Object.fromEntries(Object.keys(model.store.get()).map(key => [key, {
            enumerable: true,
            get: () => view.current[key],
            set: (value) => model.set(key, value),
        }])));
}
