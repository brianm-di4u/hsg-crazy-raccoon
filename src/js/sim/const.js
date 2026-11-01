// Shared rule constants (MECHANICS.md). Units: T world units per tile, seconds of sim time.
export const DT = 1 / 120;
export const COLS = 9;
export const T = 64;
export const W = COLS * T; // 576
export const SPAN_L = -3 * T; // gators wrap in [SPAN_L, SPAN_L + SPAN)
export const SPAN = W + 6 * T; // 960

export const HOP_T = 0.15;
export const HOP_H = 0.45; // peak height in tiles (renderer)
export const BUMP_T = 0.12;
export const KNOCK_T = 0.22;
export const DEAD_T = 0.9;
export const INV_T = 1.2;
export const STREAK_WIN = 0.5;
export const STREAK_RESET = 1.0;
export const MAX_CARRY = 3;
export const MAX_LURES = 3;
export const SURGE_T = 2.0;
export const SURGE_MUL = 2.5;
export const FEED_WARN = 1.0;
export const LURE_FLIGHT = 0.45;
export const WHIP_WIND = 0.35;
export const FLING_T = 0.55;
export const CLOSE_T = 0.25; // jaw closing time (safe)
export const HEAD = 0.75 * T;
export const TAIL = 0.9 * T;
export const EDGE = 0.2 * T; // riding past this margin = swept

export const GROUND = new Set(['start', 'grass', 'path', 'boardwalk', 'straw', 'sand', 'goal']);
export const KINDS = ['paddler', 'whipper', 'hatchling', 'basker', 'sleeper', 'boss'];
export const TREATS = new Set(['pecan', 'berry']);

export const SCORE = { row: 10, treat: 100, cap: 25, ball: 500, clear: 1000, perSec: 20, noDeath: 500 };

export const colX = (c) => c * T + T / 2;
export const xCol = (x) => Math.max(0, Math.min(COLS - 1, Math.floor(x / T)));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// signed shortest distance a - b on the wrapping lane span
export const wrapD = (d) => { d %= SPAN; if (d < -SPAN / 2) d += SPAN; else if (d >= SPAN / 2) d -= SPAN; return d; };
export const wrapX = (x) => { let u = (x - SPAN_L) % SPAN; if (u < 0) u += SPAN; return u + SPAN_L; };
