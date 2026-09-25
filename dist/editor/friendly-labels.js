const TAG_LABELS = {
    header: 'Header',
    nav: 'Navigation',
    footer: 'Footer',
    section: 'Section',
    article: 'Article',
    aside: 'Sidebar',
    main: 'Main content',
    h1: 'Heading',
    h2: 'Heading',
    h3: 'Heading',
    h4: 'Heading',
    h5: 'Heading',
    h6: 'Heading',
    p: 'Paragraph',
    img: 'Image',
    a: 'Link',
    button: 'Button',
    ul: 'List',
    ol: 'List',
    li: 'List item',
    figure: 'Image',
    figcaption: 'Caption',
    form: 'Form',
    span: 'Text',
    strong: 'Emphasis',
    em: 'Emphasis',
    div: 'Block',
    address: 'Contact',
};
const TOKEN_LABELS = {
    bg: 'Page background',
    page: 'Page background',
    background: 'Page background',
    surface: 'Cards',
    panel: 'Panels',
    text: 'Text',
    muted: 'Muted text',
    accent: 'Accent',
    primary: 'Accent',
    border: 'Borders',
    'border-strong': 'Strong borders',
    'nav-bg': 'Menu background',
    'nav-text': 'Menu text',
    'nav-muted': 'Menu muted text',
    'nav-active': 'Menu highlight',
    'nav-border': 'Menu borders',
    'button-bg': 'Buttons',
    'button-text': 'Button text',
};
const TOKEN_ORDER = [
    'bg', 'page', 'background', 'surface', 'panel',
    'text', 'muted', 'accent', 'primary',
    'border', 'border-strong',
    'nav-bg', 'nav-text', 'nav-muted', 'nav-active', 'nav-border',
    'button-bg', 'button-text',
];
export function friendlyElementLabel(node, fallback = 'Block') {
    if (!node)
        return fallback;
    if (node.type === 'html-text' || node.type === 'text')
        return 'Text';
    if (node.type === 'image')
        return 'Image';
    if (node.type === 'web-link')
        return 'Link';
    if (node.type !== 'html-element' && node.type !== 'web-section' && node.type !== 'container')
        return fallback;
    const tag = String(node.props.element ?? node.props.tagName ?? '').toLowerCase();
    const className = String(node.props.className ?? '').toLowerCase();
    if (tag === 'nav' || /\b(nav|menu)\b/.test(className))
        return 'Navigation';
    if (tag === 'header' || /\b(header|topbar)\b/.test(className))
        return 'Header';
    if (/\bhero\b/.test(className))
        return 'Hero';
    if (tag === 'footer' || /\bfooter\b/.test(className))
        return 'Footer';
    if (/\bcard\b/.test(className))
        return 'Card';
    if (/\b(cta|button|btn)\b/.test(className))
        return 'Button';
    if (/\b(gallery|photo|image)\b/.test(className))
        return 'Image';
    return TAG_LABELS[tag] ?? fallback;
}
export function tokenStem(name) {
    const normalized = name.toLowerCase();
    return normalized.replace(/^[a-z0-9]+-/, '');
}
export function friendlyTokenLabel(name) {
    const normalized = name.toLowerCase();
    return TOKEN_LABELS[normalized] ?? TOKEN_LABELS[tokenStem(name)] ?? name.replace(/-/g, ' ');
}
export function sortColorTokenEntries(colors) {
    const entries = Object.entries(colors);
    return entries.sort(([a], [b]) => {
        const aIndex = TOKEN_ORDER.indexOf(tokenStem(a));
        const bIndex = TOKEN_ORDER.indexOf(tokenStem(b));
        const aRank = aIndex === -1 ? TOKEN_ORDER.length : aIndex;
        const bRank = bIndex === -1 ? TOKEN_ORDER.length : bIndex;
        return aRank - bRank || a.localeCompare(b);
    });
}
