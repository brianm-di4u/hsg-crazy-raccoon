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

  // ------------------------------------------------------------------ S4-13
  {
    name: 'S4-13 the code-drawn raccoon (no art) shows its ringed tail beside the body from behind',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?art=0',
    async run(t) {
      t.equal((await t.state()).art, false, 'no art');
      await t.game('newGame', { level: 'l3', seed: 3 }); await t.game('pause'); await t.waitFrames(4);
      const r = await t.page.evaluate(() => {
        const A = window.__CR, R = A.renderer, c = document.querySelector('#view'), g = c.getContext('2d'), d = c.width / R.w;
        const [cx, cy] = R.playerScreen(A.run), x0 = Math.round((cx + R.tile * 0.36) * d), x1 = Math.round((cx + R.tile * 0.8) * d), y0 = Math.round((cy - R.tile * 0.6) * d), y1 = Math.round((cy + R.tile * 0.2) * d);
        const px = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; let ring = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (Math.abs(px[i] - 43) < 9 && Math.abs(px[i + 1] - 42) < 9 && Math.abs(px[i + 2] - 46) < 9) ring++;
        }
        return { ring, area: (x1 - x0) * (y1 - y0), facing: A.run.p.facing };
      });
      t.equal(r.facing, 'up', 'Bandit faces up on the start row');
      t.expect(r.ring > r.area * 0.01, 'dark tail rings show beside the body: ' + r.ring + ' of ' + r.area + ' px');
      await keep(t, 'S4-13', 'vector-raccoon');
    },
  },
  {
    name: 'S4-13 the phone level card sits under the sky of its level, not a flat dark band, and play is unchanged',
    viewports: ['mobile'],
    async run(t) {
      const band = () => t.page.evaluate(() => {
        const A = window.__CR, c = document.querySelector('#view'), d = c.width / A.renderer.w, g = c.getContext('2d');
        const out = []; for (const x of [0.15, 0.5, 0.85]) out.push([...g.getImageData(Math.round(x * c.width), Math.round(30 * d), 1, 1).data].slice(0, 3));
        return out;
      });
      const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      const shown = {};
      for (const id of ['l1', 'l10', 'l15']) {
        await t.game('newGame', { level: id, intro: true, seed: 3 });
        await t.page.waitForFunction(() => window.__CR.screens.cur === 'intro', null, { timeout: 5000 }); await t.waitFrames(4);
        const b = await band(); shown[id] = b;
        t.expect(b.every((c) => dist(c, [24, 56, 47]) > 24), id + ': the header behind the card is not the flat dark green: ' + JSON.stringify(b));
        if (id === 'l1') await keep(t, 'S4-13', 'intro-l1');
        if (id === 'l15') await keep(t, 'S4-13', 'intro-l15');
      }
      t.expect(dist(shown.l1[1], shown.l15[1]) > 12, 'the day and the night levels tint it differently: ' + JSON.stringify([shown.l1[1], shown.l15[1]]));
      // after Go the header is the plain band the pills sit on, as before
      await t.page.click('[data-act="go"]');
      await t.page.waitForFunction(() => !window.__CR.screens.cur, null, { timeout: 5000 }); await t.game('pause'); await t.waitFrames(4);
      const play = await band();
      t.expect(play.every((c) => dist(c, [24, 56, 47]) < 20), 'in play the header is the flat band again: ' + JSON.stringify(play));
    },
  },
];
