// Level solver: breadth-first search over Bandit's states in time-expanded layers. The world does not depend on
// Bandit (lures aside), so one world advances per layer and every search node steps against the same snapshots.
// Decisions happen only every `decide` seconds (default 0.2 s, a human pace), so a solution is not a frame-perfect
// trick. Used by tools/check-levels.mjs, tests-node/ and act('solve').
import { DT, T, xCol } from './const.js';
import { makeWorld, stepWorld } from './world.js';
import { makePlayer, stepPlayer } from './player.js';

const ACTS = [null, 'up', 'left', 'right', 'down'];
const snapW = (w) => ({ t: w.t, gators: w.gators.map((g) => ({ id: g.id, row: g.row, rows: g.rows, k: g.k, len: g.len, dir: g.dir, x: g.x, vx: g.vx, jaw: g.jaw, ja: g.ja, lx: g.lx, wave: g.wave, fling: g.fling })) });
const clonePlayer = (p) => ({ ...p, from: p.from && { ...p.from }, to: p.to && { ...p.to }, check: { ...p.check } });

// opts: { assist, maxT, decide, xbin, cap, goalRow, target:{r,c}, start:{row,x}, avoid:Set('row:col') }
export function solve(level, opts = {}) {
  const decide = opts.decide ?? 0.2, K = Math.max(1, Math.round(decide / DT));
  const maxT = opts.maxT ?? 150, xbin = opts.xbin ?? 8, cap = opts.cap ?? 3000;
  const goalRow = opts.goalRow ?? level.rows.length - 1;
  const world = makeWorld(level, { assist: opts.assist });
  const p0 = makePlayer(level, level.startCol ?? 4);
  if (opts.start) { p0.row = opts.start.row; p0.x = opts.start.x; }
  // warm the world to the start time (endless sub-runs)
  let step = 0;
  let layer = [{ p: p0, path: null }];
  const reached = (p) => (opts.target ? p.row === opts.target.r && xCol(p.x) === opts.target.c && (p.state === 'idle' || p.state === 'won') : p.row >= goalRow && (p.state === 'won' || p.state === 'idle'));
  let best = 0, nodes = 0;
  while (step * DT < maxT && layer.length) {
    const snaps = [];
    for (let i = 0; i < K; i++) { stepWorld(world, level, DT); snaps.push(snapW(world)); }
    const next = new Map();
    for (const n of layer) {
      const canAct = n.p.state === 'idle' || n.p.state === 'bump';
      for (const a of canAct ? ACTS : [null]) {
        const p = clonePlayer(n.p), ev = [];
        let ok = true;
        for (let i = 0; i < K; i++) {
          stepPlayer(p, snaps[i], level, { hop: i === 0 ? a : null }, ev, DT);
          if (p.state === 'dead') { ok = false; break; }
          if (reached(p)) break;
        }
        nodes++;
        if (!ok) continue;
        const path = a ? { step, dir: a, prev: n.path } : n.path;
        if (reached(p)) return finish(true, (step + K) * DT, path, nodes, p.row);
        if (opts.avoid && opts.avoid.has(p.row + ':' + xCol(p.x))) continue;
        const key = `${p.row}|${Math.round(p.x / xbin)}|${p.state}|${p.on ?? ''}|${p.to ? p.to.row : ''}`;
        if (!next.has(key)) next.set(key, { p, path });
        if (p.row > best) best = p.row;
      }
    }
    step += K;
    layer = [...next.values()];
    if (layer.length > cap) { layer.sort((a, b) => b.p.row - a.p.row); layer.length = cap; }
  }
  return finish(false, step * DT, null, nodes, best);
}

function finish(ok, t, path, nodes, row) {
  const moves = [];
  for (let n = path; n; n = n.prev) moves.push({ step: n.step, dir: n.dir });
  moves.reverse();
  return { ok, t: +t.toFixed(2), moves, nodes, row };
}

// Replay a move list through a full Run (the same code the game uses) and report the outcome.
export function replay(run, moves, maxSteps = 120 * 200) {
  let i = 0;
  while (run.phase === 'play' && run.steps < maxSteps) {
    const m = moves[i];
    const hop = m && m.step === run.steps ? (i++, m.dir) : null;
    run.step({ hop });
  }
  return run;
}
export { T };
