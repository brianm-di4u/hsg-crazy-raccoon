// Node-side proofs inside the harness matrix: unit tests, level solver, endless seeds, facts (AC12–AC23, AC34–AC35).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 600000 });

export const tests = [
  {
    name: 'node --test tests-node (mechanics, items, levels, endless, determinism, fuzz, facts)',
    node: true,
    async run(t) {
      const r = node(['--test', '--test-reporter=dot', 'tests-node/']);
      t.equal(r.status, 0, 'node tests pass');
      const m = (r.stdout + r.stderr).match(/# pass (\d+)[\s\S]*# fail (\d+)/) || (r.stdout + r.stderr).match(/pass (\d+)[\s\S]*fail (\d+)/);
      if (m) t.log(`pass ${m[1]}, fail ${m[2]}`);
      if (r.status !== 0) t.log((r.stdout + r.stderr).slice(-2000));
    },
  },
  {
    name: 'tools/check-levels.mjs proves every level',
    node: true,
    async run(t) {
      const r = node(['tools/check-levels.mjs']);
      t.equal(r.status, 0, r.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join('; ') || 'all levels ok');
    },
  },
  {
    name: 'tools/check-facts.mjs verifies every fact',
    node: true,
    async run(t) {
      const r = node(['tools/check-facts.mjs']);
      t.equal(r.status, 0, r.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join('; ') || 'facts ok');
    },
  },
];
