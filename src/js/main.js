// Crazy Raccoon: app shell. Owns the Run, the renderer, HUD, screens, input, audio, saves and the frame loop.
// The rules live in sim/ (no DOM); this file only drives them. Fixed-step loop with render on demand adapted from
// games/Furious Squirrels/src/js/main.js (Hot Springs Games, MIT).
import { DT } from './sim/const.js';
import { Run } from './sim/run.js';
import { Bot } from './sim/bot.js';
import { Renderer } from './gfx/renderer.js';
import { loadArt } from './gfx/art.js';
import { Hud } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { initInput, initTouch, pollGamepads, readIntent, consumePause, consumeMenu, setEnabled } from './ui/input.js';
import { initAudio, setAudio, sfx, playTheme, audioState } from './ui/audio.js';
import { loadSave, writeSave, DEFAULT_SAVE } from './save.js';
import { makeRng, hashStr } from './rng.js';
import { installHooks } from './hooks.js';

/* global LEVELDATA, FACTS, MANIFEST */
const LEVELS = typeof LEVELDATA !== 'undefined' ? LEVELDATA.levels : [];
const ALLFACTS = typeof FACTS !== 'undefined' ? [...FACTS.bank, ...FACTS.research] : [];
const THEME_MUSIC = { day: 'day', noon: 'noon', barn: 'barn', night: 'night' };

const App = {
  scene: 'boot', ready: false, loading: 0, paused: false, testPaused: false, time: 0, clock: null, steps: 0,
  save: loadSave(), run: null, level: null, nextSeed: null, reduced: false, demo: null, endAt: 0, fact: null, LEVELS, FACTS: ALLFACTS, lastSaid: '',
};
window.__CR = App;

const canvas = document.getElementById('view');
const renderer = new Renderer(canvas, makeRng(0xf00d));
App.renderer = renderer;
const hud = new Hud(document.getElementById('hud'), App);
const screens = new Screens(document.getElementById('screens'), App);
App.hud = hud; App.screens = screens;
const live = document.getElementById('live');
App.say = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); App.lastSaid = t; };

// ---------------------------------------------------------------------------------------------------------------
function applySettings() {
  const s = App.save.settings;
  document.documentElement.style.setProperty('--text-scale', s.textScale || 1);
  const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  App.reduced = s.reducedMotion == null ? sys : !!s.reducedMotion;
  renderer.reduced = App.reduced;
  renderer.fx.scale = App.reduced ? 0.4 : 1;
  document.body.classList.toggle('reduced', App.reduced);
  setAudio(s);
}
function persist(options) { writeSave(App.save, options); applySettings(); }

// ---------------------------------------------------------------------------------------------------------------
// runs
function levelById(id) { return LEVELS.find((L) => L.id === id || L.n === +id) || null; }
function pickFact(L) {
  // a fact for the intro card: rotate through the bank by level and zone topic
  if (!ALLFACTS.length) return null;
  const topic = { 1: 'farm', 2: 'gator', 3: 'farm', 4: 'farm', 5: 'raccoon' }[L.zone] || 'gator';
  const pool = ALLFACTS.filter((f) => f.topic === topic || f.topic === 'gator');
  return pool[hashStr(String(L.id)) % pool.length];
}

function startLevel(L, { seed, intro = true } = {}) {
  App.level = L;
  App.run = new Run(JSON.parse(JSON.stringify(L)), { seed: seed ?? App.nextSeed ?? hashStr(L.id), assist: App.save.settings.assist });
  enterPlay();
  App.fact = pickFact(L);
  if (intro) { App.paused = false; screens.show('intro', { L: App.run.L, fact: App.fact, assist: App.save.settings.assist }); setEnabled(false); }
  else beginPlay();
  return App.run;
}
function startEndless({ seed, intro = true } = {}) {
  App.level = null;
  App.run = new Run({ id: 'endless' }, { mode: 'endless', seed: seed ?? App.nextSeed ?? (Date.now() & 0xffffff), assist: App.save.settings.assist });
  enterPlay();
  App.fact = ALLFACTS.length ? ALLFACTS[(Date.now() >> 10) % ALLFACTS.length] : null;
  if (intro) { screens.show('intro', { L: { ...App.run.L, intro: 'Night falls. Hop as far as you can before the keeper\'s lantern catches up. Three tail rings.', rings: 3 }, fact: App.fact, assist: false }); setEnabled(false); }
  else beginPlay();
  return App.run;
}
function enterPlay() {
  App.demo = null; App.scene = 'play'; document.body.dataset.scene = 'play';
  App.paused = false; App.endAt = 0;
  renderer.fx.clear(); renderer.snap(0, App.run.p.x);
  hud.show(true); hud.update(App.run);
  playTheme(THEME_MUSIC[App.run.L.theme] || 'day');
  kick();
}
function beginPlay() {
  screens.hide(); setEnabled(true); App.paused = false;
  const L = App.run.L;
  App.say(L.n ? `Level ${L.n}, ${L.name}. Reach the den.` : 'Moonlight Run. Go!');
  hud.hint(App.save.settings.hints && L.n === 1 ? (matchMedia('(pointer: coarse)').matches ? 'Tap where to hop' : 'Arrow keys or WASD to hop') : '');
  kick();
}

function showTitle() {
  App.run = null; App.level = null; App.scene = 'title'; document.body.dataset.scene = 'title';
  hud.show(false); setEnabled(false);
  // attract mode: a bot crosses level 1 behind the title (ambient: isIdle ignores it)
  const L = LEVELS[0];
  if (L) { App.demo = new Run(JSON.parse(JSON.stringify(L)), { seed: 3 }); App.demoBot = new Bot(App.demo, makeRng(11), 'good'); renderer.snap(0); }
  screens.show('title');
  playTheme('title');
  kick();
}

function pauseGame() {
  if (App.scene !== 'play' || screens.cur || !App.run || App.run.phase !== 'play') return;
  App.paused = true; setEnabled(false); screens.show('pause'); kick();
}
function resumeGame() { screens.hide(); App.paused = false; setEnabled(true); kick(); }

// results
function levelDone(run) {
  const L = App.level, s = App.save, res = run.result;
  if (!res) return;
  s.stats.runs++;
  if (run.mode === 'endless') {
    const rows = Math.max(0, run.maxRow);
    const entry = { score: res.score, rows };
    const top = s.endless.top, rank = top.length < 10 || res.score > top[top.length - 1].score ? top.filter((e) => e.score >= res.score).length : -1;
    persist();
    screens.show('over', { res: { ...res, rows }, rank, entry });
    App.pendingScore = rank >= 0 ? entry : null;
    setEnabled(false); sfx('fail');
    return;
  }
  if (!res.win) { screens.show('fail', { L, cause: run.p.cause }); setEnabled(false); sfx('fail'); persist(); return; }
  const pr = s.progress[L.id] || { stars: [false, false, false], best: 0, bestT: null, ball: false };
  const best = res.score > pr.best;
  pr.stars = pr.stars.map((b, i) => b || res.stars[i]); pr.best = Math.max(pr.best, res.score);
  pr.bestT = pr.bestT == null ? res.t : Math.min(pr.bestT, res.t); pr.ball = pr.ball || res.ball;
  s.progress[L.id] = pr;
  s.unlocked = Math.max(s.unlocked, Math.min(LEVELS.length, L.n + 1));
  if (L.n >= 6) s.endless.unlocked = true;
  if (res.ticket) s.merman = true;
  // collect a fact card: the intro fact if new, else the first unseen one
  let f = App.fact && !s.notebook.includes(App.fact.id) ? App.fact : ALLFACTS.find((x) => !s.notebook.includes(x.id));
  if (f) s.notebook.push(f.id);
  s.stats.treats += run.treatsBanked();
  persist();
  const next = LEVELS.find((x) => x.n === L.n + 1);
  screens.show('win', { L, res, fact: f, next: !!next, best, assist: App.save.settings.assist });
  setEnabled(false);
  sfx('win'); res.stars.forEach((b, i) => { if (b) setTimeout(() => sfx('star', i), 500 + i * 220); });
}

// ---------------------------------------------------------------------------------------------------------------
// menus and HUD
App.onHud = (a) => {
  if (a === 'pause') pauseGame();
  else if (a === 'lure' && App.run && App.scene === 'play' && !App.paused && !screens.cur) { App.lureReq = true; kick(); }
};

App.onMenu = (act, d = {}) => {
  sfx('menu');
  const s = App.save;
  switch (act) {
    case 'play': return screens.show('map', { levels: LEVELS });
    case 'level': { const L = levelById(d.v); if (L) startLevel(L); return; }
    case 'locked': return;
    case 'go': return beginPlay();
    case 'endless': if (!s.endless.unlocked) { App.say('Clear level 6 to unlock the Moonlight Run.'); return; } return startEndless();
    case 'help': return screens.show('help', { from: screens.cur });
    case 'settings': return screens.show('settings', { from: screens.cur });
    case 'notebook': return screens.show('notebook', { facts: ALLFACTS });
    case 'credits': return screens.show('credits');
    case 'scores': return screens.show('scores', { from: screens.cur });
    case 'title': return showTitle();
    case 'set': {
      const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v === 'null' ? null : +d.v;
      s.settings[d.k] = v; persist(); return screens.refresh();
    }
    case 'resetSave': return screens.show('confirmReset', { from: 'settings' });
    case 'resetYes': App.save = DEFAULT_SAVE(); persist({ reset: true }); return showTitle();
    case 'resume': return resumeGame();
    case 'restart': if (App.run && App.run.mode === 'endless') return startEndless({ intro: false }); if (App.level) return startLevel(App.level, { intro: false }); return;
    case 'next': { const L = LEVELS.find((x) => x.n === App.level.n + 1); if (L) startLevel(L); return; }
    case 'map': App.scene = 'title'; App.run = null; hud.show(false); showTitle(); return screens.show('map', { levels: LEVELS });
    case 'quit': return App.run && App.run.mode === 'endless' ? showTitle() : App.onMenu('map');
    case 'saveScore': {
      const inp = document.getElementById('ini');
      const ini = ((inp && inp.value) || 'BAN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'BAN';
      if (App.pendingScore) {
        const e = { initials: ini, score: App.pendingScore.score, rows: App.pendingScore.rows, date: new Date().toISOString().slice(0, 10) };
        s.endless.top.push(e); s.endless.top.sort((a, b) => b.score - a.score); s.endless.top.length = Math.min(10, s.endless.top.length);
        s.lastInitials = ini; App.pendingScore = null; persist();
      }
      return screens.show('scores');
    }
    case 'back': {
      const from = screens.data.from;
      if (screens.cur === 'pause') return resumeGame();
      if (from === 'pause') return screens.show('pause');
      if (from === 'settings') return screens.show('settings');
      if (screens.cur === 'intro') return App.level ? App.onMenu('map') : showTitle();
      if (App.scene === 'play' && App.run && App.run.phase !== 'play') return App.onMenu('map');
      return showTitle();
    }
    default: return;
  }
};

document.getElementById('screens').addEventListener('submit', (e) => { e.preventDefault(); App.onMenu('saveScore'); });

// ---------------------------------------------------------------------------------------------------------------
// frame loop
let rafId = 0, inFrame = false, last = 0, acc = 0;
function kick() { if (!rafId && !inFrame) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
App.kick = kick;

function stepOnce(input = {}) {
  const run = App.run;
  if (!run) return;
  run.step(input);
  App.steps++;
  handleEvents(run);
}
App.stepOnce = stepOnce;

function handleEvents(run) {
  for (const e of run.drain()) {
    renderer.onEvent(e, run);
    switch (e.k) {
      case 'hop': sfx('hop', run.hops); App.save.stats.hops++; if (run.hops === 1) hud.hint(''); break;
      case 'land': if (!e.ride) sfx('land'); break;
      case 'bump': sfx('bump'); break;
      case 'knock': sfx('bump'); break;
      case 'nudge': sfx('nudge'); break;
      case 'die':
        sfx(e.cause === 'splash' ? 'splash' : e.cause === 'chomp' ? 'chomp' : e.cause === 'spotted' || e.cause === 'caught' ? 'spotted' : 'splash');
        if (e.cause === 'chomp') App.save.stats.chomps++; if (e.cause === 'splash') App.save.stats.splashes++;
        App.say({ chomp: 'Chomped!', splash: 'Splash!', swept: 'Swept away!', spotted: 'Spotted!', caught: 'Caught by the lantern!' }[e.cause] + ` ${run.rings} tail rings left.`);
        break;
      case 'pickup': sfx(e.item === 'cap' ? 'cap' : e.item === 'ball' ? 'ball' : 'pickup'); if (e.item === 'ball') App.say('You found the lost home-run ball!'); break;
      case 'wash': sfx('wash'); break;
      case 'bank': sfx('bank'); App.say(`${e.n} snack${e.n > 1 ? 's' : ''} banked.`); break;
      case 'lure': sfx('lure'); break;
      case 'streak': sfx('streak', e.mult); break;
      case 'whipWind': sfx('whip'); break;
      case 'fling': sfx('whip'); break;
      case 'full': hud.hint('Paws full!'); setTimeout(() => hud.hint(''), 900); break;
      case 'win': App.say('Home free!'); break;
      default: break;
    }
  }
  if (run.phase !== 'play' && !App.endAt) App.endAt = App.time + (App.clock != null ? 0 : 1.0);
}

function frame(now) {
  rafId = 0; inFrame = true;
  try {
    const dtw = Math.min(0.1, (now - last) / 1000); last = now;
    App.time = App.clock != null ? App.clock : App.time + dtw;
    if (renderer.resize()) { if (App.run) renderer.snap(App.run.p.row, App.run.p.x); }
    pollGamepads();
    // once a pad is connected keep polling it in menus and pause too (the loop would otherwise sleep)
    if (!App.padSeen && navigator.getGamepads) App.padSeen = [...navigator.getGamepads()].some((p) => p && p.connected);
    const m = consumeMenu();
    if (screens.cur) screens.nav(m);
    if (consumePause()) { if (App.paused && screens.cur === 'pause') resumeGame(); else pauseGame(); }
    let busy = false;
    const run = App.run;
    if (run && App.scene === 'play') {
      if (!App.paused && !App.testPaused && !screens.cur && run.phase === 'play') {
        acc += dtw;
        let n = 0;
        while (acc >= DT && n < 12) {
          const intent = n === 0 ? readIntent() : { hop: null, lure: false };
          if (App.lureReq) { intent.lure = true; App.lureReq = false; }
          stepOnce(intent); acc -= DT; n++;
        }
        busy = true;
      } else acc = 0;
      if (run.phase !== 'play' && App.endAt && App.time >= App.endAt && !screens.cur) { App.endAt = 0; levelDone(run); }
      else if (run.phase !== 'play' && App.endAt) busy = true;
      if (renderer.update(dtw, run)) busy = true;
      renderer.draw(run, { time: App.time });
      hud.update(run);
    } else if (App.scene === 'title' && renderer.drawTitle(App.time)) {
      busy = !App.reduced;
    } else if (App.demo) {
      // attract demo behind the title
      const d = App.demo;
      if (!App.reduced) { for (let i = 0; i < Math.round(dtw / DT); i++) { d.step(App.demoBot.input()); for (const e of d.drain()) renderer.onEvent(e, d); } }
      if (d.phase !== 'play') { App.demo = new Run(JSON.parse(JSON.stringify(LEVELS[0])), { seed: (d.seed + 1) >>> 0 }); App.demoBot = new Bot(App.demo, makeRng(d.seed + 7), 'good'); renderer.snap(0); }
      renderer.update(dtw, App.demo);
      renderer.draw(App.demo, { time: App.time });
    }
    App.busy = busy;
    const ambient = (!!App.demo && !App.reduced && !document.hidden) || (App.padSeen && !document.hidden);
    if (busy || App.loading || renderer.fx.busy()) rafId = requestAnimationFrame(frame);
    else if (ambient) rafId = requestAnimationFrame(frame);
  } catch (err) { showError(err); }
  inFrame = false;
}

function showError(err) {
  const el = document.getElementById('boot-error');
  el.hidden = false; el.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
  console.error(err);
}

// ---------------------------------------------------------------------------------------------------------------
// boot
initInput((e) => {
  if (screens.cur) {
    const m = { up: e.code === 'ArrowUp', down: e.code === 'ArrowDown', left: e.code === 'ArrowLeft', right: e.code === 'ArrowRight', cancel: e.code === 'Escape' };
    if (document.activeElement && document.activeElement.tagName === 'INPUT' && (m.left || m.right)) return false;
    if (m.up || m.down || m.left || m.right || m.cancel) { screens.nav(m); return true; }
    return false;
  }
  // pause at once on the key, not on the next frame (the panel is up before the key is released)
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat && App.scene === 'play' && App.run && App.run.phase === 'play') { pauseGame(); return true; }
  return false;
});
initTouch(canvas, () => (App.run ? renderer.playerScreen(App.run) : null));
initAudio(App.save.settings);
window.addEventListener('resize', kick);
window.addEventListener('blur', () => { if (!window.__TEST__) pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); else kick(); });

applySettings();
installHooks(App, { stepOnce, startLevel, startEndless, showTitle, pauseGame, resumeGame, levelDone, levelById, persist, applySettings, audioState });
App.loading++;
loadArt(typeof MANIFEST !== 'undefined' ? MANIFEST : null, App).then((art) => { renderer.art = art; }).finally(() => { App.loading--; kick(); });
showTitle();
App.ready = true;
