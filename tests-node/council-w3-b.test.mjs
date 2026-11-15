// Council wave 3, batch B: the rule behind S1-10 (the lure preview shows exactly where the toss lands). Pure sim. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Run } from '../src/js/sim/run.js';
import { DT, colX, xCol } from '../src/js/sim/const.js';

const LEVELS = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/levels.json', import.meta.url)), 'utf8')).levels;
const l1 = () => { const r = new Run(JSON.parse(JSON.stringify(LEVELS[0])), { seed: 1 }); r.lures = 3; return r; };
const wait = (run, s) => { for (let i = 0, n = Math.round(s / DT); i < n; i++) run.step({}); };

test('S1-10 lureTarget is two rows ahead and straight on before any sideways hop', () => {
  const run = l1();
  assert.deepEqual(run.lureTarget(), { row: run.p.row + 2, c: xCol(run.p.x) });
});

test('S1-10 after a hop to the side the target moves three columns that way, and a toss lands exactly there', () => {
  for (const dir of ['left', 'right']) {
    const run = l1();
    run.step({ hop: dir }); wait(run, 0.6);
    const before = xCol(run.p.x), tg = run.lureTarget();
    assert.equal(tg.c, before + (dir === 'left' ? -3 : 3), dir + ': three columns toward the last hop');
    run.step({ lure: true });
    const ev = run.ev.find((e) => e.k === 'lure');
    assert.deepEqual({ row: ev.row, c: ev.c }, tg, dir + ': the lure lands where the preview said');
    assert.equal(run.world.lures[0].x, colX(tg.c));
  }
});

test('S1-10 the target stays on the board', () => {
  const run = l1();
  for (let i = 0; i < 4; i++) { run.step({ hop: 'left' }); wait(run, 0.5); }
  const tg = run.lureTarget();
  assert.ok(tg.c >= 0 && tg.row < run.N);
});
