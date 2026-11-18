// Pure functions of scene time: light/sky palette, celestial motion, lighthouse
// state and the camera shot list. No DOM or renderer access.
import * as THREE from 'three';
import { DUR, clamp, lerp, smooth } from './common.js';
import { beachPoint, BEACH_PASS, BAY_A, LIGHTHOUSE } from './terrain.js';

// ---------- celestial mechanics (a 3-hour time-lapse: 45 degrees of sky) ----------
const LAT = (15 * Math.PI) / 180;
const AXIS = new THREE.Vector3(0, Math.sin(LAT), -Math.cos(LAT));
const WEST = new THREE.Vector3(-1, 0, 0);
const UPISH = new THREE.Vector3(0, Math.cos(LAT), Math.sin(LAT));
const OMEGA = (Math.PI / 4) / DUR;
const SUNSET_T = 31;
const MOON_END = new THREE.Vector3(0.74, 0.50, -0.40).normalize();
const MILKY = new THREE.Vector3(0.45, 0.35, 0.82).normalize();
const MOON_SWITCH = 40.5;

function dirAzEl(azDeg, elDeg) {
  const a = (azDeg * Math.PI) / 180, e = (elDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
}
const METEOR_A = dirAzEl(-39, 30), METEOR_B = dirAzEl(-35.5, 21);

// ---------- palette keyframes ----------
const KEYS = [
  { t: 0, zen: [0.045, 0.17, 0.54], mid: [0.13, 0.34, 0.72], hor: [0.34, 0.54, 0.80], glow: [0.98, 0.84, 0.62],
    sun: [1.0, 0.90, 0.74], sunI: 1.75, glowI: 0.9, disc: [14, 12, 9], ambS: [0.15, 0.22, 0.34], ambG: [0.09, 0.08, 0.06],
    cl: [0.95, 0.92, 0.86], cd: [0.42, 0.50, 0.66], cov: 0.36, fog: 0.00045, exp: 0.86 },
  { t: 15, zen: [0.085, 0.20, 0.50], mid: [0.36, 0.44, 0.64], hor: [0.74, 0.64, 0.56], glow: [1.0, 0.66, 0.30],
    sun: [1.0, 0.72, 0.42], sunI: 1.75, glowI: 1.1, disc: [16, 10, 5], ambS: [0.13, 0.17, 0.29], ambG: [0.09, 0.07, 0.05],
    cl: [1.0, 0.80, 0.56], cd: [0.40, 0.39, 0.52], cov: 0.42, fog: 0.00060, exp: 0.88 },
  { t: 27, zen: [0.06, 0.11, 0.35], mid: [0.44, 0.29, 0.46], hor: [0.64, 0.40, 0.42], glow: [1.0, 0.42, 0.12],
    sun: [1.0, 0.44, 0.17], sunI: 1.6, glowI: 1.25, disc: [18, 7, 2.2], ambS: [0.11, 0.11, 0.23], ambG: [0.08, 0.05, 0.045],
    cl: [1.0, 0.50, 0.30], cd: [0.26, 0.19, 0.35], cov: 0.46, fog: 0.00085, exp: 0.94 },
  { t: 33, zen: [0.035, 0.065, 0.25], mid: [0.34, 0.19, 0.40], hor: [0.40, 0.23, 0.37], glow: [0.98, 0.33, 0.13],
    sun: [1.0, 0.36, 0.22], sunI: 0.4, glowI: 0.85, disc: [14, 4, 1.2], ambS: [0.08, 0.075, 0.19], ambG: [0.055, 0.035, 0.045],
    cl: [0.98, 0.36, 0.32], cd: [0.15, 0.10, 0.25], cov: 0.44, fog: 0.00095, exp: 1.05 },
  { t: 40, zen: [0.008, 0.015, 0.070], mid: [0.050, 0.040, 0.13], hor: [0.085, 0.055, 0.14], glow: [0.42, 0.13, 0.15],
    sun: [1.0, 0.4, 0.4], sunI: 0.0, glowI: 0.25, disc: [0, 0, 0], ambS: [0.035, 0.045, 0.11], ambG: [0.02, 0.02, 0.035],
    cl: [0.26, 0.13, 0.24], cd: [0.035, 0.035, 0.10], cov: 0.36, fog: 0.0011, exp: 1.25 },
  { t: 47, zen: [0.0012, 0.0024, 0.0095], mid: [0.0030, 0.0055, 0.018], hor: [0.008, 0.013, 0.032], glow: [0.016, 0.016, 0.040],
    sun: [0, 0, 0], sunI: 0.0, glowI: 0.0, disc: [0, 0, 0], ambS: [0.016, 0.026, 0.060], ambG: [0.008, 0.011, 0.022],
    cl: [0.016, 0.023, 0.050], cd: [0.003, 0.005, 0.014], cov: 0.24, fog: 0.0011, exp: 1.5 },
  { t: 60, zen: [0.0010, 0.0020, 0.0085], mid: [0.0026, 0.0048, 0.016], hor: [0.007, 0.012, 0.030], glow: [0.010, 0.013, 0.034],
    sun: [0, 0, 0], sunI: 0.0, glowI: 0.0, disc: [0, 0, 0], ambS: [0.015, 0.025, 0.060], ambG: [0.008, 0.011, 0.022],
    cl: [0.018, 0.025, 0.052], cd: [0.003, 0.005, 0.014], cov: 0.20, fog: 0.0011, exp: 1.55 },
];
const MOON_COL = [0.50, 0.64, 1.0], MOON_I = 0.20;

function key(t) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], u = smooth(a.t, b.t, t), o = {};
  for (const k in a) {
    if (k === 't') continue;
    o[k] = Array.isArray(a[k]) ? a[k].map((v, j) => lerp(v, b[k][j], u)) : lerp(a[k], b[k], u);
  }
  return o;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m4 = new THREE.Matrix4();

const LAMP = new THREE.Vector3();

// Beam phase is chosen so a flash crosses the final pull-back camera at t = 50.
const BEAM_PERIOD = 7;
let beamRef = 0;
export function beamAngle(t) { return beamRef + (Math.PI * 2 * (t - 50)) / BEAM_PERIOD; }

/** Writes every time-dependent uniform. `cam` is the camera position for this frame. */
export function applyEnvironment(t, U, cam) {
  const k = key(t);
  U.uTime.value = t;
  const th = (SUNSET_T - t) * OMEGA;
  const sun = U.uSunDir.value.copy(WEST).multiplyScalar(Math.cos(th)).addScaledVector(UPISH, Math.sin(th)).normalize();
  U.uSunAz.value.set(sun.x, sun.z).normalize();
  _q.setFromAxisAngle(AXIS, OMEGA * (DUR - t));
  const moon = U.uMoonDir.value.copy(MOON_END).applyQuaternion(_q).normalize();
  _q.setFromAxisAngle(AXIS, -OMEGA * t);
  U.uStarRot.value.setFromMatrix4(_m4.makeRotationFromQuaternion(_q));
  U.uMilkyN.value.copy(MILKY).applyQuaternion(_q);

  const night = smooth(35.5, 46, t);
  if (t < MOON_SWITCH) {
    U.uLightDir.value.copy(sun);
    U.uLightCol.value.fromArray(k.sun).multiplyScalar(k.sunI);
  } else {
    U.uLightDir.value.copy(moon);
    U.uLightCol.value.fromArray(MOON_COL).multiplyScalar(MOON_I * smooth(MOON_SWITCH, 46.5, t) * smooth(-0.02, 0.2, moon.y));
  }
  const L = U.uLightDir.value;
  U.uLightAz.value.set(L.x, L.z).normalize();
  U.uZenith.value.fromArray(k.zen); U.uMid.value.fromArray(k.mid); U.uHorizon.value.fromArray(k.hor);
  U.uSunGlow.value.fromArray(k.glow); U.uSunCol.value.fromArray(k.sun).multiplyScalar(k.glowI);
  U.uSunDisc.value.fromArray(k.disc);
  U.uAmbSky.value.fromArray(k.ambS); U.uAmbGnd.value.fromArray(k.ambG);
  U.uCloudLit.value.fromArray(k.cl); U.uCloudDark.value.fromArray(k.cd);
  U.uCloudCov.value = k.cov; U.uFogDen.value = k.fog; U.uExposure.value = k.exp;
  U.uNight.value = night;
  U.uMoonI.value = lerp(0.16, 2.4, night) * smooth(-0.03, 0.06, moon.y);
  U.uGulls.value = 1 - smooth(29, 35, t);
  U.uMeteorA.value.copy(METEOR_A); U.uMeteorB.value.copy(METEOR_B);

  // lighthouse: lamp warms up with a flicker, then the beam opens
  const warm = smooth(39.4, 40.8, t);
  const flick = warm < 1 ? 0.72 + 0.28 * Math.sin(t * 47) * Math.sin(t * 13.7) : 1;
  U.uLampOn.value = warm * flick;
  U.uBeamOn.value = smooth(40.8, 42.4, t);
  U.uWindowOn.value = smooth(33.5, 36.5, t);
  U.uLanternOn.value = smooth(35.5, 37.2, t);
  const b = beamAngle(t);
  U.uBeamDir.value.set(Math.cos(b), Math.sin(b));
  _v.set(cam.x - LAMP.x, 0, cam.z - LAMP.z).normalize();
  const al = Math.abs(_v.x * Math.cos(b) + _v.z * Math.sin(b));
  U.uFlare.value = U.uBeamOn.value * (0.8 * Math.pow(al, 420) + 0.18 * Math.pow(al, 50));
  return b;
}

// ---------- camera ----------
const ease = (u) => u * u * (3 - 2 * u);
const glide = (u) => lerp(u, ease(u), 0.6); // keeps a little speed through the cuts
const P = (x, y, z) => new THREE.Vector3(x, y, z);
const mix3 = (a, b, u, out) => out.copy(a).lerp(b, u);

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const COVE_DIR = P(Math.cos(BAY_A), 0, Math.sin(BAY_A));

export const SHOTS = [
  {
    name: 'approach', t0: 0, t1: 13,
    pose(u, t, pos, tgt) {
      const g = glide(u);
      mix3(P(-200, 3.2, 385), P(-112, 7.5, 196), g, pos);
      pos.y += 0.25 * Math.sin(t * 0.55);
      mix3(P(4, 17, -6), P(8, 15, -8), g, tgt);
      return lerp(44, 40, g);
    },
  },
  {
    name: 'orbit', t0: 13, t1: 27,
    pose(u, t, pos, tgt) {
      const g = glide(u);
      const ang = lerp(1.02, -0.20, g), R = lerp(285, 172, g);
      pos.set(Math.cos(ang) * R, lerp(64, 25, g), Math.sin(ang) * R);
      mix3(P(8, 14, -6), P(LIGHTHOUSE.x - 4, 30, LIGHTHOUSE.z + 2), ease(u), tgt);
      return lerp(44, 33, g);
    },
  },
  {
    name: 'beach', t0: 27, t1: 38,
    pose(u, t, pos, tgt) {
      const g = glide(u);
      const a = lerp(BEACH_PASS.a0, BEACH_PASS.a1, g);
      pos.copy(beachPoint(a, BEACH_PASS.inset));
      _a.copy(beachPoint(a + 0.12, BEACH_PASS.inset));
      _b.subVectors(_a, pos).setY(0).normalize();           // heading along the sand
      pos.y += 1.5 + 0.05 * Math.sin(t * 1.3);
      tgt.copy(pos).addScaledVector(_b, 0.24).addScaledVector(WEST, 1.0);
      tgt.y = pos.y + lerp(0.14, 0.22, g);
      return 64;
    },
  },
  {
    name: 'lighthouse', t0: 38, t1: 47,
    pose(u, t, pos, tgt) {
      const g = glide(u);
      mix3(P(100, 2.6, -84), P(88, 21, -74), g, pos);
      mix3(P(LIGHTHOUSE.x + 6, 16, LIGHTHOUSE.z - 6), P(LIGHTHOUSE.x, LAMP.y - 3.5, LIGHTHOUSE.z), ease(u), tgt);
      return lerp(56, 50, g);
    },
  },
  {
    name: 'pullback', t0: 47, t1: 60,
    pose(u, t, pos, tgt) {
      const g = 1 - Math.pow(1 - u, 1.6);
      const d = lerp(88, 330, g);
      pos.copy(COVE_DIR).multiplyScalar(d);
      pos.x += 10 * (1 - g); pos.z += 16 * (1 - g);
      pos.y = lerp(4.5, 46, g * g * 0.6 + g * 0.4);
      mix3(P(16, 19, -10), P(22, 77, -14), g, tgt);
      return lerp(50, 46, g);
    },
  },
];

export function shotIndexAt(t) {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].t0) return i;
  return 0;
}

const _pos = new THREE.Vector3(), _tgt = new THREE.Vector3();
export function applyCamera(t, camera) {
  const s = SHOTS[shotIndexAt(t)];
  const u = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  const fov = s.pose(u, t, _pos, _tgt);
  camera.position.copy(_pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(_tgt);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);
}

export function initTimeline(lamp) {
  LAMP.copy(lamp);
  const cam = new THREE.PerspectiveCamera(50, 9 / 16, 1, 100);
  applyCamera(50, cam);
  beamRef = Math.atan2(cam.position.z - lamp.z, cam.position.x - lamp.x);
}

// Opening fade-in and closing fade-out (0 = clear, 1 = black).
export function fadeAt(t) {
  return clamp(1 - smooth(0, 1.8, t) + smooth(57.6, 59.7, t), 0, 1);
}
