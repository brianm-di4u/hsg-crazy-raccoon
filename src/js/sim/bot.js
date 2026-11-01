// A human-like player for balance runs (tools/balance.mjs) and the title-screen demo. It plans with a short
// look-ahead over a *misjudged* copy of the world (gator speeds and jaw timing perturbed), reacts after a delay,
// and now and then simply fumbles a move. Its clear rate stands in for "can people beat this level?".
import { DT } from './const.js';
import { stepWorld } from './world.js';
import { stepPlayer, hopTarget, rowType } from './player.js';
import { T, COLS, colX } from './const.js';

export const SKILL = {
  casual: { react: 0.36, jitter: 0.08, sv: 0.12, sj: 0.25, err: 0.035, look: 0.8 },
  good: { react: 0.26, jitter: 0.05, sv: 0.06, sj: 0.12, err: 0.015, look: 1.0 },
};
const ACTS = ['up', 'left', 'right', null, 'down'];

function cloneWorld(w, rng, sk) {
  return {
    t: w.t, assist: w.assist, nextId: w.nextId, feedT: new Set(w.feedT),
    surges: w.surges.map((s) => ({ ...s })), lures: w.lures.map((l) => ({ ...l })),
    gators: w.gators.map((g) => ({ ...g, v: g.v * (1 + rng.normal(0, sk.sv)), ph: g.ph + rng.normal(0, sk.sj), jc: g.jc })),
  };
}
const clonePlayer = (p) => ({ ...p, from: p.from && { ...p.from }, to: p.to && { ...p.to }, check: { ...p.check } });

export class Bot {
  constructor(run, rng, skill = 'casual') { this.run = run; this.rng = rng; this.sk = SKILL[skill] || skill; this.next = 0; this.pending = null; }

  // returns the input for this step
  input() {
    const run = this.run, p = run.p, t = run.t;
    if (this.pending && t >= this.pending.at) { const a = this.pending.a; this.pending = null; return { hop: a }; }
    if (this.pending || t < this.next || !(p.state === 'idle' || p.state === 'bump')) return {};
    const sk = this.sk;
    let a;
    if (this.rng.chance(sk.err)) a = this.rng.pick(ACTS);
    else a = this.plan();
    const delay = Math.max(0.05, sk.react * 0.4 + this.rng.normal(0, sk.jitter));
    this.next = t + sk.react + Math.abs(this.rng.normal(0, sk.jitter));
    if (a) this.pending = { a, at: t + delay };
    return {};
  }

  plan() {
    const run = this.run, sk = this.sk, steps = Math.round(sk.look / DT), mid = Math.round(0.4 / DT);
    const delay = Math.round((sk.react * 0.4) / DT);
    // steer toward the nearest column the row above lets us into (fences, blocks, sleeping gators)
    const p0 = run.p;
    let aimX = p0.x;
    if (rowType(run.L, p0.row + 1) !== 'water' && p0.row + 1 < run.N) {
      let bd = 1e9;
      for (let c = 0; c < COLS; c++) {
        const probe = { ...p0, x: colX(c), on: null };
        if (hopTarget(probe, run.world, run.L, 'up')) { const d = Math.abs(colX(c) - p0.x); if (d < bd) { bd = d; aimX = colX(c); } }
      }
    }
    let best = null, bestS = -1e9;
    for (const a of ACTS) {
      // two-move look-ahead: a, then (after 0.4 s) up or wait
      let s = -1e9;
      for (const b of ['up', null]) {
        const w = cloneWorld(run.world, this.rng, sk), p = clonePlayer(run.p), ev = [];
        let alive = true;
        for (let i = 0; i < steps; i++) {
          stepWorld(w, run.L, DT);
          const hop = i === delay ? a : i === delay + mid ? b : null;
          stepPlayer(p, w, run.L, { hop }, ev, DT);
          if (p.state === 'dead') { alive = false; break; }
          if (p.state === 'won') break;
        }
        const sc = (alive ? 1000 : 0) + (p.row - run.p.row) * 30 + (a === 'up' ? 4 : a === null ? 1 : a === 'down' ? -6 : 0) - Math.abs(p.x - aimX) * 0.08 - Math.abs(p.x - 288) * 0.004;
        if (sc > s) s = sc;
      }
      if (s > bestS) { bestS = s; best = a; }
    }
    return best;
  }
}
