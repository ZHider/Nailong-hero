/*
 * refs.cjs —— 列出 src 里某个顶层绑定被引用的行号（scope 精确，不会误匹配同名局部变量）
 *
 *   node tools/refs.cjs src/main.js "St,ce,Ms,_" 
 */
const fs = require('fs');
const acorn = require('acorn');
const es = require('eslint-scope');

const [, , file, list] = process.argv;
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
const sm = es.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });

const lineStarts = [0];
for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
const lineOf = (pos) => {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
};

// ESM 下模块顶层绑定在 type === 'module' 的作用域里，不在 globalScope。
const moduleScope = sm.scopes.find((s) => s.type === 'module') || sm.globalScope;

for (const name of list.split(',').map((s) => s.trim()).filter(Boolean)) {
  const v = moduleScope.variables.find((x) => x.name === name);
  if (!v) {
    console.log(`${name.padEnd(6)} -> 没有这个顶层绑定`);
    continue;
  }
  const lines = [
    ...v.references.map((r) => lineOf(r.identifier.start)),
    ...v.identifiers.map((n) => lineOf(n.start)),
  ].sort((a, b) => a - b);
  console.log(`${name.padEnd(6)} 引用 ${String(lines.length).padStart(3)} 次: ${lines.join(', ')}`);
}
