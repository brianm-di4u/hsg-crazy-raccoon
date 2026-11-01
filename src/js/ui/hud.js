// In-game HUD (DOM over the canvas): tail rings, score, multiplier, snacks carried/banked, lures, timer, pause and
// the touch Lure button. Rebuilds a node only when its value changes.
import { bindButton } from './input.js';

const ringSvg = (n, max) => {
  // Bandit's tail: one black ring per life left, empty rings for lives lost (shape + count, not colour alone)
  let s = '';
  for (let i = 0; i < max; i++) s += `<span class="ring ${i < n ? 'on' : 'off'}" aria-hidden="true"></span>`;
  return s;
};

export class Hud {
  constructor(root, app) {
    this.root = root; this.app = app; this.last = {};
    root.innerHTML = `
      <div class="top">
        <div class="pill rings" id="h-rings" role="img" aria-label="Tail rings"></div>
        <div class="pill score"><span class="lbl">Score</span><b id="h-score">0</b><span class="mult" id="h-mult" hidden></span></div>
        <button type="button" class="btn icon" id="h-pause" aria-label="Pause">❚❚</button>
      </div>
      <div class="sub">
        <div class="pill snacks" id="h-snacks" aria-label="Snacks"></div>
        <div class="pill time" id="h-time" aria-label="Time"></div>
        <div class="pill beam" id="h-beam" hidden></div>
      </div>
      <div class="bottom">
        <div class="pill hint" id="h-hint" hidden></div>
        <button type="button" class="btn lure" id="h-lure" aria-label="Toss a drumstick lure"><span class="drum" aria-hidden="true"></span><span class="lbl">Lure</span><b id="h-lures">0</b></button>
      </div>`;
    bindButton(root.querySelector('#h-pause'), () => app.onHud('pause'));
    bindButton(root.querySelector('#h-lure'), () => app.onHud('lure'));
  }
  show(on) { this.root.classList.toggle('on', on); this.last = {}; }
  set(id, v, html = false) {
    if (this.last[id] === v) return;
    this.last[id] = v;
    const el = this.root.querySelector('#' + id);
    if (!el) return;
    if (html) el.innerHTML = v; else el.textContent = v;
  }
  hint(text) {
    const el = this.root.querySelector('#h-hint');
    if (this.last.hint === text) return;
    this.last.hint = text; el.hidden = !text; el.textContent = text || '';
  }
  update(run) {
    const max = run.mode === 'endless' ? 3 : (run.L.rings || 5) + (run.assist ? 2 : 0);
    this.set('h-rings', ringSvg(run.rings, max), true);
    this.root.querySelector('#h-rings').setAttribute('aria-label', `${run.rings} tail rings left`);
    this.set('h-score', run.score.toLocaleString('en-US'));
    const m = this.root.querySelector('#h-mult');
    if (this.last.mult !== run.mult) { this.last.mult = run.mult; m.hidden = run.mult <= 1; m.textContent = '×' + run.mult; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop'); }
    const c = run.carried(), washed = c.filter((i) => i.washed).length;
    const total = run.treatsTotal();
    this.set('h-snacks', `<span class="nut" aria-hidden="true"></span><b>${c.length}/3</b>${washed ? `<span class="washed">✦${washed}</span>` : ''}${run.mode === 'endless' ? '' : `<span class="banked">${run.treatsBanked()}/${total} home</span>`}`, true);
    const tt = run.mode === 'endless' ? `${Math.max(0, run.maxRow)} rows` : `${fmt(run.t)}${run.L.par ? ` / ${fmt(run.L.par)}` : ''}`;
    this.set('h-time', tt);
    this.set('h-lures', String(run.lures));
    const lb = this.root.querySelector('#h-lure');
    if (this.last.lureOn !== run.lures > 0) { this.last.lureOn = run.lures > 0; lb.disabled = run.lures <= 0; }
    const bm = this.root.querySelector('#h-beam');
    if (run.beam != null) { bm.hidden = false; this.set('h-beam', `Lantern ${Math.max(0, Math.round(run.p.row - run.beam))} rows behind`); } else bm.hidden = true;
  }
}
export const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
