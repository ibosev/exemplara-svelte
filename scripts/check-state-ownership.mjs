import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'svelte/compiler';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [resolve(root, 'src/lib'), resolve(root, '../exemplara-plugins/src/lib'), resolve(root, '../exemplara-playground/src')];
const failures = [];
let files = 0, references = 0, disclosures = 0;
const resources = new Map([
  ['src/lib/editor/Canvas.svelte', new Set(['resizeObserver'])],
  ['src/lib/editor/SelectionToolbar.svelte', new Set(['resizeObserver', 'updateFrame'])],
  ['src/lib/editor/PrintChromeEditor.svelte', new Set(['cleanup'])],
]);
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) { await inspect(path); continue; }
    if (!/\.(ts|svelte)$/.test(entry.name)) continue;
    files++;
    const source = await readFile(path, 'utf8'), label = relative(root, path);
    const scripts = entry.name.endsWith('.svelte') ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]) : [source];
    for (const script of scripts) {
      const ast = ts.createSourceFile(path, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      for (const statement of ast.statements) {
        if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'nanostores') {
          const imports = statement.importClause?.namedBindings;
          if (imports && ts.isNamedImports(imports)) for (const element of imports.elements) {
            if (['atom', 'map', 'deepMap'].includes((element.propertyName ?? element.name).text)) failures.push(`${label}: state constructor belongs in exemplara-core`);
          }
        }
        if (entry.name.endsWith('.svelte') && ts.isVariableStatement(statement) && !(statement.declarationList.flags & ts.NodeFlags.Const)) {
          for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name)) continue; // $props destructuring is a view input.
            const value = declaration.initializer?.getText(ast) ?? '';
            if (!value.startsWith('$state') && !resources.get(label)?.has(declaration.name.text)) failures.push(`${label}: local mutable ${declaration.name.text}`);
          }
        }
      }
      function visit(node) {
        if (ts.isCallExpression(node) && /^\$state(?:\.raw)?$/.test(node.expression.getText(ast))) {
          const type = node.typeArguments?.[0]?.getText(ast) ?? node.parent.type?.getText(ast) ?? '';
          if (!/\bHTML\w*Element\b|\bHTMLElement\b/.test(type)) failures.push(`${label}: application $state must move into exemplara-core`);
          else references++;
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
    if (entry.name.endsWith('.svelte')) {
      function visit(node) {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'RegularElement' && node.name === 'details') {
          disclosures++;
          if (!node.attributes.some(attribute => attribute.type === 'AttachTag' && attribute.expression?.callee?.name === 'persistentDisclosure')) failures.push(`${label}: disclosure has no core state owner`);
        }
        for (const value of Object.values(node)) {
          if (Array.isArray(value)) value.forEach(visit);
          else if (value && typeof value === 'object') visit(value);
        }
      }
      visit(parse(source, { modern: true }));
    }
  }
}
for (const directory of sources) await inspect(directory);
assert.deepEqual(failures, [], failures.join('\n'));
console.log(`State ownership passed: ${files} source files; ${references} DOM references remain in Svelte; all ${disclosures} disclosures use core stores.`);
