// Council wave 3, batch C: S2-18 (Help shows Stars and Tail rings before the gator list), S3-18 (the ending points to
// the Moonlight Run), S2-03 (a second failure in a row offers Assist), S2-16 (the Moonlight Run's snack counter waits
// for a snack), S2-19 (the level 1 hint stays at least 2.5 s), P-N02 (the Moonlight Run's Over panel names the cause).
// The retunes (S3-02, S3-03) are pinned in tests-node/council-w3-c.test.mjs.
const KEY = 'hsg-crazy-raccoon-v1';
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const panelText = (t) => t.page.evaluate(() => (document.querySelector('.panel') || {}).textContent || '');
const visible = (t, sel) => t.page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getBoundingClientRect().width > 0; }, sel);

export const tests = [
  // ------------------------------------------------------------------ S2-18 Help
  {
    name: 'S2-18 Help lists Stars and Tail rings before Gators, and on a phone they sit in the first screenful of the panel',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'help'); await t.waitFrames(3);
      const h = await t.page.evaluate(() => {
        const hs = [...document.querySelectorAll('.panel h3')], pn = document.querySelector('.panel').getBoundingClientRect();
        const at = (name) => { const e = hs.find((x) => x.textContent === name); const b = e.getBoundingClientRect(); return { top: b.top - pn.top, order: hs.indexOf(e) }; };
        return { stars: at('Stars'), rings: at('Tail rings'), gators: at('Gators'), panelH: pn.height };
      });
      t.expect(h.stars.order < h.gators.order && h.rings.order < h.gators.order, 'Stars and Tail rings come before Gators in reading order: ' + JSON.stringify(h));
      const phone = await t.page.evaluate(() => innerWidth < 600);
      if (phone) {
        t.expect(h.stars.top < h.panelH - 120 && h.rings.top < h.panelH - 60, 'on a phone both are on the first screen of the panel without scrolling: ' + JSON.stringify(h));
        t.expect(h.gators.top > h.rings.top, 'and the gator list follows them');
      }
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S2-18-help');
    },
  },
  // ------------------------------------------------------------------ S3-18 ending
  {
    name: 'S3-18 the ending points on to the Moonlight Run',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'finale'); await t.waitFrames(3);
      t.equal((await t.state()).screen, 'finale', 'the ending panel is up');
      t.expect(await t.page.evaluate(() => [...document.querySelectorAll('.finale .epilogue')].some((e) => /Moonlight Run/.test(e.textContent))), 'a line of the ending names the Moonlight Run');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-18-finale');
    },
  },
  // ------------------------------------------------------------------ S2-03 Assist offer
  {
    name: 'S2-03 the first failure has no Assist button, the second in a row has one, and it turns Assist on and restarts',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'fail'); await t.waitFrames(3);
      t.equal(await visible(t, '[data-act="assistOn"]'), false, 'no offer after the first failure');
      await t.game('scene', 'fail'); await t.waitFrames(3);
      t.equal(await visible(t, '[data-act="assistOn"]'), true, 'offered after the second failure in a row');
      const txt = await panelText(t);
      t.expect(/slower gators/i.test(txt) && /\+2 tail rings/.test(txt), 'with what it does in plain words: ' + txt);
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S2-03-fail-assist');
      t.equal((await t.state()).settings.assist, false, 'Assist is off until it is chosen');
      await t.page.click('[data-act="assistOn"]');
      await t.page.waitForFunction(() => { const s = window.__game.getState(); return s.screen === null && s.run && s.run.phase === 'play'; }, null, { timeout: 5000 });
      const s = await t.state();
      t.equal(s.settings.assist, true, 'Assist is on');
      t.equal(s.run.rings, 7, 'the level restarted with its five rings and two more');
      t.equal((await stored(t)).settings.assist, true, 'and it is saved');
      await t.game('scene', 'fail'); await t.game('scene', 'fail'); await t.waitFrames(3);
      t.equal(await visible(t, '[data-act="assistOn"]'), false, 'with Assist already on there is nothing to offer');
    },
  },
  {
    name: 'S2-03 a win starts the count again',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'fail');
      await t.game('scene', 'win');
      await t.game('scene', 'fail'); await t.waitFrames(3);
      t.equal(await visible(t, '[data-act="assistOn"]'), false, 'fail, win, fail is not two in a row');
    },
  },
  // ------------------------------------------------------------------ S2-16 snack counter
  {
    name: 'S2-16 the Moonlight Run says what snacks do, and its snack counter shows once a snack is carried',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('newGame', { mode: 'endless', seed: 5, intro: true }); await t.waitFrames(3);
      const intro = await panelText(t);
      t.expect(/banked on bright rows/.test(intro), 'the intro says snacks are banked on bright rows: ' + intro);
      await t.shot('S2-16-endless-intro');
      await t.page.click('[data-act="go"]');
      await t.game('pause'); await t.waitFrames(3);
      t.equal(await visible(t, '#h-snacks'), false, 'no counter before a snack');
      await t.game('setState', { carry: ['pecan'] }); await t.game('step', 1); await t.waitFrames(3);
      t.equal(await visible(t, '#h-snacks'), true, 'the counter shows once a snack is carried');
      t.expect(await t.page.evaluate(() => document.getElementById('h-snacks').textContent.includes('1/3')), 'and reads 1/3');
      await t.shot('S2-16-endless-snack');
    },
  },
  {
    name: 'S2-16 campaign levels still show the counter from the start',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 }); await t.game('pause'); await t.waitFrames(3);
      t.equal(await visible(t, '#h-snacks'), true, 'the counter is there in a campaign level');
    },
  },
  // ------------------------------------------------------------------ S2-19 level 1 hint
  {
    name: 'S2-19 the level 1 hint is still up 2.3 s in even after an early hop, and gone after 2.5 s',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 }); await t.game('pause'); await t.waitFrames(3);
      t.expect(/hop/i.test(await t.page.evaluate(() => document.getElementById('h-hint').textContent)) && await visible(t, '#h-hint'), 'the hint is up at the start');
      await t.shot('S2-19-hint');
      await t.game('step', 6); await t.game('act', 'hop', 'right'); // an early hop
      await t.stepUntil((s) => s.run.hops >= 1, { max: 60, chunk: 1, label: 'the hop starts' });
      t.expect(await visible(t, '#h-hint'), 'the first hop does not take the hint away');
      await t.stepUntil((s) => s.run.t >= 2.3, { max: 400, chunk: 5, label: '2.3 s in' });
      t.expect(await visible(t, '#h-hint'), 'still up at 2.3 s');
      await t.stepUntil((s) => s.run.t >= 2.7, { max: 200, chunk: 5, label: '2.7 s in' });
      t.equal(await visible(t, '#h-hint'), false, 'gone once 2.5 s have passed');
    },
  },
  // ------------------------------------------------------------------ P-N02 Over panel
  {
    name: 'P-N02 the Moonlight Run Over panel names what ended the run and gives a tip, whatever it was',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const want = { chomp: /Chomped/, splash: /Splash/, swept: /Swept/, caught: /lantern caught up/i };
      for (const cause of ['chomp', 'splash', 'swept', 'caught']) {
        await t.game('act', 'unlockAll');
        await t.game('newGame', { mode: 'endless', seed: 5 }); await t.game('pause');
        await t.game('setState', { rings: 1 });
        // run it out in one go (the lantern ends it), then name the cause before the frame loop shows the panel, which waits a second
        await t.page.evaluate((c) => { const A = window.__CR, r = A.run; let n = 0; while (r.phase === 'play' && n++ < 20000) A.stepOnce({}); r.p.cause = c; A.kick(); }, cause);
        await t.page.waitForFunction(() => window.__game.getState().screen === 'over', null, { timeout: 30000 });
        const txt = await panelText(t);
        t.expect(want[cause].test(txt), `the panel names the cause (${cause}): ${txt}`);
        t.expect(!/Lantern caught you/.test(txt), 'and the headline is not always the lantern');
        t.expect(await visible(t, '.panel .tip'), 'a tip is shown');
        if (cause === 'caught') { await t.checkLayout({ allowScrollY: true }); await t.shot('P-N02-over'); }
      }
    },
  },
];
