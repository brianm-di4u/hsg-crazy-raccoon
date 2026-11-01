// M5: performance budgets, browser state fuzz and the interaction sweep (DEV-PLAN matrix AC35, AC36).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const tests = [
  {
    name: 'performance: frame cost, load, memory, file sizes',
    async run(t) {
      const html = fs.statSync(path.join(ROOT, 'index.html')).size;
      const assets = fs.readdirSync(path.join(ROOT, 'assets')).reduce((a, f) => a + fs.statSync(path.join(ROOT, 'assets', f)).size, 0);
      t.log(`index.html ${(html / 1024).toFixed(0)} KB, assets ${(assets / 1024 / 1024).toFixed(2)} MB, hooks in ${t.loadMs} ms`);
      t.expect(html <= 2 * 1024 * 1024, 'index.html ≤ 2 MB');
      t.expect(assets <= 6 * 1024 * 1024, 'assets ≤ 6 MB');
      t.expect(t.loadMs <= 2000, 'interactive ≤ 2 s');
      await t.game('newGame', { level: 'l9', seed: 2 });
      await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
      await t.game('setState', { player: { row: 6, col: 4 } });
      const fc = await t.frameCost(2500);
      t.log(`frameCost ${JSON.stringify(fc)}`);
      // the PRD §10 budget is the real-GPU number (8 ms desktop, 12 ms mobile), enforced with --gpu. Under the default
      // software rasterizer the cost swings 50%+ with machine load (shared LESSONS; Furious Squirrels does the same), so
      // those runs log the number instead of failing on it.
      const budget = t.viewport === 'mobile' ? 12 : 8;
      if (t.gpu) t.expect(fc.taskMs <= budget, `main-thread ms per frame ${fc.taskMs} (budget ${budget}, gpu)`);
      else t.log(`software raster: ${fc.taskMs} ms per frame (logged, not enforced; run --gpu for the budget)`);
      if (t.viewport === 'mobile') {
        await t.cpuThrottle(4);
        const thr = await t.frameCost(2500);
        t.log(`4x throttle frameCost ${JSON.stringify(thr)}`);
        await t.cpuThrottle(1);
      }
      const mb = await t.memoryMB();
      t.log(`heap ${mb} MB`);
      t.expect(mb <= 60, 'heap ≤ 60 MB');
    },
  },
  {
    // the zone passes (barn lamps and rafters, night darkness and rims, endless beam) cost the most raster time
    name: 'performance: frame cost in every zone theme',
    async run(t) {
      const budget = t.viewport === 'mobile' ? 12 : 8; // enforced with --gpu only (see above)
      for (const [label, opts, row] of [['day l2', { level: 'l2' }, 3], ['barn l11', { level: 'l11' }, 6], ['night l14', { level: 'l14' }, 6], ['boss l15', { level: 'l15' }, 4], ['endless', { mode: 'endless' }, 0]]) {
        await t.game('newGame', { ...opts, seed: 2 });
        await t.page.waitForFunction(() => window.__game.getState().loading === 0, null, { timeout: 8000 });
        if (row) await t.game('setState', { player: { row, col: 4 } });
        const fc = await t.frameCost(1500);
        t.log(`${label}: ${fc.taskMs} ms, ${fc.fps} fps`);
        if (t.gpu) t.expect(fc.taskMs <= budget, `${label} main-thread ms per frame ${fc.taskMs} (budget ${budget}, gpu)`);
      }
    },
  },
  {
    name: 'state fuzz: random scenes, levels and actions',
    slow: true,
    async run(t) {
      const res = await t.page.evaluate(async () => {
        let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
        const G = window.__game, scenes = ['title', 'map', 'help', 'settings', 'notebook', 'credits', 'scores', 'pause', 'endless', 'play'];
        const bad = [];
        for (let i = 0; i < 160; i++) {
          const r = rnd();
          if (r < 0.15) G.scene(scenes[Math.floor(rnd() * scenes.length)]);
          else if (r < 0.35) G.newGame({ level: 'l' + (1 + Math.floor(rnd() * 15)), seed: i, assist: rnd() < 0.3 });
          else if (r < 0.4) G.newGame({ mode: 'endless', seed: i });
          else if (r < 0.75) { G.pause(); G.act('hop', ['up', 'down', 'left', 'right'][Math.floor(rnd() * 4)]); G.step(Math.floor(rnd() * 120)); }
          else if (r < 0.8) G.act('lure');
          else if (r < 0.9) G.setState({ player: { row: Math.floor(rnd() * 12), col: Math.floor(rnd() * 9) } });
          else G.step(Math.floor(rnd() * 600));
          const s = G.getState();
          if (s.run) { const p = s.run.player; if (!Number.isFinite(p.x) || p.row < 0 || p.row >= s.run.rows) bad.push({ i, p }); }
        }
        return bad;
      });
      t.equal(res.length, 0, `insane states: ${JSON.stringify(res.slice(0, 3))}`);
      await t.shot('m5-fuzz-end');
    },
  },
  {
    name: 'interaction sweep: every menu button on every screen',
    async run(t) {
      await t.game('act', 'unlockAll');
      const visited = new Set();
      const screensToSweep = ['title', 'map', 'help', 'settings', 'notebook', 'credits', 'scores', 'pause'];
      for (const sc of screensToSweep) {
        await t.game('scene', sc);
        const acts = await t.page.$$eval('#screens button[data-act]:not([disabled])', (bs) => bs.map((b) => ({ act: b.dataset.act, k: b.dataset.k, v: b.dataset.v })));
        for (const a of acts) {
          if (['resetSave', 'resetYes'].includes(a.act)) continue;
          await t.game('scene', sc);
          const sel = `#screens button[data-act="${a.act}"]${a.k ? `[data-k="${a.k}"]` : ''}${a.v ? `[data-v="${a.v}"]` : ''}`;
          const el = await t.page.$(sel);
          if (!el) continue;
          await el.click();
          await t.waitFrames(2);
          const s = await t.state();
          visited.add(`${sc}:${a.act}:${a.k || ""}:${a.v || ""}`);
          t.expect(s.ready, `still running after ${sc} → ${a.act}`);
        }
      }
      t.log(`clicked ${visited.size} distinct buttons`);
      t.expect(visited.size >= 30, 'swept the menus');
      // the results and fail screens' buttons
      for (const sc of ['win', 'fail']) {
        await t.game('scene', sc);
        await t.shot(`m5-${sc}`, { animations: true });
        const acts = await t.page.$$eval('#screens button[data-act]', (bs) => bs.map((b) => b.dataset.act));
        for (const a of acts) { await t.game('scene', sc); await t.page.click(`#screens button[data-act="${a}"]`); await t.waitFrames(2); }
      }
      // settings persist across reload
      await t.game('scene', 'settings');
      await t.page.click('#screens button[data-k="textScale"][data-v="1.25"]');
      await t.reload();
      t.equal((await t.state()).settings.textScale, 1.25, 'setting saved');
      await t.game('setState', { settings: { textScale: 1 } });
    },
  },
];
