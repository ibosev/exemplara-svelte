import { EditorSession, createFullEditorPreset } from 'exemplara-core/editor';
import { createDataBindingPlugin } from 'exemplara-plugins/core/data-binding';
import { render } from 'exemplara-core/renderer';
export const session = new EditorSession({ composition: createFullEditorPreset({ plugins: [createDataBindingPlugin()] }) });
export const html = render(session.snapshot()).html;
