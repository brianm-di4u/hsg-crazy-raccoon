// Council wave 4, batch B: S2-25 (a locked level says what unlocks it), C4-02 (the short "not affiliated" line on the title),
// S4-12 (Credits say how the art was made), P-N03 (a bite is not a successful hop), S6-17 (the Moonlight Run shows its
// course and can run it again), S3-09 (endless levels are solvable far past the old check), S6-03 (a lighter picture tier).
// Every check reads state or the page; none depends on a measured time, a frame rate or dice.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-4', 'shots');
const keep = async (t, id, what, opt) => { const r = await t.shot(`${id}-${what}`, opt); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };

export const tests = [
  // ------------------------------------------------------------------ S2-25 locked levels say what unlocks them
  {
    name: 'S2-25 a locked level button says which level to clear first, and an open one does not',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'map'); await t.waitFrames(3);
      const labels = await t.page.$$eval('#screens .lvl', (b) => b.map((x) => ({ n: +x.querySelector('.n').textContent, label: x.getAttribute('aria-label'), off: x.disabled })));
      t.equal(labels.length, 15, 'fifteen level buttons');
      t.expect(!/Clear level/.test(labels[0].label) && !labels[0].off, 'level 1 is open and says nothing about clearing: ' + labels[0].label);
      for (const l of labels.filter((x) => x.off)) t.expect(l.label.endsWith(`locked. Clear level ${l.n - 1} first`), `level ${l.n}: ${l.label}`);
      t.expect(labels.filter((x) => x.off).length === 14, 'a new profile has fourteen locked');
      await t.game('setState', { save: { unlocked: 4 } }); await t.game('scene', 'map'); await t.waitFrames(3);
      const after = await t.page.$$eval('#screens .lvl', (b) => b.map((x) => x.getAttribute('aria-label')));
      t.expect(!/Clear level/.test(after[3]) && /Clear level 4 first/.test(after[4]), 'with four open, level 4 is open and level 5 asks for level 4: ' + after[3] + ' | ' + after[4]);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S2-25', 'map');
    },
  },
];
