/*
 * restore.cjs —— 从线上构建产物还原可读源码
 *
 * 输入（与线上逐字节一致的抓取件）:
 *   recovered/assets/game-BDvRcsxG.js   入口 chunk（游戏核心）
 *   recovered/assets/main-BsKo9vWW.js   懒加载 chunk（表现层）
 *
 * 输出:
 *   src/core.js   src/main.js
 *
 * 处理内容：
 *   1. prettier 重新格式化（printWidth 100 / 单引号 / 尾逗号）
 *   2. 去掉 Vite 注入的构建期运行时（__vite__mapDeps、modulepreload polyfill、
 *      __vitePreload），把 te(() => import(chunk), ...) 还原成 import('./main.js')
 *   3. chunk 之间的引用改写为源码路径（./core.js、./vendor/phaser.js）
 *   4. 按顶层语句位置插入分节注释（banners-*.cjs）
 *
 * 不做任何语义改写；标识符沿用压缩后的短名。
 * 运行后可用 tools/verify-ast.cjs 校验与线上产物 AST 完全一致。
 */
const fs = require('fs');
const path = require('path');
const prettier = require('prettier');
const acorn = require('acorn');

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'recovered', 'assets');
const SRC = path.join(ROOT, 'src');

const PRETTIER = { parser: 'babel', printWidth: 100, singleQuote: true, trailingComma: 'all' };

/* ---------------------------- core.js ---------------------------------- */

function buildCore() {
  const original = fs.readFileSync(path.join(RAW, 'game-BDvRcsxG.js'), 'utf8');
  const formatted = require('prettier').format; // 便于下面统一 await
  return formatted(original, PRETTIER).then((code) => {
    const lines = code.split('\n');
    // 行号基于 prettier 输出，见文件开头的构建产物结构：
    //   [1..5]   __vite__mapDeps
    //   [10..38] modulepreload polyfill
    //   [39..97] __vitePreload 运行时（J / ee / O / te）
    const strip = new Set();
    for (let i = 1; i <= 5; i++) strip.add(i);
    for (let i = 10; i <= 97; i++) strip.add(i);
    let out = lines
      .map((line, idx) => (strip.has(idx + 1) ? null : line))
      .filter((l) => l !== null)
      .join('\n');

    out = out.replace(
      /te\(\s*\(\) => import\('\.\/main-BsKo9vWW\.js'\),\s*__vite__mapDeps\(\[0, 1, 2\]\),\s*import\.meta\.url,?\s*\)\s*\.then\(\(r\) => r\.entryReady\)/,
      "import('./main.js').then((r) => r.entryReady)",
    );

    return (
      `/**\n` +
      ` * core.js —— 游戏核心（入口）\n` +
      ` *\n` +
      ` * 由线上构建产物 assets/game-BDvRcsxG.js 还原：\n` +
      ` *   · 删除 Vite 注入的 modulepreload 运行时（__vite__mapDeps / __vitePreload）\n` +
      ` *   · 动态加载恢复为源码写法 import('./main.js')\n` +
      ` *   · 逻辑与字符串未改动，标识符沿用压缩后的短名（对照表见 docs/ARCHITECTURE.md）\n` +
      ` */\n` +
      `import './styles/game.css';\n\n` +
      out
    );
  });
}

/* ---------------------------- main.js ---------------------------------- */

async function buildMain() {
  const original = fs.readFileSync(path.join(RAW, 'main-BsKo9vWW.js'), 'utf8');
  let code = await prettier.format(original, PRETTIER);
  code = code.replace(/from '\.\/game-BDvRcsxG\.js'/, "from './core.js'");
  code = code.replace(/from '\.\/phaser-0YPJO2g1\.js'/, "from './vendor/phaser.js'");
  return (
    `/**\n` +
    ` * main.js —— 表现层（懒加载）\n` +
    ` *\n` +
    ` * 由线上构建产物 assets/main-BsKo9vWW.js 还原：\n` +
    ` *   · 依赖路径改写为 ./core.js 与 ./vendor/phaser.js\n` +
    ` *   · 逻辑与字符串未改动，标识符沿用压缩后的短名（对照表见 docs/ARCHITECTURE.md）\n` +
    ` */\n` +
    `import './styles/main.css';\n\n` +
    code
  );
}

/* ------------------------- 分节注释 ------------------------------------ */

function annotate(file, banners) {
  let code = fs.readFileSync(file, 'utf8');
  // 幂等：先移除已经生成的 banner
  code = code.replace(/\/\* ={10,}\n(?: \*[^\n]*\n)*? \* ={10,} \*\/\n/g, '');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const inserts = [];
  for (const b of banners) {
    const st = ast.body[b.index];
    if (!st) throw new Error(`${file}: 没有第 ${b.index} 个顶层语句`);
    const text =
      '/* ' +
      '='.repeat(74) +
      '\n * ' +
      b.title +
      (b.detail ? '\n * ' + b.detail : '') +
      '\n * ' +
      '='.repeat(74) +
      ' */\n';
    inserts.push({ at: st.start, text });
  }
  inserts.sort((a, b) => b.at - a.at);
  for (const ins of inserts) code = code.slice(0, ins.at) + ins.text + code.slice(ins.at);
  fs.writeFileSync(file, code);
  console.log(`  ${path.relative(ROOT, file)}: 插入 ${inserts.length} 个分节标题`);
}

/* ------------------------------- main ---------------------------------- */

(async () => {
  fs.mkdirSync(path.join(SRC, 'styles'), { recursive: true });
  console.log('还原源码...');
  const core = await buildCore();
  fs.writeFileSync(path.join(SRC, 'core.js'), await prettier.format(core, PRETTIER));
  fs.writeFileSync(path.join(SRC, 'main.js'), await prettier.format(await buildMain(), PRETTIER));
  console.log('  src/core.js  src/main.js');

  console.log('插入分节标题...');
  annotate(path.join(SRC, 'main.js'), require('./banners-main.cjs'));
  annotate(path.join(SRC, 'core.js'), require('./banners-core.cjs'));
  console.log('完成。校验：node tools/verify-ast.cjs');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
