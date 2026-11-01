// M4: presentation, accessibility and input (DEV-PLAN matrix AC4, AC24–AC32).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/manifest.json'), 'utf8'));
const start = async (t, level = 'l1', seed = 5) => { await t.game('newGame', { level, seed }); await t.game('pause'); };

export const tests = [
  {
    name: 'painted art loads from the manifest only',
    async run(t) {
      const reqs = [];
      t.page.on('request', (r) => { if (r.url().includes('/assets/')) reqs.push(r.url().split('/assets/')[1]); });
      await t.reload();
      await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
      const s = await t.state();
      t.equal(s.art, Object.keys(MAN).length > 0, 'art loaded when the manifest lists files');
      const files = new Set(Object.values(MAN).map((m) => m.file));
      t.expect(reqs.every((f) => files.has(f)), 'only manifest files requested');
      await t.shot('m4-title-art');
      await start(t, 'l3');
      await t.game('step', 200);
      await t.shot('m4-art');
      await t.checkLayout();
    },
  },
  {
    name: 'vector fallback with ?art=0',
    url: 'index.html?art=0',
    async run(t) {
      const s = await t.state();
      t.equal(s.art, false, 'no art');
      await start(t, 'l3');
      await t.game('step', 200);
      await t.shot('m4-noart');
    },
  },
  {
    name: 'mid-hop squash and FX',
    async run(t) {
      await start(t, 'l1');
      await t.game('act', 'hop', 'up');
      await t.game('step', 8);
      await t.game('act', 'clock', 2000);
      await t.shot('m4-hop-squash', { wait: false });
      await t.game('act', 'clock', null);
      // splash: drop into empty water off a pool stone
      await t.game('setState', { player: { row: 5, col: 0 } });
      await t.stepUntil(() => window.__game.act('gatorAt', 6).every((q) => { const back = q.dir > 0 ? q.x - q.len * 64 : q.x; return !(32 > back - 20 && 32 < back + q.len * 64 + 20); }), { max: 2000, chunk: 4, label: 'gap' });
      await t.game('act', 'hop', 'up'); await t.game('step', 22);
      const n = await t.game('act', 'fxCount');
      t.expect(n > 5, `splash particles (${n})`);
      await t.shot('m4-splash-fx', { wait: false });
    },
  },
  {
    name: 'reduced motion',
    reducedMotion: true,
    async run(t) {
      const s = await t.state();
      t.equal(s.reduced, true, 'prefers-reduced-motion honoured');
      await start(t, 'l2');
      await t.game('step', 120);
      await t.shot('m4-reduced');
    },
  },
  {
    name: 'text scale 150% keeps menus and HUD on screen',
    async run(t) {
      await t.game('setState', { settings: { textScale: 1.5 } });
      await t.game('scene', 'settings');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('m4-text150');
      await start(t, 'l1');
      await t.checkLayout();
      await t.shot('m4-text150-hud');
      await t.game('setState', { settings: { textScale: 1 } });
    },
  },
  {
    name: 'HUD and menu contrast',
    async run(t) {
      await start(t, 'l1');
      const r = await t.contrastReport({ selector: '#hud' });
      t.expect(r.fails.length === 0, `HUD contrast fails: ${JSON.stringify(r.fails.slice(0, 3))}`);
      await t.shot('m4-hud');
      for (const sc of ['title', 'help', 'settings', 'notebook', 'credits']) {
        await t.game('scene', sc);
        const c = await t.contrastReport({ selector: '#screens', skip: '.title-wrap .fineprint, .title-wrap .note, .brand' });
        t.expect(c.fails.length === 0, `${sc} contrast fails: ${JSON.stringify(c.fails.slice(0, 3))}`);
      }
    },
  },
  {
    name: 'pause by key, button and blur; audio toggles',
    async run(t) {
      await t.game('newGame', { level: 'l1' });
      if (t.viewport === 'desktop') { await t.page.keyboard.press('KeyP'); await t.waitFrames(3); t.equal((await t.state()).screen, 'pause', 'P pauses'); await t.page.keyboard.press('Escape'); await t.waitFrames(3); t.equal((await t.state()).screen, null, 'Esc resumes'); }
      const box = await t.page.$eval('#h-pause', (b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height]; });
      t.expect(box[2] >= 44 && box[3] >= 44, 'pause button ≥ 44 px');
      if (t.viewport === 'mobile') await t.tap([box[0], box[1]]); else await t.page.mouse.click(box[0], box[1]);
      await t.waitFrames(3);
      t.equal((await t.state()).screen, 'pause', 'pause button');
      await t.shot('m4-pause');
      await t.game('resume'); await t.game('act', 'menu', 'resume');
      await t.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
      t.equal((await t.state()).screen, 'pause', 'hidden tab pauses');
      // audio settings flow into the audio state
      await t.page.keyboard.press('Enter');
      await t.game('setState', { settings: { sound: false, music: false } });
      let a = (await t.state()).audio;
      t.equal(a.on, false); t.equal(a.music, false);
      await t.game('setState', { settings: { sound: true, music: true } });
      a = (await t.state()).audio;
      t.equal(a.on, true);
    },
  },
  {
    name: 'touch: swipe four ways, tap hops up, lure button',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l4' });
      await t.game('setState', { player: { row: 1, col: 4 }, lures: 1 });
      const cx = 195, cy = 600;
      const before = (await t.state()).run.player;
      await t.touchDrag([cx, cy], [cx + 80, cy], { steps: 6 }); await t.waitFrames(20);
      let p = (await t.state()).run.player;
      t.equal(p.col, before.col + 1, 'swipe right');
      await t.touchDrag([cx, cy], [cx - 80, cy], { steps: 6 }); await t.waitFrames(20);
      p = (await t.state()).run.player; t.equal(p.col, before.col, 'swipe left');
      await t.touchDrag([cx, cy], [cx, cy - 90], { steps: 6 }); await t.waitFrames(20);
      p = (await t.state()).run.player; t.equal(p.row, before.row + 1, 'swipe up');
      await t.touchDrag([cx, cy], [cx, cy + 90], { steps: 6 }); await t.waitFrames(20);
      p = (await t.state()).run.player; t.equal(p.row, before.row, 'swipe down');
      await t.tap([cx, cy]); await t.waitFrames(20);
      p = (await t.state()).run.player; t.equal(p.row, before.row + 1, 'tap hops up');
      const lb = await t.page.$eval('#h-lure', (b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; });
      t.expect(lb[2] >= 64, 'lure button ≥ 64 px');
      await t.tap([lb[0], lb[1]]); await t.waitFrames(4);
      t.equal((await t.state()).run.lures, 0, 'lure button (pointerup)');
    },
  },
  {
    name: 'gamepad d-pad hops and Start pauses',
    viewports: ['desktop'],
    initScript: () => {
      window.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0], connected: true, index: 0, mapping: 'standard' };
      navigator.getGamepads = () => [window.__pad];
    },
    async run(t) {
      await t.game('newGame', { level: 'l1' });
      const press = async (i) => { await t.page.evaluate((i) => { window.__pad.buttons[i] = { pressed: true, value: 1 }; }, i); await t.waitFrames(3); await t.page.evaluate((i) => { window.__pad.buttons[i] = { pressed: false, value: 0 }; }, i); await t.waitFrames(20); };
      await press(12);
      t.equal((await t.state()).run.player.row, 1, 'd-pad up hops');
      await press(15);
      t.equal((await t.state()).run.player.col, 5, 'd-pad right hops');
      await press(9);
      t.equal((await t.state()).screen, 'pause', 'Start pauses');
      await press(0);
      t.equal((await t.state()).screen, null, 'A resumes from the focused Resume button');
    },
  },
];
