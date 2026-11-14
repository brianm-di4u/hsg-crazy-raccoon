// Meta-progression (S3-05): achievements, Bandit's costumes, the Daily Moonlight Run's date, seed and streak. Pure
// data and functions over the save object: no DOM, no storage. Everything here reads what the game already records.

export const DAILY_KEEP = 60; // days of daily history kept in the save; older days are pruned
const pad = (n) => String(n).padStart(2, '0');

// the local calendar date as 2026-11-13: every player gets the same day's run on the same date
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dailySeed = (key) => parseInt(String(key).replace(/-/g, ''), 10) >>> 0;
export const shiftDay = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dateKey(new Date(y, m - 1, d + n)); };
export const validDay = (key) => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
export const dayLabel = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };

export function totals(s) {
  const pr = Object.values(s.progress || {});
  return {
    cleared: pr.length,
    stars: pr.reduce((n, p) => n + p.stars.filter(Boolean).length, 0),
    balls: pr.filter((p) => p.ball).length,
    threeStar: pr.filter((p) => p.stars.every(Boolean)).length,
  };
}

// Achievements. `have` is set when the save alone proves it (those are also granted quietly to a player whose save
// already holds the proof); the others are earned in play, by an event the game sees. `how` is shown, locked or not.
export const ACHIEVEMENTS = [
  { id: 'snack', name: 'First Snack Home', how: 'Bank a snack at a bright row.' },
  { id: 'squeaky', name: 'Squeaky Clean', how: 'Dunk a snack in a spring stone.' },
  { id: 'lure', name: 'Dinner Bell', how: 'Toss a drumstick lure.' },
  { id: 'streak4', name: 'In the Groove', how: 'Hop your way up to a x4 multiplier.' },
  { id: 'den', name: 'Home Free', how: 'Reach the den on any level.', have: (s) => totals(s).cleared >= 1 },
  { id: 'ball1', name: 'Batter Up', how: 'Find a lost ball.', have: (s) => totals(s).balls >= 1 },
  { id: 'clean', name: 'Not a Scratch', how: 'Clear a level without losing a tail ring.' },
  { id: 'three', name: 'Three-Star Night', how: 'Earn all three stars on one level.', have: (s) => totals(s).threeStar >= 1 },
  { id: 'daily1', name: 'Daily Dash', how: 'Finish a Daily Moonlight Run.' },
  { id: 'run50', name: 'Night Hopper', how: 'Reach row 50 in the Moonlight Run.', have: (s) => s.endless.bestRows >= 50 },
  { id: 'chomp100', name: 'Thick Fur', how: 'Get chomped 100 times and keep hopping.', have: (s) => s.stats.chomps >= 100 },
  { id: 'stars25', name: 'Pocketful of Stars', how: 'Collect 25 stars.', have: (s) => totals(s).stars >= 25 },
  { id: 'boss', name: 'Old Ruthless Retires', how: 'Clear level 15.', have: (s) => !!(s.progress.l15) },
  { id: 'daily7', name: 'Seven Nights Running', how: 'Play the Daily Moonlight Run seven days in a row.' },
  { id: 'run150', name: 'Moonlight Marathon', how: 'Reach row 150 in the Moonlight Run.', have: (s) => s.endless.bestRows >= 150 },
  { id: 'ball15', name: 'Ball Collector', how: 'Find the lost ball on all 15 levels.', have: (s) => totals(s).balls >= 15 },
  { id: 'star45', name: 'Every Star', how: 'Collect all 45 stars.', have: (s) => totals(s).stars >= 45 },
];
export const achName = (id) => (ACHIEVEMENTS.find((a) => a.id === id) || { name: id }).name;

// Earn one: true the first time. The value is the date; quiet grants made from an old save read 'before'.
export function award(s, id, when) {
  if (!ACHIEVEMENTS.some((a) => a.id === id) || s.ach[id]) return false;
  s.ach[id] = when || 'before';
  return true;
}
// Everything the save already proves and has not been granted: returns the new ids (and grants them with `when`).
export function backfill(s, when) {
  const got = [];
  for (const a of ACHIEVEMENTS) if (a.have && a.have(s) && award(s, a.id, when)) got.push(a.id);
  return got;
}

// Bandit's costumes: shapes drawn in code over the painted sprite. New in this wave, so locked for everyone until
// earned; `need` says how far along the player is.
export const COSTUMES = [
  { id: 'plain', name: 'Plain Bandit', how: 'Bandit as he came.', ok: () => true, need: () => '' },
  { id: 'hardhat', name: 'Hard Hat', how: 'Collect 10 stars.', ok: (s) => totals(s).stars >= 10, need: (s) => `${Math.min(10, totals(s).stars)} of 10 stars` },
  { id: 'scarf', name: 'Slugger Scarf', how: 'Find 5 lost balls.', ok: (s) => totals(s).balls >= 5, need: (s) => `${Math.min(5, totals(s).balls)} of 5 balls` },
  { id: 'keeper', name: "Keeper's Cap", how: 'Collect 25 stars.', ok: (s) => totals(s).stars >= 25, need: (s) => `${Math.min(25, totals(s).stars)} of 25 stars` },
  { id: 'moon', name: 'Moonlight Glow', how: 'Reach row 50 in the Moonlight Run.', ok: (s) => s.endless.bestRows >= 50, need: (s) => `best row ${Math.min(50, s.endless.bestRows)} of 50` },
  { id: 'crown', name: 'Farm Champion Crown', how: 'Collect 40 stars.', ok: (s) => totals(s).stars >= 40, need: (s) => `${Math.min(40, totals(s).stars)} of 40 stars` },
];
export const COSTUME_IDS = COSTUMES.map((c) => c.id);
export const costumeUnlocked = (s, id) => { const c = COSTUMES.find((x) => x.id === id); return !!c && c.ok(s); };
// the costume to draw: the chosen one if it is unlocked, else the plain Bandit (a hand-edited save cannot break it)
export const activeCostume = (s) => (costumeUnlocked(s, s.settings.costume) ? s.settings.costume : 'plain');
// the nearest costume still locked, for the win panel: "Next: Hard Hat at 10 stars (3 to go)"
export function nextUnlock(s) {
  const t = totals(s);
  const goals = [['hardhat', t.stars, 10, 'stars'], ['scarf', t.balls, 5, 'balls'], ['keeper', t.stars, 25, 'stars'], ['crown', t.stars, 40, 'stars']]
    .filter(([id]) => !costumeUnlocked(s, id)).map(([id, have, need, unit]) => ({ id, left: need - have, need, unit }))
    .sort((a, b) => a.left - b.left);
  if (!goals.length) return '';
  const g = goals[0], c = COSTUMES.find((x) => x.id === g.id);
  return `Next: ${c.name} at ${g.need} ${g.unit} (${g.left} to go)`;
}

// The Daily Moonlight Run. `d` is save.endless.daily: { last, streak, bestStreak, hist: { 'YYYY-MM-DD': { rows, score, runs } } }.
export const emptyDaily = () => ({ last: '', streak: 0, bestStreak: 0, hist: {} });
// A streak is alive while the last played day is today or yesterday
export function dailyStreak(d, today) {
  if (!d.last) return 0;
  return d.last === today || d.last === shiftDay(today, -1) ? d.streak : 0;
}
// Record a finished daily run. Returns what the over screen shows.
export function recordDaily(d, key, rows, score) {
  const before = d.hist[key];
  const e = before ? { ...before } : { rows: 0, score: 0, runs: 0 };
  const newBest = !before || score > e.score;
  e.rows = Math.max(e.rows, rows); e.score = Math.max(e.score, score); e.runs++;
  d.hist[key] = e;
  if (!d.last || key > d.last) {
    d.streak = d.last && shiftDay(d.last, 1) === key ? d.streak + 1 : 1;
    d.last = key;
  }
  d.bestStreak = Math.max(d.bestStreak, d.streak);
  for (const k of Object.keys(d.hist).sort().slice(0, -DAILY_KEEP)) delete d.hist[k];
  return { key, best: { ...e }, newBest, streak: d.streak, first: !before };
}
