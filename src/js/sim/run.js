// A run: one campaign level or one Moonlight Run. Owns the world, Bandit, items, rings, score and the event queue
// the app drains for sound, FX and UI. No DOM (MECHANICS §4–§8).
import { DT, T, W, COLS, DEAD_T, INV_T, STREAK_WIN, STREAK_RESET, MAX_CARRY, MAX_LURES, LURE_FLIGHT, SCORE, TREATS, colX, xCol, clamp, wrapX } from './const.js';
import { makeWorld, stepWorld, buildGators, onRow } from './world.js';
import { makePlayer, stepPlayer, die, rowType } from './player.js';
import { makeRng, hashStr } from '../rng.js';
import { Endless } from './endless.js';

export class Run {
  constructor(level, opts = {}) {
    this.mode = opts.mode || 'campaign';
    this.assist = !!opts.assist;
    this.seed = (opts.seed ?? hashStr(level.id || 'run')) >>> 0;
    this.rng = makeRng(this.seed);
    if (this.mode === 'endless') {
      this.gen = new Endless(this.seed, this.assist);
      level = this.gen.level;
    }
    this.L = level;
    this.world = makeWorld(level, { assist: this.assist });
    this.p = makePlayer(level, level.startCol ?? 4);
    this.items = (level.items || []).map((it, i) => ({ id: i, r: it.r, c: it.c, k: it.k, st: 'free', washed: false }));
    this.rings = this.mode === 'endless' ? 3 : (level.rings || 5) + (this.assist ? 2 : 0);
    this.lures = level.lures || 0;
    this.score = 0; this.caps = 0; this.ball = false; this.ticket = false; this.deaths = 0; this.maxRow = 0;
    this.streak = 0; this.lastFwd = -9; this.mult = 1;
    this.phase = 'play'; // play | won | fail
    this.t = 0; this.steps = 0; this.ev = []; this.hops = 0;
    this.beam = this.mode === 'endless' ? -4 : null;
    this.result = null;
    if (this.gen) this.extend();
  }

  get N() { return this.L.rows.length; }
  carried() { return this.items.filter((i) => i.st === 'carried'); }
  treatsTotal() { return this.items.filter((i) => TREATS.has(i.k)).length; }
  treatsBanked() { return this.items.filter((i) => TREATS.has(i.k) && i.st === 'banked').length; }

  // endless: keep three chunks generated above Bandit and drop gators far below the beam
  extend() {
    const need = this.p.row + 22;
    while (this.N < need) {
      const from = this.N;
      const chunk = this.gen.next();
      for (const it of chunk.items) this.items.push({ id: this.items.length, r: it.r, c: it.c, k: it.k, st: 'free', washed: false });
      const fresh = buildGators(this.L.rows, { assist: this.assist }, this.world.gators.length ? this.world.gators[this.world.gators.length - 1].id + 1 : 0, from);
      // as if every gator had been swimming since t = 0, so the solver's world (built all at once) matches
      for (const g of fresh) { g.x = wrapX(g.x + g.dir * g.v * T * this.world.t); this.world.gators.push(g); }
    }
    const floor = Math.floor(this.beam) - 6;
    if (this.world.gators.length > 160) this.world.gators = this.world.gators.filter((g) => g.row >= floor || g.id === this.p.on);
  }

  lure() {
    if (this.phase !== 'play' || this.lures <= 0 || this.p.state === 'dead' || this.p.state === 'won') return false;
    const p = this.p;
    const row = clamp(p.row + 2, 0, this.N - 1);
    const c = clamp(xCol(p.x) + 3 * p.lastH, 0, COLS - 1);
    this.lures--;
    this.world.lures.push({ row, x: colX(c), land: this.world.t + LURE_FLIGHT, from: { row: p.row, x: p.x }, t0: this.world.t, done: false });
    this.ev.push({ k: 'lure', row, c });
    return true;
  }

  // one fixed step. input: { hop: 'up'|'down'|'left'|'right'|null, lure: bool }
  step(input = {}) {
    if (this.phase !== 'play') return;
    this.t += DT; this.steps++;
    if (input.lure) this.lure();
    stepWorld(this.world, this.L, DT);
    const p = this.p, before = this.ev.length;
    stepPlayer(p, this.world, this.L, input, this.ev, DT);
    for (let i = before; i < this.ev.length; i++) this.onEvent(this.ev[i]);
    // endless: the keeper's beam rises and never falls more than 9 rows behind
    if (this.beam != null && p.state !== 'won') {
      const d = this.gen.difficulty(p.row);
      this.beam = Math.max(this.beam + (0.3 + 0.012 * d) * DT, p.row - 9);
      if (p.state !== 'dead' && p.row <= this.beam && p.invT <= 0) { const n = this.ev.length; die(p, 'caught', this.ev); this.onEvent(this.ev[n]); }
      this.extend();
    }
    if (p.state === 'dead' && p.t >= DEAD_T) this.respawn();
    if (this.t - this.lastFwd > STREAK_RESET && this.streak) { this.streak = 0; this.mult = 1; }
  }

  onEvent(e) {
    const p = this.p;
    switch (e.k) {
      case 'hop': this.hops++; break;
      case 'land': {
        if (e.fwd || e.fling) {
          if (this.t - this.lastFwd <= STREAK_WIN + 0.2) this.streak++; else this.streak = 1;
          this.lastFwd = this.t;
          const m = Math.min(4, 1 + Math.floor(this.streak / 4));
          if (m > this.mult) this.ev.push({ k: 'streak', mult: m });
          this.mult = m;
        }
        if (p.row > this.maxRow) { this.score += SCORE.row * this.mult * (p.row - this.maxRow); this.maxRow = p.row; }
        if (e.ground || e.pool) this.pickup(p.row, xCol(p.x));
        if (e.pool) {
          const dirty = this.carried().filter((i) => !i.washed && TREATS.has(i.k));
          if (dirty.length) { for (const i of dirty) i.washed = true; this.ev.push({ k: 'wash', n: dirty.length }); }
        }
        const row = this.L.rows[p.row];
        if (row && (row.check || row.t === 'goal' || row.t === 'start')) {
          if (row.check || row.t === 'goal') p.check = { row: p.row, x: colX(xCol(p.x)) };
          this.bank();
        }
        break;
      }
      case 'die':
        this.rings--; this.deaths++; this.streak = 0; this.mult = 1;
        for (const i of this.items) if (i.st === 'carried') { i.st = 'free'; i.washed = false; }
        break;
      case 'win': this.finish(); break;
      default: break;
    }
  }

  pickup(r, c) {
    for (const it of this.items) {
      if (it.st !== 'free' || it.r !== r || it.c !== c) continue;
      if (TREATS.has(it.k)) {
        if (this.carried().length >= MAX_CARRY) { this.ev.push({ k: 'full' }); continue; }
        it.st = 'carried';
      } else if (it.k === 'cap') { it.st = 'banked'; this.caps++; this.score += SCORE.cap; }
      else if (it.k === 'drum') { if (this.lures >= MAX_LURES) { this.ev.push({ k: 'full' }); continue; } it.st = 'banked'; this.lures++; }
      else if (it.k === 'ball') { it.st = 'banked'; this.ball = true; this.score += SCORE.ball; }
      else if (it.k === 'ticket') { it.st = 'banked'; this.ticket = true; }
      this.ev.push({ k: 'pickup', item: it.k, r, c });
    }
  }

  bank() {
    let n = 0, pts = 0;
    for (const it of this.items) if (it.st === 'carried') { it.st = 'banked'; n++; pts += SCORE.treat * (it.washed ? 2 : 1); }
    if (n) { this.score += pts; this.ev.push({ k: 'bank', n, pts }); }
  }

  respawn() {
    const p = this.p;
    if (this.rings <= 0) { this.phase = 'fail'; this.result = { win: false, score: this.score, t: this.t }; this.ev.push({ k: 'fail' }); return; }
    let row = p.check.row;
    if (this.beam != null) {
      // endless: respawn on the first checkpoint above the beam and push the beam back
      this.beam -= 3;
      for (let r = Math.max(row, Math.ceil(this.beam) + 1); r < this.N; r++) if (this.L.rows[r].check) { row = r; break; }
    }
    p.row = row; p.x = p.check.row === row ? p.check.x : colX(4); p.state = 'idle'; p.t = 0; p.on = null; p.queue = null; p.invT = INV_T; p.whipT = 0; p.cause = null;
    this.ev.push({ k: 'respawn', row });
  }

  finish() {
    this.bank();
    const L = this.L, par = L.par || 60;
    const time = Math.max(0, par - this.t) * SCORE.perSec;
    const clear = SCORE.clear, nod = this.deaths === 0 ? SCORE.noDeath : 0;
    this.score += Math.round(clear + time + nod);
    const all = this.treatsBanked() === this.treatsTotal();
    const stars = [true, all, !this.assist && this.t <= par];
    this.phase = 'won';
    this.result = { win: true, score: this.score, t: this.t, par, stars, breakdown: { clear, time: Math.round(time), noDeath: nod, caps: this.caps }, ball: this.ball, ticket: this.ticket, deaths: this.deaths };
  }

  drain() { const e = this.ev; this.ev = []; return e; }

  summary(near = 8) {
    const p = this.p;
    return {
      t: +this.t.toFixed(3), steps: this.steps, phase: this.phase, mode: this.mode, score: this.score, rings: this.rings, streak: this.streak, mult: this.mult,
      carried: this.carried().length, washed: this.carried().filter((i) => i.washed).length, banked: this.treatsBanked(), treats: this.treatsTotal(),
      lures: this.lures, caps: this.caps, ball: this.ball, ticket: this.ticket, deaths: this.deaths, maxRow: this.maxRow, hops: this.hops,
      beam: this.beam != null ? +this.beam.toFixed(2) : null, result: this.result, rows: this.N,
      player: { row: p.row, x: +p.x.toFixed(2), col: xCol(p.x), state: p.state, on: p.on, facing: p.facing, invT: +Math.max(0, p.invT).toFixed(2), cause: p.cause, check: p.check.row, rowType: rowType(this.L, p.row) },
      gators: this.world.gators.filter((g) => Math.abs(g.row - p.row) <= near).map((g) => ({ id: g.id, row: g.row, k: g.k, x: +g.x.toFixed(1), dir: g.dir, len: g.len, jaw: g.jaw })),
      items: this.items.filter((i) => Math.abs(i.r - p.row) <= near).map((i) => ({ r: i.r, c: i.c, k: i.k, st: i.st, washed: i.washed })),
    };
  }
}

// FNV-1a over the rounded run state: identical seed and inputs give the same hash in Node and Chromium.
export function hashRun(run) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { const s = String(Math.round(v * 1000)); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } };
  const p = run.p;
  mix(p.x); mix(p.row); mix(run.score); mix(run.rings); mix(run.t);
  for (const g of run.world.gators) { mix(g.x); mix(g.row); }
  return h >>> 0;
}
export { T, W, onRow };
