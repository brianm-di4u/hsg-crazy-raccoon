// Council wave 3, follow-up pass: S4-07 (Bandit's word after a fact, three lines for each way to lose).
// Every check reads text the code picks without dice (the pick comes from the fact's id or the run's step count), so each
// answer is the same every run.
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('..', '_council', 'hsg-crazy-raccoon', 'wave-3', 'shots');
const keep = async (t, id, what) => { const r = await t.shot(`${id}-${what}`); if (fs.existsSync(SHOTS)) fs.copyFileSync(path.resolve(r.file), path.join(SHOTS, `${id}-${what}-${t.viewport}.png`)); return r; };
const CAUSES = { chomp: /^Chomped!/, splash: /^Splash!/, swept: /^Swept off the edge!/, spotted: /^Spotted by the keeper!/, caught: /^The lantern caught up!/ };
const lead = (t) => t.page.evaluate(() => (document.querySelector('.panel .lead') || {}).textContent || '');
const failLine = async (t, cause, steps) => {
  await t.page.evaluate(([c, n]) => { const A = window.__CR; A.run.steps = n; A.screens.show('fail', { L: A.level, cause: c, offerAssist: false }); }, [cause, steps]);
  await t.page.waitForSelector('.panel .lead');
  return (await lead(t)).replace(/^[^.]*\.\s*/, ''); // drop the level name
};

export const tests = [
  {
    name: 'S4-07 a fact card carries a Bandit line that adds no fact, the same one every time, and cards do not all say the same',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const seen = new Set();
      for (const id of ['l1', 'l4', 'l6', 'l7', 'l10', 'l13']) {
        await t.game('newGame', { level: id, intro: true, seed: 5 }); await t.waitFrames(2);
        const q = await t.page.evaluate(() => (document.querySelector('.fact .quip') || {}).textContent || '');
        t.expect(/^Bandit says: .+\.$/.test(q), `${id} has a Bandit line: ${q}`);
        t.expect(!/\d/.test(q), `${id}: the line holds no number or date`);
        await t.game('newGame', { level: id, intro: true, seed: 6 }); await t.waitFrames(2);
        t.equal(await t.page.evaluate(() => document.querySelector('.fact .quip').textContent), q, `${id}: the same card gets the same line`);
        seen.add(q);
      }
      // six cards fall on six lines by a fixed rule; at least two different lines appear (the rule, not luck)
      t.expect(seen.size >= 2, `the cards do not all say the same thing (${seen.size} different lines)`);
      await t.game('newGame', { level: 'l1', intro: true, seed: 5 }); await t.waitFrames(2);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S4-07', 'fact-quip');
    },
  },
  {
    name: 'S4-07 each way to lose has three lines, all naming the cause first, picked from the run so one panel keeps its line',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { level: 'l1', seed: 3 }); await t.game('pause'); await t.waitFrames(2);
      for (const [cause, re] of Object.entries(CAUSES)) {
        const lines = [];
        for (const n of [0, 1, 2, 3]) lines.push(await failLine(t, cause, n));
        t.expect(lines.every((l) => re.test(l)), `${cause}: every line starts with its cause: ${lines.join(' | ')}`);
        t.equal(new Set(lines).size, 3, `${cause}: three different lines`);
        t.equal(lines[0], lines[3], `${cause}: step 3 wraps to the first line again`);
      }
      await failLine(t, 'spotted', 2);
      await t.checkLayout({ allowScrollY: true });
      await keep(t, 'S4-07', 'fail-line');
    },
  },
];
