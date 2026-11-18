// Time-of-day state: dusk sliding into night over the 60 s. Pure data, no renderer.

import { ATMOS_KEYS, SUN_DIR, MOON_DIR } from '../config.js';

const COLOR_KEYS = ['zenith', 'horizon', 'fog', 'sunGlow', 'ambSky', 'ambGround', 'sunLight', 'mist'];
const SCALAR_KEYS = ['fogDensity', 'sunGlowAmt', 'stars', 'cityGlow', 'exposure'];

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function hexToLinear(hex) {
  return [
    srgbToLinear(((hex >> 16) & 255) / 255),
    srgbToLinear(((hex >> 8) & 255) / 255),
    srgbToLinear((hex & 255) / 255),
  ];
}

const KEYS = ATMOS_KEYS.map((k) => {
  const o = { t: k.t };
  for (const c of COLOR_KEYS) o[c] = hexToLinear(k[c]);
  for (const s of SCALAR_KEYS) o[s] = k[s];
  return o;
});

function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z);
  return [v.x / l, v.y / l, v.z / l];
}
const SUN = norm(SUN_DIR);
const MOON = norm(MOON_DIR);

// Linear colours as [r, g, b]; scalars as numbers.
export function atmosphereAt(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const u = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  const out = { sunDir: SUN, moonDir: MOON };
  for (const c of COLOR_KEYS) out[c] = a[c].map((v, j) => v + (b[c][j] - v) * u);
  for (const s of SCALAR_KEYS) out[s] = a[s] + (b[s] - a[s]) * u;
  return out;
}
