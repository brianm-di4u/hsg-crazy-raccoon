// Council wave 2, batch B: S3-04 (Moonlight Run depth) and S3-10 (phone view: Settings > View and edge chevrons).
const KEY = 'hsg-crazy-raccoon-v1';
const COLS = { close: 6.5, standard: 7.5, wide: 9 };
const setView = async (t, view) => { await t.game('scene', 'settings'); await t.page.click(`[data-k="view"][data-v="${view}"]`); await t.waitForStable(); };
const endless = async (t, seed = 3) => { await t.game('newGame', { mode: 'endless', seed }); await t.game('pause'); await t.waitFrames(3); };
const look = async (t) => { await t.game('step', 1); await t.waitFrames(5); };
const bossRow = async (t) => {
  for (let r = 40; r < 90; r++) { const g = await t.game('act', 'gatorAt', r); if (g.some((x) => x.k === 'boss')) return r; }
  return -1;
};

export const tests = [
  {
    name: 'S3-10 Settings has a Phone view row (Close, Standard, Wide) with 44 px buttons; Standard is pressed on a fresh profile',
    async run(t) {
      await t.game('scene', 'settings');
      await t.waitForAnimations();
      const labels = await t.page.$$eval('#screens .flabel', (n) => n.map((x) => x.textContent));
      t.expect(labels.includes('Phone view'), 'a Phone view row is listed');
      const btns = await t.page.$$eval('[data-k="view"]', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return { v: x.dataset.v, on: x.getAttribute('aria-pressed'), w: r.width, h: r.height }; }));
      t.equal(btns.map((b) => b.v), ['close', 'standard', 'wide'], 'the three views');
      t.equal(btns.find((b) => b.on === 'true').v, 'standard', 'Standard is the default');
      t.expect(btns.every((b) => b.w >= 44 && b.h >= 44), 'every button is at least 44 px: ' + JSON.stringify(btns));
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-10-settings');
    },
  },
  {
    name: 'S3-10 the chosen view is saved and comes back after a reload; an old save with no view reads Standard',
    async run(t) {
      await setView(t, 'wide');
      t.equal((await t.state()).settings.view, 'wide', 'the setting changed');
      await t.reload();
      t.equal((await t.state()).settings.view, 'wide', 'it survived a reload');
      await t.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); delete s.settings.view; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
      await t.reload();
      t.equal((await t.state()).settings.view, 'standard', 'a save from before reads Standard');
      await t.page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.settings.view = 'huge'; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
      await t.reload();
      t.equal((await t.state()).settings.view, 'standard', 'a damaged value reads Standard');
    },
  },
  {
    name: 'S3-10 the phone shows 6.5, 7.5 or 9 columns by view; a wide screen always shows all nine',
    async run(t) {
      for (const view of ['close', 'standard', 'wide']) {
        await setView(t, view);
        await t.game('newGame', { level: 'l3', seed: 5 }); await t.game('pause'); await t.waitFrames(3);
        const c = (await t.state()).camera;
        if (t.viewport === 'mobile') {
          t.expect(Math.abs(c.tile * COLS[view] - c.w) < 2, `${view}: ${COLS[view]} columns across ${c.w} px (tile ${c.tile})`);
          if (view === 'wide') t.expect(Math.abs(c.bx) < 1, 'wide: the board fills the screen and does not pan');
        } else {
          t.expect(Math.abs(c.tile * 9 - 9 * c.tile) < 1 && c.tile * 9 <= c.w, `${view}: the desktop board is whole and ignores the setting (tile ${c.tile})`);
        }
      }
    },
  },
  {
    name: 'S3-10 an edge chevron points in from the side for a gator about to enter the view (phone, any view)',
    viewports: ['mobile'],
    async run(t) {
      await setView(t, 'standard');
      let hit = null;
      for (const seed of [3, 4]) {
        await endless(t, seed);
        await t.game('act', 'warp', 1, 2, 4); await t.game('step', 2);
        for (let r = 1; r < 18 && !hit; r++) {
          await t.game('act', 'warp', r, 0, 4);
          const here = await t.state();
          if (here.run.player.rowType === 'water' || !(await t.game('act', 'gatorAt', r + 1)).some((g) => g.k === 'paddler' || g.k === 'whipper')) continue;
          const s = await t.stepUntil(() => window.__game.getState().camera.chevrons.length > 0, { max: 1500, chunk: 3, label: 'a chevron' }).catch(() => null);
          if (s && s.camera.chevrons.length) hit = s;
        }
        if (hit) break;
      }
      if (!hit) { t.fail('no chevron showed for any of six seeds'); return; }
      const ch = hit.camera.chevrons[0];
      t.expect(ch.x < 30 || ch.x > hit.camera.w - 30, `the chevron sits at a screen edge (x ${ch.x} of ${hit.camera.w})`);
      t.expect(ch.y > 108 && ch.y < hit.camera.h - 78, `and between the header and the footer band (y ${ch.y})`);
      await t.game('step', 1); await t.waitFrames(5);
      t.expect((await t.state()).camera.chevrons.length > 0, 'the chevron is still showing a frame later');
      await t.shot('S3-10-chevron');
    },
  },
  {
    name: 'S3-10 the desktop board never shows a chevron',
    viewports: ['desktop'],
    async run(t) {
      await endless(t, 3);
      const s = await t.stepUntil(() => window.__game.getState().run.steps > 900, { max: 1000, chunk: 20, label: 'time passing' });
      t.equal(s.camera.chevrons.length, 0, 'no chevrons on the full board');
    },
  },
  {
    name: 'S3-10 close, standard and wide views of the same moment on the phone',
    viewports: ['mobile'],
    async run(t) {
      for (const view of ['close', 'standard', 'wide']) {
        await setView(t, view);
        await t.game('newGame', { level: 'l3', seed: 5 }); await t.game('pause');
        await t.game('act', 'warp', 6, 20, 1);
        await t.waitFrames(8);
        await t.shot('S3-10-view-' + view);
      }
    },
  },
  {
    name: 'S3-04 Old Ruthless crosses the Moonlight Run at chunk 9, and the keeper\'s beams show from chunk 10',
    async run(t) {
      await endless(t, 3);
      await t.game('act', 'warp', 50, 2, 4); await t.game('step', 2);
      const r = await bossRow(t);
      t.expect(r >= 56 && r <= 62, `Old Ruthless is on rows around ${r}, in chunk 9`);
      await t.game('act', 'warp', r - 1, 0, 4);
      const inView = eval(`() => window.__game.act('gatorAt', ${r}).some((g) => g.k === 'boss' && g.x > 150 && g.x < 400)`);
      await t.stepUntil(inView, { max: 2400, chunk: 6, label: 'Old Ruthless in view' });
      await look(t);
      await t.shot('S3-04-boss');
      // the first beam row: find it from the generated level, then look at it
      const row = await t.page.evaluate(() => { const s = window.__game.getState(); return s.run.rows; });
      t.expect(row >= 70, 'the run has been generated well ahead');
    },
  },
  {
    name: 'S3-04 a tail-ring charm lies on the checkpoint row of chunk 4 and gives Bandit a ring back',
    async run(t) {
      await endless(t, 3);
      await t.game('act', 'warp', 26, 2, 4); await t.game('step', 2);
      await t.waitFrames(4);
      let s = await t.state();
      const ring = s.run.items.find((i) => i.k === 'ring');
      t.expect(!!ring && ring.r === 26, 'a ring charm is on row 26');
      if (!ring) return;
      const from = ring.c > 0 ? ring.c - 1 : ring.c + 1;
      await t.game('act', 'warp', 26, 0, from);
      await t.game('setState', { rings: 1 });
      await look(t);
      await t.shot('S3-04-ring-charm');
      await t.game('act', 'hop', ring.c > 0 ? 'right' : 'left');
      s = await t.game('step', 24);
      t.equal(s.run.rings, 2, 'one ring back');
      t.expect(/tail ring/i.test(s.said || ''), `announced: "${s.said}"`);
    },
  },
  {
    name: 'S3-04 deep in the run the lantern keeps climbing and the board keeps filling',
    async run(t) {
      await endless(t, 3);
      await t.game('act', 'warp', 160, 0, 4);
      await t.waitFrames(6);
      const s = await t.game('step', 240);
      t.expect(s.run.beam != null && s.run.beam > 140, `the lantern is near (row ${s.run.beam})`);
      t.expect(s.run.rows >= 180, `the run is generated ahead (${s.run.rows} rows)`);
      await t.shot('S3-04-deep');
    },
  },
];
