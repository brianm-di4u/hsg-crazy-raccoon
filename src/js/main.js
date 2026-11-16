// Crazy Raccoon: app shell. Owns the Run, the renderer, HUD, screens, input, audio, saves and the frame loop.
// The rules live in sim/ (no DOM); this file only drives them. Fixed-step loop with render on demand adapted from
// games/Furious Squirrels/src/js/main.js (Hot Springs Games, MIT).
import { DT } from './sim/const.js';
import { Run } from './sim/run.js';
import { warnings, liveSurges } from './sim/world.js';
import { Bot } from './sim/bot.js';
import { Renderer } from './gfx/renderer.js';
import { loadArt } from './gfx/art.js';
import { Hud } from './ui/hud.js';
import { Screens, esc } from './ui/screens.js';
import { dateKey, dailySeed, dayLabel, award, backfill, ACHIEVEMENTS, costumeUnlocked, activeCostume, nextUnlock, recordDaily } from './progress.js';
import { initInput, initTouch, pollGamepads, readIntent, consumePause, consumeMenu, setEnabled, holdHop } from './ui/input.js';
import { initAudio, setAudio, sfx, playTheme, setTension, setAmbience, duckMusic, audioState, audioList, renderAudio, holdMusic, suspendAudio, resumeAudio } from './ui/audio.js';
import { loadSave, writeSave, DEFAULT_SAVE, storageBlocked, saveIsNewer } from './save.js';
import { makeRng, hashStr } from './rng.js';
import { installHooks } from './hooks.js';

/* global LEVELDATA, FACTS, MANIFEST */
const LEVELS = typeof LEVELDATA !== 'undefined' ? LEVELDATA.levels : [];
const ALLFACTS = typeof FACTS !== 'undefined' ? [...FACTS.bank, ...FACTS.research] : [];
const GRACE_T = 0.7; // after Go, Restart or Resume the world holds this long so a hand can find the keys (S1-07)
const HITSTOP_T = 0.07; // the freeze on a chomp, with the jaws shut on Bandit (S1-03)
const FAILS_FOR_ASSIST = 2; // failing the same level this many times in a row puts "Try with Assist" on the fail panel (S2-03)
const HINT_MIN_T = 2.5; // the level 1 hint stays at least this long, even if the first hop comes at once (S2-19)
const STORAGE_NOTE = 'Progress will not be saved in this browser mode.';
const NEWER_NOTE = 'This visit is not being saved, because your save comes from a newer version of the game.';
const THEME_MUSIC = { day: 'day', noon: 'noon', barn: 'barn', night: 'night' };
// the ambience scene for each level theme (the music has the theme's own name)
const THEME_SCENE = { day: 'meadow', noon: 'showground', barn: 'loft', night: 'midnight' };

const App = {
  scene: 'boot', ready: false, loading: 0, paused: false, testPaused: false, time: 0, clock: null, steps: 0,
  save: loadSave(), earned: [], today: () => App.dayOverride || dateKey(), run: null, level: null, nextSeed: null, reduced: false, demo: null, endAt: 0, fact: null, LEVELS, FACTS: ALLFACTS, lastSaid: '', grace: 0, stop: 0,
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
// haptics (S3-13): short pulses on a landing, a bite or splash, a bank and a win, where the browser has navigator.vibrate.
// Off with the Vibration setting and whenever motion is reduced. Never part of the Sound switch.
const PULSE = { land: 10, hurt: 25, bank: [15, 30, 15], win: [20, 40, 20, 40, 25] };
function buzz(kind) {
  if (!App.save.settings.vibration || App.reduced || !navigator.vibrate) return;
  try { navigator.vibrate(PULSE[kind]); } catch (e) { /* a browser that refuses it: no pulse */ }
}
// what Bandit lands on, for the landing sound (S5-04)
const SURFACE = { start: 'grass', grass: 'grass', goal: 'grass', boardwalk: 'wood', fence: 'wood', sand: 'sand', path: 'path', straw: 'straw' };
function surfaceOf(run, e) {
  if (e.ride) return 'back';
  if (e.pool) return 'wet';
  const row = run.L.rows && run.L.rows[e.row];
  return (row && SURFACE[row.t]) || 'grass';
}

// ---------------------------------------------------------------------------------------------------------------
function applySettings() {
  const s = App.save.settings;
  document.documentElement.style.setProperty('--text-scale', s.textScale || 1);
  const sys = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  App.reduced = s.reducedMotion == null ? sys : !!s.reducedMotion;
  renderer.reduced = App.reduced;
  renderer.setView(s.view);
  document.body.classList.toggle('lure-left', s.lureSide === 'left');
  renderer.costume = activeCostume(App.save);
  renderer.fx.scale = App.reduced ? 0.4 : 1;
  document.body.classList.toggle('reduced', App.reduced);
  setAudio(s);
}
App.storageBlocked = storageBlocked;
App.saveIsNewer = saveIsNewer;
App.newerNote = NEWER_NOTE; // shown on the title until the player moves on, and said once to a screen reader (C4-01)
let storageWarned = false;
function persist(options) {
  writeSave(App.save, options); applySettings();
  if (storageBlocked() && !storageWarned) { storageWarned = true; App.say(STORAGE_NOTE); }
}

// ---------------------------------------------------------------------------------------------------------------
// achievements (S3-05): earned by play the game sees; a short toast that never stops the game, with its cue
const toastEl = document.getElementById('toast'), toastQ = [];
let toastBusy = false;
function toastNext() {
  const a = toastQ.shift();
  if (!a) { toastBusy = false; return; }
  toastBusy = true;
  toastEl.innerHTML = `<b>Achievement: ${esc(a.name)}</b><span>${esc(a.how)}</span>`; toastEl.classList.add('on');
  setTimeout(() => { toastEl.classList.remove('on'); setTimeout(toastNext, 300); }, 3000);
}
function earn(id) {
  if (!award(App.save, id, App.today())) return false;
  App.earned.push(id); persist();
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  sfx('ach'); toastQ.push(a); if (!toastBusy) toastNext();
  App.say(`Achievement: ${a.name}. ${a.how}`);
  return true;
}
// anything the save itself proves (stars, balls, chomps, rows); an old save is granted these quietly at load
function checkDerived() { for (const a of ACHIEVEMENTS) if (a.have && !App.save.ach[a.id] && a.have(App.save)) earn(a.id); }
if (backfill(App.save, 'before').length) writeSave(App.save);

// first-run tips (S2-01): in the first two levels, one short line at the moment it matters. Shown once, saved with
// the settings; a save from before the tips never shows them unless asked (Settings > Show tips again).
const TIPS = { goal: 'Reach the den at the top. Bank snacks on bright rows.', carry: 'Bank snacks at the bright row. Paws hold three.', bank: 'Hop onto the bright BANK row to bank them.' };
let tipId = null, tipUntil = 0, hintOff = 0;
const tipsLive = () => App.save.settings.tipsOn && !!App.level && App.level.n >= 1 && App.level.n <= 2;
function endTip() { tipId = null; hud.tip(''); }
function showTip(id) {
  const st = App.save.settings;
  if (!tipsLive() || st.tipsDone[id] || tipId === id || !App.run) return;
  st.tipsDone[id] = true; persist();
  tipId = id; tipUntil = App.run.steps + Math.round(7 / DT);
  hud.tip(TIPS[id]); App.say(TIPS[id]);
}
function feelTips(run) {
  if (!tipsLive()) return;
  const done = App.save.settings.tipsDone;
  if (tipId && run.steps > tipUntil) endTip();
  if (run.phase !== 'play') return;
  if (run.L.n === 1 && run.hops >= 1 && !done.goal) showTip('goal');
  if (!run.carried().length) return;
  if (!done.carry) showTip('carry');
  const r = run.L.rows.findIndex((row, i) => i > run.p.row && (row.check || row.t === 'goal'));
  if (!done.bank && r >= 0 && r - run.p.row <= 3) showTip('bank');
}

// ---------------------------------------------------------------------------------------------------------------
// runs
function levelById(id) { return LEVELS.find((L) => L.id === id || L.n === +id) || null; }
function pickFact(L) {
  // a fact for the intro card: one tagged for this level (data/facts.json "levels") when there is one, else rotate through
  // the bank by level and zone topic (S4-06)
  if (!ALLFACTS.length) return null;
  const tagged = ALLFACTS.filter((f) => f.levels && f.levels.includes(L.id));
  if (tagged.length) return tagged.find((f) => !App.save.notebook.includes(f.id)) || tagged[0];
  const topic = { 1: 'farm', 2: 'gator', 3: 'farm', 4: 'farm', 5: 'raccoon' }[L.zone] || 'gator';
  const pool = ALLFACTS.filter((f) => f.topic === topic || f.topic === 'gator');
  return pool[hashStr(String(L.id)) % pool.length];
}

function startLevel(L, { seed, intro = true, grace = false } = {}) {
  App.level = L;
  App.run = new Run(JSON.parse(JSON.stringify(L)), { seed: seed ?? App.nextSeed ?? hashStr(L.id), assist: App.save.settings.assist });
  enterPlay();
  App.fact = pickFact(L); App.factSeen = intro;
  if (intro) { App.paused = false; screens.show('intro', { L: App.run.L, fact: App.fact, assist: App.save.settings.assist }); setEnabled(false); }
  else beginPlay(grace);
  return App.run;
}
function startEndless({ seed, intro = true, daily = null, grace = false } = {}) {
  App.level = null;
  App.run = new Run({ id: 'endless' }, { mode: 'endless', seed: seed ?? (daily ? dailySeed(daily) : null) ?? App.nextSeed ?? (Date.now() & 0xffffff), assist: false });
  App.run.daily = daily; // Assist is for the levels: the top-10 board is shared
  enterPlay();
  App.fact = ALLFACTS.length ? ALLFACTS[(Date.now() >> 10) % ALLFACTS.length] : null;
  if (intro) { screens.show('intro', { L: { ...App.run.L, intro: daily ? `Daily Run, ${dayLabel(daily)}. Every player gets this same night today. Hop as far as you can. Three tail rings.` : 'Night falls. Hop as far as you can before the keeper\'s lantern catches up. Snacks you carry are banked on bright rows. Three tail rings.', rings: 3 }, fact: App.fact, assist: false }); setEnabled(false); }
  else beginPlay(grace);
  return App.run;
}
function enterPlay() {
  App.demo = null; App.scene = 'play'; document.body.dataset.scene = 'play';
  App.earned = []; App.grace = 0; App.stop = 0; endTip();
  App.paused = false; App.endAt = 0;
  renderer.fx.clear(); renderer.snap(0, App.run.p.x);
  hud.show(true); hud.update(App.run);
  playTheme(THEME_MUSIC[App.run.L.theme] || 'day', THEME_SCENE[App.run.L.theme] || 'meadow');
  kick();
}
function beginPlay(grace = true) {
  screens.hide(); setEnabled(true); App.paused = false; App.grace = grace ? GRACE_T : 0; renderer.arrive = App.reduced ? 0 : 1;
  const L = App.run.L;
  App.say(L.n ? `Level ${L.n}, ${L.name}. Reach the den.` : 'Moonlight Run. Go!');
  const hint = App.save.settings.hints && L.n === 1 ? (matchMedia('(pointer: coarse)').matches ? 'Tap beside Bandit to hop' : 'Arrow keys or WASD to hop') : '';
  hud.hint(hint); hintOff = hint ? App.run.steps + Math.round(HINT_MIN_T / DT) : 0;
  kick();
}

function showTitle() {
  App.run = null; App.level = null; App.scene = 'title'; document.body.dataset.scene = 'title';
  hud.show(false); setEnabled(false);
  // attract mode: a bot crosses level 1 behind the title (ambient: isIdle ignores it)
  const L = LEVELS[0];
  if (L) { App.demo = new Run(JSON.parse(JSON.stringify(L)), { seed: 3 }); App.demoBot = new Bot(App.demo, makeRng(11), 'good'); renderer.snap(0); }
  screens.show('title');
  playTheme('title', 'meadow');
  kick();
}

function pauseGame() {
  if (App.scene !== 'play' || screens.cur || !App.run || App.run.phase !== 'play') return;
  App.paused = true; setEnabled(false); screens.show('pause'); holdMusic(); kick();
}
function resumeGame() { screens.hide(); App.paused = false; setEnabled(true); App.grace = GRACE_T; resumeAudio(); kick(); }

// results
function levelDone(run) {
  const L = App.level, s = App.save, res = run.result;
  if (!res) return;
  s.stats.runs++;
  if (run.mode === 'endless') {
    const rows = Math.max(0, run.maxRow);
    const entry = { score: res.score, rows };
    const top = s.endless.top, rank = !run.daily && (top.length < 10 || res.score > top[top.length - 1].score) ? top.filter((e) => e.score >= res.score).length : -1; // the Daily Run has its own record, not the shared top ten
    const had = s.endless.bestRows > 0 || s.endless.bestScore > 0, newBest = had && (rows > s.endless.bestRows || res.score > s.endless.bestScore);
    s.endless.bestRows = Math.max(s.endless.bestRows, rows); s.endless.bestScore = Math.max(s.endless.bestScore, res.score);
    let daily = null;
    if (run.daily) { daily = recordDaily(s.endless.daily, run.daily, rows, res.score); s.stats.dailies++; }
    persist();
    if (daily) { earn('daily1'); if (daily.streak >= 7) earn('daily7'); }
    checkDerived();
    screens.show('over', { res: { ...res, rows }, rank, entry, newBest, daily, earned: App.earned.slice(), cause: run.p.cause });
    App.pendingScore = rank >= 0 ? entry : null;
    setEnabled(false); sfx(newBest ? 'best' : 'fail');
    return;
  }
  if (!res.win) {
    // a second failure in a row on one level offers Assist (S2-03); a win or another level starts the count again
    App.fails = App.fails && App.fails.id === L.id ? { id: L.id, n: App.fails.n + 1 } : { id: L.id, n: 1 };
    screens.show('fail', { L, cause: run.p.cause, offerAssist: App.fails.n >= FAILS_FOR_ASSIST && !s.settings.assist });
    setEnabled(false); sfx('fail'); persist(); return; }
  App.fails = null;
  const pr = s.progress[L.id] || { stars: [false, false, false], best: 0, bestT: null, ball: false };
  const best = res.score > pr.best, bestTime = pr.bestT != null && res.t < pr.bestT;
  pr.stars = pr.stars.map((b, i) => b || res.stars[i]); pr.best = Math.max(pr.best, res.score);
  pr.bestT = pr.bestT == null ? res.t : Math.min(pr.bestT, res.t); pr.ball = pr.ball || res.ball;
  s.progress[L.id] = pr;
  s.unlocked = Math.max(s.unlocked, Math.min(LEVELS.length, L.n + 1));
  if (L.n >= 6) s.endless.unlocked = true;
  if (res.ticket) s.merman = true;
  // collect a fact card: the intro fact if new, else the first unseen one. A card the intro just showed is not shown again on
  // the win panel (S4-06): the panel only says it went into the Notebook.
  let f = App.fact && !s.notebook.includes(App.fact.id) ? App.fact : ALLFACTS.find((x) => !s.notebook.includes(x.id));
  const again = !!(f && f === App.fact && App.factSeen);
  if (f) s.notebook.push(f.id);
  s.stats.treats += run.treatsBanked();
  persist();
  if (res.deaths === 0) earn('clean');
  checkDerived();
  const next = LEVELS.find((x) => x.n === L.n + 1);
  setEnabled(false);
  playTheme('results');
  if (!next) {
    // the ending (S4-02): its own panel and a longer stinger; Old Ruthless's defeat line shows the first time only
    const first = !s.finale; s.finale = true; persist();
    screens.show('finale', { L, res, first });
    duckMusic(8, 4600); sfx('finale');
    return;
  }
  screens.show('win', { L, res, fact: again ? null : f, noted: again, next: true, best, bestTime, assist: App.save.settings.assist, earned: App.earned.slice(), nextUp: nextUnlock(s) });
  duckMusic(8, 1600);
  sfx('win'); res.stars.forEach((b, i) => { if (b) setTimeout(() => sfx(i === 2 ? 'par' : 'star', i), 500 + i * 220); });
  // after the stars: a new best, then the fact card that went into the Notebook
  if (best || bestTime) setTimeout(() => sfx('best'), 1350);
  if (f) setTimeout(() => sfx('fact'), best || bestTime ? 1900 : 1350);
}

// ---------------------------------------------------------------------------------------------------------------
// menus and HUD
App.onHud = (a) => {
  if (a === 'pause') pauseGame();
  else if (a === 'skipTips') { App.save.settings.tipsOn = false; persist(); endTip(); App.say('Tips are off. Turn them on again in Settings.'); }
  else if (a === 'tipDone') endTip();
  else if (a === 'lure' && App.run && App.scene === 'play' && !App.paused && !screens.cur) { App.lureReq = true; kick(); }
};

// a top-ten score is kept the moment the player leaves the Over panel any other way (S6-07): under the initials typed
// so far, else the last ones used, else BAN
function commitScore() {
  if (!App.pendingScore) return null;
  const s = App.save, inp = document.getElementById('ini');
  const ini = ((inp && inp.value) || s.lastInitials || 'BAN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'BAN';
  const e = { initials: ini, score: App.pendingScore.score, rows: App.pendingScore.rows, date: new Date().toISOString().slice(0, 10) };
  s.endless.top.push(e); s.endless.top.sort((a, b) => b.score - a.score); s.endless.top.length = Math.min(10, s.endless.top.length);
  s.lastInitials = ini; App.pendingScore = null; persist();
  return ini;
}

// a refused press sounds refused (S5-10); going back is lower than going on; a settings click waits until the setting is applied
const BACK_ACTS = new Set(['back', 'resume', 'title', 'quitYes', 'map']);
App.onMenu = (act, d = {}) => {
  const s = App.save;
  App.newerSeen = true;
  if (act === 'locked' || ((act === 'endless' || act === 'daily') && !s.endless.unlocked)) sfx('denied');
  else if (act !== 'set') sfx(BACK_ACTS.has(act) ? 'back' : 'menu');
  if (App.pendingScore && screens.cur === 'over' && act !== 'saveScore') App.say('Score saved as ' + commitScore() + '.');
  switch (act) {
    case 'play': playTheme('map', 'meadow'); return screens.show('map', { levels: LEVELS });
    case 'level': { const L = levelById(d.v); if (L) startLevel(L); return; }
    case 'locked': return;
    case 'go': return beginPlay();
    case 'endless': if (!s.endless.unlocked) { App.say('Clear level 6 to unlock the Moonlight Run.'); return; } return startEndless();
    case 'daily': if (!s.endless.unlocked) { App.say('Clear level 6 to unlock the Daily Run.'); return; } return startEndless({ daily: App.today() });
    case 'records': return screens.show('records', { from: screens.cur === 'trophies' ? 'title' : screens.cur });
    case 'trophies': return screens.show('trophies', { from: 'records' });
    case 'costume': if (costumeUnlocked(s, d.v)) { s.settings.costume = d.v; persist(); screens.refresh(); } return;
    case 'tipsAgain': s.settings.tipsOn = true; s.settings.tipsDone = {}; persist(); App.say('First-run tips are on again.'); return screens.refresh();
    case 'help': return screens.show('help', { from: screens.cur });
    case 'settings': return screens.show('settings', { from: screens.cur });
    case 'notebook': return screens.show('notebook', { facts: ALLFACTS });
    case 'credits': return screens.show('credits');
    case 'scores': return screens.show('scores', { from: screens.cur });
    case 'title': return showTitle();
    case 'set': {
      const v = d.k === 'view' || d.k === 'lureSide' ? d.v : d.v === 'true' ? true : d.v === 'false' ? false : d.v === 'null' ? null : +d.v;
      s.settings[d.k] = v; persist(); sfx('menu'); return screens.refresh();
    }
    case 'resetSave': return screens.show('confirmReset', { from: 'settings' });
    case 'resetYes': App.save = DEFAULT_SAVE(); persist({ reset: true }); return showTitle();
    case 'resume': return resumeGame();
    case 'assistOn': s.settings.assist = true; persist(); App.say('Assist is on. Slower gators, longer warnings, two more tail rings.'); if (App.level) startLevel(App.level, { intro: false, grace: true }); return;
    case 'restart': if (App.run && App.run.mode === 'endless') return startEndless({ intro: false, grace: true, daily: App.run.daily ? App.today() : null }); if (App.level) return startLevel(App.level, { intro: false, grace: true }); return;
    case 'next': { const L = LEVELS.find((x) => x.n === App.level.n + 1); if (L) startLevel(L); return; }
    case 'map': App.scene = 'title'; App.run = null; hud.show(false); showTitle(); playTheme('map', 'meadow'); return screens.show('map', { levels: LEVELS });
    case 'quit': return App.run && App.run.mode === 'endless' ? screens.show('confirmQuit', { from: 'pause' }) : App.onMenu('map');
    case 'quitYes': return showTitle();
    case 'saveScore': commitScore(); return screens.show('scores');
    case 'back': {
      const from = screens.data.from;
      if (screens.cur === 'pause') return resumeGame();
      if (from === 'pause') return screens.show('pause');
      if (from === 'settings') return screens.show('settings');
      if (from === 'records') return screens.show('records', { from: 'title' });
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
  cueHazards(run);
  feelTension(run);
  feelTips(run);
  if (hintOff && run.hops >= 1 && run.steps >= hintOff) { hintOff = 0; hud.hint(''); }
}
App.stepOnce = stepOnce;

// the hazard telegraph is heard as well as seen: a jaw warning ('tele') the step a gator near Bandit starts one,
// and the feeding-show cue ('feed') the step a drumstick shadow appears. Tracked here, not in the sim.
const cued = new WeakMap();
function cueHazards(run) {
  let c = cued.get(run);
  if (!c) cued.set(run, c = { tele: new Set(), feed: new WeakSet() });
  const near = run.p.row;
  for (const g of run.world.gators) {
    if (g.jaw !== 'tele') { c.tele.delete(g.id); continue; }
    if (c.tele.has(g.id)) continue;
    c.tele.add(g.id);
    if (Math.abs(g.row - near) <= 4) { sfx('tele'); sfx(g.k === 'boss' ? 'roar' : 'hiss'); }
  }
  for (const w of warnings(run.world)) {
    if (w.src !== 'feed' || c.feed.has(w)) continue;
    c.feed.add(w);
    if (Math.abs(w.row - near) <= 6) sfx('feed');
  }
  // the crowd at the feeding show swells with a toss
  const crowd = liveSurges(run.world).length ? 1 : warnings(run.world).length ? 0.7 : 0.3;
  if (c.crowd !== crowd) { c.crowd = crowd; setAmbience('crowd', crowd); }
}

// How hunted Bandit is, 0 to 1, for the music and the ambience: the lantern a few rows behind (Moonlight Run), a
// flashlight beam within three rows, the boss within four, the last tail ring, the last third of the level. It
// rises over about half a second and eases off over two.
let tension = 0, tensionRun = null;
function tensionTarget(run) {
  const p = run.p;
  let x = 0;
  if (run.phase !== 'play' || p.state === 'dead') return 0;
  if (run.beam != null) { const gap = p.row - run.beam; x = gap <= 3 ? 1 : gap <= 8 ? 0.9 - (gap - 3) * 0.14 : 0; }
  for (const b of run.L.beams || []) { const d = p.row < b.r0 ? b.r0 - p.row : p.row > b.r1 ? p.row - b.r1 : 0; if (d <= 3) x = Math.max(x, 1 - d * 0.12); }
  for (const g of run.world.gators) if (g.k === 'boss' && Math.abs(g.row - p.row) <= 4) x = Math.max(x, 1);
  if (run.rings === 1) x = Math.max(x, 0.6);
  if (run.L.n && p.row >= run.N * 0.67) x = Math.max(x, 0.35);
  return x;
}
function feelTension(run) {
  if (tensionRun !== run) { tensionRun = run; tension = 0; }
  const to = tensionTarget(run);
  tension += (to - tension) * (to > tension ? 0.02 : 0.005);
  if (run.steps % 12 === 0 || to === 0) setTension(tension < 0.03 ? 0 : tension);
}

function handleEvents(run) {
  for (const e of run.drain()) {
    renderer.onEvent(e, run);
    switch (e.k) {
      case 'hop': sfx('hop', run.hops, run.mult); App.save.stats.hops++; break;
      case 'land': sfx('land', surfaceOf(run, e)); buzz('land'); break;
      case 'bump': sfx('bump'); break;
      case 'knock': sfx('bump'); break;
      case 'nudge': sfx('nudge'); break;
      case 'die':
        sfx({ chomp: 'chomp', spotted: 'spotted', swept: 'sweep', caught: 'hum' }[e.cause] || 'splash'); buzz('hurt');
        if (e.cause === 'chomp') { App.save.stats.chomps++; App.stop = HITSTOP_T; checkDerived(); } if (e.cause === 'splash') App.save.stats.splashes++;
        App.say({ chomp: 'Chomped!', splash: 'Splash!', swept: 'Swept away!', spotted: 'Spotted!', caught: 'Caught by the lantern!' }[e.cause] + ` ${run.rings} tail rings left.`);
        break;
      case 'pickup': if (e.item === 'pecan' || e.item === 'berry') hud.pulse(); sfx(e.item === 'cap' ? 'cap' : e.item === 'ball' ? 'ball' : 'pickup'); if (e.item === 'ball') App.say('You found the lost home-run ball!'); if (e.item === 'ring') App.say(`A tail ring! ${run.rings} tail rings left.`); break;
      case 'wash': sfx('wash'); earn('squeaky'); break;
      case 'bank': sfx('bank'); sfx('chitter'); buzz('bank'); App.say(`${e.n} snack${e.n > 1 ? 's' : ''} banked.`); earn('snack'); if (tipId) { Object.assign(App.save.settings.tipsDone, { carry: true, bank: true }); persist(); endTip(); } break;
      case 'lure': sfx('lure'); earn('lure'); break;
      case 'streak': sfx('streak', e.mult); if (e.mult >= 4) earn('streak4'); break;
      case 'whipWind': sfx('whip'); break;
      case 'fling': sfx('whip'); break;
      case 'full': hud.hint('Paws full!'); setTimeout(() => hud.hint(''), 900); break;
      case 'win': App.say('Home free!'); buzz('win'); break;
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
    let busy = false, alpha = 0; // alpha: how far between two steps this frame falls, for the renderer (S1-12)
    const run = App.run;
    if (run && App.scene === 'play') {
      if (!App.paused && !App.testPaused && !screens.cur && run.phase === 'play') {
        let n = 0;
        if (App.grace > 0 || App.stop > 0) { App.grace = Math.max(0, App.grace - dtw); App.stop = Math.max(0, App.stop - dtw); acc = 0; } else acc += dtw;
        while (acc >= DT && n < 12 && App.stop <= 0) {
          const intent = n === 0 ? readIntent() : { hop: null, lure: false };
          if (n === 0 && !intent.hop && App.save.settings.holdHop) intent.hop = holdHop(run); // a held direction keeps hopping (S1-09, off by default)
          if (App.lureReq) { intent.lure = true; App.lureReq = false; }
          stepOnce(intent); acc -= DT; n++;
        }
        busy = true;
        alpha = Math.min(1, acc / DT);
      } else acc = 0;
      if (run.phase !== 'play' && App.endAt && App.time >= App.endAt && !screens.cur) { App.endAt = 0; levelDone(run); }
      else if (run.phase !== 'play' && App.endAt) busy = true;
      if (renderer.update(dtw, run)) busy = true;
      renderer.grace = App.grace / GRACE_T;
      renderer.draw(run, { time: App.time, alpha });
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

// Any exception ends up here: the detail goes to the console, the player gets a way out (reload, or back to a live title).
function showError(err) {
  console.error(err);
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.textContent = 'Something went wrong with the game. ';
  const add = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', fn); el.append(b, ' '); };
  add('Reload', () => location.reload());
  add('Back to title', () => {
    try {
      cancelAnimationFrame(rafId); rafId = 0; inFrame = false; acc = 0;
      screens.hide(); App.paused = false; App.endAt = 0; App.lureReq = false;
      showTitle();
      el.hidden = true;
    } catch (e2) { console.error(e2); }
  });
  el.hidden = false;
}
window.addEventListener('error', (e) => { if (e.error) showError(e.error); });
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

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
window.addEventListener('pagehide', () => { if (screens.cur === 'over') commitScore(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); suspendAudio(); } else { resumeAudio(App.paused); kick(); }
});

applySettings();
installHooks(App, { stepOnce, startLevel, startEndless, showTitle, pauseGame, resumeGame, levelDone, levelById, persist, applySettings, audioState, audioList, audioRender: renderAudio });
App.loading++;
loadArt(typeof MANIFEST !== 'undefined' ? MANIFEST : null, App).then((art) => { renderer.art = art; }).finally(() => { App.loading--; kick(); });
showTitle();
if (saveIsNewer()) App.say(NEWER_NOTE);
App.ready = true;
