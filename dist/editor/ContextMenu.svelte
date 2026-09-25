<script lang="ts">
  import { getEditorContext } from './context.svelte.js';
  import { findNode } from '../core/tree.js';
  import { nodeDisplayLabel } from '../shared/editor.js';
  import { clampToViewport } from '../shared/dom.js';
  import type { IconType } from './icons.js';

  const editor = getEditorContext();

  const menu = $derived(editor.contextMenu);
  const node = $derived(menu ? findNode(editor.doc, menu.nodeId) : null);
  const definition = $derived(node ? editor.getDefinition(node.type) : undefined);

  interface Item {
    label: string;
    icon?: typeof IconType;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
    commandId?: string;
    nodeId?: string;
  }

  const items: Item[] = $derived.by(() => {
    if (!menu || !node) return [];
    const children = [
      ...(node.children ?? []),
      ...Object.values(node.slots ?? {}).flat(),
    ].filter((child) =>
      child.type !== 'html-text' || String(child.props.content ?? '').trim().length > 0,
    );
    const contributions = editor.extensions.menuItems(
      'node.context',
      editor,
      { nodeId: menu.nodeId },
    );
    const result: Item[] = [];
    for (const child of children) {
      const childDefinition = editor.getDefinition(child.type);
      result.push({
        label: `Select child · ${nodeDisplayLabel(child, childDefinition, 28)}`,
        icon: editor.componentIcon(child.type) ?? undefined,
        nodeId: child.id,
      });
    }
    if (children.length > 0 && contributions.length > 0) {
      result.push({ label: '', divider: true });
    }
    let previousGroup = '';
    for (const contribution of contributions) {
      if (previousGroup && previousGroup !== contribution.group) {
        result.push({ label: '', divider: true });
      }
      previousGroup = contribution.group;
      result.push({
        label: contribution.command.label,
        icon: contribution.command.icon,
        shortcut: contribution.command.shortcut,
        danger: contribution.command.danger,
        disabled: !contribution.enabled,
        commandId: contribution.command.id,
      });
    }
    return result;
  });

  function run(item: Item) {
    if (item.nodeId) {
      editor.selectAndRevealNode(item.nodeId);
    } else if (item.commandId && menu) {
      void editor.runCommand(item.commandId, { nodeId: menu.nodeId });
    }
    editor.closeContextMenu();
  }

  const MENU_WIDTH = 200;
  const position = $derived.by(() => {
    if (!menu) return { x: 0, y: 0 };
    const estimatedHeight = Math.min(window.innerHeight - 16, items.length * 30 + 58);
    return clampToViewport(menu.x, menu.y, MENU_WIDTH, estimatedHeight);
  });
</script>

{#if menu && node}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="exs-context-backdrop"
    oncontextmenu={(event) => {
      event.preventDefault();
      editor.closeContextMenu();
    }}
    onclick={() => editor.closeContextMenu()}
  ></div>
  <div class="exs-context-menu" role="menu" style:left={`${position.x}px`} style:top={`${position.y}px`}>
    <div class="exs-context-menu__header">
      <strong>{nodeDisplayLabel(node, definition, 30)}</strong>
      <span>{definition?.label ?? node.type}</span>
    </div>
    {#each items as item, i (i)}
      {#if item.divider}
        <div class="exs-context-menu__divider"></div>
      {:else}
        {@const Icon = item.icon}
        <button
          type="button"
          role="menuitem"
          class="exs-context-menu__item"
          class:exs-context-menu__item--danger={item.danger}
          disabled={item.disabled}
          onclick={() => run(item)}
        >
          <span class="exs-context-menu__icon">
            {#if Icon}<Icon size={14} />{/if}
          </span>
          <span class="exs-context-menu__label">{item.label}</span>
          {#if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
        </button>
      {/if}
    {/each}
  </div>
{/if}
