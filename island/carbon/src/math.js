// Deterministic math, seeded PRNG, and 2D/3D procedural noise utilities.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function saturate(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function smootherstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function easeInOutCubic(t) {
  const x = saturate(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Deterministic 32-bit PRNG (Mulberry32)
export function createRng(seed = 1337) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed = 0) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}

export function fbm2D(x, y, octaves = 5, seed = 101, lacunarity = 2.03, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    // Rotate octave slightly to prevent grid alignment artifacts
    const rx = x * freq * 0.866 - y * freq * 0.5;
    const ry = x * freq * 0.5 + y * freq * 0.866;
    sum += amp * valueNoise2D(rx, ry, seed + i * 31);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function ridgedFbm2D(x, y, octaves = 4, seed = 307) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise2D(x * freq, y * freq, seed + i * 47));
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

export function lerpColorHex(hexA, hexB, t) {
  const k = saturate(t);
  const ar = (hexA >> 16) & 255;
  const ag = (hexA >> 8) & 255;
  const ab = hexA & 255;
  const br = (hexB >> 16) & 255;
  const bg = (hexB >> 8) & 255;
  const bb = hexB & 255;
  return [
    lerp(ar, br, k) / 255,
    lerp(ag, bg, k) / 255,
    lerp(ab, bb, k) / 255,
  ];
}

export function sampleKeyframes(keyframes, t) {
  if (t <= keyframes[0].t) return keyframes[0];
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i];
    const b = keyframes[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = smoothstep(a.t, b.t, t);
      return { a, b, u };
    }
  }
  return last;
}
