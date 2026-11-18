import * as THREE from 'three';
import { lerp, saturate, smoothstep, fbm2D, ridgedFbm2D } from './math.js';

export const ISLAND_WORLD_EXTENT = 56; // [-56, 56] meters mapped into DataTexture
export const LIGHTHOUSE_POS = { x: 4.6, z: -4.2 };
export const COTTAGE_POS = { x: 0.6, z: -2.6 };

function computeBaseProfile(x, z) {
  const warpX = x + fbm2D(x * 0.052, z * 0.052, 3, 211) * 2.8;
  const warpZ = z + fbm2D(x * 0.052 + 9.1, z * 0.052 - 4.3, 3, 277) * 2.6;

  // Gentle broad sandy island base shifted slightly south-west for a wide golden beach
  const beachBodyDist = Math.hypot((warpX + 2.4) / 18.2, (warpZ - 2.6) / 15.6);
  const beachBody = 4.6 * Math.exp(-Math.pow(beachBodyDist, 2.15) * 1.05);

  // Curved western palm spit embracing the turquoise lagoon
  const westSpitDist = Math.hypot((warpX + 11.8) / 8.5, (warpZ - 7.2) / 6.8);
  const westSpit = 3.35 * Math.exp(-westSpitDist * westSpitDist * 1.15);

  // Dramatic steep sea-cliff headland on the north-east side
  const cliffDist = Math.hypot((warpX - 4.8) / 8.0, (warpZ + 4.2) / 7.2);
  let cliff = 10.4 * Math.exp(-Math.pow(cliffDist, 2.25) * 1.22);
  cliff += Math.sin(cliff * 1.75) * 0.28 * smoothstep(2.0, 8.5, cliff);

  // Secondary rocky crag on eastern tip
  const eastCragDist = Math.hypot((warpX - 10.6) / 5.4, (warpZ - 2.4) / 5.2);
  const eastCrag = 4.8 * Math.exp(-eastCragDist * eastCragDist * 1.35);

  // Concave crescent bay indentation creating a gentle sloping sandy beach & turquoise lagoon
  const coveDist = Math.hypot((x + 2.2) / 9.8, (z - 12.2) / 7.8);
  const coveCarve = 3.25 * Math.exp(-coveDist * coveDist * 1.12);

  return beachBody + westSpit + cliff + eastCrag - coveCarve;
}

export function sampleTerrainInfo(x, z) {
  const r = Math.hypot(x, z);
  const raw = computeBaseProfile(x, z);

  // Shallow coral lagoon shelf on south/west side, dropping to deep ocean farther out
  const lagoonDist = Math.hypot((x + 2.5) / 26.0, (z - 7.5) / 24.0);
  const lagoonShelf = 3.2 * Math.exp(-Math.pow(lagoonDist, 2.4));
  const oceanBase = -13.5 + lagoonShelf * 3.4;
  const islandBlend = smoothstep(38.0, 15.0, r);

  const detailNoise = fbm2D(x * 0.15, z * 0.15, 4, 509);
  const cragNoise = ridgedFbm2D(x * 0.24, z * 0.24, 4, 733);

  // North-east quadrant has sheer rocky cliffs; south-west quadrant is smooth coral sand beach
  const cliffSector = saturate(smoothstep(4.5, -2.5, z) * 0.62 + smoothstep(-1.5, 5.5, x) * 0.58);
  let height = lerp(oceanBase, raw - 1.55, islandBlend);

  const aboveShore = smoothstep(-0.5, 3.0, height);
  const cliffness = saturate(cliffSector * smoothstep(-1.0, 2.8, height));

  // Keep sandy beach slopes silky-smooth; apply craggy ridges to cliff headland
  const sandSmoothness = (1.0 - cliffSector) * smoothstep(3.2, 0.5, Math.abs(height - 0.8));
  height += detailNoise * lerp(0.12, 0.55, aboveShore) * (1.0 - 0.65 * sandSmoothness) * islandBlend;
  height += (cragNoise - 0.44) * 1.65 * cliffness;

  // Flat summit pads for lighthouse and keeper's cottage
  const dLight = Math.hypot(x - LIGHTHOUSE_POS.x, z - LIGHTHOUSE_POS.z);
  const padLight = smoothstep(3.7, 1.5, dLight);
  height = lerp(height, 11.35, padLight * 0.94);

  const dCottage = Math.hypot(x - COTTAGE_POS.x, z - COTTAGE_POS.z);
  const padCottage = smoothstep(3.2, 1.3, dCottage);
  height = lerp(height, 10.15, padCottage * 0.88);

  return { height, cliffness };
}

export function sampleTerrainHeight(x, z) {
  return sampleTerrainInfo(x, z).height;
}

export function sampleTerrainNormal(x, z, eps = 0.28) {
  const hL = sampleTerrainHeight(x - eps, z);
  const hR = sampleTerrainHeight(x + eps, z);
  const hD = sampleTerrainHeight(x, z - eps);
  const hU = sampleTerrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

function edt1d(f, d, v, z, n) {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dx = q - v[k];
    d[q] = dx * dx + f[v[k]];
  }
}

function computeSignedDistance2D(insideMask, size) {
  const INF = 1e12;
  const outsideSq = new Float32Array(size * size);
  const insideSq = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    outsideSq[i] = insideMask[i] ? 0 : INF;
    insideSq[i] = insideMask[i] ? INF : 0;
  }

  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);

  const runPass = (grid) => {
    for (let y = 0; y < size; y++) {
      const row = y * size;
      for (let x = 0; x < size; x++) f[x] = grid[row + x];
      edt1d(f, d, v, z, size);
      for (let x = 0; x < size; x++) grid[row + x] = d[x];
    }
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) f[y] = grid[y * size + x];
      edt1d(f, d, v, z, size);
      for (let y = 0; y < size; y++) grid[y * size + x] = d[y];
    }
  };

  runPass(outsideSq);
  runPass(insideSq);

  const sdf = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const dOut = Math.sqrt(outsideSq[i]);
    const dIn = Math.sqrt(insideSq[i]);
    sdf[i] = insideMask[i] ? -(dIn - 0.5) : dOut - 0.5;
  }
  return sdf;
}

export function buildBathymetryTexture(size = 256) {
  const heights = new Float32Array(size * size);
  const cliffs = new Float32Array(size * size);
  const landMask = new Uint8Array(size * size);

  for (let iy = 0; iy < size; iy++) {
    const wz = lerp(-ISLAND_WORLD_EXTENT, ISLAND_WORLD_EXTENT, (iy + 0.5) / size);
    for (let ix = 0; ix < size; ix++) {
      const wx = lerp(-ISLAND_WORLD_EXTENT, ISLAND_WORLD_EXTENT, (ix + 0.5) / size);
      const idx = iy * size + ix;
      const info = sampleTerrainInfo(wx, wz);
      heights[idx] = info.height;
      cliffs[idx] = info.cliffness;
      landMask[idx] = info.height >= 0 ? 1 : 0;
    }
  }

  const sdfTexels = computeSignedDistance2D(landMask, size);
  const metersPerTexel = (ISLAND_WORLD_EXTENT * 2) / size;
  const data = new Uint8Array(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    const hNorm = saturate((heights[i] + 14.0) / 28.0);
    const sdfMeters = sdfTexels[i] * metersPerTexel;
    const sdfNorm = saturate((sdfMeters / 28.0) * 0.5 + 0.5);
    const normalCliff = saturate(cliffs[i]);
    const coastalOcc = saturate(1.0 - Math.max(0, sdfMeters) / 20.0);

    data[i * 4 + 0] = Math.round(hNorm * 255);
    data[i * 4 + 1] = Math.round(sdfNorm * 255);
    data[i * 4 + 2] = Math.round(normalCliff * 255);
    data[i * 4 + 3] = Math.round(coastalOcc * 255);
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
