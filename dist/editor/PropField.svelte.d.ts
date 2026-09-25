import type { PropSchema } from '../core/types.js';
interface Props {
    name: string;
    schema: PropSchema;
    value: unknown;
    onchange: (value: unknown) => void;
}
declare const PropField: import("svelte").Component<Props, {}, "">;
type PropField = ReturnType<typeof PropField>;
export default PropField;
