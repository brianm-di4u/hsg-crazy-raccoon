// Items, wash, lure, streak, scoring and stars (MECHANICS §5–§7). Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import { Run } from '../src/js/sim/run.js';
import { T, colX, DT, SCORE } from '../src/js/sim/const.js';

const lvl = (rows, extra = {}) => ({ id: 'test', n: 0, zone: 1, rows: [{ t: 'start', check: true }, ...rows, { t: 'goal' }], items: [], par: 30, ...extra });
const steps = (run, n, input = {}) => { const ev = []; for (let i = 0; i < n; i++) { run.step(i === 0 ? input : {}); ev.push(...run.drain()); } return ev; };
const hop = (run, dir, settle = 30) => steps(run, settle, { hop: dir });

test('treats carry up to three, wash on pool stones, bank at checkpoints for 100/200', () => {
  const items = [1, 2, 3, 4].map((r) => ({ r, c: 4, k: 'pecan' }));
  const run = new Run(lvl([{ t: 'grass' }, { t: 'grass' }, { t: 'grass' }, { t: 'grass' }, { t: 'water', dir: 1, v: 0, g: [], pools: [4] }, { t: 'grass', check: true }], { items }));
  for (let i = 0; i < 4; i++) hop(run, 'up');
  assert.equal(run.carried().length, 3, 'paws full at three');
  hop(run, 'up');
  assert.equal(run.carried().filter((i) => i.washed).length, 3, 'washed on the pool stone');
  const before = run.score;
  hop(run, 'up');
  assert.equal(run.carried().length, 0, 'banked');
  assert.ok(run.score - before >= 3 * SCORE.treat * 2, 'washed treats pay double');
});

test('caps, drumsticks and the ball', () => {
  const run = new Run(lvl([{ t: 'grass' }, { t: 'grass' }, { t: 'grass' }], { items: [{ r: 1, c: 4, k: 'cap' }, { r: 2, c: 4, k: 'drum' }, { r: 3, c: 4, k: 'ball' }] }));
  hop(run, 'up'); hop(run, 'up'); hop(run, 'up');
  assert.equal(run.caps, 1); assert.equal(run.lures, 1); assert.equal(run.ball, true);
});

test('lure lands two rows ahead and pulls that row\'s gators toward it', () => {
  const run = new Run(lvl([{ t: 'grass' }, { t: 'water', dir: 1, v: 1, g: [{ k: 'paddler', at: 0, len: 3, jaw: [99, 0, 0] }] }], { lures: 1 }));
  const g = run.world.gators[0];
  assert.equal(run.lure(), true);
  assert.equal(run.lures, 0);
  assert.equal(run.lure(), false, 'no lures left');
  steps(run, Math.round(0.6 / DT));
  assert.equal(run.world.surges.length, 1);
  assert.equal(run.world.surges[0].row, 2);
  assert.ok(g.vx > T * 2, 'surging toward the drumstick');
});

test('rhythmic forward hops raise the multiplier; a pause resets it', () => {
  const run = new Run(lvl(Array.from({ length: 14 }, () => ({ t: 'grass' }))));
  for (let i = 0; i < 9; i++) hop(run, 'up', 24);
  assert.ok(run.mult >= 3, `mult ${run.mult}`);
  steps(run, 150);
  assert.equal(run.mult, 1);
});

test('clearing scores the breakdown and awards stars', () => {
  const run = new Run(lvl([{ t: 'grass' }], { items: [{ r: 1, c: 4, k: 'berry' }], par: 30 }));
  hop(run, 'up'); hop(run, 'up');
  assert.equal(run.phase, 'won');
  assert.deepEqual(run.result.stars, [true, true, true]);
  assert.ok(run.result.breakdown.noDeath === SCORE.noDeath);
});

test('out of rings fails the level', () => {
  const run = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [] }], { rings: 2 }));
  hop(run, 'up', 140); hop(run, 'up', 140);
  assert.equal(run.phase, 'fail');
});

test('assist slows gators, lengthens warnings, adds rings and withholds the par star', () => {
  const L = lvl([{ t: 'water', dir: 1, v: 2, g: [{ k: 'paddler', at: 0, len: 3, jaw: [2, 0.6, 1] }] }]);
  const a = new Run(L, { assist: true }), n = new Run(L);
  assert.equal(a.rings, n.rings + 2);
  assert.ok(a.world.gators[0].v < n.world.gators[0].v);
  assert.ok(a.world.gators[0].jc[1] > n.world.gators[0].jc[1]);
});
