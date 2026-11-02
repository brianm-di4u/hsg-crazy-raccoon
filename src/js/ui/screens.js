// Menu screens (DOM). Every action is a real <button>; arrow keys / d-pad move focus, Enter / A confirms, Esc / B
// goes back. Structure after games/Furious Squirrels/src/js/ui/screens.js (Hot Springs Games, MIT).
import { fmt } from './hud.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const btn = (act, label, extra = '', cls = 'btn') => `<button type="button" class="${cls}" data-act="${act}" ${extra}>${label}</button>`;
const seg = (k, cur, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="btn small" data-act="set" data-k="${k}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
const field = (label, inner) => `<div class="field"><span class="flabel">${label}</span>${inner}</div>`;
const stars = (st) => `<span class="stars" aria-label="${st.filter(Boolean).length} of 3 stars">${st.map((b) => (b ? '★' : '<span class="off">☆</span>')).join('')}</span>`;
export const FICTION = 'A made-up raccoon caper at a real Hot Springs landmark. Not affiliated with the Arkansas Alligator Farm and Petting Zoo.';
const ZONES = ['', 'Front Pits', 'Hatchling Nursery', 'Noon Feeding Show', 'Winter Barn', 'Midnight Raid'];
/* global MANIFEST */
const MAN = typeof MANIFEST !== 'undefined' && !/[?&]art=0/.test(location.search) ? MANIFEST : {};
// a painted Bandit pose for a screen, falling back through the poses that exist
const bandit = (names, cls = '') => { const n = names.find((k) => MAN[k]); return n ? `<img class="portrait ${cls}" src="assets/${MAN[n].file}" alt="" aria-hidden="true">` : ''; };
const factCard = (f) => f ? `<aside class="fact"><b>Farm fact</b><p>${esc(f.text)}</p><small>Source: ${esc(f.source)}</small></aside>` : '';

export class Screens {
  constructor(root, app) { this.root = root; this.app = app; this.cur = null; this.data = {}; this.trans = 0; }
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
        ${btn('endless', app.save.endless.unlocked ? 'Moonlight Run' : 'Moonlight Run 🔒', app.save.endless.unlocked ? '' : 'aria-describedby="lock-note"')}
        <div class="row2">${btn('help', 'How to Play')}${btn('notebook', 'Farm Notebook')}</div>
        <div class="row2">${btn('settings', 'Settings')}${btn('credits', 'Credits')}</div>
      </nav>
      ${app.save.endless.unlocked ? '' : '<p class="note" id="lock-note">Clear level 6 to unlock the Moonlight Run.</p>'}
      <p class="brand">Hot Springs Games</p>
      <p class="fineprint">${FICTION}</p>
    </div>`,

  map: (app, { levels }) => `
    <div class="panel wide" role="dialog" aria-label="Farm map">
      <h2>The Farm</h2>
      <p class="sub">Pick a level. Farm layout imagined for the game.</p>
      <div class="zones">${[1, 2, 3, 4, 5].map((z) => `
        <section class="zone z${z}"><h3>${z}. ${ZONES[z]}</h3><div class="lvls">${levels.filter((L) => L.zone === z).map((L) => {
          const open = L.n <= app.save.unlocked, pr = app.save.progress[L.id];
          return `<button type="button" class="lvl" data-act="${open ? 'level' : 'locked'}" data-v="${L.id}" ${open ? '' : 'disabled'} ${L.n === Math.min(app.save.unlocked, 15) ? 'autofocus' : ''}
            aria-label="Level ${L.n}: ${esc(L.name)}${open ? (pr ? `, ${pr.stars.filter(Boolean).length} stars${pr.ball ? ', ball found' : ''}` : ', not played') : ', locked'}">
            <span class="n">${L.n}</span><span class="nm">${esc(L.name)}</span><span class="st">${open ? (pr ? stars(pr.stars) : stars([false, false, false])) : '🔒'}</span>${pr && pr.ball ? '<span class="ballmark" aria-hidden="true">⚾</span>' : ''}</button>`;
        }).join('')}</div></section>`).join('')}
      </div>
      <nav class="menu row">${btn('back', 'Back', 'data-back')}</nav>
    </div>`,

  intro: (app, { L, fact, assist }) => `
    <div class="panel" role="dialog" aria-label="Level ${L.n}">
      <p class="kicker">${L.zone ? `Zone ${L.zone} · ${ZONES[L.zone]}` : 'Moonlight Run'}</p>
      ${bandit(['bandit-portrait', 'raccoon-down-stand'], 'side')}
      <h2>${L.n ? `${L.n}. ` : ''}${esc(L.name)}</h2>
      <p class="lead">${esc(L.intro || '')}</p>
      <ul class="goals"><li>Reach the den at the top.</li>${L.par ? `<li>★ Bank every snack (${L.items.filter((i) => i.k === 'pecan' || i.k === 'berry').length}) · ★ Beat par ${fmt(L.par)}</li>` : '<li>Stay ahead of the keeper\'s lantern!</li>'}<li>Tail rings: ${L.rings || 3}${assist ? ' + 2 (Assist)' : ''}</li></ul>
      ${factCard(fact)}
      <nav class="menu row">${btn('go', 'Go!', 'autofocus', 'btn primary')}${btn('back', 'Back', 'data-back')}</nav>
    </div>`,

  pause: (app) => `
    <div class="panel" role="dialog" aria-label="Paused">
      <h2>Paused</h2>
      <nav class="menu">${btn('resume', 'Resume', 'autofocus data-back', 'btn primary')}${btn('restart', 'Restart')}${btn('help', 'How to Play')}${btn('settings', 'Settings')}${btn('quit', app.run && app.run.mode === 'endless' ? 'Quit to title' : 'Farm map')}</nav>
    </div>`,

  win: (app, { L, res, fact, next, best, assist }) => `
    <div class="panel" role="dialog" aria-label="Level clear">
      ${bandit(['bandit-cheer', 'raccoon-down-hop'])}
      <h2>Home free!</h2>
      <p class="kicker">${L.n}. ${esc(L.name)}</p>
      <div class="bigstars">${res.stars.map((b, i) => `<span class="bs ${b ? 'on' : ''}" style="--i:${i}" aria-hidden="true">★<small>${['Den', 'Snacks', 'Par'][i]}</small></span>`).join('')}</div>
      <p class="sr-only">${res.stars.filter(Boolean).length} of 3 stars</p>
      <ul class="breakdown">
        <li><span>Den reached</span><b>+${res.breakdown.clear}</b></li>
        <li><span>Time ${fmt(res.t)} (par ${fmt(res.par)})</span><b>+${res.breakdown.time}</b></li>
        ${res.breakdown.noDeath ? `<li><span>No rings lost</span><b>+${res.breakdown.noDeath}</b></li>` : ''}
        <li class="tot"><span>Score${best ? ' · new best!' : ''}</span><b>${res.score.toLocaleString('en-US')}</b></li>
      </ul>
      <p class="stars-why">${['Cleared', res.stars[1] ? 'All snacks home' : 'Snacks left behind', assist ? 'Par star off with Assist' : res.stars[2] ? 'Beat par' : 'Over par'].join(' · ')}</p>
      ${res.ball ? '<p class="found">⚾ You found the lost 1918 home-run ball! <small>(A game nod to Babe Ruth\'s real 1918 homer into the farm.)</small></p>' : ''}
      ${res.ticket ? '<p class="found">🎟 Merman ticket! Check the Farm Notebook.</p>' : ''}
      ${factCard(fact)}
      <nav class="menu row">${next ? btn('next', 'Next level', 'autofocus', 'btn primary') : btn('map', 'Farm map', 'autofocus', 'btn primary')}${btn('restart', 'Replay')}${next ? btn('map', 'Map') : ''}</nav>
    </div>`,

  fail: (app, { L, cause }) => `
    <div class="panel" role="dialog" aria-label="Out of rings">
      ${bandit(['bandit-sheepish', 'raccoon-down-stand'])}
      <h2>Out of tail rings!</h2>
      <p class="lead">${esc(L.name)}. ${causeText(cause)}</p>
      <p class="tip">${tipFor(cause)}</p>
      <nav class="menu row">${btn('restart', 'Try again', 'autofocus', 'btn primary')}${btn('map', 'Farm map', 'data-back')}</nav>
    </div>`,

  over: (app, { res, rank }) => `
    <div class="panel" role="dialog" aria-label="Moonlight Run over">
      <h2>Lantern caught you!</h2>
      <p class="lead">${res.rows} rows · ${res.score.toLocaleString('en-US')} points</p>
      ${rank >= 0 ? `<form class="initials" data-form="initials"><label for="ini">Top ten! Your initials</label><input id="ini" maxlength="3" autocomplete="off" spellcheck="false" value="${esc(app.save.lastInitials || '')}" aria-describedby="ini-help"><small id="ini-help">Up to 3 letters</small>${btn('saveScore', 'Save score', '', 'btn primary')}</form>` : ''}
      <nav class="menu row">${btn('endless', 'Run again', rank >= 0 ? '' : 'autofocus', rank >= 0 ? 'btn' : 'btn primary')}${btn('scores', 'High scores')}${btn('title', 'Title', 'data-back')}</nav>
    </div>`,

  scores: (app) => `
    <div class="panel" role="dialog" aria-label="Moonlight Run high scores">
      <h2>Moonlight Run · Top 10</h2>
      <ol class="scores">${app.save.endless.top.length ? app.save.endless.top.map((s) => `<li><b>${esc(s.initials)}</b><span>${s.rows} rows</span><span>${s.score.toLocaleString('en-US')}</span><small>${esc(s.date)}</small></li>`).join('') : '<li class="empty">No runs yet.</li>'}</ol>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,

  help: () => `
    <div class="panel wide" role="dialog" aria-label="How to play">
      <h2>How to Play</h2>
      <div class="cols">
        <section><h3>Move</h3><p><b>Arrows</b> / <b>WASD</b>, the <b>d-pad</b>, or <b>tap</b> beside Bandit to hop that way (<b>swipes</b> work too). One hop = one tile.</p>
          <h3>Gators</h3><ul>
          <li><b>Paddlers</b>: ride their backs across the water. Heads bite when the jaws open. A <b>⚠!</b> badge warns first.</li>
          <li><b>Whippers</b> (gold stripes): land on the tail and get flung two rows!</li>
          <li><b>Hatchlings</b>: banded mouths, can't bite, but they shove.</li>
          <li><b>Baskers</b> gape on the sand: closed mouth bumps you back, open mouth bites.</li>
          <li><b>Sleepers</b> in the barn: when the eye opens, they lunge a tile.</li></ul></section>
        <section><h3>Snacks</h3><p>Grab pecans and berries (paws hold 3). Bank them at <b>bright checkpoint rows</b> or the den. Dunk them in a <b>steaming spring stone</b> first to wash them for double points.</p>
          <h3>Lure</h3><p><b>Space</b> / <b>E</b> / <b>Lure</b> button tosses a drumstick two rows ahead (and three tiles to the side you last hopped). Gators rush to it.</p>
          <h3>Tail rings</h3><p>Each splash, chomp or sweep off the edge costs a ring. You restart at the last checkpoint.</p>
          <h3>Stars</h3><p>★ Reach the den · ★ Bank every snack · ★ Beat par. Find the hidden ⚾ in every level.</p></section>
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
      ${field('Volume', seg('volume', s.volume, [[0.25, 'Low'], [0.5, 'Medium'], [0.85, 'High']]))}
      ${field('Motion', seg('reducedMotion', s.reducedMotion, [[null, 'System'], [false, 'Full'], [true, 'Reduced']]))}
      ${field('Text size', seg('textScale', s.textScale, [[1, '100%'], [1.25, '125%'], [1.5, '150%']]))}
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

  notebook: (app, { facts }) => `
    <div class="panel wide" role="dialog" aria-label="Farm Notebook">
      <h2>Farm Notebook</h2>
      <p class="sub">Real facts about the farm, its gators and raccoons. You collect a new card each time you clear a level. ${app.save.notebook.length}/${facts.length} found.</p>
      <div class="cards">${facts.map((f) => app.save.notebook.includes(f.id) ? `<article class="card"><p>${esc(f.text)}</p><small>${esc(f.source)}</small></article>` : '<article class="card locked" aria-label="Locked fact"><p>?</p></article>').join('')}
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
      <p>Code, art and music made for this game; engine pieces shared from other Hot Springs Games titles. Sound is synthesized live in your browser.</p>
      <nav class="menu row">${btn('back', 'Back', 'autofocus data-back')}</nav>
    </div>`,
};

function causeText(c) { return { chomp: 'Chomped!', splash: 'Splash!', swept: 'Swept off the edge!', spotted: 'Spotted by the keeper!', caught: 'The lantern caught up!' }[c] || ''; }
function tipFor(c) {
  return {
    chomp: 'Tip: when the ⚠! badge pops up, jaws open soon. Ride the back half of a gator.',
    splash: 'Tip: wait for a gator to slide under your column before hopping onto the water.',
    swept: 'Tip: hop forward or sideways before your ride carries you off the edge.',
    spotted: 'Tip: flashlight beams sweep side to side. Cross right behind one.',
  }[c] || 'Tip: rhythmic hops build your score multiplier.';
}
export { esc };
