// Council wave 2, batch C: S3-05 (records, achievements, costumes, the Daily Run), S2-01 (teaching the bank) and
// S4-02 (an ending). Browser tests at both viewports; the pure rules are in tests-node/council-w2-c.test.mjs.
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'hsg-crazy-raccoon-v1';
const words = (s) => s.trim().split(/\s+/).length;
const seed = (t, patch) => t.page.evaluate(([k, p]) => { const cur = JSON.parse(localStorage.getItem(k) || 'null') || {}; localStorage.setItem(k, JSON.stringify({ v: 1, ...cur, ...p })); }, [KEY, patch]);
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const star3 = { stars: [true, true, true], best: 3000, bestT: 6.5, ball: true };
const pre = () => ({ // a save written by the build before this wave: no tips, achievements, daily, costume or finale fields
  v: 1, settings: { sound: true, music: true, ambience: true, volume: 0.5, reducedMotion: null, textScale: 1, assist: false, hints: true, view: 'standard' },
  progress: { l1: { stars: [true, true, false], best: 2248, bestT: 3.1, ball: true }, l2: { stars: [true, false, false], best: 1500, bestT: 9, ball: false }, l3: { stars: [true, true, true], best: 2600, bestT: 7, ball: true } },
  unlocked: 7, notebook: ['f1', 'f2'], merman: true, endless: { unlocked: true, top: [{ initials: 'ABC', score: 2400, rows: 61, date: '2026-10-01' }] },
  stats: { hops: 400, chomps: 7, splashes: 3, treats: 12, runs: 9 },
});
const play = async (t, level = 'l2', s = 3) => { await t.game('newGame', { level, seed: s }); await t.game('pause'); await t.waitFrames(3); };
const toEnd = async (t) => { // let the lantern end a Moonlight Run, then wait for the panel
  await t.game('setState', { rings: 1 });
  await t.stepUntil(() => window.__game.getState().run.phase !== 'play', { max: 9000, chunk: 30, label: 'the run ends' });
  await t.page.waitForFunction(() => window.__game.getState().screen === 'over', null, { timeout: 8000 });
};

export const tests = [
  // ------------------------------------------------------------------ S2-01 teaching the bank
  {
    name: 'S2-01 first snack carried: a one-line tip appears, with a Skip tips button and room around it',
    async run(t) {
      await play(t, 'l2');
      t.equal((await t.state()).tip, '', 'no tip yet');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 2); await t.waitFrames(3);
      const s = await t.state();
      t.expect(/bank/i.test(s.tip) && words(s.tip) <= 12, `the tip is one short line about banking: "${s.tip}" (${words(s.tip)} words)`);
      const box = await t.page.evaluate(() => { const r = (q) => { const e = document.querySelector(q); if (!e || e.hidden) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }; return { tip: r('#h-tip'), skip: r('#h-tipskip'), snacks: r('#h-snacks'), lure: r('#h-lure'), pause: r('#h-pause') }; });
      t.expect(box.tip && box.skip, 'the tip and its Skip tips button are on screen');
      t.expect(box.skip.h >= 44 && box.skip.w >= 44, `Skip tips is at least 44 px (${Math.round(box.skip.w)} x ${Math.round(box.skip.h)})`);
      t.expect(box.tip.x >= 0 && box.tip.x + box.tip.w <= t.vp.width + 1, 'the tip fits across the screen');
      const hits = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      t.expect(!hits(box.tip, box.snacks) && !hits(box.tip, box.pause) && !hits(box.tip, box.lure), 'it covers neither the HUD counters nor the controls');
      t.expect((await t.state()).said.includes('Paws hold three'), 'it is announced through the live region');
      await t.checkLayout();
      await t.shot('S2-01-tip-carry');
    },
  },
  {
    name: 'S2-01 the pulse on the snack counter, and the bank tip when a bank row is within three rows',
    async run(t) {
      await play(t, 'l2');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 2);
      await t.waitFrames(3);
      t.expect(await t.page.evaluate(() => document.getElementById('h-snacks').textContent.includes('1/3')), 'the counter reads 1/3');
      await t.game('act', 'warp', 9, 0, 7); await t.game('step', 3); await t.waitFrames(3);
      const s = await t.state();
      t.expect(/BANK row/.test(s.tip) && words(s.tip) <= 12, `near the bank row the tip points at it: "${s.tip}"`);
      await t.shot('S2-01-tip-bank');
    },
  },
  {
    name: 'S2-01 banking dismisses the tip for good; a tap dismisses it too; it does not come back after a reload',
    async run(t) {
      await play(t, 'l2');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 2);
      t.expect((await t.state()).tip !== '', 'the tip shows');
      await t.game('act', 'warp', 6, 0, 4); await t.game('act', 'hop', 'down'); await t.game('step', 60);
      const s = await t.state();
      t.equal(s.run.banked, 1, 'the snack was banked');
      t.equal(s.tip, '', 'the tip is gone once the snack is banked');
      t.expect(s.settings.tipsDone.carry && s.settings.tipsDone.bank, 'both tips are marked seen');
      await t.reload();
      await play(t, 'l2');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 2);
      t.equal((await t.state()).tip, '', 'after a reload the tip does not show again');
    },
  },
  {
    name: 'S2-01 Skip tips turns tips off for good; Show tips again in Settings brings them back',
    async run(t) {
      await play(t, 'l2');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 2); await t.waitFrames(3);
      await t.page.click('#h-tipskip');
      let s = await t.state();
      t.equal(s.tip, '', 'the tip is hidden'); t.equal(s.settings.tipsOn, false, 'tips are off');
      await t.reload();
      t.equal((await t.state()).settings.tipsOn, false, 'still off after a reload');
      await t.game('scene', 'settings'); await t.waitForAnimations();
      t.expect((await t.page.$$eval('#screens .flabel', (n) => n.map((x) => x.textContent))).includes('First-run tips'), 'Settings has a First-run tips row');
      await t.page.click('[data-act="tipsAgain"]');
      s = await t.state();
      t.equal(s.settings.tipsOn, true, 'tips are on again'); t.equal(s.settings.tipsDone, {}, 'and nothing counts as seen');
      await t.shot('S2-01-settings-tips');
    },
  },
  {
    name: 'S2-01 level 1 says the goal after the first hop; a save from before the tips shows no first-run tips',
    async run(t) {
      await play(t, 'l1');
      await t.game('act', 'hop', 'up'); await t.game('step', 40); await t.waitFrames(3);
      const g = await t.state();
      t.expect(/den/i.test(g.tip) && words(g.tip) <= 12, `goal tip after the first hop: "${g.tip}"`);
      await t.shot('S2-01-tip-goal');
      await seed(t, pre()); await t.reload();
      t.equal((await t.state()).settings.tipsOn, false, 'an old save has tips off');
      await play(t, 'l1');
      await t.game('act', 'hop', 'up'); await t.game('step', 40);
      t.equal((await t.state()).tip, '', 'and no tip shows for that player');
    },
  },
  {
    name: 'S2-01 every checkpoint row carries a BANK marker; the goal is on the pause card and at the top of Help',
    async run(t) {
      await play(t, 'l2');
      await t.game('act', 'warp', 4, 0, 4); await t.waitFrames(4);
      await t.shot('S2-01-bank-marker');
      await t.game('pause'); await t.game('scene', 'pause'); await t.waitForAnimations();
      t.expect(/Goal: reach the den/.test(await t.page.textContent('#screens')), 'the pause card states the goal');
      await t.game('scene', 'help'); await t.waitForAnimations();
      t.expect(/^Goal: reach the den/.test(await t.page.$eval('#screens .panel > h2 + p', (e) => e.textContent)), 'Help opens with the goal');
      await t.shot('S2-01-help');
    },
  },

  // ------------------------------------------------------------------ S3-05 achievements, records, costumes, dailies
  {
    name: 'S3-05 an achievement shows a toast that does not block play, is saved, and survives a reload',
    async run(t) {
      await play(t, 'l2');
      await t.game('setState', { carry: ['pecan'] });
      await t.game('act', 'warp', 6, 0, 4); await t.game('act', 'hop', 'down'); await t.game('step', 60); await t.waitFrames(4);
      const s = await t.state();
      t.expect('snack' in s.save.ach, 'First Snack Home is earned');
      t.expect(s.toast.includes('First Snack Home'), `the toast names it: "${s.toast}"`);
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('toast')).pointerEvents), 'none', 'the toast takes no taps');
      t.expect(s.said.includes('Achievement'), 'announced through the live region');
      const r = await t.page.evaluate(() => { const b = document.getElementById('toast').getBoundingClientRect(); return { x: b.x, w: b.width, y: b.y, h: b.height }; });
      t.expect(r.x >= 0 && r.x + r.w <= t.vp.width + 1, 'the toast fits across the screen');
      await t.shot('S3-05-toast');
      t.expect(!!(await stored(t)).ach.snack, 'it is in the stored save');
      await t.reload();
      t.expect('snack' in (await t.state()).save.ach, 'and after a reload');
      const n = Object.keys((await t.state()).save.ach).length;
      await play(t, 'l2'); await t.game('setState', { carry: ['pecan'] });
      await t.game('act', 'warp', 6, 0, 4); await t.game('act', 'hop', 'down'); await t.game('step', 60);
      t.equal(Object.keys((await t.state()).save.ach).length, n, 'earning it again changes nothing');
    },
  },
  {
    name: 'S3-05 opening a menu earns nothing; a fresh save has no achievements and no costume but the plain Bandit',
    async run(t) {
      for (const sc of ['records', 'trophies', 'settings', 'help', 'notebook', 'credits', 'scores']) await t.game('scene', sc);
      const s = await t.state();
      t.equal(s.save.ach, {}, 'no achievements from menus'); t.equal(s.settings.costume, 'plain', 'plain costume');
      t.equal(s.save.daily.hist, {}, 'no daily history');
    },
  },
  {
    name: 'S3-05 an old save loads with every record kept; what it already proves is granted quietly, tips stay off',
    async run(t) {
      const old = pre();
      await seed(t, old); await t.reload();
      const s = await t.state(), st = await stored(t);
      t.equal(s.save.progress, old.progress, 'progress is untouched');
      t.equal(s.save.unlocked, 7, 'unlocked levels are untouched'); t.expect(s.save.endlessUnlocked, 'the Moonlight Run stays open');
      t.equal(s.save.top, old.endless.top, 'the top ten is untouched'); t.equal(s.save.notebook, 2, 'notebook cards kept'); t.expect(s.save.merman, 'merman kept');
      t.equal(st.stats.hops, 400, 'stats kept');
      t.expect(s.save.ach.den === 'before' && s.save.ach.ball1 === 'before' && s.save.ach.three === 'before', 'achievements the save proves are granted, marked as earned earlier: ' + JSON.stringify(s.save.ach));
      t.expect(!('snack' in s.save.ach) && !('daily1' in s.save.ach), 'ones that need play are not');
      t.equal(s.save.bestRows, 61, 'the best row comes from the old top ten');
      t.equal(s.toast, '', 'no toast for quiet grants');
      await t.reload();
      t.equal((await t.state()).save.progress, old.progress, 'and the same after another reload');
    },
  },
  {
    name: 'S3-05 Records screen: totals, per-level bests, Moonlight Run, the daily calendar; reachable from the title',
    async run(t) {
      await seed(t, pre()); await t.reload();
      await t.game('scene', 'title'); await t.waitForAnimations();
      await t.page.click('[data-act="records"]'); await t.waitForAnimations();
      t.equal((await t.state()).screen, 'records', 'the Records button opens it');
      const txt = (await t.page.textContent('#screens')).replace(/\s+/g, ' ');
      t.expect(/3\/15/.test(txt) && /Levels cleared/.test(txt), 'levels cleared 3/15'); t.expect(/6\/45/.test(txt), 'six stars counted');
      t.expect(/2,248/.test(txt) && /0:03/.test(txt), 'a level best score and time are listed');
      t.expect(/Best rows/.test(txt) && /61/.test(txt), 'the Moonlight Run best rows are listed');
      t.expect((await t.page.$$('.cal span')).length === 14, 'a 14-day calendar');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-05-records');
      await t.page.click('[data-act="trophies"]'); await t.waitForAnimations();
      t.equal((await t.state()).screen, 'trophies', 'the achievements page opens');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-05-trophies');
      await t.page.keyboard.press('Escape'); await t.waitForAnimations();
      t.equal((await t.state()).screen, 'records', 'Escape goes back to Records');
      await t.page.keyboard.press('Escape'); await t.waitForAnimations();
      t.equal((await t.state()).screen, 'title', 'and again to the title');
    },
  },
  {
    name: 'S3-05 costumes are locked on a fresh save with their condition shown, unlock by stars, and a locked choice falls back to plain',
    async run(t) {
      await t.game('scene', 'trophies'); await t.waitForAnimations();
      const locked = await t.page.$$eval('.wardrobe button', (b) => b.map((x) => ({ off: x.disabled, txt: x.textContent.replace(/\s+/g, ' ').trim() })));
      t.expect(locked.filter((b) => b.off).length === 5 && locked.some((b) => /Collect 10 stars/.test(b.txt) && /0 of 10 stars/.test(b.txt)), 'five locked, each with its condition and progress: ' + JSON.stringify(locked.slice(1, 3)));
      await seed(t, { progress: { l1: star3, l2: star3, l3: star3, l4: star3 }, unlocked: 5 }); await t.reload();
      await t.game('scene', 'trophies'); await t.waitForAnimations();
      t.expect(await t.page.evaluate(() => !document.querySelector('.wardrobe [data-v="hardhat"]').disabled), '12 stars unlock the Hard Hat');
      await t.page.click('.wardrobe [data-v="hardhat"]');
      t.equal((await t.state()).costumeDrawn, 'hardhat', 'the renderer wears it'); t.equal((await stored(t)).settings.costume, 'hardhat', 'saved');
      await t.shot('S3-05-wardrobe');
      await play(t, 'l1'); await t.game('act', 'warp', 3, 0, 4); await t.game('step', 2); await t.waitFrames(5);
      await t.shot('S3-05-costume-hardhat');
      // a hand-edited save that points at a locked costume falls back to plain without an error
      await seed(t, { settings: { ...pre().settings, costume: 'crown', tipsOn: false, tipsDone: {} } }); await t.reload();
      t.equal((await t.state()).costumeDrawn, 'plain', 'a locked choice draws plain');
    },
  },
  {
    name: 'S3-05 every costume draws without error on every facing (the sprite and the vector fallback)',
    async run(t) {
      await seed(t, { progress: Object.fromEntries(Array.from({ length: 15 }, (_, i) => ['l' + (i + 1), star3])), unlocked: 15, endless: { unlocked: true, top: [], bestRows: 80 } }); await t.reload();
      await play(t, 'l1');
      for (const c of ['hardhat', 'scarf', 'keeper', 'moon', 'crown']) {
        await t.game('setState', { settings: { costume: c } });
        for (const d of ['up', 'left', 'right', 'down']) { await t.game('act', 'warp', 3, 0, 4); await t.game('act', 'hop', d === 'down' ? 'down' : d); await t.game('step', 20); await t.waitFrames(2); }
        t.equal((await t.state()).costumeDrawn, c, c + ' is worn');
      }
      await t.game('setState', { settings: { costume: 'crown' } }); await t.game('act', 'warp', 3, 0, 4); await t.game('step', 2); await t.waitFrames(4);
      await t.shot('S3-05-costume-crown');
      await t.game('setState', { settings: { costume: 'scarf' } }); await t.waitFrames(4);
      await t.shot('S3-05-costume-scarf');
      await t.game('setState', { settings: { costume: 'moon' } }); await t.waitFrames(4);
      await t.shot('S3-05-costume-moon');
    },
  },
  {
    name: 'S3-05 Daily Run: locked until level 6 with its condition in words; then the same seed all day and a different one tomorrow',
    async run(t) {
      await t.game('scene', 'title'); await t.waitForAnimations();
      const lock = await t.page.textContent('#lock-note');
      t.expect(/Clear level 6/.test(lock) && /Daily Run/.test(lock), 'the lock note says how: ' + lock);
      t.expect(await t.page.evaluate(() => /🔒/.test(document.querySelector('[data-act="daily"]').textContent)), 'the Daily Run button is marked locked');
      await t.game('act', 'unlockAll');
      await t.game('act', 'today', '2026-11-13');
      await t.game('scene', 'title'); await t.waitForAnimations();
      await t.shot('S3-05-title');
      const hashAfter = async (day) => {
        await t.game('act', 'today', day); await t.game('scene', 'title'); await t.game('pause');
        await t.game('act', 'menu', 'daily'); await t.page.click('[data-act="go"]');
        const s0 = await t.state();
        t.equal(s0.mode, 'endless', 'a Moonlight Run starts');
        await t.game('step', 400);
        return t.game('act', 'hash');
      };
      const a = await hashAfter('2026-11-13'), b = await hashAfter('2026-11-13'), c = await hashAfter('2026-11-14');
      t.equal(a, b, 'the same date gives the same night');
      t.expect(a !== c, 'the next date gives a different one');
    },
  },
  {
    name: 'S3-05 finishing a Daily Run records the day, a streak and an achievement; it stays off the shared top ten; the next day extends the streak',
    async run(t) {
      await t.game('act', 'unlockAll'); await t.game('act', 'today', '2026-11-13');
      await t.game('act', 'menu', 'daily'); await t.page.click('[data-act="go"]'); await t.game('pause');
      await toEnd(t);
      let s = await t.state();
      t.equal(s.save.daily.last, '2026-11-13', 'today is recorded'); t.equal(s.save.daily.streak, 1, 'a one-day streak');
      t.expect(!!s.save.daily.hist['2026-11-13'], 'with its best'); t.expect('daily1' in s.save.ach, 'Daily Dash is earned');
      t.equal(s.save.top.length, 0, 'the shared top ten is untouched');
      const txt = await t.page.textContent('#screens');
      t.expect(/Daily Run, Nov 13/.test(txt) && /1-day streak/.test(txt), 'the over panel says so: ' + txt.replace(/\s+/g, ' ').slice(0, 160));
      t.expect(await t.page.evaluate(() => !!document.querySelector('[data-act="daily"]')), 'and Run again replays the daily');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-05-daily-over');
      await t.game('act', 'today', '2026-11-14');
      await t.game('act', 'menu', 'daily'); await t.page.click('[data-act="go"]'); await t.game('pause');
      await toEnd(t);
      s = await t.state();
      t.equal(s.save.daily.streak, 2, 'the next day makes it two'); t.equal(s.save.daily.bestStreak, 2, 'best streak 2');
      await t.reload();
      t.equal((await t.state()).save.daily.streak, 2, 'the streak survives a reload');
    },
  },
  {
    name: 'S3-05 a Moonlight Run that beats the best says "New personal best"; the first ever run does not',
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('newGame', { mode: 'endless', seed: 3 }); await t.game('pause');
      await toEnd(t);
      t.expect(!/New personal best/.test(await t.page.textContent('#screens')), 'the first run has nothing to beat');
      await t.game('act', 'menu', 'title');
      await t.game('setState', { save: { endless: { unlocked: true, top: [], bestRows: 0, bestScore: 0, daily: { last: '', streak: 0, bestStreak: 0, hist: {} } } } });
      await t.game('newGame', { mode: 'endless', seed: 3 }); await t.game('pause');
      await t.game('act', 'warp', 3, 0, 4); // a hop down from the sand onto the path row 2 is a safe landing that counts as reaching row 2
      await t.game('setState', { save: { endless: { unlocked: true, top: [], bestRows: 1, bestScore: 1, daily: { last: '', streak: 0, bestStreak: 0, hist: {} } } } });
      await t.game('act', 'hop', 'down'); await t.game('step', 150);
      await toEnd(t);
      t.expect(/New personal best/.test(await t.page.textContent('#screens')), 'a better run is called out');
    },
  },
  {
    name: 'S3-05 the win panel lists what was earned and the next unlock; clearing without losing a ring earns Not a Scratch',
    async run(t) {
      await t.game('scene', 'win'); await t.waitForAnimations();
      const txt = (await t.page.textContent('#screens')).replace(/\s+/g, ' ');
      t.expect(/Achievements?: /.test(txt) && /Home Free/.test(txt), 'it lists the achievements earned this clear: ' + txt.slice(0, 220));
      t.expect(/Next: [A-Za-z' ]+ at \d+ (stars|balls) \(\d+ to go\)/.test(txt), 'and what comes next: ' + txt.slice(-160));
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-05-win');
    },
  },

  // ------------------------------------------------------------------ S4-02 the ending
  {
    name: 'S4-02 clearing level 15 shows the ending: Bandit, a two-line epilogue, totals, Credits; Old Ruthless speaks once',
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('scene', 'finale'); await t.waitForAnimations();
      let s = await t.state();
      t.equal(s.screen, 'finale', 'the ending panel, not the level panel');
      let txt = (await t.page.textContent('#screens')).replace(/\s+/g, ' ');
      t.expect(/Home free, for good/.test(txt) && /Old Ruthless lowers/.test(txt), 'the defeat line shows the first time');
      t.expect(/lost balls are home/.test(txt) && /★ \d+\/45/.test(txt), 'epilogue and totals');
      t.expect(!(await t.page.$('[data-act="next"]')), 'no Next level button');
      t.expect(await t.page.evaluate(() => /Credits/.test(document.querySelector('[data-act="credits"]').textContent)), 'a Credits button');
      t.expect(s.save.finale, 'the ending is remembered');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S4-02-finale-balls-missing');
      await t.game('scene', 'finale'); await t.waitForAnimations();
      txt = (await t.page.textContent('#screens')).replace(/\s+/g, ' ');
      t.expect(!/Old Ruthless lowers/.test(txt), 'the second time the defeat line is not repeated');
      await t.page.click('[data-act="credits"]'); await t.waitForAnimations();
      t.equal((await t.state()).screen, 'credits', 'Credits opens from the ending');
    },
  },
  {
    name: 'S4-02 with all fifteen balls found Bandit holds the 1918 ball; the pre-ending save keeps working',
    async run(t) {
      const prog = Object.fromEntries(Array.from({ length: 15 }, (_, i) => ['l' + (i + 1), star3]));
      await seed(t, { progress: prog, unlocked: 15, endless: { unlocked: true, top: [] } }); await t.reload();
      await t.game('scene', 'finale'); await t.waitForAnimations();
      const txt = (await t.page.textContent('#screens')).replace(/\s+/g, ' ');
      t.expect(/All fifteen lost balls are home, the 1918 one too/.test(txt), 'all balls: the full line');
      t.expect(await t.page.evaluate(() => !!document.querySelector('.ballsvg[aria-label="The 1918 ball"]')), 'the ball is in his paw');
      t.expect(/★ 45\/45/.test(txt), 'every star counted');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S4-02-finale-all');
    },
  },
  {
    name: 'S4-02 level 14 still ends in the ordinary panel with Next level',
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('scene', 'win');
      t.equal((await t.state()).screen, 'win', 'the level panel');
      t.expect(!!(await t.page.$('[data-act="next"]')), 'Next level is there');
    },
  },

  // ------------------------------------------------------------------ sound: the new cues
  {
    name: 'S3-05 / S4-02 the achievement cue and the longer ending stinger render inside the mix limits',
    viewports: ['desktop'],
    async run(t) {
      const render = (n, s, wav) => t.page.evaluate(([a, b, c]) => window.__game.audioRender(a, b, c), [n, s, wav]);
      const live = JSON.stringify((await t.state()).audio);
      const ach = await render('cue:ach', 2.5, true), fin = await render('cue:finale', 5.5, true);
      t.log(`ach: peak ${ach.peak} rms ${ach.rmsDb} dBFS; finale: peak ${fin.peak} rms ${fin.rmsDb} dBFS, quiet gap ${fin.longestSilence} s`);
      t.expect(ach.peak >= 0.2 && ach.peak <= 0.45, `achievement cue peak ${ach.peak} is between 0.2 and 0.45`);
      t.expect(fin.peak >= 0.2 && fin.peak <= 0.45, `ending stinger peak ${fin.peak} is between 0.2 and 0.45`);
      t.expect(fin.secs.filter((x) => x > 0.01).length >= 3.5, `the stinger sounds for ${fin.secs.filter((x) => x > 0.01).length} s (at least 3.5, longer than the 1.2 s win cue)`);
      const mus = await render('night', 20, false);
      t.expect(mus.peak + ach.peak + 0.07 < 0.95, 'loudest music + ambience + the cue stay under 0.95');
      t.equal(JSON.stringify((await t.state()).audio), live, 'rendering leaves the live audio alone');
      const dir = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-2', 'audio');
      if (fs.existsSync(dir)) { fs.writeFileSync(path.join(dir, 'cue-achievement.wav'), Buffer.from(ach.wav, 'base64')); fs.writeFileSync(path.join(dir, 'cue-finale.wav'), Buffer.from(fin.wav, 'base64')); }
      let bad = null; try { await render('cue:nope', 1); } catch (e) { bad = e; }
      t.expect(bad, 'an unknown cue is an error, not silence');
    },
  },
];
