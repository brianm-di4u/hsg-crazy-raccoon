// Council wave 4, batch B: S2-25 (a locked level says what unlocks it), C4-02 (the short "not affiliated" line on the title),
// S4-12 (Credits say how the art was made), P-N03 (a bite is not a successful hop), S6-17 (the Moonlight Run shows its
// course and can run it again), S3-09 (endless levels are solvable far past the old check), S6-03 (a lighter picture tier).
// Every check reads state or the page; none depends on a measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('screenshots', 'council', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); fs.mkdirSync(SHOTS, { recursive: true }); fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };

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
      t.expect(!/Course \d+/.test(text) && !(await t.page.$('[data-act="sameCourse"]')), 'the Daily Run panel has no course line and no second button');
    },
  },
  // ------------------------------------------------------------------ S6-03 a lighter picture for slow devices
  {
    name: 'S6-03 Settings has a Picture detail row (Auto, Full, Light) that is saved, and Light caps the particles, the canvas and the night glow',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const q = async () => (await t.state()).quality;
      await t.game('scene', 'settings'); await t.waitForAnimations();
      const labels = await t.page.$$eval('#screens .flabel', (n) => n.map((x) => x.textContent));
      t.expect(labels.includes('Picture detail'), 'the row is in Settings: ' + labels.join(', '));
      const sizes = await t.page.$$eval('[data-k="quality"]', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return [x.textContent.trim(), Math.round(r.width), Math.round(r.height), x.getAttribute('aria-pressed')]; }));
      t.equal(sizes.map((x) => x[0]).join(','), 'Auto,Full,Light', 'three choices');
      t.expect(sizes.every((x) => x[1] >= 44 && x[2] >= 44), 'each at least 44 px: ' + JSON.stringify(sizes));
      t.equal(sizes[0][3], 'true', 'Auto is the default');
      t.equal((await q()).lite, false, 'and the full picture is what is drawn');
      await t.page.$eval('[data-k="quality"][data-v="light"]', (b) => b.scrollIntoView({ block: 'center' }));
      await keep(t, 'S6-03', 'settings');
      await t.page.click('[data-k="quality"][data-v="light"]');
      await t.page.waitForFunction(() => window.__game.getState().quality.lite === true);
      const lite = await q();
      t.equal(lite.setting, 'light', 'Light is pinned');
      t.equal(lite.fxScale, 0.5, 'the particle cap halves');
      await t.page.waitForFunction(() => window.__game.getState().quality.dpr === Math.min(1.5, window.devicePixelRatio));
      await t.reload();
      t.equal((await q()).setting, 'light', 'the choice survives a reload');
      t.equal((await q()).lite, true, 'and the page comes back light');
      await t.game('scene', 'settings');
      await t.page.click('[data-k="quality"][data-v="full"]');
      await t.page.waitForFunction(() => window.__game.getState().quality.lite === false);
      t.equal((await q()).fxScale, 1, 'Full restores the particles');
      await t.page.waitForFunction(() => window.__game.getState().quality.dpr === Math.min(2, window.devicePixelRatio));
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S6-03 Auto goes light only after a window of measured slow frames, never on a steady 60 or on stalls, and Full and Light stay pinned',
    viewports: ['desktop'],
    async run(t) {
      const feed = (ms, n) => t.game('act', 'frames', Array.from({ length: n }, () => ms));
      let q = await feed(16.7, 300);
      t.equal(q.lite, false, 'a steady 60 stays full');
      q = await feed(7, 300);
      t.equal(q.lite, false, 'and so does a 144 Hz screen');
      q = await t.game('act', 'frames', Array.from({ length: 300 }, (_, i) => (i % 3 === 0 ? 900 : 16.7)));
      t.equal(q.lite, false, 'stalls (a hidden tab, a long pause) are not slow frames');
      q = await feed(24, 300);
      t.equal(q.lite, false, 'a 24 ms frame (about 42 per second) is under the line');
      q = await feed(40, 60);
      t.equal(q.lite, false, 'a short run of slow frames, less than the window, is not enough');
      q = await feed(40, 120);
      t.expect(q.lite && q.auto, 'a window of 40 ms frames (25 per second) lightens the picture: ' + JSON.stringify(q));
      t.equal(q.fxScale, 0.5, 'with the smaller particle cap');
      q = await feed(7, 600);
      t.expect(q.lite, 'and it stays light for the visit once it has gone light');
      // pinned Full: never lightens
      await t.reload();
      await t.game('setState', { settings: { quality: 'full' } });
      q = await feed(60, 500);
      t.expect(!q.lite && !q.auto, 'Full is never lightened by slow frames: ' + JSON.stringify(q));
      await t.game('setState', { settings: { quality: 'light' } });
      t.equal((await t.state()).quality.lite, true, 'Light is light at once, with no frames measured');
      await t.game('setState', { settings: { quality: 'auto' } });
      t.equal((await t.state()).quality.lite, false, 'and Auto, with nothing measured, is full');
      // reduced motion keeps its own, smaller particle cap
      await t.game('setState', { settings: { quality: 'light', reducedMotion: true } });
      t.equal((await t.state()).quality.fxScale, 0.4, 'reduced motion keeps 0.4');
    },
  },
  {
    name: 'S6-03 the light picture draws fewer particles and leaves out the night beam cones, counted on one fixed frame',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l13', seed: 5 });
      await t.game('pause');
      await t.game('setState', { settings: { quality: 'full', reducedMotion: false }, player: { row: 4, col: 4 } });
      const measure = () => t.page.evaluate(() => {
        const A = window.__CR, g = A.renderer.g, n = { fill: 0, grad: 0 }, f = g.fill, cg = g.createRadialGradient;
        A.renderer.fx.clear(); // nothing from an earlier count is drawn into this one
        g.fill = function (...a) { n.fill++; return f.apply(this, a); };
        g.createRadialGradient = function (...a) { n.grad++; return cg.apply(this, a); };
        try { A.renderer.draw(A.run, { time: 5, alpha: 0 }); } finally { delete g.fill; delete g.createRadialGradient; }
        A.renderer.fx.clear();
        for (let i = 0; i < 40; i++) A.renderer.fx.splash(1000 + i, 3);
        return { ...n, particles: A.renderer.fx.p.length };
      });
      const full = await measure();
      await t.page.evaluate(() => { window.__CR.renderer.fx.clear(); }); await keep(t, 'S6-03', 'night-full');
      await t.game('setState', { settings: { quality: 'light' } });
      const light = await measure();
      await t.page.waitForFunction(() => window.__game.getState().quality.dpr === Math.min(1.5, window.devicePixelRatio));
      await t.page.evaluate(() => { window.__CR.renderer.fx.clear(); }); await keep(t, 'S6-03', 'night-light');
      t.equal(full.particles, 500, 'forty splashes fill the full cap of 500 particles: ' + JSON.stringify(full));
      t.equal(light.particles, 250, 'and half of it in the light picture: ' + JSON.stringify(light));
      t.expect(light.fill < full.fill, 'the night frame has fewer filled shapes (the beam cones): ' + full.fill + ' full, ' + light.fill + ' light');
      t.expect(light.grad <= full.grad, 'and no more gradients (fewer when a lantern is in view): ' + full.grad + ' full, ' + light.grad + ' light');
      await t.page.waitForFunction(() => window.__game.getState().quality.dpr === Math.min(1.5, window.devicePixelRatio));
      await t.game('setState', { settings: { quality: 'full' } });
    },
  },
];
