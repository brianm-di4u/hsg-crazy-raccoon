// Council wave 1, batch B: input, rules and play, screens and words (S1-01, S5-01, S1-06, S3-06, S4-10, S5-20, S2-15, P-N01).

// A scripted AudioContext that records every oscillator started as "type:frequency" (runs before the page scripts).
const fakeAudio = () => {
  const log = window.__aud = { osc: [] };
  const param = (value) => ({ value, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class Node {
    connect() { return this; } disconnect() {}
    get gain() { return this._g || (this._g = param(1)); }
    get frequency() { return this._f || (this._f = { value: 0, setValueAtTime: (v) => { this.hz = v; }, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }); }
    get Q() { return { value: 0 }; }
    get pan() { return this._p || (this._p = param(0)); } get detune() { return this._d || (this._d = param(0)); } get delayTime() { return this._dt || (this._dt = param(0)); }
    get threshold() { return { value: 0 }; } get knee() { return { value: 0 }; } get ratio() { return { value: 0 }; } get attack() { return { value: 0 }; } get release() { return { value: 0 }; }
  }
  class Osc extends Node { start() { log.osc.push((this.type || 'noise') + ':' + Math.round(this.hz || 0)); } stop() {} }
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.sampleRate = 8000; this.destination = new Node(); this.onstatechange = null; }
    get currentTime() { return performance.now() / 1000; }
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); } createOscillator() { return new Osc(); }
    createDelay() { return new Node(); } createStereoPanner() { return new Node(); } createDynamicsCompressor() { return new Node(); }
    createBufferSource() { return new Osc(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); }
  };
};
// wave 3 (S5-04): every play of a cue is detuned a little, so a cue is counted by name in the audio state's cue log, not by its pitch
const played = (t, name) => t.page.evaluate((n) => window.__game.getState().audio.cues.filter((c) => c === n).length, name);
const cue = async (t, level, name, ticks) => {
  await t.page.dispatchEvent('body', 'pointerdown');
  await t.game('newGame', { level });
  await t.game('pause');
  const before = await played(t, name);
  for (let i = 0; i < ticks / 60; i++) await t.game('step', 60);
  return (await played(t, name)) - before;
};

const setUp = async (t) => {
  await t.game('newGame', { level: 'l4' });
  return t.game('setState', { player: { row: 1, col: 4 } });
};
const player = async (t) => (await t.state()).run.player;

export const tests = [
  {
    name: 'S1-01 a tap below Bandit hops forward, a swipe down still hops back',
    viewports: ['mobile'],
    async run(t) {
      let s = await setUp(t);
      const [x, y] = s.camera.player;
      await t.tap([x, Math.min(s.camera.h - 4, s.camera.h * 0.88)]);
      await t.waitFrames(20);
      let p = await player(t);
      t.equal(p.row, 2, 'a tap at 88 percent of the height (below Bandit) hops up a row');
      await t.game('setState', { player: { row: 2, col: 4 } });
      await t.tap([x - 0.3 * s.camera.tile, y + 1.2 * s.camera.tile]);
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.row, 3, 'a tap just below Bandit also hops up');
      s = await t.game('setState', { player: { row: 2, col: 4 } });
      await t.touchDrag([x, y], [x, y + 90], { steps: 6 });
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.row, 1, 'a swipe down still hops back');
      s = await t.game('setState', { player: { row: 1, col: 4 } });
      await t.tap([x + 1.4 * s.camera.tile, y + 0.2 * s.camera.tile]);
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.col, 5, 'a tap to the right of Bandit still hops right');
    },
  },
  {
    name: 'S1-06 a tap held for more than 600 ms still hops',
    viewports: ['mobile'],
    async run(t) {
      const s = await setUp(t);
      const [x, y] = s.camera.player;
      await t.touchDrag([x, y], [x, y], { steps: 1, holdEndMs: 750 });
      await t.waitFrames(20);
      t.equal((await player(t)).row, 2, 'a 750 ms press on Bandit hops up');
    },
  },  {
    name: 'S5-01 the jaw warning is heard when a nearby gator starts to telegraph',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      const n = await cue(t, 'l1', 'tele', 1200);
      t.expect(n >= 2, 'the tele cue plays as gators near the start begin their warnings (heard ' + n + ')');
      t.expect(n <= 60, 'one cue per warning, not one per step (heard ' + n + ' in 20 s)');
    },
  },
  {
    name: 'S5-01 the feeding-show cue plays when a drumstick shadow appears',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      const n = await cue(t, 'l7', 'feed', 480);
      t.expect(n >= 1, 'the feed cue plays when the first toss is announced (heard ' + n + ')');
      t.expect(n <= 3, 'one cue per toss (heard ' + n + ')');
    },
  },  {
    name: 'S3-06 Assist does not leak into Moonlight Run',
    viewports: ['desktop'],
    async run(t) {
      const trace = async (assist) => {
        await t.game('newGame', { mode: 'endless', seed: 11, assist });
        await t.game('pause');
        const have = (await t.state()).run.steps; // the live loop may have stepped a few ticks before pause
        await t.game('step', 400 - have);
        return (await t.state()).run;
      };
      const on = await trace(true), off = await trace(false);
      t.equal(on.gators.map((g) => g.x), off.gators.map((g) => g.x), 'gators move the same with Assist on or off');
      t.equal(on.gators.map((g) => g.jaw), off.gators.map((g) => g.jaw), 'jaw warnings last as long with Assist on or off');
      t.equal(on.rings, 3, 'three tail rings either way');
      await t.game('setState', { settings: { assist: false } });
    },
  },  {
    name: 'S4-10 the Farm Notebook grid does not stretch a row around one card',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const id = await t.page.evaluate(() => FACTS.bank[0].id);
      await t.game('setState', { save: { notebook: [id] } });
      await t.game('scene', 'notebook');
      await t.waitForStable();
      const r = await t.page.evaluate(() => {
        const cards = [...document.querySelectorAll('.cards .card')];
        const found = cards.find((c) => !c.classList.contains('locked'));
        const locked = cards.filter((c) => c.getAttribute('aria-label') === 'Locked fact').map((c) => Math.round(c.getBoundingClientRect().height));
        return { found: Math.round(found.getBoundingClientRect().height), locked };
      });
      t.expect(r.locked.length > 2, 'locked slots are shown');
      t.expect(new Set(r.locked).size === 1, 'every locked slot is the same height (heights ' + [...new Set(r.locked)].join(', ') + ')');
      t.expect(r.locked[0] < 120, 'a locked slot is a small stamp (' + r.locked[0] + ' px)');
      await t.shot('s4-10-notebook-one-card');
      await t.checkLayout({ allowScrollY: true });
      await t.game('setState', { save: { notebook: [] } });
    },
  },  {
    name: 'S2-15 the Lure button is hidden on levels that have no drumsticks',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const shown = () => t.page.evaluate(() => { const b = document.getElementById('h-lure'); return b.getBoundingClientRect().width > 0 && getComputedStyle(b).display !== 'none'; });
      for (const id of ['l1', 'l5']) {
        await t.game('newGame', { level: id });
        await t.waitFrames(3);
        t.equal(await shown(), false, id + ': no Lure button before any drumstick can exist');
      }
      await t.game('newGame', { level: 'l6' });
      await t.waitFrames(3);
      t.equal(await shown(), true, 'l6: the Lure button is there on the level that grants a lure');
      await t.game('newGame', { level: 'l1' });
      await t.game('setState', { lures: 1 });
      await t.waitFrames(3);
      t.equal(await shown(), true, 'a held lure shows the button on any level');
      await t.game('newGame', { mode: 'endless' });
      await t.waitFrames(3);
      t.equal(await shown(), true, 'Moonlight Run drops drumsticks, so it keeps the button');
    },
  },  {
    name: 'P-N01 a shove from a closed-mouth gator never drops Bandit into water',
    node: true,
    async run(t) {
      const fs = await import('node:fs');
      const { Run } = await import('../src/js/sim/run.js');
      const { colX } = await import('../src/js/sim/const.js');
      const data = JSON.parse(fs.readFileSync(new URL('../data/levels.json', import.meta.url), 'utf8'));
      const levels = data.levels || data;
      let shoves = 0, splashes = 0;
      for (const n of [11, 13]) {
        const L = levels.find((l) => l.n === n);
        const rows = L.rows.map((r, i) => i).filter((i) => i > 0 && L.rows[i].t !== 'water' && L.rows[i - 1].t === 'water' && (L.rows[i].g || []).some((g) => g.k !== 'hatchling'));
        t.expect(rows.length > 0, 'level ' + n + ' has land-gator rows above water');
        for (const r of rows) for (let c = 0; c < 9; c++) {
          const run = new Run(JSON.parse(JSON.stringify(L)), { seed: 5 });
          // let the world run, then drop Bandit on the row at half-second intervals for a minute
          for (let k = 0; k < 120; k++) {
            for (let i = 0; i < 30; i++) run.step({});
            const p = run.p;
            p.row = r; p.x = colX(c); p.state = 'idle'; p.on = null; p.queue = null; p.t = 0; p.invT = 0;
            const rings = run.rings;
            for (let i = 0; i < 40 && p.state !== 'dead'; i++) { run.step({}); if (run.ev.some((e) => e.k === 'knock' || e.k === 'bump')) shoves++; run.ev.length = 0; }
            if (p.state === 'dead' && p.cause === 'splash') splashes++;
            if (run.rings !== rings || run.phase !== 'play') break;
          }
        }
      }
      t.expect(shoves > 0, 'the probe found shoves (' + shoves + ')');
      t.equal(splashes, 0, 'no shove ended in a splash');
    },
  },
];
