import * as THREE from 'three';
import { clamp, lerp, smoothstep, smootherstep } from './prng.js';

export const DURATION = 60.0;

export const SHOTS = [
  { id: 0, label: 'I · APPROACH', start: 0, end: 13 },
  { id: 1, label: 'II · GOLDEN ORBIT', start: 13, end: 27 },
  { id: 2, label: 'III · BEACH DUSK', start: 27, end: 38 },
  { id: 3, label: 'IV · THE BEACON', start: 38, end: 48 },
  { id: 4, label: 'V · STARRY NIGHT', start: 48, end: 60 },
];

export function getShotIndex(t) {
  const ct = clamp(t, 0, DURATION);
  for (let i = SHOTS.length - 1; i >= 0; i--) {
    if (ct >= SHOTS[i].start) return i;
  }
  return 0;
}

// Atmosphere & lighting keyframes across 0..60s
const KEYFRAMES = [
  {
    t: 0,
    sunElev: 25.0,
    sunAzim: -78.0,
    skyZenith: 0x1660b8,
    skyMid: 0x56a4dc,
    skyHorizon: 0xf7dcb2,
    sunGlow: 0xffe4a8,
    sunLight: 0xfff3d8,
    sunIntensity: 3.4,
    hemiSky: 0x8cc6f2,
    hemiGround: 0x7a7c58,
    hemiIntensity: 1.35,
    fogColor: 0xdfd0b8,
    fogDensity: 0.0017,
    oceanDeep: 0x093c62,
    oceanShallow: 0x1ec2b8,
    cloudLit: 0xfff9f0,
    cloudShadow: 0x99b8d4,
    exposure: 1.12,
  },
  {
    t: 14,
    sunElev: 12.0,
    sunAzim: -102.0,
    skyZenith: 0x1f4f92,
    skyMid: 0x7b86b2,
    skyHorizon: 0xffb072,
    sunGlow: 0xffc06a,
    sunLight: 0xffc27c,
    sunIntensity: 3.0,
    hemiSky: 0xb09ac0,
    hemiGround: 0x726046,
    hemiIntensity: 1.12,
    fogColor: 0xeaa072,
    fogDensity: 0.0021,
    oceanDeep: 0x092f4f,
    oceanShallow: 0x18a29e,
    cloudLit: 0xffd7a3,
    cloudShadow: 0x757094,
    exposure: 1.10,
  },
  {
    t: 25,
    sunElev: 2.8,
    sunAzim: -118.0,
    skyZenith: 0x1b2b5e,
    skyMid: 0x96476d,
    skyHorizon: 0xff7046,
    sunGlow: 0xff8d48,
    sunLight: 0xff7d48,
    sunIntensity: 2.4,
    hemiSky: 0xb26686,
    hemiGround: 0x4f3b34,
    hemiIntensity: 0.92,
    fogColor: 0xcf6350,
    fogDensity: 0.0025,
    oceanDeep: 0x0b203d,
    oceanShallow: 0x186e78,
    cloudLit: 0xff945c,
    cloudShadow: 0x52385e,
    exposure: 1.08,
  },
  {
    t: 31,
    sunElev: -1.8,
    sunAzim: -126.0,
    skyZenith: 0x111a3e,
    skyMid: 0x5c366b,
    skyHorizon: 0xcf5662,
    sunGlow: 0xe86c52,
    sunLight: 0xe06856,
    sunIntensity: 1.05,
    hemiSky: 0x6e548a,
    hemiGround: 0x332b38,
    hemiIntensity: 0.78,
    fogColor: 0x64405c,
    fogDensity: 0.0026,
    oceanDeep: 0x081730,
    oceanShallow: 0x124b5e,
    cloudLit: 0xdc6e74,
    cloudShadow: 0x2c2342,
    exposure: 1.08,
  },
  {
    t: 39,
    sunElev: -10.5,
    sunAzim: -135.0,
    skyZenith: 0x070e26,
    skyMid: 0x1b2a54,
    skyHorizon: 0x424272,
    sunGlow: 0x664c6c,
    sunLight: 0x7694cc,
    sunIntensity: 0.85,
    hemiSky: 0x344c88,
    hemiGround: 0x1c2536,
    hemiIntensity: 0.68,
    fogColor: 0x1f2848,
    fogDensity: 0.0023,
    oceanDeep: 0x050f24,
    oceanShallow: 0x0e3048,
    cloudLit: 0x5b6fa0,
    cloudShadow: 0x141c34,
    exposure: 1.12,
  },
  {
    t: 50,
    sunElev: -20.0,
    sunAzim: -145.0,
    skyZenith: 0x030716,
    skyMid: 0x0a1634,
    skyHorizon: 0x182d52,
    sunGlow: 0x223b64,
    sunLight: 0xaaccff,
    sunIntensity: 1.15,
    hemiSky: 0x29467e,
    hemiGround: 0x121b2c,
    hemiIntensity: 0.65,
    fogColor: 0x0d1930,
    fogDensity: 0.0019,
    oceanDeep: 0x040b1c,
    oceanShallow: 0x0c2c44,
    cloudLit: 0x3f5b8a,
    cloudShadow: 0x0a1224,
    exposure: 1.18,
  },
  {
    t: 60,
    sunElev: -24.0,
    sunAzim: -150.0,
    skyZenith: 0x020612,
    skyMid: 0x091430,
    skyHorizon: 0x162a4c,
    sunGlow: 0x1f365c,
    sunLight: 0xb2d2ff,
    sunIntensity: 1.2,
    hemiSky: 0x2b4a84,
    hemiGround: 0x121b2c,
    hemiIntensity: 0.66,
    fogColor: 0x0c182e,
    fogDensity: 0.0018,
    oceanDeep: 0x030a18,
    oceanShallow: 0x0b2a42,
    cloudLit: 0x415d8e,
    cloudShadow: 0x091020,
    exposure: 1.20,
  },
];

// Pre-allocated THREE.Colors for keyframes to avoid GC during updates
const KF_COLORS = KEYFRAMES.map((k) => ({
  skyZenith: new THREE.Color(k.skyZenith),
  skyMid: new THREE.Color(k.skyMid),
  skyHorizon: new THREE.Color(k.skyHorizon),
  sunGlow: new THREE.Color(k.sunGlow),
  sunLight: new THREE.Color(k.sunLight),
  hemiSky: new THREE.Color(k.hemiSky),
  hemiGround: new THREE.Color(k.hemiGround),
  fogColor: new THREE.Color(k.fogColor),
  oceanDeep: new THREE.Color(k.oceanDeep),
  oceanShallow: new THREE.Color(k.oceanShallow),
  cloudLit: new THREE.Color(k.cloudLit),
  cloudShadow: new THREE.Color(k.cloudShadow),
}));

export function createAtmosphereState() {
  return {
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    keyLightDir: new THREE.Vector3(),
    skyZenith: new THREE.Color(),
    skyMid: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    sunGlow: new THREE.Color(),
    sunLight: new THREE.Color(),
    sunIntensity: 1,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    fogColor: new THREE.Color(),
    fogDensity: 0.002,
    oceanDeep: new THREE.Color(),
    oceanShallow: new THREE.Color(),
    cloudLit: new THREE.Color(),
    cloudShadow: new THREE.Color(),
    exposure: 1,
    starAlpha: 0,
    moonAlpha: 0,
    lighthousePower: 0,
    cottageGlow: 0,
    nightFactor: 0,
    sunsetFactor: 0,
  };
}

function dirFromAngles(elevDeg, azimDeg, out) {
  const elev = THREE.MathUtils.degToRad(elevDeg);
  const azim = THREE.MathUtils.degToRad(azimDeg);
  const cosE = Math.cos(elev);
  out.set(Math.sin(azim) * cosE, Math.sin(elev), Math.cos(azim) * cosE).normalize();
  return out;
}

export function evaluateAtmosphere(t, out) {
  const ct = clamp(t, 0, DURATION);

  let i0 = 0;
  let i1 = KEYFRAMES.length - 1;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (ct >= KEYFRAMES[i].t && ct <= KEYFRAMES[i + 1].t) {
      i0 = i;
      i1 = i + 1;
      break;
    }
  }

  const k0 = KEYFRAMES[i0];
  const k1 = KEYFRAMES[i1];
  const c0 = KF_COLORS[i0];
  const c1 = KF_COLORS[i1];
  const rawU = k1.t === k0.t ? 0 : (ct - k0.t) / (k1.t - k0.t);
  const u = smoothstep(0, 1, rawU);

  const sunElev = lerp(k0.sunElev, k1.sunElev, u);
  const sunAzim = lerp(k0.sunAzim, k1.sunAzim, u);
  dirFromAngles(sunElev, sunAzim, out.sunDir);

  // Moon sits cleanly in the upper-left/center portrait sky for Shots 4 & 5, casting silver shimmer on the waves
  const moonElev = lerp(19.0, 25.5, smoothstep(32, 60, ct));
  const moonAzim = lerp(-148.0, -155.0, smoothstep(32, 60, ct));
  dirFromAngles(moonElev, moonAzim, out.moonDir);

  // Key directional light smoothly transitions from Sun to Moon around t=34..42
  const moonBlend = smootherstep(34.0, 42.0, ct);
  out.keyLightDir.copy(out.sunDir).lerp(out.moonDir, moonBlend).normalize();
  // Ensure directional light never goes underground
  if (out.keyLightDir.y < 0.08) {
    out.keyLightDir.y = 0.08;
    out.keyLightDir.normalize();
  }

  out.skyZenith.copy(c0.skyZenith).lerp(c1.skyZenith, u);
  out.skyMid.copy(c0.skyMid).lerp(c1.skyMid, u);
  out.skyHorizon.copy(c0.skyHorizon).lerp(c1.skyHorizon, u);
  out.sunGlow.copy(c0.sunGlow).lerp(c1.sunGlow, u);
  out.sunLight.copy(c0.sunLight).lerp(c1.sunLight, u);
  out.sunIntensity = lerp(k0.sunIntensity, k1.sunIntensity, u);
  out.hemiSky.copy(c0.hemiSky).lerp(c1.hemiSky, u);
  out.hemiGround.copy(c0.hemiGround).lerp(c1.hemiGround, u);
  out.hemiIntensity = lerp(k0.hemiIntensity, k1.hemiIntensity, u);
  out.fogColor.copy(c0.fogColor).lerp(c1.fogColor, u);
  out.fogDensity = lerp(k0.fogDensity, k1.fogDensity, u);
  out.oceanDeep.copy(c0.oceanDeep).lerp(c1.oceanDeep, u);
  out.oceanShallow.copy(c0.oceanShallow).lerp(c1.oceanShallow, u);
  out.cloudLit.copy(c0.cloudLit).lerp(c1.cloudLit, u);
  out.cloudShadow.copy(c0.cloudShadow).lerp(c1.cloudShadow, u);
  out.exposure = lerp(k0.exposure, k1.exposure, u);

  out.starAlpha = smootherstep(33.5, 46.5, ct);
  out.moonAlpha = smootherstep(31.5, 43.0, ct);
  out.cottageGlow = smootherstep(28.5, 33.5, ct);
  out.lighthousePower = smootherstep(31.5, 35.5, ct);
  out.nightFactor = smootherstep(32.0, 46.0, ct);
  out.sunsetFactor = smoothstep(14.0, 25.0, ct) * (1.0 - smoothstep(28.0, 38.0, ct));

  return out;
}

// Evaluate deterministic camera position, lookAt target, and FOV for any time t
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _tgtA = new THREE.Vector3();
const _tgtB = new THREE.Vector3();

export function evaluateCamera(t, outPos, outTarget) {
  const ct = clamp(t, 0, DURATION);
  const shotIdx = getShotIndex(ct);
  const shot = SHOTS[shotIdx];
  const u = clamp((ct - shot.start) / (shot.end - shot.start), 0, 1);
  const ease = smootherstep(0, 1, u);
  let fov = 46;

  if (shotIdx === 0) {
    // Shot 1 (0-13s): Distant approach skimming over open sunlit waves toward the island
    _posA.set(22.0, 4.8, 72.0);
    _posB.set(14.0, 9.2, 42.0);
    outPos.lerpVectors(_posA, _posB, ease);
    // Gentle deterministic wave-like camera float
    outPos.y += Math.sin(ct * 0.55) * 0.28;
    outPos.x += Math.sin(u * Math.PI) * 3.5;

    _tgtA.set(-1.5, 5.2, -1.0);
    _tgtB.set(-2.5, 7.6, -2.5);
    outTarget.lerpVectors(_tgtA, _tgtB, ease);
    fov = lerp(44, 46, ease);
  } else if (shotIdx === 1) {
    // Shot 2 (13-27s): Slow elevated orbit sweeping so the setting sun frames the lighthouse cliff
    const angle = lerp(0.58, 1.25, ease);
    const radius = lerp(47.0, 44.0, ease);
    const height = lerp(15.0, 11.2, ease);
    outPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    outPos.y += Math.sin(ct * 0.4) * 0.18;

    _tgtA.set(-2.5, 9.5, -2.5);
    _tgtB.set(-4.5, 11.2, -3.5);
    outTarget.lerpVectors(_tgtA, _tgtB, ease);
    fov = lerp(47, 46, ease);
  } else if (shotIdx === 2) {
    // Shot 3 (27-38s): Intimate low pass along the crescent beach & breaking foam at dusk
    // Skims over the glowing shallow cove looking across shore foam & palms up to the igniting lighthouse
    const p0 = new THREE.Vector3(28.0, 4.2, 24.5);
    const p1 = new THREE.Vector3(12.5, 4.0, 33.5);
    const p2 = new THREE.Vector3(-4.0, 5.2, 35.5);
    const inv = 1 - ease;
    outPos.set(
      inv * inv * p0.x + 2 * inv * ease * p1.x + ease * ease * p2.x,
      inv * inv * p0.y + 2 * inv * ease * p1.y + ease * ease * p2.y,
      inv * inv * p0.z + 2 * inv * ease * p1.z + ease * ease * p2.z
    );
    outPos.y += Math.sin(ct * 0.7) * 0.14;

    _tgtA.set(2.0, 6.2, 4.0);
    _tgtB.set(-4.2, 9.8, -2.5);
    outTarget.lerpVectors(_tgtA, _tgtB, ease);
    fov = lerp(50, 49, ease);
  } else if (shotIdx === 3) {
    // Shot 4 (38-48s): Dramatic upward ascent past the cliffs as the lighthouse beam sweeps & stars appear
    const angle = lerp(0.72, 0.25, ease);
    const radius = lerp(26.5, 30.5, ease);
    const height = lerp(11.5, 17.8, ease);
    outPos.set(-4.0 + Math.sin(angle) * radius, height, -3.5 + Math.cos(angle) * radius);

    _tgtA.set(-5.2, 20.0, -4.2);
    _tgtB.set(-5.2, 23.2, -4.2);
    outTarget.lerpVectors(_tgtA, _tgtB, ease);
    fov = lerp(48, 50, ease);
  } else {
    // Shot 5 (48-60s): Majestic starry night pull-back over the moonlit ocean
    _posA.set(16.0, 14.5, 38.0);
    _posB.set(28.0, 21.0, 72.0);
    outPos.lerpVectors(_posA, _posB, ease);
    outPos.y += Math.sin(ct * 0.35) * 0.2;

    // Frame island in lower third so starry sky, Milky Way & moon command the portrait upper two-thirds
    _tgtA.set(-2.5, 13.5, -2.5);
    _tgtB.set(-2.5, 20.5, -2.5);
    outTarget.lerpVectors(_tgtA, _tgtB, ease);
    fov = lerp(48, 52, ease);
  }

  return { shotIdx, fov };
}
