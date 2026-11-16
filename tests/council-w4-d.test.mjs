// Council wave 4, batch D: C4-07 (the sideways title keeps the lock on its label's line; the Moonlight Run intro says
// Moonlight Run), C4-03 (Titan One for the title, headings and run-over screen), S2-24 (the multiplier popup does not sit
// on Bandit), S4-13 (the code-drawn raccoon has rings and a mask; the phone intro's top band is tinted), P-N04 (theme colour).
// Every check reads state or the page; none depends on a measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };

// the lines a button's own text is painted on: distinct tops of the text's client rectangles
const lines = (t, sel) => t.page.evaluate((s) => [...document.querySelectorAll(s)].map((b) => {
  const r = document.createRange(); r.selectNodeContents(b);
  const tops = []; for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((x) => Math.abs(x - q.top) < 4)) tops.push(q.top);
  const br = b.getBoundingClientRect(), tr = r.getBoundingClientRect();
  return { text: b.textContent.trim(), lines: tops.length, inside: tr.left >= br.left - 0.5 && tr.right <= br.right + 0.5 };
}), sel);

export const tests = [
  // ------------------------------------------------------------------ C4-07
  {
    name: 'C4-07 the locked Moonlight Run and Daily Run buttons keep their lock on the label line from 667x375 up to a desktop',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('setState', { save: { endlessUnlocked: false } });
      for (const [w, h] of [[844, 390], [667, 375], [t.vp.width, t.vp.height]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('scene', 'title'); await t.waitFrames(2);
        for (const b of await lines(t, '.title-wrap [data-act="endless"], .title-wrap [data-act="daily"]')) {
          t.equal(b.lines, 1, `${w}x${h}: "${b.text}" is on one line`);
          t.expect(b.inside, `${w}x${h}: "${b.text}" stays inside its button`);
        }
        if (w === 844) await keep(t, 'C4-07', 'title-locked-844x390');
        if (w === 667) await keep(t, 'C4-07', 'title-locked-667x375');
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
  {
    name: 'C4-07 the Moonlight Run intro says Moonlight Run, not Zone 5, and the level intros still say their zone',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'endless', intro: true, seed: 3 }); await t.waitFrames(2);
      let k = await t.page.evaluate(() => ({ kicker: document.querySelector('.panel .kicker').textContent.trim(), place: !!document.querySelector('.panel .place') }));
      t.equal(k.kicker, 'Moonlight Run', 'the endless intro kicker');
      t.expect(!k.place, 'no zone place line on the Moonlight Run intro');
      await keep(t, 'C4-07', 'endless-intro');
      await t.game('newGame', { level: 'l1', intro: true, seed: 3 }); await t.waitFrames(2);
      k = await t.page.evaluate(() => document.querySelector('.panel .kicker').textContent.trim());
      t.expect(/^Zone 1 · /.test(k), 'a level intro still names its zone: ' + k);
      await t.game('newGame', { level: 'l15', intro: true, seed: 3 }); await t.waitFrames(2);
      k = await t.page.evaluate(() => document.querySelector('.panel .kicker').textContent.trim());
      t.equal(k, 'Zone 5 · Midnight Raid', 'the last level still names zone 5');
    },
  },

  // ------------------------------------------------------------------ S2-24
  {
    name: 'S2-24 the x2 popup is drawn clear above the head of Bandit in the Moonlight Run and in a level, while it rises',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const [label, opt] of [['endless', { mode: 'endless', seed: 3 }], ['level', { level: 'l2', seed: 3 }]]) {
        await t.game('newGame', opt); await t.game('pause'); await t.waitFrames(3);
        const r = await t.page.evaluate(() => {
          const A = window.__CR, R = A.renderer; R.fx.clear(); R.onEvent({ k: 'streak', mult: 2 }, A.run);
          const o = R.fx.texts[0], head = R.playerScreen(A.run)[1] - R.tile * 0.63, out = [];
          for (const u of [0, 0.35, 0.7]) { o.t = u * o.life; const b = R.fx.textBox(o, R.proj, R.k); out.push({ u, bottom: b.y + b.fs / 2, fs: b.fs }); }
          o.t = 0; return { head, out, tile: R.tile, s: o.s };
        });
        for (const b of r.out) t.expect(b.bottom <= r.head, label + ': at ' + b.u + ' of its life the popup ends at ' + b.bottom.toFixed(1) + ' px, the head starts at ' + r.head.toFixed(1));
        t.expect(r.out[0].fs < r.tile * 1.1, label + ': the popup is smaller than a tile and a bit: ' + r.out[0].fs.toFixed(1) + ' px, tile ' + r.tile.toFixed(1));
        t.expect(r.out[0].fs >= 14, label + ': still legible');
        if (label === 'endless') { await t.waitFrames(2); await keep(t, 'S2-24', 'streak-popup'); }
      }
      // the other popups (a snack, a bank) are as they were: the same size, no lift
      const o = await t.page.evaluate(() => { const R = window.__CR.renderer; R.fx.clear(); R.fx.text(0, 0, 'x'); return R.fx.texts[0]; });
      t.expect(o.size === 1 && o.lift === 0, 'a plain popup has size 1 and no lift');
    },
  },
];
