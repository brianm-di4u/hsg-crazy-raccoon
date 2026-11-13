// Council wave 1, batch B: input, rules and play, screens and words (S1-01, S5-01, S1-06, S3-06, S4-10, S5-20, S2-15, P-N01).

const setUp = async (t) => {
  await t.game('newGame', { level: 'l4' });
  return t.game('setState', { player: { row: 1, col: 4 } });
};
const player = async (t) => (await t.state()).run.player;

export const tests = [
  {
    name: 'S1-01 a tap below Bandit hops forward, a swipe down still hops back',
    viewports: ['mobile'],
    async run(t) {
      let s = await setUp(t);
      const [x, y] = s.camera.player;
      await t.tap([x, Math.min(s.camera.h - 4, s.camera.h * 0.88)]);
      await t.waitFrames(20);
      let p = await player(t);
      t.equal(p.row, 2, 'a tap at 88 percent of the height (below Bandit) hops up a row');
      await t.game('setState', { player: { row: 2, col: 4 } });
      await t.tap([x - 0.3 * s.camera.tile, y + 1.2 * s.camera.tile]);
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.row, 3, 'a tap just below Bandit also hops up');
      s = await t.game('setState', { player: { row: 2, col: 4 } });
      await t.touchDrag([x, y], [x, y + 90], { steps: 6 });
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.row, 1, 'a swipe down still hops back');
      s = await t.game('setState', { player: { row: 1, col: 4 } });
      await t.tap([x + 1.4 * s.camera.tile, y + 0.2 * s.camera.tile]);
      await t.waitFrames(20);
      p = await player(t);
      t.equal(p.col, 5, 'a tap to the right of Bandit still hops right');
    },
  },
  {
    name: 'S1-06 a tap held for more than 600 ms still hops',
    viewports: ['mobile'],
    async run(t) {
      const s = await setUp(t);
      const [x, y] = s.camera.player;
      await t.touchDrag([x, y], [x, y], { steps: 1, holdEndMs: 750 });
      await t.waitFrames(20);
      t.equal((await player(t)).row, 2, 'a 750 ms press on Bandit hops up');
    },
  },
];
