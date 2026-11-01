// Cosmetic particles: splash droplets, dust puffs, chomp stars, pickup sparkles, steam curls, rings and floating
// text. Uses the `fx` RNG stream only. Adapted from games/Furious Squirrels/src/js/gfx/fx.js (Hot Springs Games,
// MIT). Positions are in world units (x) and rows (r); the renderer projects them.
const MAX = 500;

export class Fx {
  constructor(rng) { this.rng = rng; this.p = []; this.texts = []; this.rings = []; this.scale = 1; }
  busy() { return this.p.length > 0 || this.texts.length > 0 || this.rings.length > 0; }
  count() { return this.p.length + this.texts.length + this.rings.length; }
  clear() { this.p = []; this.texts = []; this.rings = []; }
  add(o) { if (this.p.length < MAX * this.scale) this.p.push(o); }
  n(k) { return Math.max(1, Math.round(k * this.scale)); }

  splash(x, r) {
    const R = this.rng;
    for (let i = 0; i < this.n(16); i++) { const a = R.range(-Math.PI, 0), v = R.range(60, 240); this.add({ k: 'drop', x, r, h: 0, vx: Math.cos(a) * v * 0.6, vh: -Math.sin(a) * v, life: R.range(0.5, 0.9), t: 0, s: R.range(3, 7), c: R.pick(['#E9FBFF', '#9FE3EE', '#FFFFFF']) }); }
    this.rings.push({ x, r, t: 0, life: 0.6, c: '#E9FBFF', w: 46 });
    this.rings.push({ x, r, t: -0.12, life: 0.7, c: '#BFEFF5', w: 70 });
  }
  dust(x, r, n = 6, c = '#E8DCC0') {
    const R = this.rng;
    for (let i = 0; i < this.n(n); i++) { const a = R.range(0, Math.PI * 2), v = R.range(30, 110); this.add({ k: 'dust', x, r, h: 4, vx: Math.cos(a) * v, vh: Math.abs(Math.sin(a)) * 30, life: R.range(0.3, 0.6), t: 0, s: R.range(4, 9), c }); }
  }
  chomp(x, r) {
    const R = this.rng;
    for (let i = 0; i < this.n(8); i++) { const a = (i / 8) * Math.PI * 2; this.add({ k: 'star', x, r, h: 30, vx: Math.cos(a) * 150, vh: Math.sin(a) * 150 + 40, life: 0.7, t: 0, s: R.range(5, 8), c: '#FFD23F' }); }
    this.rings.push({ x, r, t: 0, life: 0.4, c: '#FFFFFF', w: 60, h: 30 });
  }
  sparkle(x, r, c = '#FFF3A6', n = 8) {
    const R = this.rng;
    for (let i = 0; i < this.n(n); i++) { const a = R.range(0, Math.PI * 2), v = R.range(40, 130); this.add({ k: 'spark', x, r, h: 26, vx: Math.cos(a) * v, vh: Math.sin(a) * v + 60, life: R.range(0.4, 0.8), t: 0, s: R.range(3, 5), c }); }
  }
  steam(x, r) { const R = this.rng; this.add({ k: 'steam', x: x + R.range(-14, 14), r, h: 8, vx: R.range(-8, 8), vh: R.range(30, 50), life: R.range(1.2, 1.8), t: 0, s: R.range(8, 14), c: '#FFFFFF' }); }
  text(x, r, s, c = '#FFFFFF') { this.texts.push({ x, r, s, t: 0, life: 1.0, c }); }

  update(dt) {
    for (const o of this.p) {
      o.t += dt;
      if (o.k === 'steam') { o.x += o.vx * dt; o.h += o.vh * dt; o.s += dt * 8; continue; }
      if (o.k === 'dust') { o.vx *= 1 - dt * 4; o.x += o.vx * dt; o.h += o.vh * dt; continue; }
      o.vh -= 520 * dt; o.x += o.vx * dt; o.h += o.vh * dt;
      if (o.h < 0 && o.k === 'drop') o.t = o.life;
    }
    this.p = this.p.filter((o) => o.t < o.life);
    for (const o of this.texts) o.t += dt;
    this.texts = this.texts.filter((o) => o.t < o.life);
    for (const o of this.rings) o.t += dt;
    this.rings = this.rings.filter((o) => o.t < o.life);
  }

  // proj(x, r) → [sx, sy]; k = px per world unit
  draw(g, proj, k) {
    for (const o of this.rings) {
      if (o.t < 0) continue;
      const [x, y] = proj(o.x, o.r), u = o.t / o.life;
      g.globalAlpha = 1 - u; g.strokeStyle = o.c; g.lineWidth = Math.max(1.5, 4 * (1 - u) * k * 2);
      g.beginPath(); g.ellipse(x, y - (o.h || 0) * k, o.w * k * (0.3 + u), o.w * k * (0.3 + u) * 0.45, 0, 0, Math.PI * 2); g.stroke();
    }
    for (const o of this.p) {
      const [x, y] = proj(o.x, o.r), a = 1 - o.t / o.life, sy = y - o.h * k;
      g.globalAlpha = o.k === 'steam' ? a * 0.35 : Math.min(1, a * 1.5);
      g.fillStyle = o.c;
      if (o.k === 'star' || o.k === 'spark') { g.save(); g.translate(x + o.vx * 0, sy); g.rotate(o.t * 6); g.beginPath(); for (let i = 0; i < 5; i++) { const ang = (i / 5) * Math.PI * 2; g.lineTo(Math.cos(ang) * o.s * k * 2, Math.sin(ang) * o.s * k * 2); g.lineTo(Math.cos(ang + 0.63) * o.s * k, Math.sin(ang + 0.63) * o.s * k); } g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(x, sy, o.s * k * (o.k === 'dust' ? 1 + o.t * 2 : 1), 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
    for (const o of this.texts) {
      const [x, y] = proj(o.x, o.r), u = o.t / o.life, fs = Math.max(14, 30 * k * 2);
      g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      g.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = Math.max(3, fs * 0.18); g.strokeStyle = '#1B1A17'; g.lineJoin = 'round'; g.strokeText(o.s, x, y - 50 * k - u * 50 * k);
      g.fillStyle = o.c; g.fillText(o.s, x, y - 50 * k - u * 50 * k);
    }
    g.globalAlpha = 1;
  }
}
