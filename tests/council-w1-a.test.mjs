// Council wave 1, batch A: stability, saves and lifecycle (S5-19, S6-01, S1-04, S2-17, S6-02, S6-05).

// A scripted AudioContext: starts suspended like a touch browser before user activation, counts every source
// started and every suspend()/resume() call. Runs before the page scripts.
const fakeAudio = () => {
  const log = window.__aud = { sources: 0, resumes: 0, suspends: 0, ctx: null };
  class Node { connect() { return this; } get gain() { return this._g || (this._g = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} }); } get frequency() { return this._f || (this._f = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }); } get Q() { return { value: 0 }; } }
  class Osc extends Node { start() { log.sources++; } stop() {} }
  window.AudioContext = class {
    constructor() {
      log.ctx = this; this.state = log.autorun ? 'running' : 'suspended'; this.sampleRate = 8000; this.destination = new Node(); this._t = 0; this._at = performance.now(); this.onstatechange = null;
    }
    get currentTime() { return this.state === 'running' ? this._t + (performance.now() - this._at) / 1000 : this._t; }
    _set(s) { if (this.state === 'running') this._t = this.currentTime; this.state = s; this._at = performance.now(); if (this.onstatechange) this.onstatechange(); }
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); } createOscillator() { return new Osc(); }
    createBufferSource() { return new Osc(); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    resume() { log.resumes++; if (!log.refuse) this._set('running'); return Promise.resolve(); }
    suspend() { log.suspends++; this._set('suspended'); return Promise.resolve(); }
  };
};
const aud = (t) => t.page.evaluate(() => ({ sources: window.__aud.sources, resumes: window.__aud.resumes, suspends: window.__aud.suspends, state: window.__aud.ctx && window.__aud.ctx.state }));
const hidden = (t, h) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);

export const tests = [
  {
    name: 'S5-19 audio retries resume on pointerup, click and touchend until the context runs',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      await t.page.evaluate(() => { window.__aud.refuse = true; });
      await t.page.dispatchEvent('body', 'pointerdown');
      let a = await aud(t);
      t.expect(a.state === 'suspended', 'context created suspended by the first press');
      await t.page.dispatchEvent('body', 'pointerup');
      await t.page.dispatchEvent('body', 'touchend');
      await t.page.dispatchEvent('body', 'click');
      const refused = await aud(t);
      t.expect(refused.resumes >= 3, 'each later gesture asks the context to resume again (got ' + refused.resumes + ')');
      t.equal(refused.state, 'suspended', 'still suspended while the browser refuses');
      await t.page.evaluate(() => { window.__aud.refuse = false; });
      await t.page.dispatchEvent('body', 'pointerup');
      a = await aud(t);
      t.equal(a.state, 'running', 'a gesture the browser accepts starts the context');
      t.equal((await t.state()).audio.ctx, 'running', 'audioState reports it running');
    },
  },
  {
    name: 'S5-19 music restarts when an interrupted context returns to running',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      await t.game('newGame', { level: 'l1' });
      await t.page.dispatchEvent('body', 'pointerup');
      await t.page.dispatchEvent('body', 'pointerdown');
      await t.page.waitForTimeout(300);
      const before = (await aud(t)).sources;
      t.expect(before > 0, 'music is playing once running');
      await t.page.evaluate(() => window.__aud.ctx._set('interrupted'));
      await t.page.waitForTimeout(400);
      const mid = (await aud(t)).sources;
      await t.page.dispatchEvent('body', 'click');
      await t.page.waitForTimeout(400);
      const after = (await aud(t)).sources;
      t.equal((await aud(t)).state, 'running', 'a click resumes the interrupted context');
      t.expect(after > mid, 'the sequencer keeps scheduling after it returns to running');
    },
  },
  {
    name: 'S6-01 music stops while paused and while the tab is hidden, and comes back',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      await t.game('newGame', { level: 'l1' });
      await t.page.dispatchEvent('body', 'pointerdown');
      await t.page.dispatchEvent('body', 'pointerup');
      await t.page.waitForTimeout(300);
      t.expect((await aud(t)).sources > 0, 'music plays while the game runs');
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      t.equal((await t.state()).screen, 'pause', 'paused');
      await t.page.waitForTimeout(300);
      const p0 = (await aud(t)).sources;
      await t.page.waitForTimeout(800);
      t.equal((await aud(t)).sources, p0, 'no audio sources start while the pause panel is up');
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      await t.page.waitForTimeout(400);
      t.expect((await aud(t)).sources > p0, 'music resumes with the game');
      await hidden(t, true);
      await t.page.waitForTimeout(300);
      const h = await aud(t);
      t.equal(h.state, 'suspended', 'context suspended while the tab is hidden');
      t.expect(h.suspends >= 1, 'suspend() called');
      await t.page.waitForTimeout(600);
      t.equal((await aud(t)).sources, h.sources, 'no sources while hidden');
      await hidden(t, false);
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      await t.page.waitForTimeout(500);
      const v = await aud(t);
      t.equal(v.state, 'running', 'context running again after the tab returns and the game resumes');
      t.expect(v.sources > h.sources, 'music plays again');
    },
  },
  {
    name: 'S6-01 a throttled timer does not release a clump of past-due notes',
    viewports: ['desktop'],
    initScript: fakeAudio,
    async run(t) {
      await t.page.evaluate(() => { window.__aud.autorun = true; });
      await t.game('newGame', { level: 'l1' });
      await t.page.dispatchEvent('body', 'pointerdown');
      await t.page.dispatchEvent('body', 'pointerup');
      await t.page.waitForTimeout(300);
      t.expect((await aud(t)).sources > 0, 'music is playing before the stall');
      // freeze the page's timers for 3 s the way a background tab does, while the audio clock keeps running
      await t.page.evaluate(() => { const end = performance.now() + 3000; while (performance.now() < end); window.__aud.mark = window.__aud.sources; });
      await t.page.waitForTimeout(200);
      const burst = await t.page.evaluate(() => window.__aud.sources - window.__aud.mark);
      t.expect(burst < 20, 'catch-up burst after a 3 s stall is small (got ' + burst + ' sources)');
    },
  },
  {
    name: 'S1-04 a hop pressed during a bump or a fling is kept and fires afterwards',
    node: true,
    async run(t) {
      const { makePlayer, stepPlayer } = await import('../src/js/sim/player.js');
      const { DT, BUMP_T, FLING_T, colX } = await import('../src/js/sim/const.js');
      const level = { rows: [{ t: 'ground' }, { t: 'fence', gaps: [] }, { t: 'ground' }, { t: 'ground' }] };
      const world = { gators: [] };
      const stepsFor = (secs) => Math.ceil(secs / DT) + 2;

      // bump: up into a closed fence, then a sideways retry 83 ms in (the seat-1 probe)
      let p = makePlayer(level), ev = [];
      stepPlayer(p, world, level, { hop: 'up' }, ev);
      t.equal(p.state, 'bump', 'the blocked hop bumps');
      for (let i = 0; i < 10; i++) stepPlayer(p, world, level, {}, ev);
      stepPlayer(p, world, level, { hop: 'left' }, ev);
      t.expect(p.state === 'bump' || p.state === 'hop', 'still wiggling or already hopping');
      for (let i = 0; i < stepsFor(BUMP_T) && p.state !== 'hop'; i++) stepPlayer(p, world, level, {}, ev);
      t.equal(p.state, 'hop', 'the queued hop starts when the bump ends');
      t.equal(p.facing, 'left', 'in the direction pressed');
      t.equal(p.to.x, colX(3), 'one column to the left');

      // fling: a hop pressed mid-flight starts on landing
      p = makePlayer(level); ev = [];
      p.row = 0; p.from = { row: 0, x: p.x }; p.to = { row: 2, x: p.x }; p.state = 'fling'; p.t = 0;
      stepPlayer(p, world, level, { hop: 'left' }, ev);
      for (let i = 0; i < stepsFor(FLING_T) && p.state === 'fling'; i++) stepPlayer(p, world, level, {}, ev);
      t.equal(p.row, 2, 'the fling lands');
      t.equal(p.state, 'hop', 'the hop pressed during the fling starts on landing');
      t.equal(p.facing, 'left', 'facing the pressed direction');
    },
  },
  {
    name: 'S2-17 quitting a Moonlight Run from Pause asks first',
    async run(t) {
      await t.game('newGame', { mode: 'endless' });
      await t.game('pause');
      await t.game('scene', 'pause');
      t.equal((await t.state()).screen, 'pause', 'pause panel up');
      await t.page.click('[data-act="quit"]');
      let s = await t.state();
      t.equal(s.screen, 'confirmQuit', 'Quit to title opens a confirm');
      t.equal(s.scene, 'play', 'the run is still there behind it');
      await t.shot('s2-17-confirm');
      await t.checkLayout();
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      s = await t.state();
      t.equal(s.screen, 'pause', 'Esc keeps the run and returns to Pause');
      await t.page.click('[data-act="quit"]');
      await t.page.click('[data-act="back"]');
      t.equal((await t.state()).screen, 'pause', 'Keep running returns to Pause');
      await t.page.click('[data-act="quit"]');
      await t.page.click('[data-act="quitYes"]');
      s = await t.state();
      t.equal(s.scene, 'title', 'Leave goes to the title');
      t.equal(s.run, null, 'the run is gone');
    },
  },
  {
    name: 'S6-02 a frame exception leaves a way out: Reload and Back to title',
    allowConsoleErrors: true,
    async run(t) {
      await t.page.evaluate(() => { const r = window.__CR.renderer; window.__origDraw = r.draw; r.draw = () => { throw new Error('boom-secret-detail'); }; });
      await t.game('newGame', { level: 'l1' });
      await t.page.waitForSelector('#boot-error:not([hidden])');
      const txt = await t.page.$eval('#boot-error', (e) => e.textContent);
      t.expect(!txt.includes('boom-secret-detail'), 'the raw exception message is not shown to the player');
      t.equal(await t.page.$$eval('#boot-error button', (b) => b.map((x) => x.textContent).join('|')), 'Reload|Back to title', 'two actions offered');
      await t.shot('s6-02-error');
      await t.checkLayout();
      await t.page.evaluate(() => { window.__CR.renderer.draw = window.__origDraw; });
      await t.page.click('#boot-error button:nth-of-type(2)');
      await t.waitFrames(3);
      const s = await t.state();
      t.equal(s.scene, 'title', 'back on the title scene');
      t.equal(s.screen, 'title', 'with a live menu');
      t.expect(await t.page.$eval('#boot-error', (e) => e.hidden), 'the banner is gone');
      await t.game('newGame', { level: 'l1' });
      t.equal((await t.state()).scene, 'play', 'a new level starts normally afterwards');
    },
  },
  {
    name: 'S6-02 an unhandled promise rejection shows the same recovery banner',
    viewports: ['desktop'],
    allowConsoleErrors: true,
    async run(t) {
      await t.page.evaluate(() => { Promise.reject(new Error('late-failure')); });
      await t.page.waitForSelector('#boot-error:not([hidden])');
      t.equal(await t.page.$$eval('#boot-error button', (b) => b.length), 2, 'recovery buttons present');
    },
  },
  {
    name: 'S6-05 the save loader repairs wrong-typed fields',
    node: true,
    async run(t) {
      const KEY = 'hsg-crazy-raccoon-v1';
      const { loadSave, writeSave } = await import('../src/js/save.js');
      const store = new Map();
      globalThis.window = { localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } };
      const load = (patch) => { store.set(KEY, JSON.stringify({ v: 1, ...patch })); return loadSave(); };
      const good = { stars: [true, false, true], best: 900, bestT: 12.5, ball: true };
      let s;
      for (const bad of ['oops', null, 7, [1, 2]]) { s = load({ progress: bad }); t.expect(s.progress && typeof s.progress === 'object' && !Array.isArray(s.progress), 'progress ' + JSON.stringify(bad) + ' becomes an object'); }
      s = load({ progress: { l1: 'x', l2: null, l3: { stars: 'abc', best: 'high', bestT: 'fast' }, l4: good } });
      t.equal(s.progress.l1, undefined, 'a non-object progress entry is dropped');
      t.equal(s.progress.l2, undefined, 'a null progress entry is dropped');
      t.equal(JSON.stringify(s.progress.l3), JSON.stringify({ stars: [false, false, false], best: 0, bestT: null, ball: false }), 'bad entry fields get safe values');
      t.equal(JSON.stringify(s.progress.l4), JSON.stringify(good), 'a good entry is untouched');
      for (const bad of ['text', null, 5, { a: 1 }]) { s = load({ notebook: bad }); t.expect(Array.isArray(s.notebook), 'notebook ' + JSON.stringify(bad) + ' becomes an array'); }
      s = load({ notebook: ['hs-1', 7, null, 'hs-2'] });
      t.equal(s.notebook.join(), 'hs-1,hs-2', 'non-string notebook ids are dropped');
      for (const bad of ['text', null, 5]) { s = load({ endless: { unlocked: true, top: bad } }); t.expect(Array.isArray(s.endless.top), 'endless.top ' + JSON.stringify(bad) + ' becomes an array'); }
      s = load({ endless: { top: [{ initials: 'ABC', score: 50, rows: 4, date: '2026-01-01' }, { initials: 'NOS' }, { score: 'x', initials: 'BAD' }, 'zzz', null] } });
      t.equal(s.endless.top.length, 1, 'score entries without a finite score and initials are dropped');
      t.equal(s.endless.top[0].score, 50, 'the good score entry is kept');
      s = load({ endless: 'nope', stats: 'nope', settings: 'nope' });
      t.expect(object(s.endless) && Array.isArray(s.endless.top) && object(s.stats) && object(s.settings), 'string sections fall back to defaults');
      t.equal(s.settings.sound, true, 'and do not spread into characters');
      s = load({ unlocked: 99 }); t.equal(s.unlocked, 15, 'unlocked above 15 is clamped');
      s = load({ unlocked: 'many' }); t.equal(s.unlocked, 1, 'a non-number unlocked becomes 1');
      s = load({ unlocked: 0 }); t.equal(s.unlocked, 1, 'unlocked below 1 is clamped');
      s = load({ unlocked: 3.7 }); t.equal(s.unlocked, 3, 'unlocked is an integer');
      s = load({ settings: { volume: 50 } }); t.equal(s.settings.volume, 1, 'volume above 1 is clamped');
      s = load({ settings: { volume: -2 } }); t.equal(s.settings.volume, 0, 'volume below 0 is clamped');
      s = load({ settings: { volume: 'loud' } }); t.equal(s.settings.volume, 0.5, 'non-number volume falls back');
      s = load({ settings: { textScale: 0 } }); t.equal(s.settings.textScale, 1, 'textScale 0 becomes 1');
      s = load({ settings: { textScale: 1e9 } }); t.equal(s.settings.textScale, 1, 'textScale 1e9 becomes 1');
      s = load({ settings: { textScale: 1.25 } }); t.equal(s.settings.textScale, 1.25, 'a listed textScale is kept');
      s = load({ progress: 'oops', notebook: null, endless: { top: 'x' } });
      t.equal(writeSave(s), true, 'a repaired save writes back');
      t.equal(JSON.parse(store.get(KEY)).progress.constructor, Object, 'and the stored value is repaired');
      function object(v) { return v && typeof v === 'object' && !Array.isArray(v); }
    },
  },
  {
    name: 'S6-05 a corrupt stored save no longer breaks a level clear or the scores screen',
    viewports: ['desktop'],
    initScript: () => {
      localStorage.setItem('hsg-crazy-raccoon-v1', JSON.stringify({ v: 1, progress: 'oops', notebook: null, unlocked: '4', settings: { volume: 50, textScale: 0 }, endless: { unlocked: true, top: 'x' } }));
    },
    async run(t) {
      await t.game('scene', 'scores');
      t.equal((await t.state()).screen, 'scores', 'the scores screen opens');
      await t.game('scene', 'win');
      const s = await t.state();
      t.equal(s.screen, 'win', 'clearing a level reaches the results screen');
      t.expect(s.save.progress.l1 && s.save.progress.l1.stars.length === 3, 'progress was recorded');
      t.expect(s.settings.volume <= 1 && s.settings.textScale === 1, 'settings are in range');
    },
  },
];
