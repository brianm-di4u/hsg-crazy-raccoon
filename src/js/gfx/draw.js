// Vector cartoon art: chunky outlined shapes with soft top-lit gradients (the fallback for, and the silhouette
// guide to, the painted and Blender sprites). Every function draws at the current transform in tile units
// scaled by `s` (pixels per tile), anchored at the actor's foot point.

export const INK = '#1B1A17';
export const PAL = {
  day: { sky0: '#8ED1F2', sky1: '#D8F0F7', ridge0: '#5D7F57', ridge1: '#7FA06E', ridgeFar: '#9DBBB0', grass: '#7CC04B', grass2: '#64A63A', path: '#DDBB82', path2: '#C9A56C', sand: '#EAD292', sand2: '#D9BD78', board: '#BC8A55', board2: '#9E6F40', straw: '#E0BE5E', straw2: '#C9A447', water: '#3DB0C0', water2: '#23849A', lip: '#EFE7D2', lip2: '#C9BFA6', wall: '#8C8573', fence: '#9C6B3E' },
  noon: { sky0: '#7FCBF5', sky1: '#F4F1D0', ridge0: '#5F8556', ridge1: '#86A86F', ridgeFar: '#A9C3B2', grass: '#88C850', grass2: '#6CAE3E', path: '#E6C68C', path2: '#D2AF72', sand: '#F0D895', sand2: '#DEC07A', board: '#C4925A', board2: '#A57443', straw: '#E6C664', straw2: '#CFAA4B', water: '#45B8C4', water2: '#2A8DA0', lip: '#F3EBD6', lip2: '#CFC5AB', wall: '#918A76', fence: '#A3713F' },
  barn: { sky0: '#5B3B26', sky1: '#8A5A36', ridge0: '#4A301F', ridge1: '#5E3E28', ridgeFar: '#6E4C33', grass: '#B79A52', grass2: '#9C8143', path: '#A88A5C', path2: '#8F744A', sand: '#C2A468', sand2: '#A98C55', board: '#9A6B40', board2: '#7C5432', straw: '#D9B456', straw2: '#BE9A42', water: '#3C8E95', water2: '#26686F', lip: '#C9BCA0', lip2: '#A39478', wall: '#6B5139', fence: '#7A512E' },
  night: { sky0: '#141E3C', sky1: '#2B3D66', ridge0: '#1B2A3E', ridge1: '#24374E', ridgeFar: '#33496A', grass: '#4E7F45', grass2: '#3F6B39', path: '#9C8C70', path2: '#86775E', sand: '#A89772', sand2: '#91815F', board: '#7E6248', board2: '#664E39', straw: '#9C8650', straw2: '#857141', water: '#27606E', water2: '#1A4652', lip: '#B3AE9F', lip2: '#8E8A7D', wall: '#58554D', fence: '#6A5038' },
};

const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
export function blob(g, path, fill, lw, ink = INK) {
  g.beginPath(); path(g); g.closePath();
  g.fillStyle = fill; g.fill();
  if (lw > 0) { g.lineWidth = lw; g.strokeStyle = ink; g.lineJoin = 'round'; g.stroke(); }
}
export function shadow(g, w, h, a = 0.28) { g.fillStyle = `rgba(20,30,20,${a})`; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill(); }

// --- Gator, facing +x (mirror for -x), nose at x=0, body to the left. len in tiles, s = px per tile.
// ja: jaw 0..1, tele: warning flag, k: kind, ph: swim phase, sub: 0..1 how far submerged, eyesOnly: night
const GSKIN = {
  paddler: ['#6FA14A', '#3E6B2E', '#B9C97C'], whipper: ['#7F9C3E', '#4C6424', '#D4C770'], basker: ['#8A9A55', '#55623A', '#C9C690'],
  sleeper: ['#7C8C61', '#4E5B3F', '#C2C49A'], hatchling: ['#93C35A', '#5D8A36', '#E4E7A0'], boss: ['#5A7A44', '#2F4826', '#A8B47A'],
};
export function gator(g, s, len, o = {}) {
  const k = o.k || 'paddler', [c0, c1, belly] = GSKIN[k] || GSKIN.paddler, lw = Math.max(1.5, s * 0.055);
  const L = len * s, H = s * (k === 'hatchling' ? 0.42 : k === 'boss' ? 1.15 : 0.62), ph = o.ph || 0, ja = o.ja || 0;
  const headL = Math.min(L * 0.36, s * (k === 'boss' ? 2 : 1.05)), tailL = L * 0.36, bodyL = L - headL - tailL * 0.55;
  const top = -H, mid = -H * 0.45;
  g.save();
  // tail: a tapering, swaying wedge
  const sway = Math.sin(ph * 3) * s * 0.08 + (o.whip || 0) * s * 0.5;
  const tx0 = -headL - bodyL;
  blob(g, (p) => { p.moveTo(tx0 + s * 0.1, top * 0.78); p.quadraticCurveTo(tx0 - tailL * 0.5, mid + sway * 0.5, -L, mid * 0.6 + sway); p.quadraticCurveTo(tx0 - tailL * 0.45, mid * 0.2, tx0 + s * 0.1, -s * 0.05); }, lin(g, 0, top, 0, 0, [[0, c0], [1, c1]]), lw);
  // legs (hidden when submerged)
  if ((o.sub || 0) < 0.5) for (const lx of [-headL - bodyL * 0.15, -headL - bodyL * 0.8]) {
    const kick = Math.sin(ph * 6 + lx) * s * 0.06;
    blob(g, (p) => { p.ellipse(lx + kick, -s * 0.06, s * 0.16, s * 0.1, 0, 0, Math.PI * 2); }, c1, lw * 0.8);
  }
  // body
  blob(g, (p) => { p.moveTo(-headL + s * 0.05, top * 0.95); p.bezierCurveTo(-headL - bodyL * 0.3, top * 1.12, -headL - bodyL, top * 1.08, tx0, top * 0.75); p.quadraticCurveTo(tx0 - s * 0.12, -s * 0.15, tx0 + s * 0.1, -s * 0.02); p.lineTo(-headL, -s * 0.02); p.closePath(); }, lin(g, 0, top * 1.1, 0, 0, [[0, c0], [0.55, c0], [1, c1]]), lw);
  // belly band (side face)
  g.fillStyle = belly; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(-headL - bodyL * 0.5, -s * 0.1, bodyL * 0.48, H * 0.18, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
  // scutes: a zigzag ridge along the back
  g.fillStyle = c1; g.strokeStyle = INK; g.lineWidth = lw * 0.6;
  const n = Math.max(3, Math.round((bodyL + tailL * 0.5) / (s * 0.28)));
  for (let i = 0; i < n; i++) {
    const x = -headL - s * 0.1 - i * ((bodyL + tailL * 0.45) / n), y = top * (1.04 - (i / n) * 0.35);
    g.beginPath(); g.moveTo(x - s * 0.1, y + s * 0.04); g.lineTo(x - s * 0.04, y - s * 0.1); g.lineTo(x + s * 0.03, y + s * 0.04); g.closePath(); g.fill(); g.stroke();
  }
  // head: lower jaw, upper jaw rotated open by ja
  const hx = -headL, open = ja * 0.55;
  if (ja > 0.05) {
    blob(g, (p) => { p.moveTo(hx, -s * 0.02); p.lineTo(-s * 0.02, -s * 0.06); p.quadraticCurveTo(s * 0.04, -s * 0.18, -s * 0.06, -H * 0.42); p.lineTo(hx, -H * 0.5); }, '#D2546A', lw);
    // lower teeth
    g.fillStyle = '#FFFFFF'; for (let i = 0; i < 5; i++) { const x = hx + (i + 0.6) * headL / 5.5; g.beginPath(); g.moveTo(x, -H * 0.36); g.lineTo(x + s * 0.04, -H * 0.5); g.lineTo(x + s * 0.08, -H * 0.36); g.fill(); }
  }
  g.save(); g.translate(hx, -H * 0.42); g.rotate(-open);
  blob(g, (p) => { p.moveTo(0, -H * 0.55); p.bezierCurveTo(headL * 0.5, -H * 0.62, headL * 0.95, -H * 0.3, headL + s * 0.02, -s * 0.02); p.lineTo(headL * 0.2, s * 0.02); p.lineTo(0, 0); }, lin(g, 0, -H * 0.6, 0, 0, [[0, c0], [1, c1]]), lw);
  // upper teeth peeking out
  g.fillStyle = '#FFFFFF'; g.strokeStyle = INK; g.lineWidth = lw * 0.5;
  for (let i = 0; i < 4; i++) { const x = headL * (0.3 + i * 0.17); g.beginPath(); g.moveTo(x, -s * 0.005); g.lineTo(x + s * 0.035, s * 0.07); g.lineTo(x + s * 0.07, -s * 0.005); g.fill(); g.stroke(); }
  // nostrils
  g.fillStyle = INK; g.beginPath(); g.arc(headL * 0.88, -H * 0.28, s * 0.025, 0, Math.PI * 2); g.fill();
  // banded mouth on hatchlings
  if (k === 'hatchling') { g.strokeStyle = '#E2453C'; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(headL * 0.55, -H * 0.42); g.lineTo(headL * 0.62, s * 0.03); g.stroke(); }
  g.restore();
  // eye bumps with big cartoon eyes and a brow
  const ex = hx + s * 0.08, ey = top * 1.02, er = s * (k === 'boss' ? 0.2 : k === 'hatchling' ? 0.13 : 0.15);
  const asleep = o.asleep;
  blob(g, (p) => p.arc(ex, ey, er * 1.05, 0, Math.PI * 2), c0, lw);
  if (asleep) { g.strokeStyle = INK; g.lineWidth = lw; g.beginPath(); g.arc(ex, ey, er * 0.6, 0.2, Math.PI - 0.2); g.stroke(); }
  else {
    g.fillStyle = o.eyeGlow ? '#F6E35A' : '#FFFFFF'; g.beginPath(); g.ellipse(ex + er * 0.1, ey - er * 0.05, er * 0.72, er * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.ellipse(ex + er * 0.3, ey, er * 0.22, er * 0.48, 0, 0, Math.PI * 2); g.fill();
    // mean brow (boss and open jaws), friendly brow otherwise
    g.strokeStyle = INK; g.lineWidth = lw * 1.3; g.beginPath();
    if (k === 'boss' || ja > 0.5) { g.moveTo(ex - er * 0.7, ey - er * 1.05); g.lineTo(ex + er * 0.9, ey - er * 0.6); } else { g.moveTo(ex - er * 0.6, ey - er * 0.95); g.quadraticCurveTo(ex + er * 0.1, ey - er * 1.25, ex + er * 0.8, ey - er * 0.9); }
    g.stroke();
  }
  if (k === 'boss') { // scar
    g.strokeStyle = '#E6D8B4'; g.lineWidth = lw; g.beginPath(); g.moveTo(-headL - s * 0.6, top * 0.95); g.lineTo(-headL - s * 0.2, top * 0.7); g.moveTo(-headL - s * 0.55, top * 0.78); g.lineTo(-headL - s * 0.3, top * 0.86); g.stroke();
  }
  g.restore();
}

// "!" warning badge (shape + label, never colour alone)
export function badge(g, s, t = 0, glyph = '!') {
  const r = s * 0.22, bob = Math.sin(t * 12) * s * 0.03;
  g.save(); g.translate(0, bob);
  blob(g, (p) => { p.moveTo(0, -r * 1.2); p.lineTo(r * 1.1, r * 0.8); p.lineTo(-r * 1.1, r * 0.8); }, '#FFD23F', Math.max(1.5, s * 0.05));
  g.fillStyle = INK; g.font = `900 ${Math.round(r * 1.3)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(glyph, 0, r * 0.2);
  g.restore();
}

// --- Bandit the raccoon. facing: up (back view), down (front), left, right. sq: squash (-1..1).
export function raccoon(g, s, o = {}) {
  const lw = Math.max(1.5, s * 0.055), f = o.facing || 'up', sq = o.sq || 0;
  const sx = 1 + sq * 0.18, sy = 1 - sq * 0.22;
  g.save(); g.scale(sx, sy);
  const fur = lin(g, 0, -s * 0.95, 0, 0, [[0, '#C3C3C8'], [0.6, '#A2A2A9'], [1, '#808089']]);
  const tail = (dx, dy, rot) => {
    g.save(); g.translate(dx, dy); g.rotate(rot);
    blob(g, (p) => p.ellipse(0, 0, s * 0.17, s * 0.42, 0, 0, Math.PI * 2), '#9A9AA0', lw);
    g.save(); g.beginPath(); g.ellipse(0, 0, s * 0.17, s * 0.42, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2B2A2E'; for (let i = 0; i < 5; i++) g.fillRect(-s * 0.2, -s * 0.36 + i * s * 0.17, s * 0.4, s * 0.075);
    g.restore(); g.restore();
  };
  if (f === 'up') tail(0, -s * 0.38, Math.sin((o.t || 0) * 6) * 0.15);
  if (f === 'left' || f === 'right') tail(f === 'left' ? s * 0.32 : -s * 0.32, -s * 0.38, f === 'left' ? 0.9 : -0.9);
  // body
  blob(g, (p) => p.ellipse(0, -s * 0.33, s * 0.33, s * 0.31, 0, 0, Math.PI * 2), fur, lw);
  // feet
  for (const fx of [-0.17, 0.17]) blob(g, (p) => p.ellipse(fx * s, -s * 0.04, s * 0.1, s * 0.065, 0, 0, Math.PI * 2), '#3A3A40', lw * 0.8);
  // head
  const hy = -s * 0.7, hx = f === 'left' ? -s * 0.08 : f === 'right' ? s * 0.08 : 0;
  for (const ex of [-0.19, 0.19]) blob(g, (p) => { p.moveTo(hx + ex * s - s * 0.09, hy - s * 0.14); p.lineTo(hx + ex * s * 1.15, hy - s * 0.36); p.lineTo(hx + ex * s + s * 0.09, hy - s * 0.14); }, '#7D7D85', lw);
  blob(g, (p) => p.ellipse(hx, hy, s * 0.28, s * 0.23, 0, 0, Math.PI * 2), fur, lw);
  if (f !== 'up') {
    // white face, black bandit mask, eyes
    g.fillStyle = '#F2F0EA'; g.beginPath(); g.ellipse(hx, hy + s * 0.05, s * 0.22, s * 0.16, 0, 0, Math.PI * 2); g.fill();
    const look = f === 'left' ? -1 : f === 'right' ? 1 : 0;
    g.fillStyle = '#25242A'; g.beginPath(); g.ellipse(hx - s * 0.1 + look * s * 0.03, hy - s * 0.01, s * 0.11, s * 0.075, -0.25, 0, Math.PI * 2); g.ellipse(hx + s * 0.1 + look * s * 0.03, hy - s * 0.01, s * 0.11, s * 0.075, 0.25, 0, Math.PI * 2); g.fill();
    for (const ex of [-0.1, 0.1]) {
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(hx + ex * s + look * s * 0.03, hy - s * 0.01, s * 0.05, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(hx + ex * s + look * s * 0.05, hy - s * 0.005, s * 0.025, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#1B1A1F'; g.beginPath(); g.ellipse(hx + look * s * 0.06, hy + s * 0.1, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); g.fill();
    if (o.grin) { g.strokeStyle = INK; g.lineWidth = lw * 0.7; g.beginPath(); g.arc(hx + look * s * 0.05, hy + s * 0.12, s * 0.06, 0.2, Math.PI - 0.2); g.stroke(); }
  } else {
    // back of head: the dark mask band shows at the sides, a pale crown between the ears
    g.fillStyle = '#2E2D33'; g.beginPath(); g.ellipse(hx - s * 0.2, hy + s * 0.02, s * 0.07, s * 0.06, 0, 0, Math.PI * 2); g.ellipse(hx + s * 0.2, hy + s * 0.02, s * 0.07, s * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#D9D9DD'; g.beginPath(); g.ellipse(hx, hy - s * 0.06, s * 0.08, s * 0.1, 0, 0, Math.PI * 2); g.fill();
  }
  if (f === 'down') tail(s * 0.3, -s * 0.18, 1.2);
  // carried snacks peek out of his paws
  if (o.carry) for (let i = 0; i < o.carry; i++) { g.save(); g.translate((i - (o.carry - 1) / 2) * s * 0.16, -s * 0.36); item(g, s * 0.42, o.carryKinds ? o.carryKinds[i] : 'pecan', o.t, o.washed && o.washed[i]); g.restore(); }
  g.restore();
}

// --- items, drawn centred at the origin
export function item(g, s, k, t = 0, washed = false) {
  const lw = Math.max(1.2, s * 0.05);
  g.save();
  if (k === 'pecan') {
    blob(g, (p) => p.ellipse(0, 0, s * 0.2, s * 0.13, -0.3, 0, Math.PI * 2), lin(g, 0, -s * 0.13, 0, s * 0.13, [[0, '#B87B45'], [1, '#7B4A22']]), lw);
    g.strokeStyle = '#5A3518'; g.lineWidth = lw * 0.6; g.beginPath(); g.moveTo(-s * 0.15, s * 0.03); g.quadraticCurveTo(0, -s * 0.08, s * 0.15, -s * 0.06); g.stroke();
  } else if (k === 'berry') {
    for (const [x, y] of [[-0.08, 0.02], [0.08, 0.02], [0, -0.09], [0, 0.1]]) blob(g, (p) => p.arc(x * s, y * s, s * 0.09, 0, Math.PI * 2), lin(g, 0, -s * 0.1, 0, s * 0.1, [[0, '#6A3E8E'], [1, '#3A1F55']]), lw);
    g.fillStyle = '#5FA642'; g.beginPath(); g.ellipse(s * 0.02, -s * 0.2, s * 0.08, s * 0.04, 0.4, 0, Math.PI * 2); g.fill();
  } else if (k === 'cap') {
    blob(g, (p) => { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = s * (i % 2 ? 0.17 : 0.2); p.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.75); } }, lin(g, 0, -s * 0.15, 0, s * 0.15, [[0, '#F2F2F2'], [1, '#A9AEB5']]), lw);
    g.fillStyle = '#D8382F'; g.beginPath(); g.ellipse(0, 0, s * 0.11, s * 0.08, 0, 0, Math.PI * 2); g.fill();
  } else if (k === 'drum') {
    g.save(); g.rotate(-0.6);
    blob(g, (p) => { p.ellipse(-s * 0.05, 0, s * 0.16, s * 0.12, 0, 0, Math.PI * 2); }, lin(g, 0, -s * 0.12, 0, s * 0.12, [[0, '#E9A65A'], [1, '#B06A2A']]), lw);
    blob(g, (p) => { p.rect(s * 0.08, -s * 0.03, s * 0.14, s * 0.06); }, '#F6EFDC', lw * 0.8);
    blob(g, (p) => { p.arc(s * 0.24, -s * 0.03, s * 0.045, 0, Math.PI * 2); p.arc(s * 0.24, s * 0.04, s * 0.045, 0, Math.PI * 2); }, '#F6EFDC', lw * 0.8);
    g.restore();
  } else if (k === 'ball') {
    const bob = Math.sin(t * 3) * s * 0.02;
    blob(g, (p) => p.arc(0, bob, s * 0.18, 0, Math.PI * 2), lin(g, 0, -s * 0.18, 0, s * 0.18, [[0, '#FFFFFF'], [1, '#D9D4C7']]), lw);
    g.strokeStyle = '#D23A30'; g.lineWidth = lw * 0.7;
    g.beginPath(); g.arc(-s * 0.2, bob, s * 0.15, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(s * 0.2, bob, s * 0.15, Math.PI - 0.8, Math.PI + 0.8); g.stroke();
  } else if (k === 'ticket') {
    blob(g, (p) => { p.rect(-s * 0.22, -s * 0.13, s * 0.44, s * 0.26); }, lin(g, 0, -s * 0.13, 0, s * 0.13, [[0, '#FFE27A'], [1, '#D9A928']]), lw);
    g.fillStyle = INK; g.font = `900 ${Math.round(s * 0.18)}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('M', 0, s * 0.01);
  }
  if (washed) { g.fillStyle = 'rgba(255,255,255,0.9)'; const a = t * 4; for (let i = 0; i < 3; i++) { const r = s * 0.24, x = Math.cos(a + i * 2.1) * r, y = Math.sin(a + i * 2.1) * r * 0.6; star4(g, x, y, s * 0.05); } }
  g.restore();
}
export function star4(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r * 2); g.lineTo(x + r * 0.5, y - r * 0.5); g.lineTo(x + r * 2, y); g.lineTo(x + r * 0.5, y + r * 0.5); g.lineTo(x, y + r * 2); g.lineTo(x - r * 0.5, y + r * 0.5); g.lineTo(x - r * 2, y); g.lineTo(x - r * 0.5, y - r * 0.5); g.closePath(); g.fill(); }

// thermal-spring pool stone (thermal-water palette: tufa cream, turquoise, algae fringe)
export function pool(g, s, t = 0) {
  const lw = Math.max(1.2, s * 0.05);
  blob(g, (p) => p.ellipse(0, 0, s * 0.46, s * 0.3, 0, 0, Math.PI * 2), lin(g, 0, -s * 0.3, 0, s * 0.3, [[0, '#F0E6CC'], [1, '#C8B98F']]), lw);
  g.fillStyle = lin(g, 0, -s * 0.2, 0, s * 0.2, [[0, '#7FE0D6'], [1, '#3BB3B0']]); g.beginPath(); g.ellipse(0, -s * 0.02, s * 0.33, s * 0.19, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#6F9B3C'; g.lineWidth = lw; g.beginPath(); g.ellipse(0, -s * 0.02, s * 0.35, s * 0.21, 0, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-s * 0.1, -s * 0.08, s * 0.1, s * 0.04, -0.2, 0, Math.PI * 2); g.fill();
}

// fence post / rail segment, a hay bale, the 1906 tombstone (prop only)
export function post(g, s, fence) {
  const lw = Math.max(1.2, s * 0.05);
  blob(g, (p) => p.rect(-s * 0.09, -s * 0.72, s * 0.18, s * 0.72), lin(g, -s * 0.09, 0, s * 0.09, 0, [[0, '#B47E4A'], [1, fence || '#8A5A30']]), lw);
  blob(g, (p) => { p.moveTo(-s * 0.11, -s * 0.72); p.lineTo(0, -s * 0.84); p.lineTo(s * 0.11, -s * 0.72); }, '#A06B3A', lw);
}
export function rail(g, s, w) { blob(g, (p) => { p.rect(0, -s * 0.6, w, s * 0.1); p.rect(0, -s * 0.32, w, s * 0.1); }, '#B07A45', Math.max(1, s * 0.04)); }
export function hay(g, s) {
  const lw = Math.max(1.2, s * 0.05);
  blob(g, (p) => p.rect(-s * 0.42, -s * 0.55, s * 0.84, s * 0.55), lin(g, 0, -s * 0.55, 0, 0, [[0, '#F0D27A'], [1, '#C9A445']]), lw);
  g.strokeStyle = '#9C7C2C'; g.lineWidth = lw * 0.7; for (const y of [-0.38, -0.18]) { g.beginPath(); g.moveTo(-s * 0.4, y * s); g.lineTo(s * 0.4, y * s); g.stroke(); }
}
export function tomb(g, s) {
  const lw = Math.max(1.2, s * 0.05);
  blob(g, (p) => { p.moveTo(-s * 0.2, 0); p.lineTo(-s * 0.2, -s * 0.4); p.arc(0, -s * 0.4, s * 0.2, Math.PI, 0); p.lineTo(s * 0.2, 0); }, lin(g, 0, -s * 0.6, 0, 0, [[0, '#E1DED6'], [1, '#A9A59B']]), lw);
  g.fillStyle = '#6E6A61'; g.fillRect(-s * 0.1, -s * 0.42, s * 0.2, s * 0.03); g.fillRect(-s * 0.1, -s * 0.32, s * 0.2, s * 0.03);
}
export function pine(g, s, c = '#3E6B3A') {
  const lw = Math.max(1.2, s * 0.04);
  blob(g, (p) => p.rect(-s * 0.06, -s * 0.3, s * 0.12, s * 0.3), '#6B4A2E', lw);
  for (let i = 0; i < 3; i++) blob(g, (p) => { const y = -s * (0.25 + i * 0.32), w = s * (0.48 - i * 0.12); p.moveTo(-w, y); p.lineTo(0, y - s * 0.55); p.lineTo(w, y); }, lin(g, 0, -s * 1.5, 0, 0, [[0, '#5E9A4E'], [1, c]]), lw);
}
export function den(g, s) {
  const lw = Math.max(1.5, s * 0.06);
  blob(g, (p) => { p.moveTo(-s * 1.1, 0); p.quadraticCurveTo(-s * 1.0, -s * 1.3, 0, -s * 1.35); p.quadraticCurveTo(s * 1.0, -s * 1.3, s * 1.1, 0); }, lin(g, 0, -s * 1.3, 0, 0, [[0, '#9B7B55'], [1, '#6A5034']]), lw);
  blob(g, (p) => { p.moveTo(-s * 0.45, 0); p.quadraticCurveTo(-s * 0.42, -s * 0.75, 0, -s * 0.78); p.quadraticCurveTo(s * 0.42, -s * 0.75, s * 0.45, 0); }, '#2A1E14', lw);
  // a few sticks and a leaf on top
  g.strokeStyle = '#5A3F27'; g.lineWidth = lw; for (const a of [-0.6, 0.2, 0.8]) { g.beginPath(); g.moveTo(Math.cos(a + 3.6) * s * 0.9, -s * 1.0 + Math.sin(a) * s * 0.2); g.lineTo(Math.cos(a + 3.6) * s * 0.9 + s * 0.4, -s * 1.15 + Math.sin(a) * s * 0.2); g.stroke(); }
}
