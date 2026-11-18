// Every texture in the scene is painted here on a canvas from seeded noise.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { SEED } from '../config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

function finish(c, { repeat = true, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function speckle(g, rng, w, h, count, alpha, light = 255) {
  for (let i = 0; i < count; i++) {
    const v = Math.floor(rng.range(0, light));
    g.fillStyle = `rgba(${v},${v},${v},${rng.range(0, alpha)})`;
    g.fillRect(rng.range(0, w), rng.range(0, h), rng.range(1, 3), rng.range(1, 3));
  }
}

/** Riveted armour plate, tileable along u. Multiplied by vertex colour. */
export function armorTexture() {
  const { c, g } = canvas(512, 256);
  const rng = makeRng(SEED + 11);
  g.fillStyle = '#b9bcc0';
  g.fillRect(0, 0, 512, 256);
  speckle(g, rng, 512, 256, 2600, 0.1);
  const cols = 4;
  const rows = 3;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (i * 512) / cols;
      const y = (j * 256) / rows;
      const w = 512 / cols;
      const h = 256 / rows;
      const shade = Math.floor(rng.range(-26, 22));
      g.fillStyle = shade < 0 ? `rgba(0,0,0,${-shade / 100})` : `rgba(255,255,255,${shade / 160})`;
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      g.strokeStyle = 'rgba(255,255,255,0.16)';
      g.lineWidth = 1;
      g.strokeRect(x + 3, y + 3, w - 6, h - 6);
      for (let k = 0; k < 9; k++) {
        for (const ry of [y + 8, y + h - 8]) {
          const rx = x + 8 + (k * (w - 16)) / 8;
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(rx - 1, ry, 3, 3);
          g.fillStyle = 'rgba(255,255,255,0.4)';
          g.fillRect(rx - 1, ry - 1, 2, 2);
        }
      }
    }
  }
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, 512);
    const len = rng.range(30, 170);
    const grad = g.createLinearGradient(0, 30, 0, 30 + len);
    grad.addColorStop(0, `rgba(20,14,10,${rng.range(0.1, 0.32)})`);
    grad.addColorStop(1, 'rgba(20,14,10,0)');
    g.fillStyle = grad;
    g.fillRect(x, 30, rng.range(1, 5), len);
  }
  const frost = g.createLinearGradient(0, 0, 0, 256);
  frost.addColorStop(0, 'rgba(235,242,255,0.75)');
  frost.addColorStop(0.16, 'rgba(235,242,255,0.12)');
  frost.addColorStop(0.72, 'rgba(235,242,255,0)');
  frost.addColorStop(1, 'rgba(235,242,255,0.5)');
  g.fillStyle = frost;
  g.fillRect(0, 0, 512, 256);
  return finish(c);
}

/** Deck seen from above: sleepers down the middle, packed snow at the sides. */
export function deckTexture() {
  const { c, g } = canvas(256, 512);
  const rng = makeRng(SEED + 23);
  g.fillStyle = '#d6dde8';
  g.fillRect(0, 0, 256, 512);
  const bed = g.createLinearGradient(0, 0, 256, 0);
  bed.addColorStop(0.2, 'rgba(60,66,78,0)');
  bed.addColorStop(0.34, 'rgba(60,66,78,0.9)');
  bed.addColorStop(0.66, 'rgba(60,66,78,0.9)');
  bed.addColorStop(0.8, 'rgba(60,66,78,0)');
  g.fillStyle = bed;
  g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 32) {
    g.fillStyle = '#23262d';
    g.fillRect(82, y + 6, 92, 13);
    g.fillStyle = 'rgba(220,228,240,0.55)';
    g.fillRect(82 + rng.range(0, 30), y + 6, rng.range(20, 50), rng.range(3, 8));
  }
  speckle(g, rng, 256, 512, 2200, 0.16);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(235,240,250,${rng.range(0.2, 0.6)})`;
    g.beginPath();
    g.ellipse(rng.range(60, 196), rng.range(0, 512), rng.range(6, 22), rng.range(3, 9), 0, 0, 7);
    g.fill();
  }
  return finish(c);
}

/** Soft, lumpy puff used for steam, smoke and plough spray. */
export function puffTexture() {
  const N = 128;
  const { c, g } = canvas(N, N);
  const rng = makeRng(SEED + 31);
  // sum a cluster of soft lobes, then sharpen so the edge billows instead of blurring
  const density = new Float32Array(N * N);
  for (let i = 0; i < 46; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng()) * 0.27 * N;
    const cx = N / 2 + Math.cos(a) * r;
    const cy = N / 2 + Math.sin(a) * r;
    const rad = rng.range(0.07, 0.17) * N;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (rad * rad);
        if (d2 < 4) density[y * N + x] += Math.exp(-d2 * 1.6);
      }
    }
  }
  const image = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = Math.min(1, Math.max(0, (density[i] - 0.45) / 1.6));
    image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = Math.round(255 * v * v * (3 - 2 * v));
  }
  g.putImageData(image, 0, 0);
  return finish(c, { repeat: false });
}

/** Round light bloom with a hot core, for lamps on the train. */
export function flareTexture() {
  const { c, g } = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.08, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return finish(c, { repeat: false });
}

/** Window light spilling onto the deck: bright by the car, fading outwards. */
export function spillTexture() {
  const { c, g } = canvas(64, 64);
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const ends = g.createLinearGradient(0, 0, 0, 64);
  ends.addColorStop(0, 'rgba(0,0,0,1)');
  ends.addColorStop(0.12, 'rgba(0,0,0,0)');
  ends.addColorStop(0.88, 'rgba(0,0,0,0)');
  ends.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = ends;
  g.fillRect(0, 0, 64, 64);
  return finish(c, { repeat: false });
}

/** Platform paving with drifted snow and a worn safety line. */
export function platformTexture() {
  const { c, g } = canvas(256, 256);
  const rng = makeRng(SEED + 47);
  g.fillStyle = '#6f7682';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(20,24,30,0.5)';
  for (let i = 0; i <= 256; i += 32) {
    g.strokeRect(i, 0, 32, 256);
    g.strokeRect(0, i, 256, 32);
  }
  speckle(g, rng, 256, 256, 1800, 0.14);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = `rgba(232,238,248,${rng.range(0.25, 0.85)})`;
    g.beginPath();
    g.ellipse(rng.range(0, 256), rng.range(0, 256), rng.range(4, 15), rng.range(3, 9), rng.range(0, 3), 0, 7);
    g.fill();
  }
  return finish(c);
}

/** Illuminated station name board. */
export function signTexture(name, sub) {
  const { c, g } = canvas(512, 128);
  g.fillStyle = '#0d1420';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#e9b765';
  g.fillRect(0, 0, 512, 8);
  g.fillRect(0, 120, 512, 8);
  g.fillStyle = '#f4ead6';
  g.font = '700 62px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, 256, 56);
  g.fillStyle = '#e9b765';
  g.font = '500 22px "Helvetica Neue", Arial, sans-serif';
  g.fillText(sub, 256, 100);
  return finish(c, { repeat: false });
}
