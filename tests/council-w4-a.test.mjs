// Council wave 4, batch A: C4-01 (a save from a newer version is left alone), S6-09 (no Object.hasOwn in the save path),
// S1-09 / S1-13 (held direction repeats, stick diagonals), S2-12 (the Hints setting), S1-12 (render interpolation).
// Every check reads state or stored bytes; none depends on a measured time or on dice.
const KEY = 'hsg-crazy-raccoon-v1';
const NEWER = JSON.stringify({ v: 2, progress: { l1: { stars: [true, true, true], best: 4321, bestT: 9.5, ball: true } }, unlocked: 9, notebook: ['x-1', 'x-2'], settings: { volume: 0.85, futureOnly: 'keep me' }, newThing: { a: [1, 2, 3] } });
const stored = (t) => t.page.evaluate((k) => localStorage.getItem(k), KEY);

// A pure run on level 1, Bandit on its start row. The real input module is driven through a fake window and fake gamepads,
// with a clock the test sets, so nothing here waits for time.
async function inputRig(tag) {
  const fs = await import('node:fs');
  const { Run } = await import('../src/js/sim/run.js');
  const levels = JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8')).levels;
  const handlers = {};
  let clock = 1000, pads = [];
  globalThis.window = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => pads } });
  const realNow = performance.now.bind(performance);
  performance.now = () => clock;
  const inp = await import('../src/js/ui/input.js?' + tag);
  inp.initInput(null);
  const padOf = (axes, buttons = []) => ({ index: 0, connected: true, axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) });
  return {
    inp, handlers,
    key: (type, code) => handlers[type]({ code, repeat: false, preventDefault() {} }),
    run: () => new Run(JSON.parse(JSON.stringify(levels[0])), { seed: 3 }),
    at: (ms) => { clock = ms; },
    pad: (axes, buttons) => { pads = axes ? [padOf(axes, buttons)] : []; inp.pollGamepads(); },
    hops: () => { const out = []; for (let h; (h = inp.readIntent().hop);) out.push(h); return out; },
    restore: () => { performance.now = realNow; delete globalThis.window; },
  };
}

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

  // ------------------------------------------------------------------ S1-13 stick diagonals
  {
    name: 'S1-13 a diagonal stick push hops along the axis it leans on most, and only that axis passes 0.6',
    node: true,
    async run(t) {
      const r = await inputRig('s113');
      try {
        const cases = [[[0.7, -0.9], ['up'], 'up-right leaning up hops up'], [[0.9, -0.7], ['right'], 'up-right leaning right hops right'], [[-0.9, 0.7], ['left'], 'down-left leaning left hops left'],
          [[-0.65, 0.8], ['down'], 'down-left leaning down hops down'], [[0.8, -0.8], ['right'], 'an exact tie goes sideways'], [[0.5, -0.5], [], 'a diagonal under 0.6 does nothing'],
          [[0.1, -0.61], ['up'], 'a straight push past 0.6 still hops'], [[0.59, 0.1], [], 'and under 0.6 does not']];
        for (const [axes, want, why] of cases) {
          r.pad([0, 0]); r.hops();
          r.pad(axes);
          t.equal(r.hops().join(), want.join(), why + ' (' + axes.join(', ') + ')');
        }
        r.pad([0, 0]); r.hops();
        r.pad([0, 0], [12, 15]);
        t.equal(r.hops().join(), 'up,right', 'two d-pad buttons pressed together still send both hops, as before');
      } finally { r.restore(); }
    },
  },

  // ------------------------------------------------------------------ S1-09 hold to hop
  {
    name: 'S1-09 a held direction repeats only on open ground, after 0.1 s, and never into water, a wall or a gator',
    node: true,
    async run(t) {
      const r = await inputRig('s109'), { inp } = r;
      const { colX } = await import('../src/js/sim/const.js');
      try {
        const run = r.run();
        r.at(1000);
        t.equal(inp.holdHop(run), null, 'nothing held, nothing repeats');
        r.key('keydown', 'ArrowLeft');
        t.equal(r.hops().join(), 'left', 'the press itself hops once, as always');
        r.at(1050); t.equal(inp.holdHop(run), null, 'not before 0.1 s');
        r.at(1100); t.equal(inp.holdHop(run), 'left', 'at 0.1 s a held key repeats on open ground');
        const p = run.p;
        p.state = 'hop'; t.equal(inp.holdHop(run), null, 'not while a hop is in flight'); p.state = 'idle';
        p.queue = 'up'; t.equal(inp.holdHop(run), null, 'not while a press is queued'); p.queue = null;
        p.on = 1; t.equal(inp.holdHop(run), null, 'not while riding a gator'); p.on = null;
        const wall = r.run(); wall.p.x = colX(0);
        t.equal(inp.holdHop(wall), null, 'not into the edge of the field (that would only bump)');
        const river = r.run(); river.p.row = 1;
        r.key('keyup', 'ArrowLeft'); r.at(2000); r.key('keydown', 'ArrowUp'); r.hops(); r.at(2200);
        t.equal(inp.holdHop(river), null, 'not onto a row of open water');
        const start = r.run();
        t.equal(inp.holdHop(start), 'up', 'but up from the start row, onto the path, is fine');
        r.key('keyup', 'ArrowUp');
        t.equal(inp.holdHop(start), null, 'letting go stops it');
        r.key('keydown', 'KeyD'); r.hops(); r.at(2400);
        t.equal(inp.holdHop(start), 'right', 'WASD holds too');
        r.key('keydown', 'KeyA'); r.hops(); r.at(2600);
        t.equal(inp.holdHop(start), 'left', 'the newest held direction wins');
        r.key('keyup', 'KeyA');
        t.equal(inp.holdHop(start), 'right', 'and releasing it gives the older one back');
        r.handlers.blur(); t.equal(inp.holdHop(start), null, 'losing focus drops every hold');
        r.key('keydown', 'KeyD'); r.at(3000); inp.setEnabled(false);
        t.equal(inp.holdHop(start), null, 'a pause or a menu drops every hold'); inp.setEnabled(true);
        const over = r.run(); r.key('keydown', 'ArrowUp'); r.at(3200); over.phase = 'fail';
        t.equal(inp.holdHop(over), null, 'nothing repeats once the run is over');
        r.key('keyup', 'ArrowUp');
        // a pad: the stick held up repeats, released stops, unplugged stops
        r.at(4000); r.pad([0, -0.9]); r.hops(); r.at(4200);
        t.equal(inp.holdHop(r.run()), 'up', 'a stick held up repeats');
        r.pad([0, 0]); t.equal(inp.holdHop(r.run()), null, 'released, it stops');
        r.pad([0, -0.9]); r.hops(); r.at(4400);
        r.pad(null); t.equal(inp.holdHop(r.run()), null, 'a pad unplugged while held stops it');
      } finally { r.restore(); }
    },
  },
  {
    name: 'S1-09 Hold to hop is off by default and for an old save, and a held key hops once unless it is on',
    viewports: ['desktop'],
    async run(t) {
      t.equal((await t.state()).settings.holdHop, false, 'off by default');
      const hold = (code) => t.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })), code);
      const release = (code) => t.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c })), code);
      const live = (pred, arg) => t.page.waitForFunction(pred, arg, { timeout: 30000 });
      // off: the key is held through 3 seconds of game time and Bandit hops once
      await t.game('newGame', { level: 'l1', seed: 3 });
      await hold('ArrowLeft');
      const from = (await t.state()).run.steps;
      await live((n) => window.__CR.run.steps >= n + 360, from);
      let r = (await t.state()).run;
      t.equal([r.hops, r.player.col], [1, 3], 'a held key with the setting off is one hop');
      await release('ArrowLeft');
      // on: the key crosses the start row to the wall and stops there
      await t.game('setState', { settings: { holdHop: true } });
      await t.game('newGame', { level: 'l1', seed: 3 });
      await hold('ArrowLeft');
      await live(() => window.__CR.run.hops >= 4 && window.__CR.run.p.state === 'idle');
      r = (await t.state()).run;
      t.equal([r.player.col, r.hops], [0, 4], 'held left, Bandit hops four columns to the wall');
      const steps = r.steps;
      await live((n) => window.__CR.run.steps >= n + 240, steps);
      r = (await t.state()).run;
      t.equal([r.player.col, r.hops, r.player.state], [0, 4, 'idle'], 'and then stands still: a wall is not bumped again and again');
      await release('ArrowLeft');
      // up from the start: the path row, then the river is not entered
      await t.game('newGame', { level: 'l1', seed: 3 });
      await hold('ArrowUp');
      await live(() => window.__CR.run.p.row >= 1 && window.__CR.run.p.state === 'idle');
      const s1 = (await t.state()).run.steps;
      await live((n) => window.__CR.run.steps >= n + 240, s1);
      r = (await t.state()).run;
      t.equal([r.player.row, r.phase, r.rings], [1, 'play', 5], 'held up stops at the river: no splash, no lost ring');
      await release('ArrowUp');
      // letting go ends the walk: released after the second hop, Bandit does not reach the wall
      await t.game('newGame', { level: 'l1', seed: 3 });
      await hold('ArrowLeft');
      await live(() => window.__CR.run.hops >= 2);
      await release('ArrowLeft');
      const s2 = (await t.state()).run.steps;
      await live((n) => window.__CR.run.steps >= n + 240, s2);
      r = (await t.state()).run;
      t.expect(r.player.col >= 1 && r.hops <= 3, 'a released key ends the walk (column ' + r.player.col + ', ' + r.hops + ' hops)');
    },
  },
  {
    name: 'S1-09 and S2-12 an old save that holds neither setting reads Hold to hop as off and Hints as on',
    node: true,
    async run(t) {
      const { loadSave } = await import('../src/js/save.js?w4hold');
      const store = new Map();
      globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } };
      const load = (settings) => { store.set(KEY, JSON.stringify({ v: 1, settings })); return loadSave().settings; };
      t.equal(load({ volume: 0.5 }).holdHop, false, 'a save with no holdHop reads off');
      t.equal(load({ holdHop: 'yes' }).holdHop, false, 'a wrong-typed value reads off');
      t.equal(load({ holdHop: true }).holdHop, true, 'an explicit on is kept');
      t.equal(load({ volume: 0.5 }).hints, true, 'a save with no hints setting reads on');
      t.equal(load({ hints: 'no' }).hints, true, 'a wrong-typed hints reads on');
      t.equal(load({ hints: false }).hints, false, 'an explicit off is kept');
      delete globalThis.window;
    },
  },

  // ------------------------------------------------------------------ S2-12 the Hints setting
  {
    name: 'S2-12 Settings has a Hints row that turns the level 1 hop reminder on and off and keeps the choice',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const hint = () => t.page.evaluate(() => { const e = document.getElementById('h-hint'); return e && !e.hidden ? e.textContent : ''; });
      await t.game('scene', 'settings');
      const labels = await t.page.$$eval('#screens .flabel', (n) => n.map((x) => x.textContent));
      t.expect(labels.includes('Hints') && labels.indexOf('Hints') > labels.indexOf('First-run tips'), 'the Hints row is in Settings: ' + labels.join(', '));
      await t.waitForAnimations();
      const box = await t.page.$eval('[data-k="hints"][data-v="false"]', (b) => { const q = b.getBoundingClientRect(); return [q.width, q.height]; });
      t.expect(box[0] >= 44 && box[1] >= 44, 'its buttons are at least 44 px (' + box.join(' x ') + ')');
      t.equal(await t.page.$eval('[data-k="hints"][data-v="true"]', (b) => b.getAttribute('aria-pressed')), 'true', 'On is pressed by default');
      await t.game('act', 'menu', 'back');
      await t.game('newGame', { level: 'l1', seed: 3 });
      t.expect(/hop/i.test(await hint()), 'with Hints on, level 1 shows the reminder: ' + await hint());
      await t.game('scene', 'settings');
      await t.page.click('[data-k="hints"][data-v="false"]');
      await t.page.waitForFunction(() => window.__game.getState().settings.hints === false);
      t.equal(await t.page.$eval('[data-k="hints"][data-v="false"]', (b) => b.getAttribute('aria-pressed')), 'true', 'Off shows as pressed');
      await t.checkLayout({ allowScrollY: true });
      await t.page.$eval('[data-k="holdHop"][data-v="false"]', (b) => b.scrollIntoView({ block: 'center' }));
      await t.shot('S2-12-settings');
      await t.game('newGame', { level: 'l1', seed: 3 });
      t.equal(await hint(), '', 'with Hints off, level 1 shows no reminder');
      await t.reload();
      t.equal((await t.state()).settings.hints, false, 'the choice survives a reload');
    },
  },
  // ------------------------------------------------------------------ S6-09 no Object.hasOwn in the save path
  {
    name: 'S6-09 the save path loads, merges and writes on an engine that has no Object.hasOwn, and no source file calls it',
    node: true,
    async run(t) {
      const fs = await import('node:fs'), path = await import('node:path');
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
      const users = walk((await import('node:url')).fileURLToPath(new URL('../src/js', import.meta.url))).filter((f) => f.endsWith('.js') && /Object\.hasOwn\(/.test(fs.readFileSync(f, 'utf8')));
      t.equal(users.length, 0, 'no file under src/js calls Object.hasOwn: ' + users.join(', '));
      const { loadSave, writeSave } = await import('../src/js/save.js?w4own');
      const store = new Map();
      globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } };
      const had = Object.hasOwn;
      delete Object.hasOwn;
      try {
        const s = loadSave();
        s.unlocked = 4; s.stats.hops = 10; s.progress.l1 = { stars: [true, false, false], best: 10, bestT: 5, ball: false };
        t.equal(writeSave(s), true, 'a first write succeeds without Object.hasOwn');
        t.equal(JSON.parse(store.get(KEY)).unlocked, 4, 'and the progress is stored');
        const other = JSON.parse(store.get(KEY)); other.stats.hops = 25; store.set(KEY, JSON.stringify(other)); // another tab moved on
        s.stats.hops = 12; s.progress.l1.best = 99;
        t.equal(writeSave(s), true, 'a write that has to merge another tab\'s changes succeeds too');
        const now = JSON.parse(store.get(KEY));
        t.equal([now.stats.hops, now.progress.l1.best], [27, 99], 'and merges them: hops added, best kept');
      } finally { Object.hasOwn = had; delete globalThis.window; }
    },
  },
];
