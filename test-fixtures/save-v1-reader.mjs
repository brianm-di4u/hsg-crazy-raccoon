// Saves: one versioned JSON object in localStorage, wrapped in try/catch with an in-memory fallback so the game
// works when storage is blocked. Adapted from games/Cart Racing/src/js/save.js (Hot Springs Games, MIT).
const KEY = 'hsg-crazy-raccoon-v1';
let mem = null;

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

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === 1) {
        const d = DEFAULT_SAVE();
        return { ...d, ...s, settings: { ...d.settings, ...s.settings }, endless: { ...d.endless, ...s.endless }, stats: { ...d.stats, ...s.stats } };
      }
    }
  } catch (e) { /* storage unavailable */ }
  return mem ? JSON.parse(JSON.stringify(mem)) : DEFAULT_SAVE();
}

export function writeSave(s) {
  mem = JSON.parse(JSON.stringify(s));
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
}
