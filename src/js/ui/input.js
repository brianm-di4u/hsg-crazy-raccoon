// Input: keyboard, gamepads (polled once per frame) and touch folded into latched hop and lure edges for the
// fixed step. Structure after games/Cart Racing/src/js/ui/input.js (Hot Springs Games, MIT). Hops are edges: one hop
// per keydown, e.repeat ignored (the optional Hold to hop setting repeats a held direction, see holdHop). Touch: tap beside Bandit to hop that way, or swipe; acts on
// pointerup, and a swipe acts as soon as it passes 24 px (shared/LESSONS.md).

import { hopTarget, rowType } from '../sim/player.js';

const KEYS = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  lure: ['Space', 'KeyE'], pause: ['Escape', 'KeyP'],
};
const map = {};
for (const [a, codes] of Object.entries(KEYS)) for (const c of codes) map[c] = a;

export const I = { hops: [], lure: false, pause: false, last: 'keyboard', menu: { up: false, down: false, left: false, right: false, ok: false, cancel: false } };
let enabled = true;
// Hops wait in a short line (S1-08): two presses inside one frame both count, one hop is handed to each step of the
// loop that asks. A third press replaces the second, so the newest intent is kept.
const pushHop = (d) => { if (I.hops.length < 2) I.hops.push(d); else I.hops[1] = d; };
// Hold to hop (S1-09, an option that is off until the player turns it on): the directions held right now, keyboard and pad,
// newest last. The step loop asks holdHop() each frame and repeats the newest one once Bandit has landed and it has been held
// for HOLD_DELAY. A tap, or a press that lands as the key goes up, never repeats.
export const HOLD_DELAY = 0.1;
const holds = [];
const holdOn = (key, dir, pad = -1) => { if (!holds.some((h) => h.key === key)) holds.push({ key, dir, pad, t: performance.now() }); };
const holdOff = (key) => { const i = holds.findIndex((h) => h.key === key); if (i >= 0) holds.splice(i, 1); };
export function setEnabled(on) { enabled = on; if (!on) { I.hops.length = 0; I.lure = false; holds.length = 0; } }
// The direction to repeat now, or null. Only on a safe repeat: Bandit is standing still on the ground, nothing is queued, the
// tile ahead is free and is not open water. A held key never walks Bandit into a wall, a bump or the river by itself.
export function holdHop(run, now = performance.now()) {
  const h = holds[holds.length - 1], p = run.p;
  if (!h || now - h.t < HOLD_DELAY * 1000 || run.phase !== 'play') return null;
  if (p.state !== 'idle' || p.on != null || p.queue || I.hops.length) return null;
  const to = hopTarget(p, run.world, run.L, h.dir);
  return to && rowType(run.L, to.row) !== 'water' ? h.dir : null;
}

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
    else { pushHop(a); holdOn('k:' + e.code, a); }
  });
  window.addEventListener('keyup', (e) => holdOff('k:' + e.code));
  window.addEventListener('blur', () => { I.hops.length = 0; I.lure = false; holds.length = 0; });
}

// Gamepads (standard mapping): d-pad or left stick (edge) hop, A hops up, X / B / LB lure, Start pause.
const prev = {};
export function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let any = false;
  for (let i = holds.length - 1; i >= 0; i--) if (holds[i].pad >= 0 && !pads[holds[i].pad]?.connected) holds.splice(i, 1); // a pad unplugged while held
  for (const p of pads) {
    if (!p || !p.connected) continue;
    const b = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    // the stick gives one direction, along the axis it is pushed furthest (S1-13): a diagonal push hops the way it leans most
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0, sx = Math.abs(ax) >= Math.abs(ay) ? ax : 0, sy = Math.abs(ay) > Math.abs(ax) ? ay : 0;
    const now = { up: b(12) || sy < -0.6, down: b(13) || sy > 0.6, left: b(14) || sx < -0.6, right: b(15) || sx > 0.6, a: b(0), b: b(1), x: b(2), lb: b(4), start: b(9) };
    const o = prev[p.index] || {};
    const edge = (k) => now[k] && !o[k];
    if (Object.values(now).some(Boolean)) { any = true; I.last = 'gamepad'; }
    const m = I.menu;
    for (const d of ['up', 'down', 'left', 'right']) {
      if (edge(d)) { if (enabled) { pushHop(d); holdOn('p:' + p.index + d, d, p.index); } m[d] = true; }
      else if (!now[d]) holdOff('p:' + p.index + d);
    }
    if (edge('a')) { if (enabled) pushHop('up'); m.ok = true; }
    if (edge('x') || edge('lb')) I.lure = true;
    if (edge('b')) { I.lure = true; m.cancel = true; }
    if (edge('start')) I.pause = true;
    prev[p.index] = now;
  }
  return any;
}

// Touch on the play area: a swipe of 24 px or more picks the dominant axis of the drag. A tap (any length) picks the
// dominant axis from Bandit's screen centre (aim() → [x, y] or null) to the tap; on or near Bandit it hops up. A tap
// below Bandit also hops up (the thumb rests low on a phone): only a swipe down hops back.
const SWIPE_PX = 24;
const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
export function initTouch(zone, aim) {
  const st = { id: null, x: 0, y: 0, fired: false };
  zone.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st.id = e.pointerId; st.x = e.clientX; st.y = e.clientY; st.fired = false;
    if (e.pointerType !== 'mouse') e.preventDefault();
    if (zone.setPointerCapture) { try { zone.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ } }
  });
  // a swipe acts the moment the finger has clearly committed (S1-05), not when it lifts; the lift then does nothing
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== st.id || st.fired || !enabled) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (Math.hypot(dx, dy) < SWIPE_PX) return;
    st.fired = true;
    if (e.pointerType !== 'mouse') I.last = 'touch';
    pushHop(dirOf(dx, dy));
  });
  const end = (e) => {
    if (e.pointerId !== st.id) return;
    const fired = st.fired;
    st.id = null; st.fired = false;
    if (fired || !enabled) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y, d = Math.hypot(dx, dy);
    if (e.pointerType !== 'mouse') I.last = 'touch';
    if (d >= SWIPE_PX) pushHop(dirOf(dx, dy));
    else {
      const a = aim && aim(), r = zone.getBoundingClientRect();
      const tx = e.clientX - r.left - (a ? a[0] : 0), ty = e.clientY - r.top - (a ? a[1] : 0);
      const dir = a && Math.hypot(tx, ty) > 28 ? dirOf(tx, ty) : 'up';
      pushHop(dir === 'down' ? 'up' : dir);
    }
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', (e) => { if (e.pointerId === st.id) { st.id = null; st.fired = false; } });
}

// a button that fires on pointerup (touch) or click (mouse / keyboard), never both
export function bindButton(el, fn) {
  let touched = false;
  el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { touched = true; e.preventDefault(); fn(); setTimeout(() => { touched = false; }, 400); } });
  el.addEventListener('click', (e) => { if (touched) { e.preventDefault(); return; } fn(); });
}

export function readIntent() { const out = { hop: I.hops.shift() || null, lure: I.lure }; I.lure = false; return out; }
export function consumePause() { const p = I.pause; I.pause = false; return p; }
export function consumeMenu() { const m = { ...I.menu }; for (const k of Object.keys(I.menu)) I.menu[k] = false; return m; }
