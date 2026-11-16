// Council wave 4, batch B: S2-25 (a locked level says what unlocks it), C4-02 (the short "not affiliated" line on the title),
// S4-12 (Credits say how the art was made), P-N03 (a bite is not a successful hop), S6-17 (the Moonlight Run shows its
// course and can run it again), S3-09 (endless levels are solvable far past the old check), S6-03 (a lighter picture tier).
// Every check reads state or the page; none depends on a measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };

export const tests = [
  // ------------------------------------------------------------------ S2-25 locked levels say what unlocks them
  {
    name: 'S2-25 a locked level button says which level to clear first, and an open one does not',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'map'); await t.waitFrames(3);
      const labels = await t.page.$$eval('#screens .lvl', (b) => b.map((x) => ({ n: +x.querySelector('.n').textContent, label: x.getAttribute('aria-label'), off: x.disabled })));
      t.equal(labels.length, 15, 'fifteen level buttons');
      t.expect(!/Clear level/.test(labels[0].label) && !labels[0].off, 'level 1 is open and says nothing about clearing: ' + labels[0].label);
      for (const l of labels.filter((x) => x.off)) t.expect(l.label.endsWith(`locked. Clear level ${l.n - 1} first`), `level ${l.n}: ${l.label}`);
      t.expect(labels.filter((x) => x.off).length === 14, 'a new profile has fourteen locked');
      await t.game('setState', { save: { unlocked: 4 } }); await t.game('scene', 'map'); await t.waitFrames(3);
      const after = await t.page.$$eval('#screens .lvl', (b) => b.map((x) => x.getAttribute('aria-label')));
      t.expect(!/Clear level/.test(after[3]) && /Clear level 4 first/.test(after[4]), 'with four open, level 4 is open and level 5 asks for level 4: ' + after[3] + ' | ' + after[4]);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S2-25', 'map');
    },
  },
  // ------------------------------------------------------------------ C4-02 the title says it is not the real farm
  {
    name: 'C4-02 the title carries one short "not affiliated" line, in small type, at every size, with the full notice still in Credits',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const probe = () => t.page.evaluate(() => {
        const f = document.querySelector('.title-wrap .fineprint'), r = f.getBoundingClientRect(), root = document.getElementById('screens');
        const bs = [...document.querySelectorAll('.title-wrap button')].map((b) => b.getBoundingClientRect());
        return {
          text: f.textContent.trim(), count: [...document.querySelectorAll('.title-wrap .fineprint')].length, size: parseFloat(getComputedStyle(f).fontSize),
          inside: r.left >= 0 && r.right <= innerWidth + 0.5, vis: r.width > 0 && r.height > 0, bottom: r.bottom, scroll: root.scrollHeight - root.clientHeight,
          overlap: bs.some((b) => b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top),
          offscreen: bs.filter((b) => b.top < 0 || b.bottom > innerHeight + 0.5 || b.left < 0 || b.right > innerWidth + 0.5).length,
        };
      });
      const full = [[t.vp.width, t.vp.height, 'normal'], [844, 390, 'landscape'], [667, 375, 'small landscape']];
      for (const [w, h, what] of full) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.game('scene', 'title'); await t.waitFrames(4);
        const p = await probe();
        t.equal(p.text, 'A made-up caper at a real Hot Springs landmark. Not affiliated with the Arkansas Alligator Farm.', what + ': the line');
        t.expect(p.count === 1 && p.vis && p.inside && !p.overlap, what + ': one line, visible, inside the screen, clear of the buttons: ' + JSON.stringify(p));
        t.expect(p.size <= 14, what + ': small type (' + p.size + ' px)');
        t.equal(p.offscreen, 0, what + ': every title button is on screen');
        if (what === 'landscape') t.expect(p.scroll <= 1, 'landscape: nothing to scroll: ' + JSON.stringify(p));
        await keep(t, 'C4-02', what.replace(' ', '-'));
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
      await t.game('scene', 'title'); await t.waitFrames(3);
      t.expect(!/affiliated/i.test(await t.page.evaluate(() => window.__CR.lastSaid)), 'the live region announces only the heading, so a screen reader meets the line once, in the page');
      t.expect(await t.page.evaluate(() => { const f = document.querySelector('.title-wrap .fineprint'); return !f.closest('[aria-hidden="true"]') && !f.hasAttribute('aria-hidden'); }), 'and the line is not hidden from it');
      await t.game('scene', 'credits'); await t.waitFrames(3);
      const c = await t.page.evaluate(() => document.querySelector('.panel').textContent);
      t.expect(c.includes('A made-up raccoon caper at a real Hot Springs landmark. Not affiliated with the Arkansas Alligator Farm and Petting Zoo.'), 'Credits keeps the full notice word for word');
    },
  },
  // ------------------------------------------------------------------ S4-12 Credits say how the art was made
  {
    name: 'S4-12 Credits say in one plain line that the art is 3D block-outs painted with AI image tools, and no longer claim it was all made by hand',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'credits'); await t.waitFrames(3);
      const lines = await t.page.$$eval('.panel p', (p) => p.map((x) => x.textContent.trim()));
      t.equal(lines.filter((l) => l === 'Art: 3D block-outs painted with AI image tools for this game.').length, 1, 'the art line is there exactly once: ' + lines.join(' | '));
      t.expect(!lines.some((l) => /art and music made for this game/i.test(l)), 'nothing says "art ... made for this game" beside it');
      t.expect(lines.some((l) => /Code and music made for this game/.test(l)), 'the line about code and music is kept');
      t.expect(!/Codex|OpenAI|Blender|hand/i.test(lines.join(' ')), 'no company or product is named, and no hand finishing is claimed');
      t.expect(lines.some((l) => /Not affiliated with the Arkansas Alligator Farm and Petting Zoo/.test(l)), 'the full notice is still there');
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S4-12', 'credits');
    },
  },
  // ------------------------------------------------------------------ S6-17 the Moonlight Run's course is shown and can be run again
  {
    name: 'S6-17 the Over panel shows the Moonlight Run course number and "Run this course again" plays the same night; the Daily Run keeps its own button',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const lose = async () => {
        await t.game('pause');
        await t.game('setState', { rings: 1 });
        await t.stepUntil((s) => s.run.phase !== 'play', { max: 20000, chunk: 200, label: 'the lantern catches Bandit' });
        await t.game('resume');
        await t.page.waitForFunction(() => window.__game.getState().screen === 'over', null, { timeout: 15000 });
      };
      const course = () => t.page.evaluate(() => { const r = window.__CR.run; return { seed: r.seed, rows: JSON.stringify(r.L.rows.slice(0, 14)), steps: r.steps, daily: r.daily }; });
      // a Moonlight Run on a chosen course
      await t.game('act', 'unlockAll');
      await t.game('newGame', { mode: 'endless', seed: 777001 });
      const first = await course();
      t.equal(first.seed, 777001, 'the run is on course 777001');
      await lose();
      let text = await t.page.evaluate(() => document.querySelector('.panel').textContent);
      t.expect(/Course 777001./.test(text), 'the Over panel shows the course number: ' + text.slice(0, 160));
      const labels = await t.page.$$eval('#screens .menu button', (b) => b.map((x) => x.textContent.trim()));
      t.expect(labels.includes('Run this course again') && labels.includes('Run again'), 'both buttons are offered: ' + labels.join(', '));
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S6-17', 'over');
      await t.page.click('[data-act="sameCourse"]');
      await t.page.waitForFunction(() => window.__game.getState().screen === null && window.__game.getState().scene === 'play', null, { timeout: 5000 });
      const again = await course();
      t.equal(again.seed, 777001, 'the same course number');
      t.equal(again.rows, first.rows, 'and the same first rows');
      t.expect(again.steps < 40 && !again.daily, 'a fresh run (steps ' + again.steps + '), not the daily');
      // "Run again" is still a new random course, and a run with no chosen seed is not the daily's
      await lose();
      await t.page.evaluate(() => { window.__CR.nextSeed = null; }); // the test hook keeps the seed it was given; a player has none
      await t.page.click('[data-act="endless"]');
      await t.page.waitForFunction(() => window.__game.getState().screen === 'intro', null, { timeout: 5000 });
      await t.game('act', 'menu', 'go');
      const fresh = await t.page.evaluate(() => ({ seed: window.__CR.run.seed, daily: window.__CR.run.daily }));
      t.expect(fresh.seed !== 777001 && !fresh.daily && Number.isInteger(fresh.seed), 'Run again plays a new random course: ' + fresh.seed);
      // the Daily Run is the same course all day already: it shows no course number and offers no second button
      await t.game('act', 'menu', 'daily'); await t.game('act', 'menu', 'go');
      t.expect(await t.page.evaluate(() => !!window.__CR.run.daily), 'a Daily Run is running');
      await lose();
      text = await t.page.evaluate(() => document.querySelector('.panel').textContent);
      t.expect(!/Course d/.test(text) && !(await t.page.$('[data-act="sameCourse"]')), 'the Daily Run panel has no course line and no second button');
    },
  },
];
