// Content proofs: every campaign level crossable (and its stored plan replays), endless seeds crossable, the
// determinism contract, and a random-input fuzz of every level. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Run, hashRun } from '../src/js/sim/run.js';
import { solve, replay } from '../src/js/sim/solve.js';
import { Endless } from '../src/js/sim/endless.js';
import { makeRng } from '../src/js/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/levels.json'), 'utf8')).levels;
const DIRS = { u: 'up', d: 'down', l: 'left', r: 'right' };

test('15 levels in 5 zones, each with a par and a stored plan', () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual([...new Set(LEVELS.map((L) => L.zone))], [1, 2, 3, 4, 5]);
  for (const L of LEVELS) { assert.ok(L.par > 0, L.id); assert.ok(L.plan && L.plan.length, L.id); }
});

for (const L of LEVELS) {
  test(`${L.id} stored plan replays to a clean win`, () => {
    const run = replay(new Run(JSON.parse(JSON.stringify(L)), { seed: 1 }), L.plan.map(([step, d]) => ({ step, dir: DIRS[d] })));
    assert.equal(run.phase, 'won'); assert.equal(run.deaths, 0);
  });
}

test('the solver finds every level fresh (assist on too)', () => {
  for (const L of LEVELS) {
    assert.ok(solve(L).ok, L.id);
    assert.ok(solve(L, { assist: true }).ok, L.id + ' assist');
  }
});

test('Moonlight Run: 25 seeds crossable through 8 chunks', () => {
  for (let s = 100; s < 125; s++) {
    const gen = new Endless(s);
    for (let i = 0; i < 8; i++) gen.next();
    gen.level.rows.push({ t: 'goal' });
    const r = solve(gen.level, { maxT: 160, cap: 1200 });
    assert.ok(r.ok, `seed ${s} best row ${r.row}`);
  }
});

test('endless runs generate rows ahead and the beam catches idlers', () => {
  const run = new Run({ id: 'endless' }, { mode: 'endless', seed: 9 });
  assert.ok(run.N >= 22);
  let caught = 0;
  for (let i = 0; i < 120 * 60 && run.phase === 'play'; i++) { run.step({}); for (const e of run.drain()) if (e.cause === 'caught') caught++; }
  assert.ok(caught >= 1);
  assert.equal(run.phase, 'fail', 'three rings lost to the beam');
});

test('determinism: same seed and inputs give the same hash; different inputs differ', () => {
  const play = (L, seed, alt) => {
    const run = new Run(JSON.parse(JSON.stringify(L)), { seed });
    const rng = makeRng(seed);
    for (let i = 0; i < 120 * 20 && run.phase === 'play'; i++) run.step(i % 23 === 0 ? { hop: rng.pick(['up', 'up', 'left', 'right', alt ? 'down' : 'up']) } : {});
    return hashRun(run);
  };
  for (const L of LEVELS.slice(0, 5)) {
    assert.equal(play(L, 3), play(L, 3));
    assert.notEqual(play(L, 3), play(L, 3, true));
  }
});

test('fuzz: random input on every level never produces NaN, a stuck state or an exception', () => {
  for (const L of LEVELS) {
    for (let s = 1; s <= 6; s++) {
      const run = new Run(JSON.parse(JSON.stringify(L)), { seed: s, assist: s % 2 === 0 });
      const rng = makeRng(s * 31 + L.n);
      let lastState = '', same = 0;
      for (let i = 0; i < 120 * 90 && run.phase === 'play'; i++) {
        run.step({ hop: rng.chance(0.08) ? rng.pick(['up', 'down', 'left', 'right']) : null, lure: rng.chance(0.004) });
        run.drain();
        const p = run.p;
        assert.ok(Number.isFinite(p.x) && Number.isFinite(run.score), `${L.id} finite`);
        assert.ok(p.row >= 0 && p.row < run.N, `${L.id} row in range`);
        for (const g of run.world.gators) assert.ok(Number.isFinite(g.x), `${L.id} gator x`);
        const st = p.state + p.t.toFixed(1);
        same = st === lastState && (p.state === 'dead' || p.state === 'hop' || p.state === 'fling') ? same + 1 : 0;
        lastState = st;
        assert.ok(same < 120 * 3, `${L.id} stuck in ${p.state}`);
      }
    }
  }
});
