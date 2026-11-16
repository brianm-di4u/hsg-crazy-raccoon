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

  // ------------------------------------------------------------------ C4-03
  {
    name: 'C4-03 the title, menu headings and run-over screen are set in Titan One from file://, and no heading overflows or wraps where it did not',
    viewports: ['desktop', 'mobile'],
    fileUrl: true,
    async run(t) {
      // the lines each visible heading is painted on, whether it stays inside its panel, and the family it computes to
      const heads = () => t.page.evaluate(() => [...document.querySelectorAll('#screens h1, #screens h2, #screens .subtitle')].filter((h) => h.offsetParent !== null).map((h) => {
        const r = document.createRange(); r.selectNodeContents(h); const tops = [];
        for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((x) => Math.abs(x - q.top) < 4)) tops.push(q.top);
        const box = (h.closest('.panel') || h.closest('.title-wrap') || document.body).getBoundingClientRect(), tr = r.getBoundingClientRect();
        return { text: h.textContent.trim(), lines: tops.length, inside: tr.left >= box.left - 1 && tr.right <= box.right + 1, fam: getComputedStyle(h).fontFamily, whole: h.scrollWidth <= h.clientWidth + 1 || getComputedStyle(h).display === 'inline-block' };
      }));
      const fallback = (on) => t.page.evaluate((o) => { if (o) document.documentElement.style.setProperty('--font-title', 'var(--font-head)'); else document.documentElement.style.removeProperty('--font-title'); return document.fonts.ready.then(() => true); }, on);
      const show = {
        title: () => t.game('scene', 'title'), map: () => t.game('scene', 'map'), settings: () => t.game('scene', 'settings'), help: () => t.game('scene', 'help'),
        notebook: () => t.game('scene', 'notebook'), records: () => t.game('scene', 'records'), credits: () => t.game('scene', 'credits'), scores: () => t.game('scene', 'scores'),
        pause: () => t.game('scene', 'pause'), win: () => t.game('scene', 'win'), fail: () => t.game('scene', 'fail'), finale: () => t.game('scene', 'finale'),
        over: () => t.page.evaluate(() => { window.__CR.screens.show('over', { res: { rows: 42, score: 12345 }, rank: -1, newBest: true, daily: null, earned: [], cause: 'chomp' }); }),
      };
      for (let n = 1; n <= 15; n++) show['intro l' + n] = () => t.game('newGame', { level: 'l' + n, intro: true, seed: 3 });
      show['intro run'] = () => t.game('newGame', { mode: 'endless', intro: true, seed: 3 });
      let seen = 0;
      for (const scale of [1, 1.5]) {
        await t.game('setState', { settings: { textScale: scale } });
        for (const [name, go] of Object.entries(show)) {
          await go(); await t.waitFrames(2);
          await fallback(false); const now = await heads(); await fallback(true); const was = await heads(); await fallback(false);
          t.equal(now.length, was.length, name + ' x' + scale + ': the same headings are shown');
          now.forEach((h, i) => {
            seen++;
            t.expect(/^"?Titan One/.test(h.fam), name + ' x' + scale + ': "' + h.text + '" computes to Titan One first: ' + h.fam);
            t.expect(h.inside || !(was[i] && was[i].inside), name + ' x' + scale + ': "' + h.text + '" stays inside its panel (where it did before)');
            t.expect(h.lines <= (was[i] ? was[i].lines : 99), name + ' x' + scale + ': "' + h.text + '" is on ' + h.lines + ' lines, it was on ' + (was[i] && was[i].lines));
          });
        }
      }
      t.expect(seen >= 50, 'checked a good number of headings: ' + seen);
      t.expect(await t.page.evaluate(() => document.fonts.check('16px "Titan One"')), 'the face is loaded');
      t.expect(await t.page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Titan One' && f.status === 'loaded')), 'the @font-face rule is in the page and loaded');
      await t.game('setState', { settings: { textScale: 1 } });
      await t.game('scene', 'title'); await t.waitFrames(2);
      // body text, small labels and buttons keep today's fonts
      const other = await t.page.evaluate(() => ({ btn: getComputedStyle(document.querySelector('#screens .btn')).fontFamily, body: getComputedStyle(document.querySelector('#screens .fineprint')).fontFamily }));
      t.expect(!/Titan/.test(other.btn) && !/Titan/.test(other.body), 'buttons and small print keep their fonts: ' + JSON.stringify(other));
      await keep(t, 'C4-03', 'title');
      await t.game('scene', 'pause'); await t.waitFrames(2); await keep(t, 'C4-03', 'menu-heading');
      await show.over(); await t.waitFrames(2); await keep(t, 'C4-03', 'run-over');
      await t.game('scene', 'credits'); await t.waitFrames(2);
      t.expect(await t.page.evaluate(() => /Titan One/.test(document.querySelector('.panel').textContent) && /SIL Open Font License/.test(document.querySelector('.panel').textContent)), 'Credits name the face and its licence');
    },
  },
  {
    name: 'C4-03 the sideways and small-phone title still fits, with the new face',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const [w, h] of [[844, 390], [667, 375], [390, 844], [360, 640], [320, 568]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('scene', 'title'); await t.waitFrames(2);
        const r = await t.page.evaluate(() => {
          const view = { w: innerWidth, h: innerHeight }, bad = [];
          for (const b of document.querySelectorAll('#screens .btn, #screens h1, #screens .subtitle')) { const q = b.getBoundingClientRect(); if (q.right > view.w + 1 || q.left < -1) bad.push(b.textContent.trim() + ' sideways'); }
          const last = [...document.querySelectorAll('#screens .menu .btn')].pop().getBoundingClientRect();
          return { bad, bottom: last.bottom, h: view.h, more: !!document.querySelector('.screens.title.more') };
        });
        t.equal(r.bad, [], w + 'x' + h + ': nothing pushed off the side: ' + r.bad.join(', '));
        t.expect(r.bottom <= r.h + 1 || r.more, w + 'x' + h + ': the last menu button is on screen (' + r.bottom.toFixed(0) + ' of ' + r.h + '), or the page says scroll for more');
        if (w === 844) await keep(t, 'C4-03', 'title-844x390');
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
    },
  },
];
