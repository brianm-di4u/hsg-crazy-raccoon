#!/usr/bin/env node
// Proves every campaign level crossable at a human decision pace, sets par times, and (with --write) writes
// data/levels.json from tools/levels-src.mjs. With --endless N it proves N Moonlight Run seeds' first 12 chunks.
//   node tools/check-levels.mjs [--write] [--only l3] [--endless 500] [--assist]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from './levels-src.mjs';
import { solve, replay } from '../src/js/sim/solve.js';
import { Run } from '../src/js/sim/run.js';
import { Endless } from '../src/js/sim/endless.js';
import { GROUND, COLS } from '../src/js/sim/const.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const assist = has('assist');
let bad = 0;

function validate(L) {
  const errs = [];
  if (L.rows[0].t !== 'start' && !L.rows[0].check) errs.push('row 0 must be a start/checkpoint');
  if (L.rows[L.rows.length - 1].t !== 'goal') errs.push('last row must be the goal');
  L.rows.forEach((r, i) => {
    if (r.check && r.g && r.g.length) errs.push(`row ${i}: checkpoints must be gator-free`);
    if (r.pools && r.pools.some((c) => c < 0 || c >= COLS)) errs.push(`row ${i}: pool column out of range`);
  });
  for (const it of L.items || []) {
    const r = L.rows[it.r];
    if (!r) { errs.push(`item ${it.k} row ${it.r} missing`); continue; }
    const ok = GROUND.has(r.t) || r.t === 'start' || (r.pools && r.pools.includes(it.c));
    if (!ok) errs.push(`item ${it.k} at ${it.r},${it.c} is not on ground or a pool stone`);
    if (r.blocks && r.blocks.includes(it.c)) errs.push(`item ${it.k} at ${it.r},${it.c} is on a block`);
    if (r.t === 'goal') errs.push(`item ${it.k} on the goal row is unreachable before the level ends`);
  }
  if ((L.items || []).filter((i) => i.k === 'ball').length !== 1) errs.push('each level needs exactly one ball');
  // dead-end pockets: in two stacked static land rows (fences, blocks, stationary sleepers), every run of free
  // columns in the lower row must reach a free column in the row above without going back down
  const staticOcc = (r) => {
    const row = L.rows[r];
    if (!row || row.t === 'water' || row.t === 'goal') return null;
    if (row.g && row.g.some((g) => g.k !== 'sleeper' || (row.v ?? 1) !== 0)) return null;
    const occ = new Set(row.t === 'fence' ? [...Array(COLS).keys()].filter((c) => !(row.gaps || []).includes(c)) : row.blocks || []);
    for (const g of row.g || []) { const c0 = g.at - 3; for (let c = c0; c < c0 + (g.len ?? 2); c++) occ.add(c); }
    return occ;
  };
  for (let r = 0; r + 1 < L.rows.length; r++) {
    const lo = staticOcc(r), hi = staticOcc(r + 1);
    if (!lo || !hi) continue;
    let seg = [];
    for (let c = 0; c <= COLS; c++) {
      if (c < COLS && !lo.has(c)) { seg.push(c); continue; }
      if (seg.length && !seg.some((x) => !hi.has(x))) errs.push(`row ${r} cols ${seg.join(',')}: dead-end pocket under row ${r + 1}`);
      seg = [];
    }
  }
  return errs;
}

if (has('endless')) {
  const n = +val('endless', 50), chunks = +val('chunks', 12);
  let ok = 0;
  const t0 = Date.now();
  for (let s = 1; s <= n; s++) {
    const gen = new Endless(s, assist);
    for (let i = 0; i < chunks; i++) gen.next();
    gen.level.rows.push({ t: 'goal' });
    const res = solve(gen.level, { assist, maxT: 240, cap: 1500 });
    if (res.ok) ok++; else { bad++; console.log(`FAIL endless seed ${s}: best row ${res.row}/${gen.level.rows.length - 1}`); }
  }
  console.log(`endless: ${ok}/${n} seeds crossable through ${chunks} chunks (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(bad ? 1 : 0);
}

const only = val('only');
const out = [];
for (const src of LEVELS) {
  if (only && src.id !== only) { out.push(src); continue; }
  const L = JSON.parse(JSON.stringify(src));
  const errs = validate(L);
  if (errs.length) { bad++; console.log(`FAIL ${L.id} data:\n  ${errs.join('\n  ')}`); out.push(L); continue; }
  const t0 = Date.now();
  const res = solve(L, { assist });
  if (!res.ok) { bad++; console.log(`FAIL ${L.id} "${L.name}": no crossing found (best row ${res.row}/${L.rows.length - 1}, ${res.nodes} nodes)`); out.push(L); continue; }
  // replay through the real Run: the plan must win with no deaths
  const run = replay(new Run(L, { assist, seed: 1 }), res.moves);
  if (run.phase !== 'won' || run.deaths) { bad++; console.log(`FAIL ${L.id}: solver plan does not replay (phase ${run.phase}, deaths ${run.deaths})`); }
  // every item reachable from the start
  const unreachable = [];
  for (const it of L.items) {
    const r = solve(L, { assist, target: { r: it.r, c: it.c }, maxT: 90 });
    if (!r.ok) unreachable.push(`${it.k}@${it.r},${it.c}`);
  }
  if (unreachable.length) { bad++; console.log(`FAIL ${L.id}: unreachable items ${unreachable.join(', ')}`); }
  const par = Math.ceil((res.t * 2.2 + 8) / 5) * 5;
  L.par = L.par || par;
  L.solve = { t: res.t, hops: res.moves.length, nodes: res.nodes };
  L.plan = res.moves.map((m) => [m.step, m.dir[0]]);
  out.push(L);
  console.log(`ok   ${L.id} "${L.name}": ${L.rows.length} rows, solved in ${res.t}s (${res.moves.length} hops), par ${L.par}s, items ${L.items.length} reachable [${Date.now() - t0} ms]`);
}
if (has('write')) {
  if (bad) { console.log('not writing data/levels.json: fix the failures first'); process.exit(1); }
  fs.writeFileSync(path.join(ROOT, 'data/levels.json'), JSON.stringify({ v: 1, levels: out }, null, 0).replace(/\{"id"/g, '\n{"id"') + '\n');
  console.log(`wrote data/levels.json (${out.length} levels)`);
}
process.exit(bad ? 1 : 0);
