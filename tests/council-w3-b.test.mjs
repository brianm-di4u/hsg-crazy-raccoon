// Council wave 3, batch B: S1-10 (the lure is aimed: a ghost drumstick shows where it will land). The pure rule is in
// tests-node/council-w3-b.test.mjs.
const ghost = (t) => t.page.evaluate(() => window.__CR.renderer.ghost);
const live = async (t, lures) => { await t.game('newGame', { level: 'l1', seed: 3 }); await t.game('pause'); await t.game('setState', { lures }); await t.waitFrames(3); };

export const tests = [
  {
    name: 'S1-10 with a lure in hand a ghost marks where the toss would land, and it follows the last sideways hop',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await live(t, 2);
      const g0 = await ghost(t), s0 = (await t.state()).run;
      t.expect(g0 && g0.row === s0.player.row + 2 && g0.c === s0.player.col, 'the ghost is two rows ahead and straight on: ' + JSON.stringify(g0));
      await t.shot('S1-10-lure-ghost');
      await t.game('act', 'hop', 'right');
      await t.stepUntil((s) => s.run.player.state === 'idle' && s.run.hops >= 1, { max: 200, chunk: 5, label: 'the hop ends' });
      await t.waitFrames(3);
      const g1 = await ghost(t), s1 = (await t.state()).run;
      t.equal(g1.c, Math.min(s1.player.col + 3, 8), 'after a hop right the ghost is three columns right (clamped to the board)');
      const before = (await t.state()).run.lures;
      await t.game('act', 'lure');
      const ev = await t.page.evaluate(() => window.__CR.run.world.lures[window.__CR.run.world.lures.length - 1]);
      t.expect(ev && ev.row === g1.row, "the thrown lure is on the row the ghost showed");
      t.equal((await t.state()).run.lures, before - 1, 'the toss spent one lure');
    },
  },
  {
    name: 'S1-10 no ghost with no lures, and it goes when the last one is thrown',
    viewports: ['desktop'],
    async run(t) {
      await live(t, 0);
      t.equal(await ghost(t), null, 'no lure, no ghost');
      await t.game('setState', { lures: 1 }); await t.waitFrames(3);
      t.expect((await ghost(t)) !== null, 'with one lure the ghost shows');
      await t.game('act', 'lure'); await t.game('step', 1); await t.waitFrames(3);
      t.equal(await ghost(t), null, 'after the last lure is thrown the ghost goes');
    },
  },
];
