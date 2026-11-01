// Moonlight Run generator: seeded 6-row chunks (one checkpoint row + five hazard rows) drawn from weighted
// templates whose speed and density rise with the chunk index d (MECHANICS §8). Idea after the weighted row
// generation in EvanBacon/Expo-Crossy-Road (MIT, studied only); written fresh. tools/check-levels.mjs --endless
// proves generated runs crossable.
import { makeRng } from '../rng.js';

const CHUNK = 6;

export class Endless {
  constructor(seed, assist = false) {
    this.rng = makeRng((seed ^ 0xe11d1e55) >>> 0);
    this.assist = assist;
    this.n = 0;
    this.level = { id: 'endless', n: 0, zone: 5, name: 'Moonlight Run', night: true, theme: 'night', rows: [{ t: 'start', check: true }, { t: 'grass' }], items: [], beams: null, feeds: null, par: 0 };
  }
  difficulty(row) { return Math.max(0, Math.floor((row - 2) / CHUNK)); }

  next() {
    const r = this.rng, d = this.n++, L = this.level, base = L.rows.length, items = [];
    const sp = (a) => +(Math.min(2.6, a + d * 0.07) * r.range(0.9, 1.1)).toFixed(2);
    const dir = () => (r.chance(0.5) ? 1 : -1);
    const rows = [{ t: r.pick(['grass', 'path', 'boardwalk']), check: true, night: true }];
    // kinds unlock with difficulty
    const menu = [['water', 5], ['conga', d >= 1 ? 2 : 0], ['bask', 2], ['hatch', d >= 2 ? 1.5 : 0], ['whip', d >= 4 ? 1.5 : 0], ['sleep', d >= 6 ? 1.2 : 0], ['pool', 1.2]];
    let waterRun = 0;
    for (let i = 0; i < CHUNK - 1; i++) {
      let pick = r.weighted(menu);
      if (waterRun >= 3 && ['water', 'conga', 'whip', 'pool'].includes(pick)) pick = r.pick(['bask', 'pool']);
      let row;
      const gaps = Math.max(1.4, 3.2 - d * 0.12);
      if (pick === 'water' || pick === 'whip') {
        const len = 3, n = Math.max(2, Math.round(15 / (len + gaps * r.range(0.8, 1.3))));
        const step = 15 / n, off = r.range(0, step);
        row = { t: 'water', dir: dir(), v: sp(0.9), g: Array.from({ length: n }, (_, j) => ({ k: pick === 'whip' && j % 2 === 0 ? 'whipper' : 'paddler', len, at: +(off + j * step).toFixed(2), fling: 2 })) };
      } else if (pick === 'conga') {
        row = { t: 'water', dir: dir(), v: sp(0.8), g: [{ k: 'conga', n: 3, len: 3, at: r.range(0, 7) }, { k: 'paddler', len: 3, at: r.range(9, 13) }] };
      } else if (pick === 'pool') {
        const a = r.int(4), b = 5 + r.int(4);
        row = { t: 'water', dir: dir(), v: sp(0.8), pools: [a, b], g: [{ k: 'paddler', len: 3, at: r.range(0, 4) }, { k: 'paddler', len: 3, at: r.range(8, 11) }] };
        if (r.chance(0.6)) items.push({ r: base + i + 1, c: r.pick([a, b]), k: r.pick(['pecan', 'berry', 'cap']) });
      } else if (pick === 'bask') {
        row = { t: 'sand', dir: dir(), v: +(0.25 + d * 0.03).toFixed(2), g: [{ k: 'basker', len: 3, at: r.range(0, 5) }, { k: 'basker', len: 3, at: r.range(8, 12) }] };
      } else if (pick === 'hatch') {
        row = { t: 'grass', dir: dir(), v: sp(1.4), g: [0, 4, 8, 12].map((a) => ({ k: 'hatchling', at: a + r.range(0, 1.5) })) };
      } else {
        const cols = [r.int(3), 3 + r.int(3), 6 + r.int(3)];
        row = { t: 'straw', dir: dir(), v: 0, g: cols.map((c) => ({ k: 'sleeper', len: 2, at: c + 3 + (r.chance(0.5) ? 0 : 0.0) })) };
      }
      // stacked water lanes always alternate direction: same-direction lanes at the same speed can phase-lock
      // so their gators never line up (seed 465 before this rule)
      const prev = rows[rows.length - 1];
      if (row.t === 'water' && prev.t === 'water' && prev.dir === row.dir) row.dir = -row.dir;
      row.night = true;
      waterRun = row.t === 'water' ? waterRun + 1 : 0;
      rows.push(row);
    }
    if (r.chance(0.5)) items.push({ r: base, c: r.int(9), k: r.chance(0.3) ? 'drum' : 'cap' });
    for (const row of rows) L.rows.push(row);
    for (const it of items) L.items.push(it);
    return { rows, items };
  }
}
