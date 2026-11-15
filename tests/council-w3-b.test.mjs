// Council wave 3, batch B: S1-10 (the lure is aimed: a ghost drumstick shows where it will land). The pure rule is in
// tests-node/council-w3-b.test.mjs. S4-01 (the map and level cards say where in Hot Springs each zone is) and S4-03 (the map is a trail
// that is dotted where Bandit has not been and solid where he has).
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
  {
    name: 'S4-01 every zone on the map and on its level card carries a place line, and the map names Whittington Ave. and Hot Springs',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('act', 'unlockAll');
      await t.game('scene', 'map'); await t.waitFrames(3);
      const m = await t.page.evaluate(() => ({ sub: document.querySelector('.panel .sub').textContent, places: [...document.querySelectorAll('.zone .place')].map((e) => e.textContent) }));
      t.expect(/Whittington Ave./.test(m.sub) && /Hot Springs/.test(m.sub), 'the map line names the place: ' + m.sub);
      t.equal(m.places.length, 5, 'one place line per zone');
      t.expect(m.places.every((p) => p.length > 8) && new Set(m.places).size === 5, 'five different lines: ' + m.places.join(' | '));
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S4-03-map-open');
      await t.game('newGame', { level: 'l4', intro: true }); await t.waitFrames(3);
      const k = await t.page.evaluate(() => ({ screen: window.__game.getState().screen, place: (document.querySelector('.panel .place') || {}).textContent }));
      t.equal(k.screen, 'intro', 'the level card is up');
      t.equal(k.place, m.places[1], 'level 4 is in zone 2 and its card shows the place line of its zone');
      await t.shot('S4-01-intro-place');
    },
  },
  {
    name: 'S4-03 the trail between levels is dotted for a new player and solid where the player has been',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const trail = () => t.page.evaluate(() => {
        const lv = [...document.querySelectorAll('.lvl')], style = (e) => getComputedStyle(e, '::before').borderTopStyle;
        return { walked: [...document.querySelectorAll('.zone.walked')].length, l2: style(lv[1]), l3: style(lv[2]), l4: style(lv[4]), l1: getComputedStyle(lv[0], '::before').content };
      });
      await t.game('act', 'clearSave');
      await t.game('scene', 'title'); await t.game('scene', 'map'); await t.waitFrames(3);
      let r = await trail();
      t.equal(r.walked, 1, 'a new player has walked one zone');
      t.expect(r.l2 === 'dotted' && r.l3 === 'dotted' && r.l4 === 'dotted', 'unvisited stretches of trail are dotted: ' + [r.l2, r.l3, r.l4]);
      t.expect(r.l1 === 'none' || r.l1 === 'normal', 'the first level has no trail coming in');
      await t.shot('S4-03-map-fresh');
      await t.game('act', 'unlockAll');
      await t.game('scene', 'title'); await t.game('scene', 'map'); await t.waitFrames(3);
      r = await trail();
      t.equal(r.walked, 5, 'with everything open all five zones are walked');
      t.expect(r.l2 === 'solid' && r.l3 === 'solid' && r.l4 === 'solid', 'the trail is solid where it has been walked: ' + [r.l2, r.l3, r.l4]);
    },
  },
];
