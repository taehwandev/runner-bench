import * as THREE from 'three';
import {
  TAU,
  clamp,
  lerp,
  saturate,
  smoothstep,
  smootherstep,
  easeInOutCubic,
} from './math.js';

export const TOTAL_DURATION = 60.0;

export const SHOTS = [
  { id: 1, name: 'Open Ocean', start: 0.0, end: 12.0 },
  { id: 2, name: 'Cliff & Crown', start: 12.0, end: 25.0 },
  { id: 3, name: 'Sundown Shore', start: 25.0, end: 37.0 },
  { id: 4, name: 'The Beacon', start: 37.0, end: 48.0 },
  { id: 5, name: 'Starry Night', start: 48.0, end: 60.0 },
];

const PALETTE_KEYFRAMES = [
  {
    t: 0.0,
    zenith: 0x1858a8,
    midSky: 0x4b92cf,
    horizon: 0xf7cb8b,
    afterglow: 0xffe0a8,
    sunColor: 0xfff0c8,
    fogColor: 0xd9c7a8,
    fogDensity: 0.0022,
    ambientSky: 0x7cb2e8,
    ambientGround: 0x4d4232,
    sunIntensity: 3.1,
    moonIntensity: 0.0,
    cloudLit: 0xfff4dc,
    cloudShadow: 0x7c8fb0,
    waterDeep: 0x062d54,
    waterShallow: 0x16a7a8,
  },
  {
    t: 14.0,
    zenith: 0x173e80,
    midSky: 0x6f6fa6,
    horizon: 0xff9e54,
    afterglow: 0xffb86c,
    sunColor: 0xffb463,
    fogColor: 0xd98f6c,
    fogDensity: 0.0028,
    ambientSky: 0x8d79a8,
    ambientGround: 0x47332a,
    sunIntensity: 2.65,
    moonIntensity: 0.0,
    cloudLit: 0xffbe7b,
    cloudShadow: 0x5c587d,
    waterDeep: 0x072347,
    waterShallow: 0x158b94,
  },
  {
    t: 26.0,
    zenith: 0x121f4d,
    midSky: 0x6e3a67,
    horizon: 0xff5a36,
    afterglow: 0xff7b47,
    sunColor: 0xff6230,
    fogColor: 0x9e4b52,
    fogDensity: 0.0033,
    ambientSky: 0x734978,
    ambientGround: 0x332026,
    sunIntensity: 1.75,
    moonIntensity: 0.08,
    cloudLit: 0xff724c,
    cloudShadow: 0x35294a,
    waterDeep: 0x071836,
    waterShallow: 0x126273,
  },
  {
    t: 35.0,
    zenith: 0x09112b,
    midSky: 0x2c224c,
    horizon: 0xb84644,
    afterglow: 0xd96548,
    sunColor: 0xe0482d,
    fogColor: 0x342644,
    fogDensity: 0.0031,
    ambientSky: 0x3b3d6e,
    ambientGround: 0x181826,
    sunIntensity: 0.28,
    moonIntensity: 0.42,
    cloudLit: 0xc4585c,
    cloudShadow: 0x19182e,
    waterDeep: 0x040f24,
    waterShallow: 0x0c3e52,
  },
  {
    t: 45.0,
    zenith: 0x040917,
    midSky: 0x0c1b38,
    horizon: 0x232a4a,
    afterglow: 0x453254,
    sunColor: 0x6e3038,
    fogColor: 0x0d172c,
    fogDensity: 0.0025,
    ambientSky: 0x263a63,
    ambientGround: 0x0e1422,
    sunIntensity: 0.0,
    moonIntensity: 0.82,
    cloudLit: 0x253554,
    cloudShadow: 0x0b1020,
    waterDeep: 0x020917,
    waterShallow: 0x082d40,
  },
  {
    t: 60.0,
    zenith: 0x030611,
    midSky: 0x08142b,
    horizon: 0x14223d,
    afterglow: 0x1d2a47,
    sunColor: 0x302030,
    fogColor: 0x081122,
    fogDensity: 0.0022,
    ambientSky: 0x243961,
    ambientGround: 0x0c1320,
    sunIntensity: 0.0,
    moonIntensity: 0.92,
    cloudLit: 0x1f304d,
    cloudShadow: 0x080d1a,
    waterDeep: 0x020713,
    waterShallow: 0x07283b,
  },
];

function mixHexToColor(target, hexA, hexB, u) {
  const ar = ((hexA >> 16) & 255) / 255;
  const ag = ((hexA >> 8) & 255) / 255;
  const ab = (hexA & 255) / 255;
  const br = ((hexB >> 16) & 255) / 255;
  const bg = ((hexB >> 8) & 255) / 255;
  const bb = (hexB & 255) / 255;
  target.setRGB(lerp(ar, br, u), lerp(ag, bg, u), lerp(ab, bb, u));
  return target;
}

export function getShotForTime(t) {
  const clamped = clamp(t, 0, TOTAL_DURATION);
  for (let i = 0; i < SHOTS.length; i++) {
    const s = SHOTS[i];
    if (clamped < s.end || i === SHOTS.length - 1) {
      return s;
    }
  }
  return SHOTS[SHOTS.length - 1];
}

export function getNextShotStartTime(t) {
  const current = getShotForTime(t);
  const nextIdx = SHOTS.findIndex((s) => s.id === current.id) + 1;
  if (nextIdx >= SHOTS.length) {
    return 0.0;
  }
  return SHOTS[nextIdx].start;
}

export function evaluateAtmosphere(t, out) {
  const time = clamp(t, 0, TOTAL_DURATION);
  let kfA = PALETTE_KEYFRAMES[0];
  let kfB = PALETTE_KEYFRAMES[PALETTE_KEYFRAMES.length - 1];
  let u = 0;

  for (let i = 0; i < PALETTE_KEYFRAMES.length - 1; i++) {
    if (time >= PALETTE_KEYFRAMES[i].t && time <= PALETTE_KEYFRAMES[i + 1].t) {
      kfA = PALETTE_KEYFRAMES[i];
      kfB = PALETTE_KEYFRAMES[i + 1];
      u = smoothstep(kfA.t, kfB.t, time);
      break;
    }
  }

  mixHexToColor(out.zenith, kfA.zenith, kfB.zenith, u);
  mixHexToColor(out.midSky, kfA.midSky, kfB.midSky, u);
  mixHexToColor(out.horizon, kfA.horizon, kfB.horizon, u);
  mixHexToColor(out.afterglow, kfA.afterglow, kfB.afterglow, u);
  mixHexToColor(out.sunColor, kfA.sunColor, kfB.sunColor, u);
  mixHexToColor(out.fogColor, kfA.fogColor, kfB.fogColor, u);
  mixHexToColor(out.ambientSky, kfA.ambientSky, kfB.ambientSky, u);
  mixHexToColor(out.ambientGround, kfA.ambientGround, kfB.ambientGround, u);
  mixHexToColor(out.cloudLit, kfA.cloudLit, kfB.cloudLit, u);
  mixHexToColor(out.cloudShadow, kfA.cloudShadow, kfB.cloudShadow, u);
  mixHexToColor(out.waterDeep, kfA.waterDeep, kfB.waterDeep, u);
  mixHexToColor(out.waterShallow, kfA.waterShallow, kfB.waterShallow, u);

  out.fogDensity = lerp(kfA.fogDensity, kfB.fogDensity, u);
  out.sunIntensity = lerp(kfA.sunIntensity, kfB.sunIntensity, u);
  out.moonIntensity = lerp(kfA.moonIntensity, kfB.moonIntensity, u);

  // Sun descends from +23 deg in late afternoon to 0 deg at t~31.5s, then -17 deg at 60s
  const sunAltDeg = lerp(23.0, -17.5, Math.pow(time / TOTAL_DURATION, 0.94));
  const sunAlt = THREE.MathUtils.degToRad(sunAltDeg);
  const sunAzimuth = lerp(-2.06, -2.24, time / TOTAL_DURATION); // North-Northwest horizon
  const cosAlt = Math.cos(sunAlt);
  out.sunDir.set(Math.cos(sunAzimuth) * cosAlt, Math.sin(sunAlt), Math.sin(sunAzimuth) * cosAlt).normalize();
  out.sunElevation = sunAlt;

  // Cool silver-blue moonlight from upper South-East in night scenes for crisp cliff/palm rim light
  out.moonDir.set(0.58, 0.64, 0.50).normalize();

  // Stars emerge starting around t=32s, reaching full brilliance by t=48s
  out.starVisibility = smootherstep(31.5, 48.5, time);

  // Keeper cottage warm window glow turns on at t=31.5s..34s
  out.cottageGlow = smootherstep(31.0, 34.0, time);

  // Lighthouse lantern ignites at dusk (t=33.8s..37.2s) with a subtle warm filament ramp
  const lampBase = smootherstep(33.6, 37.2, time);
  const ignitionPulse = 1.0 + 0.08 * Math.sin(time * 9.0) * smoothstep(33.6, 35.0, time) * smoothstep(37.5, 35.2, time);
  out.lighthousePower = saturate(lampBase * ignitionPulse);

  // Volumetric beam visibility strengthens as twilight darkens
  out.beamVisibility = smootherstep(34.2, 41.5, time);
  // Steady deterministic rotation: 1 full turn every 9.6s (twin beams sweep every 4.8s)
  out.beamAngle = time * (TAU / 9.6) + 0.85;

  // Deterministic tropical wind strength (gentle breeze + rhythmic ocean gusts)
  out.windStrength = 0.62 + 0.24 * Math.sin(time * 0.43) + 0.14 * Math.sin(time * 1.11 + 1.4);

  return out;
}

export function createAtmosphereState() {
  return {
    zenith: new THREE.Color(),
    midSky: new THREE.Color(),
    horizon: new THREE.Color(),
    afterglow: new THREE.Color(),
    sunColor: new THREE.Color(),
    fogColor: new THREE.Color(),
    ambientSky: new THREE.Color(),
    ambientGround: new THREE.Color(),
    cloudLit: new THREE.Color(),
    cloudShadow: new THREE.Color(),
    waterDeep: new THREE.Color(),
    waterShallow: new THREE.Color(),
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    fogDensity: 0.0024,
    sunIntensity: 3.0,
    moonIntensity: 0.0,
    sunElevation: 0.35,
    starVisibility: 0.0,
    cottageGlow: 0.0,
    lighthousePower: 0.0,
    beamVisibility: 0.0,
    beamAngle: 0.0,
    windStrength: 0.7,
  };
}

export function evaluateCameraRig(t, outPos, outTarget) {
  const time = clamp(t, 0, TOTAL_DURATION);
  const shot = getShotForTime(time);
  const uRaw = saturate((time - shot.start) / (shot.end - shot.start));
  const u = easeInOutCubic(uRaw);
  // Subtle deterministic handheld/ocean breathe micro-motion (zero frame accumulation)
  const swayX = Math.sin(time * 0.65) * 0.12;
  const swayY = Math.cos(time * 0.82) * 0.08;

  let fov = 52;
  let roll = 0;

  if (shot.id === 1) {
    // Shot 1 (0-12s): Distant low approach skimming over open afternoon waves toward island
    const k = smootherstep(0, 1, uRaw);
    outPos.set(lerp(10.5, 5.2, k) + swayX, lerp(4.8, 7.8, k) + swayY, lerp(84.0, 52.0, uRaw));
    outTarget.set(lerp(-2.2, -0.4, k), lerp(9.4, 8.6, k), lerp(-3.0, -2.5, k));
    fov = lerp(51, 53, k);
  } else if (shot.id === 2) {
    // Shot 2 (12-25s): Rising golden-hour aerial orbit around cliff headland into sunset
    const angle = lerp(0.84, 0.14, uRaw);
    const radius = lerp(49.0, 41.0, u);
    outPos.set(
      Math.cos(angle) * radius + swayX,
      lerp(21.5, 15.2, u) + swayY,
      Math.sin(angle) * radius
    );
    outTarget.set(lerp(-1.2, 0.8, u), lerp(8.4, 10.2, u), lerp(-2.2, -4.0, u));
    fov = 52;
    roll = -0.018 * Math.sin(uRaw * Math.PI);
  } else if (shot.id === 3) {
    // Shot 3 (25-37s): Intimate low pass along curved crescent beach & lagoon as sun sets & beacon ignites
    const k = smootherstep(0, 1, uRaw);
    outPos.set(lerp(-10.8, 5.4, uRaw) + swayX * 0.6, lerp(3.15, 4.55, k) + swayY * 0.5, lerp(19.2, 20.6, k));
    outTarget.set(lerp(-4.2, 1.8, k), lerp(6.8, 9.8, k), lerp(-6.0, -4.6, k));
    fov = 55;
    roll = 0.012 * Math.sin(uRaw * Math.PI);
  } else if (shot.id === 4) {
    // Shot 4 (37-48s): Dusk cliff headland crane & arc past glowing lighthouse and sweeping beams
    const angle = lerp(0.58, -0.18, uRaw);
    const radius = lerp(21.5, 25.5, u);
    outPos.set(
      4.0 + Math.cos(angle) * radius + swayX * 0.5,
      lerp(13.8, 19.6, u) + swayY * 0.5,
      -4.4 + Math.sin(angle) * radius
    );
    outTarget.set(lerp(2.0, 2.8, u), lerp(15.2, 16.4, u), lerp(-4.4, -4.6, u));
    fov = 50;
  } else {
    // Shot 5 (48-60s): Serene poetic pull-back across dark ocean as lighthouse sweeps under starry night
    const k = smootherstep(0, 1, uRaw);
    outPos.set(lerp(9.5, 15.5, k) + swayX, lerp(14.0, 23.5, k) + swayY, lerp(47.0, 76.0, k));
    outTarget.set(lerp(1.2, 0.4, k), lerp(11.0, 12.2, k), lerp(-3.2, -2.5, k));
    fov = lerp(52, 50, k);
  }

  return { shot, fov, roll };
}
