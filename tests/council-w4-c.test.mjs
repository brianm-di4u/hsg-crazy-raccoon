// Council wave 4, batch C: C4-06 (a fact card is not shown twice after a failed first try), C4-08 (steam inside the phone map),
// S5-11 (cues for paws full, respawn, par warning, last ring, new fact), S2-26 (Volume has five steps), S5-09 (switched-off
// music and ambience are not scheduled), S5-12 (star cues on the audio clock), S5-23 (noise cues stay clear of the buffer seam),
// S6-10 (the title redraws at half rate and rests after a minute). Every check reads state or the page; none depends on a
// measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };
const render = (t, name, seconds, o, wav) => t.page.evaluate(([n, s, w, opt]) => window.__game.audioRender(n, s, w, opt), [name, seconds, !!wav, o || {}]);
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const cues = async (t) => (await t.state()).audio.cues;
const count = (list, name) => list.filter((x) => x === name).length;
const gesture = async (t) => { await t.page.mouse.click(3, 3); await t.page.waitForFunction(() => window.__game.getState().audio.started, null, { timeout: 5000 }); };
const winLevel = async (t) => {
  await t.game('act', 'replay'); await t.game('resume');
  await t.page.waitForFunction(() => window.__game.getState().screen === 'win', null, { timeout: 15000 });
};

export const tests = [
  // ------------------------------------------------------------------ C4-06 no repeated fact card after a failed try
  {
    name: 'C4-06 a win after a restart does not show the card the intro showed, and levels 2, 3 and 5 have their own cards',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('setState', { save: { notebook: [] } });
      const want = { l2: /gator holes/, l3: /11\.2 feet/, l5: /Nest temperature/ };
      for (const [id, re] of Object.entries(want)) {
        await t.game('newGame', { level: id, intro: true, seed: 5 }); await t.waitFrames(2);
        const fact = await t.page.evaluate(() => (document.querySelector('.fact p') || {}).textContent || '');
        t.expect(re.test(fact), `${id} shows a card about its own place: ${fact}`);
      }
      // intro shown, then a failed try and a restart: the win panel must not show that card again
      await t.game('newGame', { level: 'l2', intro: true, seed: 5 }); await t.waitFrames(2);
      const intro = await t.page.evaluate(() => document.querySelector('.fact p').textContent);
      await t.game('pause');
      await t.page.click('[data-act="go"]');
      await t.game('act', 'menu', 'restart');
      t.expect(await t.page.evaluate(() => !document.querySelector('.fact')), 'the restart skips the intro');
      await winLevel(t);
      const p = await t.page.evaluate(() => document.querySelector('.panel').textContent);
      t.expect(!p.includes(intro), 'the intro card is not repeated on the win panel');
      t.expect(/Farm fact added to your Notebook/.test(p), 'the panel says the card went into the Notebook');
      t.equal((await t.state()).save.notebook, 1, 'one card in the Notebook');
      await keep(t, 'C4-06', 'win-after-restart');
      // a level started without an intro (a test or a later restart chain with none shown) still gets its card on the win panel
      await t.game('setState', { save: { notebook: [] } });
      await t.game('newGame', { level: 'l3', intro: false, seed: 5 });
      await t.game('pause'); await winLevel(t);
      t.expect(await t.page.evaluate(() => !!document.querySelector('.panel .fact')), 'no intro was shown: the win panel shows the card');
      // a different level breaks the chain
      await t.game('setState', { save: { notebook: [] } });
      await t.game('newGame', { level: 'l1', intro: true, seed: 5 }); await t.waitFrames(2);
      await t.game('newGame', { level: 'l2', intro: false, seed: 5 });
      await t.game('pause'); await winLevel(t);
      t.expect(await t.page.evaluate(() => !!document.querySelector('.panel .fact')), 'an intro shown for another level does not count');
      await t.game('setState', { save: { notebook: [] } });
    },
  },

  // ------------------------------------------------------------------ C4-08 steam inside the phone map
  {
    name: 'C4-08 spring steam drifts inside the farm map panel at both sizes, lets every tap through, and is gone when motion is reduced',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const mist = () => t.page.evaluate(() => {
        const c = document.querySelector('#screens .mist'), p = document.querySelector('#screens .panel'), r = p.getBoundingClientRect(), m = c.getBoundingClientRect();
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0, peak = 0;
        for (let i = 3; i < d.length; i += 4) { if (d[i]) lit++; if (d[i] > peak) peak = d[i]; }
        const b = document.querySelector('#screens .lvl.open').getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { same: Math.abs(m.left - r.left) < 1.5 && Math.abs(m.top - r.top) < 1.5 && Math.abs(m.width - r.width) < 1.5 && Math.abs(m.height - r.height) < 1.5, lit, peak, area: c.width * c.height,
          hidden: c.getAttribute('aria-hidden'), through: getComputedStyle(c).pointerEvents, tapOk: !!hit && !!hit.closest('.lvl'), shown: getComputedStyle(c).display !== 'none', mists: window.__CR.renderer.mists };
      });
      await t.game('setState', { settings: { reducedMotion: false } });
      await t.game('scene', 'map');
      await t.page.waitForFunction(() => window.__game.getState().mists >= 5, null, { timeout: 8000 });
      const m = await mist();
      t.expect(m.same, 'the steam layer covers exactly the panel: ' + JSON.stringify(m));
      t.expect(m.lit > m.area * 0.1 && m.peak > 20 && m.peak <= 120, 'wisps are drawn, and faint: ' + m.lit + ' of ' + m.area + ' pixels, peak alpha ' + m.peak);
      t.expect(m.hidden === 'true' && m.through === 'none' && m.tapOk, 'hidden from a screen reader, and a tap on a level reaches the level: ' + JSON.stringify(m));
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'C4-08', 'map-steam');
      // the title has none of it
      await t.game('scene', 'title'); await t.waitFrames(2);
      t.expect(await t.page.evaluate(() => !document.querySelector('#screens .mist')), 'no steam layer on the title screen');
      // reduced motion: nothing is drawn, and the layer is not shown
      await t.game('setState', { settings: { reducedMotion: true } });
      await t.game('scene', 'map'); await t.waitFrames(3);
      const before = (await mist()).mists;
      await t.waitFrames(6);
      const r = await mist();
      t.equal(r.mists, before, 'with reduced motion no steam is drawn');
      t.expect(!r.shown, 'and the layer is not shown');
      await t.game('setState', { settings: { reducedMotion: null } });
    },
  },
  // ------------------------------------------------------------------ S5-11 cues for the full bag, the respawn, the par clock and the last ring
  {
    name: 'S5-11 the four new cues are heard between 0.2 and 0.45, and nothing clips at full volume',
    viewports: ['desktop'],
    async run(t) {
      // The noise in the respawn swoosh starts at a random place in the buffer, so single plays differ (S5-23 keeps it off the seam). The median of
      // 7 plays leaves the band only if 4 of 7 do, and a play is 1.5 dB at most from the nominal peak, so with the nominal peak at least 0.24 it cannot.
      const out = [];
      for (const [name, args] of [['full', []], ['respawn', []], ['tick', [5]], ['tick', [4]], ['lastring', []]]) {
        const peaks = [];
        for (let i = 0; i < 7; i++) peaks.push((await render(t, 'cue:' + name, 1.8, { args, seed: 400 + i })).peak);
        const med = median(peaks);
        out.push(`${name}${args.length ? ':' + args.join(',') : ''} ${med}`);
        t.expect(med >= 0.2 && med <= 0.45, `${name} ${args.join(',')}: median peak ${med} is between 0.2 and 0.45`);
        t.expect(Math.min(...peaks) >= 0.12 && Math.max(...peaks) <= 0.7, `${name}: no single play outside 0.12 to 0.7 (${Math.min(...peaks)} to ${Math.max(...peaks)})`);
        for (let i = 0; i < 5; i++) { const r = await render(t, 'cue:' + name, 1.8, { args, volume: 1, seed: 500 + i }); t.expect(r.peak < 0.95, `${name} at volume 1: peak ${r.peak}`); }
      }
      t.log('as heard at the default volume, median of 7: ' + out.join('; '));
      const busy = [{ name: 'chomp' }, { name: 'lastring' }, { name: 'full' }, { name: 'respawn' }, { name: 'tick', args: [3] }, { name: 'win' }, { name: 'best' }];
      for (const [piece, intensity] of [['barn', 1], ['night', 1]]) {
        const r = await render(t, piece, 9, { volume: 1, intensity, cues: busy, cueAt: 4, params: { tension: 1 } });
        t.expect(r.peak < 0.95, `${piece} with the new cues among the loud ones at volume 1: peak ${r.peak}`);
      }
    },
  },
  {
    name: 'S5-11 a full bag, a respawn, the last ring and the par clock are each heard, once, where they happen',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      // paws full: three snacks carried, a fourth on the next tile
      await t.game('newGame', { level: 'l1', intro: false, seed: 5 }); await t.game('pause');
      await t.game('setState', { player: { row: 0, col: 4 }, carry: ['pecan', 'pecan', 'pecan'] });
      await t.page.evaluate(() => { window.__CR.run.items.push({ id: 9999, r: 1, c: 4, k: 'pecan', st: 'free', washed: false }); });
      const full0 = count(await cues(t), 'full');
      await t.game('act', 'hop', 'up');
      await t.stepUntil((s) => s.run.player.row === 1 && s.run.player.state === 'idle', { max: 200, chunk: 5, label: 'the hop lands' });
      t.equal(count(await cues(t), 'full') - full0, 1, 'one "full" cue when a fourth snack will not fit');
      // a bag with room is not "full"
      await t.game('newGame', { level: 'l1', intro: false, seed: 5 }); await t.game('pause');
      await t.game('setState', { player: { row: 0, col: 4 } });
      await t.page.evaluate(() => { window.__CR.run.items.push({ id: 9999, r: 1, c: 4, k: 'pecan', st: 'free', washed: false }); });
      const full1 = count(await cues(t), 'full');
      await t.game('act', 'hop', 'up');
      await t.stepUntil((s) => s.run.player.row === 1 && s.run.player.state === 'idle', { max: 200, chunk: 5, label: 'the hop lands' });
      t.equal(count(await cues(t), 'full') - full1, 0, 'no "full" cue when there is room');
      // the last ring and the respawn: a Moonlight Run, two rings, the lantern catches Bandit
      await t.game('newGame', { mode: 'endless', seed: 777002 }); await t.game('pause');
      await t.game('setState', { rings: 2 });
      const last0 = count(await cues(t), 'lastring'), res0 = count(await cues(t), 'respawn');
      await t.stepUntil((s) => s.run.rings === 1, { max: 20000, chunk: 100, label: 'the lantern catches Bandit once' });
      t.equal(count(await cues(t), 'lastring') - last0, 1, 'one "last ring" cue when the second-to-last ring goes');
      await t.stepUntil((s) => s.run.player.state !== 'dead', { max: 2000, chunk: 5, label: 'Bandit is back on his feet' });
      t.equal(count(await cues(t), 'respawn') - res0, 1, 'one respawn swoosh when Bandit gets up');
      await t.game('setState', { rings: 3 });
      t.equal(count(await cues(t), 'lastring') - last0, 1, 'a ring picked up or set does not play it again');
      // the par clock: five ticks in the last five seconds before par, none with Assist, none after par
      await t.game('newGame', { level: 'l1', intro: false, seed: 5, assist: false }); await t.game('pause');
      const par = (await t.state()).level.par;
      t.equal(par, 11, 'level 1 has a par of 11 s (this test counts the ticks from it)');
      const ticks = async () => count(await cues(t), 'tick');
      const tick0 = await ticks();
      await t.stepUntil((s) => s.run.t >= 5.8, { max: 5000, chunk: 5, label: 'just before the warning' });
      t.equal((await ticks()) - tick0, 0, 'no tick more than five seconds before par');
      await t.stepUntil((s) => s.run.t >= 6.3, { max: 5000, chunk: 5, label: 'into the warning' });
      t.equal((await ticks()) - tick0, 1, 'the first tick five seconds before par');
      await t.stepUntil((s) => s.run.t >= 10.3, { max: 5000, chunk: 5, label: 'the last second before par' });
      t.equal((await ticks()) - tick0, 5, 'one tick a second for the last five seconds');
      await t.stepUntil((s) => s.run.t >= 12, { max: 5000, chunk: 5, label: 'past par' });
      t.equal((await ticks()) - tick0, 5, 'and none once par has gone');
      // with Assist there is no par star, so no clock
      await t.game('newGame', { level: 'l1', intro: false, seed: 5, assist: true }); await t.game('pause');
      const tick1 = await ticks();
      await t.stepUntil((s) => s.run.t >= 12, { max: 5000, chunk: 5, label: 'past par with Assist' });
      t.equal((await ticks()) - tick1, 0, 'Assist has no par clock');
      await t.game('newGame', { level: 'l1', intro: false, seed: 5, assist: false });
      // the Moonlight Run has no par
      await t.game('newGame', { mode: 'endless', seed: 777003 }); await t.game('pause');
      const tick2 = await ticks();
      await t.stepUntil((s) => s.run.t >= 12, { max: 5000, chunk: 5, label: 'twelve seconds of Moonlight Run' });
      t.equal((await ticks()) - tick2, 0, 'the Moonlight Run has no par clock');
    },
  },

  // ------------------------------------------------------------------ S2-26 five volume steps
  {
    name: 'S2-26 Volume has five steps that keep the old Low, Medium and High at the same loudness, work by keyboard, and fit at both sizes',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await gesture(t);
      await t.game('scene', 'settings'); await t.waitForAnimations();
      const row = () => t.page.$$eval('[data-k="volume"]', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return { n: x.textContent.trim(), v: +x.dataset.v, on: x.getAttribute('aria-pressed'), label: x.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), inside: r.right <= innerWidth && r.left >= 0 }; }));
      let b = await row();
      t.equal(b.map((x) => x.v).join(','), '0.25,0.35,0.5,0.65,0.85', 'five steps, from the old Low to the old High');
      t.equal(b.map((x) => x.n).join(','), '1,2,3,4,5', 'numbered one to five');
      t.expect(b.every((x) => x.w >= 44 && x.h >= 44 && x.inside), 'each at least 44 px and on the screen: ' + JSON.stringify(b.map((x) => [x.w, x.h, x.inside])));
      t.expect(b.every((x, i) => x.label === `Volume ${i + 1} of 5`), 'each is named for a screen reader: ' + b.map((x) => x.label).join(' | '));
      t.expect(await t.page.evaluate(() => /quietest/.test(document.querySelector('[data-k="volume"]').closest('[role="group"]').getAttribute('aria-label'))), 'and the group says which end is quiet');
      // a saved volume lands on its step, and the master gain is what it always was for that value (old Low, Medium and High)
      for (const [vol, step, master] of [[0.25, 1, 0.35], [0.5, 3, 0.7], [0.85, 5, 1.19]]) {
        await t.game('setState', { settings: { volume: vol } }); await t.game('scene', 'settings'); await t.waitFrames(2);
        b = await row();
        t.equal(b.filter((x) => x.on === 'true').map((x) => x.n).join(), String(step), `volume ${vol} shows step ${step}`);
        await t.page.waitForFunction((m) => Math.abs(window.__game.getState().audio.levels.master - m) < 0.02, master, { timeout: 5000 });
        t.expect(true, `and plays at master gain ${master}, as Low, Medium or High did`);
      }
      // a click and the keyboard both set a step, it is saved, and the click sound is heard at the new volume
      await t.page.click('[data-k="volume"][data-v="0.65"]'); await t.waitFrames(2);
      t.equal((await t.state()).settings.volume, 0.65, 'step 4 is 0.65');
      t.equal((await t.state()).audio.cueVol, 0.65, 'and the click was heard at the new volume');
      await t.page.focus('[data-k="volume"][data-v="0.35"]'); await t.page.keyboard.press('Enter'); await t.waitFrames(2);
      t.equal((await t.state()).settings.volume, 0.35, 'Enter on step 2 sets 0.35');
      await t.reload();
      t.equal((await t.state()).settings.volume, 0.35, 'and it is still there after a reload');
      await t.game('scene', 'settings'); await t.waitFrames(2);
      t.equal((await row()).filter((x) => x.on === 'true').map((x) => x.n).join(), '2', 'step 2 is the one lit');
      await t.game('setState', { settings: { textScale: 1.75 } }); await t.game('scene', 'settings'); await t.waitFrames(2);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S2-26', 'settings-volume');
      await t.game('setState', { settings: { textScale: 1, volume: 0.5 } });
    },
  },

  // ------------------------------------------------------------------ S5-09 a switched-off layer is not scheduled
  {
    name: 'S5-09 with Music, Ambience or Sound off, that layer schedules no notes or sounds, the timer rests when both are off, and it all comes back',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      await t.page.waitForFunction(() => { const a = window.__game.getState().audio; return a.ctx === 'running' && a.sched && a.sched.timer; }, null, { timeout: 8000 });
      const pump = (s) => t.game('act', 'audioPump', s);
      const set = (settings) => t.game('setState', { settings });
      // first prove the measure: with everything on, a look 40 s ahead schedules bars and one-shots
      let a = await pump(40); const on0 = { ...a };
      a = await pump(80);
      t.expect(a.bars > on0.bars && a.spots > on0.spots, `with everything on, scheduling ahead adds bars (${on0.bars} to ${a.bars}) and one-shots (${on0.spots} to ${a.spots})`);
      // Music off: no more bars, the ambience carries on
      await set({ music: false });
      a = await t.game('act', 'audioPump', 0); const m0 = { ...a };
      a = await pump(200);
      t.equal(a.bars, m0.bars, 'Music off: no bar is scheduled');
      t.expect(a.spots > m0.spots && a.timer && !a.music && a.amb, 'Music off: the ambience still is, the timer still runs: ' + JSON.stringify(a));
      // Ambience off too: nothing at all, and the timer stops
      await set({ ambience: false });
      a = await pump(0); const n0 = { ...a };
      a = await pump(400);
      t.expect(a.bars === n0.bars && a.spots === n0.spots, 'both off: nothing is scheduled');
      t.expect(!a.timer && !a.music && !a.amb, 'both off: the scheduler timer is stopped: ' + JSON.stringify(a));
      // Music back: bars again, from where the piece was, and the timer is running
      await set({ music: true });
      a = await pump(600); 
      t.expect(a.bars > n0.bars && a.spots === n0.spots && a.timer, 'Music back on: bars again, still no ambience, timer running: ' + JSON.stringify(a));
      await set({ ambience: true });
      a = await pump(900);
      t.expect(a.spots > n0.spots, 'Ambience back on: one-shots again');
      // the Sound switch is the master: with it off, neither layer is scheduled even though both are on
      await set({ sound: false });
      a = await pump(0); const s0 = { ...a };
      a = await pump(1500);
      t.expect(a.bars === s0.bars && a.spots === s0.spots && !a.timer, 'Sound off: nothing scheduled and the timer rests: ' + JSON.stringify(a));
      await set({ sound: true });
      a = await pump(2000);
      t.expect(a.bars > s0.bars && a.spots > s0.spots && a.timer, 'Sound on again: everything comes back: ' + JSON.stringify(a));
      await t.page.waitForFunction(() => { const l = window.__game.getState().audio.levels; return l.music >= 0.98 && l.amb >= 0.98; }, null, { timeout: 5000 });
      t.expect(true, 'and the buses are back at their levels');
    },
  },

  // ------------------------------------------------------------------ S5-12 the star pings are on the audio clock
  {
    name: 'S5-12 the win stinger, star pings, new best and fact card are all placed on the audio clock at the moment of the win, not left to timers',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      await t.game('setState', { save: { notebook: [] } });
      await t.game('act', 'clearSave');
      const n0 = (await cues(t)).length;
      await t.game('scene', 'win');
      // in the same turn of the page: nothing is waiting on a timer, so a busy main thread has nothing to shift
      const st = (await t.state()).audio, k = st.cues.length - st.cues.lastIndexOf('win');
      t.expect(st.cues.length > n0, 'cues were played');
      const tail = st.cues.slice(st.cues.lastIndexOf('win')), delays = st.delays.slice(st.cues.lastIndexOf('win'));
      t.equal(tail.join(' '), 'win star par best fact', 'the whole sequence is queued at once, in order: ' + tail.join(' '));
      t.equal(delays.map((d) => +d.toFixed(2)).join(' '), '0 0.5 0.94 1.35 1.9', 'at the old spacing (the first star at 0.5 s, the par star at 0.94 s: the stored plan of level 1 earns those two), as offsets on the audio clock: ' + delays.join(' '));
      t.equal(k, 5, 'five cues');
      // with no new best the fact card follows the stars sooner
      await t.game('scene', 'win');
      const st2 = (await t.state()).audio, at = st2.cues.lastIndexOf('win'), tail2 = st2.cues.slice(at), d2 = st2.delays.slice(at);
      t.expect(!tail2.includes('best') && tail2.includes('fact'), 'a repeat clear has no new-best cue: ' + tail2.join(' '));
      t.equal(+d2[d2.length - 1].toFixed(2), 1.35, 'and its fact card is at 1.35 s');
      // Sound off queues nothing
      await t.game('setState', { settings: { sound: false } });
      const before = (await cues(t)).length;
      await t.game('scene', 'win');
      t.equal((await cues(t)).length, before, 'with Sound off no cue is queued');
      await t.game('setState', { settings: { sound: true } });
    },
  },

  // ------------------------------------------------------------------ S5-23 noise cues stay clear of the buffer's seam
  {
    name: 'S5-23 the shared noise buffer is 2 s and every noise cue, the longest included, starts where it ends before the end of the buffer',
    viewports: ['desktop'],
    async run(t) {
      await gesture(t);
      const NAMES = ['hop', 'land', 'bump', 'splash', 'chomp', 'tele', 'chitter', 'hiss', 'roar', 'whip', 'pickup', 'cap', 'wash', 'bank', 'lure', 'feed', 'sweep', 'hum', 'spotted', 'streak', 'nudge', 'ball', 'menu', 'back',
        'denied', 'win', 'fail', 'star', 'best', 'par', 'fact', 'ach', 'finale', 'full', 'respawn', 'tick', 'lastring'];
      const ARGS = { streak: [2], star: [1], tick: [3] };
      const SURF = ['grass', 'wood', 'sand', 'path', 'straw', 'back', 'wet'];
      t.equal((await t.game('act', 'noiseStats')).seconds, 2, 'the live noise buffer is two seconds long');
      // The offset is random, so play each cue several times: the longest noise (the splash and wash at 0.45 to 0.5 s, the sweep at 0.7 s, the ending's shimmer at 1.4 s) would
      // cross the seam of the old one-second buffer on most plays (a start anywhere in 1 s, a 1.4 s cue: every play does).
      let plays = 0;
      for (const name of NAMES) for (let i = 0; i < 3; i++) { await render(t, 'cue:' + name, name === 'finale' ? 5.5 : 2, { seed: 700 + i, args: ARGS[name] || (name === 'land' ? [SURF[i % 7]] : []) }); plays++; }
      for (const surface of SURF) { await render(t, 'cue:land', 1, { args: [surface], seed: 9 }); plays++; }
      const n = await t.game('act', 'noiseStats');
      t.expect(n.slack >= 0, `across ${plays} plays no noise cue ran past the end of the buffer (least spare ${n.slack} s)`);
      t.expect(n.slack < 9, 'and the measure saw noise being played');
    },
  },

  // ------------------------------------------------------------------ S6-10 the title redraws at about 30 a second and rests after a minute
  {
    name: 'S6-10 the title redraws at about 30 frames a second on any screen rate, and stops after a minute with no input until the next one',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // the pacing rule on its own: draws in one second of frames at each common screen rate (no wall clock: the frame times are made up here)
      const due = (last, now) => t.game('act', 'titleDue', last, now);
      for (const hz of [30, 60, 75, 90, 120, 144]) {
        let last = -1e9, draws = 0;
        const times = []; for (let n = 0; n * 1000 / hz < 1000; n++) times.push(n * 1000 / hz);
        for (const now of times) { if (await due(last, now)) { draws++; last = now; } }
        t.expect(hz <= 30 ? draws === times.length : draws >= 28 && draws <= 38, `${hz} Hz: ${draws} of ${times.length} frames drawn in a second`);
      }
      // live: the title is drawn again and again while the player is there
      await t.game('setState', { settings: { reducedMotion: false } });
      await t.game('scene', 'title');
      const draws = () => t.page.evaluate(() => window.__game.getState().title.draws);
      const d0 = await draws();
      await t.page.waitForFunction((n) => window.__game.getState().title.draws >= n + 5, d0, { timeout: 10000 });
      t.expect(true, 'the title keeps being drawn');
      // the live loop honours the cap: over two seconds of the browser's own frame clock (the time the loop paces by), the title is drawn at most
      // 36 times a second, and, where the screen really runs near 60 frames a second, at least 24. Slow frames under load only draw fewer, so the cap is
      // the check that cannot be met by chance: with the in-loop hold removed it draws every frame, about 60 a second.
      const live = await t.page.evaluate(() => new Promise((res) => {
        const d1 = window.__game.getState().title.draws; let first = 0, n = 0;
        const tick = (now) => {
          if (!first) first = now; n++;
          if (now - first >= 2000) res({ span: now - first, frames: n, draws: window.__game.getState().title.draws - d1 });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }));
      const perSec = live.draws * 1000 / live.span, framesPerSec = live.frames * 1000 / live.span;
      t.expect(perSec <= 36, `the live title draws at most 36 a second: ${perSec.toFixed(1)} (${live.draws} draws, ${live.frames} frames in ${Math.round(live.span)} ms)`);
      t.expect(framesPerSec < 55 || perSec >= 24, `and about half the frames of a 60 Hz screen are drawn: ${perSec.toFixed(1)} a second at ${framesPerSec.toFixed(0)} frames a second`);
      // a minute with no input: the game's own clock is moved on, so no time is waited
      await t.game('act', 'clock', 0); await t.page.waitForFunction(() => window.__CR.time === 0, null, { timeout: 5000 }); // a frame must have read the clock before the key press is stamped with it
      await t.page.keyboard.press('Shift');
      await t.game('act', 'clock', 59000); await t.waitFrames(4);
      t.expect(!(await t.state()).title.resting, 'at 59 s without input the title is still live');
      await t.game('act', 'clock', 61000);
      await t.page.waitForFunction(() => window.__game.getState().title.resting, null, { timeout: 5000 });
      await t.waitFrames(4);
      const rested = await draws();
      await t.waitFrames(12);
      t.equal(await draws(), rested, 'after a minute with no input it draws nothing more');
      t.expect(await t.page.evaluate(() => !window.__CR.busy), 'and the loop is asleep');
      await keep(t, 'S6-10', 'title-resting');
      // the next key, tap or move wakes it
      await t.page.keyboard.press('Shift');
      await t.page.waitForFunction((n) => { const s = window.__game.getState().title; return !s.resting && s.draws > n; }, rested, { timeout: 5000 });
      t.expect(true, 'a key press wakes it and it draws again');
      await t.game('act', 'clock', 130000);
      await t.page.waitForFunction(() => window.__game.getState().title.resting, null, { timeout: 5000 });
      await t.page.mouse.move(40, 40); await t.page.mouse.move(60, 50);
      await t.page.waitForFunction(() => !window.__game.getState().title.resting, null, { timeout: 5000 });
      t.expect(true, 'so does moving the pointer');
      // a resting title is redrawn once when the window changes size (a canvas that is resized goes blank)
      await t.game('act', 'clock', 250000);
      await t.page.waitForFunction(() => window.__game.getState().title.resting, null, { timeout: 5000 });
      await t.waitFrames(4);
      const r1 = await draws();
      await t.page.setViewportSize({ width: t.vp.width + 40, height: t.vp.height });
      await t.page.waitForFunction((n) => window.__game.getState().title.draws > n, r1, { timeout: 5000 });
      t.expect(true, 'a resize redraws the resting title');
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
      // the title is not cut off by any of it: a play screen, and the game itself, are not throttled
      await t.game('act', 'clock', null);
      await t.game('newGame', { level: 'l1', intro: false, seed: 5 });
      t.expect(!(await t.state()).title.resting, 'a level in play never rests');
      // reduced motion draws the title once and has never looped: nothing changes there
      await t.game('setState', { settings: { reducedMotion: true } });
      await t.game('scene', 'title'); await t.waitFrames(3);
      const q0 = await draws(); await t.waitFrames(6);
      t.equal(await draws(), q0, 'with reduced motion the title is still drawn once and not looped');
      await t.game('setState', { settings: { reducedMotion: null } });
    },
  },
];
