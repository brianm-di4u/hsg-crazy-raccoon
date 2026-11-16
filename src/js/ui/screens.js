// Menu screens (DOM). Every action is a real <button>; arrow keys / d-pad move focus, Enter / A confirms, Esc / B
// goes back. Structure after games/Furious Squirrels/src/js/ui/screens.js (Hot Springs Games, MIT).
import { fmt } from './hud.js';
import { ACHIEVEMENTS, COSTUMES, totals, costumeUnlocked, activeCostume, dailyStreak, shiftDay, dayLabel, achName } from '../progress.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const btn = (act, label, extra = '', cls = 'btn') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;
const seg = (k, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="btn small" data-act="set" data-k="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
// Volume is five steps (S2-26). 0.25, 0.5 and 0.85 are the old Low, Medium and High, so a saved volume sits on the same step at the same loudness;
// the two new steps lie between them, about 3 dB apart.
export const VOLUMES = [0.25, 0.35, 0.5, 0.65, 0.85];
const volSeg = (cur) => `<div class="seg" role="group" aria-label="Volume, 1 is quietest, 5 is loudest">${VOLUMES.map((v, i) => `<button type="button" class="btn small" data-act="set" data-k="volume" data-v="${v}" aria-pressed="${cur === v}" aria-label="Volume ${i + 1} of 5">${i + 1}</button>`).join('')}</div>`;
const field = (label, inner) => `<div class="field"><span class="flabel">${label}</span>${inner}</div>`;
const stars = (st) => `<span class="stars" aria-label="${st.filter(Boolean).length} of 3 stars">${st.map((b) => (b ? '★' : '<span class="off">☆</span>')).join('')}</span>`;
export const FICTION = 'A made-up raccoon caper at a real Hot Springs landmark. Not affiliated with the Arkansas Alligator Farm and Petting Zoo.';
// the title carries one short line; the full wording lives in Credits (S2-21)
export const FICTION_SHORT = 'A made-up caper at a real Hot Springs landmark. Not affiliated with the Arkansas Alligator Farm.';
const ZONES = ['', 'Front Pits', 'Hatchling Nursery', 'Noon Feeding Show', 'Winter Barn', 'Midnight Raid'];
// where each zone sits in the farm story, in words the repo already holds (research/town-content.md section 1)
const PLACES = ['', 'Over the wall from Whittington Ave.', 'Hatchlings, restocked from Louisiana', "Chicken for the gators, and the keeper's call", 'Warm under the heat lamps', 'After dark, when raccoons are about'];
/* global MANIFEST */
const MAN = typeof MANIFEST !== 'undefined' && !/[?&]art=0/.test(location.search) ? MANIFEST : {};
// a painted Bandit pose for a screen, falling back through the poses that exist
const bandit = (names, cls = '') => { const n = names.find((k) => MAN[k]); return n ? `<img class="portrait ${cls}" src="assets/${MAN[n].file}" alt="" aria-hidden="true">` : ''; };
// the lost ball in Bandit's paw on the ending panel (drawn in CSS and SVG): a ball with stitches, or an empty outline
const ballSvg = (all) => all
  ? '<svg class="ballsvg" viewBox="0 0 40 40" role="img" aria-label="The 1918 ball"><circle cx="20" cy="20" r="17" fill="#FFFDF2" stroke="#1B1A17" stroke-width="3"/><path d="M11 9q7 11 0 22M29 9q-7 11 0 22" fill="none" stroke="#C2482B" stroke-width="2.2" stroke-dasharray="3 3"/></svg>'
  : '<svg class="ballsvg" viewBox="0 0 40 40" role="img" aria-label="An empty paw"><circle cx="20" cy="20" r="17" fill="none" stroke="#7A715E" stroke-width="3" stroke-dasharray="5 5"/></svg>';
const dailyNote = (app) => {
  const d = app.save.endless.daily, today = app.today(), e = d.hist[today], st = dailyStreak(d, today);
  return `<p class="note daily-note">${e ? `Today: best ${e.rows} rows.` : "Today's Daily Run is waiting."}${st ? ` ${st}-day streak.` : ''}</p>`;
};
// Bandit's word after a fact (S4-07): the same few lines in turn, picked from the fact's id so a card always gets the same one.
// They add no facts, only the voice, so the source line under the fact still stands for everything the card claims.
const QUIPS = ['Bandit says: write that one down.', 'Bandit says: good to know before the next gator.', 'Bandit says: a raccoon never forgets a fact, or a snack.',
  'Bandit says: that is a lot of history for one raccoon.', 'Bandit says: the gators knew that all along.', 'Bandit says: filing that under important.'];
export const quipFor = (id) => QUIPS[[...String(id)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7) % QUIPS.length];
const factCard = (f) => f ? `<aside class="fact"><b>Farm fact</b><p>${esc(f.text)}</p><p class="quip">${esc(quipFor(f.id))}</p><small>Source: ${esc(f.source)}</small></aside>` : '';

export class Screens {
  constructor(root, app) {
    this.root = root; this.app = app; this.cur = null; this.data = {}; this.trans = 0;
    // the title scrolls itself when the screen is short (a phone held sideways): a cue says there is more below (S2-10)
    root.addEventListener('scroll', () => this.titleCue(), { passive: true });
    window.addEventListener('resize', () => this.titleCue());
  }
  titleCue() {
    const r = this.root;
    r.classList.toggle('more', this.cur === 'title' && r.scrollTop + r.clientHeight < r.scrollHeight - 8);
  }
  show(name, data = {}) {
    this.cur = name; this.data = data;
    // the panel pop-in (0.22 s CSS) counts as a transition for isIdle()
    this.transUntil = document.body.classList.contains('reduced') ? 0 : performance.now() + 280;
    const html = TEMPLATES[name] ? TEMPLATES[name](this.app, data) : '';
    this.root.innerHTML = html;
    this.root.className = 'screens' + (html ? ' on' : '') + (name === 'title' ? ' title' : '');
    document.body.dataset.screen = name;
    this.root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => { if (!b.disabled) this.app.onMenu(b.dataset.act, { ...b.dataset }); }));
    const inp = this.root.querySelector('input');
    const first = inp || this.root.querySelector('[autofocus]:not([disabled])') || this.root.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
    if (this.app.say && data.say !== false) { const h = this.root.querySelector('h1, h2'); if (h) this.app.say(h.textContent); }
    // a panel taller than the screen shows a 'more' cue above its button row until it is scrolled to the end
    const pn = this.root.querySelector('.panel');
    if (name === 'title') requestAnimationFrame(() => this.titleCue());
    if (pn) { const upd = () => pn.classList.toggle('more', pn.scrollTop + pn.clientHeight < pn.scrollHeight - 8); pn.addEventListener('scroll', upd, { passive: true }); requestAnimationFrame(upd); }
  }
  refresh() {
    if (!this.cur) return;
    const a = document.activeElement, key = a && a.dataset ? `${a.dataset.act}|${a.dataset.k}|${a.dataset.v}` : '';
    this.show(this.cur, { ...this.data, say: false });
    const el = [...this.root.querySelectorAll('button')].find((b) => `${b.dataset.act}|${b.dataset.k}|${b.dataset.v}` === key);
    if (el) el.focus({ preventScroll: true });
  }
  hide() { this.cur = null; this.root.innerHTML = ''; this.root.className = 'screens'; delete document.body.dataset.screen; }
  nav(m) {
    if (!this.cur) return false;
    const btns = [...this.root.querySelectorAll('button:not([disabled])')];
    if (m.cancel) { const back = this.root.querySelector('[data-back]'); if (back) back.click(); return true; }
    if (!btns.length) return false;
    let i = btns.indexOf(document.activeElement);
    if (m.down || m.right) i = (i + 1) % btns.length;
    else if (m.up || m.left) i = (i - 1 + btns.length) % btns.length;
    else if (m.ok) { if (document.activeElement && document.activeElement.click) document.activeElement.click(); return true; }
    else return false;
    btns[Math.max(0, i)].focus({ preventScroll: true });
    return true;
  }
}

const TEMPLATES = {
  title: (app) => `
    <div class="title-wrap">
      <div class="logo" aria-label="Crazy Raccoon: Gator Farm Dash"><h1><span class="w1">Crazy</span><span class="w2">Raccoon</span></h1><p class="subtitle">Gator Farm Dash</p></div>
      <nav class="menu" aria-label="Main menu">
        ${btn('play', app.save.unlocked > 1 ? 'Play (continue)' : 'Play', 'autofocus', 'btn primary big')}
        <div class="row2">${btn('endless', app.save.endless.unlocked ? 'Moonlight Run' : 'Moonlight Run 🔒', app.save.endless.unlocked ? '' : 'aria-describedby="lock-note"')}${btn('daily', app.save.endless.unlocked ? 'Daily Run' : 'Daily Run 🔒', app.save.endless.unlocked ? '' : 'aria-describedby="lock-note"')}</div>
        <div class="row2">${btn('help', 'How to Play')}${btn('notebook', 'Farm Notebook')}</div>
        <div class="row2">${btn('records', 'Records')}${btn('settings', 'Settings')}</div>
        ${btn('credits', 'Credits', '', 'btn small')}
      </nav>
      ${app.save.endless.unlocked ? dailyNote(app) : '<p class="note" id="lock-note">Clear level 6 to unlock the Moonlight Run and the Daily Run.</p>'}
      ${app.storageBlocked && app.storageBlocked() ? '<p class="note warn" role="status">Progress will not be saved in this browser mode.</p>' : ''}
      ${app.saveIsNewer && app.saveIsNewer() && !app.newerSeen ? '<p class="note warn" id="newer-note">' + esc(app.newerNote) + '</p>' : ''}
      <p class="brand">Hot Springs Games</p>
      <p class="fineprint">${FICTION_SHORT}</p>
    </div>`,

  map: (app, { levels }) => `
    <canvas class="mist" aria-hidden="true"></canvas>
    <div class="panel wide" role="dialog" aria-label="Farm map">
      <h2>The Farm</h2>
      <p class="sub">Follow the trail from Whittington Ave., Hot Springs, to the midnight raid. Pick a level. Farm layout imagined for the game.</p>
      <div class="zones">${[1, 2, 3, 4, 5].map((z) => `
        <section class="zone z${z}${levels.some((L) => L.zone === z && L.n <= app.save.unlocked) ? ' walked' : ''}"><h3>${z}. ${ZONES[z]}</h3><p class="place">${PLACES[z]}</p><div class="lvls">${levels.filter((L) => L.zone === z).map((L) => {
          const open = L.n <= app.save.unlocked, pr = app.save.progress[L.id];
          return `<button type="button" class="lvl ${open ? 'open' : ''}" data-act="${open ? 'level' : 'locked'}" data-v="${L.id}" ${open ? '' : 'disabled'} ${L.n === Math.min(app.save.unlocked, 15) ? 'autofocus' : ''}
            aria-label="Level ${L.n}: ${esc(L.name)}${open ? (pr ? `, ${pr.stars.filter(Boolean).length} stars${pr.ball ? ', ball found' : ''}` : ', not played') : `, locked. Clear level ${L.n - 1} first`}">
            <span class="n">${L.n}</span><span class="nm">${esc(L.name)}</span><span class="st">${open ? (pr ? stars(pr.stars) : stars([false, false, false])) : '🔒'}</span>${pr && pr.ball ? '<span class="ballmark" aria-hidden="true">⚾</span>' : ''}</button>`;
        }).join('')}</div></section>`).join('')}
      </div>
      <nav class="menu row">${btn('back', 'Back', 'data-back')}</nav>
    </div>`,

  intro: (app, { L, fact, assist }) => `
    <div class="panel" role="dialog" aria-label="Level ${L.n}">
      <p class="kicker">${L.zone ? `Zone ${L.zone} · ${ZONES[L.zone]}` : 'Moonlight Run'}</p>${L.zone ? `<p class="place">${PLACES[L.zone]}</p>` : ''}
      ${bandit(['bandit-portrait', 'raccoon-down-stand'], 'side')}
      <h2>${L.n ? `${L.n}. ` : ''}${esc(L.name)}</h2>
      <p class="lead">${esc(L.intro || '')}</p>
      <ul class="goals">${L.par ? '<li>Reach the den at the top.</li>' : ''}${L.par ? `<li>★ Bank every snack (${L.items.filter((i) => i.k === 'pecan' || i.k === 'berry').length}) · ★ Beat par ${fmt(L.par)}</li>` : '<li>Stay ahead of the keeper\'s lantern!</li>'}<li>Tail rings: ${L.rings || 3}${assist ? ' + 2 (Assist)' : ''}</li></ul>
      ${factCard(fact)}
      <nav class="menu row">${btn('go', 'Go!', 'autofocus', 'btn primary')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`,

  pause: (app) => `
    <div class="panel" role="dialog" aria-label="Paused">
      <h2>Paused</h2>
      <p class="goalline">${app.run && app.run.mode === 'endless' ? 'Goal: hop as far as you can before the lantern.' : 'Goal: reach the den. Bank snacks on the bright BANK rows.'}</p>
      <nav class="menu">${btn('resume', 'Resume', 'autofocus data-back', 'btn primary')}${btn('restart', 'Restart')}${btn('help', 'How to Play')}${btn('settings', 'Settings')}${btn('quit', app.run && app.run.mode === 'endless' ? 'Quit to title' : 'Farm map')}</nav>
    </div>`,

  win: (app, { L, res, fact, noted, next, best, assist, bestTime, earned = [], nextUp = '' }) => `
    <div class="panel" role="dialog" aria-label="Level clear">
      ${bandit(['bandit-cheer', 'raccoon-down-hop'])}
      <h2>Home free!</h2>
      <p class="kicker">${L.n}. ${esc(L.name)}</p>
      <div class="bigstars">${res.stars.map((b, i) => `<span class="bs ${b ? 'on' : ''}" style="--i:${i}" aria-hidden="true">★<small>${['Den', 'Snacks', 'Par'][i]}</small></span>`).join('')}</div>
      <p class="sr-only">${res.stars.filter(Boolean).length} of 3 stars</p>
      <ul class="breakdown">
        <li><span>Rows hopped${res.breakdown.bestMult > 1 ? ` (best ×${res.breakdown.bestMult})` : ''}</span><b>+${res.breakdown.rows}</b></li>
        ${res.breakdown.snacks ? `<li><span>Snacks banked (${res.breakdown.snackN}${res.breakdown.washedN ? `, ${res.breakdown.washedN} washed ×2` : ''})</span><b>+${res.breakdown.snacks}</b></li>` : ''}
        ${res.breakdown.capPts ? `<li><span>Caps (${res.breakdown.caps})</span><b>+${res.breakdown.capPts}</b></li>` : ''}
        ${res.breakdown.ballPts ? `<li><span>Lost ball</span><b>+${res.breakdown.ballPts}</b></li>` : ''}
        <li><span>Den reached</span><b>+${res.breakdown.clear}</b></li>
        <li><span>Time ${fmt(res.t)} (par ${fmt(res.par)})${bestTime ? ' · new best time!' : ''}</span><b>+${res.breakdown.time}</b></li>
        ${res.breakdown.noDeath ? `<li><span>No rings lost</span><b>+${res.breakdown.noDeath}</b></li>` : ''}
        <li class="tot"><span>Score${best ? ' · new best!' : ''}</span><b>${res.score.toLocaleString('en-US')}</b></li>
      </ul>
      <p class="stars-why">${['Cleared', res.stars[1] ? 'All snacks home' : 'Snacks left behind', assist ? 'Par star off with Assist' : res.stars[2] ? 'Beat par' : 'Over par'].join(' · ')}</p>
      ${earned.length ? `<p class="found">★ Achievement${earned.length > 1 ? 's' : ''}: ${earned.map((a) => esc(achName(a))).join(', ')}</p>` : ''}
      ${res.ball ? '<p class="found">⚾ You found the lost 1918 home-run ball! <small>(A game nod to Babe Ruth\'s real 1918 homer into the farm.)</small></p>' : ''}
      ${res.ticket ? '<p class="found">🎟 Merman ticket! Check the Farm Notebook.</p>' : ''}
      ${factCard(fact)}${noted ? '<p class="found">Farm fact added to your Notebook.</p>' : ''}
      ${nextUp ? `<p class="nextup">${esc(nextUp)}</p>` : ''}
      <nav class="menu row">${next ? btn('next', 'Next level', 'autofocus', 'btn primary') : btn('map', 'Farm map', 'autofocus', 'btn primary')}${btn('restart', 'Replay')}${next ? btn('map', 'Map') : ''}</nav>
    </div>`,

  // The ending (S4-02): shown instead of the level panel when the last level is cleared
  finale: (app, { L, res, first }) => {
    const t = totals(app.save), all = t.balls >= 15;
    return `
    <div class="panel finale" role="dialog" aria-label="The end">
      <div class="finale-ball">${bandit(['bandit-cheer', 'raccoon-down-hop'])}${ballSvg(all)}</div>
      <h2>Home free, for good!</h2>
      <p class="kicker">${L.n}. ${esc(L.name)} · ${res.stars.filter(Boolean).length} of 3 stars · ${res.score.toLocaleString('en-US')} points</p>
      ${first ? '<p class="quote">Old Ruthless lowers his great jaw. "Keep the snacks, little bandit. The farm is yours tonight."</p>' : ''}
      <p class="epilogue">The lantern is out and the gators are drifting off to sleep. Bandit curls up in the den with the night's last pecan.</p>
      <p class="epilogue">${all ? 'All fifteen lost balls are home, the 1918 one too.' : `${t.balls} of 15 lost balls are home. The rest are still hiding somewhere on the farm.`}</p>
      <p class="epilogue">${t.stars >= app.LEVELS.length * 3 ? '' : 'Some stars are still waiting on the map. '}The Moonlight Run is waiting on the title screen.</p>
      <div class="totals" aria-label="Totals"><span>★ ${t.stars}/45</span><span>⚾ ${t.balls}/15</span><span>Notebook ${app.save.notebook.length}/${app.FACTS.length}</span></div>
      <nav class="menu row">${btn('credits', 'Credits', 'autofocus', 'btn primary')}${btn('map', 'Farm map')}${btn('restart', 'Replay')}</nav>
    </div>`;
  },

  fail: (app, { L, cause, offerAssist }) => `
    <div class="panel" role="dialog" aria-label="Out of rings">
      ${bandit(['bandit-sheepish', 'raccoon-down-stand'])}
      <h2>Out of tail rings!</h2>
      <p class="lead">${esc(L.name)}. ${causeText(cause, app.run && app.run.steps)}</p>
      <p class="tip">${tipFor(cause)}</p>
      ${offerAssist ? '<p class="sub" id="assist-why">Assist: slower gators, longer warnings, +2 tail rings (no par star). Turn it off again in Settings.</p>' : ''}
      <nav class="menu row">${btn('restart', 'Try again', 'autofocus', 'btn primary')}${offerAssist ? btn('assistOn', 'Try with Assist', 'aria-describedby="assist-why"') : ''}${btn('map', 'Farm map', 'data-back')}</nav>
    </div>`,

  over: (app, { res, rank, newBest, daily, earned = [], cause, seed = null }) => `
    <div class="panel" role="dialog" aria-label="Moonlight Run over">
      <h2>Run over!</h2>
      <p class="lead">${res.rows} rows · ${res.score.toLocaleString('en-US')} points. ${causeText(cause, app.run && app.run.steps)}</p>
      <p class="tip">${tipFor(cause)}</p>
      ${newBest ? '<p><span class="newbest">New personal best!</span></p>' : ''}
      ${seed != null ? `<p class="course">Course ${seed}. The same number is always the same night.</p>` : ''}
      ${daily ? `<p class="dailyline">Daily Run, ${esc(dayLabel(daily.key))}: best today ${daily.best.rows} rows, ${daily.best.score.toLocaleString('en-US')} points${daily.newBest && !daily.first ? ' · new best today!' : ''}. ${daily.streak}-day streak.</p>` : ''}
      ${earned.length ? `<p class="found">★ Achievement${earned.length > 1 ? 's' : ''}: ${earned.map((a) => esc(achName(a))).join(', ')}</p>` : ''}
      ${rank >= 0 ? `<form class="initials" data-form="initials"><label for="ini">Top ten! Your initials</label><input id="ini" maxlength="3" autocomplete="off" spellcheck="false" value="${esc(app.save.lastInitials || '')}" aria-describedby="ini-help"><small id="ini-help">Up to 3 letters</small>${btn('saveScore', 'Save score', '', 'btn primary')}</form>` : ''}
      <nav class="menu row">${btn(daily ? 'daily' : 'endless', 'Run again', rank >= 0 ? '' : 'autofocus', rank >= 0 ? 'btn' : 'btn primary')}${seed != null ? btn('sameCourse', 'Run this course again') : ''}${btn('scores', 'High scores')}${btn('title', 'Title', 'data-back')}</nav>
    </div>`,

  scores: (app) => `
    <div class="panel" role="dialog" aria-label="Moonlight Run high scores">
      <h2>Moonlight Run · Top 10</h2>
      <ol class="scores">${app.save.endless.top.length ? app.save.endless.top.map((s) => `<li><b>${esc(s.initials)}</b><span>${s.rows} rows</span><span>${s.score.toLocaleString('en-US')}</span><small>${esc(s.date)}</small></li>`).join('') : '<li class="empty">No runs yet.</li>'}</ol>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,

  // Records (S3-05): what the save knows. Levels, bests, the Moonlight Run, the daily streak and calendar.
  records: (app, data) => {
    const s = app.save, t = totals(s), d = s.endless.daily, today = app.today(), streak = dailyStreak(d, today);
    const days = Array.from({ length: 14 }, (_, i) => shiftDay(today, i - 13));
    return `
    <div class="panel wide" role="dialog" aria-label="Records">
      <h2>Records</h2>
      <div class="recgrid">
        <div class="rec"><b>${t.cleared}/${app.LEVELS.length}</b><span>Levels cleared</span></div>
        <div class="rec"><b>${t.stars}/${app.LEVELS.length * 3}</b><span>Stars</span></div>
        <div class="rec"><b>${t.balls}/${app.LEVELS.length}</b><span>Lost balls</span></div>
        <div class="rec"><b>${s.stats.treats}</b><span>Snacks banked</span></div>
        <div class="rec"><b>${s.stats.hops.toLocaleString('en-US')}</b><span>Hops</span></div>
        <div class="rec"><b>${s.stats.runs}</b><span>Runs played</span></div>
        <div class="rec"><b>${s.stats.chomps}</b><span>Times chomped</span></div>
        <div class="rec"><b>${s.stats.splashes}</b><span>Splashes</span></div>
      </div>
      <h3>Campaign bests</h3>
      <table class="bests"><thead><tr><th>Lv</th><th>Level</th><th>Best score</th><th>Best time</th></tr></thead><tbody>${app.LEVELS.map((L) => {
        const pr = s.progress[L.id];
        return `<tr><td>${L.n}</td><td>${esc(L.name)} ${pr ? stars(pr.stars) : ''}</td><td>${pr ? pr.best.toLocaleString('en-US') : '–'}</td><td>${pr && pr.bestT != null ? fmt(pr.bestT) : '–'}</td></tr>`;
      }).join('')}</tbody></table>
      <h3>Moonlight Run</h3>
      <div class="recgrid">
        <div class="rec"><b>${s.endless.bestRows}</b><span>Best rows</span></div>
        <div class="rec"><b>${s.endless.bestScore.toLocaleString('en-US')}</b><span>Best score</span></div>
        <div class="rec"><b>${streak}</b><span>Daily streak (days)</span></div>
        <div class="rec"><b>${d.bestStreak}</b><span>Best daily streak</span></div>
      </div>
      <p class="sub">${s.endless.unlocked ? 'The last 14 days of the Daily Run. Green days were played.' : 'Clear level 6 to unlock the Daily Run.'}</p>
      <div class="cal" role="img" aria-label="Daily Run calendar, last 14 days: ${days.filter((k) => d.hist[k]).length} played">${days.map((k) => `<span class="${d.hist[k] ? 'hit' : ''} ${k === today ? 'today' : ''}" title="${esc(dayLabel(k))}">${k.slice(8).replace(/^0/, '')}${d.hist[k] ? '✓' : ''}</span>`).join('')}</div>
      <nav class="menu row">${btn('trophies', 'Achievements and costumes', 'autofocus', 'btn primary')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`;
  },

  trophies: (app) => {
    const s = app.save, got = ACHIEVEMENTS.filter((a) => s.ach[a.id]).length, cur = activeCostume(s);
    return `
    <div class="panel wide" role="dialog" aria-label="Achievements and costumes">
      <h2>Bandit's costumes</h2>
      <p class="sub">Costumes are earned with stars, balls and rows. Tap one to wear it.</p>
      <div class="wardrobe">${COSTUMES.map((c) => { const open = costumeUnlocked(s, c.id); return `<button type="button" class="btn small" data-act="${open ? 'costume' : 'locked'}" data-v="${c.id}" ${open ? '' : 'disabled'} aria-pressed="${cur === c.id}"><span>${esc(c.name)}</span><small>${open ? (cur === c.id ? 'Wearing it' : 'Tap to wear') : esc(c.how) + ' (' + esc(c.need(s)) + ')'}</small></button>`; }).join('')}</div>
      <h3>Achievements</h3>
      <p class="sub">${got} of ${ACHIEVEMENTS.length} earned. Each one is earned by playing.</p>
      <ul class="ach">${ACHIEVEMENTS.map((a) => `<li class="${s.ach[a.id] ? '' : 'off'}"><span class="mk" aria-hidden="true">${s.ach[a.id] ? '★' : '?'}</span><span><b>${esc(a.name)}</b><small>${esc(a.how)}${s.ach[a.id] ? (s.ach[a.id] === 'before' ? ' Earned earlier.' : ' Earned ' + esc(s.ach[a.id]) + '.') : ' Not yet.'}</small></span></li>`).join('')}</ul>
      <nav class="menu row">${btn('records', 'Records', 'data-back')}${btn('title', 'Title')}</nav>
    </div>`;
  },

  help: () => `
    <div class="panel wide" role="dialog" aria-label="How to play">
      <h2>How to Play</h2>
      <p class="goalline">Goal: reach the den at the top. Bank snacks on the bright BANK rows, and beat par for the third star.</p>
      <div class="cols">
        <section><h3>Move</h3><p><b>Arrows</b> / <b>WASD</b>, the <b>d-pad</b>, or <b>tap</b> beside Bandit to hop that way (<b>swipes</b> work too). One hop = one tile.</p>
          <h3>Stars</h3><p>★ Reach the den · ★ Bank every snack · ★ Beat par. Find the hidden ⚾ in every level.</p>
          <h3>Tail rings</h3><p>Each splash, chomp or sweep off the edge costs a ring. You restart at the last checkpoint.</p>
          <h3>Sound</h3><p>Listen for the warning pop before a gator bites. Each surface sounds different underfoot.</p></section>
        <section><h3>Snacks</h3><p>Grab pecans and berries (paws hold 3). Bank them at the <b>bright BANK rows</b> or the den: snacks only count once banked. Dunk them in a <b>steaming spring stone</b> first to wash them for double points.</p>
          <h3>Lure</h3><p><b>Space</b> / <b>E</b> / <b>Lure</b> button tosses a drumstick two rows ahead (and three tiles to the side you last hopped). A dashed ring shows the spot. Gators rush to it.</p>
          <h3>Gators</h3><ul>
          <li><b>Paddlers</b>: ride their backs across the water. Heads bite when the jaws open. A <b>⚠!</b> badge warns first.</li>
          <li><b>Whippers</b> (gold stripes): land on the tail and get flung two rows!</li>
          <li><b>Hatchlings</b>: banded mouths, can't bite, but they shove.</li>
          <li><b>Baskers</b> gape on the sand: closed mouth bumps you back, open mouth bites.</li>
          <li><b>Sleepers</b> in the barn: when the eye opens, they lunge a tile.</li></ul></section>
      </div>
      <p class="fineprint">Game rules are made up for fun; the farm and its gators are real (see the Farm Notebook).</p>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,

  settings: (app) => {
    const s = app.save.settings;
    return `
    <div class="panel" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      ${field('Sound', seg('sound', s.sound, [[true, 'On'], [false, 'Off']]))}
      ${field('Music', seg('music', s.music, [[true, 'On'], [false, 'Off']]))}
      ${field('Ambience', seg('ambience', s.ambience, [[true, 'On'], [false, 'Off']]))}
      ${field('Volume', volSeg(s.volume))}
      ${navigator.vibrate ? field('Vibration', seg('vibration', s.vibration, [[true, 'On'], [false, 'Off']])) + '<p class="sub">A short buzz on landings, bites, banking and wins. Off when motion is reduced.</p>' : ''}
      ${field('Motion', seg('reducedMotion', s.reducedMotion, [[null, 'System'], [false, 'Full'], [true, 'Reduced']]))}
      ${field('Text size', seg('textScale', s.textScale, [[1, '100%'], [1.25, '125%'], [1.5, '150%'], [1.75, '175%']]))}
      ${field('Lure button', seg('lureSide', s.lureSide, [['right', 'Right'], ['left', 'Left']]))}
      <p class="sub">Which side of the screen the Lure button sits on, for left-handed play.</p>
      ${field('Phone view', seg('view', s.view, [['close', 'Close'], ['standard', 'Standard'], ['wide', 'Wide']]))}
      <p class="sub">Phone view: how much of the board shows when the phone is held upright. Wide shows every column.</p>
      ${field('First-run tips', seg('tipsOn', s.tipsOn, [[true, 'On'], [false, 'Off']]))}
      <p class="sub">Short hints in the first levels. ${btn('tipsAgain', 'Show tips again', '', 'btn small')}</p>
      ${field('Hints', seg('hints', s.hints, [[true, 'On'], [false, 'Off']]))}
      <p class="sub">The reminder of how to hop, shown at the start of level 1.</p>
      ${field('Hold to hop', seg('holdHop', s.holdHop, [[false, 'Off'], [true, 'On']]))}
      <p class="sub">Keep a direction key or pad direction held to keep hopping across open ground. It stops at water, walls and gators.</p>
      ${field('Picture detail', seg('quality', s.quality, [['auto', 'Auto'], ['full', 'Full'], ['light', 'Light']]))}
      <p class="sub">Auto lightens the night glow and the sparkles only when the game is running slowly. Light always does; Full never does.</p>
      ${field('Assist', seg('assist', s.assist, [[false, 'Off'], [true, 'On']]))}
      <p class="sub">Assist: slower gators, longer warnings, +2 tail rings (no par star).</p>
      <nav class="menu row">${btn('back', 'Done', 'autofocus data-back', 'btn primary')}${btn('resetSave', 'Reset progress', 'data-confirm="1"', 'btn small danger')}</nav>
    </div>`;
  },

  confirmReset: () => `
    <div class="panel" role="alertdialog" aria-label="Reset progress?">
      <h2>Reset progress?</h2><p class="lead">Stars, unlocks, the Notebook and high scores will be erased.</p>
      <nav class="menu row">${btn('back', 'Keep my progress', 'autofocus data-back', 'btn primary')}${btn('resetYes', 'Erase', '', 'btn danger')}</nav>
    </div>`,

  confirmQuit: () => `
    <div class="panel" role="alertdialog" aria-label="Leave this run?">
      <h2>Leave this run?</h2><p class="lead">Your Moonlight Run will end and this score will not be saved.</p>
      <nav class="menu row">${btn('back', 'Keep running', 'autofocus data-back', 'btn primary')}${btn('quitYes', 'Leave', '', 'btn danger')}</nav>
    </div>`,

  notebook: (app, { facts }) => `
    <div class="panel wide" role="dialog" aria-label="Farm Notebook">
      <h2>Farm Notebook</h2>
      <p class="sub">Real facts about the farm, its gators and raccoons. You collect a new card each time you clear a level. ${app.save.notebook.length}/${facts.length} found.</p>
      <div class="cards">${facts.map((f) => app.save.notebook.includes(f.id) ? `<article class="card"><p>${esc(f.text)}</p><small>${esc(f.source)}</small></article>` : '<article class="card locked" aria-label="Locked fact"><p>?</p><small>Clear a level to find it</small></article>').join('')}
        ${app.save.merman ? `<article class="card legend"><b>The Merman (legend)</b><p>The farm's barn keeps a stuffed "half-fish, half-monkey" in a tank. The sign says it was caught about 500 miles off Hong Kong. It's a classic sideshow gaff, but a beloved one.</p><small>RoadsideAmerica; Encyclopedia of Arkansas</small></article>` : '<article class="card locked" aria-label="Locked legend card"><p>🎟?</p><small>Find the ticket in level 9</small></article>'}
      </div>
      <p class="sub">Balls found: ${Object.values(app.save.progress).filter((p) => p.ball).length}/15 ⚾</p>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,

  credits: () => `
    <div class="panel" role="dialog" aria-label="Credits">
      <h2>Credits</h2>
      <p><b>Crazy Raccoon: Gator Farm Dash</b>, a Hot Springs Games original. MIT License.</p>
      <p>${FICTION} Bandit and Old Ruthless are made up. Facts come from the Encyclopedia of Arkansas, the Arkansas Democrat-Gazette, RoadsideAmerica, Smithsonian's National Zoo, the Arkansas Game and Fish Commission and the National Wildlife Federation (see the Farm Notebook).</p>
      <p>Code and music made for this game; engine pieces shared from other Hot Springs Games titles. Sound is synthesized live in your browser.</p>
      <p>Art: 3D block-outs painted with AI image tools for this game.</p>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,
};

// Three lines for each way to lose (S4-07). The first words of every line are the plain cause; `n` picks the line, and the panels pass
// the run's step count, so a panel keeps its line when it is drawn again and the next failure usually reads differently.
export const CAUSE_LINES = {
  chomp: ['Chomped!', 'Chomped! Those jaws are quick.', 'Chomped! Snap, and that was that.'],
  splash: ['Splash!', 'Splash! The water wins that one.', 'Splash! Bandit is soaked, and not pleased.'],
  swept: ['Swept off the edge!', 'Swept off the edge! The ride kept going without you.', 'Swept off the edge! Hop off before the edge.'],
  spotted: ['Spotted by the keeper!', 'Spotted by the keeper! Stay out of the beam.', 'Spotted by the keeper! Bandit froze a moment too late.'],
  caught: ['The lantern caught up!', 'The lantern caught up! Keep moving.', 'The lantern caught up! No time to stop and sniff.'],
};
function causeText(c, n = 0) { const l = CAUSE_LINES[c]; return l ? l[Math.abs(n | 0) % l.length] : ''; }
function tipFor(c) {
  return {
    chomp: 'Tip: when the ⚠! badge pops up, jaws open soon. Ride the back half of a gator.',
    splash: 'Tip: wait for a gator to slide under your column before hopping onto the water.',
    swept: 'Tip: hop forward or sideways before your ride carries you off the edge.',
    spotted: 'Tip: flashlight beams sweep side to side. Cross right behind one.',
    caught: 'Tip: the lantern never stops climbing. Keep hopping, and grab a snack only when it is on your way.',
  }[c] || 'Tip: rhythmic hops build your score multiplier.';
}
export { esc };
