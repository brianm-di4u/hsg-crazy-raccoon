// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Adapted from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
const KEY = 'hsg-crazy-raccoon-v1';
let mem = null;
let persisted = null;
let pendingReset = false;

export const DEFAULT_SAVE = () => ({
  v: 1,
  settings: { sound: true, music: true, volume: 0.5, reducedMotion: null, textScale: 1, assist: false, hints: true },
  progress: {}, // levelId → { stars: [b, b, b], best, bestT, ball }
  unlocked: 1, // highest playable level number
  notebook: [], // fact ids seen
  merman: false,
  endless: { unlocked: false, top: [] }, // top: [{ initials, score, rows, date }]
  stats: { hops: 0, chomps: 0, splashes: 0, treats: 0, runs: 0 },
});


const copy = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const own = (o, k) => o && Object.hasOwn(o, k) ? o[k] : undefined;
const setOwn = (o, k, value) => Object.defineProperty(o, k, { value, writable: true, enumerable: true, configurable: true });
function decoded(raw) {
  if (!raw) return null;
  const s = JSON.parse(raw);
  if (!s || s.v !== 1) return null;
  const d = DEFAULT_SAVE();
  return { ...d, ...s, settings: { ...d.settings, ...s.settings }, endless: { ...d.endless, ...s.endless }, stats: { ...d.stats, ...s.stats } };
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
  if (route === 'unlocked' && Number.isFinite(local)) return Math.max(Number.isFinite(latest) ? latest : 1, local);
  if (/^progress\.[^.]+\.stars$/.test(route) && Array.isArray(local))
    return local.map((v, i) => Boolean(v || latest?.[i]));
  if ((/^progress\.[^.]+\.ball$/.test(route) || route === 'merman' || route === 'endless.unlocked') && typeof local === 'boolean')
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
  let loaded;
  try { loaded = decoded(window.localStorage.getItem(KEY)); } catch (e) { /* unavailable or malformed */ }
  if (loaded) { persisted = copy(loaded); return loaded; }
  return mem ? copy(mem) : DEFAULT_SAVE();
}

export function writeSave(s, { reset = false } = {}) {
  const local = copy(s);
  if (reset) pendingReset = true;
  mem = copy(local);
  try {
    let latest;
    const raw = window.localStorage.getItem(KEY); // A failed read cannot safely overwrite another tab's data.
    try { latest = decoded(raw); } catch (e) { /* recover a malformed owned-key value */ }
    latest = latest || copy(persisted) || DEFAULT_SAVE();
    const merged = pendingReset ? local : delta(persisted || DEFAULT_SAVE(), local, latest);
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    // Rebase both the live object and snapshot only after persistence succeeds. A failed quota write leaves
    // the original local delta pending, rather than counting remote stats again on the next attempt.
    for (const k of Object.keys(s)) if (!Object.hasOwn(merged, k)) delete s[k];
    for (const k of Object.keys(merged)) setOwn(s, k, merged[k]);
    persisted = copy(merged); mem = copy(merged); pendingReset = false;
    return true;
  } catch (e) { return false; }
}
