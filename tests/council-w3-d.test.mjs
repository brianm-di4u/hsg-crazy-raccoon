// Council wave 3, batch D: S2-10 (the title fits a phone held sideways) and S4-04 (steam behind the menus, an arrival fade).
import fs from 'node:fs';
import path from 'node:path';

const render = (t, name, seconds, o, wav) => t.page.evaluate(([n, s, w, opt]) => window.__game.audioRender(n, s, w, opt), [name, seconds, !!wav, o || {}]);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const cues = async (t) => (await t.state()).audio.cues;
const gesture = async (t) => { await t.page.mouse.click(3, 3); await t.page.waitForFunction(() => window.__game.getState().audio.started, null, { timeout: 5000 }); };
const waitCue = (t, name, n = 1) => t.page.waitForFunction(([c, k]) => window.__game.getState().audio.cues.filter((x) => x === c).length >= k, [name, n], { timeout: 8000 });
const count = (list, name) => list.filter((x) => x === name).length;
// the cue log keeps the last 80 plays: wait for a cue that came after the latest win stinger
const afterWin = (t, name) => t.page.waitForFunction((n) => { const c = window.__game.getState().audio.cues; return c.lastIndexOf('win') >= 0 && c.lastIndexOf(n) > c.lastIndexOf('win'); }, name, { timeout: 8000 });
const sinceWin = async (t) => { const c = await cues(t); return c.slice(c.lastIndexOf('win')); };
const vibes = (t) => t.page.evaluate(() => window.__vib.slice());
const mockVibrate = () => { window.__vib = []; Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window.__vib.push(p); return true; } }); };
const noVibrate = () => { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined }); };
const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-3', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };

// 16-bit stereo WAV (base64) to mono floats, and a direct-sum energy in a band of frequencies
function samples(b64) {
  const buf = Buffer.from(b64, 'base64'), rate = buf.readUInt32LE(24), n = (buf.length - 44) / 4, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (buf.readInt16LE(44 + i * 4) + buf.readInt16LE(46 + i * 4)) / 65536;
  return { x: out, rate };
}
function bandEnergy({ x, rate }, from, to, f0, f1, step = 10) {
  const a = Math.round(from * rate), b = Math.min(x.length, Math.round(to * rate)); let e = 0;
  for (let f = f0; f <= f1; f += step) { let re = 0, im = 0; for (let i = a; i < b; i++) { const ph = 2 * Math.PI * f * i / rate; re += x[i] * Math.cos(ph); im += x[i] * Math.sin(ph); } e += re * re + im * im; }
  return e;
}
function peakFreq(s, from, to, f0, f1) {
  let best = 0, at = f0;
  for (let f = f0; f <= f1; f += 10) { const e = bandEnergy(s, from, to, f, f, 10); if (e > best) { best = e; at = f; } }
  return at;
}
const zcr = ({ x, rate }, from, to) => { let z = 0; const a = Math.round(from * rate), b = Math.round(to * rate); for (let i = a + 1; i < b; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) z++; return z / (to - from) / 2; };
const firstAbove = ({ x, rate }, level) => { for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > level) return i / rate; return -1; };

const FREQUENT = [['hop', [0, 1]], ['hop', [1, 1]], ['hop', [2, 4]], ['land', ['grass']], ['land', ['wood']], ['land', ['sand']], ['land', ['path']], ['land', ['straw']], ['land', ['back']], ['land', ['wet']],
  ['bump', []], ['pickup', []], ['bank', []], ['chomp', []], ['tele', []], ['splash', []]];
const SURFACES = ['grass', 'wood', 'sand', 'path', 'straw', 'back', 'wet'];

export const tests = [
  // ------------------------------------------------------------------ S2-10 title in landscape
  {
    name: 'S2-10 on a phone held sideways every title button is on screen without scrolling, and a very short screen shows a scroll cue',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const fit = () => t.page.evaluate(() => {
        const bs = [...document.querySelectorAll('.title-wrap button')], root = document.getElementById('screens');
        return { n: bs.length, out: bs.filter((b) => { const r = b.getBoundingClientRect(); return r.top < 0 || r.bottom > innerHeight + 0.5 || r.left < 0 || r.right > innerWidth + 0.5; }).map((b) => b.textContent.trim()), scroll: root.scrollHeight - root.clientHeight, more: root.classList.contains('more'), h: innerHeight };
      });
      await t.page.setViewportSize({ width: 844, height: 390 });
      await t.game('scene', 'title'); await t.waitFrames(4);
      let f = await fit();
      t.expect(f.n >= 7, 'the whole menu is there: ' + f.n + ' buttons');
      t.equal(f.out.length, 0, 'no button outside the 844x390 screen: ' + JSON.stringify(f));
      t.expect(f.scroll <= 1 && !f.more, 'nothing to scroll and no cue: ' + JSON.stringify(f));
      await keep(t, 'S2-10', 'title-landscape');
      await t.page.setViewportSize({ width: 844, height: 250 });
      await t.waitFrames(4);
      f = await fit();
      t.expect(f.scroll > 1 && f.more, 'on a screen too short even so, the title scrolls and says so: ' + JSON.stringify(f));
      t.expect(await t.page.evaluate(() => /scroll for more/.test(getComputedStyle(document.getElementById('screens'), '::after').content)), 'the cue text is drawn');
      await t.page.evaluate(() => { const r = document.getElementById('screens'); r.scrollTop = r.scrollHeight; });
      await t.page.waitForFunction(() => !document.getElementById('screens').classList.contains('more'), null, { timeout: 3000 });
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
      await t.waitFrames(4);
      f = await fit();
      t.expect(!f.more && f.out.length === 0, 'at the normal size the title is as before: ' + JSON.stringify(f));
    },
  },

  // ------------------------------------------------------------------ S4-04 menus move, levels arrive
  {
    name: 'S4-04 spring steam drifts behind the menus, and stays out of it when motion is reduced',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const spy = () => t.page.evaluate(() => { const r = window.__CR.renderer; window.__steams = 0; if (!r.__orig) { r.__orig = r.steam; r.steam = function (...a) { window.__steams++; return r.__orig.apply(this, a); }; } });
      await t.game('setState', { settings: { reducedMotion: false } });
      await t.game('scene', 'map'); await spy();
      await t.page.waitForFunction(() => window.__steams >= 5, null, { timeout: 8000 });
      t.expect(true, 'the steam is drawn every frame on the map');
      await t.waitFrames(6); await keep(t, 'S4-04', 'map-steam');
      await t.game('setState', { settings: { reducedMotion: true } });
      await t.waitFrames(3);
      const before = await t.page.evaluate(() => window.__steams);
      await t.game('scene', 'notebook'); await t.waitFrames(8);
      t.equal(await t.page.evaluate(() => window.__steams), before, 'with reduced motion there is no steam');
      await t.game('setState', { settings: { reducedMotion: null } });
    },
  },
  {
    name: 'S4-04 a level fades up out of the dark when play begins, and not under reduced motion',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('setState', { settings: { reducedMotion: false } });
      await t.game('newGame', { level: 'l1', intro: true });
      await t.waitFrames(2);
      t.equal(await t.page.evaluate(() => window.__CR.renderer.arrive), 0, 'nothing dark while the intro card is up');
      await t.page.click('[data-act="go"]');
      const at = await t.page.evaluate(() => window.__CR.renderer.arrive);
      t.expect(at > 0.3, 'play begins in the dark: ' + at);
      await t.page.waitForFunction(() => window.__CR.renderer.arrive === 0, null, { timeout: 4000 });
      t.expect(true, 'and the dark clears');
      // for the picture, hold the fade a little way in
      await t.page.evaluate(() => { const r = window.__CR.renderer; r.update = () => false; r.arrive = 0.6; window.__CR.kick(); });
      await t.waitFrames(3); await keep(t, 'S4-04', 'arrival');
      await t.reload();
      await t.game('setState', { settings: { reducedMotion: true } });
      await t.game('newGame', { level: 'l1', intro: true }); await t.waitFrames(2);
      await t.page.click('[data-act="go"]');
      t.equal(await t.page.evaluate(() => window.__CR.renderer.arrive), 0, 'reduced motion: no fade');
      await t.game('setState', { settings: { reducedMotion: null } });
    },
  },
];
