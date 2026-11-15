// Council wave 3, batch C: the retunes. S3-03 (par is about twice the solver's time, so the third star tests skill) and
// S3-02 (the boss level is the hardest climb for a casual player; level 12's spike has an extra ring).
// The bot plays with fixed seeds, so every number here is the same on every run. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Run } from '../src/js/sim/run.js';
import { Bot } from '../src/js/sim/bot.js';
import { makeRng } from '../src/js/rng.js';

const LEVELS = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/levels.json', import.meta.url)), 'utf8')).levels;
const byId = (id) => LEVELS.find((L) => L.id === id);

function clearRate(L, skill, runs) {
  let win = 0;
  for (let s = 1; s <= runs; s++) {
    const run = new Run(JSON.parse(JSON.stringify(L)), { seed: s });
    const bot = new Bot(run, makeRng(s * 7919 + 13), skill);
    while (run.phase === 'play' && run.steps < 120 * 240) run.step(bot.input());
    if (run.phase === 'won') win++;
  }
  return win / runs;
}

test('S3-03 every level\'s par is about twice the solver\'s time, never the flat 20 to 25 s it was', () => {
  for (const L of LEVELS) {
    assert.ok(L.par >= L.solve.t * 1.8, `${L.id}: par ${L.par} is beatable only with a perfect run`);
    assert.ok(L.par <= L.solve.t * 2 + 5, `${L.id}: par ${L.par} is no more than about twice the solver's ${L.solve.t}`);
    assert.ok(Number.isInteger(L.par), `${L.id}: a whole number of seconds, so the clock and par read alike`);
  }
  assert.ok(LEVELS.every((L) => L.par <= 20), 'the longest par is 20 s');
});

test('S3-03 a perfect plan still beats par with the third star on every level', () => {
  for (const L of LEVELS) assert.ok(L.solve.t < L.par, L.id);
});

test('S3-02 the boss level has a second flashlight beam and a faster boss lane', () => {
  const L = byId('l15');
  assert.equal(L.beams.length, 2, 'two beams (it was one)');
  const boss = L.rows.find((r) => (r.g || []).some((g) => g.k === 'boss'));
  assert.ok(boss.v >= 1.1, 'the boss lane runs at 1.1 (it was 0.9)');
});

test('S3-02 for the casual bot the boss level is the hardest climb of the campaign, and level 12 is not a cliff', () => {
  const n = 24; // seeds 1..24; the bot is seeded, so this is the same number every run
  const l12 = clearRate(byId('l12'), 'casual', n), l15 = clearRate(byId('l15'), 'casual', n), l14 = clearRate(byId('l14'), 'casual', n);
  assert.ok(l15 < l14 && l15 < l12, `level 15 clears less often than 14 and 12: ${l15} vs ${l14}, ${l12}`);
  assert.ok(l15 <= 0.7, 'a casual player fails the finale about a third of the time or more: ' + l15);
  assert.equal(byId('l12').rings, 5, 'level 12 gives five tail rings (it gave four)');
  assert.ok(l12 >= 0.75, 'and a casual player clears it about four times in five: ' + l12);
});

test('S3-02 a good player still beats the boss level most of the time', () => {
  assert.ok(clearRate(byId('l15'), 'good', 24) >= 0.8);
});
