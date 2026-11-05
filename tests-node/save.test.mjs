import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const KEY = 'hsg-crazy-raccoon-v1';
const moduleFile = fileURLToPath(new URL('../src/js/save.js', import.meta.url));
let serial = 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
function storage(initial) {
  const values = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []);
  return { values, failWrite: false, failRead: false,
    getItem(k) { if (this.failRead) throw new Error('read denied'); return values.get(k) ?? null; },
    setItem(k, v) { if (this.failWrite) throw new DOMException('full', 'QuotaExceededError'); values.set(k, v); },
    saved() { return JSON.parse(values.get(KEY)); },
  };
}
async function tab(store, file = moduleFile) {
  const mod = await import(pathToFileURL(path.resolve(file)).href + '?tab=' + (++serial));
  const call = (fn, ...args) => { globalThis.window = { localStorage: store }; return fn(...args); };
  return { mod, load: () => call(mod.loadSave), write: (s, options) => call(mod.writeSave, s, options) };
}
function earn(s, id, { score = 2248, time = 3, stars = [true, false, true], ball = true, hops = 17 } = {}) {
  s.progress[id] = { stars, best: score, bestT: time, ball };
  s.unlocked = Math.max(s.unlocked, Number(id.slice(1)) + 1);
  s.stats.hops += hops; s.stats.runs++;
}

test('stale real-setting write preserves another tab earned progress and stats', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  earn(sa, 'l1'); assert.equal(a.write(sa), true);
  sb.settings.music = false; assert.equal(b.write(sb), true);
  assert.equal(store.saved().progress.l1.best, 2248); assert.equal(store.saved().unlocked, 2);
  assert.equal(store.saved().stats.hops, 17); assert.equal(store.saved().settings.music, false);
  assert.equal(sb.progress.l1.best, 2248, 'successful write rebases live state');
});

test('independent settings retain both edits, including a later stale setting', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  sa.settings.volume = 0.2; a.write(sa); sb.settings.music = false; b.write(sb);
  sa.settings.hints = false; a.write(sa);
  assert.deepEqual(store.saved().settings, { ...a.mod.DEFAULT_SAVE().settings, volume: 0.2, music: false, hints: false });
});

test('two independently earned levels and cumulative counters survive sequential writes', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  earn(sa, 'l1'); earn(sb, 'l2', { score: 3000, hops: 23 });
  sa.notebook.push('fact-a'); sb.notebook.push('fact-b'); sb.merman = true; sb.endless.unlocked = true;
  a.write(sa); b.write(sb);
  assert.deepEqual(Object.keys(store.saved().progress).sort(), ['l1', 'l2']);
  assert.equal(store.saved().unlocked, 3); assert.equal(store.saved().stats.hops, 40); assert.equal(store.saved().stats.runs, 2);
  assert.deepEqual(store.saved().notebook, ['fact-a', 'fact-b']); assert.equal(store.saved().merman, true);
  assert.equal(store.saved().endless.unlocked, true);
});

test('independent first results for one level preserve best time, score, stars and collectible', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  earn(sa, 'l1', { score: 3000, time: 2, stars: [true, false, true], ball: true });
  earn(sb, 'l1', { score: 2000, time: 4, stars: [false, true, false], ball: false });
  a.write(sa); b.write(sb);
  assert.deepEqual(store.saved().progress.l1, { best: 3000, bestT: 2, stars: [true, true, true], ball: true });
});

test('quota failure keeps pending local delta and later merges remote progress exactly once', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  sa.settings.music = false; earn(sa, 'l1'); store.failWrite = true;
  assert.equal(a.write(sa), false); assert.equal(store.values.has(KEY), false);
  store.failWrite = false; earn(sb, 'l2', { hops: 23 }); b.write(sb);
  assert.equal(a.write(sa), true); assert.equal(store.saved().stats.hops, 40);
  assert.equal(store.saved().settings.music, false); assert.ok(store.saved().progress.l1); assert.ok(store.saved().progress.l2);
  sa.settings.hints = false; a.write(sa); assert.equal(store.saved().stats.hops, 40, 'no remote stats counted twice');
  sa.stats.hops += 2; a.write(sa); assert.equal(store.saved().stats.hops, 42);
});

test('failed read does not overwrite unknown storage; failed fallback load does not rebase pending delta', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  sa.settings.music = false; sa.stats.hops = 2; store.failRead = true;
  assert.equal(a.write(sa), false); assert.equal(a.load().settings.music, false);
  store.failRead = false; earn(sb, 'l1', { hops: 17 }); b.write(sb); a.write(sa);
  assert.equal(store.saved().settings.music, false); assert.equal(store.saved().stats.hops, 19);
});

test('explicit reset clears progress and later stale setting cannot resurrect old unchanged data', async () => {
  const store = storage(), seed = await tab(store), initial = seed.load(); earn(initial, 'l1'); initial.notebook.push('old'); seed.write(initial);
  const a = await tab(store), b = await tab(store); a.load(); const stale = b.load();
  assert.equal(a.write(a.mod.DEFAULT_SAVE(), { reset: true }), true);
  stale.settings.music = false; b.write(stale);
  assert.deepEqual(store.saved().progress, {}); assert.equal(store.saved().unlocked, 1);
  assert.deepEqual(store.saved().notebook, []); assert.equal(store.saved().stats.hops, 0); assert.equal(store.saved().settings.music, false);
});

test('quota-failed explicit reset remains pending until persistence succeeds', async () => {
  const store = storage(), a = await tab(store), s = a.load(); earn(s, 'l1'); a.write(s);
  const cleared = a.mod.DEFAULT_SAVE(); store.failWrite = true; assert.equal(a.write(cleared, { reset: true }), false);
  store.failWrite = false; cleared.settings.volume = 0.2; assert.equal(a.write(cleared), true);
  assert.deepEqual(store.saved().progress, {}); assert.equal(store.saved().unlocked, 1); assert.equal(store.saved().settings.volume, 0.2);
});

test('top-score multiset additions preserve duplicate legitimate entries without replaying old entries', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  const score = { initials: 'AAA', score: 100, rows: 20, date: '2026-11-04' };
  sa.endless.top.push(score); sb.endless.top.push(clone(score)); a.write(sa); b.write(sb);
  assert.equal(store.saved().endless.top.length, 2); sb.settings.music = false; b.write(sb);
  assert.equal(store.saved().endless.top.length, 2);
});

test('actual earned all15 v1 fixture round trip and old-reader backward read retain format and progress', async () => {
  const fixture = JSON.parse(await fs.readFile(new URL('../test-fixtures/save-v1.2.0-earned-all15.json', import.meta.url), 'utf8'));
  const store = storage(fixture), a = await tab(store), s = a.load();
  assert.deepEqual(s, fixture); s.settings.music = false; a.write(s);
  const legacy = await tab(store, fileURLToPath(new URL('../test-fixtures/save-v1-reader.mjs', import.meta.url)));
  const read = legacy.load(); assert.equal(read.v, 1); assert.deepEqual(read.progress, fixture.progress);
  assert.deepEqual(read.stats, fixture.stats); assert.equal(read.settings.music, false);
  assert.deepEqual(Object.keys(read).sort(), Object.keys(fixture).sort(), 'no schema fields added');
});

test('partial and malformed v1 fallback still recover via an ordinary write', async () => {
  const store = storage({ v: 1, settings: { music: false }, progress: {}, unlocked: 1 });
  const a = await tab(store), s = a.load(); assert.equal(s.settings.sound, true); assert.equal(s.settings.music, false);
  s.settings.volume = 0.2; assert.equal(a.write(s), true); assert.equal(store.saved().settings.music, false);
  const bad = storage(); bad.values.set(KEY, '{"v":1,'); const b = await tab(bad), fresh = b.load();
  assert.equal(bad.getItem(KEY), '{"v":1,'); fresh.settings.music = false; assert.equal(b.write(fresh), true);
  assert.equal(bad.saved().v, 1); assert.equal(bad.saved().settings.music, false);
});

test('empty-store quota failure keeps memory and pending snapshot through another loadSave call', async () => {
  const store = storage(), a = await tab(store), b = await tab(store), sa = a.load(), sb = b.load();
  sa.settings.music = false; sa.stats.hops = 2; store.failWrite = true; assert.equal(a.write(sa), false);
  const retry = a.load(); assert.equal(retry.settings.music, false); assert.equal(retry.stats.hops, 2);
  store.failWrite = false; earn(sb, 'l1', { hops: 17 }); b.write(sb); assert.equal(a.write(retry), true);
  assert.equal(store.saved().stats.hops, 19); assert.equal(store.saved().settings.music, false);
  assert.ok(store.saved().progress.l1);
});

test('reset merge leaves no undefined ghost progress keys and live save matches serialized storage', async () => {
  const store = storage(), initialTab = await tab(store), initial = initialTab.load(); earn(initial, 'l1'); initialTab.write(initial);
  const a = await tab(store), b = await tab(store); a.load(); const stale = b.load();
  a.write(a.mod.DEFAULT_SAVE(), { reset: true }); stale.settings.music = false; assert.equal(b.write(stale), true);
  assert.deepEqual(Object.keys(stale.progress), []); assert.deepEqual(stale, store.saved());
});

test('malformed own __proto__ data remains inert through recursive merge and live rebase', async () => {
  const store = storage(), a = await tab(store), sa = a.load();
  store.values.set(KEY, '{"v":1,"settings":{"__proto__":{"polluted":"settings"}},"__proto__":{"polluted":"root"}}');
  sa.settings.music = false; assert.equal(a.write(sa), true);
  sa.settings.__proto__.polluted = 'changed-own-data'; sa.__proto__.polluted = 'changed-root-data';
  assert.equal(a.write(sa), true);
  assert.equal(Object.getPrototypeOf(sa), Object.prototype); assert.equal(Object.getPrototypeOf(sa.settings), Object.prototype);
  assert.equal({}.polluted, undefined); assert.equal(sa.polluted, undefined); assert.equal(sa.settings.polluted, undefined);
  assert.deepEqual(sa, store.saved());
  assert.equal(Object.hasOwn(sa, '__proto__'), true); assert.equal(Object.hasOwn(sa.settings, '__proto__'), true);
});
