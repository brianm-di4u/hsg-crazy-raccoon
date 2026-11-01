// Review capture set for the visual review loop (reviews/PROTOCOL.md). Run with --milestone review-N.
// Every shot is deterministic: fixed seeds, fixed step counts, frozen render clock.
const go = async (t, level, row, steps, col = 4) => {
  await t.game('newGame', { level, seed: 7 });
  await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
  await t.game('pause');
  await t.game('act', 'warp', row, steps, col);
  await t.game('act', 'clock', 4200);
};

export const tests = [
  {
    name: 'review captures',
    slow: false,
    async run(t) {
      await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
      await t.game('act', 'clock', 3000);
      await t.shot('r01-title');
      await t.game('act', 'unlockAll');
      await t.game('scene', 'map');
      await t.shot('r02-map');
      await go(t, 'l1', 0, 120); await t.shot('r03-l1-start');
      await go(t, 'l3', 5, 260); await t.shot('r04-pond');
      await go(t, 'l5', 5, 300); await t.shot('r05-whippers');
      await go(t, 'l4', 6, 200); await t.shot('r06-nursery');
      await go(t, 'l8', 6, Math.round(4.6 * 120)); await t.shot('r07-feeding');
      await go(t, 'l11', 8, 300); await t.shot('r08-barn');
      await go(t, 'l14', 7, 260); await t.shot('r09-night');
      await go(t, 'l15', 4, 300); await t.shot('r10-boss');
      // a hop mid-air with snacks in paw
      await go(t, 'l2', 0, 100);
      await t.game('setState', { carry: ['pecan', 'berry'] });
      await t.game('act', 'hop', 'up'); const mid = await t.game('step', 8);
      t.expect(mid.run.player.state === 'hop', `r11 is mid-hop (state ${mid.run.player.state})`);
      await t.waitFrames(3);
      await t.shot('r11-hop', { wait: false });
      await t.game('act', 'clock', null);
      // the first ride landing of level 1's stored plan, two frames after touchdown (squash, ring, droplets)
      await t.game('newGame', { level: 'l1', seed: 7 });
      await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
      await t.game('pause');
      const landAt = await t.page.evaluate(() => { const G = window.__game; for (let s = 6; s < 2400; s += 3) { const st = G.act('replay', null, s); if (st.run.player.on != null) return s; } return -1; });
      t.expect(landAt > 0, `level 1 plan lands on a gator (step ${landAt})`);
      await t.waitFrames(2);
      await t.shot('r11b-land', { wait: false });
      await t.game('newGame', { mode: 'endless', seed: 3 }); await t.game('pause'); await t.game('step', 400); await t.game('act', 'clock', 4200);
      await t.shot('r12-endless');
      await t.game('act', 'clock', null);
      await t.game('scene', 'win'); await t.shot('r13-results', { animations: true });
      await t.game('scene', 'help'); await t.shot('r14-help');
      await t.game('newGame', { level: 'l7', intro: true }); await t.shot('r15-intro');
    },
  },
];
