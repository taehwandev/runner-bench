// Procedural canvas textures. Everything visual is generated here — no image assets.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c, repeat, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * f) | 0, g = Math.min(255, ((n >> 8) & 255) * f) | 0, b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

export const NEON = ['#ff2bd6', '#00e5ff', '#ffb000', '#7cff4f', '#ff3355', '#a259ff', '#ff7a00', '#e8f6ff'];

// ---------- building facades (12m wide x 25.6m tall per tile) ----------
export const FACADE_W = 12, FACADE_H = 25.6;
export function windowTexture(style, seed) {
  const W = 256, H = 512, c = mk(W, H), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = style === 3 ? '#0b0a12' : '#08070d'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(160,150,255,${r() * 0.025})`; g.fillRect(r() * W, r() * H, 2 + r() * 30, 1 + r() * 2); }
  const cols = 8, rows = 16, cw = W / cols, ch = H / rows;
  const warm = ['#ffcf8a', '#ffe1b0', '#ffb86b', '#fff1d6'], cool = ['#9fdcff', '#c9e8ff', '#a99bff'], acc = ['#ff6ad5', '#6affea', '#ff9a3c'];
  const litP = style === 2 ? 0.2 : style === 3 ? 0.5 : 0.36;
  for (let y = 0; y < rows; y++) {
    const floorP = r() < 0.12 ? 0.92 : r() < 0.15 ? 0.03 : litP;
    for (let x = 0; x < cols; x++) {
      const wx = x * cw, wy = y * ch;
      let ix, iy, iw, ih;
      if (style === 1) { ix = wx + 1; iw = cw - 2; iy = wy + ch * 0.22; ih = ch * 0.58; }
      else if (style === 3) { ix = wx + cw * 0.1; iw = cw * 0.8; iy = wy + ch * 0.12; ih = ch * 0.76; }
      else { ix = wx + cw * 0.2; iw = cw * 0.6; iy = wy + ch * 0.2; ih = ch * 0.6; }
      if (r() < floorP) {
        const pal = r() < 0.62 ? warm : (r() < 0.8 ? cool : acc);
        const col = pal[(r() * pal.length) | 0];
        const gr = g.createLinearGradient(0, iy, 0, iy + ih);
        gr.addColorStop(0, col); gr.addColorStop(1, shade(col, 0.5));
        g.globalAlpha = 0.45 + r() * 0.55; g.fillStyle = gr; g.fillRect(ix, iy, iw, ih);
        if (r() < 0.3) { g.fillStyle = 'rgba(0,0,0,0.38)'; for (let k = 0; k < ih; k += 3) g.fillRect(ix, iy + k, iw, 1); }
        if (r() < 0.14) {
          g.fillStyle = 'rgba(0,0,0,0.65)'; const cx = ix + iw * (0.3 + r() * 0.4);
          g.beginPath(); g.ellipse(cx, iy + ih * 0.42, iw * 0.11, ih * 0.16, 0, 0, 7); g.fill();
          g.fillRect(cx - iw * 0.15, iy + ih * 0.58, iw * 0.3, ih * 0.42);
        }
        g.globalAlpha = 1;
      } else {
        g.fillStyle = r() < 0.5 ? '#121521' : '#0d0f18'; g.fillRect(ix, iy, iw, ih);
        g.fillStyle = 'rgba(140,150,255,0.07)'; g.fillRect(ix, iy, iw * 0.35, ih);
      }
    }
    if (style === 1) { g.fillStyle = '#16141f'; g.fillRect(0, y * ch, W, 2); }
  }
  if (style === 1) for (let x = 0; x <= cols; x++) { g.fillStyle = '#05050a'; g.fillRect(x * cw - 1, 0, 2, H); }
  return toTex(c, true);
}

// ---------- sign atlas: 32 horizontal (256x64) + 16 vertical blades (128x256) ----------
export const SIGN_H = ['NOODLE BAR', 'HOTEL', 'KARAOKE', '24/7', 'ARCADE', 'SUSHI', 'RAMEN', 'CLUB VOID', 'PHARMACY', 'PACHINKO', 'CYBER CAFE', 'BAR', 'LIVE', 'MOTEL', 'NEON', 'LOVE',
  'DINER', 'RADIO', 'OPEN', 'TATTOO', 'PARKING', 'METRO', 'CINEMA', 'DANCE', 'BEER', 'LOTTO', 'GARAGE', 'SYNTH', 'DREAM', 'PIZZA', 'TAXI', 'NIGHTLINE'];
export const SIGN_V = ['ラーメン', 'ホテル', 'カラオケ', 'BAR', '酒場', '寿司', 'HOTEL', '麺', '夜市', 'CLUB', '電気', 'OPEN', '薬局', 'KTV', '茶', 'ネオン'];
export function signAtlas() {
  const S = 1024, c = mk(S, S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const font = '"Roboto Condensed","Arial Narrow","sans-serif-condensed",Impact,sans-serif';
  const cells = { h: [], v: [] };
  for (let i = 0; i < 32; i++) {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 64, col = NEON[i % NEON.length];
    g.save();
    g.fillStyle = '#0b0712'; roundRect(g, x + 3, y + 3, 250, 58, 10); g.fill();
    g.shadowColor = col; g.shadowBlur = 10; g.strokeStyle = col; g.lineWidth = 3; roundRect(g, x + 7, y + 7, 242, 50, 8); g.stroke();
    const word = SIGN_H[i];
    let fs = 40; g.font = `italic 900 ${fs}px ${font}`;
    const w = g.measureText(word).width; if (w > 220) { fs = Math.floor(fs * 220 / w); g.font = `italic 900 ${fs}px ${font}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 16; g.fillStyle = col; g.fillText(word, x + 128, y + 33);
    g.shadowBlur = 4; g.globalAlpha = 0.75; g.fillStyle = '#fff'; g.fillText(word, x + 128, y + 33);
    g.restore();
    cells.h.push(cellUV(x, y, 256, 64, S));
  }
  for (let i = 0; i < 16; i++) {
    const x = (i % 8) * 128, y = 512 + Math.floor(i / 8) * 256, col = NEON[(i * 3 + 1) % NEON.length];
    if (i === 15) { g.fillStyle = '#fff'; g.fillRect(x, y, 128, 256); cells.v.push(cellUV(x, y, 128, 256, S)); continue; }
    g.save();
    g.fillStyle = '#0b0712'; roundRect(g, x + 4, y + 4, 120, 248, 12); g.fill();
    g.shadowColor = col; g.shadowBlur = 10; g.strokeStyle = col; g.lineWidth = 4; roundRect(g, x + 10, y + 10, 108, 236, 10); g.stroke();
    const word = SIGN_V[i]; const chars = [...word];
    const step = Math.min(56, 220 / chars.length);
    g.font = `900 ${Math.floor(step * 0.9)}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    chars.forEach((ch, k) => {
      const cy = y + 128 + (k - (chars.length - 1) / 2) * step;
      g.shadowBlur = 16; g.globalAlpha = 1; g.fillStyle = col; g.fillText(ch, x + 64, cy);
      g.shadowBlur = 3; g.globalAlpha = 0.7; g.fillStyle = '#fff'; g.fillText(ch, x + 64, cy);
    });
    g.restore();
    cells.v.push(cellUV(x, y, 128, 256, S));
  }
  const t = toTex(c, false); t.userData = cells; return t;
}
function cellUV(x, y, w, h, S) { return [x / S, 1 - (y + h) / S, (x + w) / S, 1 - y / S]; }
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ---------- storefront atlas 4x4 ----------
export function shopAtlas() {
  const S = 512, c = mk(S, S), g = c.getContext('2d'), r = rng(77);
  const cells = [];
  const tints = ['#ffb36b', '#7fd9ff', '#ff79d2', '#b9ff8a', '#ffe08a', '#c39bff'];
  for (let i = 0; i < 16; i++) {
    const x = (i % 4) * 128, y = Math.floor(i / 4) * 128;
    if (i % 5 === 4) { // closed shutter with graffiti
      g.fillStyle = '#2a2833'; g.fillRect(x, y, 128, 128);
      for (let k = 0; k < 128; k += 6) { g.fillStyle = '#1b1a22'; g.fillRect(x, y + k, 128, 2); }
      g.save(); g.globalAlpha = 0.8; g.lineWidth = 5; g.strokeStyle = NEON[i % NEON.length]; g.shadowColor = g.strokeStyle; g.shadowBlur = 6;
      g.beginPath(); g.moveTo(x + 15, y + 80); for (let k = 0; k < 6; k++) g.lineTo(x + 20 + k * 18, y + 50 + r() * 50); g.stroke(); g.restore();
    } else {
      const t = tints[i % tints.length];
      const gr = g.createLinearGradient(0, y, 0, y + 128); gr.addColorStop(0, t); gr.addColorStop(1, shade(t, 0.35));
      g.fillStyle = gr; g.fillRect(x, y, 128, 128);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      for (let k = 0; k < 3; k++) g.fillRect(x + 6, y + 40 + k * 26, 116, 4);
      for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(0,0,0,${0.2 + r() * 0.3})`; g.fillRect(x + 8 + r() * 108, y + 26 + Math.floor(r() * 3) * 26, 5 + r() * 8, 12); }
      for (let k = 0; k < 2; k++) {
        if (r() < 0.6) {
          const px = x + 20 + r() * 88; g.fillStyle = 'rgba(10,5,20,0.85)';
          g.beginPath(); g.arc(px, y + 70, 9, 0, 7); g.fill(); g.fillRect(px - 12, y + 80, 24, 48);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, 128, 6); g.fillRect(x + 62, y, 4, 128);
    }
    cells.push(cellUV(x, y, 128, 128, S));
  }
  const t = toTex(c, false); t.userData = cells; return t;
}

// ---------- road: 7.6m wide, 20m per tile ----------
export const ROAD_W = 7.6, ROAD_TILE = 20;
export function roadTextures() {
  const W = 512, H = 1024, c = mk(W, H), g = c.getContext('2d'), r = rng(5);
  const rc = mk(W / 2, H / 2), rg = rc.getContext('2d');
  g.fillStyle = '#17161d'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const v = 18 + r() * 26; g.fillStyle = `rgb(${v},${v},${v + 6})`; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  // tire tracks
  const px = (x) => (x + ROAD_W / 2) / ROAD_W * W;
  for (const lx of [-2.3, 0, 2.3]) for (const o of [-0.55, 0.55]) {
    const gr = g.createLinearGradient(px(lx + o) - 14, 0, px(lx + o) + 14, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(px(lx + o) - 14, 0, 28, H);
  }
  // roughness base
  rg.fillStyle = '#c8c8c8'; rg.fillRect(0, 0, W / 2, H / 2);
  for (let i = 0; i < 1500; i++) { const v = 150 + r() * 90 | 0; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(r() * W / 2, r() * H / 2, 2, 2); }
  // puddles
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, rx = 30 + r() * 80, ry = 60 + r() * 160;
    g.save(); g.globalAlpha = 0.55; g.fillStyle = '#0b0b12'; blob(g, x, y, rx, ry, r); g.restore();
    rg.save(); rg.fillStyle = '#2a2a2a'; blob(rg, x / 2, y / 2, rx / 2, ry / 2, r); rg.restore();
    if (y + ry > H) { g.save(); g.globalAlpha = 0.55; g.fillStyle = '#0b0b12'; blob(g, x, y - H, rx, ry, r); g.restore(); rg.fillStyle = '#2a2a2a'; blob(rg, x / 2, (y - H) / 2, rx / 2, ry / 2, r); }
    if (y - ry < 0) { g.save(); g.globalAlpha = 0.55; g.fillStyle = '#0b0b12'; blob(g, x, y + H, rx, ry, r); g.restore(); rg.fillStyle = '#2a2a2a'; blob(rg, x / 2, (y + H) / 2, rx / 2, ry / 2, r); }
  }
  // cracks / patches
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) { g.beginPath(); let x = r() * W, y = r() * H; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += r() * 30; g.lineTo(x, y); } g.stroke(); }
  // lane dashes (between lanes) and edge lines
  const m2p = H / ROAD_TILE;
  for (const lx of [-1.15, 1.15]) {
    for (const d0 of [1, 11]) {
      g.fillStyle = '#d9d6e8'; g.globalAlpha = 0.85; g.fillRect(px(lx) - 4, H - (d0 + 4) * m2p, 8, 4 * m2p);
      rg.fillStyle = '#5a5a5a'; rg.fillRect(px(lx) / 2 - 2, (H - (d0 + 4) * m2p) / 2, 4, 2 * m2p);
    }
  }
  g.globalAlpha = 1;
  for (const lx of [-3.5, 3.5]) { g.fillStyle = '#e8c547'; g.fillRect(px(lx) - 4, 0, 8, H); }
  // manhole
  g.fillStyle = '#26252e'; g.beginPath(); g.arc(px(1.15 + 0.9), H * 0.3, 18, 0, 7); g.fill();
  g.strokeStyle = '#3a3944'; g.lineWidth = 2; for (let k = -12; k <= 12; k += 6) { g.beginPath(); g.moveTo(px(2.05) - 14, H * 0.3 + k); g.lineTo(px(2.05) + 14, H * 0.3 + k); g.stroke(); }
  const map = toTex(c, true), rough = toTex(rc, true, false);
  return { map, rough };
}
function blob(g, x, y, rx, ry, r) {
  g.beginPath(); const n = 12;
  for (let i = 0; i <= n; i++) {
    const a = i / n * Math.PI * 2, k = 0.75 + r() * 0.35;
    const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}

export function sidewalkTexture() {
  const W = 256, H = 1024, c = mk(W, H), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#2a2833'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { const v = 30 + r() * 30; g.fillStyle = `rgb(${v},${v - 2},${v + 8})`; g.fillRect(r() * W, r() * H, 2, 2); }
  g.strokeStyle = '#17161d'; g.lineWidth = 3;
  const tile = H / 13.33;
  for (let y = 0; y < H; y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let x = 0; x < W; x += W / 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.globalAlpha = 0.5; g.fillStyle = '#121119'; blob(g, r() * W, r() * H, 20 + r() * 30, 40 + r() * 60, r); }
  g.globalAlpha = 1;
  return toTex(c, true);
}

export function tunnelTexture() {
  const W = 256, H = 256, c = mk(W, H), g = c.getContext('2d'), r = rng(12);
  g.fillStyle = '#25242c'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const v = 44 + r() * 14 | 0; g.fillStyle = `rgb(${v},${v},${v + 8})`; g.fillRect(x * 64 + 2, y * 32 + 2, 60, 28);
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.3})`; g.fillRect(r() * W, r() * H, 3 + r() * 10, 10 + r() * 60); }
  return toTex(c, true);
}

export function stripeTexture(a, b, n = 6) {
  const c = mk(128, 32), g = c.getContext('2d');
  g.fillStyle = b; g.fillRect(0, 0, 128, 32);
  g.fillStyle = a;
  const w = 128 / n;
  for (let i = -1; i < n + 1; i++) { g.beginPath(); g.moveTo(i * w, 32); g.lineTo(i * w + w / 2, 32); g.lineTo(i * w + w, 0); g.lineTo(i * w + w / 2, 0); g.closePath(); g.fill(); }
  return toTex(c, true);
}

export function meshTexture() {
  const c = mk(64, 64), g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(200,200,220,0.9)'; g.lineWidth = 2;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); }
  return toTex(c, true);
}

export function glowTexture() {
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return toTex(c, false);
}

export function skylineTexture(seed, tall) {
  const W = 2048, H = 512, c = mk(W, H), g = c.getContext('2d'), r = rng(seed);
  g.clearRect(0, 0, W, H);
  let x = 0;
  while (x < W) {
    const w = 30 + r() * 90, h = (tall ? 120 : 60) + r() * (tall ? 340 : 200);
    g.fillStyle = tall ? '#0d0a1c' : '#150f28';
    g.fillRect(x, H - h, w, h);
    if (r() < 0.3) { g.fillRect(x + w * 0.4, H - h - 30 - r() * 60, 3, 90); }
    for (let wy = H - h + 8; wy < H - 4; wy += 9) for (let wx = x + 4; wx < x + w - 4; wx += 7) {
      if (r() < 0.16) { g.fillStyle = r() < 0.7 ? 'rgba(255,200,140,0.75)' : 'rgba(140,220,255,0.75)'; g.fillRect(wx, wy, 3, 4); }
    }
    if (r() < 0.25) { g.fillStyle = r() < 0.5 ? '#ff2bd6' : '#00e5ff'; g.fillRect(x + 4, H - h + 10 + r() * 30, w - 8, 3); }
    if (r() < 0.3) { g.fillStyle = '#ff3040'; g.fillRect(x + w / 2, H - h - 2, 3, 3); }
    x += w + r() * 6;
  }
  return toTex(c, true);
}
