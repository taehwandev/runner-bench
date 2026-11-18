import * as THREE from 'three';
import { clamp, lerp } from './prng.js';

export const DURATION = 60;

export const SHOTS = [
  { index: 0, start: 0, end: 12, name: 'Approach' },
  { index: 1, start: 12, end: 24, name: 'Orbit' },
  { index: 2, start: 24, end: 36, name: 'Shoreline' },
  { index: 3, start: 36, end: 48, name: 'Lighthouse' },
  { index: 4, start: 48, end: 60, name: 'Night Pull-Back' }
];

function easeInOutSine(u) {
  return -(Math.cos(Math.PI * clamp(u, 0, 1)) - 1) * 0.5;
}

function easeOutCubic(u) {
  const x = 1 - clamp(u, 0, 1);
  return 1 - x * x * x;
}

export function getShotIndex(t) {
  const ct = clamp(t, 0, DURATION);
  for (let i = 0; i < SHOTS.length; i++) {
    if (ct < SHOTS[i].end || i === SHOTS.length - 1) {
      return i;
    }
  }
  return 0;
}

const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _t0 = new THREE.Vector3();
const _t1 = new THREE.Vector3();

export function evaluateCamera(t, outPos, outTarget) {
  const ct = clamp(t, 0, DURATION);
  const shotIdx = getShotIndex(ct);
  const shot = SHOTS[shotIdx];
  const u = clamp((ct - shot.start) / (shot.end - shot.start), 0, 1);
  let fov = 52;

  if (shotIdx === 0) {
    // Shot 0: Distant approach skimming low over sunlit swells
    const e = easeInOutSine(u);
    _p0.set(42, 4.4, 68);
    _p1.set(24, 6.2, 40);
    _t0.set(-4, 4.8, -2);
    _t1.set(-3, 5.2, -2);
    outPos.lerpVectors(_p0, _p1, e);
    outPos.y += Math.sin(u * Math.PI * 2.5) * 0.18;
    outTarget.lerpVectors(_t0, _t1, e);
    fov = lerp(50, 52, e);
  } else if (shotIdx === 1) {
    // Shot 1: Slow elevated orbit around the island into golden hour
    const e = easeInOutSine(u);
    const angle = lerp(0.72, -0.78, e);
    const radius = lerp(45, 43, e);
    outPos.set(
      Math.sin(angle) * radius,
      lerp(13.5, 11.2, e),
      Math.cos(angle) * radius
    );
    outTarget.set(-2.5, 4.8, -1.5);
    fov = 50;
  } else if (shotIdx === 2) {
    // Shot 2: Low pass along the crescent beach at sunset -> dusk
    const e = easeInOutSine(u);
    _p0.set(31.5, 4.2, 26.0);
    _p1.set(22.0, 4.8, -6.5);
    _t0.set(3.0, 2.8, 5.0);
    _t1.set(-10.0, 8.2, -4.5);
    outPos.lerpVectors(_p0, _p1, e);
    outTarget.lerpVectors(_t0, _t1, e);
    fov = lerp(54, 52, e);
  } else if (shotIdx === 3) {
    // Shot 3: Rising cliff & lighthouse ascent as night falls and beam turns on
    const e = easeInOutSine(u);
    _p0.set(-27.0, 6.5, 16.5);
    _p1.set(-20.5, 18.2, 11.5);
    _t0.set(-13.5, 17.8, -5.5);
    _t1.set(-12.0, 19.8, -5.0);
    outPos.lerpVectors(_p0, _p1, e);
    outTarget.lerpVectors(_t0, _t1, e);
    fov = 52;
  } else {
    // Shot 4: Grand pull-back under the starry sky
    const e = easeOutCubic(u);
    _p0.set(14, 11.5, 33);
    _p1.set(34, 21.5, 74);
    _t0.set(-4.5, 7.2, -2.5);
    _t1.set(-3.5, 9.5, -2.0);
    outPos.lerpVectors(_p0, _p1, e);
    outTarget.lerpVectors(_t0, _t1, e);
    fov = lerp(52, 55, e);
  }

  return { shot: shotIdx, fov };
}
