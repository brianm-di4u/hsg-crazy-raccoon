// M2: core loop in the browser (DEV-PLAN matrix AC5–AC11, AC34).
const start = async (t, level = 'l1', seed = 5) => { await t.game('newGame', { level, seed }); await t.game('pause'); };

export const tests = [
  {
    name: 'hop grid, buffer and camera',
    async run(t) {
      await start(t);
      let s = await t.game('act', 'hop', 'up');
      t.equal(s.run.player.state, 'hop', 'hop started');
      await t.game('step', 9);
      await t.game('act', 'clock', 1000);
      await t.shot('m2-hop-mid', { wait: false });
      await t.game('act', 'clock', null);
      s = await t.game('step', 20);
      t.equal(s.run.player.row, 1, 'one row up');
      s = await t.game('act', 'hop', 'right'); s = await t.game('step', 20);
      t.equal(s.run.player.col, 5, 'one column right');
      s = await t.game('act', 'hop', 'down'); s = await t.game('step', 20);
      t.equal(s.run.player.row, 0);
      s = await t.game('act', 'hop', 'down'); s = await t.game('step', 20);
      t.equal(s.run.player.row, 0, 'cannot leave the board');
      const st = await t.state();
      if (t.viewport === 'mobile') t.expect(Math.abs(st.camera.tile * 6.5 - st.camera.w) < 2, 'phone shows 6.5 columns and pans with Bandit');
      await t.shot('m2-play');
      await t.checkLayout();
    },
  },
  {
    name: 'splash in empty water; ride a paddler',
    async run(t) {
      await start(t);
      // find a moment when no gator covers column 0 of row 2, hop from row 1 col 0
      await t.game('setState', { player: { row: 1, col: 0 } });
      const s = await t.stepUntil(() => { const g = window.__game.act('gatorAt', 2); return g.every((q) => { const back = q.dir > 0 ? q.x - q.len * 64 : q.x, front = back + q.len * 64; return !(32 > back - 20 && 32 < front + 20); }); }, { max: 1200, chunk: 4, label: 'gap over col 0' });
      t.expect(!!s, 'gap found');
      let r = await t.game('act', 'hop', 'up'); r = await t.game('step', 25);
      t.equal(r.run.player.state, 'dead', 'splashed'); t.equal(r.run.player.cause, 'splash');
      await t.shot('m2-splash', { wait: false });
      r = await t.game('step', 120);
      t.equal(r.run.player.row, 0, 'respawned at the start checkpoint');
      t.equal(r.run.rings, 4);
      // now wait for a gator under column 4 and hop on
      await t.game('setState', { player: { row: 1, col: 4 } });
      await t.stepUntil(() => window.__game.act('gatorAt', 2).some((q) => { const back = q.dir > 0 ? q.x - q.len * 64 : q.x; return 288 > back + 40 && 288 < back + q.len * 64 - 60; }), { max: 1200, chunk: 2, label: 'gator under col 4' });
      r = await t.game('act', 'hop', 'up'); r = await t.game('step', 20);
      t.expect(r.run.player.on != null, 'riding');
      const x0 = r.run.player.x; r = await t.game('step', 30);
      t.expect(Math.abs(r.run.player.x - x0) > 5, 'carried by the gator');
      await t.shot('m2-ride');
    },
  },
  {
    name: 'telegraph then chomp',
    async run(t) {
      await start(t, 'l2');
      // stand on the basking bank and wait for a gator's warning, then its bite
      let s = await t.stepUntil(() => window.__game.getState().run.gators.some((g) => g.jaw === 'tele'), { max: 1500, chunk: 3, label: 'a warning' });
      t.expect(s.run.gators.some((g) => g.jaw === 'tele'), 'telegraph seen');
      await t.shot('m2-tele');
      // AC7 numbers (≥ 0.5 s warning, chomp on open jaws) are proven in tests-node/kinds.test.mjs
    },
  },
  {
    name: 'solver plan clears level 1 and shows results',
    async run(t) {
      await start(t, 'l1');
      const r = await t.game('act', 'replay');
      t.equal(r.run.phase, 'won'); t.equal(r.run.deaths, 0);
      await t.game('resume');
      await t.page.waitForFunction(() => window.__game.getState().screen === 'win', null, { timeout: 4000 });
      const s = await t.state();
      t.equal(s.save.unlocked, 2, 'level 2 unlocked');
      t.expect(s.save.progress.l1 && s.save.progress.l1.stars[0], 'star saved');
      const txt = await t.page.textContent('#screens');
      t.expect(/Home free/.test(txt) && /Score/.test(txt) && /Source:/.test(txt), 'results with breakdown and fact source');
      await t.shot('m2-results', { animations: true });
      await t.checkLayout();
    },
  },
  {
    name: 'browser hash matches the Node replay hash',
    viewports: ['desktop'],
    async run(t) {
      await start(t, 'l3', 1);
      await t.game('act', 'replay');
      const h1 = await t.game('act', 'hash');
      await start(t, 'l3', 1);
      await t.game('act', 'replay');
      const h2 = await t.game('act', 'hash');
      t.equal(h1, h2, 'deterministic in the browser');
      const { Run, hashRun } = await import('../src/js/sim/run.js');
      const { replay } = await import('../src/js/sim/solve.js');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const url = await import('node:url');
      const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
      const L = JSON.parse(fs.readFileSync(path.join(root, 'data/levels.json'), 'utf8')).levels.find((x) => x.id === 'l3');
      const D = { u: 'up', d: 'down', l: 'left', r: 'right' };
      const run = replay(new Run(L, { seed: 1 }), L.plan.map(([step, d]) => ({ step, dir: D[d] })));
      t.equal(hashRun(run), h1, 'Node and Chromium agree');
    },
  },
];
