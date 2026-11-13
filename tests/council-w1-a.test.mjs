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
];
