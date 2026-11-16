// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Adapted from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
import { COSTUME_IDS, DAILY_KEEP, emptyDaily, validDay } from './progress.js';

const KEY = 'hsg-crazy-raccoon-v1';
let mem = null;
let persisted = null;
let pendingReset = false;
let blocked = false; // the browser would not let us read or write storage (a private window, site data blocked): progress lives in memory only
// true when this session's progress cannot be kept (S3-21)
export const storageBlocked = () => blocked;
// true when the stored save was written by a newer version of the game (its version number is higher than this build's).
// Such a save is never written over: this visit plays from defaults in memory (C4-01).
let newer = false;
export const saveIsNewer = () => newer;
const newerRaw = (raw) => { try { const s = raw ? JSON.parse(raw) : null; return !!s && typeof s.v === 'number' && s.v > DEFAULT_SAVE().v; } catch (e) { return false; } };

export const DEFAULT_SAVE = () => ({
  v: 1,
  settings: { sound: true, music: true, ambience: true, volume: 0.5, vibration: true, reducedMotion: null, textScale: 1, assist: false, hints: true, view: 'standard', lureSide: 'right', costume: 'plain', tipsOn: true, tipsDone: {} },
  progress: {}, // levelId → { stars: [b, b, b], best, bestT, ball }
  unlocked: 1, // highest playable level number
  notebook: [], // fact ids seen
  merman: false,
  endless: { unlocked: false, top: [], bestRows: 0, bestScore: 0, daily: emptyDaily() }, // top: [{ initials, score, rows, date }]
  ach: {}, // achievement id → the date it was earned ('before' when an old save already proved it)
  finale: false, // the level 15 ending has been seen (its one-time defeat line is not repeated)
  stats: { hops: 0, chomps: 0, splashes: 0, treats: 0, runs: 0, dailies: 0 },
});


const copy = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const own = (o, k) => o && Object.hasOwn(o, k) ? o[k] : undefined;
const setOwn = (o, k, value) => Object.defineProperty(o, k, { value, writable: true, enumerable: true, configurable: true });
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
// Wrong-typed fields (hand edits, an older build's shape) are repaired on load so one bad value cannot break a
// level clear or the scores screen and then be written back for good.
function sanitize(d) {
  d.settings.ambience = d.settings.ambience !== false; // saves from before the Ambience setting have none: on
  d.settings.vibration = d.settings.vibration !== false; // likewise for Vibration (S3-13)
  d.settings.volume = Math.min(1, Math.max(0, num(d.settings.volume, 0.5)));
  if (!['left', 'right'].includes(d.settings.lureSide)) d.settings.lureSide = 'right'; // Lure button side (S2-23)
  if (!['close', 'standard', 'wide'].includes(d.settings.view)) d.settings.view = 'standard'; // phone view: saves from before have none
  if (![1, 1.25, 1.5, 1.75].includes(d.settings.textScale)) d.settings.textScale = 1;
  if (!COSTUME_IDS.includes(d.settings.costume)) d.settings.costume = 'plain';
  d.settings.tipsDone = object(d.settings.tipsDone) ? Object.fromEntries(Object.entries(d.settings.tipsDone).filter(([, v]) => v === true)) : {};
  d.ach = object(d.ach) ? Object.fromEntries(Object.entries(d.ach).filter(([, v]) => typeof v === 'string')) : {};
  d.finale = d.finale === true;
  if (!object(d.progress)) d.progress = {};
  for (const id of Object.keys(d.progress)) {
    const e = d.progress[id];
    if (!object(e)) { delete d.progress[id]; continue; }
    const st = Array.isArray(e.stars) ? e.stars : [];
    e.stars = [0, 1, 2].map((i) => st[i] === true);
    e.best = Math.max(0, num(e.best, 0));
    e.bestT = num(e.bestT, null);
    e.ball = e.ball === true;
  }
  d.unlocked = Math.min(15, Math.max(1, Math.trunc(num(d.unlocked, 1))));
  d.notebook = Array.isArray(d.notebook) ? d.notebook.filter((x) => typeof x === 'string') : [];
  d.endless.unlocked = d.endless.unlocked === true;
  d.endless.top = (Array.isArray(d.endless.top) ? d.endless.top : [])
    .filter((e) => object(e) && Number.isFinite(e.score) && typeof e.initials === 'string')
    .map((e) => ({ ...e, rows: num(e.rows, 0), date: typeof e.date === 'string' ? e.date : '' }));
  const top = d.endless.top;
  d.endless.bestRows = Math.max(0, num(d.endless.bestRows, 0), ...top.map((e) => e.rows));
  d.endless.bestScore = Math.max(0, num(d.endless.bestScore, 0), ...top.map((e) => e.score));
  const dy = object(d.endless.daily) ? d.endless.daily : {}, hist = object(dy.hist) ? dy.hist : {};
  d.endless.daily = { last: validDay(dy.last) ? dy.last : '', streak: Math.max(0, Math.trunc(num(dy.streak, 0))), bestStreak: Math.max(0, Math.trunc(num(dy.bestStreak, 0))), hist: {} };
  for (const k of Object.keys(hist).filter((x) => validDay(x) && object(hist[x])).sort().slice(-DAILY_KEEP))
    d.endless.daily.hist[k] = { rows: Math.max(0, Math.trunc(num(hist[k].rows, 0))), score: Math.max(0, Math.trunc(num(hist[k].score, 0))), runs: Math.max(1, Math.trunc(num(hist[k].runs, 1))) };
  d.endless.daily.bestStreak = Math.max(d.endless.daily.bestStreak, d.endless.daily.streak);
  for (const k of Object.keys(d.stats)) d.stats[k] = Math.max(0, num(d.stats[k], 0));
  return d;
}
function decoded(raw) {
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (!s || s.v !== 1) return null;
  const d = DEFAULT_SAVE();
  // a save written before the tips existed belongs to a player who is not a newcomer: no first-run tips unless asked
  const set = { ...d.settings, ...(object(s.settings) ? s.settings : {}) };
  if (!object(s.settings) || typeof s.settings.tipsOn !== 'boolean') set.tipsOn = false;
  return sanitize({ ...d, ...s, settings: set, endless: { ...d.endless, ...(object(s.endless) ? s.endless : {}) }, stats: { ...d.stats, ...(object(s.stats) ? s.stats : {}) } });
}
// Apply only this tab's changes since its last successful load/write. Unchanged stale fields never replace
// newer stored data (including an explicit reset in another tab). This is a synchronous read/merge/write,
// not an atomic cross-tab transaction; an already-open old build still has its old writer.
function delta(base, local, latest, route = '') {
  if (equal(base, local)) return copy(latest);
  if (route === 'notebook' || route === 'endless.top') {
    // Multiset additions retain legitimate duplicate score entries without re-adding this tab's old list.
    const remaining = (Array.isArray(base) ? base : []).map((x) => JSON.stringify(x));
    const additions = (Array.isArray(local) ? local : []).filter((x) => {
      const i = remaining.indexOf(JSON.stringify(x));
      if (i < 0) return true;
      remaining.splice(i, 1); return false;
    });
    const joined = [...(Array.isArray(latest) ? copy(latest) : []), ...copy(additions)];
    return route === 'notebook' ? [...new Set(joined)] : joined.sort((a, b) => b.score - a.score).slice(0, 10);
  }
  if (route.startsWith('stats.') && Number.isFinite(local) && Number.isFinite(base))
    return (Number.isFinite(latest) ? latest : 0) + Math.max(0, local - base);
  if (/^progress\.[^.]+\.best$/.test(route) && Number.isFinite(local)) return Math.max(Number.isFinite(latest) ? latest : 0, local);
  if (/^progress\.[^.]+\.bestT$/.test(route) && Number.isFinite(local)) return Number.isFinite(latest) ? Math.min(latest, local) : local;
  if ((route === 'endless.bestRows' || route === 'endless.bestScore') && Number.isFinite(local)) return Math.max(Number.isFinite(latest) ? latest : 0, local);
  if (route === 'unlocked' && Number.isFinite(local)) return Math.max(Number.isFinite(latest) ? latest : 1, local);
  if (/^progress\.[^.]+\.stars$/.test(route) && Array.isArray(local))
    return local.map((v, i) => Boolean(v || latest?.[i]));
  if ((/^progress\.[^.]+\.ball$/.test(route) || route === 'merman' || route === 'finale' || route === 'endless.unlocked') && typeof local === 'boolean')
    return Boolean(local || latest);
  if (object(local)) {
    const result = object(latest) ? copy(latest) : {};
    for (const k of Object.keys(local)) {
      const value = delta(own(base, k), local[k], own(latest, k), route ? route + '.' + k : k);
      if (value === undefined) delete result[k];
      else setOwn(result, k, value);
    }
    for (const k of Object.keys(base || {})) if (!Object.hasOwn(local, k)) delete result[k];
    return result;
  }
  return copy(local);
}

export function loadSave() {
  let loaded, raw = null;
  try { raw = window.localStorage.getItem(KEY); } catch (e) { blocked = true; }
  newer = newerRaw(raw);
  try { loaded = decoded(raw); } catch (e) { /* malformed */ }
  try { window.localStorage.setItem(KEY + '-probe', '1'); window.localStorage.removeItem(KEY + '-probe'); } catch (e) { blocked = true; } // reading can work where writing will not
  if (loaded) { persisted = copy(loaded); return loaded; }
  return mem ? copy(mem) : DEFAULT_SAVE();
}

export function writeSave(s, { reset = false } = {}) {
  const local = copy(s);
  if (reset) pendingReset = true;
  mem = copy(local);
  if (newer) return false; // a newer version's save stays exactly as it is
  try {
    let latest;
    const raw = window.localStorage.getItem(KEY); // A failed read cannot safely overwrite another tab's data.
    if (newerRaw(raw)) { newer = true; return false; } // another tab, or a stale page, met a newer save since we loaded
    try { latest = decoded(raw); } catch (e) { /* recover a malformed owned-key value */ }
    latest = latest || copy(persisted) || DEFAULT_SAVE();
    const merged = pendingReset ? local : delta(persisted || DEFAULT_SAVE(), local, latest);
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    // Rebase both the live object and snapshot only after persistence succeeds. A failed quota write leaves
    // the original local delta pending, rather than counting remote stats again on the next attempt.
    for (const k of Object.keys(s)) if (!Object.hasOwn(merged, k)) delete s[k];
    for (const k of Object.keys(merged)) setOwn(s, k, merged[k]);
    persisted = copy(merged); mem = copy(merged); pendingReset = false; blocked = false;
    return true;
  } catch (e) { blocked = true; return false; }
}
