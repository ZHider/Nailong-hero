/*
 * spill2png.cjs —— 把 MCP 截图工具落到 spill 文件里的 base64 还原成 PNG
 *   node tools/spill2png.cjs <spill.txt> <out.png>
 * （调试期的小工具，正常开发用不到）
 */
const fs = require('fs');
const [, , inFile, outFile] = process.argv;
const txt = fs.readFileSync(inFile, 'utf8');
const m = txt.match(/"screenshot_base64"\s*:\s*"([A-Za-z0-9+/=]+)"/);
if (!m) throw new Error('没找到 screenshot_base64');
const buf = Buffer.from(m[1], 'base64');
fs.writeFileSync(outFile, buf);
console.log(outFile, buf.length, 'bytes');
