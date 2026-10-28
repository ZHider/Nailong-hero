/**
 * debug.js —— 调试 / 金手指面板
 *
 * 打开方式（任选其一）：
 *   1. 在页面里依次敲键盘 n a i l o n g（2.5 秒内，输入框里不算）
 *   2. Ctrl + Shift + D
 *   3. URL 加 ?debug=1
 *   4. 控制台执行 __nailongDebug.open()
 *
 * 能力：跳章、清空本波、无敌、一击必杀、满血、能量满、黄桃 +9、解锁冲撞、蓄力满。
 * 所有开关只影响 GameWorld 上的 debug 字段与几个数值字段，不改动正常玩法逻辑；
 * 页面刷新后自动恢复原状。
 */

const STYLE_ID = 'nailong-debug-style';

const CSS = `
.nl-debug{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-start;
  justify-content:flex-end;padding:16px;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;
  color:#e8e3f0;background:rgba(8,6,14,.28)}
.nl-debug__panel{width:min(340px,92vw);max-height:calc(100vh - 32px);overflow:auto;
  background:#16121f;border:1px solid #453a5c;border-radius:12px;
  box-shadow:0 18px 50px rgba(0,0,0,.5)}
.nl-debug__head{display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;border-bottom:1px solid #2c2440}
.nl-debug__title{font-weight:700;letter-spacing:.06em;color:#ffd96e}
.nl-debug__x{background:none;border:0;color:#b1a7b9;font-size:16px;cursor:pointer;padding:2px 6px}
.nl-debug__body{padding:10px 12px 14px}
.nl-debug__status{white-space:pre-line;color:#b9b0c9;background:#0f0c16;border:1px solid #2c2440;
  border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px}
.nl-debug__row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.nl-debug__label{width:100%;color:#8f86a2;font-size:11px;letter-spacing:.08em;margin-bottom:2px}
.nl-debug button.nl-debug__btn{flex:1 1 auto;min-width:64px;padding:6px 8px;cursor:pointer;
  background:#241d33;color:#e8e3f0;border:1px solid #3d3355;border-radius:7px;font:inherit}
.nl-debug button.nl-debug__btn:hover{background:#2f2644;border-color:#5a4b7a}
.nl-debug button.nl-debug__btn.is-on{background:#4a3a14;border-color:#ffd96e;color:#ffd96e}
.nl-debug__flags{display:grid;gap:6px;margin-top:10px}
.nl-debug__flag{display:flex;align-items:center;gap:8px;cursor:pointer;
  background:#1d1729;border:1px solid #332a49;border-radius:7px;padding:6px 8px}
.nl-debug__flag input{accent-color:#ffd96e;width:15px;height:15px}
.nl-debug__hint{margin-top:10px;color:#7d7490;font-size:11px;line-height:1.5}
`;

export function initDebug({ stages, getModel, jumpTo, clearWave, refreshHud }) {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);

  let root = null;
  let timer = 0;

  const model = () => {
    try {
      return getModel() || null;
    } catch {
      return null;
    }
  };

  const chapterLabel = (i) => `${i + 1}. ${stages[i]?.name ?? '?'}`;

  function statusText() {
    const m = model();
    if (!m) return '游戏还没开始（模型未就绪）';
    const alive = m.actors.filter((a) => !a.dead).length;
    const name = stages[m.zone]?.name ?? '?';
    return [
      `阶段 ${m.phase}  ·  第 ${m.zone + 1} 章 ${name}  ·  第 ${m.wave + 1} 波`,
      `HP ${Math.ceil(m.hero.hp)} / ${m.hero.maxHp}  ·  场上敌人 ${alive}  ·  击杀 ${m.kills}`,
      `无敌 ${m.debug?.invincible ? `开（已挡 ${m.debug.blocked || 0} 次）` : '关'}  ·  一击必杀 ${m.debug?.oneHit ? '开' : '关'}`,
    ].join('\n');
  }

  function refresh() {
    if (!root) return;
    root.querySelector('.nl-debug__status').textContent = statusText();
    for (const cb of root.querySelectorAll('[data-check]')) {
      if (cb instanceof HTMLInputElement) cb.checked = !!model()?.debug?.[cb.dataset.check];
    }
  }

  function setFlag(name, value) {
    const m = model();
    if (!m) return;
    m.debug ||= {};
    m.debug[name] = value;
    refresh();
  }

  function cheat(kind) {
    const m = model();
    if (!m) return;
    if (kind === 'heal') m.hero.hp = m.hero.maxHp;
    if (kind === 'energy') m.energy = 100;
    if (kind === 'peach') m.peaches = Math.max(m.peaches, 9);
    if (kind === 'dash') {
      m.dashUnlocked = true;
      m.dashCharges = m.maxDashCharges;
      m.dashCooldown = 0;
    }
    if (kind === 'super') m.superCharge = 100;
    refreshHud?.();
    refresh();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'nl-debug';
    root.innerHTML = `
      <div class="nl-debug__panel" role="dialog" aria-label="调试面板">
        <div class="nl-debug__head">
          <span class="nl-debug__title">调试面板</span>
          <button class="nl-debug__x" type="button" aria-label="关闭">×</button>
        </div>
        <div class="nl-debug__body">
          <div class="nl-debug__status"></div>
          <div class="nl-debug__row" data-group="chapters"></div>
          <div class="nl-debug__row">
            <button class="nl-debug__btn" type="button" data-cheat="heal">满血</button>
            <button class="nl-debug__btn" type="button" data-cheat="energy">能量满</button>
            <button class="nl-debug__btn" type="button" data-cheat="super">蓄力满</button>
          </div>
          <div class="nl-debug__row">
            <button class="nl-debug__btn" type="button" data-cheat="peach">黄桃 +9</button>
            <button class="nl-debug__btn" type="button" data-cheat="dash">解锁冲撞</button>
            <button class="nl-debug__btn" type="button" data-clear="1">清空本波</button>
          </div>
          <div class="nl-debug__flags">
            <label class="nl-debug__flag"><input type="checkbox" data-check="invincible"><span>无敌（英雄不掉血）</span></label>
            <label class="nl-debug__flag"><input type="checkbox" data-check="oneHit"><span>一击必杀（敌人一下打死）</span></label>
          </div>
          <p class="nl-debug__hint">跳章会重置当前章节进度并回满血；点完按钮可以直接开打。<br>Esc 或点 × 关闭。刷新页面后所有开关恢复默认。</p>
        </div>
      </div>`;

    const row = root.querySelector('[data-group="chapters"]');
    const label = document.createElement('span');
    label.className = 'nl-debug__label';
    label.textContent = '跳关';
    row.appendChild(label);
    stages.forEach((stage, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nl-debug__btn';
      b.dataset.chapter = String(i);
      b.textContent = String(i + 1);
      b.title = stage.name;
      row.appendChild(b);
    });

    root.addEventListener('click', (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;
      if (t === root) return close();
      if (t.closest('.nl-debug__x')) return close();
      const chapter = t.closest('[data-chapter]');
      if (chapter) return jumpTo(Number(chapter.dataset.chapter));
      const cheatBtn = t.closest('[data-cheat]');
      if (cheatBtn) return cheat(cheatBtn.dataset.cheat);
      if (t.closest('[data-clear]')) return clearWave?.();
    });

    root.addEventListener('change', (ev) => {
      const cb = ev.target;
      if (cb instanceof HTMLInputElement && cb.dataset.check) setFlag(cb.dataset.check, cb.checked);
    });

    // 状态栏里的开关按钮同步（点 checkbox 之外的空白也可以）
    document.body.appendChild(root);
    refresh();
    timer = window.setInterval(refresh, 400);
  }

  function open() {
    if (!root) build();
    root.style.display = '';
    refresh();
  }

  function close() {
    if (!root) return;
    root.remove();
    root = null;
    clearInterval(timer);
    timer = 0;
  }

  const isOpen = () => !!root;

  // ---- 打开方式 1：键盘密码 nailong ----
  const PASSWORD = 'nailong';
  let typed = '';
  let typedAt = 0;
  window.addEventListener(
    'keydown',
    (e) => {
      if (isOpen() && e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el instanceof Element && el.closest('input,select,textarea')) return;
      if (e.key.length !== 1) return;
      const now = Date.now();
      typed = now - typedAt > 2500 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
      typedAt = now;
      if (typed.length > PASSWORD.length) typed = typed.slice(-PASSWORD.length);
      if (typed === PASSWORD) {
        typed = '';
        isOpen() ? close() : open();
      }
    },
    true,
  );

  // ---- 打开方式 2：Ctrl+Shift+D ----
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        isOpen() ? close() : open();
      }
    },
    true,
  );

  // ---- 打开方式 3：?debug=1 ----
  try {
    if (new URLSearchParams(location.search).has('debug')) open();
  } catch {}

  // ---- 打开方式 4：控制台 ----
  window.__nailongDebug = {
    open,
    close,
    toggle: () => (isOpen() ? close() : open()),
    /** 直接拿到 GameWorld，方便在控制台里手改数值 */
    model: () => model(),
  };
}
