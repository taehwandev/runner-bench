import * as THREE from 'three';
import { createRng } from './prng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function createArmorTextures() {
  const w = 512;
  const h = 256;
  const colorCanvas = makeCanvas(w, h);
  const bumpCanvas = makeCanvas(w, h);
  const cCtx = colorCanvas.getContext('2d');
  const bCtx = bumpCanvas.getContext('2d');
  const rng = createRng(104729);

  // Base gunmetal
  cCtx.fillStyle = '#3d4a5c';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  // Plate panels
  const cols = 4;
  const rows = 2;
  const pw = w / cols;
  const ph = h / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const shade = Math.floor(62 + rng() * 20);
      cCtx.fillStyle = `rgb(${shade}, ${shade + 9}, ${shade + 20})`;
      cCtx.fillRect(c * pw + 2, r * ph + 2, pw - 4, ph - 4);

      bCtx.fillStyle = `rgb(${132 + Math.floor(rng() * 16)}, 138, 138)`;
      bCtx.fillRect(c * pw + 3, r * ph + 3, pw - 6, ph - 6);

      // Panel seam
      cCtx.strokeStyle = '#141a22';
      cCtx.lineWidth = 3;
      cCtx.strokeRect(c * pw + 1.5, r * ph + 1.5, pw - 3, ph - 3);

      bCtx.strokeStyle = '#303030';
      bCtx.lineWidth = 3;
      bCtx.strokeRect(c * pw + 1.5, r * ph + 1.5, pw - 3, ph - 3);

      // Rivets
      for (let rx = c * pw + 10; rx < (c + 1) * pw - 8; rx += 16) {
        for (const ry of [r * ph + 9, (r + 1) * ph - 9]) {
          cCtx.fillStyle = '#475569';
          cCtx.beginPath();
          cCtx.arc(rx, ry, 2.0, 0, Math.PI * 2);
          cCtx.fill();

          bCtx.fillStyle = '#d8d8d8';
          bCtx.beginPath();
          bCtx.arc(rx, ry, 2.0, 0, Math.PI * 2);
          bCtx.fill();
        }
      }
    }
  }

  // Vertical frost & weather streaks
  for (let i = 0; i < 180; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const len = 18 + rng() * 65;
    cCtx.fillStyle = rng() > 0.35 ? 'rgba(195, 220, 245, 0.055)' : 'rgba(10, 14, 20, 0.14)';
    cCtx.fillRect(x, y, 1.5 + rng() * 2.5, len);
  }

  // Lower edge frost rime
  const frostGrad = cCtx.createLinearGradient(0, h * 0.72, 0, h);
  frostGrad.addColorStop(0, 'rgba(210, 228, 245, 0)');
  frostGrad.addColorStop(1, 'rgba(210, 228, 245, 0.24)');
  cCtx.fillStyle = frostGrad;
  cCtx.fillRect(0, h * 0.72, w, h * 0.28);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createTowerFacadeTextures(seed = 4201) {
  const w = 512;
  const h = 1024;
  const albedo = makeCanvas(w, h);
  const emissive = makeCanvas(w, h);
  const aCtx = albedo.getContext('2d');
  const eCtx = emissive.getContext('2d');
  const rng = createRng(seed);

  // Brutalist frozen concrete base
  aCtx.fillStyle = '#182130';
  aCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  const cols = 12;
  const rows = 36;
  const cw = w / cols;
  const rh = h / rows;

  // Vertical concrete pilasters
  for (let c = 0; c <= cols; c++) {
    aCtx.fillStyle = c % 3 === 0 ? '#243145' : '#1d2738';
    aCtx.fillRect(c * cw - 3, 0, 6, h);
  }

  for (let r = 0; r < rows; r++) {
    const floorLitBias = rng() < 0.28 ? 0.52 : 0.14;
    // Concrete floor spandrel
    aCtx.fillStyle = '#1d2636';
    aCtx.fillRect(0, r * rh, w, 7);

    // Subtle snow dusting on every 4th ledge
    if (r % 4 === 0) {
      aCtx.fillStyle = 'rgba(205, 222, 242, 0.22)';
      aCtx.fillRect(0, r * rh, w, 2.5);
    }

    for (let c = 0; c < cols; c++) {
      const wx = c * cw + 5;
      const wy = r * rh + 8;
      const ww = cw - 10;
      const wh = rh - 11;

      const lit = rng() < floorLitBias;
      if (lit) {
        const warm = rng() < 0.72;
        const bright = 0.55 + rng() * 0.45;
        let fill;
        if (warm) {
          const R = Math.floor(255 * bright);
          const G = Math.floor((170 + rng() * 45) * bright);
          const B = Math.floor((85 + rng() * 40) * bright);
          fill = `rgb(${R}, ${G}, ${B})`;
        } else {
          const R = Math.floor((120 + rng() * 40) * bright);
          const G = Math.floor((200 + rng() * 35) * bright);
          const B = Math.floor(255 * bright);
          fill = `rgb(${R}, ${G}, ${B})`;
        }
        aCtx.fillStyle = fill;
        aCtx.fillRect(wx, wy, ww, wh);
        eCtx.fillStyle = fill;
        eCtx.fillRect(wx, wy, ww, wh);
      } else {
        aCtx.fillStyle = rng() < 0.5 ? '#0f1622' : '#121b2a';
        aCtx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emissive);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

export function createConcreteTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = createRng(8821);

  ctx.fillStyle = '#333d4b';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 800; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const v = 38 + Math.floor(rng() * 32);
    ctx.fillStyle = `rgba(${v}, ${v + 6}, ${v + 12}, 0.35)`;
    ctx.fillRect(x, y, 2 + rng() * 5, 2 + rng() * 14);
  }

  // Formwork seams
  ctx.strokeStyle = 'rgba(15, 20, 28, 0.45)';
  ctx.lineWidth = 2;
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createSnowGroundTexture() {
  const w = 256;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const rng = createRng(7713);

  ctx.fillStyle = '#9bb0c9';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 450; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const lw = 16 + rng() * 48;
    const lh = 2 + rng() * 6;
    ctx.fillStyle = rng() > 0.4 ? 'rgba(225, 238, 252, 0.14)' : 'rgba(65, 86, 118, 0.16)';
    ctx.fillRect(x, y, lw, lh);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}
