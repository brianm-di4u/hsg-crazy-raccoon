#!/usr/bin/env node
// Builds the painted art: (1) makes lane strips seamless left-to-right by cross-fading each edge into a mirrored
// copy of the other, (2) keys out white and measures each sprite's trimmed aspect so art.json packs it with no
// padding, (3) writes art-src/art.json and runs shared/test-harness/art-pack.mjs. Uses the harness's Chromium.
//   node tools/build-art.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'art-src');
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared/test-harness/node_modules/playwright/index.mjs')).href);

const exists = (f) => fs.existsSync(path.join(SRC, f));
const TILES = ['water', 'grass', 'sand', 'path', 'boardwalk', 'straw'];
const SPRITES = [
  ...['paddler', 'whipper', 'basker', 'sleeper', 'boss'].flatMap((k) => [`gator-${k}-closed`, `gator-${k}-open`]), 'gator-hatchling', 'gator-swimmer-closed', 'gator-swimmer-open',
  ...['up', 'up3', 'down', 'left'].flatMap((f) => [`raccoon-${f}-stand`, `raccoon-${f}-hop`]),
  ...['pecan', 'berry', 'cap', 'drum', 'ball', 'ticket'].map((k) => `item-${k}`),
  ...['pool', 'den', 'hay', 'pine', 'fence', 'feedstage', 'crate', 'lamp', 'cattails', 'rock', 'bucket', 'lantern', 'eggs', 'sign', 'railing'].map((k) => `prop-${k}`),
  ...['cheer', 'sheepish', 'portrait'].map((k) => `bandit-${k}`),
];
// target widths (px) per family, sized for ~2x DPR at the largest tile size
const WIDTH = (n) => (n.startsWith('gator-boss') ? 900 : n.startsWith('gator-hatchling') ? 220 : n.startsWith('gator-') ? 560 : n.startsWith('raccoon') ? 240 : n === 'prop-den' ? 420 : n === 'prop-pine' ? 220 : n === 'prop-fence' ? 260 : n === 'prop-pool' ? 260 : n.startsWith('bandit-') ? 360 : n === 'prop-feedstage' ? 300 : n === 'prop-railing' ? 320 : n === 'prop-sign' ? 240 : 200);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><body></body>');
const dataUrl = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(SRC, f)).toString('base64');

// (1) seamless strips
for (const t of TILES) {
  const f = `tile-${t}.png`;
  if (!exists(f)) { console.log('  missing', f); continue; }
  const b64 = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    // blend a mirrored strip over each edge so column 0 and column W-1 match
    const band = Math.round(W * 0.12);
    const m = document.createElement('canvas'); m.width = W; m.height = H; const mg = m.getContext('2d');
    mg.translate(W, 0); mg.scale(-1, 1); mg.drawImage(img, 0, 0);
    for (let x = 0; x < band; x++) {
      const a = 0.5 * (1 - x / band);
      g.globalAlpha = a; g.drawImage(m, x, 0, 1, H, x, 0, 1, H); g.drawImage(m, W - 1 - x, 0, 1, H, W - 1 - x, 0, 1, H);
    }
    return c.toDataURL('image/png').split(',')[1];
  }, dataUrl(f));
  fs.writeFileSync(path.join(SRC, `tile-${t}-seam.png`), Buffer.from(b64, 'base64'));
  console.log('  seam    ', t);
}

// (2) trimmed aspect of each keyed sprite
const items = [];
for (const t of TILES) if (exists(`tile-${t}-seam.png`)) items.push({ name: `tile-${t}`, src: `tile-${t}-seam.png`, w: 768, h: 256, fit: 'cover', quality: 0.8 });
for (const n of SPRITES) {
  if (!exists(n + '.png')) { console.log('  missing', n); continue; }
  const box = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); const p = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (p[i] < 236 || p[i + 1] < 236 || p[i + 2] < 236) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return { w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }, dataUrl(n + '.png'));
  const w = WIDTH(n), h = Math.max(8, Math.round((w * box.h) / box.w));
  items.push({ name: n, src: n + '.png', w, h, fit: 'contain', keyWhite: 18, trim: true });
}
for (const [name, src, w, h] of [['backdrop-day', 'backdrop-day.png', 1600, 600], ['backdrop-night', 'backdrop-night.png', 1600, 600], ['backdrop-barn', 'backdrop-barn.png', 1600, 600], ['title-keyart', 'pilot-keyart.png', 1536, 1024]]) {
  if (exists(src)) items.push({ name, src, w, h, fit: 'cover', quality: 0.8 });
}
await browser.close();
fs.writeFileSync(path.join(SRC, 'art.json'), JSON.stringify({ quality: 0.84, items }, null, 1) + '\n');
console.log(`  art.json: ${items.length} items`);
if (!process.argv.includes('--dry')) {
  const r = spawnSync(process.execPath, ['shared/test-harness/art-pack.mjs', '.'], { cwd: ROOT, stdio: 'inherit' });
  process.exit(r.status);
}
