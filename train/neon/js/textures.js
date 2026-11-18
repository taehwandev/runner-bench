import * as THREE from 'three';
import { createPRNG } from './prng.js';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true, wrap = THREE.RepeatWrapping } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural Skyscraper Facade (albedo + emissive window grid)
 * Crisp brutalist concrete bands, frost-dusted horizontal ledges,
 * and sparse warm-amber / cool-cyan lit interior windows.
 */
export function createBuildingTextures(seed = 101) {
  const rand = createPRNG(seed);
  const w = 512;
  const h = 1024;
  const { canvas: colC, ctx: col } = makeCanvas(w, h);
  const { canvas: emiC, ctx: emi } = makeCanvas(w, h);

  col.fillStyle = '#2d3748';
  col.fillRect(0, 0, w, h);

  emi.fillStyle = '#000000';
  emi.fillRect(0, 0, w, h);

  // Weathered vertical concrete & frost streaks
  for (let i = 0; i < 180; i++) {
    const x = rand() * w;
    const sw = 2 + rand() * 14;
    const alpha = 0.04 + rand() * 0.08;
    col.fillStyle = rand() > 0.45 ? `rgba(182, 206, 232, ${alpha})` : `rgba(12, 18, 28, ${alpha * 1.4})`;
    col.fillRect(x, 0, sw, h);
  }

  const cols = 16;
  const rows = 42;
  const cellW = w / cols;
  const cellH = h / rows;

  for (let c = 0; c < cols; c++) {
    const x = c * cellW;
    col.fillStyle = c % 4 === 0 ? '#1c2534' : '#243042';
    col.fillRect(x, 0, c % 4 === 0 ? 5 : 3, h);
  }

  for (let r = 0; r < rows; r++) {
    const y = r * cellH;
    const isMechFloor = r % 10 === 4;
    col.fillStyle = isMechFloor ? '#18202e' : '#222d3e';
    col.fillRect(0, y, w, isMechFloor ? cellH * 0.74 : cellH * 0.36);

    // Snow/frost line accumulated along concrete ledges
    const frostH = isMechFloor ? 3.5 : 1.8;
    col.fillStyle = 'rgba(212, 228, 246, 0.56)';
    col.fillRect(0, y, w, frostH);

    if (isMechFloor) continue;

    const floorActivity = rand() < 0.22 ? 0.5 : rand() < 0.55 ? 0.15 : 0.035;

    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + 5;
      const wy = y + cellH * 0.38;
      const ww = cellW - 8;
      const wh = cellH * 0.52;

      col.fillStyle = '#0c131f';
      col.fillRect(wx, wy, ww, wh);

      if (rand() < floorActivity) {
        const tempRoll = rand();
        let winColor;
        if (tempRoll < 0.58) {
          const b = 175 + Math.floor(rand() * 75);
          const g = Math.floor(b * (0.64 + rand() * 0.14));
          const bl = Math.floor(b * (0.28 + rand() * 0.14));
          winColor = `rgb(${b}, ${g}, ${bl})`;
        } else if (tempRoll < 0.85) {
          const b = 155 + Math.floor(rand() * 80);
          winColor = `rgb(${Math.floor(b * 0.72)}, ${Math.floor(b * 0.88)}, ${b})`;
        } else {
          const b = 185 + Math.floor(rand() * 55);
          winColor = `rgb(${b}, ${Math.floor(b * 0.92)}, ${Math.floor(b * 0.76)})`;
        }

        const litWidth = rand() < 0.35 ? ww * 0.55 : ww;
        col.fillStyle = winColor;
        col.fillRect(wx, wy, litWidth, wh);
        emi.fillStyle = winColor;
        emi.fillRect(wx, wy, litWidth, wh);
      }
    }
  }

  return {
    map: finalizeTexture(colC, { srgb: true }),
    emissiveMap: finalizeTexture(emiC, { srgb: true })
  };
}

/**
 * Procedural Armored Train Hull Plating (rivets, steel seams, frost buildup)
 */
export function createArmorTexture(seed = 202) {
  const rand = createPRNG(seed);
  const w = 512;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#465466');
  grad.addColorStop(0.24, '#2c3644');
  grad.addColorStop(0.76, '#202833');
  grad.addColorStop(1, '#344252');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 300; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 18 + rand() * 80;
    const a = 0.03 + rand() * 0.06;
    ctx.fillStyle = rand() > 0.5 ? `rgba(190, 215, 240, ${a})` : `rgba(8, 12, 18, ${a})`;
    ctx.fillRect(x, y, len, 1.5);
  }

  ctx.strokeStyle = 'rgba(10, 14, 20, 0.78)';
  ctx.lineWidth = 3;
  for (const sy of [44, 128, 206]) {
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(170, 198, 226, 0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, sy + 2.5);
    ctx.lineTo(w, sy + 2.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(10, 14, 20, 0.78)';
    ctx.lineWidth = 3;
  }

  for (let x = 0; x < w; x += 64) {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.65)';
    ctx.fillRect(x, 0, 2, h);
    ctx.fillStyle = 'rgba(165, 192, 220, 0.2)';
    ctx.fillRect(x + 2, 0, 1, h);

    for (let y = 12; y < h; y += 22) {
      ctx.fillStyle = 'rgba(180, 205, 232, 0.35)';
      ctx.fillRect(x + 6, y, 2.5, 2.5);
      ctx.fillRect(x + 56, y, 2.5, 2.5);
    }
  }

  const frostTop = ctx.createLinearGradient(0, 0, 0, 40);
  frostTop.addColorStop(0, 'rgba(218, 234, 248, 0.62)');
  frostTop.addColorStop(1, 'rgba(218, 234, 248, 0.0)');
  ctx.fillStyle = frostTop;
  ctx.fillRect(0, 0, w, 40);

  const frostBot = ctx.createLinearGradient(0, h - 38, 0, h);
  frostBot.addColorStop(0, 'rgba(208, 226, 244, 0.0)');
  frostBot.addColorStop(1, 'rgba(208, 226, 244, 0.52)');
  ctx.fillStyle = frostBot;
  ctx.fillRect(0, h - 38, w, 38);

  return finalizeTexture(canvas, { repeatX: 2, repeatY: 1, srgb: true });
}

/**
 * Procedural Snow-Dusted Concrete Texture (tiled for viaduct, platform & tunnel)
 */
export function createConcreteTexture(seed = 303) {
  const rand = createPRNG(seed);
  const w = 256;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h);

  ctx.fillStyle = '#364252';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 720; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const s = 2 + rand() * 14;
    const light = rand() > 0.42;
    ctx.fillStyle = light
      ? `rgba(205, 222, 240, ${0.04 + rand() * 0.13})`
      : `rgba(12, 18, 28, ${0.06 + rand() * 0.15})`;
    ctx.fillRect(x, y, s, s * (0.4 + rand() * 1.2));
  }

  // Expansion joint tile lines
  ctx.strokeStyle = 'rgba(14, 20, 30, 0.5)';
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  return finalizeTexture(canvas, { repeatX: 2, repeatY: 2, srgb: true });
}

/**
 * Snow-Buried Urban Street Grid Texture (buried avenues, snowdrifts, dark curbs)
 */
export function createCitySnowGroundTexture(seed = 505) {
  const rand = createPRNG(seed);
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);

  // Frozen packed snow base
  ctx.fillStyle = '#738ba6';
  ctx.fillRect(0, 0, size, size);

  // Buried boulevard grid traces beneath snow
  ctx.fillStyle = 'rgba(34, 48, 66, 0.42)';
  ctx.fillRect(0, 224, size, 64);
  ctx.fillRect(224, 0, 64, size);

  // Soft snowdrift undulations & frost patches
  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 52;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    const bright = rand() > 0.35;
    g.addColorStop(0, bright ? 'rgba(205, 222, 242, 0.24)' : 'rgba(26, 38, 56, 0.22)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle buried avenue median marks
  ctx.fillStyle = 'rgba(230, 170, 96, 0.16)';
  for (let i = 0; i < size; i += 32) {
    ctx.fillRect(i, 254, 14, 3);
    ctx.fillRect(254, i, 3, 14);
  }

  return finalizeTexture(canvas, { repeatX: 16, repeatY: 22, srgb: true });
}

/**
 * Soft Radial Glow Texture (for headlights, station lamp halos, beacons)
 */
export function createGlowTexture() {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.18, 'rgba(255, 244, 226, 0.76)');
  grad.addColorStop(0.45, 'rgba(255, 208, 160, 0.24)');
  grad.addColorStop(0.78, 'rgba(180, 140, 110, 0.04)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return finalizeTexture(canvas, { wrap: THREE.ClampToEdgeWrapping, srgb: true });
}

/**
 * Billowing Wispy Steam / Exhaust Puff Texture
 */
export function createSteamTexture(seed = 404) {
  const rand = createPRNG(seed);
  const size = 128;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);

  for (let i = 0; i < 14; i++) {
    const angle = rand() * Math.PI * 2;
    const rad = rand() * 24;
    const x = size * 0.5 + Math.cos(angle) * rad;
    const y = size * 0.5 + Math.sin(angle) * rad;
    const r = 24 + rand() * 26;
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0.0, 'rgba(236, 245, 254, 0.28)');
    g.addColorStop(0.55, 'rgba(195, 214, 232, 0.13)');
    g.addColorStop(1.0, 'rgba(160, 185, 210, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeTexture(canvas, { wrap: THREE.ClampToEdgeWrapping, srgb: true });
}

/**
 * Illuminated Frost Terminal Station Departure Board (centered, generous padding)
 */
export function createStationSignTexture() {
  const w = 512;
  const h = 128;
  const { canvas, ctx } = makeCanvas(w, h);

  ctx.fillStyle = '#09101a';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#e8a256';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#f5b86e';
  ctx.font = 'bold 27px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('SECTOR 09 · FROST TERMINAL', w * 0.5, 48);

  ctx.fillStyle = '#8ccdf0';
  ctx.font = '600 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('EXPRESS 01   ·   PLATFORM A   ·   NORTHBOUND', w * 0.5, 88);

  return finalizeTexture(canvas, { wrap: THREE.ClampToEdgeWrapping, srgb: true });
}
