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
declare const BindingAutocomplete: import("svelte").Component<Props, {}, "">;
type BindingAutocomplete = ReturnType<typeof BindingAutocomplete>;
export default BindingAutocomplete;
