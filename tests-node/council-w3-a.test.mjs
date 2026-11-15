// Council wave 3, batch A: the rules behind S1-08 (two hops can wait), S1-11 (a hop skips the dead time) and S3-11
// (the win panel's score lines add up). Pure sim, no browser. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Run } from '../src/js/sim/run.js';
import { replay } from '../src/js/sim/solve.js';
import { DT, DEAD_T, DEAD_SKIP_T, SCORE, xCol } from '../src/js/sim/const.js';

const LEVELS = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/levels.json', import.meta.url)), 'utf8')).levels;
const DIRS = { u: 'up', d: 'down', l: 'left', r: 'right' };
const l1 = () => new Run(JSON.parse(JSON.stringify(LEVELS[0])), { seed: 1 });
const stepFor = (run, seconds, hopAt = {}) => { for (let i = 0, n = Math.round(seconds / DT); i < n; i++) run.step({ hop: hopAt[i] || null }); };

test('S1-08 three presses inside one hop all happen: one in flight, two waiting', () => {
  const run = l1(); // row 0 is open ground: three hops left cross three columns
  const col0 = xCol(run.p.x);
  stepFor(run, 0.6, { 0: 'left', 4: 'left', 8: 'left' });
  assert.equal(run.hops, 3, 'three hops were made');
  assert.equal(xCol(run.p.x), col0 - 3, 'Bandit moved three columns');
});

test('S1-08 a fourth press replaces the second waiting one, so the newest intent is the one that counts', () => {
  const run = l1();
  const col0 = xCol(run.p.x);
  stepFor(run, 0.8, { 0: 'left', 4: 'left', 8: 'right', 12: 'left' }); // right was waiting; the later left took its place
  assert.equal(run.hops, 3, 'a hop in flight and two waiting is all that is kept');
  assert.equal(xCol(run.p.x), col0 - 3, 'the replaced press is gone');
});

test('S1-08 one press still makes one hop, and a retry pressed in a bump still fires after it', () => {
  const a = l1();
  stepFor(a, 0.5, { 0: 'left' });
  assert.equal(a.hops, 1);
  const b = l1();
  b.p.row = 1; // the lane above is water: a hop up from the path is fine, the fence-free edge column is not
  b.p.x = 32; // column 0
  stepFor(b, 0.5, { 0: 'left', 3: 'right' }); // a bump against the edge, then a hop right pressed during the bump wiggle
  assert.equal(xCol(b.p.x), 1, 'the press during the bump is kept and fires when it ends');
});

const dead = (rings = 4) => { const r = l1(); r.rings = rings; r.p.state = 'dead'; r.p.cause = 'splash'; r.p.t = 0; r.p.row = 0; return r; };

test('S1-11 a hop pressed before the beat is over is ignored; after it, the retry starts at once with that hop', () => {
  const early = dead();
  stepFor(early, DEAD_SKIP_T - 0.05, { 100: 'up' });
  assert.equal(early.p.state, 'dead', 'a press at 0.35 s does not cut the death short');
  assert.ok(DEAD_SKIP_T < DEAD_T);
  const run = dead();
  stepFor(run, DEAD_SKIP_T + 0.02);
  assert.equal(run.p.state, 'dead', 'with no press the death plays out');
  run.step({ hop: 'left' });
  assert.equal(run.p.state, 'idle', 'the press after 0.4 s respawns');
  assert.ok(run.drain().some((e) => e.k === 'respawn'), 'a respawn event is sent');
  run.step({});
  assert.equal(run.p.state, 'hop', 'and the pressed hop is the first of the retry');
  assert.equal(run.p.facing, 'left');
  assert.ok(run.p.invT > 1, 'the usual grace after a respawn still applies');
});

test('S1-11 without a press the respawn still comes at the old time, and the last ring never skips to the fail panel', () => {
  const run = dead();
  stepFor(run, DEAD_T - 0.02);
  assert.equal(run.p.state, 'dead');
  stepFor(run, 0.05);
  assert.equal(run.p.state, 'idle', 'the respawn at 0.9 s is unchanged');
  const last = dead(0);
  stepFor(last, DEAD_SKIP_T + 0.05, { [Math.round((DEAD_SKIP_T + 0.02) / DT)]: 'up' });
  assert.equal(last.phase, 'play', 'with no rings left a press does not jump to the out-of-rings panel');
  stepFor(last, DEAD_T);
  assert.equal(last.phase, 'fail', 'it arrives at the usual time');
});

const parts = (res) => { const b = res.breakdown; return b.rows + b.snacks + b.capPts + b.ballPts + b.clear + b.time + b.noDeath; };

for (const L of LEVELS) {
  test(`S3-11 ${L.id}: the lines on the win panel add up to the score`, () => {
    const run = replay(new Run(JSON.parse(JSON.stringify(L)), { seed: 1 }), L.plan.map(([step, d]) => ({ step, dir: DIRS[d] })));
    assert.equal(run.phase, 'won');
    assert.equal(parts(run.result), run.result.score, 'rows + snacks + caps + ball + den + time + no-death = score');
    assert.ok(run.result.breakdown.rows > 0 && run.result.breakdown.bestMult >= 1);
  });
}

test('S3-11 caps, the ball and washed snacks are counted in their own lines', () => {
  const run = l1();
  run.items.push({ id: 90, r: 0, c: 4, k: 'cap', st: 'free', washed: false }, { id: 91, r: 0, c: 4, k: 'ball', st: 'free', washed: false });
  run.pickup(0, 4);
  run.items.push({ id: 92, r: 0, c: 3, k: 'pecan', st: 'carried', washed: true }, { id: 93, r: 0, c: 3, k: 'berry', st: 'carried', washed: false });
  run.finish();
  const b = run.result.breakdown;
  assert.equal(b.capPts, SCORE.cap);
  assert.equal(b.caps, 1);
  assert.equal(b.ballPts, SCORE.ball);
  assert.equal(b.snacks, SCORE.treat * 3, 'a washed snack is worth double');
  assert.equal(b.snackN, 2);
  assert.equal(b.washedN, 1);
  assert.equal(parts(run.result), run.result.score);
});
