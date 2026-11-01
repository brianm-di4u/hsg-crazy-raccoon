// Input: keyboard, gamepads (polled once per frame) and touch folded into latched hop and lure edges for the
// fixed step. Structure after games/Cart Racing/src/js/ui/input.js (Hot Springs Games, MIT). Hops are edges, not
// held keys: one hop per keydown, e.repeat ignored. Touch: swipe for a direction, a short tap hops up; acts on
// pointerup (shared/LESSONS.md).

const KEYS = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  lure: ['Space', 'KeyE'], pause: ['Escape', 'KeyP'],
};
const map = {};
for (const [a, codes] of Object.entries(KEYS)) for (const c of codes) map[c] = a;

export const I = { hop: null, lure: false, pause: false, last: 'keyboard', menu: { up: false, down: false, left: false, right: false, ok: false, cancel: false } };
let enabled = true;
export function setEnabled(on) { enabled = on; if (!on) { I.hop = null; I.lure = false; } }

export function initInput(onKey) {
  window.addEventListener('keydown', (e) => {
    I.last = 'keyboard';
    if (onKey && onKey(e) === true) { e.preventDefault(); return; }
    const a = map[e.code];
    if (!a || !enabled) return;
    e.preventDefault();
    if (e.repeat) return;
    if (a === 'lure') I.lure = true;
    else if (a === 'pause') I.pause = true;
    else I.hop = a;
  });
  window.addEventListener('blur', () => { I.hop = null; I.lure = false; });
}

// Gamepads (standard mapping): d-pad or left stick (edge) hop, A hops up, X / B / LB lure, Start pause.
const prev = {};
export function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = false;
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const now = { up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, a: b(0), b: b(1), x: b(2), lb: b(4), start: b(9) };
    const o = prev[p.index] || {};
    const edge = (k) => now[k] && !o[k];
    if (Object.values(now).some(Boolean)) { any = true; I.last = 'gamepad'; }
    const m = I.menu;
    for (const d of ['up', 'down', 'left', 'right']) if (edge(d)) { if (enabled) I.hop = d; m[d] = true; }
    if (edge('a')) { if (enabled) I.hop = 'up'; m.ok = true; }
    if (edge('x') || edge('lb')) I.lure = true;
    if (edge('b')) { I.lure = true; m.cancel = true; }
    if (edge('start')) I.pause = true;
    prev[p.index] = now;
  }
  return any;
}

// Touch on the play area: swipe ≥ 24 px picks the dominant axis; a short tap (< 12 px, < 300 ms) hops up.
export function initTouch(zone) {
  const st = { id: null, x: 0, y: 0, t: 0 };
  zone.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st.id = e.pointerId; st.x = e.clientX; st.y = e.clientY; st.t = e.timeStamp;
    if (e.pointerType !== 'mouse') e.preventDefault();
  });
  const end = (e) => {
    if (e.pointerId !== st.id) return;
    st.id = null;
    const dx = e.clientX - st.x, dy = e.clientY - st.y, d = Math.hypot(dx, dy);
    if (!enabled) return;
    if (e.pointerType !== 'mouse') I.last = 'touch';
    if (d >= 24) I.hop = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    else if (d < 12 && e.timeStamp - st.t < 300) I.hop = 'up';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', (e) => { if (e.pointerId === st.id) st.id = null; });
}

// a button that fires on pointerup (touch) or click (mouse / keyboard), never both
export function bindButton(el, fn) {
  let touched = false;
  el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { touched = true; e.preventDefault(); fn(); setTimeout(() => { touched = false; }, 400); } });
  el.addEventListener('click', (e) => { if (touched) { e.preventDefault(); return; } fn(); });
}

export function readIntent() { const out = { hop: I.hop, lure: I.lure }; I.hop = null; I.lure = false; return out; }
export function consumePause() { const p = I.pause; I.pause = false; return p; }
export function consumeMenu() { const m = { ...I.menu }; for (const k of Object.keys(I.menu)) I.menu[k] = false; return m; }
