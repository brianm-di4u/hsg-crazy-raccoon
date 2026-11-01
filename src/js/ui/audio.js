// Sound: WebAudio synthesis only (no audio files). Starts on the first key or touch (autoplay rules), quiet by
// default and mutable. Buses, tone/noise primitives and the step sequencer adapted from
// games/Cart Racing/src/js/ui/audio.js (itself after hsg-fishing; Hot Springs Games, MIT). Music: original loops.

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const state = { on: true, music: true, vol: 0.5, started: false, theme: null, step: 0, nextT: 0, timer: null };

export function initAudio(settings) {
  state.on = settings.sound !== false; state.music = settings.music !== false; state.vol = settings.volume ?? 0.5;
  const start = () => { if (!state.started) unlock(); };
  window.addEventListener('keydown', start);
  window.addEventListener('pointerdown', start);
}

function unlock() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = state.on ? state.vol * 0.5 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = state.music ? 0.3 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    state.started = true;
    buildLoops();
    if (state.theme) playTheme(state.theme, true);
  } catch (e) { ctx = null; }
}

export function setAudio(settings) {
  state.on = settings.sound !== false; state.music = settings.music !== false; state.vol = settings.volume ?? state.vol;
  if (!ctx) return;
  master.gain.setTargetAtTime(state.on ? state.vol * 0.5 : 0, ctx.currentTime, 0.05);
  musicBus.gain.setTargetAtTime(state.music ? 0.3 : 0, ctx.currentTime, 0.05);
}
export function audioState() { return { started: state.started, on: state.on, music: state.music, theme: state.theme, ctx: ctx ? ctx.state : 'none' }; }

function tone(freq, dur, { type = 'square', vol = 0.2, at = 0, slide = 0, attack = 0.005, bus = sfxBus, filter = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g); g.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, { vol = 0.2, at = 0, type = 'bandpass', freq = 1200, q = 1, sweep = 0, bus = sfxBus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.02);
}

export const SFX = {
  hop(n = 0) { tone(520 + (n % 3) * 60, 0.07, { type: 'triangle', vol: 0.09, slide: 1.6 }); },
  land() { noise(0.04, { vol: 0.05, freq: 500, q: 1.2 }); },
  bump() { tone(140, 0.08, { type: 'square', vol: 0.06, slide: 0.7, filter: 800 }); },
  splash() { noise(0.45, { vol: 0.22, freq: 1700, q: 0.7, sweep: 0.35 }); tone(300, 0.25, { type: 'sine', vol: 0.08, slide: 0.4 }); },
  chomp() { noise(0.05, { vol: 0.28, freq: 2400, q: 2 }); tone(110, 0.12, { type: 'square', vol: 0.12, slide: 0.6, filter: 900 }); noise(0.05, { vol: 0.22, freq: 1800, q: 2, at: 0.09 }); },
  tele() { tone(880, 0.05, { type: 'square', vol: 0.03, filter: 2400 }); },
  whip() { noise(0.12, { vol: 0.2, freq: 3500, q: 1.5, sweep: 0.4 }); tone(400, 0.4, { type: 'triangle', vol: 0.08, slide: 2.2 }); },
  pickup() { [880, 1175].forEach((f, i) => tone(f, 0.08, { type: 'triangle', vol: 0.1, at: i * 0.06 })); },
  cap() { tone(1568, 0.06, { type: 'square', vol: 0.05, filter: 3000 }); tone(2093, 0.08, { type: 'square', vol: 0.04, at: 0.05, filter: 3200 }); },
  wash() { noise(0.5, { vol: 0.1, type: 'highpass', freq: 3200, q: 0.5 }); [1047, 1319, 1568].forEach((f, i) => tone(f, 0.1, { type: 'sine', vol: 0.07, at: 0.1 + i * 0.07 })); },
  bank() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, { type: 'triangle', vol: 0.09, at: i * 0.06 })); },
  lure() { noise(0.3, { vol: 0.1, freq: 900, q: 0.8, sweep: 2.5 }); },
  feed() { tone(392, 0.12, { type: 'square', vol: 0.06, filter: 1800 }); tone(330, 0.16, { type: 'square', vol: 0.06, at: 0.13, filter: 1800 }); },
  spotted() { for (let i = 0; i < 3; i++) tone(2400 + (i % 2) * 300, 0.08, { type: 'sine', vol: 0.09, at: i * 0.08 }); },
  streak(m) { tone(660 * Math.pow(1.12, m), 0.12, { type: 'square', vol: 0.06, filter: 2600 }); },
  nudge() { tone(300, 0.06, { type: 'triangle', vol: 0.06, slide: 1.4 }); },
  ball() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.07, at: i * 0.08, filter: 2800 })); },
  menu() { tone(990, 0.04, { type: 'square', vol: 0.05, filter: 3000 }); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, { type: 'square', vol: 0.08, at: i * 0.11, filter: 2600 })); },
  fail() { [392, 349, 311, 262].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, at: i * 0.16 })); },
  star(i) { tone(1047 * Math.pow(1.26, i), 0.18, { type: 'square', vol: 0.07, filter: 3000 }); },
};
export function sfx(name, ...a) { if (ctx && state.on && SFX[name]) SFX[name](...a); }

// ---- music: tiny step sequencer (16th notes), original loops ----
const N = (s) => s.split(' ').map((t) => (t === '.' ? 0 : noteHz(t)));
function noteHz(n) { const m = n.match(/^([A-G])(#?)(\d)$/); if (!m) return 0; const k = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (k - 9) / 12 + (+m[3] - 4)); }
let LOOPS = {};
function buildLoops() {
  LOOPS = {
    // "Whittington Scamper": plucky banjo rolls over a bouncing bass (original)
    day: { bpm: 124, pluck: true, lead: N('D5 . B4 G4 D5 . B4 . E5 . C5 A4 E5 . C5 . D5 . B4 G4 A4 B4 D5 . G5 . E5 D5 B4 . G4 . D5 . B4 G4 D5 . B4 . E5 . C5 A4 E5 G5 E5 . D5 B4 A4 G4 A4 . B4 . G4 . . . . . . .'),
      bass: N('G2 . D3 . G2 . D3 . C3 . G3 . C3 . G3 . G2 . D3 . E3 . D3 . C3 . D3 . G2 . . . G2 . D3 . G2 . D3 . C3 . G3 . C3 . G3 . D3 . A3 . D3 . F#3 . G2 . D3 . G2 . . .'), leadType: 'triangle', bassType: 'triangle', drums: 'x.h.x.h.x.h.xhh.' },
    // "Chicken at Noon": a strutting march for the feeding show (original)
    noon: { bpm: 116, lead: N('C5 . E5 . G5 . E5 . F5 . A5 . G5 . . . E5 . G5 . C6 . G5 . A5 . F5 . E5 . . . D5 . F5 . A5 . F5 . G5 . E5 . C5 . . . D5 . E5 . F5 . D5 . C5 . . . . . . .'),
      bass: N('C3 . G2 . C3 . G2 . F2 . C3 . C3 . G2 . C3 . G2 . F2 . C3 . C3 . G2 . D3 . A2 . D3 . A2 . G2 . D3 . C3 . G2 . G2 . D3 . G2 . B2 . C3 . G2 . C3 . . .'), leadType: 'square', bassType: 'square', drums: 'x...h...x.x.h...' },
    // "Heat Lamp Lullaby": a sleepy waltz-ish loop for the barn (original)
    barn: { bpm: 84, lead: N('E5 . . . G5 . . . E5 . D5 . C5 . . . D5 . . . E5 . . . C5 . . . A4 . . . C5 . . . E5 . . . G5 . A5 . G5 . . . E5 . . . D5 . . . C5 . . . . . . .'),
      bass: N('A2 . . . E3 . . . A2 . . . E3 . . . F2 . . . C3 . . . F2 . . . C3 . . . C3 . . . G3 . . . C3 . . . G3 . . . G2 . . . D3 . . . A2 . . . . . . .'), leadType: 'sine', bassType: 'triangle', drums: 'x.......h.......' },
    // "Moonlight Tiptoe": minor creep with pizzicato bass (original)
    night: { bpm: 100, lead: N('A4 . . C5 . . E5 . D5 . C5 . B4 . . . A4 . . C5 . . E5 . F5 . E5 . D5 . . . E5 . . G5 . . B5 . A5 . G5 . E5 . . . D5 . C5 . B4 . G#4 . A4 . . . . . . .'),
      bass: N('A2 . E3 . A2 . E3 . D3 . A3 . D3 . A3 . A2 . E3 . A2 . E3 . F2 . C3 . E2 . B2 . C3 . G3 . C3 . G3 . G2 . D3 . G2 . D3 . F2 . C3 . E2 . B2 . A2 . E3 . A2 . . .'), leadType: 'triangle', bassType: 'triangle', drums: 'x..h..x.h..hx...' },
    // "Gator Farm Dash" title: bright and quick (original)
    title: { bpm: 132, lead: N('G4 . B4 . D5 . G5 . F#5 . D5 . E5 . . . C5 . E5 . G5 . E5 . D5 . B4 . A4 . . . G4 . B4 . D5 . G5 . A5 . F#5 . G5 . D5 . B4 . A4 . G4 . . . . . . .'),
      bass: N('G2 . G3 . D3 . G3 . D3 . A3 . C3 . G3 . C3 . E3 . G2 . B2 . D3 . F#3 . G2 . D3 . G2 . B2 . D3 . G3 . D3 . A3 . G2 . B2 . D3 . F#3 . G2 . D3 . G2 . . .'), leadType: 'square', bassType: 'triangle', drums: 'x.h.x.h.x.hhx.h.' },
  };
}
export function playTheme(name, force = false) {
  if (state.theme === name && !force && state.timer) return;
  state.theme = name;
  if (!ctx) return;
  if (state.timer) clearInterval(state.timer);
  const L = LOOPS[name];
  if (!L) return;
  state.step = 0; state.nextT = ctx.currentTime + 0.1;
  const sixteenth = 60 / L.bpm / 4;
  state.timer = setInterval(() => {
    if (!ctx) return;
    while (state.nextT < ctx.currentTime + 0.15) {
      const i = state.step % L.lead.length, at = state.nextT - ctx.currentTime;
      const ln = L.lead[i], bn = L.bass[i % L.bass.length], dr = L.drums[i % L.drums.length];
      if (ln > 0) tone(ln, L.pluck ? sixteenth * 1.5 : sixteenth * 1.8, { type: L.leadType, vol: L.pluck ? 0.07 : 0.045, at, filter: 2400, bus: musicBus, attack: 0.004 });
      if (bn > 0) tone(bn, sixteenth * 1.9, { type: L.bassType, vol: 0.08, at, filter: 900, bus: musicBus });
      if (dr === 'x') tone(70, 0.12, { type: 'sine', vol: 0.1, slide: 0.5, at, bus: musicBus });
      if (dr === 'h') noise(0.03, { vol: 0.025, type: 'highpass', freq: 7000, at, bus: musicBus });
      state.step++; state.nextT += sixteenth;
    }
  }, 50);
}
export function stopTheme() { if (state.timer) clearInterval(state.timer); state.timer = null; state.theme = null; }
