// Council wave 3, batch A: S1-07 (a beat of grace), S3-01 (records seen), S3-21 (storage blocked), S6-07 (the top-ten
// score is kept), S1-03 (a hit-stop on a chomp), S1-05 (swipes act on the move), S1-08 (two presses in one frame),
// S1-11 (a hop skips the dead time), S2-13 (pinch-zoom and 175 percent text), S3-11 (the win panel adds up).
// The pure rules are in tests-node/council-w3-a.test.mjs.
const KEY = 'hsg-crazy-raccoon-v1';
const blockWrites = () => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'QuotaExceededError'); }; };
const blockAll = () => { const no = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no; };
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const seedSave = (t, patch) => t.page.evaluate(([k, p]) => { const cur = JSON.parse(localStorage.getItem(k) || 'null') || {}; localStorage.setItem(k, JSON.stringify({ v: 1, ...cur, ...p })); }, [KEY, patch]);
const live = async (t, level = 'l1') => { await t.game('newGame', { level, seed: 3 }); await t.game('pause'); await t.waitFrames(3); }; // a paused level (the test steps it)
const run = async (t) => (await t.state()).run;
const endRun = async (t) => { // let the lantern end a Moonlight Run, then wait for the Over panel
  await t.game('act', 'unlockAll');
  await t.game('newGame', { mode: 'endless', seed: 5 });
  await t.game('pause');
  await t.game('setState', { rings: 1 });
  await t.stepUntil(() => window.__game.getState().run.phase !== 'play', { max: 9000, chunk: 30, label: 'the run ends' });
  await t.page.waitForFunction(() => window.__game.getState().screen === 'over', null, { timeout: 8000 });
};
// samples the live loop each frame until `done()`, returning what `read()` gave while `during()` held
const watch = (t, { during, read, done, frames = 240 }) => t.page.evaluate(([d, r, f, n]) => new Promise((resolve) => {
  const during = new Function('return (' + d + ')()'), read = new Function('return (' + r + ')()'), done = new Function('return (' + f + ')()');
  const seen = []; let i = 0;
  const tick = () => { if (during()) seen.push(read()); if (done() || ++i > n) return resolve({ seen, frames: i, finished: done() }); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}), [during.toString(), read.toString(), done.toString(), frames]);

export const tests = [
  // ------------------------------------------------------------------ S1-07 a beat of grace
  {
    name: 'S1-07 after Resume the world holds for a beat, a ring closes on Bandit, and a hop pressed meanwhile is kept',
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('scene', 'pause'); await t.waitFrames(3);
      t.expect((await t.state()).paused, 'the pause card is up');
      await t.game('act', 'menu', 'resume');
      const s0 = await run(t);
      t.expect(await t.page.evaluate(() => window.__CR.grace > 0.5), 'the grace beat is running (about 0.7 s)');
      await t.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))); // the hand finds the key during the beat
      const w = await watch(t, { during: () => window.__CR.grace > 0, read: () => window.__CR.run.steps + ':' + window.__CR.run.hops, done: () => window.__CR.grace === 0 });
      t.expect(w.finished, 'the beat ends');
      t.expect(w.seen.length >= 2, 'it lasted more than a frame (' + w.seen.length + ' frames seen)');
      t.expect(w.seen.every((v) => v === w.seen[0]), 'no step and no hop happened during the beat: ' + [...new Set(w.seen)].join(' '));
      await t.page.waitForFunction(() => window.__CR.run.hops >= 1 && window.__CR.run.p.state === 'idle', null, { timeout: 5000 });
      const s1 = await run(t);
      t.expect(s1.steps > s0.steps, 'the world moves again afterwards');
      t.equal(s1.player.col, 3, 'the left hop pressed during the beat fired once it ended');
    },
  },
  {
    name: 'S1-07 Go, Restart and Resume each start the beat; a hook-started level does not (tests that step by hand are unaffected)',
    async run(t) {
      const grace = () => t.page.evaluate(() => window.__CR.grace);
      await t.game('newGame', { level: 'l1', seed: 3, intro: true });
      t.equal((await t.state()).screen, 'intro', 'the intro card shows');
      await t.game('act', 'menu', 'go');
      t.expect((await grace()) > 0.3, 'Go starts the beat');
      await t.page.waitForFunction(() => window.__CR.grace === 0, null, { timeout: 5000 });
      await t.game('pause'); await t.waitFrames(2);
      await t.game('act', 'menu', 'restart');
      t.expect((await grace()) > 0.3, 'Restart starts the beat');
      await t.game('newGame', { level: 'l1', seed: 3 });
      t.equal(await grace(), 0, 'a level started by the test hook has no beat');
    },
  },
  {
    name: 'S1-07 the ring on Bandit is on screen during the beat',
    async run(t) {
      await live(t);
      await t.page.evaluate(() => { window.__CR.grace = 0.7; window.__CR.kick(); });
      await t.waitFrames(3);
      const withRing = await t.page.evaluate(() => window.__CR.renderer.grace);
      t.expect(withRing > 0.5, 'the renderer is told how much of the beat is left (' + withRing.toFixed(2) + ')');
      await t.page.evaluate(() => { window.__CR.grace = 0.45; });
      await t.waitFrames(3);
      await t.shot('S1-07-grace-ring', { wait: false });
      await t.page.evaluate(() => { window.__CR.grace = 0; });
    },
  },

  // ------------------------------------------------------------------ S3-01 records seen
  {
    name: 'S3-01 the win panel says when the time is a new best; Records shows the chomp and splash counts',
    async run(t) {
      await seedSave(t, { progress: { l1: { stars: [true, false, false], best: 100, bestT: 999, ball: false } }, stats: { hops: 5, chomps: 7, splashes: 3, treats: 1, runs: 2, dailies: 0 } });
      await t.reload();
      await t.game('scene', 'win'); await t.waitFrames(3);
      const txt = await t.page.evaluate(() => document.querySelector('.breakdown').textContent);
      t.expect(/new best time/i.test(txt), 'the time line says it is a new best time: ' + txt);
      await t.shot('S3-01-win-best-time');
      await t.game('scene', 'records'); await t.waitFrames(3);
      const rec = await t.page.evaluate(() => [...document.querySelectorAll('.rec')].map((e) => e.textContent));
      t.expect(rec.some((x) => /7.*Times chomped/.test(x)) && rec.some((x) => /3.*Splashes/.test(x)), 'chomps and splashes are on the Records screen: ' + rec.join(' | '));
      await t.shot('S3-01-records');
      await t.checkLayout();
    },
  },

  // ------------------------------------------------------------------ S3-21 storage blocked
  {
    name: 'S3-21 with storage blocked the title says progress will not be kept, and the game still plays',
    initScript: blockAll,
    async run(t) {
      await t.waitFrames(3);
      const note = await t.page.evaluate(() => { const e = document.querySelector('.title-wrap .note.warn'); return e ? e.textContent : null; });
      t.equal(note, 'Progress will not be saved in this browser mode.', 'the one-line warning is on the title');
      await t.shot('S3-21-title-blocked');
      await t.checkLayout();
      await t.game('newGame', { level: 'l1', seed: 3 });
      t.equal((await t.state()).scene, 'play', 'the game plays');
    },
  },
  {
    name: 'S3-21 when only writing fails (a full or read-only store) the warning shows too',
    initScript: blockWrites,
    async run(t) {
      await t.waitFrames(3);
      t.expect(await t.page.evaluate(() => !!document.querySelector('.title-wrap .note.warn')), 'the warning is on the title');
    },
  },
  {
    name: 'S3-21 with working storage there is no warning',
    async run(t) {
      await t.waitFrames(3);
      const w = await t.page.evaluate(() => [document.querySelector('.title-wrap .note.warn') && 'note', /not be saved/.test(document.body.innerText) && 'text'].filter(Boolean));
      t.equal(w.length, 0, 'no warning anywhere on the title: ' + w.join(' / '));
    },
  },

  // ------------------------------------------------------------------ S6-07 the top-ten score is kept
  {
    name: 'S6-07 High scores, Title and Run again keep the score under the initials typed so far',
    async run(t) {
      const top = async () => (await t.state()).save.top;
      await endRun(t);
      await t.page.fill('#ini', 'zed');
      await t.page.click('[data-act="scores"]');
      let tp = await top();
      t.equal(tp.length, 1, 'High scores saved the pending score');
      t.equal(tp[0].initials, 'ZED', 'under the initials typed');
      t.expect(await t.page.evaluate(() => document.querySelector('.scores').textContent.includes('ZED')), 'and the list shows it');
      await endRun(t);
      await t.page.click('[data-act="title"]');
      tp = await top();
      t.equal(tp.length, 2, 'leaving through Title saved it');
      t.equal(tp.filter((e) => e.initials === 'ZED').length, 2, 'the last initials used are the default when none are typed');
      await endRun(t);
      await t.page.fill('#ini', '');
      await t.page.click('[data-act="endless"]');
      tp = await top();
      t.equal(tp.length, 3, 'Run again saved it');
      const saved = await stored(t);
      t.equal(saved.endless.top.length, 3, 'and it is written to storage');
    },
  },
  {
    name: 'S6-07 Escape on the Over panel keeps the score; Save score still works as before and saves it once',
    async run(t) {
      await endRun(t);
      await t.page.keyboard.press('Escape');
      await t.page.waitForFunction(() => window.__game.getState().screen === 'title', null, { timeout: 5000 });
      t.equal((await t.state()).save.top.length, 1, 'Escape saved the score');
      t.equal((await t.state()).save.top[0].initials, 'BAN', 'with the default initials when none were ever used');
      await endRun(t);
      await t.page.fill('#ini', 'ab1');
      await t.page.click('[data-act="saveScore"]');
      await t.waitFrames(3);
      const tp = (await t.state()).save.top;
      t.equal(tp.length, 2, 'one more entry, not two');
      t.expect(tp.some((e) => e.initials === 'AB1'), 'under the initials typed');
    },
  },

  // ------------------------------------------------------------------ S1-03 hit-stop on a chomp
  {
    name: 'S1-03 a chomp freezes the world for a moment, with the jaws shut on Bandit, then play goes on',
    async run(t) {
      await live(t);
      await t.page.evaluate(() => { const r = window.__CR.run; r.ev.push({ k: 'die', cause: 'chomp', row: r.p.row, x: r.p.x }); });
      await t.game('step', 1);
      t.expect(await t.page.evaluate(() => window.__CR.stop > 0.05 && window.__CR.stop <= 0.07), 'a hit-stop of about 70 ms is set');
      t.expect(await t.page.evaluate(() => window.__CR.renderer.chompT === 0 || window.__CR.renderer.chompT < 0.05), 'the jaws start to close');
      await t.game('resume');
      const w = await watch(t, { during: () => window.__CR.stop > 0, read: () => window.__CR.run.steps, done: () => window.__CR.stop === 0 });
      t.expect(w.finished, 'the freeze ends');
      t.expect(w.seen.length >= 1 && w.seen.every((v) => v === w.seen[0]), 'no step ran during the freeze: ' + [...new Set(w.seen)].join(' '));
      const after = (await run(t)).steps;
      await t.page.waitForFunction((n) => window.__CR.run.steps > n, after, { timeout: 5000 });
    },
  },
  {
    name: 'S1-03 the chomp pose shows the teeth shut over Bandit',
    async run(t) {
      await live(t);
      await t.game('act', 'warp', 1, 0, 4);
      await t.page.evaluate(() => { const r = window.__CR; r.run.p.invT = 0; r.run.p.state = 'dead'; r.run.p.cause = 'chomp'; r.run.p.t = 0.05; r.renderer.chompT = 1; r.kick(); });
      await t.waitFrames(3);
      await t.shot('S1-03-chomp');
    },
  },

  // ------------------------------------------------------------------ S1-05 swipes on the move
  {
    name: 'S1-05 a swipe hops as soon as it passes 24 px, while the finger is still down, and the lift does not hop again',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('setState', { player: { row: 0, col: 4 } });
      await t.waitFrames(5);
      const [x, y] = (await t.state()).camera.player;
      const cdp = await t.page.context().newCDPSession(t.page);
      const pt = (px, py) => [{ x: px, y: py, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x, y) });
      for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x - 12 * i, y) });
      await t.page.waitForFunction(() => window.__CR.run.hops >= 1, null, { timeout: 5000 });
      t.equal((await run(t)).hops, 1, 'the hop happened with the finger still down (72 px held)');
      await t.page.waitForFunction(() => window.__CR.run.p.state === 'idle', null, { timeout: 5000 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await t.waitFrames(15);
      const s = await run(t);
      t.equal(s.hops, 1, 'lifting the finger did not hop again');
      t.equal(s.player.col, 3, 'Bandit went left');
      await cdp.detach();
    },
  },
  {
    name: 'S1-05 a short drag is still a tap, and a swipe moves one hop only however far the finger goes',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('setState', { player: { row: 0, col: 4 } });
      await t.waitFrames(5);
      const [x, y] = (await t.state()).camera.player;
      await t.tap([x + 3, y - 80]); // above Bandit: up
      await t.page.waitForFunction(() => window.__CR.run.hops >= 1, null, { timeout: 5000 });
      await t.waitFrames(10);
      t.equal((await run(t)).hops, 1, 'one tap, one hop');
      await t.game('setState', { player: { row: 0, col: 4 } });
      const before = (await run(t)).hops;
      await t.touchDrag([x, y], [x + 160, y], { steps: 16 });
      await t.waitFrames(20);
      const s = await run(t);
      t.equal(s.hops - before, 1, 'a long swipe is one hop');
      t.equal(s.player.col, 5, 'to the right');
    },
  },

  // ------------------------------------------------------------------ S1-08 two presses in one frame
  {
    name: 'S1-08 two arrow presses inside one frame both hop',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('setState', { player: { row: 0, col: 4 } });
      await t.waitFrames(3);
      const before = (await run(t)).hops;
      await t.page.evaluate(() => { for (const code of ['ArrowLeft', 'ArrowLeft']) window.dispatchEvent(new KeyboardEvent('keydown', { code })); });
      await t.page.waitForFunction((n) => window.__CR.run.hops >= n + 2 && window.__CR.run.p.state === 'idle', before, { timeout: 5000 });
      const s = await run(t);
      t.equal(s.hops - before, 2, 'both presses made a hop');
      t.equal(s.player.col, 2, 'two columns to the left');
    },
  },

  // ------------------------------------------------------------------ S1-11 skip the dead time
  {
    name: 'S1-11 a hop pressed after the death has played out for a moment restarts at once',
    viewports: ['desktop'],
    async run(t) {
      await live(t);
      await t.game('act', 'warp', 1, 0, 4);
      await t.page.evaluate(() => { const r = window.__CR.run; r.p.invT = 0; r.p.state = 'dead'; r.p.cause = 'splash'; r.p.t = 0; r.rings = 3; });
      await t.game('resume');
      await t.page.waitForFunction(() => window.__CR.run.p.t >= 0.45 || window.__CR.run.p.state !== 'dead', null, { timeout: 5000 });
      t.equal((await run(t)).player.state, 'dead', 'still dead at 0.45 s');
      await t.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })));
      await t.page.waitForFunction(() => window.__CR.run.p.state !== 'dead', null, { timeout: 2000 });
      const s = await run(t);
      t.expect(s.t < 5, 'the retry began');
      await t.page.waitForFunction(() => window.__CR.run.hops >= 1, null, { timeout: 3000 });
      t.expect(true, 'and the pressed hop was made');
    },
  },

  // ------------------------------------------------------------------ S2-13 pinch-zoom and big text
  {
    name: 'S2-13 pinch-zoom is allowed on menus, and text can go to 175 percent without breaking Settings',
    async run(t) {
      const meta = await t.page.evaluate(() => document.querySelector('meta[name=viewport]').content);
      t.expect(!/user-scalable\s*=\s*no|maximum-scale/i.test(meta), 'the viewport no longer blocks zoom: ' + meta);
      await t.game('scene', 'settings'); await t.waitFrames(3);
      t.expect(await t.page.evaluate(() => /pinch-zoom|manipulation/.test(getComputedStyle(document.getElementById('screens')).touchAction)), 'menus accept a pinch');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('view')).touchAction), 'none', 'the play canvas takes no browser gestures');
      await t.page.click('[data-k="textScale"][data-v="1.75"]');
      await t.waitFrames(3);
      t.equal((await t.state()).settings.textScale, 1.75, 'the 175 percent step is chosen');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '28px', 'the text really is 175 percent');
      await t.checkLayout();
      await t.shot('S2-13-settings-175');
      await t.reload();
      t.equal((await t.state()).settings.textScale, 1.75, 'it survives a reload');
      await t.game('scene', 'title'); await t.waitFrames(3);
      await t.checkLayout();
      await t.shot('S2-13-title-175');
    },
  },
  {
    name: 'S2-13 a save with a hand-edited text size falls back to 100 percent, and the old steps still load',
    async run(t) {
      await seedSave(t, { settings: { textScale: 3 } });
      await t.reload();
      t.equal((await t.state()).settings.textScale, 1, 'an unknown size is repaired');
      await seedSave(t, { settings: { textScale: 1.5 } });
      await t.reload();
      t.equal((await t.state()).settings.textScale, 1.5, '150 percent is kept');
    },
  },

  // ------------------------------------------------------------------ S3-11 the win panel adds up
  {
    name: 'S3-11 the lines on the win panel add up to the score shown',
    async run(t) {
      await t.game('scene', 'win'); await t.waitFrames(3);
      const rows = await t.page.evaluate(() => [...document.querySelectorAll('.breakdown li')].map((li) => ({ tot: li.classList.contains('tot'), label: li.children[0].textContent, n: +li.children[1].textContent.replace(/[^0-9]/g, '') })));
      const total = rows.find((r) => r.tot).n, sum = rows.filter((r) => !r.tot).reduce((a, r) => a + r.n, 0);
      t.equal(sum, total, 'the listed lines (' + rows.filter((r) => !r.tot).map((r) => r.n).join(' + ') + ') add up to ' + total);
      t.expect(rows.some((r) => /^Rows hopped/.test(r.label)), 'rows have their own line: ' + rows.map((r) => r.label).join(' | '));
      await t.checkLayout();
      await t.shot('S3-11-win-breakdown');
    },
  },
  {
    name: 'S3-11 caps and the ball get their own lines when they were found',
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 });
      await t.game('pause');
      await t.page.evaluate(() => {
        const r = window.__CR.run;
        r.items.push({ id: 900, r: 0, c: 4, k: 'cap', st: 'free', washed: false }, { id: 901, r: 0, c: 4, k: 'ball', st: 'free', washed: false });
        r.pickup(0, 4); r.p.row = r.L.rows.length - 2; r.finish(); window.__CR.endAt = 0;
        window.__CR.screens.show('win', { L: r.L, res: r.result, fact: null, next: true, best: false, bestTime: false, assist: false, earned: [], nextUp: '' });
      });
      await t.waitFrames(3);
      const txt = await t.page.evaluate(() => document.querySelector('.breakdown').textContent);
      t.expect(/Caps \(1\).*\+25/.test(txt) && /Lost ball.*\+500/.test(txt), 'the cap and the ball are listed: ' + txt);
      await t.shot('S3-11-win-cap-ball');
    },
  },
];
