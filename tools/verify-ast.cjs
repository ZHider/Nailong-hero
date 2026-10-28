/*
 * AST equivalence check: the recovered source must be structurally identical
 * to the shipped bundle, apart from the explicitly intended edits.
 *
 *   node work/verify-ast.cjs
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');

function normalize(node) {
  if (Array.isArray(node)) return node.map(normalize);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'start' || k === 'end' || k === 'loc' || k === 'range') continue;
      if (k === 'raw' || k === 'rawValue') continue;
      out[k] = normalize(v);
    }
    return out;
  }
  return node;
}

function statements(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = normalize(acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }));
  return ast.body.map((st) => JSON.stringify(st));
}

const isImport = (s) => s.startsWith('{"type":"ImportDeclaration"');

// Statements that exist only because of the Vite build.
const isViteArtifact = (s) =>
  s.includes('__vite__mapDeps') ||
  s.includes('__vitePreload') ||
  (s.includes('modulepreload') && s.includes('MutationObserver')) ||
  (s.includes('csp-nonce') && s.includes('stylesheet'));

// The single rewritten call: __vitePreload(() => import(chunk)) -> import('./main.js')
const isLazyLoad = (s) => s.includes('entryReady');

const drop = (list, pred) => list.filter((s) => !pred(s));

function compare(label, originalFile, sourceFile, opts) {
  const a0 = statements(originalFile);
  const b0 = statements(sourceFile);
  const a = drop(a0, opts.dropOriginal);
  const b = drop(b0, opts.dropSource);
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push({ i, original: a[i], source: b[i] });
  }
  console.log(`\n=== ${label} ===`);
  console.log(
    `statements compared: original ${a.length}/${a0.length}, recovered ${b.length}/${b0.length}`,
  );
  for (const d of diffs) {
    const preview = (s) => (s ? s.slice(0, 130) : '<absent>');
    console.log(`  [DIFF] #${d.i}`);
    console.log(`    original: ${preview(d.original)}`);
    console.log(`    source  : ${preview(d.source)}`);
  }
  console.log(diffs.length === 0 ? '  -> identical' : `  -> ${diffs.length} difference(s)`);
  return diffs.length === 0;
}

const okMain = compare(
  'main.js  vs  shipped assets/main-BsKo9vWW.js',
  path.join(ROOT, 'recovered/assets/main-BsKo9vWW.js'),
  path.join(ROOT, 'src/main.js'),
  { dropOriginal: isImport, dropSource: isImport },
);

const okCore = compare(
  'core.js  vs  shipped assets/game-BDvRcsxG.js',
  path.join(ROOT, 'recovered/assets/game-BDvRcsxG.js'),
  path.join(ROOT, 'src/core.js'),
  {
    dropOriginal: (s) => isImport(s) || isViteArtifact(s) || isLazyLoad(s),
    dropSource: (s) => isImport(s) || isLazyLoad(s),
  },
);

// Import specifiers must still line up with the original chunk graph.
function imports(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  return ast.body
    .filter((n) => n.type === 'ImportDeclaration')
    .map((n) => ({ from: n.source.value, names: n.specifiers.map((s) => s.imported?.name ?? 'css') }));
}

const originalMain = imports(path.join(ROOT, 'recovered/assets/main-BsKo9vWW.js'));
const recoveredMain = imports(path.join(ROOT, 'src/main.js'));
const originalCore = imports(path.join(ROOT, 'recovered/assets/game-BDvRcsxG.js'));
const recoveredCore = imports(path.join(ROOT, 'src/core.js'));

const stripCss = (list) => list.filter((i) => !i.from.endsWith('.css'));
const names = (list) => JSON.stringify(stripCss(list).map((i) => i.names));
const sameImports = names(originalMain) === names(recoveredMain) && names(originalCore) === names(recoveredCore);
if (!sameImports) {
  console.log('original main imports :', JSON.stringify(stripCss(originalMain)));
  console.log('recovered main imports:', JSON.stringify(stripCss(recoveredMain)));
}

console.log('\nimport graph preserved:', sameImports);
console.log('RESULT:', okMain && okCore && sameImports ? 'PASS' : 'REVIEW NEEDED');
process.exit(okMain && okCore && sameImports ? 0 : 1);
