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
];
