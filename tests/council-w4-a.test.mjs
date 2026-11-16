// Council wave 4, batch A: C4-01 (a save from a newer version is left alone), S6-09 (no Object.hasOwn in the save path),
// S1-09 / S1-13 (held direction repeats, stick diagonals), S2-12 (the Hints setting), S1-12 (render interpolation).
// Every check reads state or stored bytes; none depends on a measured time or on dice.
const KEY = 'hsg-crazy-raccoon-v1';
const NEWER = JSON.stringify({ v: 2, progress: { l1: { stars: [true, true, true], best: 4321, bestT: 9.5, ball: true } }, unlocked: 9, notebook: ['x-1', 'x-2'], settings: { volume: 0.85, futureOnly: 'keep me' }, newThing: { a: [1, 2, 3] } });
const stored = (t) => t.page.evaluate((k) => localStorage.getItem(k), KEY);

export const tests = [
  // ------------------------------------------------------------------ C4-01 a newer save
  {
    name: 'C4-01 a save from a newer version is never written over, the game plays from defaults and says so once',
    viewports: ['desktop', 'mobile'],
    initScript: () => { if (localStorage.getItem('hsg-crazy-raccoon-v1') === null) localStorage.setItem('hsg-crazy-raccoon-v1', JSON.stringify({ v: 2, progress: { l1: { stars: [true, true, true], best: 4321, bestT: 9.5, ball: true } }, unlocked: 9, notebook: ['x-1', 'x-2'], settings: { volume: 0.85, futureOnly: 'keep me' }, newThing: { a: [1, 2, 3] } })); },
    async run(t) {
      const before = await stored(t);
      t.equal(before, NEWER, 'the newer save is in place before the visit');
      const s0 = await t.state();
      t.equal(s0.save.unlocked, 1, 'this visit starts from defaults in memory (level 1 only)');
      t.equal(s0.settings.volume, 0.5, 'default volume, not the newer save\'s');
      const note = await t.page.$eval('#newer-note', (e) => e.textContent);
      t.expect(/not being saved/.test(note) && /newer version/.test(note), 'the note says this visit is not saved and why: ' + note);
      t.equal(await t.page.evaluate(() => window.__CR.lastSaid), note, 'a screen reader is told the same words');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('C4-01-newer-title');
      // a full visit that would normally save: settings, a level won, a Moonlight Run, a reset
      await t.game('act', 'menu', 'settings');
      await t.game('act', 'menu', 'set', { k: 'volume', v: '0.85' });
      await t.game('act', 'menu', 'set', { k: 'sound', v: 'false' });
      await t.game('scene', 'win');
      t.equal((await t.state()).screen, 'win', 'a level was won');
      t.expect((await t.state()).save.progress.l1, 'and the win is kept in memory for this visit');
      await t.game('act', 'unlockAll');
      await t.game('act', 'menu', 'resetYes');
      await t.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      t.equal(await stored(t), before, 'the stored save is byte for byte the same after the visit');
      t.equal(await t.page.$('#newer-note'), null, 'the note is gone once the player has moved on');
      await t.reload();
      t.equal(await stored(t), before, 'and after a reload');
      t.expect(await t.page.$('#newer-note'), 'the next visit tells the player again');
    },
  },
  {
    name: 'C4-01 a damaged or wrong-shaped save is still repaired and written, and a current save still saves',
    node: true,
    async run(t) {
      const { loadSave, writeSave, saveIsNewer } = await import('../src/js/save.js?w4a');
      const store = new Map();
      globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } };
      store.set(KEY, JSON.stringify({ v: 1, progress: 'oops', notebook: null, unlocked: '4' }));
      let s = loadSave();
      t.equal(saveIsNewer(), false, 'a damaged version 1 save is not "newer"');
      t.equal(writeSave(s), true, 'it is repaired and written back');
      t.equal(JSON.parse(store.get(KEY)).progress.constructor, Object, 'as built in wave 1');
      store.set(KEY, '{"v":1,"progress":');
      s = loadSave();
      t.equal(saveIsNewer(), false, 'truncated JSON is not "newer"');
      t.equal(writeSave(s), true, 'and the game saves over it, as before');
      for (const v of ['2', 'x', null, [], 0, -1]) {
        store.set(KEY, JSON.stringify({ v, unlocked: 3 }));
        loadSave();
        t.equal(saveIsNewer(), false, 'a version of ' + JSON.stringify(v) + ' is not a newer save');
      }
      store.set(KEY, JSON.stringify({ v: 1, unlocked: 3 }));
      s = loadSave(); s.unlocked = 5;
      t.equal(writeSave(s), true, 'a current save writes');
      t.equal(JSON.parse(store.get(KEY)).unlocked, 5, 'and holds what was written');
      // a newer save met between load and write (another tab, a stale page) is not written over either
      store.set(KEY, JSON.stringify({ v: 3, keep: true }));
      s.unlocked = 6;
      t.equal(writeSave(s), false, 'a write finds a newer save that appeared since the load and stops');
      t.equal(store.get(KEY), JSON.stringify({ v: 3, keep: true }), 'leaving it as it was');
      t.equal(saveIsNewer(), true, 'and the rest of the visit is unsaved');
      store.set(KEY, JSON.stringify({ v: 2, keep: 1 }));
      loadSave();
      t.equal(saveIsNewer(), true, 'a newer save is noticed at load');
      t.equal(writeSave({ v: 1, unlocked: 9 }, { reset: true }), false, 'even a Reset does not write');
      t.equal(store.get(KEY), JSON.stringify({ v: 2, keep: 1 }), 'the newer save is untouched');
    },
  },
];
