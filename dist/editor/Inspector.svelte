<script lang="ts">
  import PropField from './PropField.svelte';
  import HtmlAttributesField from './HtmlAttributesField.svelte';
  import ImageProperties from './ImageProperties.svelte';
  import TableColumnsField from './TableColumnsField.svelte';
  import TableRowsField from './TableRowsField.svelte';
  import { getEditorContext } from './context.svelte.js';
  import { PAGE_PRESETS } from '../core/presets.js';
  import {
    bindingAuthoringValue,
    commitBindingAuthoring,
  } from '../shared/binding-authoring.js';
  import type { PropSchema } from '../core/types.js';
  import type { Orientation, PagePreset } from '../core/types.js';
  import { isWebDocument } from '../core/web.js';
  import { friendlyElementLabel } from './friendly-labels.js';
  import AppearanceSection from './panels/AppearanceSection.svelte';

  const editor = getEditorContext();

  const node = $derived(editor.selectedNode);
  const definition = $derived(editor.selectedDefinition);
  const page = $derived(editor.activePage);
  const webDocument = $derived(isWebDocument(editor.doc));
  const emailDocument = $derived(
    (editor.doc.meta.tags ?? []).includes('email') || (editor.doc.meta.tags ?? []).includes('email-atoms'),
  );
  const nodeActions = $derived(node
    ? editor.extensions.menuItems('inspector.actions', editor, { nodeId: node.id })
    : []);
  const dataAuthoringEnabled = $derived(
    editor.isProvidedCapabilityEnabled('data.bind.author'),
  );
  const htmlImage = $derived(
    node?.type === 'html-element' && String(node.props.tagName ?? '').toLowerCase() === 'img',
  );

  function setPagePreset(preset: string) {
    if (!page) return;
    const size =
      preset === 'custom'
        ? { ...page.size, preset: 'custom' as const }
        : { ...PAGE_PRESETS[preset as Exclude<PagePreset, 'custom'>], preset: preset as PagePreset };
    editor.engine.execute({ type: 'page:update', payload: { pageId: page.id, changes: { size } } });
  }

  function setOrientation(orientation: Orientation) {
    if (!page) return;
    editor.engine.execute({ type: 'page:update', payload: { pageId: page.id, changes: { orientation } } });
  }

  function setPageLabel(label: string) {
    if (!page) return;
    editor.engine.execute({ type: 'page:update', payload: { pageId: page.id, changes: { label } } });
  }

  function supportsBindingSyntax(schema: PropSchema): boolean {
    return dataAuthoringEnabled
      && (schema.type === 'richtext' || schema.type === 'string' || schema.type === 'image' || !!schema.multiline);
  }

  function authoringValue(propName: string, schema: PropSchema): unknown {
    if (!node || !supportsBindingSyntax(schema)) return node?.props[propName];
    return bindingAuthoringValue(node, propName);
  }

  function updateProp(propName: string, schema: PropSchema, value: unknown): void {
    if (!node || typeof value !== 'string' || !supportsBindingSyntax(schema)) {
      if (node) editor.updateProps(node.id, { [propName]: value });
      return;
    }
    const existing = node.dataBindings?.find((binding) => binding.targetProp === propName);
    const authored = commitBindingAuthoring(
      node,
      value,
      editor.doc.dataSources,
      existing?.sourceId,
      propName,
    );
    editor.commitPropAuthoring(node.id, propName, authored.content, authored.dataBindings);
  }

  function runNodeAction(commandId: string): void {
    if (node) void editor.runCommand(commandId, { nodeId: node.id });
  }

</script>

{#if node && definition}
  {@const NodeIcon = editor.componentIcon(htmlImage ? 'image' : node.type)}
  {@const nodeLabel = htmlImage ? 'Image' : friendlyElementLabel(node, definition.label)}
  <h3 class="exs-panel-title exs-panel-title--node">
    {#if NodeIcon}<NodeIcon size={13} />{:else}{definition.icon}{/if}
    {nodeLabel}
  </h3>
  <div class="exs-inspector">
    {#if nodeActions.length > 0}
      <div class="exs-inspector__actions">
        {#each nodeActions as action (action.id)}
          {@const ActionIcon = action.command.icon}
          {@const showLabel = action.command.id === 'node.duplicate'}
          <button
            type="button"
            class="exs-btn"
            class:exs-btn--icon={!showLabel}
            class:exs-btn--danger={action.command.danger}
            title={`${action.command.label}${action.command.shortcut ? ` (${action.command.shortcut})` : ''}`}
            aria-label={action.command.label}
            disabled={!action.enabled}
            onclick={() => runNodeAction(action.command.id)}
          >
            {#if ActionIcon}<ActionIcon size={13} />{/if}
            {#if showLabel}{action.command.label}{/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if node.type === 'html-element' || node.type === 'html-text' || node.type === 'web-section' || node.type === 'container'}
      <AppearanceSection />
    {/if}

    {#if htmlImage || node.type === 'image'}
      <ImageProperties {editor} {node} />

      {#if htmlImage}
        <details class="exs-details exs-html-advanced">
          <summary>Advanced</summary>
          <div class="exs-html-advanced__body">
            <label class="exs-field">
              <span class="exs-field__label">Element ID</span>
              <input type="text" value={String(node.props.htmlId ?? '')} onchange={(event) => editor.updateProps(node.id, { htmlId: event.currentTarget.value })} />
            </label>
            <HtmlAttributesField
              value={node.props.attributes}
              exclude={['src', 'alt', 'title', 'loading', 'decoding', 'width', 'height']}
              label="Other HTML attributes"
              onchange={(value) => editor.updateProps(node.id, { attributes: value })}
            />
            <label class="exs-field">
              <span class="exs-field__label">Custom inline CSS</span>
              <textarea value={String(node.props.inlineStyle ?? '')} onchange={(event) => editor.updateProps(node.id, { inlineStyle: event.currentTarget.value })}></textarea>
              <span class="exs-field__help">Use the Design panel for common visual changes.</span>
            </label>
            <PropField
              name="attributeBlocks"
              schema={definition.propSchema.attributeBlocks!}
              value={node.props.attributeBlocks}
              onchange={(value) => editor.updateProps(node.id, { attributeBlocks: value })}
            />
          </div>
        </details>
      {/if}
    {:else if node.type === 'html-element'}
      <details class="exs-details exs-html-advanced">
        <summary>Advanced</summary>
        <div class="exs-html-advanced__body">
          {#each Object.entries(definition.propSchema) as [propName, schema] (propName)}
            {#if propName === 'attributes'}
              <HtmlAttributesField
                value={node.props.attributes}
                onchange={(value) => editor.updateProps(node.id, { attributes: value })}
              />
            {:else}
              <PropField
                name={propName}
                {schema}
                value={authoringValue(propName, schema)}
                onchange={(value) => updateProp(propName, schema, value)}
              />
            {/if}
          {/each}
        </div>
      </details>
    {:else}
      {#each Object.entries(definition.propSchema) as [propName, schema] (propName)}
        {#if node.type === 'table' && propName === 'columns'}
          <TableColumnsField {editor} {node} />
        {:else if node.type === 'table' && propName === 'rows'}
          <TableRowsField {editor} {node} />
        {:else if node.type === 'html-element' && propName === 'attributes'}
          <HtmlAttributesField
            value={node.props.attributes}
            onchange={(value) => editor.updateProps(node.id, { attributes: value })}
          />
        {:else}
          <PropField
            name={propName}
            {schema}
            value={authoringValue(propName, schema)}
            onchange={(value) => updateProp(propName, schema, value)}
          />
        {/if}
      {/each}
    {/if}

    {#each editor.extensions.inspectorSections(editor, node) as section (section.id)}
      {@const Section = section.component}
      <Section {editor} {node} />
    {/each}
  </div>
{:else if page}
  <h3 class="exs-panel-title">{emailDocument ? 'Letter' : webDocument ? 'Route settings' : 'Page settings'}</h3>
  <div class="exs-inspector">
    <div class="exs-field">
      <label class="exs-field__label" for="exs-page-label">Label</label>
      <input
        id="exs-page-label"
        type="text"
        value={page.label}
        onchange={(event) => setPageLabel(event.currentTarget.value)}
      />
    </div>

    {#if !webDocument}
    <div class="exs-field">
      <label class="exs-field__label" for="exs-page-preset">Size</label>
      <select
        id="exs-page-preset"
        value={page.size.preset ?? 'custom'}
        onchange={(event) => setPagePreset(event.currentTarget.value)}
      >
        {#each ['A3', 'A4', 'A5', 'Letter', 'Legal', 'custom'] as preset (preset)}
          <option value={preset}>{preset}</option>
        {/each}
      </select>
    </div>
	{/if}

    {#if !webDocument}
    <div class="exs-field">
      <label class="exs-field__label" for="exs-page-orientation">Orientation</label>
      <select
        id="exs-page-orientation"
        value={page.orientation}
        onchange={(event) => setOrientation(event.currentTarget.value as Orientation)}
      >
        <option value="portrait">Portrait</option>
        <option value="landscape">Landscape</option>
      </select>
    </div>
	{:else if emailDocument}
	  <div class="exs-field">
		<span class="exs-field__label">Email letter</span>
		<p class="exs-field__hint">600px wide. Inbox clients ignore most layout CSS; keep structure in the letter body.</p>
	  </div>
	{:else}
	  <div class="exs-field">
		<span class="exs-field__label">Responsive website</span>
		<p class="exs-field__hint">Open the Web panel to edit this route's URL, SEO title, description, language, viewport, and canvas colors.</p>
	  </div>
	{/if}

    {#if !webDocument}
    <div class="exs-field">
      <span class="exs-field__label">Background color</span>
      <div class="exs-field__color">
        <input
          type="color"
          value={page.regions.background?.style?.background?.match(/^#[0-9a-f]{6}$/i)
            ? page.regions.background.style.background
            : '#ffffff'}
          oninput={(e) => editor.setPageBackground(page.id, e.currentTarget.value)}
        />
        <input
          type="text"
          placeholder="none"
          value={page.regions.background?.style?.background ?? ''}
          aria-label="Page background color"
          onchange={(e) => editor.setPageBackground(page.id, e.currentTarget.value)}
        />
      </div>
    </div>

    <div class="exs-field">
      <span class="exs-field__label">In-sheet regions</span>
      {#each ['header', 'footer', 'background'] as const as regionName (regionName)}
        <label class="exs-field--row exs-checkbox">
          <span style="text-transform: capitalize">{regionName}</span>
          <input
            type="checkbox"
            checked={!!page.regions[regionName]}
            onchange={() => editor.toggleRegion(page.id, regionName)}
          />
        </label>
      {/each}
    </div>
	{/if}

    {#if !webDocument}
    {#each ['header', 'footer'] as const as regionName (regionName)}
      {#if page.regions[regionName]}
        {@const variantKey = regionName === 'header' ? 'headerVariant' : ('footerVariant' as const)}
        <div class="exs-field">
          <label class="exs-field__label" for={`exs-${regionName}-variant`} style="text-transform: capitalize">
            {regionName} shows on
          </label>
          <select
            id={`exs-${regionName}-variant`}
            value={page[variantKey]}
            onchange={(e) =>
              editor.engine.execute({
                type: 'page:update',
                payload: { pageId: page.id, changes: { [variantKey]: e.currentTarget.value } },
              })}
          >
            <option value="all">All pages</option>
            <option value="first">First page only</option>
            <option value="odd-even">All (tag odd/even for styling)</option>
          </select>
        </div>
      {/if}
    {/each}

    <div class="exs-field">
      <span class="exs-field__label">In-sheet page numbering</span>
      <label class="exs-field--row exs-checkbox">
        <span>Enabled</span>
        <input
          type="checkbox"
          checked={!!page.pageNumbering}
          onchange={(e) =>
            editor.engine.execute({
              type: 'page:update',
              payload: {
                pageId: page.id,
                changes: {
                  pageNumbering: e.currentTarget.checked
                    ? { start: 1, format: 'numeric', position: 'footer', alignment: 'center' }
                    : undefined,
                },
              },
            })}
        />
      </label>
      {#if page.pageNumbering}
        {@const numbering = page.pageNumbering}
        <select
          aria-label="Number format"
          value={numbering.format}
          onchange={(e) =>
            editor.engine.execute({
              type: 'page:update',
              payload: { pageId: page.id, changes: { pageNumbering: { ...numbering, format: e.currentTarget.value as typeof numbering.format } } },
            })}
        >
          <option value="numeric">1, 2, 3</option>
          <option value="roman">i, ii, iii</option>
          <option value="alpha">a, b, c</option>
        </select>
        <select
          aria-label="Number alignment"
          value={numbering.alignment}
          onchange={(e) =>
            editor.engine.execute({
              type: 'page:update',
              payload: { pageId: page.id, changes: { pageNumbering: { ...numbering, alignment: e.currentTarget.value as typeof numbering.alignment } } },
            })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      {/if}
    </div>
	{/if}

    {#if editor.doc.pages.length > 1}
      <button type="button" class="exs-btn exs-btn--danger" onclick={() => editor.removePage(page.id)}>
        Delete page
      </button>
    {/if}
  </div>
{:else}
  <div class="exs-inspector__empty">Select a component to edit its properties.</div>
{/if}
