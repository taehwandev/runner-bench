import * as THREE from 'three';
import { clamp, smoothstep } from './prng.js';

export const DURATION = 60.0;
export const TRACK_Y = 22.0;

export const TRAIN_SPEC = {
  locoLength: 16.0,
  carCount: 9,
  carLength: 10.2,
  gap: 0.9,
  carPitch: 11.1,
  // Total length from loco nose tip (0) to rear of car 8: 16.0 + 0.9 + 8 * 11.1 + 10.2 = 115.9 m
  totalLength: 115.9,
  wheelRadius: 0.58,
};

export const WORLD_ZONES = {
  stationStart: 630.0,
  stationStopHead: 756.0,
  stationEnd: 772.0,
  tunnelStart: 876.0,
  tunnelEnd: 1000.0,
  bridgeStart: 1000.0,
  bridgeEnd: 1760.0,
};

export const SHOTS = [
  { id: 1, start: 0.0, end: 11.0, label: 'DUSK CANYON' },
  { id: 2, start: 11.0, end: 22.0, label: 'VIADUCT OVERPASS' },
  { id: 3, start: 22.0, end: 34.0, label: 'ELEVATED STATION' },
  { id: 4, start: 34.0, end: 40.0, label: 'DEPARTURE SURGE' },
  { id: 5, start: 40.0, end: 46.0, label: 'TOWER TUNNEL' },
  { id: 6, start: 46.0, end: 60.0, label: 'NIGHT BRIDGE' },
];

export function getShotIndexAtTime(t) {
  const ct = clamp(t, 0, DURATION);
  for (let i = 0; i < SHOTS.length; i++) {
    if (ct < SHOTS[i].end) return i;
  }
  return SHOTS.length - 1;
}

export function getShotAtTime(t) {
  return SHOTS[getShotIndexAtTime(t)].id;
}

/**
 * Exact closed-form kinematics following the fixed 60-second timetable:
 *  0-24s: 28 m/s along elevated track between towers
 * 24-30s: cosine deceleration from 28 -> 0 m/s into station (s = 756 m)
 * 30-34s: stationary at platform (speed === 0)
 * 34-40s: cosine acceleration from 0 -> 40 m/s
 * 40-46s: 40 m/s through the tower tunnel (s = 876..1000 m, train length 115.9 m)
 * 46-60s: 40 m/s across the long bridge into the night
 */
export function getTrainState(timeSec) {
  const t = clamp(timeSec, 0, DURATION);
  let distance = 0;
  let speed = 0;

  if (t < 24.0) {
    speed = 28.0;
    distance = 28.0 * t;
  } else if (t < 30.0) {
    const u = t - 24.0;
    speed = 14.0 * (1.0 + Math.cos((Math.PI * u) / 6.0));
    distance = 672.0 + 14.0 * u + (84.0 / Math.PI) * Math.sin((Math.PI * u) / 6.0);
  } else if (t <= 34.0) {
    speed = 0.0;
    distance = 756.0;
  } else if (t < 40.0) {
    const u = t - 34.0;
    speed = 20.0 * (1.0 - Math.cos((Math.PI * u) / 6.0));
    distance = 756.0 + 20.0 * u - (120.0 / Math.PI) * Math.sin((Math.PI * u) / 6.0);
  } else {
    speed = 40.0;
    distance = 876.0 + 40.0 * (t - 40.0);
  }

  const tail = distance - TRAIN_SPEC.totalLength;
  const atStation = t >= 30.0 && t <= 34.0;
  const inTunnel = distance >= WORLD_ZONES.tunnelStart && tail <= WORLD_ZONES.tunnelEnd;

  return {
    distance,
    speed,
    cars: TRAIN_SPEC.carCount,
    atStation,
    inTunnel,
  };
}

/**
 * Curvature-integrated arc-length track path.
 * Straight along X=0, -Z through Station [600..840] and Tunnel [840..1030],
 * with sweeping S-curves in the city canyon and a graceful arc across the night bridge.
 */
class TrackPath {
  constructor() {
    this.sMin = -180.0;
    this.sMax = 1860.0;
    this.step = 0.5;
    const count = Math.round((this.sMax - this.sMin) / this.step) + 1;
    this.xs = new Float32Array(count);
    this.zs = new Float32Array(count);
    this.thetas = new Float32Array(count);
    this.count = count;

    const zeroIndex = Math.round((600.0 - this.sMin) / this.step);
    // Build forward from s=600 (x=0, z=-600, theta=0) and backward from s=600
    this.xs[zeroIndex] = 0;
    this.zs[zeroIndex] = -600;
    this.thetas[zeroIndex] = 0;

    for (let i = zeroIndex + 1; i < count; i++) {
      const sMid = this.sMin + (i - 0.5) * this.step;
      const th = this._headingAt(sMid);
      this.thetas[i] = this._headingAt(this.sMin + i * this.step);
      this.xs[i] = this.xs[i - 1] + Math.sin(th) * this.step;
      this.zs[i] = this.zs[i - 1] - Math.cos(th) * this.step;
    }

    for (let i = zeroIndex - 1; i >= 0; i--) {
      const sMid = this.sMin + (i + 0.5) * this.step;
      const th = this._headingAt(sMid);
      this.thetas[i] = this._headingAt(this.sMin + i * this.step);
      this.xs[i] = this.xs[i + 1] - Math.sin(th) * this.step;
      this.zs[i] = this.zs[i + 1] + Math.cos(th) * this.step;
    }
  }

  _headingAt(s) {
    if (s >= 560 && s <= 1060) return 0.0;
    if (s < 560) {
      // Sweeping S-curve in the city canyon approaching the straight station stretch
      const fadeOut = 1.0 - smoothstep(420, 560, s);
      const wave1 = -0.44 * smoothstep(260, 460, 560 - s) * (1.0 - smoothstep(250, 440, s));
      const wave2 = 0.52 * smoothstep(40, 280, 560 - s);
      const bend = -0.36 * Math.sin((560 - s) * 0.0085) * fadeOut;
      return (wave1 + wave2 + bend) * 0.65 * fadeOut;
    }
    // Sweeping bridge arc after s=1060 into the night
    return 0.42 * smoothstep(1060, 1620, s);
  }

  sample(s, outPos, outForward, outRight) {
    const clamped = clamp(s, this.sMin, this.sMax - this.step);
    const fIdx = (clamped - this.sMin) / this.step;
    const i0 = Math.floor(fIdx);
    const i1 = Math.min(i0 + 1, this.count - 1);
    const alpha = fIdx - i0;

    const x = this.xs[i0] + (this.xs[i1] - this.xs[i0]) * alpha;
    const z = this.zs[i0] + (this.zs[i1] - this.zs[i0]) * alpha;
    const th = this.thetas[i0] + (this.thetas[i1] - this.thetas[i0]) * alpha;

    if (outPos) outPos.set(x, TRACK_Y, z);
    const fx = Math.sin(th);
    const fz = -Math.cos(th);
    if (outForward) outForward.set(fx, 0, fz);
    if (outRight) outRight.set(-fz, 0, fx);
    return th;
  }

  getPoint(s) {
    const pos = new THREE.Vector3();
    this.sample(s, pos);
    return pos;
  }
}

export const trackPath = new TrackPath();
