// window.__game test hooks (shared/test-harness/README.md contract; MECHANICS §13). All results are
// JSON-serializable. Shape after games/Cart Racing/src/js/hooks.js (Hot Springs Games, MIT).
import { hashRun } from './sim/run.js';
import { solve } from './sim/solve.js';
import { colX } from './sim/const.js';

const DIRS = { u: 'up', d: 'down', l: 'left', r: 'right' };

export function installHooks(App, api) {
  const summary = () => {
    const run = App.run, L = run ? run.L : null;
    return {
      scene: App.scene, screen: App.screens.cur, ready: App.ready, loading: App.loading, paused: App.paused || App.testPaused, mode: run ? run.mode : null,
      level: L ? { id: L.id, n: L.n, zone: L.zone, name: L.name, rows: run.N, par: L.par || null, theme: L.theme || null } : null,
      run: run ? run.summary() : null,
      camera: { row: +App.renderer.cam.toFixed(2), tile: +App.renderer.tile.toFixed(2), bx: +App.renderer.bx.toFixed(1), w: App.renderer.w, h: App.renderer.h },
      settings: App.save.settings, reduced: App.reduced, art: !!App.renderer.art,
      save: { unlocked: App.save.unlocked, endlessUnlocked: App.save.endless.unlocked, top: App.save.endless.top, progress: App.save.progress, notebook: App.save.notebook.length, merman: App.save.merman },
      audio: api.audioState(), steps: App.steps, said: App.lastSaid, fx: App.renderer.fx.count(),
    };
  };
  window.__game = {
    seed(n) { App.nextSeed = n >>> 0; return true; },
    getState: summary,
    setState(s = {}) {
      if (s.settings) { Object.assign(App.save.settings, s.settings); api.applySettings(); }
      if (s.save) { Object.assign(App.save, s.save); api.persist(); }
      const run = App.run;
      if (run) {
        if (s.player) {
          const p = run.p;
          if (s.player.row != null) p.row = s.player.row;
          p.x = s.player.x ?? (s.player.col != null ? colX(s.player.col) : p.x);
          p.state = 'idle'; p.on = null; p.queue = null; p.t = 0;
          if (s.player.ride) { const g = run.world.gators.find((q) => q.row === p.row && Math.abs(q.x - p.x) < q.len * 64); if (g) p.on = g.id; }
          App.renderer.snap(p.row, p.x);
        }
        if (s.rings != null) run.rings = s.rings;
        if (s.lures != null) run.lures = s.lures;
        if (s.carry) for (const k of s.carry) run.items.push({ id: run.items.length, r: -9, c: 0, k, st: 'carried', washed: false });
      }
      App.kick();
      return summary();
    },
    isIdle() { return App.ready && App.loading === 0 && performance.now() >= (App.screens.transUntil || 0) && (App.scene !== 'play' || App.paused || App.testPaused || !!App.screens.cur); },
    step(n = 1) { for (let i = 0; i < n; i++) api.stepOnce(App.held ? { hop: App.held } : {}); App.held = null; App.kick(); return summary(); },
    pause() { App.testPaused = true; return true; },
    resume() { App.testPaused = false; App.paused = false; App.kick(); return true; },
    scene(name) {
      if (name === 'title') api.showTitle();
      else if (name === 'map') { api.showTitle(); App.screens.show('map', { levels: App.LEVELS }); }
      else if (name === 'play' || name === 'game') { api.startLevel(App.LEVELS[0], { intro: false }); }
      else if (name === 'endless') api.startEndless({ intro: false });
      else if (['help', 'settings', 'notebook', 'credits', 'scores'].includes(name)) { if (App.scene !== 'title') api.showTitle(); App.screens.show(name, name === 'notebook' ? { facts: App.FACTS } : { from: 'title' }); }
      else if (name === 'pause') { if (App.scene !== 'play') api.startLevel(App.LEVELS[0], { intro: false }); api.pauseGame(); }
      else if (name === 'win' || name === 'fail') {
        // the stored plan is for Assist off
        const was = App.save.settings.assist; App.save.settings.assist = false;
        const L = App.LEVELS[0], run = api.startLevel(L, { intro: false });
        App.save.settings.assist = was;
        if (name === 'win') { for (const [st, d] of L.plan) { while (run.steps < st) api.stepOnce({}); api.stepOnce({ hop: DIRS[d] }); } let n = 0; while (run.phase === 'play' && n++ < 6000) api.stepOnce({}); }
        else { run.rings = 1; run.p.row = 2; run.p.x = colX(4); run.p.on = null; run.p.state = 'idle'; let n = 0; while (run.phase === 'play' && n++ < 2000) api.stepOnce({}); }
        App.endAt = 0; api.levelDone(run);
      }
      App.kick();
      return summary();
    },
    newGame(opts = {}) {
      if (opts.seed != null) App.nextSeed = opts.seed >>> 0;
      if (opts.assist != null) App.save.settings.assist = !!opts.assist;
      if (opts.mode === 'endless') api.startEndless({ intro: !!opts.intro });
      else api.startLevel(api.levelById(opts.level ?? 'l1') || App.LEVELS[0], { intro: !!opts.intro });
      App.kick();
      return summary();
    },
    act(name, ...a) {
      const run = App.run;
      switch (name) {
        case 'hop': if (run) { api.stepOnce({ hop: a[0] }); App.kick(); } return summary();
        case 'input': App.held = a[0] || null; return true;
        case 'lure': if (run) { api.stepOnce({ lure: true }); } return summary();
        case 'hash': return run ? hashRun(run) : 0;
        case 'replay': { // replay the level's stored plan (or a given one) at full speed
          if (!run) return null;
          // plans count steps from the level start: restart the level if the live loop already ran some
          let r = run;
          if (r.steps && r.mode !== 'endless' && App.level) { App.testPaused = true; r = api.startLevel(App.level, { intro: false, seed: r.seed }); }
          const plan = a[0] || (r.L.plan || []).map(([st, d]) => ({ step: st, dir: DIRS[d] }));
          let i = 0, guard = 0;
          while (r.phase === 'play' && guard++ < 120 * 300) { const m = plan[i]; const hop = m && m.step === r.steps ? (i++, m.dir) : null; api.stepOnce({ hop }); if (a[1] && r.steps >= a[1]) break; }
          return summary();
        }
        case 'solve': return run ? solve(run.L, { assist: run.assist }) : null;
        case 'clock': App.clock = a[0] == null ? null : a[0] / 1000; return true;
        case 'unlockAll': App.save.unlocked = App.LEVELS.length; App.save.endless.unlocked = true; api.persist(); if (App.screens.cur) App.screens.refresh(); return true;
        case 'clearSave': App.save.progress = {}; App.save.unlocked = 1; App.save.endless = { unlocked: false, top: [] }; App.save.notebook = []; App.save.merman = false; api.persist(); return true;
        case 'hud': for (const id of ['hud', 'screens']) { const el = document.getElementById(id); if (el) el.style.visibility = a[0] === false ? 'hidden' : ''; } return true;
        case 'fxCount': return App.renderer.fx.count();
        case 'gatorAt': return run ? run.world.gators.filter((g) => g.row === a[0]).map((g) => ({ id: g.id, x: g.x, k: g.k, jaw: g.jaw, len: g.len, dir: g.dir })) : [];
        case 'menu': App.onMenu(a[0], a[1] || {}); return App.screens.cur;
        case 'warp': { // jump to a row in the current level for screenshots
          if (!run) return null;
          for (let i = 0; i < (a[1] || 0); i++) api.stepOnce({});
          run.p.row = a[0]; run.p.x = colX(a[2] ?? 4); run.p.state = 'idle'; run.p.on = null; run.p.invT = 5;
          App.renderer.snap(a[0], run.p.x);
          return summary();
        }
        default: return false;
      }
    },
  };
}
