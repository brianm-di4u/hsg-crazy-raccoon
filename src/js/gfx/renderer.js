// 2.5D Canvas2D renderer (MECHANICS §10): a ¾ top-down board of rows, raised land with visible south faces and
// concrete lips over sunken water, y-sorted actors with soft shadows, parallax ridges, night and barn lighting.
// Painted/Blender art (this.art) replaces the vector drawings in draw.js when loaded. DPR-capped resize after
// games/Furious Squirrels/src/js/gfx/renderer.js (Hot Springs Games, MIT).
import { T, COLS, HOP_H, DEAD_T, colX } from '../sim/const.js';
import { nose, beamAt, warnings } from '../sim/world.js';
import { playerPose } from '../sim/player.js';
import { PAL, INK, gator, raccoon, item, pool, post, rail, hay, den, pine, tomb, badge, shadow, star4 } from './draw.js';
import { Fx } from './fx.js';
import { hashStr } from '../rng.js';

const RH_K = 0.8; // row height on screen as a fraction of the tile width

export class Renderer {
  constructor(canvas, fxRng) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.dpr = 1; this.w = 0; this.h = 0; this.cam = 0; this.camT = 0; this.camX = T * COLS / 2; this.camXT = this.camX; this.shake = 0;
    this.fx = new Fx(fxRng); this.lights = []; this.art = null; this.cache = new WeakMap(); this.reduced = false; this.landT = 9; this.deadFx = null; this.hudTop = 64; this.hudBot = 0;
    this.resize();
  }
  resize() {
    // a hidden or collapsed pane reports 0×0; lay out for a minimum size so the camera maths stays finite
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(160, window.innerWidth || 0), h = Math.max(160, window.innerHeight || 0);
    if (w === this.w && h === this.h && dpr === this.dpr) return false;
    this.w = w; this.h = h; this.dpr = dpr;
    this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    this.layout();
    return true;
  }
  layout() {
    const { w, h } = this;
    const portrait = h > w * 1.1;
    // portrait phones: about 6.5 of the 9 columns, panning sideways with Bandit, rows a little taller;
    // wide screens: about 13 rows tall
    this.tile = portrait ? w / 6.5 : Math.min(w / COLS, (h - this.hudTop * 0.3) / (13 * RH_K));
    this.rh = this.tile * (portrait ? 0.9 : RH_K);
    this.bw = this.tile * COLS;
    this.k = this.tile / T;
    this.placeX();
    this.baseY = h * (portrait ? 0.66 : 0.64);
    this.hudBand = portrait ? 108 : 64;
    this.footBand = portrait ? 78 : 0;
  }
  // horizontal camera: centred board when it fits, otherwise follow camX (world units) clamped to the board
  placeX() {
    if (this.bw <= this.w) { this.bx = (this.w - this.bw) / 2; return; }
    const half = this.w / 2 / this.k, cx = Math.max(half, Math.min(T * COLS - half, this.camX));
    this.bx = this.w / 2 - cx * this.k;
  }
  // Painted images pre-scaled once per on-screen size (device pixels), so each frame is a 1:1 blit instead of a
  // resample of a large source (software rasterizers spent ~14 ms a frame on that).
  // An optional tint (flat colours, or 'lit' for the top-lit land gradient) is baked into the cached copy, so lane
  // overlays cost nothing per frame.
  scaled(img, w, h, tint = '') {
    const W = Math.max(1, Math.round(w * this.dpr)), H = Math.max(1, Math.round(h * this.dpr));
    let m = this.cache.get(img);
    if (!m) { m = new Map(); this.cache.set(img, m); }
    const key = W + 'x' + H + tint;
    let c = m.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = W; c.height = H;
      const cg = c.getContext('2d'); cg.imageSmoothingQuality = 'high'; cg.drawImage(img, 0, 0, W, H);
      for (const t of tint ? tint.split('|') : []) {
        if (t === 'lit') { const gr = cg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,240,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,240,0)'); gr.addColorStop(1, 'rgba(30,20,0,0.09)'); cg.fillStyle = gr; } else cg.fillStyle = t;
        cg.fillRect(0, 0, W, H);
      }
      if (m.size > 40) m.clear();
      m.set(key, c);
    }
    return c;
  }
  blit(g, img, x, y, w, h) { g.drawImage(this.scaled(img, w, h), x, y, w, h); }
  sx(x) { return this.bx + x * this.k; }
  sy(r) { return this.baseY - (r - this.cam) * this.rh; }
  proj = (x, r) => [this.sx(x), this.sy(r)];

  snap(row, x) { this.cam = this.camT = this.camFor(row); if (x != null) { this.camX = this.camXT = x; this.placeX(); } }
  camFor(row) { return Math.max(row, (this.h - this.baseY) / this.rh - (this.footBand ? (this.footBand + this.rh * 0.55) / this.rh : 0.7)); }

  update(dt, run) {
    if (run) {
      const pose = playerPose(run.p);
      this.camT = this.camFor(pose.row + 0.4);
      this.camXT = pose.x;
      // portrait: lean toward Old Ruthless's head when he is just ahead, keeping Bandit a tile inside the view
      const boss = this.bw > this.w && run.world.gators.find((g) => g.k === 'boss' && g.row >= pose.row - 1 && g.row <= pose.row + 4 && g.x > 0 && g.x < T * COLS);
      if (boss) { const lim = this.w / 2 / this.k - T; this.camXT = pose.x + Math.max(-lim, Math.min(lim, (boss.x - pose.x) * 0.6)); }
      if (run.beam != null) this.camT = Math.max(this.camT, this.camFor(run.beam + 3));
    }
    const k = 1 - Math.pow(1 - 0.12, dt * 60);
    this.cam += (this.camT - this.cam) * k;
    this.camX += (this.camXT - this.camX) * k; this.placeX();
    this.landT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.fx.update(dt);
    return Math.abs(this.camT - this.cam) > 0.002 || this.fx.busy() || this.shake > 0;
  }

  // ------------------------------------------------------------------------------------------------------------
  draw(run, o = {}) {
    const g = this.g, { w, h, dpr } = this, L = run.L, theme = L.theme || 'day', P = PAL[theme] || PAL.day, t = o.time || 0;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.shake > 0 && !this.reduced) { const a = this.shake * 6; g.translate(Math.sin(t * 90) * a, Math.cos(t * 77) * a); }
    // sky and parallax ridges (seen above the den and on wide screens)
    // sky only where the board does not cover the screen (above the den row): a full-screen fill here was pure overdraw
    { const top = Math.min(h, Math.max(0, this.sy(run.N - 0.5) + this.rh)); if (top > 0) { g.fillStyle = vgrad(g, 0, h, P.sky0, P.sky1); g.fillRect(-20, -20, w + 40, top + 20); } }
    this.ridges(g, run, P, t);
    this.lights = [];
    const rTop = Math.min(run.N + 1, Math.floor(this.cam + this.baseY / this.rh) + 2);
    const rBot = Math.max(-3, Math.floor(this.cam - (h - this.baseY) / this.rh) - 1);
    // ground strips back to front
    for (let r = rTop; r >= rBot; r--) this.row(g, run, r, P, t);
    // south faces of raised land over water (drawn over the far edge of each water row)
    for (let r = rTop; r >= rBot; r--) this.face(g, run, r, P);
    // actors, y-sorted (far rows first)
    const acts = [];
    for (const gt of run.world.gators) {
      const top = gt.row + (gt.rows === 2 ? 1 : 0);
      if (top < rBot - 1 || gt.row > rTop + 1) continue;
      acts.push({ r: gt.row, o: 1, f: () => this.drawGator(g, run, gt, t) });
    }
    for (const it of run.items) if (it.st === 'free' && it.r >= rBot && it.r <= rTop) acts.push({ r: it.r, o: 0, f: () => this.drawItem(g, it, t) });
    for (let r = Math.max(0, rBot); r <= Math.min(run.N - 1, rTop); r++) {
      const row = L.rows[r];
      if (row.t === 'fence') acts.push({ r, o: 2, f: () => this.drawFence(g, row, r, P) });
      if (row.blocks) for (const c of row.blocks) acts.push({ r, o: 2, f: () => this.drawBlock(g, theme, r, c) });
    }
    acts.push({ r: playerPose(run.p).row - 0.01, o: 3, f: () => this.drawPlayer(g, run, t) });
    acts.sort((a, b) => b.r - a.r || a.o - b.o);
    for (const a of acts) a.f();
    // Old Ruthless just off screen: a pulsing marker on that edge of his row
    for (const gt of run.world.gators) {
      if (gt.k !== 'boss' || gt.row < rBot || gt.row > rTop) continue;
      const nx = this.sx(nose(gt)); if (nx > 0 && nx < w) continue;
      const left = nx <= 0, ex = left ? this.tile * 0.45 : w - this.tile * 0.45, ey = this.sy(gt.row + 0.5);
      g.save(); g.translate(ex, ey); badge(g, this.tile * 0.9, t); g.fillStyle = '#E8452E'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); const d = left ? -1 : 1; g.moveTo(d * this.tile * 0.42, 0); g.lineTo(d * this.tile * 0.26, -this.tile * 0.12); g.lineTo(d * this.tile * 0.26, this.tile * 0.12); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    // lighting
    if (theme === 'barn') { if (this.bw <= this.w) this.barnWalls(g); g.fillStyle = 'rgba(255,165,80,0.07)'; g.fillRect(0, 0, w, h); this.lamps(g, run, rBot, rTop, t); }
    // noon: warm, bright midday light
    if (theme === 'noon') { g.fillStyle = 'rgba(255,200,110,0.12)'; g.fillRect(0, 0, w, h); }
    // warm noon grade: a plain overlay (soft-light cost ~12 ms a frame in software)
    if (L.night) {
      this.night(g, run, rBot, rTop, t);
      // Bandit and the snacks stay readable in the dark (moonlit), only the gators hide
      for (const it of run.items) if (it.st === 'free' && it.r >= rBot && it.r <= rTop) this.drawItem(g, it, t);
      this.drawPlayer(g, run, t);
    }
    this.overlays(g, run, t);
    this.fx.draw(g, this.proj, this.k);
    // HUD band: a soft dark fade under the top pills, so they read as a header, not as objects on a lane
    if (this.footBand) { const fy = h - this.footBand; g.fillStyle = vgrad(g, fy, h, '#9A917E', '#6E6656'); g.fillRect(0, fy, w, this.footBand); g.fillStyle = 'rgba(255,250,235,0.55)'; g.fillRect(0, fy, w, 2); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, fy - 3, w, 3);
      g.strokeStyle = 'rgba(60,55,45,0.45)'; g.lineWidth = 1.5; for (let x = (this.bx % (this.tile * 0.9)); x < w; x += this.tile * 0.9) { g.beginPath(); g.moveTo(x, fy + 4); g.lineTo(x, h); g.stroke(); }
      // moss along the lip and grass tufts poking up from the joints
      g.fillStyle = 'rgba(92,140,60,0.55)'; g.fillRect(0, fy + 2, w, 4); g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, fy + 6, w, 6);
      g.strokeStyle = '#4F8A3A'; g.lineWidth = 2; g.lineCap = 'round';
      for (let x = (this.bx % (this.tile * 0.9)) + this.tile * 0.12; x < w; x += this.tile * 0.9) for (const [dx, hh] of [[-5, 9], [0, 13], [5, 8]]) { g.beginPath(); g.moveTo(x + dx * 0.4, fy + 3); g.quadraticCurveTo(x + dx * 0.7, fy - hh * 0.5, x + dx, fy - hh); g.stroke(); } }
    if (this.bw > this.w) { const hb = this.hudBand; g.fillStyle = '#1F3A2C'; g.fillRect(0, 0, w, hb); const gr = g.createLinearGradient(0, 0, 0, hb); gr.addColorStop(0, 'rgba(18,46,40,1)'); gr.addColorStop(1, 'rgba(30,66,54,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, hb); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, hb, w, 3); g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(0, hb - 2, w, 2); }
    else { const hb = this.hudBand, gr = g.createLinearGradient(0, 0, 0, hb + 24); gr.addColorStop(0, 'rgba(12,30,36,0.55)'); gr.addColorStop(0.75, 'rgba(12,30,36,0.28)'); gr.addColorStop(1, 'rgba(12,30,36,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hb + 24); }
    // out-of-bounds dimming beside the board
    if (this.bx > 4) {
      // a soft fade outward from the board edge (no hard seam), deepening toward the screen edge
      const fw = Math.min(this.bx, this.tile * 1.6);
      for (const [x0, x1] of [[this.bx, this.bx - fw], [this.bx + this.bw, this.bx + this.bw + fw]]) {
        const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, 'rgba(15,25,20,0)'); gr.addColorStop(1, 'rgba(15,25,20,0.3)');
        g.fillStyle = gr; g.fillRect(Math.min(x0, x1), -20, fw, h + 40);
      }
      g.fillStyle = 'rgba(15,25,20,0.3)'; g.fillRect(-20, -20, this.bx - fw + 20, h + 40); g.fillRect(this.bx + this.bw + fw, -20, this.bx + 20, h + 40);
    }
  }

  ridges(g, run, P, t) {
    const { w } = this, gy = this.sy(run.N - 0.5);
    if (gy < -40) return;
    const bd = this.art && this.art.backdrop(run.L.theme);
    if (bd) {
      // painted panorama, its bottom third tucked behind the den row; drifts slower than the board (parallax)
      const sc = Math.max(w / bd.width, (this.rh * 7) / bd.height), bw = bd.width * sc, bh = bd.height * sc;
      const par = (this.cam - run.N) * this.rh * 0.35;
      this.blit(g, bd, (w - bw) / 2, gy + this.rh * 0.6 - bh + par, bw, bh);
      return;
    }
    const layers = [[0.25, P.ridgeFar, 1.6], [0.55, P.ridge1, 1.1], [0.85, P.ridge0, 0.7]];
    layers.forEach(([par, col, amp], i) => {
      const base = gy - this.rh * (2.6 - i * 0.7) + (this.cam - run.N) * this.rh * (1 - par) * 0.4;
      g.fillStyle = col; g.beginPath(); g.moveTo(-20, gy + 4);
      for (let x = -20; x <= w + 20; x += 16) {
        // West Mountain on the left, Sugarloaf's rounder hump on the right (game stylization of the valley)
        const u = x / w, y = base - this.rh * amp * (0.9 * Math.exp(-((u - 0.2) ** 2) / 0.05) + 0.7 * Math.exp(-((u - 0.78) ** 2) / 0.03) + 0.15 * Math.sin(u * 17 + i));
        g.lineTo(x, y);
      }
      g.lineTo(w + 20, gy + 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.stroke();
    });
    // pine fringe along the farm's far fence
    for (let i = 0; i < 18; i++) { const x = (i / 17) * (w + 60) - 30, s = this.tile * (0.8 + ((i * 37) % 5) * 0.08); g.save(); g.translate(x, gy + 2); pine(g, s * 0.9, P.ridge0); g.restore(); }
  }

  rowType(run, r) { if (r < 0) return 'wall'; if (r >= run.N) return 'beyond'; return run.L.rows[r].t; }

  row(g, run, r, P, t) {
    const type = this.rowType(run, r), y = this.sy(r), h2 = this.rh / 2, { w } = this;
    if (type === 'beyond') return;
    const art = this.art && this.art.tiles;
    if (type === 'water') {
      if (art && art.water) this.tileFill(g, art.water, y - h2, this.rh, t * 18 * (run.L.rows[r].dir || 1), (run.L.night ? 'rgba(20,70,90,0.35)' : run.L.theme === 'barn' ? 'rgba(52,104,92,0.5)' : 'rgba(46,150,170,0.32)') + (r % 2 ? '|rgba(0,40,60,0.09)' : ''));
      else { g.fillStyle = vgrad(g, y - h2, y + h2, P.water2, P.water); g.fillRect(-20, y - h2, w + 40, this.rh + 1); }
      // ripples
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = Math.max(1, this.tile * 0.03);
      const off = ((t * 20 * (run.L.rows[r].dir || 1)) % 64) * this.k;
      g.beginPath(); for (let x = -64 * this.k + off + ((r * 37) % 50); x < w + 40; x += 64 * this.k) { const yy = y + h2 * 0.3, rr = this.tile * 0.18; g.moveTo(x + Math.cos(Math.PI * 1.15) * rr, yy + Math.sin(Math.PI * 1.15) * rr); g.arc(x, yy, rr, Math.PI * 1.15, Math.PI * 1.85); } g.stroke();
      const row = run.L.rows[r];
      // float rope between stacked water lanes, so each lane reads on its own (red and white floats on a line)
      if (this.rowType(run, r - 1) === 'water') {
        const yb = y + h2, sp = this.tile * 0.5;
        g.strokeStyle = 'rgba(250,244,225,0.8)'; g.lineWidth = Math.max(1.5, this.tile * 0.04);
        g.beginPath(); g.moveTo(-20, yb); g.lineTo(w + 20, yb); g.stroke();
        g.strokeStyle = 'rgba(27,26,23,0.6)'; g.lineWidth = 1;
        const fw = this.tile * 0.07, fh = this.tile * 0.045, all = new Path2D(), red = new Path2D(), white = new Path2D();
        for (let x = (this.bx % sp) - sp, i = 0; x < w + sp; x += sp, i++) { const p = i % 2 ? white : red; p.moveTo(x + fw, yb); p.ellipse(x, yb, fw, fh, 0, 0, Math.PI * 2); all.moveTo(x + fw, yb); all.ellipse(x, yb, fw, fh, 0, 0, Math.PI * 2); }
        g.fillStyle = '#D9473A'; g.fill(red); g.fillStyle = '#F4F1E8'; g.fill(white); g.stroke(all);
      }
      if (row.pools) for (const c of row.pools) this.poolAt(g, this.sx(colX(c)), y + h2 * 0.15, t);
      return;
    }
    const map = { start: 'path', grass: 'grass', path: 'path', boardwalk: 'board', sand: 'sand', straw: 'straw', fence: 'grass', goal: 'grass', wall: 'path' };
    const m = map[type] || 'grass';
    if (art && art[m]) this.tileFill(g, art[m], y - h2, this.rh, 0, 'lit');
    else {
      g.fillStyle = vgrad(g, y - h2, y + h2, P[m], P[m + '2'] || P[m]); g.fillRect(-20, y - h2, w + 40, this.rh + 1);
      if (m === 'board') { g.strokeStyle = 'rgba(60,35,15,0.45)'; g.lineWidth = 1.5; for (let x = this.bx % (this.tile * 0.5); x < w; x += this.tile * 0.5) { g.beginPath(); g.moveTo(x, y - h2); g.lineTo(x, y + h2); g.stroke(); } }
      if (m === 'grass') { g.fillStyle = 'rgba(40,90,30,0.25)'; for (let i = 0; i < 12; i++) { const x = ((hashStr(r + ':' + i) % 1000) / 1000) * w; g.fillRect(x, y - h2 * 0.2 + (i % 3) * 4, 3, 6); } }
      if (m === 'straw') { g.strokeStyle = 'rgba(120,90,30,0.35)'; g.lineWidth = 1.2; for (let i = 0; i < 20; i++) { const x = ((hashStr('s' + r + ':' + i) % 1000) / 1000) * w; g.beginPath(); g.moveTo(x, y - h2 * 0.5); g.lineTo(x + 8, y + h2 * 0.3); g.stroke(); } }
    }
    if (!(art && art[m]) && type !== 'wall') { const gr = g.createLinearGradient(0, y - h2, 0, y + h2); gr.addColorStop(0, 'rgba(255,255,240,0.07)'); gr.addColorStop(0.5, 'rgba(255,255,240,0)'); gr.addColorStop(1, 'rgba(30,20,0,0.09)'); g.fillStyle = gr; g.fillRect(-20, y - h2, w + 40, this.rh); }
    // tile seams on the board (subtle grid so hops read as one tile)
    g.strokeStyle = 'rgba(0,0,0,0.035)'; g.lineWidth = 1;
    g.beginPath(); for (let c = 1; c < COLS; c++) { const x = this.bx + c * this.tile; g.moveTo(x, y - h2); g.lineTo(x, y + h2); } g.stroke();
    if (type === 'wall') this.wall(g, r, y, P);
    if (r >= 0 && r < run.N) {
      const row = run.L.rows[r];
      if (row.pools) for (const c of row.pools) this.poolAt(g, this.sx(colX(c)), y + h2 * 0.1, t);
      if (row.check && type !== 'start') { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(-20, y - h2, w + 40, this.rh); } // full width: a board-wide box left seams on desktop
      if (type === 'goal') { g.save(); g.translate(this.sx(colX(4)), y + h2 * 0.6); if (!this.propAt(g, 'den', this.tile * 2.6, 0.92)) den(g, this.tile); g.restore(); }
      this.sideDecor(g, run, r, y, P);
      if (type === 'start' && this.bw > this.w) { g.save(); g.translate(Math.max(this.bx, 0) + this.tile * 0.55, y + this.rh * 0.3); this.propAt(g, 'sign', this.tile * 0.85, 0.95); g.restore(); }
    }
  }

  tileFill(g, img, y, hgt, scroll, tint = '') {
    const s = hgt / img.height, tw = Math.round(img.width * s), th = Math.round(hgt + 1);
    const c = this.scaled(img, tw, th, tint);
    let x0 = ((this.bx + scroll * this.k) % tw) - tw;
    for (let x = Math.floor(x0); x < this.w + tw; x += tw) g.drawImage(c, x, Math.floor(y), tw + 0.5, th);
  }

  wall(g, r, y, P) {
    // the farm's wall along Whittington Avenue below the start row
    if (r !== -1) return;
    const h2 = this.rh / 2;
    g.fillStyle = vgrad(g, y - h2, y + h2, '#D9D2C0', '#B5AC96'); g.fillRect(-20, y - h2 * 0.6, this.w + 40, this.rh * 1.2);
    g.strokeStyle = 'rgba(80,70,55,0.5)'; g.lineWidth = 1.5;
    for (let x = this.bx % (this.tile * 0.7); x < this.w; x += this.tile * 0.7) { g.beginPath(); g.moveTo(x, y - h2 * 0.6); g.lineTo(x, y + h2 * 0.6); g.stroke(); }
    g.fillStyle = INK; g.fillRect(-20, y - h2 * 0.6, this.w + 40, 2);
  }

  sideDecor(g, run, r, y, P) {
    if (this.bx < this.tile * 0.6) return;
    const type = run.L.rows[r].t;
    if (type === 'water') return;
    const theme = run.L.theme;
    for (const side of [0, 1]) {
      const hsh = hashStr(run.L.id + r + side);
      // a farm signpost on both sides of the start row, every level
      if (type === 'start') { g.save(); g.translate(side ? this.bx + this.bw + this.tile * 1.0 : this.bx - this.tile * 1.0, y + this.rh * 0.3); this.propAt(g, 'sign', this.tile * 1.15, 0.95); g.restore(); continue; }
      if (hsh % 2) continue;
      const x = side ? this.bx + this.bw + this.tile * (0.9 + (hsh % 7) * 0.3) : this.bx - this.tile * (0.9 + (hsh % 7) * 0.3);
      g.save(); g.translate(x, y + this.rh * 0.3);
      // margin set dressing per zone (painted props, vector fallbacks)
      const pick = (hsh >>> 3) % 4, low = this.rowType(run, r + 1) === 'water' || [r, r + 1].some((q) => q < run.N && run.L.rows[q].g && run.L.rows[q].g.length);
      if (theme === 'barn') { const k = ['hay', 'lantern', 'bucket', 'hay'][pick]; if (!this.propAt(g, k, this.tile * (k === 'lantern' ? 0.55 : 0.9), 0.96)) hay(g, this.tile * 0.9); }
      else if (r === 3 && run.L.n === 1 && side === 0) tomb(g, this.tile);
      else if (theme === 'noon' && pick === 1 && !low && this.propAt(g, 'feedstage', this.tile * 1.4, 0.92)) { /* drawn */ }
      else if (run.L.zone === 2 && pick === 1 && (this.propAt(g, 'eggs', this.tile * 1.0, 0.92) || this.propAt(g, 'crate', this.tile * 1.0, 0.92))) { /* drawn */ }
      else if ((theme === 'noon' || run.L.zone === 1) && pick === 0 && !low && this.propAt(g, 'railing', this.tile * 1.6, 0.9)) { /* visitor boardwalk railing */ }
      else if (run.L.night && pick === 2 && !low && this.propAt(g, 'lantern', this.tile * 0.55, 0.95)) { this.lights.push({ x, y: y + this.rh * 0.3 }); }
      else if (pick === 3 && this.propAt(g, 'rock', this.tile * 0.9, 0.9)) { /* drawn */ }
      else if ((pick === 2 || low) && this.propAt(g, low && pick % 2 ? 'rock' : 'cattails', this.tile * (low ? 0.75 : 0.9), 0.95)) { /* drawn */ }
      else if (low) this.propAt(g, pick % 2 ? 'rock' : 'cattails', this.tile * 0.75, 0.95);
      else if (!this.propAt(g, 'pine', this.tile * 1.3, 0.97)) pine(g, this.tile * 1.1, P.ridge0);
      g.restore();
    }
  }

  face(g, run, r, P) {
    const type = this.rowType(run, r), below = this.rowType(run, r - 1);
    if (type === 'water' || type === 'beyond') return;
    if (below !== 'water') return;
    const y = this.sy(r) + this.rh / 2, d = this.rh * 0.26;
    // concrete pool lip (c. 1924 photo: curved white concrete) and its wall dropping into the water
    g.fillStyle = vgrad(g, y, y + d, P.wall, P.water2); g.fillRect(-20, y, this.w + 40, d);
    // a darker wet band where the water laps the wall
    g.fillStyle = 'rgba(20,60,70,0.35)'; g.fillRect(-20, y + d * 0.62, this.w + 40, d * 0.38);
    // the rounded lip: lit top, cream body, shadowed underside
    const ly = y - this.rh * 0.11, lh = this.rh * 0.16;
    g.fillStyle = vgrad(g, ly, ly + lh, '#FFFFFF', P.lip2); g.fillRect(-20, ly, this.w + 40, lh);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-20, ly + lh * 0.12, this.w + 40, Math.max(1, lh * 0.14));
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-20, ly + lh - 2, this.w + 40, 2);
    g.fillStyle = INK; g.fillRect(-20, y + d - 1, this.w + 40, 1.5);
  }

  // painted gator size: hitbox length (hatchlings larger), swimmers flattened a touch; the stocky bruiser variant is
  // capped at 1.2x the paddler's height so stacked lanes still read
  gatorSize(gt, img, water) {
    const w = gt.len * this.tile * (gt.k === 'hatchling' ? 1.45 : 1.04);
    let h = ((w * img.height) / img.width) * (water ? 0.86 : 1);
    const ref = this.art && this.art.get('gator-paddler-closed');
    if (gt.k === 'paddler' && ref && img !== ref && img !== this.art.get('gator-paddler-open')) h = Math.min(h, ((w * ref.height) / ref.width) * 1.2 * (water ? 0.86 : 1));
    return { w, h };
  }

  drawGator(g, run, gt, t, rimOnly = false) {
    const nx = this.sx(nose(gt)), water = this.rowType(run, gt.row) === 'water';
    const y = this.sy(gt.row + (gt.rows === 2 ? 0.5 : 0)) + this.rh * (water ? 0.4 : 0.36);
    const s = this.tile * (gt.k === 'boss' ? 1.5 : 0.86), L = (gt.len * this.tile) / s;
    const p = run.p, whip = p.whipId === gt.id && p.whipT > 0 ? 1 - p.whipT / 0.35 : 0;
    const dip = run.p.on === gt.id && this.landT < 0.3 && !this.reduced ? this.tile * 0.06 * (1 - this.landT / 0.3) : 0;
    g.save(); g.translate(nx, y + dip);
    if (gt.dir < 0) g.scale(-1, 1);
    // shadow / wake
    if (rimOnly) { /* moonlit rim pass: the sprite only, no shadow, wash or ripples (they boxed each gator at night) */ }
    else if (water) { g.fillStyle = 'rgba(10,50,60,0.35)'; g.beginPath(); g.ellipse(-L * s * 0.5, s * 0.02, L * s * 0.52, s * 0.16, 0, 0, Math.PI * 2); g.fill(); }
    else { g.save(); g.translate(-L * s * 0.5, 0); shadow(g, L * s * 0.5, s * 0.13, 0.1); shadow(g, L * s * 0.4, s * 0.075, 0.24); g.restore(); }
    g.save(); if (water) { g.beginPath(); g.rect(-L * s - s * 2, -s * 6, L * s + s * 4, s * 6 + s * 0.02); g.clip(); }
    const img = this.art && this.art.gator(gt);
    if (img) {
      // painted gator, facing +x: nose near the right edge, waterline ~70% down (water) or feet at the bottom (land)
      // drawn at the hitbox length (the painted snout tip sits on the nose), hatchlings a touch larger to read
      // swimmers are flattened a touch so stacked lanes overlap less; hatchlings drawn larger so they read on grass
      const { w, h } = this.gatorSize(gt, img, water);
      const bob = water && !this.reduced ? Math.sin(t * 3 + gt.id) * this.tile * 0.025 : 0;
      let rot = 0;
      if (gt.jaw === 'tele' && !this.reduced) rot = Math.sin(t * 40) * 0.035;
      if (whip) rot += Math.sin(t * 50) * 0.06 * whip;
      g.save(); g.translate(0, bob); if (rot) g.rotate(rot);
      this.blit(g, img, -w + this.tile * 0.05, water ? -h * 0.72 : -h * 0.94, w, h);
      g.restore();
      if (water && !rimOnly) { // pond water washing over the lower body so it reads as half-submerged
        const wb = h * 0.2, gr = g.createLinearGradient(0, -wb, 0, 0);
        gr.addColorStop(0, 'rgba(40,160,180,0)'); gr.addColorStop(1, 'rgba(40,160,180,0.75)');
        g.fillStyle = gr; g.fillRect(-w, -wb, w + this.tile * 0.1, wb + 1);
      }
    } else gator(g, s, L, { k: gt.k, ja: gt.ja, ph: t + gt.id, sub: water ? 1 : 0, asleep: gt.k === 'sleeper' && gt.jaw === 'shut', whip: whip * Math.sin(t * 40) * 0.4 });
    g.restore();
    if (water && !rimOnly && Math.abs(gt.vx) > 1 && !this.reduced) { // a V wake: two tapered white wedges trailing off the snout
      const tl = this.tile, wl = tl * 1.1, gr = g.createLinearGradient(tl * 0.1, 0, -wl, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; const fl = Math.sin(t * 5 + gt.id) * tl * 0.02;
      for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(tl * 0.14, sg * tl * 0.03); g.lineTo(-wl, sg * (tl * 0.4 + fl)); g.lineTo(-wl, sg * (tl * 0.26 + fl)); g.lineTo(tl * 0.0, sg * tl * 0.12); g.closePath(); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(tl * 0.12, 0, tl * 0.13, tl * 0.07, 0, 0, Math.PI * 2); g.fill();
    }
    if (water && !rimOnly) { // waterline ripples hugging the body
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = Math.max(1.2, s * 0.04);
      g.beginPath(); for (let i = 0; i < L * 2; i++) { const x = -i * s * 0.5 - s * 0.1, wob = Math.sin(t * 6 + i) * s * 0.02; g.moveTo(x + s * 0.22, wob); g.ellipse(x, wob, s * 0.22, s * 0.05, 0, 0, Math.PI); } g.stroke();
    }
    g.restore();
    if (rimOnly) return;
    if (!run.L.night) this.telegraph(g, gt, nx, y, t);
    if (gt.k === 'sleeper' && gt.jaw === 'shut' && !this.reduced) {
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = `900 ${Math.round(this.tile * 0.28)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center';
      const u = (t * 0.8 + gt.id * 0.3) % 1; g.globalAlpha = 1 - u; g.fillText('z', nx - gt.dir * this.tile * 0.2 + u * 10, y - this.tile * (0.9 + u * 0.5)); g.globalAlpha = 1;
    }
  }

  // the jaw warning: a pulsing red footprint on the tile the jaws will snap, and a '!' badge pinned over the head
  telegraph(g, gt, nx, y, t) {
    if (gt.jaw === 'tele' || (gt.k === 'boss' && gt.wave > 0)) {
      // pinned over the head, nudged inside the screen when the head is at the very edge; none for a head well off screen
      const hx0 = nx - gt.dir * this.tile * (gt.k === 'boss' ? 0.9 : gt.k === 'sleeper' ? -0.4 : 0.35), hy = y - this.tile * (gt.k === 'boss' ? 1.6 : 0.72);
      const hx = Math.max(this.tile * 0.45, Math.min(this.w - this.tile * 0.45, hx0)), onScreen = Math.abs(hx - hx0) < this.tile * 0.6;
      // the tile the jaws will snap on pulses red (shape + pulse, not colour alone)
      const pu = 0.5 + 0.5 * Math.sin(t * 14);
      g.strokeStyle = `rgba(230,60,40,${0.55 + pu * 0.4})`; g.lineWidth = Math.max(2, this.tile * 0.05);
      g.beginPath(); g.ellipse(nx - gt.dir * this.tile * (gt.k === 'sleeper' ? -0.5 : 0.3), y + this.rh * 0.02, this.tile * 0.42, this.rh * 0.22, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(230,60,40,${0.12 + pu * 0.14})`; g.fill(); g.stroke();
      if (!onScreen || (this.bw > this.w && hy < this.hudBand)) return; // off screen, or hidden under the portrait header
      g.save(); g.translate(hx, hy); badge(g, this.tile, t);
      g.fillStyle = '#FFD23F'; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-this.tile * 0.08, this.tile * 0.19); g.lineTo(this.tile * 0.08, this.tile * 0.19); g.lineTo(0, this.tile * 0.34); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  drawItem(g, it, t) {
    const x = this.sx(colX(it.c)), y = this.sy(it.r) + this.rh * 0.15;
    g.save(); g.translate(x, y); shadow(g, this.tile * 0.18, this.tile * 0.06, 0.2);
    g.translate(0, -this.tile * (0.22 + Math.sin(t * 3 + it.c) * 0.03));
    // bonus items wear a gold halo; every item twinkles
    if (it.k === 'ball' || it.k === 'ticket' || it.k === 'drum') { const gr = g.createRadialGradient(0, 0, 0, 0, 0, this.tile * 0.5); gr.addColorStop(0, 'rgba(255,220,90,0.55)'); gr.addColorStop(1, 'rgba(255,220,90,0)'); g.fillStyle = gr; g.fillRect(-this.tile * 0.5, -this.tile * 0.5, this.tile, this.tile); }
    this.itemAt(g, it.k, this.tile, t, false);
    if (!this.reduced) { // an 8-ray sparkle bursting around the snack every 1.2 s
      const u = (t / 1.2 + it.c * 0.37 + it.r * 0.11) % 1;
      if (u < 0.3) { const a = Math.sin((u / 0.3) * Math.PI), r0 = this.tile * 0.3, r1 = this.tile * (0.36 + 0.14 * a);
        g.strokeStyle = `rgba(255,250,220,${0.9 * a})`; g.lineWidth = Math.max(1.5, this.tile * 0.035); g.beginPath();
        for (let k = 0; k < 8; k++) { const an = (k / 8) * Math.PI * 2 + 0.2, rr = k % 2 ? r1 * 0.8 : r1; g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
        g.stroke(); g.fillStyle = `rgba(255,255,255,${a})`; star4(g, this.tile * 0.2, -this.tile * 0.18, this.tile * 0.06 * a + 0.5); } }
    g.restore();
  }

  itemAt(g, k, s, t, washed) {
    const img = this.art && this.art.item(k);
    if (!img) { item(g, s, k, t, washed); return; }
    const m = s * 0.62, sc = m / Math.max(img.width, img.height);
    this.blit(g, img, (-img.width * sc) / 2, (-img.height * sc) / 2, img.width * sc, img.height * sc);
    if (washed) item(g, s, '', t, true);
  }
  propAt(g, k, w, anchorY = 1) {
    const img = this.art && this.art.prop(k);
    if (!img) return false;
    const h = (w * img.height) / img.width;
    this.blit(g, img, -w / 2, -h * anchorY, w, h);
    return true;
  }
  poolAt(g, x, y, t) {
    g.save(); g.translate(x, y); if (!this.propAt(g, 'pool', this.tile * 1.0, 0.6)) pool(g, this.tile, t);
    if (!this.reduced) { // steam curls rising off the spring
      for (let i = 0; i < 3; i++) { const u = (t * 0.35 + i / 3 + x * 0.001) % 1, gr = g.createRadialGradient(0, 0, 0, 0, 0, this.tile * 0.46); gr.addColorStop(0, `rgba(255,255,255,${0.62 * (1 - u)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.save(); g.translate(Math.sin(u * 6 + i) * this.tile * 0.12, -this.tile * (0.2 + u * 0.9)); g.scale(1 + u, 1 + u); g.fillStyle = gr; g.fillRect(-this.tile * 0.46, -this.tile * 0.46, this.tile * 0.92, this.tile * 0.92); g.restore(); }
    }
    g.restore();
  }

  drawFence(g, row, r, P) {
    const y = this.sy(r) + this.rh * 0.3, gaps = new Set(row.gaps || []);
    for (let c = 0; c < COLS; c++) {
      if (gaps.has(c)) continue;
      const x0 = this.bx + c * this.tile;
      if (this.art && this.art.prop('fence')) { g.save(); g.translate(x0 + this.tile / 2, y + this.rh * 0.05); this.propAt(g, 'fence', this.tile * 1.06, 0.95); g.restore(); continue; }
      g.save(); g.translate(x0, y); rail(g, this.tile, this.tile); g.restore();
      g.save(); g.translate(x0 + this.tile * 0.15, y); post(g, this.tile, P.fence); g.restore();
      g.save(); g.translate(x0 + this.tile * 0.85, y); post(g, this.tile, P.fence); g.restore();
    }
  }
  drawBlock(g, theme, r, c) {
    g.save(); g.translate(this.sx(colX(c)), this.sy(r) + this.rh * 0.3);
    shadow(g, this.tile * 0.42, this.tile * 0.1);
    if (theme === 'barn') { if (!this.propAt(g, 'hay', this.tile * 0.95, 0.95)) hay(g, this.tile); } else tomb(g, this.tile);
    g.restore();
  }

  drawPlayer(g, run, t) {
    const p = run.p, pose = playerPose(p), s = this.tile * 1.18;
    let x = this.sx(pose.x), y = this.sy(pose.row) + this.rh * 0.3;
    const lift = pose.arc * HOP_H * s * (this.reduced ? 0.6 : 1);
    let sq = 0;
    if (p.state === 'hop' || p.state === 'fling') sq = -0.55 * Math.sin(Math.PI * pose.u);
    else if (this.landT < 0.25 && !this.reduced) sq = 0.55 * Math.exp(-this.landT * 14) * Math.cos(this.landT * 30);
    if (p.state === 'bump') x += Math.sin(p.t * 80) * s * 0.06;
    let alpha = 1, rot = 0, sink = 0;
    if (p.state === 'dead') {
      const u = Math.min(1, p.t / DEAD_T);
      if (p.cause === 'splash') { sink = u; }
      else if (p.cause === 'chomp') { alpha = u < 0.15 ? 1 : 0; }
      else if (p.cause === 'swept') { rot = u * 8; alpha = 1 - u; }
      else if (p.cause === 'spotted' || p.cause === 'caught') { sq = 0.3; }
    }
    if (p.invT > 0 && p.state !== 'dead' && Math.floor(t * 12) % 2) alpha = 0.45;
    g.save(); g.translate(x, y);
    shadow(g, s * 0.3 * (1 - pose.arc * 0.45), s * 0.09 * (1 - pose.arc * 0.45), 0.28 - pose.arc * 0.12);
    if ((p.state === 'hop' || p.state === 'fling') && !this.reduced && p.from) {
      // speed strokes trailing behind the hop
      const dx = p.to.x - p.from.x, dr = p.to.row - p.from.row, ang = Math.atan2(dr * this.rh, -dx * this.k);
      g.save(); g.translate(0, -lift - s * 0.4); g.rotate(ang - Math.PI / 2);
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineCap = 'round'; g.lineWidth = Math.max(2, s * 0.05);
      for (const o of [-0.22, 0, 0.22]) { g.beginPath(); g.moveTo(o * s, s * 0.45); g.lineTo(o * s, s * (0.45 + 0.35 * Math.sin(Math.PI * pose.u))); g.stroke(); }
      g.restore();
    }
    g.globalAlpha = alpha;
    if (sink > 0) { g.beginPath(); g.rect(-s, -s * 2, s * 2, s * 2); g.clip(); g.translate(0, sink * s * 0.9); }
    g.translate(0, -lift); if (rot) g.rotate(rot);
    const carried = run.carried();
    const img = this.art && this.art.raccoon(p.facing, p.state === 'hop' || p.state === 'fling');
    if (img) {
      const h = this.tile * 1.3, w = (h * img.width) / img.height;
      g.save(); g.scale((1 + sq * 0.32) * (p.facing === 'right' ? -1 : 1), 1 - sq * 0.34);
      this.blit(g, img, -w / 2, -h * 0.97, w, h);
      g.restore();
      if (carried.length) { g.save(); g.translate(0, -this.tile * 0.4); for (let i = 0; i < Math.min(3, carried.length); i++) { g.save(); g.translate((i - (carried.length - 1) / 2) * this.tile * 0.2, 0); this.itemAt(g, carried[i].k, this.tile * 0.42, t, carried[i].washed); g.restore(); } g.restore(); }
    }
    else raccoon(g, s, { facing: p.facing, sq, t, grin: p.state === 'won', carry: Math.min(3, carried.length), carryKinds: carried.map((i) => i.k), washed: carried.map((i) => i.washed) });
    if (p.state === 'dead' && (p.cause === 'spotted' || p.cause === 'caught')) { g.translate(0, -s * 1.15); badge(g, s, t); }
    g.restore();
  }

  // heat lamps hang over hay, never over water: the row itself, else the one above, else none
  lampRow(run, r) { for (const q of [r, r + 1]) { const ty = this.rowType(run, q); if (ty !== 'water' && ty !== 'beyond' && ty !== 'wall') return q; } return null; }
  barnWalls(g) {
    const fw = Math.min(this.bx, this.tile * 1.6), xl = this.bx - fw, xr = this.bx + this.bw + fw;
    if (xl < this.tile * 0.5) return;
    for (const [x0, x1] of [[-20, xl], [xr, this.w + 20]]) {
      g.fillStyle = vgrad(g, 0, this.h, '#5C3B24', '#3E2617'); g.fillRect(x0, -20, x1 - x0, this.h + 40);
      g.fillStyle = 'rgba(0,0,0,0.22)'; for (let x = x0 + this.tile * 0.32; x < x1; x += this.tile * 0.32) g.fillRect(x, -20, 2, this.h + 40);
      const px = x0 === -20 ? x1 - this.tile * 0.22 : x0; g.fillStyle = '#2E1C10'; g.fillRect(px, -20, this.tile * 0.22, this.h + 40); g.fillStyle = 'rgba(255,210,150,0.25)'; g.fillRect(px, -20, 2, this.h + 40);
      // a small warm window per wall
      const wx = (x0 + x1) / 2 - this.tile * 0.35, wy = this.h * 0.35; if (x1 - x0 > this.tile * 1.2) { g.fillStyle = '#2E1C10'; g.fillRect(wx - 4, wy - 4, this.tile * 0.7 + 8, this.tile * 0.6 + 8); g.fillStyle = '#FFC876'; g.fillRect(wx, wy, this.tile * 0.7, this.tile * 0.6); g.fillStyle = '#2E1C10'; g.fillRect(wx + this.tile * 0.33, wy, 3, this.tile * 0.6); g.fillRect(wx, wy + this.tile * 0.28, this.tile * 0.7, 3); }
    }
  }

  lamps(g, run, rBot, rTop, t) {
    g.save(); g.globalCompositeOperation = 'lighter';
    // diagonal rafter shadows across the barn floor (static)
    g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(70,40,20,0.09)'; // plain fill: multiply is slow in software
    for (let i = -2; i < 8; i++) { const x0 = i * this.tile * 2.6 + this.bx * 0.3; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + this.tile * 0.8, 0); g.lineTo(x0 + this.tile * 0.8 - this.h * 0.7, this.h); g.lineTo(x0 - this.h * 0.7, this.h); g.closePath(); g.fill(); }
    g.restore();
    for (let r0 = Math.max(0, rBot) - (Math.max(0, rBot) % 3); r0 <= rTop; r0 += 3) {
      const r = this.lampRow(run, r0); if (r == null) continue;
      const edge = (r0 / 3) % 2 ? 1 : 0, x = this.bw <= this.w ? (edge ? this.bx + this.bw - this.tile * 0.4 : this.bx + this.tile * 0.4) : (edge ? this.w - this.tile * 0.6 : this.tile * 0.6), y = this.sy(r);
      const fl = 0.9 + Math.sin(t * 7 + r) * (this.reduced ? 0 : 0.06);
      const gr = g.createRadialGradient(x, y, 0, x, y, this.tile * 2.4);
      gr.addColorStop(0, `rgba(255,180,90,${0.34 * fl})`); gr.addColorStop(0.5, `rgba(255,150,60,${0.14 * fl})`); gr.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gr; g.fillRect(x - this.tile * 2.4, y - this.tile * 2.4, this.tile * 4.8, this.tile * 4.8); // only the lit disc: 'lighter' is per-pixel costly in software
    }
    g.restore();
    // the heat-lamp fixtures hanging over those glows (portrait has no margins to hang them in: glows only)
    if (this.bw > this.w) return;
    for (let r0 = Math.max(0, rBot) - (Math.max(0, rBot) % 3); r0 <= rTop; r0 += 3) {
      const r = this.lampRow(run, r0); if (r == null) continue;
      // fixtures hang just outside the playfield (desktop margins) or at the screen edge (portrait), never over a lane
      const edge = (r0 / 3) % 2 ? 1 : 0, x = this.bw <= this.w ? (edge ? this.bx + this.bw + this.tile * 0.35 : this.bx - this.tile * 0.35) : (edge ? this.w - this.tile * 0.3 : this.tile * 0.3), yb = this.sy(r) - this.rh / 2;
      // the crossbeam it hangs from, laid along the row boundary so it never covers a lane
      const bh = Math.max(8, this.rh * 0.22), x0 = Math.max(0, this.bx), x1 = Math.min(this.w, this.bx + this.bw);
      // overhead beam: solid timber in the margins, only a faint shadow across the board so nothing on a lane is hidden
      for (const [a, b] of [[-20, x0], [x1, this.w + 20]]) if (b > a) { g.fillStyle = '#4A2E1C'; g.fillRect(a, yb - bh / 2, b - a, bh); g.fillStyle = 'rgba(255,200,140,0.35)'; g.fillRect(a, yb - bh / 2, b - a, Math.max(1, bh * 0.25)); }
      g.fillStyle = 'rgba(40,20,8,0.16)'; g.fillRect(x0, yb - bh / 2, x1 - x0, bh);
      if (this.bw > this.w) { const sx0 = edge ? this.w - this.tile * 0.55 : 0; g.fillStyle = '#4A2E1C'; g.fillRect(sx0, yb - bh / 2, this.tile * 0.55, bh); }
      g.save(); g.translate(x, yb - bh * 0.2); if (!this.propAt(g, 'lamp', this.tile * 0.5, 0)) { g.fillStyle = '#5A4A3A'; g.beginPath(); g.arc(0, 0, this.tile * 0.25, Math.PI, 0); g.fill(); g.fillStyle = '#FFB347'; g.beginPath(); g.arc(0, 0, this.tile * 0.1, 0, Math.PI * 2); g.fill(); } g.restore();
    }
  }

  night(g, run, rBot, rTop, t) {
    // darkness: clear in a pool around Bandit, deepening to navy away from him (one gradient fill, cheap in software)
    { const pp = playerPose(run.p), px = this.sx(pp.x), py = this.sy(pp.row), r1 = Math.hypot(this.w, this.h) * 0.62, gr = g.createRadialGradient(px, py, this.tile * 1.1, px, py, r1);
      gr.addColorStop(0, 'rgba(22,30,74,0.3)'); gr.addColorStop(0.3, 'rgba(12,18,50,0.62)'); gr.addColorStop(1, 'rgba(6,12,36,0.8)'); // moonlight tint and darkness in one pass
      g.fillStyle = gr; g.fillRect(-20, -20, this.w + 40, this.h + 40); }
    // the margin lanterns throw warm pools on the ground
    if (this.lights.length) { g.save(); g.globalCompositeOperation = 'lighter';
      for (const l of this.lights) { const rr = this.tile * 1.5, gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, rr); gr.addColorStop(0, 'rgba(255,190,90,0.38)'); gr.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = gr; g.fillRect(l.x - rr, l.y - rr, rr * 2, rr * 2); }
      g.restore(); }
    // moonlight: gators come back faintly so their shapes read, the eyes glow on top
    g.save(); g.globalAlpha = 0.46;
    for (const gt of run.world.gators) if (gt.row >= rBot - 1 && gt.row <= rTop + 1) this.drawGator(g, run, gt, t, true);
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const gt of run.world.gators) {
      if (gt.row < rBot - 1 || gt.row > rTop + 1) continue;
      const art = this.art && this.art.gator(gt), water = this.rowType(run, gt.row) === 'water';
      const gw = gt.len * this.tile * (gt.k === 'hatchling' ? 1.45 : 1.04), gh = art ? this.gatorSize(gt, art, water).h : this.tile * 0.6, s = this.tile * 0.86;
      const base = this.sy(gt.row + (gt.rows === 2 ? 0.5 : 0)) + this.rh * (water ? 0.4 : 0.36);
      const x = this.sx(nose(gt)) - gt.dir * gw * (gt.k === 'hatchling' ? 0.4 : gt.k === 'boss' ? 0.2 : 0.215), y = base - gh * (water ? 0.72 : 0.94) + gh * (gt.k === 'boss' ? 0.36 : 0.2);
      // eyeshine: a tight bright dot on the painted eye (the boss glows red)
      const er = s * (gt.k === 'boss' ? 0.16 : 0.12), gr = g.createRadialGradient(x, y, 0, x, y, er);
      gr.addColorStop(0, gt.k === 'boss' ? 'rgba(255,120,90,1)' : 'rgba(255,245,150,1)'); gr.addColorStop(0.35, gt.k === 'boss' ? 'rgba(255,70,40,0.7)' : 'rgba(255,220,80,0.6)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
      g.fillStyle = gr; g.fillRect(x - er, y - er, er * 2, er * 2);
    }
    // flashlight beams
    if (run.L.beams) for (const b of run.L.beams) {
      const { cx, hw } = beamAt(b, run.world.t), x = this.sx(cx), y0 = this.sy(b.r1 + 0.5), y1 = this.sy(b.r0 - 0.5), ym = (y0 + y1) / 2;
      // an elliptical gradient (scaled circle), so the pool feathers out on every side with no clipped edge
      const rx = hw * this.k * 1.25, ry = (y1 - y0) * 0.8, gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, 'rgba(255,245,200,0.62)'); gr.addColorStop(0.55, 'rgba(255,235,170,0.36)'); gr.addColorStop(1, 'rgba(255,235,160,0)');
      g.save(); g.translate(x, ym); g.scale(1, ry / rx); g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore();
      // the cone back to a keeper off the top-right of the board
      // feathered: three nested wedges, widest faintest
      const kx = this.bx + this.bw + this.tile, ky = y0 - this.rh * 4;
      for (const [sp, a] of [[1.25, 0.03], [1, 0.035], [0.7, 0.04]]) { g.fillStyle = `rgba(255,240,180,${a})`; g.beginPath(); g.moveTo(kx, ky); g.lineTo(x - hw * this.k * sp, ym); g.lineTo(x + hw * this.k * sp, ym); g.closePath(); g.fill(); }
    }
    g.restore();
    // telegraphs sit above the darkness at full brightness (the feathered rim band marks the beam edge)
    for (const gt of run.world.gators) {
      if (gt.row < rBot - 1 || gt.row > rTop + 1) continue;
      const water = this.rowType(run, gt.row) === 'water';
      this.telegraph(g, gt, this.sx(nose(gt)), this.sy(gt.row + (gt.rows === 2 ? 0.5 : 0)) + this.rh * (water ? 0.4 : 0.36), t);
    }
  }

  overlays(g, run, t) {
    // feeding-show drumsticks falling onto their shadows
    for (const s of warnings(run.world)) {
      const u = (run.world.t - s.warn) / (s.t0 - s.warn), x = this.sx(s.x), y = this.sy(s.row) + this.rh * 0.2;
      g.fillStyle = `rgba(0,0,0,${0.15 + u * 0.3})`; g.beginPath(); g.ellipse(x, y, this.tile * (0.2 + u * 0.3), this.tile * (0.08 + u * 0.1), 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(x, y - (1 - u) * this.h * 0.5); item(g, this.tile * 1.2, 'drum', t); g.restore();
      g.save(); g.translate(x, y - this.tile * 1.1); badge(g, this.tile * 0.9, t); g.restore();
    }
    // the player's lures in flight
    for (const L of run.world.lures) {
      if (L.done) continue;
      const u = Math.min(1, (run.world.t - L.t0) / (L.land - L.t0));
      const x = this.sx(L.from.x + (L.x - L.from.x) * u), r = L.from.row + (L.row - L.from.row) * u, y = this.sy(r) - Math.sin(Math.PI * u) * this.tile * 1.4;
      g.save(); g.translate(x, y); g.rotate(u * 9); item(g, this.tile, 'drum', t); g.restore();
    }
    // the endless keeper's lantern line
    if (run.beam != null) {
      const y = this.sy(run.beam);
      const gr = g.createLinearGradient(0, y - this.rh, 0, y + this.rh * 3);
      gr.addColorStop(0, 'rgba(255,236,150,0)'); gr.addColorStop(0.25, 'rgba(255,236,150,0.55)'); gr.addColorStop(1, 'rgba(255,220,120,0.15)');
      g.fillStyle = gr; g.fillRect(0, y - this.rh, this.w, this.rh * 4 + this.h);
      g.setLineDash([10, 8]); g.strokeStyle = '#FFE58A'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.lineTo(this.w, y); g.stroke(); g.setLineDash([]);
    }
  }

  drawTitle(t) {
    const img = this.art && this.art.title, g = this.g, { w, h, dpr } = this;
    if (!img) return false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = this.reduced ? 1.04 : 1.06 + Math.sin(t * 0.15) * 0.03, sc = Math.max(w / img.width, h / img.height) * z;
    const dx = this.reduced ? 0 : Math.sin(t * 0.11) * w * 0.015;
    g.drawImage(img, (w - img.width * sc) / 2 + dx, (h - img.height * sc) / 2, img.width * sc, img.height * sc);
    return true;
  }

  // events from the run → FX and camera kick
  onEvent(e, run) {
    const p = run.p, r = p.row, x = p.x;
    switch (e.k) {
      case 'land': this.landT = 0; if (!e.ride && !e.pool) this.fx.dust(x, r, 7); if (e.pool) { this.fx.splash(x, r); } if (e.ride) { this.fx.rings.push({ x, r, t: 0, life: 0.5, c: '#E9FBFF', w: 40 }); this.fx.splash(x, r); } break;
      case 'hop': this.fx.dust(x, r, 4, 'rgba(255,255,255,0.8)'); break;
      case 'die':
        if (e.cause === 'splash') this.fx.splash(e.x, e.row);
        else if (e.cause === 'chomp') { this.fx.chomp(e.x, e.row); this.shake = 1; }
        else this.fx.sparkle(e.x, e.row, '#FFFFFF', 6);
        break;
      case 'pickup': this.fx.sparkle(colX(e.c), e.r, e.item === 'ball' ? '#FFFFFF' : '#FFF3A6', e.item === 'ball' ? 16 : 8); this.fx.text(colX(e.c), e.r, { cap: '+25', ball: '+500', drum: 'Lure!', ticket: 'Ticket!' }[e.item] || 'Snack!', '#FFF3A6'); break;
      case 'wash': this.fx.splash(x, r); this.fx.text(x, r, 'Washed ×2!', '#9FF0FF'); for (let i = 0; i < 6; i++) this.fx.steam(x, r); break;
      case 'bank': this.fx.text(x, r, `+${e.pts}`, '#FFE27A'); this.fx.sparkle(x, r, '#FFE27A', 12); break;
      case 'streak': this.fx.text(x, r, `×${e.mult}`, '#FFB347'); break;
      case 'fling': this.fx.splash(x, r); this.fx.text(x, r, 'Fling!', '#FFFFFF'); break;
      case 'respawn': this.snap(e.row, run.p.x); break;
      default: break;
    }
  }
}

function vgrad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }
export { T };
