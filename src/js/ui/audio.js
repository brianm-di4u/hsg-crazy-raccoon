// Sound: WebAudio synthesis only (no audio files). Starts on the first key or touch (autoplay rules), quiet by
// default and mutable. Buses, tone/noise primitives and the cues are adapted from games/Cart Racing/src/js/ui/audio.js
// (itself after hsg-fishing; Hot Springs Games, MIT). Music and ambience: the Hot Springs Games audio kit
// (generative scores written as data, ambience beds with sparse one-shots), with this game's own scores and scenes.

let ctx = null, master = null, sfxBus = null, mixBus = null, noiseBuf = null, kit = null;
const state = { on: true, music: true, amb: true, vol: 0.5, started: false, theme: null, scene: null, playing: null, playingScene: null, tension: 0, hold: false, suspended: false, cues: [], cueVol: 0 };

// What the music and ambience buses are set to when their setting is on (the scores and scenes are written to the
// levels the mix targets, measured by audioRender: music peaks 0.06 to 0.16, ambience under 0.07).
const MUSIC_LEVEL = 1, AMB_LEVEL = 1;
// The master gain is the Volume setting times MASTER_K (old value 0.5, S5-03 and CL-01); a limiter follows it so the music, the
// ambience and the loudest cue together never clip, even with every volume control at its maximum. audioRender builds
// the same chain, so its numbers are what the speakers get.
const MASTER_K = 1.4, SHIPPED_VOLUME = 0.5;
// After the compressor, a soft clip: straight up to 0.6, then folded smoothly under SOFT_TOP (old value 0.92; then 0.84 still let the oversampled
// output ring about 14 percent above the curve: 0.9322 in 320 renders; at 0.80 the worst of 320 renders is 0.911). The compressor needs a few
// milliseconds to react, so on its own a burst of cues at full volume gets through it; this catches what it lets by.
const SOFT_TOP = 0.80;
const SOFT_CLIP = (() => {
  const n = 2049, k = SOFT_TOP - 0.6, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a <= 0.6 ? a : 0.6 + k * Math.tanh((a - 0.6) / k)); }
  return curve;
})();
function makeMaster(c, dest, gain) {
  const m = c.createGain(); m.gain.value = gain;
  let tail = dest;
  if (c.createWaveShaper) { const sh = c.createWaveShaper(); sh.curve = SOFT_CLIP; sh.oversample = '2x'; sh.connect(dest); tail = sh; }
  if (c.createDynamicsCompressor) {
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 4; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.15;
    m.connect(lim); lim.connect(tail);
  } else m.connect(tail);
  return m;
}

export function initAudio(settings) {
  state.on = settings.sound !== false; state.music = settings.music !== false; state.amb = settings.ambience !== false; state.vol = settings.volume ?? 0.5;
  // Touch browsers grant audio activation on pointerup, touchend or click, not pointerdown, and iOS can later move
  // the context to 'interrupted'. The listeners stay attached and retry resume() until the context is running.
  const start = () => { if (!ctx) unlock(); else wake(); };
  for (const type of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) window.addEventListener(type, start);
}

// Ask a suspended or interrupted context to run again (a no-op while running, or while the tab is hidden).
function wake() {
  if (!ctx || state.suspended || ctx.state === 'running') return;
  try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* retried on the next gesture */ }
}

let ranBefore = false, broke = false;
function unlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // An unexpected stop (an interruption, not our own suspend) means the clock paused mid-bar: start the piece afresh
    // when it runs again.
    ctx.onstatechange = () => {
      if (!ctx) return;
      if (ctx.state === 'running') { if (broke && !state.hold) applyTheme(true); broke = false; ranBefore = true; }
      else if (ranBefore && !state.suspended) broke = true;
    };
    master = makeMaster(ctx, ctx.destination, state.on ? state.vol * MASTER_K : 0);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    mixBus = ctx.createGain(); mixBus.gain.value = 1; mixBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    state.started = true;
    try {
      kit = makeAudioKit(ctx, mixBus, { seed: (Math.random() * 4294967296) >>> 0 });
      kit.amb.set('tension', 0, 0.01);
      levels();
      applyTheme(false);
      if (state.hold) kit.hold();
      kit.start();
    } catch (e) { kit = null; }
    wake();
  } catch (e) { ctx = null; }
}

function levels() {
  if (!kit) return;
  kit.music.level(state.music ? MUSIC_LEVEL : 0);
  kit.amb.level(state.amb ? AMB_LEVEL : 0);
}

export function setAudio(settings) {
  state.on = settings.sound !== false; state.music = settings.music !== false; state.amb = settings.ambience !== false; state.vol = settings.volume ?? state.vol;
  if (!ctx) return;
  master.gain.setTargetAtTime(state.on ? state.vol * MASTER_K : 0, ctx.currentTime, 0.05);
  levels();
}
export function audioState() {
  return { started: state.started, on: state.on, music: state.music, ambience: state.amb, theme: state.theme, scene: state.scene, ctx: ctx ? ctx.state : 'none', held: state.hold, tension: +state.tension.toFixed(2), kit: !!kit, cues: state.cues.slice(), cueVol: state.cueVol, levels: kit ? { ...kit.levels(), master: +master.gain.value.toFixed(3) } : null };
}

// Every play of a cue is a little different (S5-04): playCue draws one detune (up to 25 cents) and one gain (up to 1.5 dB
// either way) and every note of that cue shares them, so an arpeggio stays in tune with itself.
let cueDetune = 1, cueGain = 1;
function tone(freq, dur, { type = 'square', vol = 0.2, at = 0, slide = 0, attack = 0.005, bus = sfxBus, filter = 0, ftype = 'lowpass', fto = 0, q = 1, trem = 0 } = {}) {
  if (!ctx) return;
  freq *= cueDetune; vol *= cueGain;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  // a filter (lowpass unless ftype says otherwise) that can sweep to `fto`, and a tremolo of `trem` Hz: the creature voices
  if (filter) {
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(filter, t); f.Q.value = q;
    if (fto) f.frequency.exponentialRampToValueAtTime(fto, t + dur);
    o.connect(f); node = f;
  }
  if (trem) {
    const m = ctx.createGain(), l = ctx.createOscillator(), d = ctx.createGain();
    m.gain.value = 0.5; l.frequency.value = trem; d.gain.value = 0.5; l.connect(d); d.connect(m.gain);
    node.connect(m); node = m; l.start(t); l.stop(t + dur + 0.02);
  }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, at = 0, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus, attack = 0.01 } = {}) {
  if (!ctx) return;
  vol *= cueGain;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.02);
}

// a note that holds its level and then lets go (the ending's chord), unlike tone(), which dies away from the start
function held(freq, dur, vol, at, type) {
  if (!ctx) return;
  freq *= cueDetune; vol *= cueGain;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.setValueAtTime(vol, t + dur - 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}

export const SFX = {
  // hop: a pitch that cycles through three notes and rises a little with the streak multiplier (S5-21), over a bright
  // tick and a scuff of push-off
  hop(n = 0, mult = 1) {
    const f = (520 + (n % 3) * 60) * Math.pow(1.05, Math.min(8, Math.max(1, mult)) - 1);
    tone(f, 0.07, { type: 'triangle', vol: 0.1, slide: 1.6 });
    tone(f * 2.01, 0.04, { type: 'sine', vol: 0.05, slide: 1.3 });
    noise(0.03, { vol: 0.08, type: 'highpass', freq: 3000, q: 0.7 });
  },
  // land: its own sound for each surface (S5-04): a soft thud on grass, a two-note wood tick on the boardwalk, a shaker
  // on sand, a clink on the path, a rustle on straw, a wet knock on a gator's back, a small splash in a pool
  land(surface = 'grass') {
    const LAND_K = { wood: 1.2, sand: 1.12, straw: 1.17, grass: 1.08, path: 1.19 }; // CL-01 follow-up: these sat 0.2056 to 0.2278 (median of 7) beside the 0.2 floor; now about 0.245 so the jitter of up to 1.5 dB cannot reach it; path (C4-04) 1.19, +1.5 dB, because its noise burst moves a single play by 0.13 to 0.42
    switch (surface) {
      case 'wood': tone(420, 0.05, { type: 'sine', vol: 0.546 * LAND_K.wood }); tone(330, 0.06, { type: 'triangle', vol: 0.473 * LAND_K.wood, at: 0.045 }); noise(0.02, { vol: 0.728 * LAND_K.wood, freq: 2200, q: 1.5 }); break;
      case 'sand': noise(0.09, { vol: 0.9 * LAND_K.sand, type: 'highpass', freq: 4200, q: 0.6 }); noise(0.05, { vol: 0.563 * LAND_K.sand, freq: 1800, q: 0.8, at: 0.03 }); break;
      case 'path': tone(1850, 0.07, { type: 'sine', vol: 0.63 * LAND_K.path }); tone(2790, 0.05, { type: 'sine', vol: 0.367 * LAND_K.path, at: 0.012 }); noise(0.025, { vol: 2.1 * LAND_K.path, freq: 3000, q: 1.5 }); break;
      case 'straw': noise(0.1, { vol: 1.219 * LAND_K.straw, freq: 2600, q: 0.5, sweep: 0.7 }); tone(180, 0.05, { type: 'sine', vol: 0.275 * LAND_K.straw }); break;
      case 'back': tone(170, 0.11, { type: 'sine', vol: 0.634, slide: 0.55 }); noise(0.08, { vol: 1.118, type: 'lowpass', freq: 800, q: 1, sweep: 0.5 }); tone(620, 0.04, { type: 'sine', vol: 0.112, slide: 0.5 }); tone(135, 0.09, { type: 'sine', vol: 0.42, slide: 0.6, at: 0.07 }); break;
      case 'wet': noise(0.2, { vol: 1.456, freq: 1800, q: 0.7, sweep: 0.45 }); tone(560, 0.1, { type: 'sine', vol: 0.218, slide: 0.5 }); break;
      default: tone(120, 0.07, { type: 'sine', vol: 1.322 * LAND_K.grass, slide: 0.7 }); noise(0.06, { vol: 1.944 * LAND_K.grass, type: 'lowpass', freq: 700, q: 0.9 });
    }
  },
  bump() { tone(140, 0.08, { type: 'square', vol: 0.06, slide: 0.7, filter: 800 }); tone(95, 0.1, { type: 'sine', vol: 0.12, slide: 0.6 }); },
  splash() { noise(0.45, { vol: 0.22, freq: 1700, q: 0.7, sweep: 0.35 }); tone(300, 0.25, { type: 'sine', vol: 0.08, slide: 0.4 }); },
  chomp() { noise(0.05, { vol: 0.28, freq: 2400, q: 2 }); tone(110, 0.12, { type: 'square', vol: 0.12, slide: 0.6, filter: 900 }); noise(0.05, { vol: 0.22, freq: 1800, q: 2, at: 0.09 }); },
  // the warning before a jaw opens: a short, dry pop
  tele() { tone(760, 0.07, { type: 'sine', vol: 0.3, slide: 0.45 }); noise(0.015, { vol: 0.25, freq: 2400, q: 1.5 }); },
  // the cast has voices (S5-17): Bandit's chitter (three short buzzy bursts with a quick tremolo), a gator's hiss, and Old
  // Ruthless's roar (two detuned saws far down, the filter closing)
  chitter() { for (let i = 0; i < 3; i++) tone(560 - i * 40, 0.07, { type: 'sawtooth', vol: 0.2, at: i * 0.09, filter: 1800, ftype: 'bandpass', q: 3, trem: 30 }); },
  hiss() { noise(0.4, { vol: 0.12, attack: 0.1, type: 'highpass', freq: 2800, q: 0.5, sweep: 2.2 }); },
  roar() { [70, 73.5].forEach((f) => tone(f, 0.9, { type: 'sawtooth', vol: 0.18, slide: 0.8, attack: 0.08, filter: 900, fto: 180 })); noise(0.5, { vol: 0.05, type: 'lowpass', freq: 500, q: 0.8 }); },
  whip() { noise(0.12, { vol: 0.2, freq: 3500, q: 1.5, sweep: 0.4 }); tone(400, 0.4, { type: 'triangle', vol: 0.08, slide: 2.2 }); },
  pickup() { [880, 1175].forEach((f, i) => tone(f, 0.08, { type: 'triangle', vol: 0.1, at: i * 0.06 })); },
  cap() { tone(1568, 0.06, { type: 'square', vol: 0.05, filter: 3000 }); tone(2093, 0.08, { type: 'square', vol: 0.04, at: 0.05, filter: 3200 }); },
  wash() { noise(0.5, { vol: 0.1, type: 'highpass', freq: 3200, q: 0.5 }); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.1, { type: 'sine', vol: 0.07, at: 0.1 + i * 0.07 })); },
  bank() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.09, at: i * 0.06 })); },
  lure() { noise(0.3, { vol: 0.1, freq: 900, q: 0.8, sweep: 2.5 }); },
  feed() { tone(392, 0.12, { type: 'square', vol: 0.06, filter: 1800 }); tone(330, 0.16, { type: 'square', vol: 0.06, at: 0.13, filter: 1800 }); },
  // swept off the edge by the current: a rush of water that falls away (S5-15)
  sweep() { noise(0.7, { vol: 0.2, freq: 2200, q: 0.6, sweep: 0.2 }); tone(240, 0.6, { type: 'sine', vol: 0.1, slide: 0.35 }); },
  // caught in the lantern's light: a low hum that swells and drops (S5-15)
  hum() { tone(146, 0.7, { type: 'sawtooth', vol: 0.1, slide: 0.8, attack: 0.15, filter: 520 }); tone(155, 0.7, { type: 'sawtooth', vol: 0.08, slide: 0.8, attack: 0.15, filter: 520 }); },
  spotted() { for (let i = 0; i < 3; i++) tone(2400 + (i % 2) * 300, 0.08, { type: 'sine', vol: 0.09, at: i * 0.08 }); },
  // a longer streak: one soft rising ping, a beat after the landing so it does not sit on top of the hop (S5-21)
  streak(m) { tone(660 * Math.pow(1.12, Math.min(8, m)), 0.14, { type: 'triangle', vol: 0.07, at: 0.08 }); },
  nudge() { tone(300, 0.06, { type: 'triangle', vol: 0.06, slide: 1.4 }); },
  ball() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.07, at: i * 0.08, filter: 2800 })); },
  menu() { tone(990, 0.04, { type: 'square', vol: 0.05, filter: 3000 }); },
  // going back or letting go (S5-10): a lower, softer blip than the menu click
  back() { tone(620, 0.06, { type: 'triangle', vol: 0.1, slide: 0.8 }); },
  // a refused press (a locked level or mode): a low, dull thud
  denied() { tone(110, 0.14, { type: 'sine', vol: 0.3, slide: 0.7 }); tone(98, 0.1, { type: 'square', vol: 0.05, filter: 500, at: 0.05 }); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.08, at: i * 0.11, filter: 2600 })); },
  fail() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, at: i * 0.16 })); },
  star(i) { tone(1047 * Math.pow(1.26, i), 0.18, { type: 'square', vol: 0.07, filter: 3000 }); },
  // rewards at the end of a level (S5-16): a new best, the par star, a fact card for the Notebook
  best() { [784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.11, at: i * 0.07 })); tone(2093, 0.5, { type: 'sine', vol: 0.06, at: 0.28 }); },
  par() { tone(1760, 0.04, { type: 'square', vol: 0.05, filter: 3000 }); tone(1760, 0.04, { type: 'square', vol: 0.05, at: 0.1, filter: 3000 }); tone(2349, 0.4, { type: 'sine', vol: 0.12, at: 0.2 }); tone(3136, 0.4, { type: 'sine', vol: 0.05, at: 0.2 }); },
  fact() { tone(1319, 0.12, { type: 'sine', vol: 0.1 }); tone(1760, 0.3, { type: 'sine', vol: 0.08, at: 0.09 }); },
  // an achievement: two bell notes and a high sparkle, a little different each time (S3-05)
  ach() {
    const j = 1 + (Math.random() - 0.5) * 0.03;
    [1319, 1760].forEach((f, i) => tone(f * j, 0.55, { type: 'sine', vol: 0.26, at: i * 0.11 }));
    tone(2637 * j, 0.8, { type: 'triangle', vol: 0.12, at: 0.11 });
    noise(0.12, { vol: 0.05, type: 'highpass', freq: 5200, q: 0.5, at: 0.1 });
  },
  // the ending (S4-02): a climbing run of notes, then a held major chord with a shimmer on top, about 4 s in all
  finale() {
    [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, 0.32, { type: 'square', vol: 0.12, at: i * 0.14, filter: 2800 }));
    [523, 659, 784, 1047].forEach((f) => { held(f, 3.2, 0.065, 1.0, 'triangle'); held(f / 2, 3.2, 0.05, 1.0, 'sine'); });
    [2093, 2637, 3136, 3951].forEach((f, i) => tone(f, 0.7, { type: 'sine', vol: 0.05, at: 1.2 + i * 0.16 }));
    noise(1.4, { vol: 0.03, type: 'highpass', freq: 4200, q: 0.5, at: 1.0 });
  },
};
// Each cue plays through its own trim (CUE_TRIM, 1 where it is not listed), so a cue's level is set in one place.
// Set by measuring each cue's peak as heard (audioRender, default volume): the typical play of a cue lands between 0.2
// and 0.45, the frequent ones (hop, land, bump, pickup, bank) near the bottom, the big events (chomp, splash, win) near
// the top, all clearly above the music (S5-03, CL-01).
const CUE_TRIM = { hop: 8.8, bump: 9, splash: 6.1, chomp: 5.5, tele: 4, whip: 6.6, pickup: 4.7, cap: 8.8, wash: 3.8, bank: 4.3, lure: 15, feed: 4.7, sweep: 2.8, hum: 2.9, spotted: 3.5,
  chitter: 5, hiss: 2.6, roar: 1.6, streak: 5.7, nudge: 24, ball: 4.8, menu: 21, back: 13.5, denied: 5, win: 4.2, fail: 4.1, star: 15, best: 3.9, par: 2.75, fact: 4.6 };
function playCue(name, args, jitter = true) {
  const g = ctx.createGain(), keep = sfxBus;
  g.gain.value = CUE_TRIM[name] ?? 1; g.connect(sfxBus); sfxBus = g;
  cueDetune = jitter && name !== 'finale' ? Math.pow(2, (Math.random() * 2 - 1) * 25 / 1200) : 1;
  cueGain = jitter ? Math.pow(10, (Math.random() * 2 - 1) * 1.5 / 20) : 1;
  try { SFX[name](...args); } finally { sfxBus = keep; cueDetune = 1; cueGain = 1; }
}
export function sfx(name, ...a) {
  if (!ctx || !state.on || !SFX[name]) return;
  state.cues.push(name + (typeof a[0] === 'string' ? ':' + a[0] : '')); state.cueVol = state.vol; if (state.cues.length > 80) state.cues.shift();
  playCue(name, a);
}

// ---- the audio kit (Hot Springs Games, MIT): generative music, ambience beds and a renderer for tests ----------
// Music: scores written as data. Ambience: noise beds with slow movement plus sparse one-shots. It never creates an
// AudioContext: the game passes its own context and the node to play into.
// Scheduling is driven by audio-clock time, not by the timer: `kit.scheduleUntil(t)` schedules every bar and
// ambience event that starts before `t`. That is what lets a test render the music faster than real time in an
// OfflineAudioContext (see measureAudio at the bottom) and it means a throttled timer cannot bunch notes up.
function makeAudioKit(ctx, out, opt = {}) {
  const sr = ctx.sampleRate;
  let seed = (opt.seed || 0x5EED1) >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const pick = (xs) => xs[(rnd() * xs.length) | 0];
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const gain = (v, to) => { const n = ctx.createGain(); n.gain.value = v; if (to) n.connect(to); return n; };
  const panTo = (p, to) => { if (!p || !ctx.createStereoPanner) return to; const n = ctx.createStereoPanner(); n.pan.value = Math.max(-1, Math.min(1, p)); n.connect(to); return n; };
  const lowpass = (f, to, type = 'lowpass', q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (to) n.connect(to); return n; };
  const noiseBuf = ctx.createBuffer(1, sr * 2, sr);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; }
  const noise = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, rr(0, 1.9)); if (dur) s.stop(t + dur); return s; };

  let mLevel = opt.music ?? 0.5, aLevel = opt.ambience ?? 0.5, inten = 0, held = false, timer = 0;
  const musicBus = gain(mLevel, out), ambBus = gain(aLevel, out);
  const dead = [];   // { at, nodes }: sub-buses to disconnect once their fade-out has finished
  const retire = (bus, nodes, at, fade) => {
    bus.gain.cancelScheduledValues(at); bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), at);
    bus.gain.linearRampToValueAtTime(0.0001, at + Math.max(fade, 0.02)); dead.push({ at: at + fade + 0.2, nodes });
  };

  // ------------------------------------------------------------------------------------------- instruments
  // sus: held for the note's length then released over r seconds. Otherwise percussive: decays over `decay`.
  // waves: one oscillator each, detuned +/- det cents. parts: extra sine partials [frequency multiple, gain].
  const INST = {
    pad:    { waves: ['triangle', 'sine'], det: 6, sus: true, a: 0.9, r: 1.8, lp: 1500 },
    organ:  { waves: ['sine'], parts: [[2, 0.4], [3, 0.15]], sus: true, a: 0.04, r: 0.25 },
    flute:  { waves: ['sine'], parts: [[2, 0.07]], sus: true, a: 0.06, r: 0.3, vib: 5 },
    brass:  { waves: ['sawtooth', 'square'], det: 5, sus: true, a: 0.03, r: 0.12, lp: 1900 },
    mallet: { waves: ['sine'], parts: [[3, 0.16], [4.2, 0.05]], a: 0.004, decay: 1.1 },
    piano:  { waves: ['triangle'], parts: [[2, 0.22], [3, 0.07]], a: 0.004, decay: 0.75 },
    pluck:  { waves: ['sawtooth'], a: 0.003, decay: 0.38, lp: 3400, lpTo: 500 },
    bass:   { waves: ['triangle'], parts: [[2, 0.12]], a: 0.008, decay: 0.55, lp: 800 },
    tuba:   { waves: ['sawtooth'], sus: true, a: 0.02, r: 0.08, lp: 420 },
  };
  function voice(m, t, midi, dur, ins, level, pn, dry) {
    const f = hz(midi), a = ins.a, end = ins.sus ? t + Math.max(dur, a) + ins.r : t + Math.max(dur * 0.5, 0.05) + ins.decay;
    const peak = level / Math.sqrt(ins.waves.length), env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, t + a);
    if (ins.sus) { env.gain.setValueAtTime(peak, t + Math.max(dur, a)); env.gain.linearRampToValueAtTime(0.0001, end); }
    else env.gain.exponentialRampToValueAtTime(0.0001, end);
    let dst = panTo(pn, dry ? m.lp : m.inp);
    if (ins.lp) { const fl = lowpass(ins.lp, dst); if (ins.lpTo) { fl.frequency.setValueAtTime(ins.lp, t); fl.frequency.exponentialRampToValueAtTime(ins.lpTo, t + ins.decay); } dst = fl; }
    env.connect(dst);
    ins.waves.forEach((w, i) => {
      const o = ctx.createOscillator(); o.type = w; o.frequency.value = f; if (ins.det) o.detune.value = (i % 2 ? -1 : 1) * ins.det;
      if (ins.vib) { const l = ctx.createOscillator(), lg = gain(f * 0.004, o.frequency); l.frequency.value = ins.vib; l.connect(lg); l.start(t); l.stop(end + 0.05); }
      o.connect(env); o.start(t); o.stop(end + 0.05);
    });
    for (const [mult, pg] of ins.parts || []) { const o = ctx.createOscillator(); o.frequency.value = f * mult; o.connect(gain(pg, env)); o.start(t); o.stop(end + 0.05); }
  }
  const DRUM = {
    k: (m, t, v) => { const o = ctx.createOscillator(), e = gain(0.0001, m.lp); o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.11); e.gain.setValueAtTime(v, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(e); o.start(t); o.stop(t + 0.2); },
    s: (m, t, v) => { const e = gain(0.0001, lowpass(1900, m.inp, 'bandpass', 0.8)); e.gain.setValueAtTime(v * 0.9, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); noise(t, 0.15).connect(e); },
    h: (m, t, v) => { const e = gain(0.0001, lowpass(6500, m.lp, 'highpass')); e.gain.setValueAtTime(v * 0.35, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); noise(t, 0.06).connect(e); },
    b: (m, t, v) => { const e = gain(0.0001, lowpass(3200, m.inp, 'bandpass', 0.5)); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v * 0.4, t + 0.03); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); noise(t, 0.22).connect(e); },   // brush
  };

  // ------------------------------------------------------------------------------------------------- music
  // A score is data:
  //   { bpm, beats: 4, spb: 2 (steps per beat: 2 = eighths, 4 = sixteenths), swing: 0..0.33,
  //     key: 62 (MIDI note of the tonic), scale: [0,2,4,5,7,9,11], sevenths: [4] (chord degrees that take a 7th),
  //     form: 'AABA', sections: { A: [0,5,3,4], B: [3,0,4,4] }   // chord roots as scale degrees, one bar each
  //                                                               // ([degree, bars] holds a chord for longer),
  //     pad:  { inst: 'pad', gain: 0.05 },
  //     bass: { inst: 'bass', pattern: 'root' | 'two' | 'walk', gain: 0.12 },
  //     comp: { inst: 'piano', at: [1, 3] (beats), gain: 0.04 },
  //     lead: { inst: 'mallet', gain: 0.09, oct: 1, lo: -2, hi: 9, classes: [0,1,2,4,5], vary: 0.3, rest: 0.15,
  //             rhythms: [[0,3,4,6], ...] (steps in the bar) },
  //     perc: { k: [0, 2], s: [1, 3], h: [0.5, 1.5, 2.5, 3.5], gain: 0.5 }, perc2: {...} (added at high intensity),
  //     lp: 4200, delay: 0.18 (echo level, 0 for none), delayBeats: 0.75 }
  // The lead is composed once per section bar and remembered, so A sounds like A each time it returns; on
  // every return a bar has a `vary` chance of a small variation that is not remembered.
  const RHY = {
    8: [[0, 3, 4, 6], [0, 2, 4], [0, 4, 6, 7], [2, 4, 6], [0, 3, 6], [0, 2, 3, 4, 6], [0, 4], [0, 1, 2, 4], [1, 2, 4, 6]],
    6: [[0, 2, 4], [0, 3], [0, 4, 5], [2, 4], [0, 2, 3, 4]],
    12: [[0, 4, 8], [0, 6], [0, 3, 6, 8, 10], [4, 6, 8], [0, 4, 6, 10]],
  };
  let cur = null;
  function buildBars(score) {
    const bars = [];
    for (const label of score.form) {
      const sec = score.sections[label], start = bars.length;
      for (const c of sec) { const [d, n] = Array.isArray(c) ? c : [c, 1]; for (let k = 0; k < n; k++) bars.push({ label, d, first: k === 0, len: n }); }
      bars.slice(start).forEach((b, i) => { b.i = i; }); bars[bars.length - 1].end = true;
    }
    return bars;
  }
  function mStart(score, at, fade) {
    const bus = gain(0.0001, musicBus), lp = lowpass(score.lp || 4200, bus), inp = gain(1, lp), nodes = [bus, lp, inp];
    if (score.delay !== 0) {
      const d = ctx.createDelay(1.5); d.delayTime.value = Math.min(1.4, (60 / score.bpm) * (score.delayBeats || 0.75));
      const fb = gain(0.3, d), wet = gain(score.delay ?? 0.18, lp); inp.connect(d); d.connect(fb); d.connect(wet); nodes.push(d, fb, wet);
    }
    bus.gain.setValueAtTime(0.0001, at); bus.gain.linearRampToValueAtTime(score.vol ?? 1, at + Math.max(fade, 0.02));   // vol: the whole piece's level
    return { score, bus, lp, inp, nodes, bars: buildBars(score), t: at, bar: 0, mem: {}, rh: {}, prev: 4, dir: 1, sigs: new Set(), pitches: new Set(), notes: 0 };
  }
  function genMotif(m, B, spbar, spb) {
    const s = m.score, L = s.lead, classes = L.classes || [0, 1, 2, 4, 5], lo = L.lo ?? -2, hi = L.hi ?? 9;
    const cls = (k) => ((k % 7) + 7) % 7, tones = [cls(B.d), cls(B.d + 2), cls(B.d + 4)];
    const ladder = [], strong = [];
    for (let k = lo; k <= hi; k++) { if (classes.includes(cls(k))) ladder.push(k); if (tones.includes(cls(k))) strong.push(k); }
    const pool = L.rhythms || RHY[spbar] || [Array.from({ length: spbar / spb }, (_, i) => i * spb)];
    let rh;
    if (B.end) rh = [0];
    else if (rnd() < (L.rest ?? 0.15)) rh = [];
    else if (B.i >= 2 && m.rh[B.label + (B.i - 2)] && rnd() < 0.6) rh = m.rh[B.label + (B.i - 2)];
    else rh = pick(pool);
    m.rh[B.label + B.i] = rh;
    const mot = [];
    rh.forEach((st, j) => {
      let d;
      if (st % spb === 0 || B.end) {   // on the beat: a chord tone near the last note, preferring to move
        const near = (B.end ? strong.filter((k) => cls(k) !== tones[2]) : strong).slice().sort((x, y) => Math.abs(x - m.prev) - Math.abs(y - m.prev));
        const moved = near.filter((k) => k !== m.prev), c = moved.length ? moved : near;
        d = c[rnd() < 0.65 || c.length < 2 ? 0 : 1];
      } else {                         // off the beat: step along the scale, mostly keeping direction
        if (m.prev >= hi - 1) m.dir = -1; else if (m.prev <= lo + 1) m.dir = 1; else if (rnd() < 0.35) m.dir = -m.dir;
        const i = ladder.reduce((best, k, ix) => (Math.abs(k - m.prev) < Math.abs(ladder[best] - m.prev) ? ix : best), 0);
        d = ladder[Math.max(0, Math.min(ladder.length - 1, i + m.dir))];
      }
      const next = j + 1 < rh.length ? rh[j + 1] : spbar;
      mot.push({ st, d, len: B.end ? Math.min(spbar, spb * 3) : Math.max(1, next - st) });
      m.prev = d;
    });
    return mot;
  }
  function varyMotif(m, mot, B, spbar) {
    if (mot.length < 2 || B.end) return mot;
    const v = mot.map((n) => ({ ...n })), k = 1 + ((rnd() * (v.length - 1)) | 0), how = rnd();
    if (how < 0.5) v[k].d += rnd() < 0.5 ? 1 : -1;                                   // neighbour note
    else if (how < 0.75 && v.length > 2) v.pop();                                     // leave a breath
    else if (v[k].st - v[k - 1].st >= 2) v.splice(k, 0, { st: v[k].st - 1, d: v[k - 1].d + (v[k].d > v[k - 1].d ? 1 : -1), len: 1 });   // passing note
    return v;
  }
  function playBar(m, t0) {
    const s = m.score, spb = s.spb || 2, beats = s.beats || 4, spbar = spb * beats, sc = s.scale || [0, 2, 4, 5, 7, 9, 11];
    const beat = 60 / (s.bpm * (1 + 0.06 * inten)), step = beat / spb, barDur = beat * beats;
    const B = m.bars[m.bar % m.bars.length], nextB = m.bars[(m.bar + 1) % m.bars.length];
    const at = (st) => t0 + st * step + (st % 2 ? (s.swing || 0) * step : 0);
    const deg = (d) => s.key + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    const fold = (n, lo) => lo + (((n - lo) % 12) + 12) % 12;
    const chord = [B.d, B.d + 2, B.d + 4].concat((s.sevenths || []).includes(((B.d % 7) + 7) % 7) ? [B.d + 6] : []);
    if (s.pad && B.first) for (const d of chord) voice(m, t0, fold(deg(d), s.key - 5), barDur * B.len, INST[s.pad.inst || 'pad'], (s.pad.gain ?? 0.05), rr(-0.4, 0.4), false);
    if (s.bass) {
      const ins = INST[s.bass.inst || 'bass'], lo = s.key - 24 + 12 * (s.bass.oct || 0), g = s.bass.gain ?? 0.12, root = fold(deg(B.d), lo);
      let fifth = fold(deg(B.d + 4), lo); if (fifth > root + 6) fifth -= 12;
      const p = s.bass.pattern || 'root';
      if (p === 'root') voice(m, t0, root, barDur * 0.9, ins, g, 0, true);
      else if (p === 'two') { voice(m, at(0), root, beat * 0.9, ins, g, 0, true); voice(m, at(spb * Math.floor(beats / 2)), fifth, beat * 0.9, ins, g * 0.9, 0, true); }
      else if (p === 'walk') {
        const target = fold(deg(nextB.d), lo), line = [root, fold(deg(B.d + 2), lo), fold(deg(B.d + 4), lo), target + (rnd() < 0.5 ? -1 : 1)];
        for (let b = 0; b < beats; b++) voice(m, at(b * spb), line[b % 4], beat * 0.9, ins, g * (b ? 0.85 : 1), 0, true);
      }
    }
    if (s.comp) for (const b of s.comp.at || [1, 3]) { const st = Math.round(b * spb); for (const d of chord) voice(m, at(st), fold(deg(d), s.key + 12 * (s.comp.oct || 0)), beat * (s.comp.len || 0.4), INST[s.comp.inst || 'piano'], (s.comp.gain ?? 0.04), s.comp.pan || 0, false); }
    for (const P of [s.perc, inten > 0.5 ? s.perc2 : null]) if (P) for (const key of Object.keys(DRUM)) for (const b of P[key] || []) DRUM[key](m, at(Math.round(b * spb)), (P.gain ?? 0.5) * 0.3);
    if (s.lead) {
      const L = s.lead, key = B.label + ':' + B.i; let mot = m.mem[key];
      if (!mot) mot = m.mem[key] = genMotif(m, B, spbar, spb); else if (rnd() < (L.vary ?? 0.3)) mot = varyMotif(m, mot, B, spbar);
      for (const n of mot) { const midi = deg(n.d) + 12 * ((L.oct ?? 1) + (inten > 0.8 && L.lift ? 1 : 0)); voice(m, at(n.st), midi, n.len * step * 0.92, INST[L.inst || 'mallet'], (L.gain ?? 0.09) * (1 + 0.2 * inten) * rr(0.88, 1), L.pan ?? rr(-0.25, 0.25), false); m.pitches.add(midi); m.notes++; }
      m.sigs.add(mot.map((n) => n.st + '.' + n.d).join(' '));
    }
    m.lp.frequency.setTargetAtTime((s.lp || 4200) * (1 + 0.6 * inten), t0, 0.4);
    return barDur;
  }
  const music = {
    play(score, o = {}) {
      const at = o.at ?? ctx.currentTime + 0.03, fade = o.fade ?? 1.2;
      if (cur && cur.score === score) return;
      if (cur) retire(cur.bus, cur.nodes, at, fade);
      cur = score ? mStart(score, at, fade) : null;
    },
    stop(fade = 1) { music.play(null, { fade }); },
    level(v) { mLevel = v; if (!held) musicBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    duck(db = 6, ms = 400) { if (held) return; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(mLevel * 10 ** (-db / 20), t, 0.02); musicBus.gain.setTargetAtTime(mLevel, t + ms / 1000, 0.25); },
    intensity(x) { inten = Math.max(0, Math.min(1, x)); },
    get score() { return cur && cur.score; },
    // For tests: how much the lead has really varied so far.
    info() { return cur ? { bars: cur.bar, formBars: cur.bars.length, distinctBars: cur.sigs.size, notes: cur.notes, pitches: cur.pitches.size } : null; },
  };

  // ---------------------------------------------------------------------------------------------- ambience
  // A scene is data:
  //   { beds:  [{ type: 'lowpass' | 'bandpass' | 'highpass', freq, q, gain, pan,
  //               lfo: { rate (Hz), depth 0..1 } (slow swell of the bed's level), flfo: { rate, depth (Hz) },
  //               param: 'wind', range: [0.2, 1] }],     // amb.set('wind', 0..1) moves this bed's level
  //     spots: [{ make: 'drip' | 'bird' | 'hiss' | 'bell' | 'cricket' | 'swell' | (ctx, dest, t, rnd) => {},
  //               every: [4, 10] (seconds between), gain, pan: [-0.6, 0.6], param: 'night' }] }
  // Beds are continuous; spots are sparse one-shots at random gaps so the place never loops audibly.
  const SPOT = {
    drip: (dst, t, v) => { const f = rr(1100, 2300), o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.03); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.09); e.gain.setValueAtTime(v, t); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(e); o.start(t); o.stop(t + 0.14); },
    bird: (dst, t, v) => { const n = 2 + ((rnd() * 3) | 0), base = rr(2600, 4200); for (let i = 0; i < n; i++) { const s = t + i * rr(0.09, 0.16), o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.setValueAtTime(base * rr(0.9, 1.1), s); o.frequency.exponentialRampToValueAtTime(base * rr(1.15, 1.5), s + 0.06); e.gain.setValueAtTime(0.0001, s); e.gain.linearRampToValueAtTime(v * 0.7, s + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.08); o.connect(e); o.start(s); o.stop(s + 0.1); } },
    hiss: (dst, t, v) => { const d = rr(0.7, 1.8), e = gain(0.0001, lowpass(rr(3500, 6000), dst, 'highpass')); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v * 0.6, t + d * 0.3); e.gain.exponentialRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(e); },
    bell: (dst, t, v) => { const f = rr(700, 1100); for (const [mult, pg, dec] of [[1, 1, 2.2], [2.76, 0.4, 1.3], [5.4, 0.18, 0.7]]) { const o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.value = f * mult; e.gain.setValueAtTime(v * pg * 0.6, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(e); o.start(t); o.stop(t + dec + 0.05); } },
    cricket: (dst, t, v) => { const f = rr(4200, 5200), n = 3 + ((rnd() * 4) | 0); for (let i = 0; i < n; i++) { const s = t + i * 0.055, o = ctx.createOscillator(), e = gain(0.0001, dst); o.frequency.value = f; e.gain.setValueAtTime(v * 0.35, s); e.gain.exponentialRampToValueAtTime(0.0001, s + 0.03); o.connect(e); o.start(s); o.stop(s + 0.04); } },
    swell: (dst, t, v) => { const d = rr(2.5, 5), e = gain(0.0001, lowpass(rr(500, 900), dst, 'bandpass', 0.6)); e.gain.setValueAtTime(0.0001, t); e.gain.linearRampToValueAtTime(v, t + d * 0.45); e.gain.linearRampToValueAtTime(0.0001, t + d); noise(t, d + 0.05).connect(e); },
  };
  let scene = null;
  const params = {};
  function aStart(def, at, fade) {
    const bus = gain(0.0001, ambBus), nodes = [bus], beds = [];
    for (const b of def.beds || []) {
      const g = gain(b.gain ?? 0.05, panTo(b.pan || 0, bus)), f = lowpass(b.freq || 600, g, b.type || 'lowpass', b.q ?? 0.7), src = noise(at);
      src.connect(f); nodes.push(src, g, f);
      if (b.lfo) { const l = ctx.createOscillator(); l.frequency.value = b.lfo.rate; l.connect(gain((b.gain ?? 0.05) * b.lfo.depth * 0.5, g.gain)); l.start(at); nodes.push(l); }
      if (b.flfo) { const l = ctx.createOscillator(); l.frequency.value = b.flfo.rate; l.connect(gain(b.flfo.depth, f.frequency)); l.start(at); nodes.push(l); }
      beds.push({ def: b, g });
    }
    bus.gain.setValueAtTime(0.0001, at); bus.gain.linearRampToValueAtTime(1, at + Math.max(fade, 0.02));
    const sc = { def, bus, nodes, beds, spots: (def.spots || []).map((d) => ({ d, next: at + rr(0.3, d.every[1]) })) };
    for (const k of Object.keys(params)) applyParam(sc, k, params[k], at, 0.01);
    return sc;
  }
  function applyParam(sc, name, v, t, tc) { for (const b of sc.beds) if (b.def.param === name) { const r = b.def.range || [0, 1]; b.g.gain.setTargetAtTime((b.def.gain ?? 0.05) * (r[0] + (r[1] - r[0]) * v), t, tc); } }
  const amb = {
    play(def, o = {}) {
      const at = o.at ?? ctx.currentTime + 0.03, fade = o.fade ?? 2;
      if (scene && scene.def === def) return;
      if (scene) { const old = scene; retire(old.bus, old.nodes, at, fade); }
      scene = def ? aStart(def, at, fade) : null;
    },
    stop(fade = 1.5) { amb.play(null, { fade }); },
    level(v) { aLevel = v; if (!held) ambBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    set(name, v, tc = 0.5) { params[name] = v; if (scene) applyParam(scene, name, v, ctx.currentTime, tc); },
    get scene() { return scene && scene.def; },
  };

  // --------------------------------------------------------------------------------------------- scheduler
  function scheduleUntil(T) {
    const now = ctx.currentTime;
    if (!held) {
      if (cur) { if (cur.t < now - 0.05) cur.t = now + 0.05; let guard = 0; while (cur.t < T && guard++ < 400) { cur.t += playBar(cur, cur.t); cur.bar++; } }
      if (scene) for (const sp of scene.spots) {
        if (sp.next < now - 0.05) sp.next = now + rr(0.2, sp.d.every[1]);
        let guard = 0;
        while (sp.next < T && guard++ < 400) {
          const on = sp.d.param ? (params[sp.d.param] ?? 0) : 1;
          if (on > 0 && rnd() < on) { const p = sp.d.pan || [-0.5, 0.5], dst = panTo(rr(p[0], p[1]), scene.bus), v = (sp.d.gain ?? 0.05) * rr(0.6, 1); if (typeof sp.d.make === 'function') sp.d.make(ctx, dst, sp.next, rnd, v); else SPOT[sp.d.make](dst, sp.next, v); }
          sp.next += rr(sp.d.every[0], sp.d.every[1]);
        }
      }
    }
    for (let i = dead.length - 1; i >= 0; i--) if (dead[i].at < now) { for (const n of dead[i].nodes) { try { if (n.stop) n.stop(); } catch (e) { /* already stopped */ } try { n.disconnect(); } catch (e) { /* already gone */ } } dead.splice(i, 1); }
  }

  return {
    music, amb, scheduleUntil, INST,
    // Cue variation for the game's own tone() and noise(): multiply the frequency by f and the gain by g, start
    // a noise buffer at offset o (seconds), so no two repeats of a cue are sample-identical.
    jit(cents = 25, db = 1.5) { return { f: 2 ** (rr(-cents, cents) / 1200), g: 10 ** (rr(-db, 0) / 20), o: rr(0, 1.5) }; },
    start() { if (!timer) timer = setInterval(() => { if (ctx.state === 'running') scheduleUntil(ctx.currentTime + 0.25); }, 25); },
    stop() { if (timer) clearInterval(timer); timer = 0; },
    // Pause card or hidden tab: fade both buses out and schedule nothing until release().
    hold(tc = 0.08) { held = true; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(0, t, tc); ambBus.gain.setTargetAtTime(0, t, tc); },
    release(tc = 0.3) { held = false; const t = ctx.currentTime; if (cur && cur.t > t + 0.1) cur.t = t + 0.05; musicBus.gain.setTargetAtTime(mLevel, t, tc); ambBus.gain.setTargetAtTime(aLevel, t, tc); },
    get held() { return held; },
    // the real gain of the music and ambience buses right now (for tests)
    levels() { return { music: +musicBus.gain.value.toFixed(3), amb: +ambBus.gain.value.toFixed(3) }; },
  };
}

// Renders `seconds` of audio faster than real time and measures it, so a test can check music and ambience
// that nobody in the test run can hear. `build(ctx, dest)` builds the graph on the offline context and schedules
// everything up to `seconds` (for the kit: make a kit on ctx, play, then kit.scheduleUntil(seconds)); whatever it
// returns comes back as `built` (return kit.music.info() to get the variation counts).
//   peak, rms: linear, 0..1 (peakDb, rmsDb in dBFS). longestSilence: seconds in a row below -60 dBFS.
//   stereo: side level over mid level (0 = mono). secs: RMS of each second. wav: base64 16-bit WAV if asked.
async function measureAudio(build, seconds, o = {}) {
  const rate = o.rate || 22050, OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const oc = new OC(2, Math.ceil(rate * seconds), rate), made = build(oc, oc.destination);
  const buf = await oc.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  let peak = 0, mid = 0, side = 0, run = 0, longest = 0; const secs = [];
  for (let s = 0; s * rate < n; s++) {
    const end = Math.min(n, (s + 1) * rate); let e = 0;
    for (let i = s * rate; i < end; i++) { const a = (L[i] + R[i]) / 2, d = (L[i] - R[i]) / 2, p = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (p > peak) peak = p; e += a * a; side += d * d; }
    mid += e; const r = Math.sqrt(e / (end - s * rate)); secs.push(+r.toFixed(5));
    if (r < 0.001) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  const rms = Math.sqrt(mid / n), db = (x) => +(20 * Math.log10(Math.max(x, 1e-9))).toFixed(1);
  const res = { seconds, peak: +peak.toFixed(4), rms: +rms.toFixed(4), peakDb: db(peak), rmsDb: db(rms), longestSilence: longest, stereo: +(Math.sqrt(side / n) / (rms || 1)).toFixed(3), secs, built: typeof made === 'function' ? made() : made };
  if (o.wav) {
    const bytes = new Uint8Array(44 + n * 4), v = new DataView(bytes.buffer), str = (at, s) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); res.wav = btoa(bin);
  }
  return res;
}

// ---- this game's own scores and scenes ------------------------------------------------------------------------
// Chord roots are scale degrees (0 = I). Every piece is at least 45 s before its form repeats and the lead varies
// on each pass. perc is the steady groove; perc2 joins when the tension passes 0.5 (the lantern, a beam or the boss
// close by, the last tail ring), together with a faster tempo and a brighter filter (kit.music.intensity).
const MINOR = [0, 2, 3, 5, 7, 8, 11];
const SCORES = {
  // Title: "Gator Farm Dash": a fairground calliope over a brisk two-step, in E. 32 bars, about 62 s.
  title: {
    bpm: 124, vol: 0.5, beats: 4, spb: 2, swing: 0.05, key: 52, sevenths: [4], form: 'AABA',
    sections: { A: [0, 3, 0, 4, 0, 3, 4, 0], B: [5, 1, 4, 0, 5, 3, 4, 4] },
    bass: { inst: 'bass', pattern: 'two', oct: 1, gain: 0.14 }, comp: { inst: 'pluck', at: [1, 3], gain: 0.03, len: 0.3 },
    lead: { inst: 'organ', gain: 0.075, oct: 1, vary: 0.3, rest: 0.08, rhythms: [[0, 1, 3, 4, 6], [0, 2, 3, 4, 6, 7], [0, 3, 4, 7], [1, 2, 4, 5, 7], [0, 2, 4, 6]] },
    perc: { k: [0, 2], s: [1, 3], gain: 0.3 }, perc2: { h: [0.5, 1.5, 2.5, 3.5], gain: 0.3 },
    lp: 4600, delay: 0.1, delayBeats: 0.5,
  },
  // Farm map: a quiet music box and a long pad, in D. 16 bars, about 58 s.
  map: {
    bpm: 66, vol: 0.55, beats: 4, spb: 2, key: 50, sevenths: [4], form: 'AABA',
    sections: { A: [0, 5, 3, 4], B: [3, 4, 5, 4] },
    pad: { inst: 'pad', gain: 0.05 }, bass: { inst: 'bass', pattern: 'root', oct: 1, gain: 0.1 },
    lead: { inst: 'mallet', gain: 0.075, oct: 1, vary: 0.35, rest: 0.22 },
    lp: 3400, delay: 0.24,
  },
  // Zones 1 and 2, the Front Pits and the Nursery: "Whittington Scamper", a banjo over a bouncing bass, in G.
  // 32 bars, about 66 s.
  day: {
    bpm: 116, vol: 0.5, beats: 4, spb: 2, swing: 0.08, key: 55, sevenths: [4], form: 'AABA',
    sections: { A: [0, 0, 3, 0, 4, 4, 0, 0], B: [3, 3, 0, 0, 1, 4, 0, 4] },
    bass: { inst: 'bass', pattern: 'two', oct: 1, gain: 0.14 }, comp: { inst: 'piano', at: [1, 3], gain: 0.035 },
    lead: { inst: 'pluck', gain: 0.085, oct: 1, vary: 0.3, rest: 0.1, rhythms: [[0, 1, 3, 4, 6], [0, 3, 4, 7], [1, 2, 4, 5, 7], [0, 2, 3, 5, 6], [0, 2, 4, 6], [0, 1, 2, 4, 6]] },
    perc: { h: [0.5, 1.5, 2.5, 3.5], gain: 0.3 }, perc2: { k: [0, 2], s: [1, 3], gain: 0.4 },
    lp: 5000, delay: 0,
  },
  // Zone 3, the Noon Feeding Show: "Chicken at Noon", a strutting march with a tuba, in C. 32 bars, about 68 s.
  noon: {
    bpm: 112, vol: 0.6, beats: 4, spb: 2, key: 48, sevenths: [4], form: 'AABA',
    sections: { A: [0, 0, 3, 3, 0, 4, 0, 0], B: [5, 5, 3, 3, 1, 4, 0, 4] },
    bass: { inst: 'tuba', pattern: 'two', oct: 1, gain: 0.1 }, comp: { inst: 'brass', at: [1, 3], gain: 0.026, len: 0.3 },
    lead: { inst: 'brass', gain: 0.05, oct: 1, vary: 0.25, rest: 0.1, lift: true },
    perc: { k: [0, 2], s: [1, 3], gain: 0.35 }, perc2: { s: [3.5], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 },
    lp: 4300, delay: 0.06, delayBeats: 0.5,
  },
  // Zone 4, the Winter Barn: "Heat Lamp Lullaby", a slow waltz for flute and pad, in F. 24 bars, about 55 s.
  barn: {
    bpm: 78, vol: 0.5, beats: 3, spb: 2, key: 53, sevenths: [4], form: 'AABA',
    sections: { A: [0, 3, 4, 0, 5, 4], B: [3, 5, 1, 4, 0, 4] },
    pad: { inst: 'pad', gain: 0.05 }, bass: { inst: 'bass', pattern: 'root', oct: 1, gain: 0.1 },
    lead: { inst: 'flute', gain: 0.085, oct: 1, vary: 0.35, rest: 0.18 },
    perc2: { k: [0, 1.5], h: [1, 2], gain: 0.4 },
    lp: 3200, delay: 0.2,
  },
  // Zone 5 and the Moonlight Run: "Moonlight Tiptoe", a music box over a walking pizzicato bass, A minor.
  // 24 bars, about 60 s.
  night: {
    bpm: 96, vol: 0.42, beats: 4, spb: 2, key: 57, scale: MINOR, sevenths: [4], form: 'AABA',
    sections: { A: [0, 5, 3, 4, 0, 0], B: [3, 5, 4, 4, 0, 4] },
    pad: { inst: 'pad', gain: 0.04 }, bass: { inst: 'bass', pattern: 'walk', oct: 1, gain: 0.12 },
    lead: { inst: 'mallet', gain: 0.085, oct: 1, vary: 0.3, rest: 0.25 },
    perc2: { k: [0, 1.5, 2], s: [3], h: [0.5, 1.5, 2.5, 3.5], gain: 0.4 },
    lp: 3600, delay: 0.2,
  },
  // Level clear: a warm piano and a slow pad, in B flat. 24 bars, about 68 s.
  results: {
    bpm: 84, vol: 0.55, beats: 4, spb: 2, key: 58, sevenths: [4], form: 'AABA',
    sections: { A: [0, 3, 4, 0, 5, 3], B: [1, 4, 0, 5, 3, 4] },
    pad: { inst: 'pad', gain: 0.05 }, bass: { inst: 'bass', pattern: 'root', oct: 1, gain: 0.1 },
    lead: { inst: 'piano', gain: 0.08, oct: 1, vary: 0.35, rest: 0.15 },
    lp: 3800, delay: 0.16,
  },
};

// A few sounds the kit does not have. Called as make(ctx, dest, t, rnd, v).
const env = (c, dst, t, v, a, d) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(dst); return g; };
const osc = (c, g, t, type, f0, f1, dur) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(g); o.start(t); o.stop(t + dur + 0.05); };
const SPOTS = {
  // a gator rumbling a long way off: two low sines beating against each other
  rumble: (c, dst, t, rnd, v) => { const f = 52 + rnd() * 16, g = env(c, dst, t, v * 1.4, 1.1, 2.4); osc(c, g, t, 'sine', f, f * 0.82, 3.4); osc(c, g, t, 'sine', f * 1.035, f * 0.85, 3.4); },
  // a frog: three quick throaty pulses
  ribbit: (c, dst, t, rnd, v) => { const f = 190 + rnd() * 60; for (let i = 0; i < 3; i++) { const s = t + i * 0.11, g = env(c, dst, s, v * 0.7, 0.012, 0.07); osc(c, g, s, 'triangle', f, f * 0.7, 0.08); } },
  // an owl: two soft low hoots
  hoot: (c, dst, t, rnd, v) => { const f = 400 + rnd() * 50; let g = env(c, dst, t, v * 0.9, 0.12, 0.3); osc(c, g, t, 'sine', f, f * 0.93, 0.42); g = env(c, dst, t + 0.55, v * 0.8, 0.1, 0.4); osc(c, g, t + 0.55, 'sine', f * 0.88, f * 0.8, 0.5); },
  // a hen in the straw
  cluck: (c, dst, t, rnd, v) => { const f = 520 + rnd() * 120, n = 2 + ((rnd() * 3) | 0); for (let i = 0; i < n; i++) { const s = t + i * 0.13, g = env(c, dst, s, v * 0.6, 0.01, 0.07); osc(c, g, s, 'triangle', f * (1 - i * 0.06), f * 0.7, 0.08); } },
  // a beam in the barn settling
  creak: (c, dst, t, rnd, v) => { const f = 110 + rnd() * 40, g = env(c, dst, t, v * 0.7, 0.25, 0.55), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g); osc(c, lp, t, 'sawtooth', f, f * 0.72, 0.8); },
};
// The tension layer (amb.set('tension', 0..1)): a low drone and a heartbeat that comes in as it rises.
SPOTS.heart = (c, dst, t, rnd, v) => { for (const [d, k] of [[0, 1], [0.2, 0.7]]) { const s = t + d, g = env(c, dst, s, v * k, 0.012, 0.16); osc(c, g, s, 'sine', 78, 48, 0.2); } };
const TENSION_BED = { type: 'lowpass', freq: 95, q: 0.8, gain: 0.015, param: 'tension', range: [0, 1] };
const TENSION_SPOT = { make: SPOTS.heart, every: [0.6, 0.6], gain: 0.024, pan: [0, 0], param: 'tension' };
const SCENES = {
  // Zones 1 and 2, and the title and map: a stream beside the pits, light wind, birds, and now and then a gator.
  meadow: {
    beds: [
      { type: 'lowpass', freq: 640, gain: 0.05, lfo: { rate: 0.08, depth: 0.5 }, flfo: { rate: 0.06, depth: 160 } },
      { type: 'bandpass', freq: 2600, q: 0.7, gain: 0.011, pan: 0.3, lfo: { rate: 0.13, depth: 0.8 } },
      { type: 'lowpass', freq: 300, gain: 0.03, pan: -0.3, lfo: { rate: 0.05, depth: 0.7 }, flfo: { rate: 0.04, depth: 90 } },
      TENSION_BED,
    ],
    spots: [
      TENSION_SPOT,
      { make: 'bird', every: [3, 9], gain: 0.022 }, { make: 'bird', every: [6, 16], gain: 0.015, pan: [-0.8, -0.3] },
      { make: 'drip', every: [2.5, 7], gain: 0.022 }, { make: SPOTS.rumble, every: [18, 38], gain: 0.022, pan: [-0.3, 0.3] },
    ],
  },
  // Zone 3: the crowd at the feeding show; amb.set('crowd', 0..1) swells it when a drumstick is tossed.
  showground: {
    beds: [
      { type: 'bandpass', freq: 700, q: 0.5, gain: 0.027, lfo: { rate: 0.13, depth: 0.5 }, param: 'crowd', range: [0.4, 1.6] },
      { type: 'bandpass', freq: 1600, q: 0.7, gain: 0.011, lfo: { rate: 0.21, depth: 0.6 }, pan: -0.3, param: 'crowd', range: [0.2, 1.6] },
      { type: 'lowpass', freq: 520, gain: 0.025, lfo: { rate: 0.07, depth: 0.5 }, flfo: { rate: 0.05, depth: 120 } },
      TENSION_BED,
    ],
    spots: [
      TENSION_SPOT,
      { make: 'swell', every: [7, 15], gain: 0.03 }, { make: 'bird', every: [5, 14], gain: 0.02 },
      { make: 'drip', every: [3, 8], gain: 0.025 }, { make: SPOTS.rumble, every: [20, 40], gain: 0.022 },
    ],
  },
  // Zone 4: a warm barn, a heat-lamp hum, straw, hens and a settling beam.
  loft: {
    beds: [
      { type: 'lowpass', freq: 210, gain: 0.05, lfo: { rate: 0.06, depth: 0.5 } },
      { type: 'bandpass', freq: 118, q: 5, gain: 0.018, pan: 0.4, lfo: { rate: 0.09, depth: 0.3 } },
      { type: 'highpass', freq: 3400, q: 0.5, gain: 0.006, pan: -0.3, lfo: { rate: 0.3, depth: 1 } },
      TENSION_BED,
    ],
    spots: [
      TENSION_SPOT,
      { make: SPOTS.cluck, every: [6, 16], gain: 0.025, pan: [-0.7, 0.7] }, { make: SPOTS.creak, every: [9, 22], gain: 0.04 },
      { make: 'drip', every: [3, 9], gain: 0.025 }, { make: 'hiss', every: [14, 30], gain: 0.025 },
    ],
  },
  // Zone 5 and the Moonlight Run: crickets and frogs over still water, an owl, and a rumble.
  midnight: {
    beds: [
      { type: 'lowpass', freq: 250, gain: 0.05, lfo: { rate: 0.05, depth: 0.4 } },
      { type: 'lowpass', freq: 560, gain: 0.02, pan: 0.2, lfo: { rate: 0.09, depth: 0.7 }, flfo: { rate: 0.05, depth: 120 } },
      TENSION_BED,
    ],
    spots: [
      TENSION_SPOT,
      { make: 'cricket', every: [0.5, 1.4], gain: 0.03, pan: [-0.7, 0.7] }, { make: 'cricket', every: [0.9, 2.2], gain: 0.02, pan: [0.2, 0.9] },
      { make: SPOTS.ribbit, every: [3, 8], gain: 0.03, pan: [-0.8, 0.8] }, { make: SPOTS.hoot, every: [14, 30], gain: 0.03, pan: [-0.6, 0.6] },
      { make: SPOTS.rumble, every: [16, 34], gain: 0.022 },
    ],
  },
};

// ---- music and ambience: what the game asks for -------------------------------------------------------------
export function audioList() { return { music: Object.keys(SCORES), ambience: Object.keys(SCENES) }; }

function applyTheme(force) {
  if (!kit) return;
  const sc = SCORES[state.theme], am = SCENES[state.scene];
  if (sc && (force || state.playing !== state.theme)) { kit.music.play({ ...sc }, { fade: force ? 0.3 : 2.2 }); state.playing = state.theme; }
  if (am && (force || state.playingScene !== state.scene)) { kit.amb.play({ ...am }, { fade: force ? 0.3 : 3 }); state.playingScene = state.scene; }
}
// Pick the music piece (and, if given, the ambience scene). Re-selecting what already plays keeps its place; a new
// choice crossfades. Before the first key or touch this only records the choice.
export function playTheme(name, scene) {
  state.theme = name; if (scene) state.scene = scene;
  state.tension = 0;
  if (kit) { kit.music.intensity(0); kit.amb.set('tension', 0, 0.5); }
  applyTheme(false);
}
// 0..1: how hunted Bandit is (a lantern or a flashlight close behind, the boss near, the last tail ring). Lifts the
// drums and tempo of the music and brings in a low pulse under the ambience.
export function setTension(x) {
  x = Math.max(0, Math.min(1, x));
  if (Math.abs(x - state.tension) < 0.02) return;
  state.tension = x;
  if (kit) { kit.music.intensity(x); kit.amb.set('tension', x, 0.3); }
}
// a quantity an ambience bed follows (the crowd at the feeding show)
export function setAmbience(param, v) { if (kit) kit.amb.set(param, v, 0.6); }
export function duckMusic(db = 6, ms = 600) { if (kit) kit.music.duck(db, ms); }
// Pause panel: fade the music and ambience out and schedule nothing (menu sounds still play).
export function holdMusic() { state.hold = true; if (kit) kit.hold(); }
// A tab going to the background also suspends the context.
export function suspendAudio() {
  holdMusic(); state.suspended = true;
  if (ctx) { try { const r = ctx.suspend(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }
}
export function resumeAudio(keepHeld = false) {
  state.suspended = false;
  if (keepHeld) { wake(); return; }
  state.hold = false;
  if (!ctx) return;
  wake();
  if (kit) kit.release();
}
export function stopTheme() { state.theme = null; state.scene = null; state.playing = null; state.playingScene = null; if (kit) { kit.music.stop(); kit.amb.stop(); } }

// Plays cues on an offline context through a stand-in for the live buses, then puts the live ones back.
function cuesOffline(oc, master, list, seed) {
  const keep = [ctx, sfxBus, noiseBuf];
  ctx = oc; sfxBus = oc.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  noiseBuf = oc.createBuffer(1, oc.sampleRate, oc.sampleRate);
  const d = noiseBuf.getChannelData(0); let x = (seed || 0x2545F491) >>> 0; for (let i = 0; i < d.length; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; d[i] = x / 2147483648 - 1; }
  try { for (const c of list) { if (!SFX[c.name]) throw new Error('unknown audio: cue:' + c.name); playCue(c.name, c.args || []); } } finally { [ctx, sfxBus, noiseBuf] = keep; }
}
// Renders one piece, scene or cue ('cue:hop') by itself on an OfflineAudioContext at the level the game ships and measures it
// (test hook), through the master gain and limiter the player hears, so the numbers are as heard. Never touches the live
// audio or the settings. o: { intensity, params, seed, volume (the Volume setting, default the shipped 0.5), args (for a cue),
// cues: [{ name, args }] played together at cueAt seconds over a piece or scene, for the busiest moment }.
export async function renderAudio(name, seconds = 30, wav = false, o = {}) {
  const gain = (o.volume ?? SHIPPED_VOLUME) * MASTER_K;
  if (name.startsWith('cue:')) { // a sound effect by itself
    if (!SFX[name.slice(4)]) throw new Error('unknown audio: ' + name);
    return measureAudio((oc, dest) => { cuesOffline(oc, makeMaster(oc, dest, gain), [{ name: name.slice(4), args: o.args }], o.seed); return null; }, seconds, { wav });
  }
  const score = SCORES[name], scene = SCENES[name];
  if (!score && !scene) throw new Error('unknown audio: ' + name);
  return measureAudio((oc, dest) => {
    const master = makeMaster(oc, dest, gain), k = makeAudioKit(oc, master, { seed: o.seed || 0x5EED1 });
    k.music.level(MUSIC_LEVEL); k.amb.level(AMB_LEVEL); k.amb.set('tension', 0, 0.01); k.amb.set('crowd', 0.3, 0.01);
    for (const p of Object.keys(o.params || {})) k.amb.set(p, o.params[p], 0.01);
    if (score) { k.music.intensity(o.intensity || 0); k.music.play({ ...score }, { fade: 0.05 }); } else k.amb.play({ ...scene }, { fade: 0.05 });
    k.scheduleUntil(seconds + 0.5);
    // o.cues: [{ name, args }] played together at o.cueAt seconds over the piece, for the busiest moment
    if (o.cues && o.cues.length) oc.suspend(o.cueAt ?? 4).then(() => { cuesOffline(oc, master, o.cues, o.seed); oc.resume(); });
    return () => (score ? { ...k.music.info(), bpm: score.bpm, beats: score.beats || 4, formSeconds: +(k.music.info().formBars * (score.beats || 4) * 60 / score.bpm).toFixed(1) } : null);
  }, seconds, { wav });
}
