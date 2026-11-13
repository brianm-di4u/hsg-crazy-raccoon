// Council wave 2, batch A (S5-02): the Ambience setting in the save.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

const KEY = 'hsg-crazy-raccoon-v1';
const moduleFile = fileURLToPath(new URL('../src/js/save.js', import.meta.url));
let serial = 0;
const storage = (initial) => {
  const values = new Map(initial ? [[KEY, JSON.stringify(initial)]] : []);
  return { values, getItem: (k) => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, saved: () => JSON.parse(values.get(KEY)) };
};
async function load(store) {
  const mod = await import(pathToFileURL(moduleFile).href + '?w2a=' + (++serial));
  globalThis.window = { localStorage: store };
  return { mod, save: mod.loadSave() };
}
const fixture = async () => JSON.parse(await fs.readFile(new URL('../test-fixtures/save-v1.2.0-earned-all15.json', import.meta.url), 'utf8'));

test('a new save has Ambience on', async () => {
  const { mod, save } = await load(storage());
  assert.equal(mod.DEFAULT_SAVE().settings.ambience, true);
  assert.equal(save.settings.ambience, true);
});

test('a save from before the Ambience setting loads with it on and loses nothing', async () => {
  const old = await fixture();
  assert.equal('ambience' in old.settings, false);
  const { save } = await load(storage(old));
  assert.equal(save.settings.ambience, true);
  assert.deepEqual(save.progress, old.progress);
  assert.deepEqual(save.stats, old.stats);
  assert.equal(save.unlocked, old.unlocked);
  assert.equal(save.settings.sound, old.settings.sound);
});

test('Ambience off is written and read back, and a damaged value reads as on', async () => {
  const store = storage(), a = await load(store);
  a.save.settings.ambience = false;
  assert.equal(a.mod.writeSave(a.save), true);
  assert.equal(store.saved().settings.ambience, false);
  assert.equal((await load(store)).save.settings.ambience, false);
  const old = await fixture(); old.settings.ambience = 'loud';
  assert.equal((await load(storage(old))).save.settings.ambience, true);
});
