// Fact cards come only from checked sources (PRD AC23). Run: npm run sim
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('tools/check-facts.mjs passes', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-facts.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
