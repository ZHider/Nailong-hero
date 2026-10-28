# 源码结构说明（勇者奶蛙传）

> 这份文档说明恢复出来的工程怎么组织、每个子系统在哪、以及压缩后的短名分别是什么。
> 所有结论都来自对 `runtime` 代码的阅读，标识符含义为**按行为推断**，功能语义可靠，但不可能还原作者当初的命名。

## 一、整体架构

线上版本是一个 Vite 构建的 ESM 应用，只有两段业务代码：

```
index.html
  └─ <script type="module"> assets/game-*.js     ← 入口 chunk（src/core.js）
       │   纯逻辑：游戏世界模拟、关卡数值、存档、加载页
       └─ import('./main.js')                    ← 懒加载 chunk（src/main.js）
            Phaser 3.90 渲染战斗场景 + 全部 DOM 界面 + 音频 + 广告 + 分享
```

- **core.js 不依赖 Phaser**：`GameWorld` 只用普通对象描述英雄、敌人、弹幕、波次与升级，`main.js` 里的 `BattleScene` 每帧把 `GameWorld` 的状态画出来。
- **界面全部用 DOM**：`main.js` 里一段约 90 行的模板字符串生成整个页面骨架（标题页、HUD、设置、结算、触控按钮），Phaser 只负责 `#canvas-root` 里的战场。
- **资源通过 `fetch` + `Cache Storage` 预加载**：图片不走 `<img>` 直连，而是逐张下载、按内置 SHA-256 清单校验后再解码使用。

## 二、文件一览

| 文件 | 说明 |
| --- | --- |
| `src/core.js` | 入口。加载页、存档、升级与角色数值表、`GameWorld`（约 2500 行）、然后 `import('./main.js')` 拉起表现层 |
| `src/main.js` | 表现层。资源加载与校验、音频、Phaser 战斗场景、DOM 界面、输入、分享 |
| `src/debug.js` | 调试面板（金手指）：跳关、清场、无敌、一击必杀、数值拉满。默认关闭 |
| `src/vendor/phaser.js` | 线上使用的 Phaser 3.90.0 打包产物，原样保留（未改装、未格式化） |
| `src/styles/game.css` | 入口样式（渠道主题 `html[data-channel=leyuan233]`） |
| `src/styles/main.css` | 表现层样式（HUD、屏幕、触控按钮、按键布局编辑器） |
| `public/assets/**` | 全部素材：74 张 webp、8 段 mp3、1 个 svg、1 段结局 mp4 |
| `public/manifest.json` `public/favicon.svg` | PWA 清单与图标 |
| `recovered/` | 线上原始抓取件（chunk、CSS、素材），只读留档 |
| `recovered/asset-manifest.json` | 内嵌在 `main.js` 里的「图片 → SHA-256」清单，可用于核对素材 |

## 三、core.js（游戏核心）

| 位置（分节标题） | 主要内容 | 关键短名 |
| --- | --- | --- |
| 加载页 | 在 `main.js` 到达前就能显示的进度页（进度条、重试、失败兜底） | `ie()` 建 DOM、`ne()` 单例 |
| 剧情与存档命名空间 | `naiwa:233-story:` 前缀与其缓存 | `X` `T` |
| 存储告警 | 存储不可用时派发 `leyuan-storage-warning` | `ke()` `Y()` |
| 存档读写 | 可注入存储后端，默认 `localStorage` | `re`（存储封装）、`B`/`ye()`（后端切换）、`ze()`/`Re()`/`Se()`（读/写/删） |
| 升级定义 | 关卡内三选一的强化条目（生命、移速、财运、蓄力等） | `$ ae we oe ce le` |
| 角色属性表 | 各角色的速度、血量、碰撞半径、动画帧等 | `x ue q z g Z R E v M H b me S m f C` |
| **游戏世界模拟 GameWorld** | 纯逻辑状态机：波次生成、AI、弹幕、碰撞、技能、Boss 阶段、金币与升级 | 类 `Me` |
| 存档 schema / 序列化 / 反序列化 / 迁移 | 存档结构版本、字段校验、旧档兼容 | `I N U Q V F y fe k ge`、`pe()`/`xe()`/`Ce()` |
| 加载表现层 | `import('./main.js')`，失败时在加载页提示 | — |

**七章关卡表**（`src/core.js` 中 `H`）：

| 章 | 名称 | 背景 | 波次 |
| --- | --- | --- | --- |
| 1 | 奶笑村 | village | 5 / 8 |
| 2 | 咕嘎小径 | forest | 7 / 11 |
| 3 | 刀盾山道 | mountain | 9 / 13 / 17 |
| 4 | 风暴断桥 | bridge | 10 / 14 / 18 |
| 5 | 禁声堡垒 | courtyard | 11 / 16 / 21 |
| 6 | 肃静大殿 | hall | 12 / 17 / 23 |
| 7 | 无声王座 | throne | Boss 战 |

## 四、main.js（表现层）

| 位置（分节标题） | 主要内容 | 关键短名 |
| --- | --- | --- |
| 角色皮肤表 | 目前只有 `classic`（经典奶蛙），结构支持多套 | `Fe` `us()` |
| 贴图锚点 | 每个角色的脚底基准点与参考高度（缩放、贴地） | `fs bs ps ms gs Bt` |
| 静态图片清单 | 背景 / 角色 / 轮廓 / 首领第二形态 / 渠道封面 | `wt` `we()` `Nt` `ws` |
| 静态图片 SHA-256 清单 | 下载后逐张校验 | `qt` |
| 图片缓存与预加载 | Cache Storage + 4 并发 + 解码校验 | `ks ne Xe Wt Te kt xt As At` |
| 横竖屏与视口适配 | 旋转、全屏、safe-area、`--game-width/height` | `Rs()` |
| 虚拟摇杆 | 左侧滑动区、指针捕获、旋转后坐标换算 | `Is()` |
| 手游按键布局 | 默认坐标、存储键 `naiwa-touch-layout-v1`、拖拽/缩放/错开重叠 | `j le zs Le et Lt Me X nt`、编辑器 `wa()` |
| 音频 | 敌人音效、循环 BGM、语音池、奶蛋语音序列、WebAudio 合成音效 | `Us` `Ys` `Xs` `Js` `ta` `sa` |
| 战斗场景 | Phaser `Scene('battle')`：渲染、镜头、粒子、受击反馈、关卡推进 | 类 `pa`（约 2000 行） |
| 启动 Phaser | 1280×720、AUTO、`Scale.NONE`（自适应交给 CSS） | `ma()` |
| 页面骨架与图标 | 全部 DOM 界面都在一段模板字符串里 | `T`（SVG 图标）、`ge`（骨架） |
| 界面切换 | title / battle / upgrade / pause / defeat / win / cinematic | `M()` |
| 设置应用 | 静音、音效、BGM、BGM 模式、震屏 | `I()`、`We`/`x` |
| 升级卡定义 | 防御、自动奶球、三连/穿透弹幕、连发、黄桃罐头、余震、大笑强化 | `ka` `Vt` |
| HUD / 章节提示 / 升级界面 / 结算 | 血量、能量、连击、技能状态、章节 Toast、战绩 | `va()` `xa()` `Aa()` `Kt()` |
| 分享 | 文案 + 剪贴板；Canvas 现场绘制 1080×1440 海报 | `La()` `Ma()` |
| 输入 | 防御、奶球、摇杆、冲刺/大笑/奶蛋/连点、超级大笑 | `Ce O tt qe q lt Qt` |
| 全局事件 | 失焦暂停、`visibilitychange`、`pagehide` 存档、ESC 暂停、错误兜底 | `je()` `Zt()` |
| 启动引导 | 等核心就绪 → 预加载图片（带进度）→ 进入标题 | `Ia()` |
| 死亡后重闯 | 失败界面 → 点「再来一次」直接回到本区域入口（原版此处要先看激励视频） | `Ca()` `Pa()` |
| 调试面板 | 金手指：跳关 / 清场 / 无敌 / 一击必杀 / 数值拉满（`src/debug.js`，走 `debugJump()` / `debugClear()` 与 `getModel()`） | `debugJump()` `debugClear()` |
| 广告 | **已移除**。原为 233 乐园激励视频（SDK 适配 / `AdManager` / 复活调度），见 `docs/CHANGELOG-ads-removed.md` | — |

## 五、运行时状态与存档键

| 键 | 用途 |
| --- | --- |
| `naiwa-run-v1` | 战斗存档（关卡、波次、英雄、敌人、升级、RNG seed） |
| `naiwa-settings-v1` | 声音/画面设置 |
| `naiwa-best-v2` | 本机最快营救纪录 |
| `naiwa-touch-layout-v1` | 手游按键布局 |
| `naiwa-static-images-v1` | Cache Storage 中的图片缓存（带 `?naiwa-image=<sha256>`） |

`index.html` 里没有业务代码，`<main id="app">` 由 `main.js` 填充。
页面通过 `document.documentElement.dataset.channel = 'leyuan233'` 打渠道标记，CSS 靠它切主题。

## 六、素材与完整性校验

- `main.js` 内置一份 `图片路径 → SHA-256` 清单（`qt`）。加载时逐张 `crypto.subtle.digest` 校验，不一致会中断并提示「图片版本校验未通过」。
- 因此 `public/assets/` 下的图片**不要重新压缩/改名**，否则线上会直接报错。要换图，必须同时更新清单里的哈希。
- 音频和结局视频没有哈希校验，可直接替换。

## 七、与原产物的差异

**恢复时（纯还原，不改逻辑）**

1. 去掉了 Vite 注入的 `__vite__mapDeps` / modulepreload polyfill / `__vitePreload`，`import('./main.js')` 用原生动态 import。
2. CSS 改为在 JS 顶部 `import`（原版是构建期生成的 `<link>` 预加载）。
3. `phaser-0YPJO2g1.js` 原样放进 `src/vendor/`，`main.js` 里 `import { g, r }` 的两个辅助函数保持不变。

此时 AST 与线上产物逐语句一致（`core.js` 一侧共 5 处构建期改写，见 `pnpm verify:core`）。

**之后的功能改动**

4. 2026-10 移除广告：删除 SDK 适配、`AdManager`、复活调度与相关联动，死亡后直接重闯。
   详见 `docs/CHANGELOG-ads-removed.md`。`pnpm verify` 的差异清单就是这些改动。
