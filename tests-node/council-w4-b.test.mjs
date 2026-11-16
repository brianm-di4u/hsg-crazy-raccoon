// Council wave 4, batch B: the rules behind P-N03 (a landing that ends in a bite is not a successful hop). Pure sim, no
// browser, no dice: the gator and its jaws are placed by the test. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import { Run } from '../src/js/sim/run.js';
import { colX, SCORE } from '../src/js/sim/const.js';

const lvl = (rows) => ({ id: 'test', n: 0, zone: 1, rows: [{ t: 'start', check: true }, ...rows, { t: 'goal' }], items: [], par: 30 });
const OPEN = { jaw: [0.01, 0.2, 50], ph: 0.3 }; // open for good from the first step

// A basker slides along row 1 and its nose reaches the middle of column `c` while Bandit is in the air: the tile is free when
// the hop starts (a basker's body blocks the hop) and holds the head when he lands. Returns the run and every event.
function bittenLanding(c, extra = {}) {
  const row = { t: 'sand', dir: 1, v: 2, g: [{ k: 'basker', at: 0, len: 3, ...OPEN }], ...extra };
  const run = new Run(lvl([row, { t: 'grass' }]), { seed: 1 });
  run.world.gators[0].x = colX(c) - 10;
  run.p.x = colX(c);
  const ev = [], rings0 = run.rings;
  run.step({ hop: 'up' }); ev.push(...run.drain());
  for (let i = 0; i < 60 && run.p.state !== 'dead'; i++) { run.step({}); ev.push(...run.drain()); }
  return { run, ev, rings0, kinds: ev.map((e) => e.k + (e.cause ? ':' + e.cause : '')) };
}

test('P-N03 a hop that ends in a bite on land pays nothing: no row points, no row gained, no streak, no cue for one', () => {
  for (const c of [2, 3, 4, 5, 6]) {
    const { run, kinds, rings0 } = bittenLanding(c);
    assert.deepEqual(kinds, ['hop', 'land', 'die:chomp'], `column ${c}: the hop lands and is bitten`);
    assert.equal(run.score, 0, `column ${c}: no points for the bitten hop`);
    assert.equal(run.maxRow, 0, `column ${c}: the row is not counted as reached`);
    assert.equal(run.streak, 0, `column ${c}: no streak`);
    assert.equal(run.bestMult, 1, `column ${c}: no multiplier was earned`);
    assert.equal(run.rings, rings0 - 1, `column ${c}: the bite still costs the ring`);
  }
});

test('P-N03 a bitten landing on a checkpoint row sets no checkpoint, and the retry still has to earn the row', () => {
  const { run, kinds } = bittenLanding(4, { check: true });
  assert.ok(kinds.includes('die:chomp'));
  assert.equal(run.p.check.row, 0, 'the checkpoint stays on the start row');
  assert.equal(run.maxRow, 0, 'and row 1 still counts as ahead of Bandit');
});

test('P-N03 a bitten landing does not bank what Bandit was carrying', () => {
  const row = { t: 'sand', check: true, dir: 1, v: 2, g: [{ k: 'basker', at: 0, len: 3, ...OPEN }] };
  const run = new Run(lvl([row, { t: 'grass' }]), { seed: 1 });
  run.items.push({ id: 0, r: -9, c: 0, k: 'pecan', st: 'carried', washed: false });
  run.world.gators[0].x = colX(4) - 10; run.p.x = colX(4);
  run.step({ hop: 'up' });
  for (let i = 0; i < 60 && run.p.state !== 'dead'; i++) run.step({});
  assert.equal(run.p.state, 'dead');
  assert.equal(run.treatsBanked(), 0, 'nothing was banked by the landing');
});

test('P-N03 an ordinary forward hop and a ride on a paddler are still paid', () => {
  const grass = new Run(lvl([{ t: 'grass' }]), { seed: 1 });
  grass.step({ hop: 'up' });
  for (let i = 0; i < 30; i++) grass.step({});
  assert.equal(grass.p.row, 1);
  assert.equal(grass.maxRow, 1, 'the row is reached');
  assert.equal(grass.score, SCORE.row, 'and paid once');
  const water = new Run(lvl([{ t: 'water', dir: 1, v: 0, g: [{ k: 'paddler', at: 5, len: 4, jaw: [99, 0, 0] }] }]), { seed: 1 });
  water.p.x = colX(4);
  water.step({ hop: 'up' });
  for (let i = 0; i < 30; i++) water.step({});
  assert.equal(water.p.row, 1, 'a ride on a paddler is a landing');
  assert.equal(water.maxRow, 1);
  assert.ok(water.score >= SCORE.row, 'and it is paid');
});
