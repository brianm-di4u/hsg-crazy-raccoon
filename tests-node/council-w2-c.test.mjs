// Council wave 2, batch C: the pure rules behind S3-05 (achievements, costumes, the Daily Run's date, seed and streak)
// and the save round trip for the fields this batch adds. Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { Run } from '../src/js/sim/run.js';
import { ACHIEVEMENTS, COSTUMES, DAILY_KEEP, award, backfill, totals, costumeUnlocked, activeCostume, nextUnlock, dateKey, dailySeed, shiftDay, emptyDaily, dailyStreak, recordDaily } from '../src/js/progress.js';

const KEY = 'hsg-crazy-raccoon-v1';
const saveFile = fileURLToPath(new URL('../src/js/save.js', import.meta.url));
let serial = 0;
async function load(initial) {
  const store = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []);
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  const mod = await import(pathToFileURL(path.resolve(saveFile)).href + '?c=' + (++serial));
  return { mod, store, load: () => mod.loadSave(), write: (s, o) => mod.writeSave(s, o), saved: () => JSON.parse(store.get(KEY)) };
}
const star3 = { stars: [true, true, true], best: 3000, bestT: 6.5, ball: true };
const fresh = async () => (await load()).load();

test('dates: the key is the local calendar day, the seed is that day as a number, days shift across month ends', () => {
  assert.equal(dateKey(new Date(2026, 10, 13, 23, 59)), '2026-11-13');
  assert.equal(dateKey(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
  assert.equal(dailySeed('2026-11-13'), 20261113);
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28'); assert.equal(shiftDay('2026-12-31', 1), '2027-01-01'); assert.equal(shiftDay('2024-03-01', -1), '2024-02-29');
});

test('the daily seed gives the same Moonlight Run to everyone on a date and a different one the next day', () => {
  const sig = (day) => { const r = new Run({ id: 'endless' }, { mode: 'endless', seed: dailySeed(day) }); return JSON.stringify([r.L.rows.slice(0, 40).map((x) => x.t + (x.g ? x.g.length : 0)), r.items.slice(0, 8).map((i) => [i.r, i.c, i.k])]); };
  assert.equal(sig('2026-11-13'), sig('2026-11-13'));
  const days = ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'].map(sig);
  assert.equal(new Set(days).size, 5, 'five consecutive days give five different runs');
});

test('daily streak: first day, next day, same day again, a gap, and a dead streak reads zero', () => {
  const d = emptyDaily();
  let r = recordDaily(d, '2026-11-13', 30, 900);
  assert.equal(r.streak, 1); assert.equal(r.first, true); assert.equal(r.newBest, true);
  r = recordDaily(d, '2026-11-13', 10, 300);
  assert.equal(r.streak, 1, 'a second run the same day does not extend it'); assert.equal(r.newBest, false); assert.deepEqual(d.hist['2026-11-13'], { rows: 30, score: 900, runs: 2 }, 'the day keeps its best');
  r = recordDaily(d, '2026-11-13', 50, 1500); assert.equal(r.newBest, true); assert.equal(d.hist['2026-11-13'].rows, 50);
  r = recordDaily(d, '2026-11-14', 5, 100); assert.equal(r.streak, 2);
  r = recordDaily(d, '2026-11-15', 5, 100); assert.equal(r.streak, 3); assert.equal(d.bestStreak, 3);
  assert.equal(dailyStreak(d, '2026-11-15'), 3); assert.equal(dailyStreak(d, '2026-11-16'), 3, 'still alive the day after'); assert.equal(dailyStreak(d, '2026-11-17'), 0, 'dead after a missed day');
  r = recordDaily(d, '2026-11-18', 5, 100); assert.equal(r.streak, 1, 'a gap starts over'); assert.equal(d.bestStreak, 3, 'the best streak is kept');
  r = recordDaily(d, '2026-11-10', 5, 100); assert.equal(d.last, '2026-11-18', 'playing an older date does not move the streak'); assert.equal(d.streak, 1);
});

test('daily history is pruned so the save cannot grow without limit', () => {
  const d = emptyDaily();
  let day = '2026-01-01';
  for (let i = 0; i < DAILY_KEEP + 25; i++) { recordDaily(d, day, i, i * 10); day = shiftDay(day, 1); }
  assert.equal(Object.keys(d.hist).length, DAILY_KEEP);
  assert.ok(!d.hist['2026-01-01'] && d.hist[shiftDay(day, -1)], 'the oldest went, the newest stayed');
  assert.equal(d.streak, DAILY_KEEP + 25, 'the streak itself is not lost by pruning');
});

test('achievements: ids are unique, each states how it is earned, there is a first-session mix and some that take weeks', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  for (const a of ACHIEVEMENTS) { assert.ok(a.name.length > 3 && a.how.endsWith('.'), a.id); assert.ok(!/\s{2}|\.\./.test(a.name + a.how), a.id); }
  assert.ok(ACHIEVEMENTS.length >= 15);
  const quick = ['snack', 'squeaky', 'lure', 'den', 'ball1', 'clean'].filter((id) => ACHIEVEMENTS.some((a) => a.id === id));
  assert.ok(quick.length >= 3, 'three or more a first session can reach');
});

test('achievements are earned once, and the ones a save proves are granted from it', async () => {
  const s = await fresh();
  assert.equal(backfill(s, 'x').length, 0, 'a fresh save proves nothing');
  assert.equal(award(s, 'snack', '2026-11-13'), true); assert.equal(award(s, 'snack', '2026-11-14'), false); assert.equal(s.ach.snack, '2026-11-13', 'the first date stays');
  assert.equal(award(s, 'not-a-thing', 'x'), false, 'unknown ids are refused');
  s.progress.l1 = { ...star3 }; s.stats.chomps = 120; s.endless.bestRows = 160;
  const got = backfill(s, 'before').sort();
  assert.deepEqual(got, ['ball1', 'chomp100', 'den', 'run150', 'run50', 'three'].sort());
  assert.equal(backfill(s, 'before').length, 0, 'and only once');
  s.progress.l15 = { ...star3 };
  for (let i = 2; i <= 14; i++) s.progress['l' + i] = { ...star3 };
  const more = backfill(s, 'x');
  for (const id of ['stars25', 'boss', 'ball15', 'star45']) assert.ok(more.includes(id), id);
});

test('costumes unlock by stars, balls and rows, and a locked choice reads as plain', async () => {
  const s = await fresh();
  assert.equal(COSTUMES.filter((c) => costumeUnlocked(s, c.id)).map((c) => c.id).join(), 'plain', 'a fresh save has only the plain Bandit');
  s.progress.l1 = { ...star3 }; s.progress.l2 = { ...star3 }; s.progress.l3 = { ...star3 }; s.progress.l4 = { stars: [true, false, false], best: 1, bestT: 9, ball: false };
  assert.equal(totals(s).stars, 10); assert.ok(costumeUnlocked(s, 'hardhat')); assert.ok(!costumeUnlocked(s, 'keeper'));
  s.settings.costume = 'crown'; assert.equal(activeCostume(s), 'plain', 'a locked choice falls back'); s.settings.costume = 'hardhat'; assert.equal(activeCostume(s), 'hardhat');
  assert.match(nextUnlock(s), /^Next: Slugger Scarf at 5 balls \(2 to go\)$/);
  s.endless.bestRows = 50; assert.ok(costumeUnlocked(s, 'moon'));
  for (let i = 5; i <= 15; i++) s.progress['l' + i] = { ...star3 };
  assert.equal(nextUnlock(s), '', 'nothing left to unlock');
  assert.equal(activeCostume({ ...s, settings: { costume: 'nonsense' } }), 'plain');
});

test('save: defaults for every new field, and a save written by this version round-trips', async () => {
  const a = await load(), s = a.load();
  assert.equal(s.settings.tipsOn, true, 'a new player gets the first-run tips'); assert.deepEqual(s.settings.tipsDone, {}); assert.equal(s.settings.costume, 'plain');
  assert.deepEqual(s.ach, {}); assert.equal(s.finale, false); assert.deepEqual(s.endless.daily, emptyDaily()); assert.equal(s.endless.bestRows, 0);
  s.ach.snack = '2026-11-13'; s.finale = true; s.settings.costume = 'hardhat'; s.settings.tipsDone = { goal: true }; s.endless.bestRows = 77; s.endless.bestScore = 3100; s.stats.dailies = 2;
  recordDaily(s.endless.daily, '2026-11-13', 77, 3100);
  assert.equal(a.write(s), true);
  const b = (await load(a.saved())).load();
  assert.deepEqual(b.ach, { snack: '2026-11-13' }); assert.equal(b.finale, true); assert.equal(b.settings.costume, 'hardhat'); assert.deepEqual(b.settings.tipsDone, { goal: true });
  assert.equal(b.endless.bestRows, 77); assert.equal(b.endless.daily.streak, 1); assert.deepEqual(b.endless.daily.hist['2026-11-13'], { rows: 77, score: 3100, runs: 1 }); assert.equal(b.stats.dailies, 2);
});

test('save: a save from before this wave loads whole, with tips off, and nothing lost', async () => {
  const old = {
    v: 1, settings: { sound: false, music: true, ambience: true, volume: 0.25, reducedMotion: true, textScale: 1.25, assist: true, hints: true, view: 'close' },
    progress: { l1: { stars: [true, true, false], best: 2248, bestT: 3.1, ball: true } }, unlocked: 4, notebook: ['a', 'b'], merman: true,
    endless: { unlocked: true, top: [{ initials: 'ABC', score: 2400, rows: 61, date: '2026-10-01' }, { initials: 'XYZ', score: 900, rows: 22, date: '2026-10-02' }] },
    stats: { hops: 400, chomps: 7, splashes: 3, treats: 12, runs: 9 },
  };
  const s = (await load(old)).load();
  assert.equal(s.settings.tipsOn, false, 'not a newcomer: no first-run tips'); assert.equal(s.settings.sound, false, 'a silent save stays silent');
  assert.deepEqual(s.progress, old.progress); assert.equal(s.unlocked, 4); assert.deepEqual(s.notebook, ['a', 'b']); assert.equal(s.merman, true);
  assert.deepEqual(s.endless.top, old.endless.top.map((e) => ({ ...e }))); assert.equal(s.endless.unlocked, true);
  assert.equal(s.endless.bestRows, 61, 'the best row is read from the old top ten'); assert.equal(s.endless.bestScore, 2400);
  assert.deepEqual(s.stats, { ...old.stats, dailies: 0 }); assert.equal(s.settings.view, 'close'); assert.equal(s.settings.textScale, 1.25);
});

test('save: damaged new fields are repaired, never thrown on', async () => {
  const bad = {
    v: 1, settings: { tipsOn: 'yes', tipsDone: ['goal', 3], costume: 42 }, ach: { snack: 5, den: '2026-11-13', ghost: null }, finale: 'yes',
    endless: { unlocked: true, top: [], bestRows: 'lots', bestScore: -5, daily: { last: 'yesterday', streak: -3, bestStreak: 'x', hist: { '2026-11-13': { rows: 'a', score: 5.7, runs: 0 }, 'nope': { rows: 1 }, '2026-11-12': 5 } } },
  };
  const s = (await load(bad)).load();
  assert.equal(s.settings.tipsOn, false, 'a non-boolean flag counts as an old save'); assert.deepEqual(s.settings.tipsDone, {}); assert.equal(s.settings.costume, 'plain');
  assert.deepEqual(s.ach, { den: '2026-11-13' }); assert.equal(s.finale, false);
  assert.equal(s.endless.bestRows, 0); assert.equal(s.endless.bestScore, 0);
  assert.deepEqual(s.endless.daily, { last: '', streak: 0, bestStreak: 0, hist: { '2026-11-13': { rows: 0, score: 5, runs: 1 } } });
  const huge = { v: 1, endless: { unlocked: true, top: [], daily: { last: '2026-11-13', streak: 2, bestStreak: 2, hist: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [shiftDay('2026-01-01', i), { rows: i, score: i, runs: 1 }])) } } };
  assert.equal(Object.keys((await load(huge)).load().endless.daily.hist).length, DAILY_KEEP, 'an over-long history is cut on load');
});

test('save: two tabs earning different achievements and bests keep both; a best never goes down', async () => {
  const store = new Map();
  globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
  const url = pathToFileURL(path.resolve(saveFile)).href;
  const tab1 = await import(url + '?t1=' + (++serial)), tab2 = await import(url + '?t2=' + serial);
  const s1 = tab1.loadSave(), s2 = tab2.loadSave();
  s1.ach.snack = '2026-11-13'; s1.endless.bestRows = 90; tab1.writeSave(s1);
  s2.ach.squeaky = '2026-11-13'; s2.endless.bestRows = 40; tab2.writeSave(s2);
  const out = JSON.parse(store.get(KEY));
  assert.deepEqual(out.ach, { snack: '2026-11-13', squeaky: '2026-11-13' }); assert.equal(out.endless.bestRows, 90, 'the higher best wins');
});
