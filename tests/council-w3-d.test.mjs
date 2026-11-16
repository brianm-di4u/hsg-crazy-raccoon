// Council wave 3, batch D: sound and touch. CL-01 (the cues clear of the music, measured as heard, and nothing clips at full
// volume), S5-03 (the whole mix is louder, through a limiter), S5-04 (cues differ from play to play, the landing sounds
// like the surface), S5-10 (refused, back and confirm sound different), S5-15 (swept and caught have their own sounds),
// S5-16 (new best, par and fact-card cues), S5-21 (the streak is folded into the hop and no longer sits on it),
// S3-13 (haptics), S2-10 (the title fits a phone held sideways), S4-04 (steam behind the menus, an arrival fade).
// Levels are read from window.__game.audioRender, which renders through the master gain and limiter the player hears.
// Statistical checks use the median of several renders; each says how likely it is to fail by luck.
import fs from 'node:fs';
import path from 'node:path';

const render = (t, name, seconds, o, wav) => t.page.evaluate(([n, s, w, opt]) => window.__game.audioRender(n, s, w, opt), [name, seconds, !!wav, o || {}]);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const cues = async (t) => (await t.state()).audio.cues;
const gesture = async (t) => { await t.page.mouse.click(3, 3); await t.page.waitForFunction(() => window.__game.getState().audio.started, null, { timeout: 5000 }); };
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
  // ------------------------------------------------------------------ CL-01 / S5-03 levels as heard
  {
    name: 'CL-01 the cues heard most sit between 0.2 and 0.45 as heard and clearly above the loudest music; the music and beds stay in their bands',
    viewports: ['desktop'],
    async run(t) {
      // The music renders on a fixed seed, so its peak is the same every run. The cues do not: the noise in a cue starts at a random
      // place in a looping buffer and the seed does not reach it, so plays of the same cue differ (C4-04: 200 plays of each cue on the
      // real GPU, single plays from 0.15 to 0.56, the middle 80 percent of every cue inside 0.20 to 0.44). A median of 7 plays left the
      // band by luck about 1 run in 700 (hop 2,4) and 1 in 200 (land path, before its trim) with 60 plays measured; so the median is of
      // 15, which leaves the band only if 8 of 15 plays do. The most spread cue (hop 2,4) puts about 9 percent of single plays under 0.2:
      // C(15,8) x 0.09^8 x 0.91^7 is 1.5 in 100,000, the other cues far less, all sixteen together about 2 in 100,000. A single play
      // only has to stay inside 0.12 to 0.7 (the extremes over 3,200 plays were 0.147 and 0.561).
      let loud = 0;
      for (const m of ['title', 'map', 'day', 'noon', 'barn', 'night', 'results']) { const r = await render(t, m, 30); loud = Math.max(loud, r.peak); t.expect(r.peak >= 0.06 && r.peak <= 0.16, `music ${m} peak ${r.peak} as heard is between 0.06 and 0.16`); }
      const out = [];
      for (const [name, args] of FREQUENT) {
        const peaks = [];
        for (let i = 0; i < 15; i++) peaks.push((await render(t, 'cue:' + name, 1.5, { args, seed: 100 + i })).peak);
        const med = median(peaks);
        out.push(`${name}${args.length ? ':' + args.join(',') : ''} ${med}`);
        t.expect(med >= 0.2 && med <= 0.45, `${name} ${args.join(',')}: median peak ${med} is between 0.2 and 0.45`);
        t.expect(Math.min(...peaks) >= 0.12 && Math.max(...peaks) <= 0.7, `${name} ${args.join(',')}: no single play outside 0.12 to 0.7 (${Math.min(...peaks)} to ${Math.max(...peaks)})`);
        t.expect(med >= loud * 1.3, `${name}: median ${med} is clearly above the loudest music ${loud}`);
      }
      t.log('as heard at the default volume, median of 15: ' + out.join('; ') + `; loudest music ${loud}`);
      for (const b of ['meadow', 'showground', 'loft', 'midnight']) {
        const r = await render(t, b, 30);
        t.expect(r.peak < 0.07 && r.rmsDb >= -52 && r.rmsDb <= -38 && r.longestSilence <= 2, `bed ${b}: peak ${r.peak}, RMS ${r.rmsDb} dBFS as heard`);
      }
    },
  },
  {
    name: 'CL-01 every other cue is heard between 0.2 and 0.45 too',
    viewports: ['desktop'],
    async run(t) {
      // Same reasoning as above: every nominal peak here is 0.24 or more, so the 1.5 dB jitter cannot bring a median of 5 under 0.2.
      const spec = [['whip', []], ['cap', []], ['wash', []], ['lure', []], ['feed', []], ['sweep', []], ['hum', []], ['spotted', []], ['streak', [2]], ['streak', [8]], ['nudge', []], ['ball', []], ['menu', []], ['back', []],
        ['denied', []], ['win', []], ['fail', []], ['star', [0]], ['star', [2]], ['best', []], ['par', []], ['fact', []], ['ach', []]];
      const out = [];
      for (const [name, args] of spec) {
        const peaks = [];
        for (let i = 0; i < 5; i++) peaks.push((await render(t, 'cue:' + name, 2.5, { args, seed: 200 + i })).peak);
        const med = median(peaks);
        out.push(`${name}${args.length ? ':' + args.join(',') : ''} ${med}`);
        t.expect(med >= 0.2 && med <= 0.45, `${name} ${args.join(',')}: median peak ${med} is between 0.2 and 0.45`);
        t.expect(Math.min(...peaks) >= 0.12 && Math.max(...peaks) <= 0.7, `${name}: no single play outside 0.12 to 0.7`);
      }
      const fin = await render(t, 'cue:finale', 5.5);
      t.expect(fin.peak >= 0.2 && fin.peak <= 0.45, `the ending stinger peak ${fin.peak}`);
      t.log('as heard: ' + out.join('; '));
    },
  },
  {
    name: 'CL-01 nothing clips with the volume at its maximum: the busiest moment and 20 plays of every loud cue stay under 0.95',
    viewports: ['desktop'],
    async run(t) {
      // Volume 1 is higher than the Settings control offers (High is 0.85): the hardest case a hand-edited save can reach.
      // The cues' random gain (1.5 dB) and detune move the peak, so this does not depend on a lucky draw: the soft clip tops out at 0.80
      // and the oversampling rings about 14 percent above that, so the worst of 320 renders of the busiest moment was 0.911, under 0.95.
      const worst = [];
      const busy = [{ name: 'finale' }, { name: 'ach' }, { name: 'chomp' }, { name: 'splash' }, { name: 'hop', args: [0, 4] }, { name: 'land', args: ['back'] }, { name: 'bank' }, { name: 'win' }, { name: 'best' }, { name: 'par' }, { name: 'streak', args: [8] }, { name: 'whip' }];
      for (const [piece, intensity] of [['barn', 1], ['title', 0], ['night', 1], ['noon', 1]]) {
        for (const volume of [0.85, 1]) {
          const r = await render(t, piece, 9, { volume, intensity, cues: busy, cueAt: 4, params: { tension: 1, crowd: 1 } });
          worst.push(r.peak);
          t.expect(r.peak < 0.95, `${piece} with every loud cue at once at volume ${volume}: peak ${r.peak} is under 0.95`);
        }
      }
      const bed = await render(t, 'showground', 9, { volume: 1, cues: busy, cueAt: 4, params: { tension: 1, crowd: 1 } });
      t.expect(bed.peak < 0.95, `a bed with the same cues at volume 1: peak ${bed.peak}`);
      let top = 0;
      for (const name of ['finale', 'ach', 'chomp', 'splash', 'win', 'best', 'par', 'whip']) {
        for (let i = 0; i < 20; i++) { const r = await render(t, 'cue:' + name, name === 'finale' ? 5.5 : 2.5, { volume: 1, seed: 300 + i }); top = Math.max(top, r.peak); t.expect(r.peak < 0.95, `${name} play ${i} at volume 1: peak ${r.peak}`); }
      }
      t.log(`busiest mixes at 0.85 and 1: ${worst.join(', ')}; loudest single cue play at volume 1: ${top}`);
    },
  },

  // ------------------------------------------------------------------ S5-04 / S5-21 the cues themselves
  {
    name: 'S5-04 two plays of a cue differ, the hop has a second layer, and each surface sounds different underfoot',
    viewports: ['desktop'],
    async run(t) {
      // Gain varies by up to 1.5 dB either way: nine plays all within 0.4 dB of each other would happen about 1 time in 200000.
      const peaks = [];
      for (let i = 0; i < 9; i++) peaks.push((await render(t, 'cue:hop', 0.5, { args: [0, 1], seed: 7 })).peak);
      const spread = 20 * Math.log10(Math.max(...peaks) / Math.min(...peaks));
      t.expect(spread >= 0.4, `nine plays of the hop with the same noise differ by ${spread.toFixed(2)} dB (at least 0.4)`);
      const hop = samples((await render(t, 'cue:hop', 0.3, { args: [0, 1], seed: 3 }, true)).wav);
      const base = bandEnergy(hop, 0.004, 0.05, 450, 950), upper = bandEnergy(hop, 0.004, 0.05, 1000, 1400);
      t.expect(upper >= 0.03 * base, `the hop has a second voice above the first (upper band ${(upper / base).toFixed(3)} of the lower, at least 0.03)`);
      // each surface: how fast the waveform crosses zero over the first 0.12 s, and when it falls quiet
      const feat = {};
      for (const s of SURFACES) {
        const w = samples((await render(t, 'cue:land', 0.4, { args: [s], seed: 5 }, true)).wav);
        let last = 0; for (let i = 0; i < w.x.length; i++) if (Math.abs(w.x[i]) > 0.03) last = i / w.rate;
        feat[s] = { z: Math.round(zcr(w, 0, 0.12)), end: +last.toFixed(3) };
      }
      t.log('landing features: ' + JSON.stringify(feat));
      const keys = SURFACES, zs = keys.map((k) => feat[k].z);
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
        const a = feat[keys[i]], b = feat[keys[j]];
        t.expect(Math.abs(a.z - b.z) / Math.max(a.z, b.z) >= 0.12 || Math.abs(a.end - b.end) >= 0.04, `${keys[i]} and ${keys[j]} sound different: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      }
      t.expect(Math.max(...zs) / Math.min(...zs) > 4, 'from a low thud to a bright shaker the surfaces span a wide range of brightness');
    },
  },
  {
    name: 'S5-21 the streak rides on the hop pitch, is capped, and comes a beat after the landing instead of on top of the hop',
    viewports: ['desktop'],
    async run(t) {
      // A streak of 4 lifts the hop by 1.05^3 (about 16 percent); the peak finder is within one 10 Hz step.
      const lo = samples((await render(t, 'cue:hop', 0.3, { args: [0, 1], seed: 3 }, true)).wav), hi = samples((await render(t, 'cue:hop', 0.3, { args: [0, 4], seed: 3 }, true)).wav);
      const f1 = peakFreq(lo, 0.004, 0.03, 400, 1100), f4 = peakFreq(hi, 0.004, 0.03, 400, 1100);
      t.expect(f4 / f1 > 1.08 && f4 / f1 < 1.25, `a streak of 4 raises the hop pitch (${f1} Hz to ${f4} Hz)`);
      const cap8 = samples((await render(t, 'cue:streak', 0.8, { args: [8], seed: 3 }, true)).wav), cap30 = samples((await render(t, 'cue:streak', 0.8, { args: [30], seed: 3 }, true)).wav);
      const g8 = peakFreq(cap8, 0.09, 0.2, 800, 4000), g30 = peakFreq(cap30, 0.09, 0.2, 800, 4000);
      t.expect(Math.abs(g8 - g30) / g8 < 0.06, `the streak input is capped at 8: 8 gives ${g8} Hz and 30 gives ${g30} Hz (detune is under 1.5 percent)`);
      t.expect(g8 < 2000, `and the top of the streak is ${g8} Hz, not the harsh 2.5 kHz of the old uncapped cue`);
      const early = firstAbove(samples((await render(t, 'cue:streak', 0.8, { args: [4], seed: 3 }, true)).wav), 0.01);
      t.expect(early >= 0.07, `the streak ping starts ${early} s into the cue, after the hop and landing sounds, not with them`);
    },
  },

  // ------------------------------------------------------------------ routing in the game: landings, deaths, rewards, menus
  {
    name: 'S5-04 a landing plays the sound of what Bandit landed on, a gator back included',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      await t.game('newGame', { level: 'l1' }); await t.game('pause');
      const wanted = { grass: 'grass', start: 'grass', boardwalk: 'wood', fence: 'wood', sand: 'sand', path: 'path', straw: 'straw' };
      for (const [row, surface] of Object.entries(wanted)) {
        const before = count(await cues(t), 'land:' + surface);
        await t.page.evaluate(([type]) => { const r = window.__CR.run; r.L.rows[3].t = type; r.ev.push({ k: 'land', row: 3, x: 100, fwd: true, ground: true }); }, [row]);
        await t.game('step', 1);
        t.equal(count(await cues(t), 'land:' + surface), before + 1, `a ${row} row sounds like ${surface}`);
      }
      await t.page.evaluate(() => { const r = window.__CR.run; r.ev.push({ k: 'land', row: 3, x: 100, fwd: true, ride: 1 }); });
      await t.game('step', 1);
      t.expect((await cues(t)).includes('land:back'), 'riding a gator back is no longer silent: it knocks');
      await t.page.evaluate(() => { const r = window.__CR.run; r.ev.push({ k: 'land', row: 3, x: 100, fwd: true, pool: true, ground: true }); });
      await t.game('step', 1);
      t.expect((await cues(t)).includes('land:wet'), 'a spring pool is wet');
    },
  },
  {
    name: 'S5-15 swept away and caught by the lantern have their own sounds, and Help names the warning pop',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await gesture(t);
      await t.game('newGame', { level: 'l1' }); await t.game('pause');
      const die = async (cause) => {
        await t.page.evaluate((c) => { const r = window.__CR.run; r.ev.push({ k: 'die', cause: c, x: r.p.x, row: r.p.row }); }, cause);
        await t.game('step', 1);
        return (await cues(t)).slice(-1)[0];
      };
      t.equal(await die('swept'), 'sweep', 'swept away: a rush of current');
      t.equal(await die('caught'), 'hum', 'caught by the lantern: a hum');
      t.equal(await die('spotted'), 'spotted', 'spotted by the flashlight keeps its pings');
      t.equal(await die('splash'), 'splash', 'splash keeps the splash');
      t.equal(await die('chomp'), 'chomp', 'chomp keeps the chomp');
      await t.game('scene', 'help'); await t.waitFrames(3);
      const txt = await t.page.evaluate(() => document.querySelector('.panel').textContent.replace(/\s+/g, ' '));
      t.expect(/Listen for the warning pop before a gator bites\./.test(txt), 'Help has the line about the warning pop');
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S5-15', 'help-sound');
    },
  },
  {
    name: 'S5-16 a first clear plays the new-best and fact-card cues, the par star its own, and a repeat clear has no new-best cue',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      await t.game('act', 'clearSave');
      await t.game('scene', 'win');
      await afterWin(t, 'fact');
      let c = await sinceWin(t);
      t.equal(count(c, 'best'), 1, 'one new-best cue after the win stinger: ' + c.join(' '));
      t.expect(c.includes('par'), 'the par star has its own cue: ' + c.join(' '));
      t.expect(c.indexOf('best') > c.indexOf('par') && c.indexOf('fact') > c.indexOf('best'), 'in order: the stars, then the new best, then the fact card');
      await t.game('scene', 'win');
      await afterWin(t, 'fact');
      c = await sinceWin(t);
      t.equal(count(c, 'best'), 0, 'a clear that beats nothing has no new-best cue: ' + c.join(' '));
    },
  },
  {
    name: 'S5-10 a refused press sounds refused, going back sounds lower, and a setting clicks after it has been applied',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('act', 'clearSave');
      await t.game('scene', 'title'); await t.waitFrames(3);
      await gesture(t);
      await t.page.click('[data-act="endless"]');
      t.equal((await cues(t)).slice(-1)[0], 'denied', 'the locked Moonlight Run answers with the refusal thud, not the menu click');
      await t.page.click('[data-act="daily"]');
      t.equal((await cues(t)).slice(-1)[0], 'denied', 'so does the Daily Run');
      await t.page.click('[data-act="settings"]');
      t.equal((await cues(t)).slice(-1)[0], 'menu', 'Settings: the ordinary click');
      await t.page.click('[data-act="set"][data-k="volume"][data-v="0.85"]');
      const a = (await t.state()).audio;
      t.equal(a.cues.slice(-1)[0], 'menu', 'a setting clicks');
      t.equal(a.cueVol, 0.85, 'at the volume it has just set, not the old one');
      await t.page.click('[data-act="back"]');
      t.equal((await cues(t)).slice(-1)[0], 'back', 'Done: the lower back tone');
      await t.game('act', 'unlockAll');
      await t.game('scene', 'title'); await t.waitFrames(3);
      await t.page.click('[data-act="help"]');
      await t.page.click('[data-act="back"]');
      t.equal((await cues(t)).slice(-2).join(' '), 'menu back', 'Help then Back: menu, back');
    },
  },
  {
    name: 'S5-10 the refusal, back and menu cues are three different sounds',
    viewports: ['desktop'],
    async run(t) {
      const f = {};
      for (const n of ['menu', 'back', 'denied']) { const w = samples((await render(t, 'cue:' + n, 0.4, { seed: 9 }, true)).wav); f[n] = { z: Math.round(zcr(w, 0, 0.1)), peak: peakFreq(w, 0.005, 0.06, 80, 2500) }; }
      t.log(JSON.stringify(f));
      t.expect(f.denied.peak < 250 && f.back.peak > 400 && f.back.peak < 800 && f.menu.peak > 900, `refused is a low thud, back sits lower than the menu click: ${JSON.stringify(f)}`);
    },
  },

  // ------------------------------------------------------------------ S3-13 haptics
  {
    name: 'S3-13 landings, bites, banking and wins buzz where the browser can, and the Vibration setting and reduced motion switch it off',
    viewports: ['desktop', 'mobile'],
    initScript: mockVibrate,
    async run(t) {
      await t.game('newGame', { level: 'l1' }); await t.game('pause');
      await t.page.evaluate(() => { const r = window.__CR.run; r.ev.push({ k: 'land', row: 1, x: 100, fwd: true, ground: true }); });
      await t.game('step', 1);
      t.equal(JSON.stringify(await vibes(t)), '[10]', 'a landing is a 10 ms pulse');
      await t.page.evaluate(() => { const r = window.__CR.run; r.ev.push({ k: 'die', cause: 'chomp', x: r.p.x, row: r.p.row }, { k: 'bank', n: 1, pts: 10 }); });
      await t.game('step', 1);
      t.equal(JSON.stringify(await vibes(t)), '[10,25,[15,30,15]]', 'a bite is a 25 ms pulse and a bank is three short ones');
      await t.page.evaluate(() => { window.__CR.run.ev.push({ k: 'win' }); });
      await t.game('step', 1);
      t.equal(JSON.stringify((await vibes(t)).slice(-1)[0]), '[20,40,20,40,25]', 'a win is a longer pattern');
      await t.game('setState', { settings: { vibration: false } });
      await t.page.evaluate(() => { window.__vib.length = 0; window.__CR.run.ev.push({ k: 'land', row: 1, x: 100, fwd: true, ground: true }); });
      await t.game('step', 1);
      t.equal((await vibes(t)).length, 0, 'with Vibration off nothing buzzes');
      await t.game('setState', { settings: { vibration: true, reducedMotion: true } });
      await t.page.evaluate(() => { window.__CR.run.ev.push({ k: 'land', row: 1, x: 100, fwd: true, ground: true }); });
      await t.game('step', 1);
      t.equal((await vibes(t)).length, 0, 'with reduced motion nothing buzzes');
      await t.game('setState', { settings: { reducedMotion: null } });
    },
  },
  {
    name: 'S3-13 a real hop buzzes when it lands, and Sound off does not silence the buzz',
    viewports: ['mobile'],
    initScript: mockVibrate,
    async run(t) {
      await t.game('setState', { settings: { sound: false } });
      await t.game('newGame', { level: 'l1' }); await t.game('pause');
      await t.game('act', 'hop', 'up');
      await t.game('step', 40);
      t.expect((await vibes(t)).includes(10), 'the landing after a hop pulsed: ' + JSON.stringify(await vibes(t)));
      await t.game('setState', { settings: { sound: true } });
    },
  },
  {
    name: 'S3-13 Settings has a Vibration row where the browser can vibrate, saved with the settings, and none where it cannot',
    viewports: ['desktop', 'mobile'],
    initScript: mockVibrate,
    async run(t) {
      await t.game('scene', 'settings'); await t.waitFrames(3);
      const row = () => t.page.evaluate(() => [...document.querySelectorAll('.field')].find((f) => /Vibration/.test(f.textContent)) ? [...document.querySelectorAll('[data-k="vibration"]')].map((b) => b.getAttribute('aria-pressed')).join() : null);
      t.equal(await row(), 'true,false', 'the row is there and starts On');
      await t.page.click('[data-k="vibration"][data-v="false"]');
      t.equal((await t.state()).settings.vibration, false, 'Off is kept');
      await t.reload();
      t.equal((await t.state()).settings.vibration, false, 'and survives a reload');
      await t.game('setState', { settings: { vibration: true } });
      await t.game('scene', 'settings'); await t.waitFrames(3);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S3-13', 'settings-vibration');
    },
  },
  {
    name: 'S3-13 where the browser has no vibrate there is no Vibration row, and the game plays on',
    viewports: ['desktop'],
    initScript: noVibrate,
    async run(t) {
      await t.game('scene', 'settings'); await t.waitFrames(3);
      t.expect(!(await t.page.evaluate(() => /Vibration/.test(document.querySelector('.panel').textContent))), 'no row for a switch that cannot do anything');
      await t.game('newGame', { level: 'l1' }); await t.game('pause');
      await t.game('act', 'hop', 'up'); await t.game('step', 40);
      t.expect((await t.state()).run.hops >= 1, 'a hop still works');
    },
  },
  {
    name: 'S3-13 an old save without the setting loads with Vibration on',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate(() => { const k = 'hsg-crazy-raccoon-v1', s = JSON.parse(localStorage.getItem(k) || '{}'); s.settings = { ...(s.settings || {}) }; delete s.settings.vibration; localStorage.setItem(k, JSON.stringify(s)); });
      await t.reload();
      t.equal((await t.state()).settings.vibration, true, 'on by default');
    },
  },

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
