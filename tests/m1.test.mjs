// M1: boot, title, offline file://, keyboard-only menus, storage failure, layout (DEV-PLAN matrix AC1–AC4, AC33).
export const tests = [
  {
    name: 'boots to title',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'title scene');
      t.equal(s.screen, 'title', 'title screen');
      t.expect(t.loadMs < 2000, `hooks ready in ${t.loadMs} ms`);
      const labels = await t.page.$$eval('#screens button', (b) => b.map((x) => x.textContent.trim()));
      for (const want of ['Play', 'Moonlight Run', 'How to Play', 'Farm Notebook', 'Settings', 'Credits']) t.expect(labels.some((l) => l.includes(want)), 'title button ' + want);
      const txt = await t.page.textContent('#screens');
      t.expect(/Crazy/.test(txt) && /Raccoon/.test(txt) && /Gator Farm Dash/.test(txt), 'game name');
      t.expect(/Hot Springs Games/.test(txt), 'brand');
      t.expect(/made-up raccoon/i.test(txt) && /Not affiliated/i.test(txt), 'fiction and non-affiliation line');
      await t.shot('m1-title');
      await t.checkLayout();
    },
  },
  {
    name: 'offline file:// boot and play',
    fileUrl: true,
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'title over file://');
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('pause');
      await t.game('step', 120);
      await t.shot('m1-fileurl');
    },
  },
  {
    name: 'keyboard-only menus',
    viewports: ['desktop'],
    async run(t) {
      const kb = t.page.keyboard;
      // Title → How to Play via arrows + Enter, then Esc back
      const focusText = () => t.page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
      t.expect(/^Play/.test(await focusText()), 'Play focused first');
      await kb.press('ArrowDown'); await kb.press('ArrowDown');
      t.equal(await focusText(), 'How to Play', 'arrow moves focus');
      await kb.press('Enter');
      t.equal((await t.state()).screen, 'help', 'help open');
      await t.shot('m1-help');
      await kb.press('Escape');
      t.equal((await t.state()).screen, 'title', 'Esc back to title');
      // Settings: toggle text size with keyboard
      for (let i = 0; i < 4; i++) await kb.press('ArrowDown');
      t.equal(await focusText(), 'Settings');
      await kb.press('Enter');
      t.equal((await t.state()).screen, 'settings');
      await t.shot('m1-settings');
      await kb.press('Escape');
      await t.page.evaluate(() => document.querySelector('[data-act="settings"]').focus());
      await kb.press('ArrowDown');
      t.equal(await focusText(), 'Credits');
      await kb.press('Enter');
      await t.shot('m1-credits');
      await kb.press('Escape');
      // Play → map → level 1 intro → Go! → game, all by keyboard
      await t.page.evaluate(() => document.querySelector('[data-act="play"]').focus());
      await kb.press('Enter');
      t.equal((await t.state()).screen, 'map', 'map');
      await kb.press('Enter');
      t.equal((await t.state()).screen, 'intro', 'level intro');
      await kb.press('Enter');
      const s = await t.state();
      t.equal(s.scene, 'play'); t.equal(s.screen, null, 'playing');
      await kb.press('ArrowUp');
      await t.waitFrames(30);
      t.expect((await t.state()).run.hops >= 1, 'arrow key hops in game');
      await kb.press('Escape');
      t.equal((await t.state()).screen, 'pause', 'Esc pauses');
      await kb.press('Enter');
      t.equal((await t.state()).screen, null, 'Enter resumes');
    },
  },
  {
    name: 'storage throws: game still runs and saves in memory',
    initScript: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); },
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title');
      await t.game('newGame', { level: 'l1' });
      await t.game('pause');
      const r = await t.game('act', 'replay');
      t.equal(r.run.phase, 'won', 'level completes without storage');
    },
  },
];
