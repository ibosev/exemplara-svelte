import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as viteBuild, preview } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { devDependencies } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const core = resolve(root, '../exemplara-core'), plugins = resolve(root, '../exemplara-plugins');
const temp = mkdtempSync(resolve(tmpdir(), 'exemplara-packages-'));
const packs = resolve(temp, 'packs'); mkdirSync(packs);
function run(command, args, cwd = root) { execFileSync(command, args, { cwd, stdio: 'inherit' }); }
for (const cwd of [core, root, plugins]) {
  run('pnpm', ['build'], cwd);
  run('pnpm', ['pack', '--pack-destination', packs], cwd);
}
const tarballs = readdirSync(packs).filter(f => f.endsWith('.tgz')).map(f => resolve(packs, f));
const headless = resolve(temp, 'headless'); mkdirSync(headless);
writeFileSync(resolve(headless, 'package.json'), JSON.stringify({ name: 'exemplara-headless-proof', private: true, type: 'module' }));
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs.filter(f => !f.includes('exemplara-svelte-'))], headless);
for (const file of ['headless.mjs', 'headless.ts', 'browser.ts', 'pdf.mjs']) copyFileSync(resolve(root, 'scripts/consumers', file), resolve(headless, file));
run('node', ['headless.mjs'], headless);
writeFileSync(resolve(headless, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'NodeNext', target: 'ES2022', strict: true, skipLibCheck: false, noEmit: true, lib: ['ES2022'] }, include: ['headless.ts'] }));
run('node', [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', resolve(headless, 'tsconfig.json')]);
await viteBuild({
  root: headless,
  configFile: false,
  build: { lib: { entry: resolve(headless, 'browser.ts'), formats: ['es'], fileName: 'browser' }, write: false, minify: false },
  plugins: [{
    name: 'verify-headless-imports',
    generateBundle() {
      assert.ok([...this.getModuleIds()].every(file => !file.includes('exemplara-svelte') && !file.includes('/svelte/') && !file.endsWith('.svelte')));
    },
  }],
});
console.log('Headless declarations compile with ES2022 only; browser bundle has no Svelte.');
const view = resolve(temp, 'svelte'); mkdirSync(view);
writeFileSync(resolve(view, 'package.json'), JSON.stringify({ name: 'exemplara-view-proof', private: true, type: 'module' }));
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs, `svelte@${devDependencies.svelte}`], view);
copyFileSync(resolve(root, 'scripts/consumers/PackedEditor.svelte'), resolve(view, 'PackedEditor.svelte'));
writeFileSync(resolve(view, 'env.d.ts'), "declare module '*.css';");
writeFileSync(resolve(view, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'bundler', target: 'ES2022', strict: true, skipLibCheck: false, noEmit: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['svelte'] }, include: ['*.ts', '*.svelte'] }));
run('node', [resolve(root, 'node_modules/svelte-check/bin/svelte-check'), '--workspace', view, '--tsconfig', resolve(view, 'tsconfig.json')]);
writeFileSync(resolve(view, 'main.ts'), "import { mount } from 'svelte'; import Editor from './PackedEditor.svelte'; mount(Editor, { target: document.body });");
writeFileSync(resolve(view, 'index.html'), '<html><head><title>Packed editor</title></head><body><script type="module" src="/main.ts"></script></body></html>');
await viteBuild({ root: view, configFile: false, plugins: [svelte()], resolve: { dedupe: ['svelte', 'exemplara-core', 'exemplara-svelte', 'nanostores'] }, build: { outDir: 'build', minify: false } });
console.log('Packed Svelte editor and private view plugins build independently of source checkouts.');
if (process.env.EXEMPLARA_STATIC_ONLY === '1') {
  console.log('Static package certification passed. Browser runtime and Chromium PDF checks were explicitly skipped.');
  console.log(`Artifacts and fixtures: ${temp}`);
  process.exit(0);
}
const server = await preview({ root: view, configFile: false, build: { outDir: 'build' }, preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.EXEMPLARA_CHROMIUM_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  const first = page.locator('[data-session="0"]'), second = page.locator('[data-session="1"]');
  await first.getByTitle('Drag onto the page or click to add “Text”').click();
  await first.locator('.exs-inspector').waitFor();
  assert.equal(await second.getByLabel('Document name', { exact: true }).inputValue(), 'Document 2');
  assert.equal(await second.locator('.exs-node--selected').count(), 0);
  await second.getByTitle('Drag onto the page or click to add “Text”').click();
  await first.getByLabel('Document name', { exact: true }).fill('Retained first');
  await first.getByLabel('Document name', { exact: true }).press('Tab');
  await first.getByTitle('Undo (Ctrl+Z)', { exact: true }).focus();
  await page.keyboard.press('Control+z');
  assert.equal(await first.getByLabel('Document name', { exact: true }).inputValue(), 'Document 1');
  assert.equal(await second.locator('.exs-node--selected').count(), 1);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await first.getByLabel('Document name', { exact: true }).inputValue(), 'Retained first');
  await page.getByRole('button', { name: 'Toggle first view', exact: true }).click();
  assert.equal(await first.locator('.exs-editor').count(), 0);
  await page.getByRole('button', { name: 'Toggle first view', exact: true }).click();
  assert.equal(await first.getByLabel('Document name', { exact: true }).inputValue(), 'Retained first');
  assert.equal(await first.locator('.exs-node--selected').count(), 1);
  assert.deepEqual(errors, []);
  const { generatePackedPdf } = await import(pathToFileURL(resolve(headless, 'pdf.mjs')));
  const result = await generatePackedPdf(browser);
  assert.equal(Buffer.from(result.buffer).subarray(0, 5).toString(), '%PDF-');
  assert.ok(result.size > 1000); assert.equal(result.pageCount, 1);
  writeFileSync(resolve(temp, 'packed-proof.pdf'), result.buffer);
  console.log('Packed editors retain state across reattachment and isolate state and keyboard shortcuts; packed headless PDF generation passed.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
console.log(`Artifacts and fixtures: ${temp}`);
