#!/usr/bin/env node
// Checks data/facts.json: bank facts against the audited trivia bank (id exists, `confirmed`, same source;
// after games/basketball/tools/check-facts.mjs, Hot Springs Games, MIT) and research facts against
// research/alligator-farm.md (the cited URL must appear there). Run from anywhere.
//   node tools/check-facts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const facts = JSON.parse(fs.readFileSync(path.join(game, 'data/facts.json'), 'utf8'));
const bankFile = path.join(game, '../trivia/data/questions.json');
const corpusFile = path.join(game, '../../research/alligator-farm.md');
let bad = 0, n = 0;
const fail = (id, msg) => { bad++; console.log(`FAIL ${id}: ${msg}`); };

if (fs.existsSync(bankFile)) {
  const bank = JSON.parse(fs.readFileSync(bankFile, 'utf8')).questions;
  for (const f of facts.bank) {
    n++;
    const q = bank.find((x) => x.id === f.id);
    if (!q) fail(f.id, 'id not in audited bank');
    else if (q.confidence !== 'confirmed') fail(f.id, `confidence is ${q.confidence}`);
    else if (q.source !== f.source) fail(f.id, `source differs: bank "${q.source}"`);
    else console.log(`ok   ${f.id}  ${q.answer}`);
  }
} else console.log('skip bank facts: games/trivia/data/questions.json not found (standalone repo)');

if (fs.existsSync(corpusFile)) {
  const corpus = fs.readFileSync(corpusFile, 'utf8');
  for (const f of facts.research) {
    n++;
    if (!f.sourceUrl || !corpus.includes(f.sourceUrl)) fail(f.id, `URL not cited in research/alligator-farm.md: ${f.sourceUrl}`);
    else console.log(`ok   ${f.id}  ${f.source}`);
  }
} else console.log('skip research facts: research/alligator-farm.md not found (standalone repo)');

const ids = [...facts.bank, ...facts.research].map((f) => f.id);
if (new Set(ids).size !== ids.length) fail('*', 'duplicate fact ids');
console.log(`\n${n - bad}/${n} facts verified`);
process.exit(bad ? 1 : 0);
