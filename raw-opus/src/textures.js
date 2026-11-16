import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  return t;
}

// Building facade: dark panels with lit windows. Tinted by district palette.
export function facadeTexture(seed, pal, style = 0) {
  const r = rng(seed);
  const [c, g] = canvas(256, 512);
  const base = pal.facade[Math.floor(r() * pal.facade.length)];
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  // subtle vertical panel shading
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = `rgba(255,255,255,${0.015 + r() * 0.03})`; g.fillRect(x, 0, 2, 512);
  }
  const cols = style === 1 ? 4 : style === 2 ? 8 : 6;
  const rows = style === 1 ? 10 : style === 2 ? 22 : 16;
  const cw = 256 / cols, rh = 512 / rows;
  const warm = ['#ffd9a0', '#ffc070', '#fff1d0', '#ffb8e8'];
  const cool = ['#a8f0ff', '#d0e4ff', '#9fffe6'];
  for (let y = 0; y < rows; y++) {
    const rowLit = r() < 0.85;
    for (let x = 0; x < cols; x++) {
      const lit = rowLit && r() < (style === 2 ? 0.35 : 0.5);
      const px = x * cw + cw * 0.18, py = y * rh + rh * 0.22;
      const w = cw * (style === 2 ? 0.75 : 0.64), h = rh * (style === 1 ? 0.62 : 0.56);
      if (lit) {
        const tint = r();
        const col = tint < 0.12 ? pal.neon[Math.floor(r() * pal.neon.length)] : (tint < 0.6 ? warm : cool)[Math.floor(r() * 3)];
        g.fillStyle = col; g.globalAlpha = 0.55 + r() * 0.45;
        g.fillRect(px, py, w, h);
        g.globalAlpha = 0.25; g.fillStyle = '#000';
        g.fillRect(px, py + h * 0.65, w, h * 0.35); // blinds
        g.globalAlpha = 1;
      } else {
        g.fillStyle = 'rgba(120,140,200,0.07)'; g.fillRect(px, py, w, h);
      }
    }
  }
  // horizontal floor bands
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < rows; y++) g.fillRect(0, y * rh, 256, 2);
  const t = toTex(c, { repeat: true });
  return t;
}

export function signTexture(text, color, { w = 512, h = 128, bg = 'rgba(8,2,20,0.9)', border = true, font = 'bold italic' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = color; g.lineWidth = Math.max(4, h * 0.05);
    g.shadowColor = color; g.shadowBlur = 12;
    g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
  }
  const vertical = h > w;
  g.fillStyle = '#fff'; g.shadowColor = color; g.shadowBlur = 18;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (vertical) {
    const chars = text.split('');
    const fs = Math.min(w * 0.7, (h * 0.86) / chars.length);
    g.font = `${font} ${fs}px Arial Black, Arial, sans-serif`;
    chars.forEach((ch, i) => {
      const y = h * 0.07 + fs * (i + 0.5) * 1.0 + (h * 0.86 - fs * chars.length) / 2;
      g.fillStyle = color; g.fillText(ch, w / 2, y);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(ch, w / 2, y);
    });
  } else {
    let fs = h * 0.6;
    g.font = `${font} ${fs}px Arial Black, Arial, sans-serif`;
    const mw = g.measureText(text).width;
    if (mw > w * 0.84) { fs *= (w * 0.84) / mw; g.font = `${font} ${fs}px Arial Black, Arial, sans-serif`; }
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(text, w / 2, h / 2 + 2);
  }
  return toTex(c);
}

export function stripeTexture(a = '#ff8a00', b = '#141018', n = 6) {
  const [c, g] = canvas(256, 64);
  g.fillStyle = b; g.fillRect(0, 0, 256, 64);
  g.fillStyle = a;
  const sw = 256 / n;
  for (let i = -1; i < n + 1; i++) {
    g.beginPath();
    g.moveTo(i * sw, 64); g.lineTo(i * sw + sw / 2, 64); g.lineTo(i * sw + sw, 0); g.lineTo(i * sw + sw / 2, 0);
    g.closePath(); g.fill();
  }
  return toTex(c, { repeat: true });
}

export function glowTexture(inner = 'rgba(255,255,255,1)', size = 128) {
  const [c, g] = canvas(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return toTex(c, { srgb: false });
}

// Soft elongated beam texture (for headlight cones on ground)
export function beamTexture() {
  const [c, g] = canvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(26, 0); g.lineTo(38, 0); g.lineTo(64, 256); g.lineTo(0, 256); g.closePath(); g.fill();
  const t = toTex(c, { srgb: false });
  return t;
}

export function iconTexture(kind, color) {
  const [c, g] = canvas(128, 128);
  g.translate(64, 64);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = color; g.shadowBlur = 16;
  g.beginPath(); g.arc(0, 0, 56, 0, Math.PI * 2); g.strokeStyle = color; g.lineWidth = 6; g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 9;
  if (kind === 'shield') {
    g.beginPath(); g.moveTo(0, -34); g.lineTo(28, -22); g.lineTo(24, 10); g.quadraticCurveTo(14, 28, 0, 36);
    g.quadraticCurveTo(-14, 28, -24, 10); g.lineTo(-28, -22); g.closePath(); g.stroke();
  } else if (kind === 'magnet') {
    g.beginPath(); g.arc(0, 2, 22, Math.PI, 0, false); g.lineTo(22, 30); g.moveTo(-22, 2); g.lineTo(-22, 30);
    g.lineWidth = 16; g.stroke();
    g.fillStyle = color; g.fillRect(-30, 22, 16, 12); g.fillRect(14, 22, 16, 12);
  } else {
    g.beginPath();
    g.moveTo(-30, -26); g.lineTo(-6, 0); g.lineTo(-30, 26);
    g.moveTo(0, -26); g.lineTo(24, 0); g.lineTo(0, 26);
    g.lineWidth = 12; g.stroke();
  }
  return toTex(c);
}

// Distant skyline silhouette strip (wraps around horizon cylinder)
export function skylineTexture(seed, pal) {
  const r = rng(seed);
  const [c, g] = canvas(2048, 256);
  g.clearRect(0, 0, 2048, 256);
  for (let layer = 0; layer < 2; layer++) {
    let x = 0;
    while (x < 2048) {
      const w = 20 + r() * 70;
      const h = (layer === 0 ? 60 : 110) + r() * (layer === 0 ? 120 : 130);
      g.fillStyle = layer === 0 ? 'rgba(30,14,60,1)' : 'rgba(12,5,26,1)';
      g.fillRect(x, 256 - h, w, h);
      // windows
      for (let i = 0; i < w * h / 90; i++) {
        if (r() < 0.5) continue;
        g.fillStyle = r() < 0.2 ? pal.neon[Math.floor(r() * pal.neon.length)] : 'rgba(255,220,170,0.7)';
        g.globalAlpha = 0.25 + r() * 0.5;
        g.fillRect(x + 2 + Math.floor(r() * (w - 4) / 4) * 4, 256 - h + 4 + Math.floor(r() * (h - 6) / 6) * 6, 2, 2);
      }
      g.globalAlpha = 1;
      if (r() < 0.15) { // antenna light
        g.fillStyle = '#ff3355'; g.fillRect(x + w / 2, 256 - h - 12, 2, 12);
      }
      x += w + r() * 6;
    }
  }
  const t = toTex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function tileTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#17121f'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  return toTex(c, { repeat: true });
}
