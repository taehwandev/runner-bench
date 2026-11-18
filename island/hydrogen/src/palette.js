import * as THREE from 'three';
import { clamp, lerp, smoothstep } from './prng.js';

const KEYFRAMES = [
  {
    t: 0,
    sunElevDeg: 26,
    sunAzimDeg: 222,
    skyZenith: '#1d65a8',
    skyMid: '#5da9de',
    skyHorizon: '#f4dab0',
    fogColor: '#d9ccb8',
    fogDensity: 0.0021,
    sunColor: '#fff0cc',
    sunIntensity: 3.1,
    hemiSky: '#8ac7f2',
    hemiGround: '#594b38',
    hemiIntensity: 1.05,
    oceanDeep: '#093859',
    oceanShallow: '#1a9a98',
    oceanSpec: '#ffe8b8',
    cloudLit: '#fff9ef',
    cloudShade: '#8fa9c7',
    exposure: 1.05
  },
  {
    t: 14,
    sunElevDeg: 12.5,
    sunAzimDeg: 238,
    skyZenith: '#214882',
    skyMid: '#d98962',
    skyHorizon: '#ffc06e',
    fogColor: '#d49a74',
    fogDensity: 0.0026,
    sunColor: '#ffb761',
    sunIntensity: 2.9,
    hemiSky: '#d99a7c',
    hemiGround: '#4a3529',
    hemiIntensity: 0.9,
    oceanDeep: '#0c2b47',
    oceanShallow: '#1b6d72',
    oceanSpec: '#ffba61',
    cloudLit: '#ffd49c',
    cloudShade: '#6f627d',
    exposure: 1.02
  },
  {
    t: 25,
    sunElevDeg: 2.2,
    sunAzimDeg: 250,
    skyZenith: '#1b204d',
    skyMid: '#b84c5b',
    skyHorizon: '#ff7d3b',
    fogColor: '#9e5352',
    fogDensity: 0.0031,
    sunColor: '#ff6629',
    sunIntensity: 2.3,
    hemiSky: '#c7686e',
    hemiGround: '#3d2a30',
    hemiIntensity: 0.92,
    oceanDeep: '#0a1b36',
    oceanShallow: '#1a4254',
    oceanSpec: '#ff7a3b',
    cloudLit: '#ff8a52',
    cloudShade: '#453352',
    exposure: 1.0
  },
  {
    t: 34,
    sunElevDeg: -4.5,
    sunAzimDeg: 260,
    skyZenith: '#0c1230',
    skyMid: '#2e2752',
    skyHorizon: '#783b4a',
    fogColor: '#2c2745',
    fogDensity: 0.0029,
    sunColor: '#d95b4e',
    sunIntensity: 0.55,
    hemiSky: '#565e91',
    hemiGround: '#212436',
    hemiIntensity: 0.68,
    oceanDeep: '#061126',
    oceanShallow: '#10273d',
    oceanSpec: '#c46c64',
    cloudLit: '#824b5d',
    cloudShade: '#1d1d38',
    exposure: 0.98
  },
  {
    t: 44,
    sunElevDeg: -12.0,
    sunAzimDeg: 270,
    skyZenith: '#040816',
    skyMid: '#0b1630',
    skyHorizon: '#182b4d',
    fogColor: '#0e1930',
    fogDensity: 0.0024,
    sunColor: '#9ec2ff',
    sunIntensity: 0.15,
    hemiSky: '#29406b',
    hemiGround: '#0c121f',
    hemiIntensity: 0.44,
    oceanDeep: '#030a18',
    oceanShallow: '#091b2e',
    oceanSpec: '#9ec2ff',
    cloudLit: '#2c4266',
    cloudShade: '#0b1224',
    exposure: 0.96
  },
  {
    t: 60,
    sunElevDeg: -16.0,
    sunAzimDeg: 280,
    skyZenith: '#03050f',
    skyMid: '#081126',
    skyHorizon: '#132442',
    fogColor: '#0a1426',
    fogDensity: 0.0022,
    sunColor: '#b5d2ff',
    sunIntensity: 0.08,
    hemiSky: '#2c4775',
    hemiGround: '#090e1a',
    hemiIntensity: 0.46,
    oceanDeep: '#020814',
    oceanShallow: '#08182b',
    oceanSpec: '#b5d2ff',
    cloudLit: '#294066',
    cloudShade: '#080e1c',
    exposure: 0.98
  }
];

const _cA = new THREE.Color();
const _cB = new THREE.Color();

function lerpHex(hexA, hexB, alpha, outColor) {
  _cA.set(hexA);
  _cB.set(hexB);
  return outColor.copy(_cA).lerp(_cB, alpha);
}

export function createAtmosphereState() {
  return {
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    skyZenith: new THREE.Color(),
    skyMid: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    fogColor: new THREE.Color(),
    fogDensity: 0.002,
    sunColor: new THREE.Color(),
    sunIntensity: 1,
    moonIntensity: 0,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    oceanDeep: new THREE.Color(),
    oceanShallow: new THREE.Color(),
    oceanSpec: new THREE.Color(),
    cloudLit: new THREE.Color(),
    cloudShade: new THREE.Color(),
    starOpacity: 0,
    lighthousePower: 0,
    cottagePower: 0,
    moonOpacity: 0,
    exposure: 1
  };
}

export function evaluateAtmosphere(t, out) {
  const ct = clamp(t, 0, 60);

  let k0 = KEYFRAMES[0];
  let k1 = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (ct >= KEYFRAMES[i].t && ct <= KEYFRAMES[i + 1].t) {
      k0 = KEYFRAMES[i];
      k1 = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = Math.max(0.0001, k1.t - k0.t);
  const rawAlpha = clamp((ct - k0.t) / span, 0, 1);
  // Smooth ease for organic transitions
  const a = rawAlpha * rawAlpha * (3 - 2 * rawAlpha);

  const sunElevRad = THREE.MathUtils.degToRad(lerp(k0.sunElevDeg, k1.sunElevDeg, a));
  const sunAzimRad = THREE.MathUtils.degToRad(lerp(k0.sunAzimDeg, k1.sunAzimDeg, a));

  out.sunDir.set(
    Math.cos(sunElevRad) * Math.sin(sunAzimRad),
    Math.sin(sunElevRad),
    Math.cos(sunElevRad) * Math.cos(sunAzimRad)
  ).normalize();

  // Moon rises in the eastern/northeastern sky during twilight and night
  const moonElevDeg = lerp(-8, 25, smoothstep(28, 60, ct));
  const moonAzimDeg = lerp(58, 82, smoothstep(28, 60, ct));
  const moonElevRad = THREE.MathUtils.degToRad(moonElevDeg);
  const moonAzimRad = THREE.MathUtils.degToRad(moonAzimDeg);

  out.moonDir.set(
    Math.cos(moonElevRad) * Math.sin(moonAzimRad),
    Math.sin(moonElevRad),
    Math.cos(moonElevRad) * Math.cos(moonAzimRad)
  ).normalize();

  lerpHex(k0.skyZenith, k1.skyZenith, a, out.skyZenith);
  lerpHex(k0.skyMid, k1.skyMid, a, out.skyMid);
  lerpHex(k0.skyHorizon, k1.skyHorizon, a, out.skyHorizon);
  lerpHex(k0.fogColor, k1.fogColor, a, out.fogColor);
  lerpHex(k0.sunColor, k1.sunColor, a, out.sunColor);
  lerpHex(k0.hemiSky, k1.hemiSky, a, out.hemiSky);
  lerpHex(k0.hemiGround, k1.hemiGround, a, out.hemiGround);
  lerpHex(k0.oceanDeep, k1.oceanDeep, a, out.oceanDeep);
  lerpHex(k0.oceanShallow, k1.oceanShallow, a, out.oceanShallow);
  lerpHex(k0.oceanSpec, k1.oceanSpec, a, out.oceanSpec);
  lerpHex(k0.cloudLit, k1.cloudLit, a, out.cloudLit);
  lerpHex(k0.cloudShade, k1.cloudShade, a, out.cloudShade);

  out.fogDensity = lerp(k0.fogDensity, k1.fogDensity, a);
  out.sunIntensity = lerp(k0.sunIntensity, k1.sunIntensity, a);
  out.hemiIntensity = lerp(k0.hemiIntensity, k1.hemiIntensity, a);
  out.exposure = lerp(k0.exposure, k1.exposure, a);

  out.starOpacity = smoothstep(30.5, 45.0, ct);
  out.moonOpacity = smoothstep(33.0, 44.0, ct);
  out.moonIntensity = smoothstep(32.0, 46.0, ct) * 1.15;
  out.lighthousePower = smoothstep(25.5, 31.5, ct);
  out.cottagePower = smoothstep(24.0, 30.0, ct);

  return out;
}
