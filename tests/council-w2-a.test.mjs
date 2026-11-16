// Council wave 2, batch A: sound (S5-02): ambience per zone, tension and longer music.
// Music and ambience are rendered on an OfflineAudioContext through the page's own kit (window.__game.audioRender)
// and measured: nobody in the test run can hear them, so the numbers are the check.
import fs from 'node:fs';

const MUSIC = ['title', 'map', 'day', 'noon', 'barn', 'night', 'results'];
const AMBIENCE = ['meadow', 'showground', 'loft', 'midnight'];
const KEY = 'hsg-crazy-raccoon-v1';
const render = (t, name, seconds, opts) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, seconds, opts]);
const peaks = { music: 0, amb: 0 };
const gesture = async (t) => { await t.page.mouse.click(3, 3); await t.page.waitForTimeout(150); };
const aud = async (t) => (await t.state()).audio;
// wait until the buses read the wanted levels (they fade, so a fixed sleep reads them mid-fade). A bus that never arrives is
// not hidden: the timeout ends the wait and the assertions that follow report what it read.
const busAt = (t, want) => t.page.waitForFunction((w) => { const l = window.__game.getState().audio.levels; return !!l && Object.entries(w).every(([k, v]) => Math.abs(l[k] - v) <= 0.02); }, want, { timeout: 10000 }).catch(() => {});
const near = (t, a, b, msg, eps = 0.02) => t.expect(Math.abs(a - b) <= eps, `${msg} (got ${a}, wanted ${b})`);

const musicTests = MUSIC.map((name) => ({
  name: `S5-02 music "${name}" renders 60 s inside the mix limits, long enough and varied`,
  viewports: ['desktop'],
  async run(t) {
    const r = await render(t, name, 60, { intensity: 0 });
    const hot = await render(t, name, 60, { intensity: 1 });
    t.log(`${name}: peak ${r.peak} rms ${r.rmsDb} dBFS, form ${r.built.formSeconds} s, ${r.built.distinctBars} distinct bars, ${r.built.pitches} pitches; at full tension peak ${hot.peak} rms ${hot.rmsDb}`);
    t.expect(r.peak >= 0.06 && r.peak <= 0.16, `peak ${r.peak} is between 0.06 and 0.16`);
    t.expect(r.rmsDb >= -40 && r.rmsDb <= -28, `RMS ${r.rmsDb} dBFS is between -40 and -28`);
    t.expect(hot.peak <= 0.16 && hot.rmsDb >= -40 && hot.rmsDb <= -28, `at full tension peak ${hot.peak} and RMS ${hot.rmsDb} stay inside the limits`);
    t.expect(Math.abs(hot.rmsDb - r.rmsDb) > 0.05 || hot.built.notes !== r.built.notes, 'full tension changes the music');
    t.expect(r.built.formSeconds >= 45, `the form is ${r.built.formSeconds} s before it repeats (at least 45)`);
    t.expect(r.built.distinctBars >= 6, `${r.built.distinctBars} distinct lead bars (at least 6)`);
    t.expect(r.built.pitches >= 6, `${r.built.pitches} pitches (at least 6)`);
    t.expect(r.longestSilence <= 2, `longest silence ${r.longestSilence} s`);
    t.expect(r.stereo > 0, 'a stereo image');
    peaks.music = Math.max(peaks.music, r.peak, hot.peak);
  },
}));

const ambienceTests = AMBIENCE.map((name) => ({
  name: `S5-02 ambience "${name}" renders 30 s inside the mix limits with no silent stretch`,
  viewports: ['desktop'],
  async run(t) {
    const r = await render(t, name, 30, {});
    const hot = await render(t, name, 30, { params: { tension: 1, crowd: 1 } });
    t.log(`${name}: peak ${r.peak} rms ${r.rmsDb} dBFS; with tension and crowd at 1: peak ${hot.peak} rms ${hot.rmsDb}`);
    t.expect(r.peak < 0.07, `peak ${r.peak} is under 0.07`);
    t.expect(r.rmsDb >= -52 && r.rmsDb <= -38, `RMS ${r.rmsDb} dBFS is between -52 and -38`);
    t.expect(r.longestSilence === 0, `longest silence ${r.longestSilence} s`);
    t.expect(hot.peak < 0.07 && hot.rmsDb <= -38, `with tension at 1 peak ${hot.peak} and RMS ${hot.rmsDb} stay inside the limits`);
    t.expect(hot.rmsDb > r.rmsDb + 0.2, 'tension and the crowd add to the bed');
    peaks.amb = Math.max(peaks.amb, r.peak, hot.peak);
  },
}));

export const tests = [
  {
    name: 'S5-02 the game lists every piece of music and every ambience scene, and rendering leaves live audio and settings alone',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.equal(list.music, MUSIC, 'music pieces');
      t.equal(list.ambience, AMBIENCE, 'ambience scenes');
      const before = JSON.stringify([(await t.state()).settings, await aud(t)]);
      const r = await render(t, 'meadow', 4, {});
      t.expect(r.peak > 0, 'a short render comes back');
      t.equal(JSON.stringify([(await t.state()).settings, await aud(t)]), before, 'settings and live audio state are unchanged');
    },
  },
  ...musicTests,
  ...ambienceTests,
  {
    name: 'S5-02 music, ambience and the loudest cue together stay under 0.95',
    viewports: ['desktop'],
    async run(t) {
      const music = peaks.music || 0.16, amb = peaks.amb || 0.07;
      t.log(`loudest music ${music}, loudest ambience ${amb}, loudest cue 0.45`);
      t.expect(music + amb + 0.45 < 0.95, 'the peaks add up to under 0.95');
    },
  },
  {
    name: 'S5-02 nothing sounds before the first key or touch, then the kit starts',
    viewports: ['desktop'],
    async run(t) {
      let a = await aud(t);
      t.equal([a.started, a.kit, a.ctx], [false, false, 'none'], 'no audio context before a gesture');
      t.equal(a.theme, 'title', 'the title music is chosen, waiting');
      await gesture(t);
      a = await aud(t);
      t.expect(a.started && a.kit, 'the first gesture starts audio and the kit');
    },
  },
  {
    name: 'S5-02 each zone has its own music and ambience, the map and the clear panel have theirs',
    viewports: ['desktop'],
    async run(t) {
      const want = async (opts, theme, scene) => {
        await t.game('newGame', opts);
        const a = await aud(t);
        t.equal([a.theme, a.scene], [theme, scene], `${JSON.stringify(opts)} plays ${theme} over ${scene}`);
      };
      await want({ level: 'l1' }, 'day', 'meadow');
      await want({ level: 'l5' }, 'day', 'meadow');
      await want({ level: 'l7' }, 'noon', 'showground');
      await want({ level: 'l10' }, 'barn', 'loft');
      await want({ level: 'l13' }, 'night', 'midnight');
      await want({ mode: 'endless' }, 'night', 'midnight');
      await t.game('scene', 'title');
      t.equal((await aud(t)).theme, 'title', 'the title has its own piece');
      await t.game('act', 'menu', 'play');
      t.equal([(await aud(t)).theme, (await aud(t)).scene], ['map', 'meadow'], 'the farm map is quiet');
      await t.game('scene', 'win');
      t.equal((await aud(t)).theme, 'results', 'a cleared level plays the results piece');
    },
  },
  {
    name: 'S5-02 tension rises with the lantern, a flashlight beam, the boss and the last ring, and eases off',
    viewports: ['desktop'],
    async run(t) {
      const settle = async (n) => { await t.game('step', n); return (await aud(t)).tension; };
      await t.game('newGame', { level: 'l1' });
      await t.game('pause');
      t.equal(await settle(60), 0, 'level 1 at the start is calm');
      await t.game('setState', { rings: 1 });
      const low = await settle(240);
      t.expect(low >= 0.5, `the last tail ring lifts the tension (${low})`);
      await t.game('setState', { rings: 5 });
      const calm = await settle(1200);
      t.expect(calm < 0.1, `and it eases off again (${calm})`);

      await t.game('newGame', { level: 'l15' });
      await t.game('pause');
      // a dry row within four rows of the boss, and Bandit made safe so the level does not end under the test
      const boss = await t.page.evaluate(() => { const r = window.__CR.run, b = r.world.gators.find((g) => g.k === 'boss').row; for (let d = 3; d >= 1; d--) if (r.L.rows[b - d].t !== 'water') { r.p.invT = 999; return b - d; } return -1; });
      t.expect(boss > 0, 'a dry row near the boss');
      await t.game('setState', { player: { row: boss, col: 4 } });
      const near = await settle(300);
      t.expect(near >= 0.8, `Old Ruthless within four rows brings it up (${near})`);

      await t.game('newGame', { level: 'l13' });
      await t.game('pause');
      const r0 = await t.page.evaluate(() => { const r = window.__CR.run, b0 = r.L.beams[0].r0; for (let d = 3; d >= 1; d--) if (r.L.rows[b0 - d].t !== 'water') { r.p.invT = 999; return b0 - d; } return -1; });
      t.expect(r0 > 0, 'a dry row near the beam');
      await t.game('setState', { player: { row: r0, col: 4 } });
      const beam = await settle(300);
      t.expect(beam >= 0.7, `a flashlight beam within three rows brings it up (${beam})`);

      await t.game('newGame', { mode: 'endless', seed: 5 });
      await t.game('pause');
      const hunted = await settle(300);
      t.expect(hunted >= 0.5, `the keeper's lantern four rows behind keeps it up in the Moonlight Run (${hunted})`);
    },
  },
  {
    name: 'S5-02 Music and Ambience are separate settings: each silences its own bus and both persist across a reload',
    async run(t) {
      await gesture(t);
      await t.game('newGame', { level: 'l1' });
      await busAt(t, { music: 1, amb: 1 });
      let a = await aud(t);
      near(t, a.levels.music, 1, 'music bus is up by default');
      near(t, a.levels.amb, 1, 'ambience bus is up by default');
      t.equal([(await t.state()).settings.music, (await t.state()).settings.ambience], [true, true], 'both are on by default');

      await t.game('scene', 'settings');
      const label = await t.page.$$eval('#screens .flabel', (n) => n.map((x) => x.textContent));
      t.equal(label.slice(0, 3), ['Sound', 'Music', 'Ambience'], 'Settings lists Sound (the switch for everything, as before this wave), Music and Ambience');
      await t.shot('S5-02-settings');
      const box = await t.page.$eval('[data-k="ambience"][data-v="false"]', (b) => { const r = b.getBoundingClientRect(); return [r.width, r.height]; });
      t.expect(box[0] >= 44 && box[1] >= 44, 'the Ambience buttons are at least 44 px');

      await t.page.click('[data-k="music"][data-v="false"]');
      await busAt(t, { music: 0 });
      a = await aud(t);
      near(t, a.levels.music, 0, 'Music off silences the music bus');
      near(t, a.levels.amb, 1, 'and leaves the ambience');
      t.equal(await t.page.$eval('[data-k="music"][data-v="false"]', (b) => b.getAttribute('aria-pressed')), 'true', 'the button shows it pressed');
      await t.page.click('[data-k="ambience"][data-v="false"]');
      await busAt(t, { amb: 0 });
      a = await aud(t);
      near(t, a.levels.amb, 0, 'Ambience off silences the ambience bus');
      await t.page.click('[data-k="music"][data-v="true"]');
      await busAt(t, { music: 1 });
      near(t, (await aud(t)).levels.music, 1, 'Music back on brings the music bus back');
      await t.page.click('[data-k="music"][data-v="false"]');

      await t.reload();
      const s = (await t.state()).settings;
      t.equal([s.music, s.ambience], [false, false], 'both settings survive a reload');
      await gesture(t);
      await busAt(t, { music: 0, amb: 0 });
      a = await aud(t);
      near(t, a.levels.music, 0, 'after the reload the music bus starts silent');
      near(t, a.levels.amb, 0, 'and so does the ambience bus');
      await t.game('scene', 'settings');
      await t.page.click('[data-k="music"][data-v="true"]');
      await t.page.click('[data-k="ambience"][data-v="true"]');
      await busAt(t, { music: 1, amb: 1 });
      a = await aud(t);
      near(t, a.levels.music, 1, 'music is back');
      near(t, a.levels.amb, 1, 'ambience is back');
    },
  },
  {
    name: 'S5-02 a save that had sound off stays silent: music and ambience obey the master switch',
    viewports: ['desktop'],
    async run(t) {
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, settings: { sound: false, music: true } })), KEY);
      await t.reload();
      await gesture(t);
      await t.game('newGame', { level: 'l1' });
      await t.page.waitForTimeout(500);
      const a = await aud(t);
      t.equal(a.on, false, 'sound is off');
      near(t, a.levels.master, 0, 'the master is silent');
      t.equal((await t.state()).settings.ambience, true, 'an old save has no Ambience setting: it reads as on');
      await t.page.evaluate((k) => localStorage.removeItem(k), KEY);
    },
  },
  {
    name: 'S5-02 an old save loads with Ambience on and nothing lost; a damaged value falls back; Off is kept',
    viewports: ['desktop'],
    async run(t) {
      const old = JSON.parse(fs.readFileSync(new URL('../test-fixtures/save-v1.2.0-earned-all15.json', import.meta.url), 'utf8'));
      delete old.settings.ambience;
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, old]);
      await t.reload();
      let s = await t.state();
      t.equal(s.settings.ambience, true, 'Ambience defaults to on');
      t.equal(Object.keys(s.save.progress).length, Object.keys(old.progress).length, 'every level record is still there');
      t.equal(s.save.unlocked, old.unlocked, 'unlocks are unchanged');
      old.settings.ambience = 'loud';
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, old]);
      await t.reload();
      t.equal((await t.state()).settings.ambience, true, 'a damaged value reads as on, with no error');
      old.settings.ambience = false;
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, old]);
      await t.reload();
      s = await t.state();
      t.equal(s.settings.ambience, false, 'Off is kept');
      t.equal(Object.keys(s.save.progress).length, Object.keys(old.progress).length, 'and still nothing is lost');
      await t.page.evaluate((k) => localStorage.removeItem(k), KEY);
    },
  },
  {
    name: 'S5-02 the pause card and a hidden tab hold the music and ambience, and they come back',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      await t.game('newGame', { level: 'l1' });
      await t.page.waitForTimeout(300);
      t.equal((await aud(t)).held, false, 'playing: not held');
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      t.equal((await t.state()).screen, 'pause', 'paused');
      let a = await aud(t);
      t.equal(a.held, true, 'the pause card holds the music and ambience');
      if (a.ctx === 'running') { await t.page.waitForTimeout(500); near(t, (await aud(t)).levels.music, 0, 'the music bus fades out'); near(t, (await aud(t)).levels.amb, 0, 'the ambience bus fades out'); }
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      a = await aud(t);
      t.equal(a.held, false, 'Resume releases them');
      if (a.ctx === 'running') { await t.page.waitForTimeout(1600); near(t, (await aud(t)).levels.music, 1, 'the music bus is back'); near(t, (await aud(t)).levels.amb, 1, 'and the ambience bus'); }
      const hide = (h) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      await hide(true);
      await t.page.waitForTimeout(200);
      t.equal((await aud(t)).held, true, 'a hidden tab holds them');
      await hide(false);
      await t.page.keyboard.press('Escape');
      await t.waitFrames(3);
      await t.page.waitForTimeout(300);
      t.equal((await aud(t)).held, false, 'and they return with the game');
    },
  },
];
