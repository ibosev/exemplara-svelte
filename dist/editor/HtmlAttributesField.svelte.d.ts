interface Props {
    value: unknown;
    onchange: (value: Record<string, string>) => void;
    exclude?: readonly string[];
    label?: string;
}
declare const HtmlAttributesField: import("svelte").Component<Props, {}, "">;
type HtmlAttributesField = ReturnType<typeof HtmlAttributesField>;
export default HtmlAttributesField;
