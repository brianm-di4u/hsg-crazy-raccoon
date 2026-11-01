// Bandit's rules: hops, landing, riding, contact with land gators, beams (MECHANICS §4). Pure functions over a
// player object and a world snapshot, so the solver can search many players against one world.
import { T, W, COLS, DT, HOP_T, BUMP_T, KNOCK_T, FLING_T, WHIP_WIND, EDGE, GROUND, colX, xCol, clamp } from './const.js';
import { along, onRow, isHead, isTail, deadly, beamAt, nose } from './world.js';

const DIRS = { up: [1, 0], down: [-1, 0], left: [0, -1], right: [0, 1] };

export function makePlayer(level, col = 4) {
  return { row: 0, x: colX(col), state: 'idle', t: 0, dur: HOP_T, from: null, to: null, facing: 'up', lastH: 0, on: null, queue: null, invT: 0, whipT: 0, whipId: -1, cause: null, knock: false, nudge: -1, check: { row: 0, x: colX(col) } };
}

export const rowType = (level, r) => (level.rows[r] ? level.rows[r].t : 'void');
export const isWater = (level, r) => rowType(level, r) === 'water';
export function poolCol(level, r, x) {
  const row = level.rows[r];
  if (!row || !row.pools) return -1;
  const c = xCol(x);
  return row.pools.includes(c) && Math.abs(x - colX(c)) <= T * 0.55 ? c : -1;
}
function blocked(level, r, c) {
  const row = level.rows[r];
  if (!row) return true;
  if (row.t === 'fence') return !(row.gaps || []).includes(c);
  return !!(row.blocks && row.blocks.includes(c));
}
const snapCol = (x) => colX(clamp(Math.round((x - T / 2) / T), 0, COLS - 1));

function gatorAt(world, r, x, pred) {
  for (const g of world.gators) {
    if (!onRow(g, r)) continue;
    const a = along(g, x);
    if (a != null && (!pred || pred(g, a))) return [g, a];
  }
  return null;
}

// can Bandit start a hop in `dir` right now? returns the target or null (a bump)
export function hopTarget(p, world, level, dir) {
  const [dr, dc] = DIRS[dir];
  const tr = p.row + dr;
  if (tr < 0 || tr >= level.rows.length) return null;
  const tType = rowType(level, tr);
  let tx = p.x + dc * T;
  if (tType === 'water') {
    if (tx < T * 0.25 || tx > W - T * 0.25) return null;
    const pc = poolCol(level, tr, tx);
    if (pc >= 0) tx = colX(pc);
    return { row: tr, x: tx };
  }
  // ground or fence: land on a column centre
  tx = dc ? colX(clamp(xCol(p.x) + dc, -1, COLS)) : snapCol(p.x);
  if (dc && p.on == null && (xCol(p.x) + dc < 0 || xCol(p.x) + dc >= COLS)) return null;
  if (tx < T / 2 - 1 || tx > W - T / 2 + 1) return null;
  if (blocked(level, tr, xCol(tx))) return null;
  if (gatorAt(world, tr, tx, (g) => g.k !== 'hatchling')) return null; // a land gator's body is in the way
  return { row: tr, x: tx };
}

function startHop(p, world, level, dir, ev) {
  const to = hopTarget(p, world, level, dir);
  p.facing = dir;
  if (dir === 'left') p.lastH = -1; else if (dir === 'right') p.lastH = 1; else p.lastH = 0;
  if (!to) { p.state = 'bump'; p.t = 0; ev.push({ k: 'bump' }); return false; }
  p.from = { row: p.row, x: p.x }; p.to = to; p.state = 'hop'; p.t = 0; p.dur = HOP_T; p.on = null; p.whipT = 0; p.knock = false;
  ev.push({ k: 'hop', dir });
  return true;
}

export function die(p, cause, ev) {
  if (p.state === 'dead' || p.state === 'won') return;
  p.state = 'dead'; p.t = 0; p.cause = cause; p.on = null; p.queue = null;
  ev.push({ k: 'die', cause, row: p.row, x: p.x });
}

function knockBack(p, level, ev) {
  // shoved back one row by a closed-mouthed gator; the landing resolves normally
  const tr = Math.max(0, p.row - 1);
  p.invT = Math.max(p.invT, 0.4);
  if (tr === p.row) { p.state = 'bump'; p.t = 0; ev.push({ k: 'bump' }); return; }
  const tx = isWater(level, tr) ? p.x : snapCol(p.x);
  p.from = { row: p.row, x: p.x }; p.to = { row: tr, x: tx }; p.state = 'hop'; p.t = 0; p.dur = KNOCK_T; p.knock = true; p.on = null;
  ev.push({ k: 'knock' });
}

function land(p, world, level, ev) {
  const { row: r, x } = p.to, fwd = p.to.row > p.from.row && !p.knock, fling = p.state === 'fling';
  p.row = r; p.x = x; p.state = 'idle'; p.t = 0;
  const type = rowType(level, r);
  if (type === 'goal') { p.state = 'won'; ev.push({ k: 'land', row: r, x, fwd, ground: true }); ev.push({ k: 'win' }); return; }
  const pc = poolCol(level, r, x);
  if (pc >= 0) {
    p.x = colX(pc);
    ev.push({ k: 'land', row: r, x: p.x, fwd, pool: true, ground: true, fling });
  } else if (type === 'water') {
    const hit = gatorAt(world, r, x, (g) => g.k !== 'hatchling');
    if (!hit) { die(p, 'splash', ev); return; }
    const [g, a] = hit;
    if (isHead(a) && deadly(g) && p.invT <= 0) { die(p, 'chomp', ev); return; }
    p.on = g.id;
    if (g.k === 'whipper' && isTail(g, a)) { p.whipT = WHIP_WIND; p.whipId = g.id; ev.push({ k: 'whipWind', id: g.id }); }
    ev.push({ k: 'land', row: r, x, fwd, ride: g.id, fling });
  } else {
    const hit = gatorAt(world, r, x, (g) => g.k !== 'hatchling');
    if (hit && p.invT <= 0) {
      const [g, a] = hit;
      ev.push({ k: 'land', row: r, x, fwd, ground: true, fling });
      if (isHead(a) && deadly(g)) die(p, 'chomp', ev); else knockBack(p, level, ev);
      return;
    }
    ev.push({ k: 'land', row: r, x, fwd, ground: true, fling });
  }
  if (p.queue && p.state === 'idle') { const q = p.queue; p.queue = null; startHop(p, world, level, q, ev); }
}

export function gatorById(world, id) { for (const g of world.gators) if (g.id === id) return g; return null; }

// one fixed step of Bandit. input: { hop: dir|null }
export function stepPlayer(p, world, level, input, ev, dt = DT) {
  if (p.invT > 0) p.invT -= dt;
  const hop = input && input.hop;
  switch (p.state) {
    case 'dead': case 'won': p.t += dt; return;
    case 'hop':
      p.t += dt;
      if (hop) p.queue = hop;
      if (p.t >= (p.dur || HOP_T)) land(p, world, level, ev);
      return;
    case 'fling':
      p.t += dt;
      if (p.t >= FLING_T) land(p, world, level, ev);
      return;
    case 'bump':
      p.t += dt;
      if (p.t >= BUMP_T) p.state = 'idle';
      else break;
    // falls through to idle handling once the bump wiggle ends
    default: break;
  }
  if (p.state === 'idle' && hop) { if (startHop(p, world, level, hop, ev)) return; }
  const grounded = p.state === 'idle' || p.state === 'bump';
  // riding
  if (p.on != null) {
    const g = gatorById(world, p.on);
    if (!g) { die(p, 'splash', ev); return; }
    p.x += g.vx * dt;
    // boss tail-slap waves push riders in the neighbouring lanes
    for (const b of world.gators) if (b.k === 'boss' && b.wave > 0 && (p.row === b.row - 1 || p.row === b.row + 2)) p.x += b.dir * T * 0.5 * (dt / 0.6);
    const a = along(g, p.x);
    if (a == null) {
      const pc = poolCol(level, p.row, p.x);
      if (pc < 0) { die(p, 'splash', ev); return; }
      p.on = null; p.x = colX(pc);
    } else if (isHead(a) && deadly(g) && p.invT <= 0) { die(p, 'chomp', ev); return; }
    if (p.x < EDGE || p.x > W - EDGE) { die(p, 'swept', ev); return; }
    if (p.whipT > 0 && grounded) {
      if (g.id !== p.whipId || !isTail(g, a)) p.whipT = 0;
      else if ((p.whipT -= dt) <= 0) {
        const tr = clamp(p.row + g.fling, 0, level.rows.length - 1);
        p.from = { row: p.row, x: p.x }; p.to = { row: tr, x: rowType(level, tr) === 'water' ? p.x : snapCol(p.x) };
        p.state = 'fling'; p.t = 0; p.dur = FLING_T; p.on = null; p.facing = g.fling > 0 ? 'up' : 'down';
        ev.push({ k: 'fling', id: g.id, rows: tr - p.row });
        return;
      }
    }
  } else if (grounded && rowType(level, p.row) !== 'water') {
    // land gators sliding into Bandit
    let touched = -1;
    for (const g of world.gators) {
      if (!onRow(g, p.row)) continue;
      const a = along(g, p.x);
      if (a == null) continue;
      if (g.k === 'hatchling') {
        touched = g.id;
        if (p.nudge !== g.id) {
          p.nudge = g.id;
          const c = xCol(p.x) + g.dir;
          if (c >= 0 && c < COLS && !blocked(level, p.row, c)) { p.x = colX(c); ev.push({ k: 'nudge', dir: g.dir }); }
        }
        continue;
      }
      if (p.invT > 0) continue;
      if (isHead(a) && deadly(g)) { die(p, 'chomp', ev); return; }
      knockBack(p, level, ev); return;
    }
    if (touched < 0) p.nudge = -1;
  } else if (grounded && rowType(level, p.row) === 'water' && poolCol(level, p.row, p.x) < 0) {
    die(p, 'splash', ev); return;
  }
  // flashlight beams
  if (level.beams && p.invT <= 0) {
    for (const b of level.beams) {
      if (p.row < b.r0 || p.row > b.r1) continue;
      const { cx, hw } = beamAt(b, world.t);
      if (Math.abs(p.x - cx) < hw) { die(p, 'spotted', ev); return; }
    }
  }
}

// render helpers: where Bandit is drawn (row as a float, x) and his hop height in tiles (0..1 of the arc)
export function playerPose(p) {
  if ((p.state === 'hop' || p.state === 'fling') && p.from) {
    const D = p.dur || (p.state === 'fling' ? FLING_T : HOP_T), u = Math.min(1, p.t / D);
    return { row: p.from.row + (p.to.row - p.from.row) * u, x: p.from.x + (p.to.x - p.from.x) * u, arc: Math.sin(Math.PI * u) * (p.state === 'fling' ? 2.2 : 1), u };
  }
  return { row: p.row, x: p.x, arc: 0, u: 0 };
}
export { nose };
