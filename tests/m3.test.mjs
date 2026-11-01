// M3: full content in the browser (DEV-PLAN matrix AC13–AC22).
const start = async (t, level, seed = 5) => { await t.game('newGame', { level, seed }); await t.game('pause'); };

export const tests = [
  {
    name: 'every zone renders with its gator cast',
    async run(t) {
      for (const [lvl, row, shot, steps] of [['l2', 7, 'm3-zone1', 300], ['l5', 6, 'm3-zone2', 300], ['l8', 7, 'm3-zone3', 600], ['l10', 6, 'm3-zone4', 300], ['l14', 8, 'm3-zone5', 400]]) {
        await start(t, lvl);
        await t.game('act', 'warp', row, steps);
        const s = await t.state();
        t.expect(s.run.gators.length > 0, `${lvl} gators near Bandit`);
        await t.shot(shot);
      }
      await t.checkLayout();
    },
  },
  {
    name: 'boss level: Old Ruthless spans two rows',
    async run(t) {
      await start(t, 'l15');
      const s = await t.game('act', 'warp', 4, 240, 4);
      const boss = s.run.gators.find((g) => g.k === 'boss');
      t.expect(!!boss, 'boss present');
      await t.shot('m3-boss');
    },
  },
  {
    name: 'feeding show shadow and surge',
    async run(t) {
      await start(t, 'l7');
      await t.game('act', 'warp', 2, 0, 2);
      await t.game('step', Math.round(3.4 * 120));
      await t.shot('m3-feed', { wait: false });
    },
  },
  {
    name: 'flashlight beam in the midnight raid',
    async run(t) {
      await start(t, 'l13');
      await t.game('act', 'warp', 4, 120, 4);
      await t.shot('m3-beam');
    },
  },
  {
    name: 'lure by keyboard and by button',
    async run(t) {
      await start(t, 'l6');
      await t.game('setState', { lures: 2 });
      await t.game('resume');
      if (t.viewport === 'desktop') await t.page.keyboard.press('Space');
      else await t.tap(await t.page.$eval('#h-lure', (b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
      await t.waitFrames(6);
      await t.game('pause');
      let s = await t.state();
      t.equal(s.run.lures, 1, 'one lure used');
      await t.game('step', 50);
      await t.shot('m3-lure', { wait: false });
      // the button works with a mouse click on desktop too
      if (t.viewport === 'desktop') { await t.game('resume'); await t.page.click('#h-lure'); await t.waitFrames(4); await t.game('pause'); s = await t.state(); t.equal(s.run.lures, 0, 'button lure'); }
    },
  },
  {
    name: 'wash, bank and HUD multiplier',
    async run(t) {
      await start(t, 'l1');
      // l1 row 6 is water with a pool stone at col 4, row 8 a checkpoint
      await t.game('setState', { player: { row: 5, col: 4 }, carry: ['pecan', 'berry'] });
      let s = await t.game('act', 'hop', 'up'); s = await t.game('step', 25);
      t.equal(s.run.washed, 2, 'washed on the spring stone');
      await t.shot('m3-wash', { wait: false });
      await t.game('step', 60);
      await t.shot('m3-hud');
    },
  },
  {
    name: 'stars, ball badge and Merman ticket persist across reload',
    async run(t) {
      await start(t, 'l9');
      // carry the level's ticket and ball via setState-crafted pickups: hop onto them
      const L = await t.page.evaluate(() => window.__CR.LEVELS.find((x) => x.id === 'l9'));
      const ticket = L.items.find((i) => i.k === 'ticket'), ball = L.items.find((i) => i.k === 'ball');
      await t.game('setState', { player: { row: ticket.r - 1, col: ticket.c } });
      let s = await t.game('act', 'hop', 'up'); s = await t.game('step', 22);
      t.equal(s.run.ticket, true, 'ticket picked up');
      await t.game('setState', { player: { row: ball.r - 1, col: ball.c } });
      s = await t.game('act', 'hop', 'up'); s = await t.game('step', 22);
      t.equal(s.run.ball, true, 'ball picked up');
      // finish the level from a row next to the den
      await t.game('setState', { player: { row: L.rows.length - 2, col: 4 } });
      await t.game('act', 'hop', 'up'); s = await t.game('step', 30);
      t.equal(s.run.phase, 'won');
      await t.game('resume');
      await t.page.waitForFunction(() => window.__game.getState().screen === 'win', null, { timeout: 4000 });
      await t.reload();
      s = await t.state();
      t.expect(s.save.progress.l9 && s.save.progress.l9.ball, 'ball badge saved');
      t.equal(s.save.merman, true, 'Merman card unlocked');
      t.equal(s.save.endlessUnlocked, true, 'Moonlight Run unlocked after level 6+');
      await t.game('scene', 'notebook');
      const txt = await t.page.textContent('#screens');
      t.expect(/Merman \(legend\)/.test(txt), 'legend card shown and labelled');
      await t.shot('m3-notebook');
      await t.game('scene', 'map');
      await t.shot('m3-map');
      await t.checkLayout();
    },
  },
  {
    name: 'Moonlight Run: beam rises and the top ten saves initials',
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('newGame', { mode: 'endless', seed: 4 });
      await t.game('pause');
      let s = await t.game('step', 240);
      t.equal(s.mode, 'endless');
      t.expect(s.run.beam > -4, 'lantern rising');
      await t.shot('m3-endless');
      // idle until the lantern takes all three rings
      s = await t.stepUntil(() => window.__game.getState().run.phase === 'fail', { max: 120 * 80, chunk: 120, label: 'caught three times' });
      await t.game('resume');
      await t.page.waitForSelector('#ini', { timeout: 4000 });
      await t.page.fill('#ini', 'bnd');
      await t.page.keyboard.press('Enter');
      await t.page.waitForFunction(() => window.__game.getState().screen === 'scores', null, { timeout: 3000 });
      s = await t.state();
      t.equal(s.save.top[0].initials, 'BND', 'initials saved uppercase');
      await t.shot('m3-scores');
    },
  },
  {
    name: 'fact card shows its source on the level intro',
    async run(t) {
      await t.game('newGame', { level: 'l4', intro: true });
      const txt = await t.page.textContent('#screens');
      t.expect(/Farm fact/.test(txt) && /Source:/.test(txt), 'fact with source');
      await t.shot('m3-fact');
      await t.checkLayout();
    },
  },
];
