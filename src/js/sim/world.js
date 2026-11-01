// The world: gators, feeding-show surges, lure surges, flashlight beams. Depends only on sim time and the lure
// list, never on where Bandit is, so the level solver can advance one world for every search node (MECHANICS §6).
import { T, W, SPAN, SPAN_L, DT, CLOSE_T, SURGE_T, SURGE_MUL, FEED_WARN, HEAD, wrapD, wrapX, colX } from './const.js';

// A gator's jaw timing: [closed, tele, open] seconds (+ CLOSE_T closing). Defaults per kind.
const JAW = { paddler: [3.2, 0.7, 0.8], whipper: [3.6, 0.7, 0.7], hatchling: [99, 0, 0], basker: [3.0, 0.9, 1.6], sleeper: [3.4, 0.8, 0.9], boss: [2.6, 0.9, 1.1] };
const LEN = { paddler: 3, whipper: 3, hatchling: 1, basker: 3, sleeper: 3, boss: 6 };

// Expand a level's row data into gator objects. `conga` is shorthand for a close chain of paddlers.
export function buildGators(rows, opts = {}, startId = 0, fromRow = 0) {
  const out = [];
  let id = startId;
  rows.forEach((row, r) => {
    if (r < fromRow || !row.g) return;
    const dir = row.dir || 1, v = row.v ?? 1;
    row.g.forEach((d, i) => {
      const k = d.k === 'conga' ? 'paddler' : d.k;
      const n = d.k === 'conga' ? d.n || 3 : 1;
      const len = d.len ?? LEN[k] ?? 3;
      for (let j = 0; j < n; j++) {
        const jc = (d.jaw || row.jaw || JAW[k]).slice();
        if (opts.assist) jc[1] *= 1.5;
        const at = (d.at ?? i * 5) - j * (len + 0.1) * dir;
        out.push({
          id: id++, row: r, k, len, rows: k === 'boss' ? 2 : 1, dir, v: (d.v ?? v) * (opts.assist ? 0.75 : 1),
          x: wrapX(SPAN_L + at * T + (dir > 0 ? len * T : 0)), vx: 0, jc, ph: d.ph ?? ((r * 1.7 + i * 1.13 + j * 0.37) % (jc[0] + jc[1] + jc[2] + CLOSE_T)),
          jaw: 'shut', ja: 0, lx: 0, fling: d.fling ?? 2, wave: 0, eyes: !!row.night,
        });
      }
    });
  });
  return out;
}

export function makeWorld(level, opts = {}) {
  return { t: 0, gators: buildGators(level.rows, opts), surges: [], lures: [], feedT: new Set(), nextId: 0, assist: !!opts.assist };
}

// jaw state from the cycle: shut → tele → open → closing
function jawOf(g, t) {
  const [c, te, o] = g.jc, cyc = c + te + o + CLOSE_T;
  if (c >= 90) return ['shut', 0];
  const u = (((t + g.ph) % cyc) + cyc) % cyc;
  if (u < c) return ['shut', 0];
  if (u < c + te) return ['tele', 0.35 * (u - c) / te];
  if (u < c + te + o) return ['open', 1];
  return ['closing', 1 - (u - c - te - o) / CLOSE_T];
}

// surge target for row r at time t, or null
function surgeFor(world, r) {
  for (const s of world.surges) if (s.row === r && world.t >= s.t0 && world.t < s.t0 + SURGE_T) return s;
  return null;
}

export function stepWorld(world, level, dt = DT) {
  world.t += dt;
  const t = world.t;
  // feeding show: scheduled tosses (zone 3). Warn FEED_WARN before, then surge.
  if (level.feeds) for (let i = 0; i < level.feeds.length; i++) {
    const f = level.feeds[i], k = Math.floor((t + FEED_WARN - f.t0) / f.per);
    if (k < 0) continue;
    const key = i * 100000 + k;
    if (!world.feedT.has(key)) {
      world.feedT.add(key);
      const at = f.t0 + k * f.per;
      world.surges.push({ row: f.r, x: colX(f.c), t0: at, warn: at - FEED_WARN, src: 'feed' });
    }
  }
  // lures land after their flight and become surges
  for (const L of world.lures) if (!L.done && t >= L.land) { L.done = true; world.surges.push({ row: L.row, x: L.x, t0: L.land, warn: L.land, src: 'lure' }); }
  if (world.surges.length > 24) world.surges = world.surges.filter((s) => t < s.t0 + SURGE_T);
  if (world.lures.length > 8) world.lures = world.lures.filter((L) => !L.done);
  for (const g of world.gators) {
    let [jaw, ja] = jawOf(g, t);
    let mul = 1;
    const s = g.k !== 'boss' && g.k !== 'sleeper' ? surgeFor(world, g.row) : null;
    if (s) {
      // rush toward the food if it is ahead of the nose, idle near it, drift if it is behind
      const d = wrapD(s.x - g.x) * g.dir;
      mul = d > T * 0.3 ? SURGE_MUL : d > -T * 0.5 ? 0 : 0.3;
      if (g.k !== 'hatchling') { jaw = 'open'; ja = 1; }
    }
    g.vx = g.dir * g.v * T * mul;
    g.x = wrapX(g.x + g.vx * dt);
    // sleepers lunge one tile while their jaws are open, then settle back
    if (g.k === 'sleeper') {
      const target = jaw === 'open' ? T : jaw === 'closing' ? T * ja : 0;
      g.lx += Math.max(-T * 4 * dt, Math.min(T * 4 * dt, target - g.lx));
    }
    // the boss slaps its tail every ~5 s (0.6 s raise, then a wave)
    if (g.k === 'boss') { const u = (t + g.ph) % 5.2; g.wave = u > 4.6 ? (u - 4.6) / 0.6 : 0; }
    g.jaw = jaw; g.ja = ja;
  }
}

// --- geometry helpers used by the player rules, the solver and the renderer ---
export const nose = (g) => g.x + (g.k === 'sleeper' ? g.lx * g.dir : 0);
// position of x along the gator: 0 at the nose, growing toward the tail; null when x is off the body
export function along(g, x) {
  const d = -wrapD(x - nose(g)) * g.dir; // >0 behind the nose
  return d >= -T * 0.12 && d <= g.len * T + T * 0.05 ? d : null;
}
export const onRow = (g, r) => g.row === r || (g.rows === 2 && g.row + 1 === r);
export const isHead = (a) => a != null && a <= HEAD;
export const isTail = (g, a) => a != null && a >= g.len * T - 0.9 * T;
export const deadly = (g) => g.k !== 'hatchling' && g.jaw === 'open';

export function gatorsOn(world, r) { return world.gators.filter((g) => onRow(g, r)); }

// flashlight beam centre and half-width at time t (zone 5)
export function beamAt(b, t) { return { cx: b.x0 + b.amp * Math.sin((2 * Math.PI * t) / b.per + (b.ph || 0)), hw: (b.w || 0.9) * T }; }

// active feed warnings (falling drumstick shadows) for the renderer and HUD
export function warnings(world) { return world.surges.filter((s) => world.t >= s.warn && world.t < s.t0); }
export function liveSurges(world) { return world.surges.filter((s) => world.t >= s.t0 && world.t < s.t0 + SURGE_T); }
export { W, SPAN };
