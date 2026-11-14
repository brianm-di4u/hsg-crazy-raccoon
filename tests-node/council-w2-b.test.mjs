// Council wave 2, batch B: S3-04 (Moonlight Run depth) and S3-10 (phone view setting) on the sim and save side.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Endless, SPEED_CAP, GAP_FLOOR } from '../src/js/sim/endless.js';
import { Run } from '../src/js/sim/run.js';
import { solve, replay } from '../src/js/sim/solve.js';

const gen = (seed, chunks) => { const g = new Endless(seed); for (let i = 0; i < chunks; i++) g.next(); return g.level; };
const waterSpeeds = (L, from, to) => L.rows.slice(from, to).filter((r) => r.t === 'water').map((r) => r.v);

test('S3-04 feeding lanes appear from chunk 6, keeper beams from chunk 10, never earlier', () => {
  for (let seed = 1; seed <= 30; seed++) {
    assert.equal(gen(seed, 6).feeds.length, 0, `seed ${seed}: no feeding show before chunk 6`);
    assert.equal(gen(seed, 10).beams.length, 0, `seed ${seed}: no beams before chunk 10`);
  }
  let feeds = 0, beams = 0;
  for (let seed = 1; seed <= 30; seed++) { const L = gen(seed, 30); feeds += L.feeds.length; beams += L.beams.length; }
  assert.ok(feeds >= 30 && beams >= 30, `plenty of both across 30 seeds (${feeds} feeds, ${beams} beams)`);
});

test('S3-04 feeds sit on a water lane that has gators, beams on a plain lawn row of their chunk', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const L = gen(seed, 40);
    for (const f of L.feeds) {
      const row = L.rows[f.r];
      assert.ok(row.t === 'water' && row.g && row.g.length, `seed ${seed}: feed row ${f.r} is a gator lane`);
      assert.ok(f.per >= 6 && f.per <= 8 && f.c >= 0 && f.c <= 8);
    }
    for (const b of L.beams) {
      assert.equal(b.r0, b.r1);
      const row = L.rows[b.r0];
      assert.equal(row.t, 'grass');
      assert.ok(!row.g && !row.check, `seed ${seed}: beam row ${b.r0} is a plain lawn row`);
      assert.ok(b.per >= 3.2 && b.per <= 4.5);
    }
  }
});

test('S3-04 Old Ruthless crosses the run in every tenth chunk: 9, 19, 29, 39 and no others', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const L = gen(seed, 40), bosses = [];
    L.rows.forEach((r, i) => { if (r.g && r.g.some((x) => x.k === 'boss')) bosses.push(Math.floor((i - 2) / 6)); });
    assert.deepEqual(bosses, [9, 19, 29, 39], `seed ${seed}`);
  }
});

test('S3-04 speed keeps rising past chunk 24 up to the new cap, and the cap and floor are the new values', () => {
  assert.equal(SPEED_CAP, 3.4); assert.equal(GAP_FLOOR, 1.2);
  const L = gen(5, 60);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const at24 = mean(waterSpeeds(L, 2 + 6 * 20, 2 + 6 * 26)), at48 = mean(waterSpeeds(L, 2 + 6 * 44, 2 + 6 * 50));
  assert.ok(at48 > at24 + 0.3, `water lanes still speed up after chunk 24 (${at24.toFixed(2)} to ${at48.toFixed(2)})`);
  let top = 0;
  for (let seed = 1; seed <= 10; seed++) for (const v of waterSpeeds(gen(seed, 60), 2, 2 + 6 * 60)) top = Math.max(top, v);
  assert.ok(top <= SPEED_CAP * 1.1 + 1e-9 && top > 2.9, `fastest lane ${top} stays under the cap and uses the headroom`);
});

test('S3-04 the lantern climbs 0.3 + 0.03 rows a second for each chunk', () => {
  for (const d of [0, 10, 24]) {
    const run = new Run({ id: 'endless' }, { mode: 'endless', seed: 7 });
    run.p.row = 2 + d * 6; run.extend(); run.beam = run.p.row - 6; run.p.invT = 99;
    const b0 = run.beam;
    for (let i = 0; i < 120; i++) run.step({});
    const rate = run.beam - b0;
    assert.ok(Math.abs(rate - (0.3 + 0.03 * d)) < 0.02, `chunk ${d}: ${rate.toFixed(3)} rows in a second`);
  }
});

test('S3-04 a tail-ring charm lies on a checkpoint row every sixth chunk from the fourth and gives a ring back, up to five', () => {
  const L = gen(3, 30);
  const charms = L.items.filter((i) => i.k === 'ring');
  assert.deepEqual(charms.map((c) => Math.floor((c.r - 2) / 6)), [4, 10, 16, 22, 28]);
  for (const c of charms) assert.ok(L.rows[c.r].check, 'on a checkpoint row');
  const run = new Run({ id: 'endless' }, { mode: 'endless', seed: 3 });
  run.p.row = 48; run.extend();
  const c0 = run.items.find((i) => i.k === 'ring');
  run.rings = 1; run.pickup(c0.r, c0.c);
  assert.equal(run.rings, 2, 'a ring comes back'); assert.equal(c0.st, 'banked');
  assert.ok(run.ev.some((e) => e.k === 'pickup' && e.item === 'ring'));
  const c1 = run.items.find((i) => i.k === 'ring' && i.st === 'free');
  run.rings = 5; run.pickup(c1.r, c1.c);
  assert.equal(run.rings, 5, 'never more than five'); assert.equal(c1.st, 'free', 'the charm stays on the ground');
});

test('S3-04 a run through the boss chunk and the first beam chunks is still crossable, and replays through the real Run', { timeout: 280000 }, () => {
  for (const seed of [1, 2, 3]) {
    const g = new Endless(seed);
    for (let i = 0; i < 12; i++) g.next(); // chunks 0 to 11: Old Ruthless at 9, beams possible at 10 and 11
    g.level.rows.push({ t: 'goal' });
    const res = solve(g.level, { maxT: 240, cap: 1500 });
    assert.ok(res.ok, `seed ${seed} best row ${res.row}/${g.level.rows.length - 1}`);
    const run = new Run({ id: 'endless' }, { mode: 'endless', seed });
    replay(run, res.moves, 120 * 300);
    assert.ok(run.maxRow >= g.level.rows.length - 3, `seed ${seed} replay reached row ${run.maxRow}`);
  }
});

// ---- S3-10: the Phone view setting in the save ---------------------------------------------------------------
const KEY = 'hsg-crazy-raccoon-v1';
const moduleFile = fileURLToPath(new URL('../src/js/save.js', import.meta.url));
let serial = 0;
const storage = (initial) => {
  const values = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []);
  return { values, getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, saved: () => JSON.parse(values.get(KEY)) };
};
async function load(store) {
  const mod = await import(pathToFileURL(moduleFile).href + '?w2b=' + (++serial));
  globalThis.window = { localStorage: store };
  return { mod, save: mod.loadSave() };
}

test('S3-10 a fresh save and a save from before both read the standard view; close and wide are kept; a damaged value reads standard', async () => {
  assert.equal((await load(storage())).save.settings.view, 'standard');
  const fixture = JSON.parse(await fs.readFile(new URL('../test-fixtures/save-v1.2.0-earned-all15.json', import.meta.url), 'utf8'));
  const old = await load(storage(fixture));
  assert.equal(old.save.settings.view, 'standard'); assert.deepEqual(old.save.progress, fixture.progress); assert.equal(old.save.unlocked, fixture.unlocked);
  for (const view of ['close', 'standard', 'wide']) assert.equal((await load(storage({ ...fixture, settings: { ...fixture.settings, view } }))).save.settings.view, view);
  for (const bad of ['huge', 7, null, {}]) assert.equal((await load(storage({ ...fixture, settings: { ...fixture.settings, view: bad } }))).save.settings.view, 'standard');
});

test('S3-10 the view survives a write and a read', async () => {
  const store = storage();
  const a = await load(store);
  a.save.settings.view = 'wide'; a.mod.writeSave(a.save);
  assert.equal(store.saved().settings.view, 'wide');
  assert.equal((await load(store)).save.settings.view, 'wide');
});
