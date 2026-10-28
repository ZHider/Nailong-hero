/*
 * verify-ast.cjs —— 把 src 与线上构建产物做「顶层语句级」比对
 *
 *   node tools/verify-ast.cjs           报告模式：列出差异，退出码始终 0
 *   node tools/verify-ast.cjs --strict  严格模式：有任何差异即退出码 1
 *
 * 用途：
 *   1. 刚恢复完、还没改过代码时，--strict 应通过（证明只做了格式化与路径改写）
 *   2. 改过代码后，报告模式给出「相对线上版本动了哪些顶层语句」，方便 review
 *
 * 差异分三类：一致 / 改动（同名语句内容变了）/ 删除 / 新增。
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];

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
  const raw = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const texts = raw.body.map((st) =>
    src.slice(st.start, st.end).replace(/\s+/g, ' ').slice(0, 70),
  );
  return normalize(raw).body.map((node, i) => ({ node, text: texts[i] }));
}

const key = (st) => JSON.stringify(st.node);

const label = ({ node: st, text }) => {
  if (st.type === 'ImportDeclaration') return `import ${st.source.value}`;
  const d = st.declaration || st;
  if (d.type === 'VariableDeclaration')
    return `const/let ${d.declarations.map((x) => x.id.name ?? x.id.type).join(', ')}`;
  if (d.type === 'FunctionDeclaration') return `function ${d.id.name}()`;
  if (d.type === 'ClassDeclaration') return `class ${d.id.name}`;
  if (d.type === 'ExportNamedDeclaration') return 'export { ... }';
  return `语句: ${text}`;
};

const sig = ({ node: st }) => {
  const d = st.declaration || st;
  const name = d.id?.name ?? d.declarations?.[0]?.id?.name ?? '';
  return `${st.type}:${name}`;
};

// ---- 最长公共子序列：只有完全相同的语句才算「一致」 ----
function lcs(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

function compare(fileLabel, originalFile, sourceFile) {
  const a = statements(originalFile);
  const b = statements(sourceFile);
  const pairs = lcs(a.map(key), b.map(key));
  const sameA = new Set(pairs.map(([i]) => i));
  const sameB = new Set(pairs.map(([, j]) => j));

  const removed = a.filter((_, i) => !sameA.has(i));
  const added = b.filter((_, j) => !sameB.has(j));

  // 同名语句（同 type + 同声明名）配成「改动」
  const changed = [];
  for (const r of [...removed]) {
    const idx = added.findIndex((x) => sig(x) === sig(r));
    if (idx === -1) continue;
    changed.push(r);
    removed.splice(removed.indexOf(r), 1);
    added.splice(idx, 1);
  }

  console.log(`\n=== ${fileLabel} ===`);
  console.log(`线上 ${a.length} 条顶层语句 / 当前 ${b.length} 条`);
  console.log(
    `一致 ${pairs.length} 条，改动 ${changed.length} 条，删除 ${removed.length} 条，新增 ${added.length} 条`,
  );
  if (changed.length) {
    console.log('  改动：');
    for (const r of changed) console.log(`    ~ ${label(r)}`);
  }
  if (removed.length) {
    console.log('  删除：');
    for (const r of removed) console.log(`    - ${label(r)}`);
  }
  if (added.length) {
    console.log('  新增：');
    for (const x of added) console.log(`    + ${label(x)}`);
  }
  return changed.length + removed.length + added.length;
}

const diffsMain = ONLY === 'core' ? 0 : compare(
  'src/main.js  vs  线上 assets/main-BsKo9vWW.js',
  path.join(ROOT, 'recovered/assets/main-BsKo9vWW.js'),
  path.join(ROOT, 'src/main.js'),
);
const diffsCore = ONLY === 'main' ? 0 : compare(
  'src/core.js  vs  线上 assets/game-BDvRcsxG.js',
  path.join(ROOT, 'recovered/assets/game-BDvRcsxG.js'),
  path.join(ROOT, 'src/core.js'),
);

const total = diffsMain + diffsCore;
console.log(`\n合计差异：${total} 处`);
if (STRICT) {
  console.log(total === 0 ? 'RESULT: PASS（与线上产物一致）' : 'RESULT: FAIL（存在差异）');
  process.exit(total === 0 ? 0 : 1);
}
console.log('RESULT: 报告模式（严格校验请加 --strict）');
