// Council wave 3, batch E: S5-17 (voices for the raccoon, the gators and Old Ruthless), S2-14 (the HUD readouts have names),
// S2-23 (a Lure button side setting), S2-04 (a checkpoint says so the first time Bandit lands on it), S2-21 (a short line
// on the title, the full wording in Credits), S4-06 (a level's fact card matches the level; the win panel does not repeat it),
// S4-08 (the Moonlight Run intro does not promise a den).
// Levels are read from window.__game.audioRender, as heard. Statistical checks use the median of several renders; each says
// how likely it is to fail by luck.
import fs from 'node:fs';
import path from 'node:path';

const render = (t, name, seconds, o, wav) => t.page.evaluate(([n, s, w, opt]) => window.__game.audioRender(n, s, w, opt), [name, seconds, !!wav, o || {}]);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const cues = async (t) => (await t.state()).audio.cues;
const gesture = async (t) => { await t.page.mouse.click(3, 3); await t.page.waitForFunction(() => window.__game.getState().audio.started, null, { timeout: 5000 }); };
const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-3', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };
const KEY = 'hsg-crazy-raccoon-v1';
const panelText = (t) => t.page.evaluate(() => (document.querySelector('.panel') || {}).textContent || '');

// 16-bit stereo WAV (base64) to mono floats, and a direct-sum energy in a band of frequencies
function samples(b64) {
  const buf = Buffer.from(b64, 'base64'), rate = buf.readUInt32LE(24), n = (buf.length - 44) / 4, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (buf.readInt16LE(44 + i * 4) + buf.readInt16LE(46 + i * 4)) / 65536;
  return { x: out, rate };
}
function bandEnergy({ x, rate }, from, to, f0, f1, step = 20) {
  const a = Math.round(from * rate), b = Math.min(x.length, Math.round(to * rate)); let e = 0;
  for (let f = f0; f <= f1; f += step) { let re = 0, im = 0; for (let i = a; i < b; i++) { const ph = 2 * Math.PI * f * i / rate; re += x[i] * Math.cos(ph); im += x[i] * Math.sin(ph); } e += re * re + im * im; }
  return e;
}
const rms = ({ x, rate }, from, to) => { let s = 0; const a = Math.round(from * rate), b = Math.min(x.length, Math.round(to * rate)); for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

export const tests = [
  // ------------------------------------------------------------------ S5-17 creature voices
  {
    name: 'S5-17 the chitter, the hiss and the roar are heard between 0.2 and 0.45, and never clip at full volume, alone or on the loudest cues',
    viewports: ['desktop'],
    async run(t) {
      // median of 7 renders per cue on seeds 100..106; the median sits well inside the band, a single play only has to stay inside 0.12 to 0.7
      const out = [];
      for (const name of ['chitter', 'hiss', 'roar']) {
        const peaks = [];
        for (let i = 0; i < 7; i++) peaks.push((await render(t, 'cue:' + name, 1.5, { seed: 100 + i })).peak);
        const med = median(peaks); out.push(`${name} ${med}`);
        t.expect(med >= 0.2 && med <= 0.45, `${name}: median peak ${med} as heard is between 0.2 and 0.45`);
        t.expect(Math.min(...peaks) >= 0.12 && Math.max(...peaks) <= 0.7, `${name}: no single play outside 0.12 to 0.7 (${Math.min(...peaks)} to ${Math.max(...peaks)})`);
        const loud = [];
        for (let i = 0; i < 20; i++) loud.push((await render(t, 'cue:' + name, 1.5, { seed: 300 + i, volume: 1 })).peak);
        t.expect(Math.max(...loud) < 0.95, `${name}: with every volume control at its maximum the loudest of 20 plays is ${Math.max(...loud)}, under 0.95`);
      }
      t.log('as heard at the default volume, median of 7: ' + out.join('; '));
      // the busiest moments they join, at full volume over the loudest music: a bank (chimes and chitter), a jaw warning (pop and
      // hiss), the boss's warning (pop and roar) with a chomp on top
      const together = [[{ name: 'bank' }, { name: 'chitter' }], [{ name: 'tele' }, { name: 'hiss' }], [{ name: 'tele' }, { name: 'roar' }, { name: 'chomp' }]];
      for (const list of together) {
        const peaks = [];
        for (let i = 0; i < 6; i++) peaks.push((await render(t, 'night', 6, { cues: list, cueAt: 2, volume: 1, seed: 500 + i })).peak);
        t.expect(Math.max(...peaks) < 0.95, `${list.map((c) => c.name).join(' + ')} over the night music at full volume peaks at ${Math.max(...peaks)}, under 0.95`);
      }
    },
  },
  {
    name: 'S5-17 each voice sounds like what it is: the chitter is three buzzy bursts, the hiss is bright noise, the roar is low and long',
    viewports: ['desktop'],
    async run(t) {
      const ch = samples((await render(t, 'cue:chitter', 0.6, { seed: 7 }, true)).wav);
      const w = [0, 0.09, 0.18].map((s) => rms(ch, s, s + 0.07));
      t.expect(w.every((v) => v > 0.004), 'three bursts, each audible: ' + w.map((v) => v.toFixed(3)).join(', '));
      t.expect(rms(ch, 0.4, 0.6) < 0.002, 'and then it stops');
      t.expect(bandEnergy(ch, 0, 0.3, 1000, 3000) > 8 * bandEnergy(ch, 0, 0.3, 60, 300), 'its energy sits in the middle and upper band, near 1.8 kHz, not in the bass');
      const hi = samples((await render(t, 'cue:hiss', 0.7, { seed: 7 }, true)).wav);
      t.expect(bandEnergy(hi, 0, 0.4, 3000, 8000, 100) > 20 * bandEnergy(hi, 0, 0.4, 60, 600, 20), 'the hiss is bright: far more above 3 kHz than below 600 Hz');
      t.expect(rms(hi, 0.1, 0.25) > 0.01 && rms(hi, 0.6, 0.7) < 0.003, 'and it lasts about 0.4 s');
      const ro = samples((await render(t, 'cue:roar', 1.2, { seed: 7 }, true)).wav);
      t.expect(bandEnergy(ro, 0.05, 0.8, 40, 250, 5) > 10 * bandEnergy(ro, 0.05, 0.8, 1000, 4000, 100), 'the roar is low: far more below 250 Hz than above 1 kHz');
      t.expect(rms(ro, 0.3, 0.5) > 0.006 && rms(ro, 1.05, 1.2) < 0.003, `it lasts most of a second: ${rms(ro, 0.3, 0.5).toFixed(4)} then ${rms(ro, 1.05, 1.2).toFixed(4)}`);
    },
  },
  {
    name: 'S5-17 banking chitters, a gator\'s jaw warning hisses, and Old Ruthless\'s warning roars',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 5 }); await gesture(t);
      await t.game('pause');
      await t.game('setState', { carry: ['pecan'], player: { row: 5, col: 4 } });
      await t.game('act', 'hop', 'down'); await t.game('step', 40);
      let c = await cues(t);
      t.expect(c.includes('bank') && c.includes('chitter'), 'the bank cue is joined by a chitter: ' + c.slice(-8).join());
      // a gator's jaw warning within four rows of Bandit
      await t.game('newGame', { level: 'l2', seed: 5 }); await t.game('pause');
      await t.game('setState', { player: { row: 6, col: 4 } });
      for (let i = 0; i < 120 && !(await cues(t)).includes('hiss'); i++) await t.game('step', 30);
      c = await cues(t);
      t.expect(c.includes('tele') && c.includes('hiss'), 'a jaw warning hisses: ' + c.slice(-8).join());
      t.expect(!c.includes('roar'), 'and a plain gator does not roar');
      // the boss lane in level 15
      await t.game('newGame', { level: 'l15', seed: 5 }); await t.game('pause');
      const boss = await t.page.evaluate(() => window.__CR.run.world.gators.find((g) => g.k === 'boss').row);
      for (let i = 0; i < 160 && !(await cues(t)).includes('roar'); i++) { await t.game('act', 'warp', boss - 1, 30); }
      t.expect((await cues(t)).includes('roar'), 'Old Ruthless roars when his jaws begin to open');
    },
  },
];
