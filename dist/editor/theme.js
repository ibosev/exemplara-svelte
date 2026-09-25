const THEME_PROPERTIES = {
    background: '--exs-bg',
    backgroundSunken: '--exs-bg-sunken',
    panel: '--exs-panel',
    border: '--exs-border',
    borderStrong: '--exs-border-strong',
    text: '--exs-text',
    muted: '--exs-muted',
    accent: '--exs-accent',
    accentStrong: '--exs-accent-strong',
    accentSoft: '--exs-accent-soft',
    danger: '--exs-danger',
    dangerSoft: '--exs-danger-soft',
    success: '--exs-success',
    warning: '--exs-warning',
    symbol: '--exs-symbol',
    selectionOutline: '--exs-selection-outline',
    editingOutline: '--exs-editing-outline',
    focusRing: '--exs-focus-ring',
    radius: '--exs-radius',
    radiusLarge: '--exs-radius-lg',
    controlHeight: '--exs-control-h',
    toolbarHeight: '--exs-toolbar-h',
};
/** Render the typed host theme seam as scoped CSS custom properties. */
export function renderEditorThemeStyle(tokens) {
    if (!tokens)
        return undefined;
    const declarations = [];
    for (const key of Object.keys(THEME_PROPERTIES)) {
        const value = tokens[key]?.trim();
        if (value)
            declarations.push(`${THEME_PROPERTIES[key]}: ${value}`);
    }
    return declarations.length > 0 ? declarations.join('; ') : undefined;
}
