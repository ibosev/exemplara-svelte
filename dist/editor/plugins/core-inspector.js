import ParagraphPanel from '../panels/ParagraphPanel.svelte';
import BoxModelSection from '../panels/BoxModelSection.svelte';
/**
 * Registers the standard Inspector sections as ordinary contributions.
 * Core sections use order below DEFAULT_PANEL_ORDER (50) so extension
 * sections follow them. The Inspector's chrome (title, node actions, prop
 * fields) stays fixed; sections render beneath it.
 */
export function createCoreInspectorPlugin() {
    return {
        id: 'exemplara.core-inspector',
        version: '1.0.0',
        setup(api) {
            api.addInspectorSection({
                id: 'paragraph',
                order: 20,
                visible: (_editor, node) => node.type === 'text',
                component: ParagraphPanel,
            });
            api.addInspectorSection({ id: 'box-model', order: 30, component: BoxModelSection });
        },
    };
}
