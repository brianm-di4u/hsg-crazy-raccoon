// Mechanics unit tests (MECHANICS §3–§6) on tiny crafted levels. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import { Run } from '../src/js/sim/run.js';
import { T, colX, DT, HOP_T } from '../src/js/sim/const.js';
import { along } from '../src/js/sim/world.js';

const lvl = (rows, extra = {}) => ({ id: 'test', n: 0, zone: 1, rows: [{ t: 'start', check: true }, ...rows, { t: 'goal' }], items: [], par: 30, ...extra });
const steps = (run, n, input = {}) => { const ev = []; for (let i = 0; i < n; i++) { run.step(i === 0 ? input : {}); ev.push(...run.drain()); } return ev; };
const hop = (run, dir, settle = 30) => steps(run, settle, { hop: dir });
const kinds = (ev) => ev.map((e) => e.k + (e.cause ? ':' + e.cause : ''));

test('a hop moves one tile in 0.15 s and buffers at most one move', () => {
  const run = new Run(lvl([{ t: 'grass' }, { t: 'grass' }, { t: 'grass' }]));
  run.step({ hop: 'up' });
  assert.equal(run.p.state, 'hop');
  run.step({ hop: 'up' }); run.step({ hop: 'up' }); // second press buffers, third replaces the buffer (still one)
  steps(run, Math.ceil(HOP_T / DT));
  assert.equal(run.p.row, 1, 'first hop landed');
  assert.equal(run.p.state, 'hop', 'buffered hop started on landing');
  steps(run, Math.ceil(HOP_T / DT));
  assert.equal(run.p.row, 2, 'buffered hop ran after the first');
  steps(run, 40);
  assert.equal(run.p.row, 2, 'no third hop');
  hop(run, 'right');
  assert.equal(run.p.x, colX(5));
});

test('blocked moves bump without moving (edge, fence, block)', () => {
  const run = new Run(lvl([{ t: 'fence', gaps: [0] }, { t: 'grass' }]));
  const ev = hop(run, 'up');
  assert.ok(kinds(ev).includes('bump')); assert.equal(run.p.row, 0);
  run.p.x = colX(8); hop(run, 'right');
  assert.equal(run.p.x, colX(8), 'board edge');
});

test('water without support splashes; a paddler carries Bandit', () => {
  const r1 = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [] }]));
  assert.ok(kinds(hop(r1, 'up')).includes('die:splash'));
  assert.equal(r1.rings, 4);
  // gator under column 4, standing still then moving
  const r2 = new Run(lvl([{ t: 'water', dir: 1, v: 1, g: [{ k: 'paddler', at: 6.5, len: 3, jaw: [99, 0, 0] }] }]));
  hop(r2, 'up', 20);
  assert.equal(r2.p.on != null, true, 'riding');
  const x0 = r2.p.x; steps(r2, 60);
  assert.ok(Math.abs(r2.p.x - x0 - T * 0.5) < 2, 'carried 0.5 tile in 0.5 s at 1 tile/s');
});

test('open jaws chomp; the warning lasts at least 0.5 s with the head still safe', () => {
  const run = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [{ k: 'paddler', at: 2.5, len: 3, jaw: [1, 0.6, 1], ph: 0 }] }]));
  // nose at x = -192 + 2.5T + 3T = 160 → head covers ~112..160; stand on the head
  run.p.x = 150; run.p.row = 1; run.p.on = run.world.gators[0].id;
  let teleSteps = 0, chomped = false;
  for (let i = 0; i < 400 && !chomped; i++) { run.step({}); if (run.world.gators[0].jaw === 'tele') teleSteps++; chomped = run.drain().some((e) => e.cause === 'chomp'); }
  assert.ok(chomped, 'chomped once open');
  assert.ok(teleSteps * DT >= 0.5 - 1e-9, `warned ${teleSteps * DT}s`);
});

test('riding off the board edge is swept', () => {
  const run = new Run(lvl([{ t: 'water', dir: 1, v: 3, g: [{ k: 'paddler', at: 8, len: 3, jaw: [99, 0, 0] }] }]));
  run.p.row = 1; run.p.x = colX(7); run.p.on = 0;
  const ev = steps(run, 120);
  assert.ok(kinds(ev).includes('die:swept'));
});

test('respawn on the last checkpoint with invulnerability; unbanked treats return', () => {
  const L = lvl([{ t: 'grass' }, { t: 'grass', check: true }, { t: 'grass' }, { t: 'water', dir: 1, v: 0, g: [] }], { items: [{ r: 3, c: 4, k: 'pecan' }] });
  const run = new Run(L);
  hop(run, 'up'); hop(run, 'up'); hop(run, 'up');
  assert.equal(run.carried().length, 1);
  hop(run, 'up'); // splash
  steps(run, 130);
  assert.equal(run.p.row, 2, 'checkpoint row');
  assert.ok(run.p.invT > 0);
  assert.equal(run.items[0].st, 'free', 'treat back on its tile');
});

test('whipper flings two rows ahead from its tail', () => {
  const run = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [{ k: 'whipper', at: 4, len: 3, fling: 2, jaw: [99, 0, 0] }] }, { t: 'grass' }, { t: 'grass' }]));
  // body covers [-192+4T, -192+7T] = [64, 256]; tail is the rear (left) end, around x = 90
  run.p.row = 1; run.p.x = 90; run.p.on = 0; run.p.whipT = 0.35; run.p.whipId = 0;
  const ev = steps(run, 150);
  assert.ok(kinds(ev).includes('fling'));
  assert.equal(run.p.row, 3);
});

test('hatchlings never chomp and nudge sideways on land', () => {
  const run = new Run(lvl([{ t: 'grass', dir: 1, v: 2, g: [{ k: 'hatchling', at: 3, len: 1 }] }]));
  run.p.row = 1; run.p.x = colX(4);
  const ev = steps(run, 240);
  assert.ok(kinds(ev).includes('nudge'));
  assert.ok(!kinds(ev).some((k) => k.startsWith('die')));
});

test('basker: closed mouth bumps back a row, open mouth chomps', () => {
  const closed = new Run(lvl([{ t: 'sand', dir: 1, v: 1, g: [{ k: 'basker', at: 3, len: 3, jaw: [99, 0, 0] }] }]));
  closed.p.row = 1; closed.p.x = colX(4);
  const ev = steps(closed, 300);
  assert.ok(kinds(ev).includes('knock'));
  assert.equal(closed.p.row, 0);
  const open = new Run(lvl([{ t: 'sand', dir: 1, v: 1, g: [{ k: 'basker', at: 3, len: 3, jaw: [0.01, 0.6, 50], ph: 0.7 }] }]));
  open.p.row = 1; open.p.x = colX(4);
  assert.ok(kinds(steps(open, 300)).includes('die:chomp'));
});

test('sleeper stirs, then lunges a tile ahead and chomps', () => {
  const run = new Run(lvl([{ t: 'straw', dir: 1, v: 0, g: [{ k: 'sleeper', at: 6, len: 2, jaw: [1, 0.8, 1], ph: 0 }] }]));
  // body cols 3,4 (nose at x = 320); lunge reaches col 5
  run.p.row = 1; run.p.x = colX(5);
  const g = run.world.gators[0];
  let sawStir = false;
  const ev = [];
  for (let i = 0; i < 400; i++) { run.step({}); if (g.jaw === 'tele') sawStir = true; ev.push(...run.drain()); }
  assert.ok(sawStir);
  assert.ok(kinds(ev).includes('die:chomp'));
});

test('feeding show warns 1 s before the surge, then gators rush with open jaws', () => {
  const L = lvl([{ t: 'water', dir: 1, v: 1, g: [{ k: 'paddler', at: 0, len: 3, jaw: [99, 0, 0] }] }], { feeds: [{ t0: 2, per: 100, r: 1, c: 6 }] });
  const run = new Run(L);
  steps(run, Math.round(1.05 / DT));
  assert.equal(run.world.surges.length, 1);
  assert.ok(run.world.t >= run.world.surges[0].warn);
  steps(run, Math.round(1.0 / DT));
  assert.equal(run.world.gators[0].jaw, 'open');
  assert.ok(Math.abs(run.world.gators[0].vx) > T * 2, 'rushing');
});

test('flashlight beam spots Bandit inside it', () => {
  const run = new Run(lvl([{ t: 'path' }], { beams: [{ r0: 1, r1: 1, x0: colX(4), amp: 0, per: 5, w: 1 }] }));
  assert.ok(kinds(hop(run, 'up')).includes('die:spotted'));
});

test('boss spans two rows and can be ridden on both', () => {
  const run = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [{ k: 'boss', at: 3, len: 6, jaw: [99, 0, 0] }] }, { t: 'water', dir: 1, v: 0, g: [] }]));
  const g = run.world.gators[0];
  assert.equal(g.rows, 2);
  assert.ok(along(g, colX(4)) != null);
  hop(run, 'up'); assert.equal(run.p.on, g.id);
  hop(run, 'up'); assert.equal(run.p.on, g.id, 'second row of the boss');
});
