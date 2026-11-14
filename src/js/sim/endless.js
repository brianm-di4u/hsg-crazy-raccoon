// Moonlight Run generator: seeded 6-row chunks (one checkpoint row + five hazard rows) drawn from weighted
// templates whose speed and density rise with the chunk index d (MECHANICS §8). Idea after the weighted row
// generation in EvanBacon/Expo-Crossy-Road (MIT, studied only); written fresh. tools/check-levels.mjs --endless
// proves generated runs crossable.
import { makeRng } from '../rng.js';

const CHUNK = 6;
// Difficulty knobs (wave 2, S3-04). Old values beside each so a retune can be reversed by editing one line.
export const SPEED_CAP = 3.4; // gator speed ceiling in tiles/s; wave 1: 2.6, reached at chunk ~24 so the run went flat
export const GAP_FLOOR = 1.2; // smallest gap between gators in a lane, tiles; wave 1: 1.4, reached at chunk 15
const FEED_FROM = 6, BEAM_FROM = 10; // first chunk that can hold a feeding-show lane / a keeper's beam row
const FEED_CHANCE = 0.4, BEAM_CHANCE = 0.45;
const BOSS_EVERY = 10; // chunk d with d % BOSS_EVERY === BOSS_EVERY - 1 holds Old Ruthless (chunks 9, 19, 29...)
const CHARM_FIRST = 4, CHARM_EVERY = 6; // a tail-ring charm lies on the checkpoint row of chunks 4, 10, 16...

export class Endless {
  constructor(seed, assist = false) {
    this.rng = makeRng((seed ^ 0xe11d1e55) >>> 0);
    this.assist = assist;
    this.n = 0;
    this.level = { id: 'endless', n: 0, zone: 5, name: 'Moonlight Run', night: true, theme: 'night', rows: [{ t: 'start', check: true }, { t: 'grass' }], items: [], beams: [], feeds: [], par: 0 };
  }
  difficulty(row) { return Math.max(0, Math.floor((row - 2) / CHUNK)); }

  next() {
    const r = this.rng, d = this.n++, L = this.level, base = L.rows.length, items = [];
    const sp = (a) => +(Math.min(SPEED_CAP, a + d * 0.07) * r.range(0.9, 1.1)).toFixed(2);
    const dir = () => (r.chance(0.5) ? 1 : -1);
    const rows = [{ t: r.pick(['grass', 'path', 'boardwalk']), check: true, night: true }];
    // kinds unlock with difficulty
    const boss = d % BOSS_EVERY === BOSS_EVERY - 1;
    const beamRow = !boss && d >= BEAM_FROM && r.chance(BEAM_CHANCE) ? 1 + r.int(CHUNK - 1) : -1; // which hazard row (1..5) is the keeper's
    const menu = [['water', 5], ['conga', d >= 1 ? 2 : 0], ['bask', 2], ['hatch', d >= 2 ? 1.5 : 0], ['whip', d >= 4 ? 1.5 : 0], ['sleep', d >= 6 ? 1.2 : 0], ['pool', 1.2]];
    let waterRun = 0, bossDir = 1;
    for (let i = 0; i < CHUNK - 1; i++) {
      let pick = boss ? ['grass', 'oldr', 'oldr2', 'bask', 'pool'][i] : i + 1 === beamRow ? 'beam' : r.weighted(menu);
      if (!boss && waterRun >= 3 && ['water', 'conga', 'whip', 'pool'].includes(pick)) pick = r.pick(['bask', 'pool']);
      let row;
      const gaps = Math.max(GAP_FLOOR, 3.2 - d * 0.12);
      if (pick === 'beam') {
        // a plain lawn row under the keeper's flashlight: it sweeps the row, so cross it between sweeps
        row = { t: 'grass' };
        L.beams.push({ r0: base + i + 1, r1: base + i + 1, x0: 288, amp: +r.range(200, 230).toFixed(0), per: +Math.max(3.2, 4.5 - (d - BEAM_FROM) * 0.04).toFixed(2), ph: +r.range(0, 6).toFixed(2), w: +r.range(1, 1.1).toFixed(2) });
      } else if (pick === 'grass') {
        row = { t: 'grass' };
      } else if (pick === 'oldr' || pick === 'oldr2') {
        // Old Ruthless on two stacked lanes, the same pair as level 15 (its lanes run one way at one speed)
        if (pick === 'oldr') bossDir = dir();
        row = pick === 'oldr'
          ? { t: 'water', dir: bossDir, v: 1.5, g: [{ k: 'boss', at: 0, len: 6 }, { k: 'paddler', at: 9, len: 3 }, { k: 'paddler', at: 13, len: 3 }] }
          : { t: 'water', dir: bossDir, v: 1.5, g: [{ k: 'paddler', at: 9.5, len: 3 }, { k: 'paddler', at: 13.5, len: 3 }] };
      } else if (pick === 'water' || pick === 'whip') {
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
      if (row.t === 'water' && prev.t === 'water' && prev.dir === row.dir && pick !== 'oldr2') row.dir = -row.dir;
      row.night = true;
      waterRun = row.t === 'water' ? waterRun + 1 : 0;
      rows.push(row);
    }
    // feeding show (zone 3): from chunk FEED_FROM a lane of the chunk has its drumstick toss, as in levels 7 to 9
    if (d >= FEED_FROM && r.chance(FEED_CHANCE)) {
      const lanes = rows.map((w, j) => (w.t === 'water' && w.g ? base + j : -1)).filter((x) => x >= 0);
      if (lanes.length) L.feeds.push({ t0: +r.range(2, 6).toFixed(1), per: +r.range(6, 8).toFixed(1), r: r.pick(lanes), c: r.int(9) });
    }
    if (r.chance(0.5)) items.push({ r: base, c: r.int(9), k: r.chance(0.3) ? 'drum' : 'cap' });
    // a tail-ring charm so a long run can recover a lost ring
    if (d >= CHARM_FIRST && (d - CHARM_FIRST) % CHARM_EVERY === 0) items.push({ r: base, c: r.int(9), k: 'ring' });
    for (const row of rows) L.rows.push(row);
    for (const it of items) L.items.push(it);
    return { rows, items };
  }
}
