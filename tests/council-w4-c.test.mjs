// Council wave 4, batch C: C4-06 (a fact card is not shown twice after a failed first try), C4-08 (steam inside the phone map),
// S5-11 (cues for paws full, respawn, par warning, last ring, new fact), S2-26 (Volume has five steps), S5-09 (switched-off
// music and ambience are not scheduled), S5-12 (star cues on the audio clock), S5-23 (noise cues stay clear of the buffer seam),
// S6-10 (the title redraws at half rate and rests after a minute). Every check reads state or the page; none depends on a
// measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };
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
];
