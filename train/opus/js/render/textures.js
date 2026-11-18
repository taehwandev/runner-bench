// Code-generated canvas textures (seeded, so identical on every load).

import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { repeat = false, srgb = true, aniso = 4 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = aniso;
  return tex;
}

function speckle(ctx, w, h, rng, count, alpha, light = false) {
  for (let i = 0; i < count; i++) {
    const v = light ? 200 + rng() * 55 : rng() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v + 8},${alpha * rng()})`;
    ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
}

// Armoured steel plates: seams, rivets, grime and frost.
export function makePlateTexture() {
  const [c, ctx] = canvas(512, 512);
  const rng = mulberry32(71);
  ctx.fillStyle = '#8a929c';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 4; j++) {
      const s = 132 + rng() * 34;
      ctx.fillStyle = `rgb(${s},${s + 4},${s + 10})`;
      ctx.fillRect(j * 128 + 2, i * 86 + 2, 124, 82);
    }
  }
  speckle(ctx, 512, 512, rng, 9000, 0.22);
  ctx.strokeStyle = 'rgba(14,16,20,0.95)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(0, i * 86); ctx.lineTo(512, i * 86); ctx.stroke(); }
  for (let j = 0; j <= 4; j++) { ctx.beginPath(); ctx.moveTo(j * 128, 0); ctx.lineTo(j * 128, 512); ctx.stroke(); }
  ctx.fillStyle = 'rgba(175,185,200,0.55)';
  for (let i = 0; i <= 6; i++) {
    for (let x = 6; x < 512; x += 14) {
      ctx.beginPath(); ctx.arc(x, i * 86 + 6, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * 512;
    const g = ctx.createLinearGradient(x, 0, x, 512);
    g.addColorStop(0, 'rgba(30,22,18,0.0)');
    g.addColorStop(0.5, 'rgba(60,40,30,0.18)');
    g.addColorStop(1, 'rgba(30,22,18,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, rng() * 300, 2 + rng() * 4, 80 + rng() * 200);
  }
  return finish(c, { repeat: true });
}

// Row of armoured slit windows with warm interiors (used as map and emissive map).
export function makeWindowStripTexture(seed = 3, warm = true) {
  const [c, ctx] = canvas(512, 64);
  const rng = mulberry32(seed);
  ctx.fillStyle = '#0b0c0f';
  ctx.fillRect(0, 0, 512, 64);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = 10 + i * (492 / n);
    const w = 492 / n - 14;
    const lit = rng() > 0.12;
    const g = ctx.createLinearGradient(0, 12, 0, 52);
    if (lit) {
      const k = 0.65 + rng() * 0.35;
      const col = warm ? [255 * k, 178 * k, 96 * k] : [170 * k, 210 * k, 255 * k];
      g.addColorStop(0, `rgb(${col[0]},${col[1]},${col[2]})`);
      g.addColorStop(1, `rgb(${col[0] * 0.55},${col[1] * 0.45},${col[2] * 0.35})`);
    } else {
      g.addColorStop(0, '#1b1d24');
      g.addColorStop(1, '#0d0e12');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, 12, w, 40);
    if (lit && rng() > 0.45) {           // silhouettes of crew behind the glass
      ctx.fillStyle = 'rgba(20,12,8,0.75)';
      const px = x + 8 + rng() * (w - 24);
      ctx.beginPath(); ctx.arc(px + 6, 26, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(px, 31, 12, 21);
    }
    ctx.fillStyle = '#0b0c0f';
    ctx.fillRect(x + w / 2 - 1.5, 12, 3, 40);
  }
  return finish(c);
}

// Concrete with stains for the viaduct, piers and platforms.
export function makeConcreteTexture() {
  const [c, ctx] = canvas(256, 256);
  const rng = mulberry32(9);
  ctx.fillStyle = '#6b6f78';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, rng, 7000, 0.25);
  speckle(ctx, 256, 256, rng, 2000, 0.15, true);
  for (let i = 0; i < 18; i++) {
    const x = rng() * 256;
    const g = ctx.createLinearGradient(x, 0, x, 256);
    g.addColorStop(0, 'rgba(25,25,30,0.3)');
    g.addColorStop(1, 'rgba(25,25,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + rng() * 6, 256);
  }
  ctx.strokeStyle = 'rgba(30,30,36,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  return finish(c, { repeat: true });
}

// Snow-covered track bed: bright snow with darker ballast where trains have passed.
export function makeTrackbedTexture() {
  const [c, ctx] = canvas(128, 256);
  const rng = mulberry32(13);
  ctx.fillStyle = '#e9eef7';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 16) {          // sleepers peeking through
    ctx.fillStyle = 'rgba(70,64,62,0.35)';
    ctx.fillRect(40, y + 4, 48, 6);
  }
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0.28, 'rgba(120,125,140,0)');
  g.addColorStop(0.36, 'rgba(110,115,130,0.55)');
  g.addColorStop(0.5, 'rgba(160,165,180,0.25)');
  g.addColorStop(0.64, 'rgba(110,115,130,0.55)');
  g.addColorStop(0.72, 'rgba(120,125,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  speckle(ctx, 128, 256, rng, 1800, 0.25, true);
  speckle(ctx, 128, 256, rng, 600, 0.15);
  return finish(c, { repeat: true });
}

// Tunnel wall: panels with baked pools of lamp light every 64 px.
export function makeTunnelTexture() {
  const [c, ctx] = canvas(256, 128);
  const rng = mulberry32(17);
  ctx.fillStyle = '#23262c';
  ctx.fillRect(0, 0, 256, 128);
  speckle(ctx, 256, 128, rng, 3000, 0.3);
  ctx.strokeStyle = 'rgba(8,8,10,0.9)';
  for (let x = 0; x <= 256; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  return finish(c, { repeat: true });
}

// Emissive companion: lamp pools centred on the wall (u = 0.5) twice per tile
// along the bore (v), plus amber guide dashes near the floor.
export function makeTunnelGlowTexture() {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 128);
  for (const y of [32, 96]) {
    const g = ctx.createRadialGradient(128, y, 2, 128, y, 70);
    g.addColorStop(0, 'rgba(255,214,160,1)');
    g.addColorStop(0.12, 'rgba(255,190,120,0.55)');
    g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  ctx.fillStyle = 'rgba(255,150,40,0.9)';
  for (let y = 0; y < 128; y += 16) {
    ctx.fillRect(14, y, 5, 8);
    ctx.fillRect(237, y, 5, 8);
  }
  return finish(c, { repeat: true });
}

// Station name board.
export function makeSignTexture(text) {
  const [c, ctx] = canvas(1024, 160);
  ctx.fillStyle = '#10243f';
  ctx.fillRect(0, 0, 1024, 160);
  ctx.strokeStyle = '#d8e4f5';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 140);
  ctx.fillStyle = '#f3f6fb';
  ctx.font = '600 84px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 84);
  return finish(c);
}

// Hazard chevrons for the portal and the plough.
export function makeChevronTexture() {
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e8a12a';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64); ctx.lineTo(x + 24, 64); ctx.lineTo(x + 56, 0); ctx.lineTo(x + 32, 0);
    ctx.closePath(); ctx.fill();
  }
  return finish(c, { repeat: true });
}

// Soft radial sprite used for flares.
export function makeFlareTexture() {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.08, 'rgba(255,246,225,0.9)');
  g.addColorStop(0.25, 'rgba(255,220,170,0.28)');
  g.addColorStop(1, 'rgba(255,200,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'lighter';
  const s = ctx.createLinearGradient(0, 128, 256, 128);
  s.addColorStop(0, 'rgba(255,230,200,0)');
  s.addColorStop(0.5, 'rgba(255,240,220,0.5)');
  s.addColorStop(1, 'rgba(255,230,200,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 126, 256, 4);
  return finish(c, { srgb: false });
}
