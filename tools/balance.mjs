#!/usr/bin/env node
// Balance report: a human-like bot (src/js/sim/bot.js) plays every level many times with the real Run code.
// Reports clear rate (5 rings), mean deaths, mean time vs par, and causes of death. Targets: PRD AC37.
//   node tools/balance.mjs [--runs 40] [--skill casual|good] [--only l3] [--src] [--endless 30]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Run } from '../src/js/sim/run.js';
import { Bot } from '../src/js/sim/bot.js';
import { makeRng } from '../src/js/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const runs = +val('runs', 40), skill = val('skill', 'casual'), only = val('only');
const levels = argv.includes('--src') ? (await import('./levels-src.mjs')).LEVELS : JSON.parse(fs.readFileSync(path.join(ROOT, 'data/levels.json'), 'utf8')).levels;

function play(L, seed, mode) {
  const run = new Run(JSON.parse(JSON.stringify(L)), { seed, mode });
  const bot = new Bot(run, makeRng(seed * 7919 + 13), skill);
  const causes = {};
  const cap = mode === 'endless' ? 120 * 400 : 120 * 240;
  while (run.phase === 'play' && run.steps < cap) {
    run.step(bot.input());
    for (const e of run.drain()) if (e.k === 'die') causes[e.cause] = (causes[e.cause] || 0) + 1;
  }
  return { run, causes };
}

const en = val('endless');
if (en) {
  const rows = [];
  for (let s = 1; s <= +en; s++) { const { run } = play({ id: 'endless' }, s, 'endless'); rows.push(Math.floor((run.maxRow - 2) / 6)); }
  rows.sort((a, b) => a - b);
  console.log(`endless (${skill}): median ${rows[rows.length >> 1]} chunks, p25 ${rows[rows.length >> 2]}, p75 ${rows[(rows.length * 3) >> 2]}`);
  process.exit(0);
}

const report = [];
for (const L of levels) {
  if (only && L.id !== only) continue;
  let win = 0, deaths = 0, tsum = 0, under = 0, stuck = 0;
  const causes = {};
  for (let s = 1; s <= runs; s++) {
    const r = play(L, s);
    if (r.run.phase === 'won') { win++; tsum += r.run.t; if (r.run.t <= (L.par || 60)) under++; }
    deaths += r.run.deaths;
    if (r.run.phase === 'play') stuck++;
    for (const [k, v] of Object.entries(r.causes)) causes[k] = (causes[k] || 0) + v;
  }
  const row = { id: L.id, zone: L.zone, clear: +(win / runs).toFixed(2), deaths: +(deaths / runs).toFixed(2), t: win ? +(tsum / win).toFixed(1) : null, par: L.par, underPar: +(under / runs).toFixed(2), stuck, causes };
  report.push(row);
  console.log(`${L.id.padEnd(4)} z${L.zone} clear ${(row.clear * 100).toFixed(0).padStart(3)}%  deaths/run ${row.deaths.toFixed(2)}  t ${row.t ?? '-'}s (par ${L.par})  underPar ${(row.underPar * 100).toFixed(0)}%  stuck ${stuck}  ${JSON.stringify(causes)}`);
}
fs.mkdirSync(path.join(ROOT, 'tools/out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `tools/out/balance-${skill}.json`), JSON.stringify(report, null, 1));
