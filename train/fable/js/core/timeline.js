// Pure timetable logic: where the train is and which shot is on screen at a
// given time. No DOM, no renderer, so it can be checked from Node.

import { DURATION, SPEED_KEYS, PHASES, TRAIN, SHOTS, TIMES } from '../config.js';

// Distance covered inside one eased segment, u in [0,1].
function segmentDistance(seg, u) {
  const span = seg.t1 - seg.t0;
  return span * (seg.v0 * u + (seg.v1 - seg.v0) * (u * u * u - 0.5 * u * u * u * u));
}

function buildSegments() {
  const segs = [];
  let d = 0;
  for (let i = 0; i < SPEED_KEYS.length - 1; i++) {
    const a = SPEED_KEYS[i];
    const b = SPEED_KEYS[i + 1];
    const seg = { t0: a.t, t1: b.t, v0: a.v, v1: b.v, d0: d };
    d += segmentDistance(seg, 1);
    seg.d1 = d;
    segs.push(seg);
  }
  return segs;
}

const SEGMENTS = buildSegments();
const FIRST = SEGMENTS[0];
const LAST = SEGMENTS[SEGMENTS.length - 1];

function segmentAt(t) {
  for (let i = 0; i < SEGMENTS.length; i++) if (t < SEGMENTS[i].t1) return SEGMENTS[i];
  return LAST;
}

/** Speed of the train in m/s. Exactly 0 while it stands at the platform. */
export function speedAt(t) {
  if (t <= FIRST.t0) return FIRST.v0;
  if (t >= LAST.t1) return LAST.v1;
  const seg = segmentAt(t);
  if (seg.v0 === seg.v1) return seg.v0;
  const u = (t - seg.t0) / (seg.t1 - seg.t0);
  return seg.v0 + (seg.v1 - seg.v0) * u * u * (3 - 2 * u);
}

/** Metres travelled by the head of the train. Defined for any t so that
 *  trailing effects (steam) can look into the past before t = 0. */
export function distanceAt(t) {
  if (t <= FIRST.t0) return FIRST.d0 + FIRST.v0 * (t - FIRST.t0);
  if (t >= LAST.t1) return LAST.d1 + LAST.v1 * (t - LAST.t1);
  const seg = segmentAt(t);
  if (seg.v0 === seg.v1) return seg.d0 + seg.v0 * (t - seg.t0);
  return seg.d0 + segmentDistance(seg, (t - seg.t0) / (seg.t1 - seg.t0));
}

export function accelAt(t) {
  if (t <= FIRST.t0 || t >= LAST.t1) return 0;
  const seg = segmentAt(t);
  const span = seg.t1 - seg.t0;
  const u = (t - seg.t0) / span;
  return ((seg.v1 - seg.v0) * 6 * u * (1 - u)) / span;
}

export const TRAIN_LENGTH = TRAIN.locoLength + TRAIN.cars.length * (TRAIN.carLength + TRAIN.gap);

// Landmarks are derived from the timetable, so geometry and schedule can
// never disagree.
export const LANDMARKS = {
  stationStop: distanceAt(TIMES.stop),
  tunnelStart: distanceAt(TIMES.tunnelIn),
  tunnelEnd: distanceAt(TIMES.tunnelOut),
  end: distanceAt(DURATION),
};

function phaseAt(t) {
  for (const p of PHASES) if (t < p.until) return p.name;
  return PHASES[PHASES.length - 1].name;
}

/** Full description of the train at time t. */
export function trainAt(t) {
  const distance = distanceAt(t);
  const speed = speedAt(t);
  const tail = distance - TRAIN_LENGTH;
  return {
    distance,
    speed,
    cars: TRAIN.cars.length,
    atStation: speed === 0 && distance === LANDMARKS.stationStop,
    // The locomotive is under the tower block: true for 40 s <= t < 46 s.
    inTunnel: distance >= LANDMARKS.tunnelStart && distance < LANDMARKS.tunnelEnd,
    fullyInTunnel: tail >= LANDMARKS.tunnelStart && distance <= LANDMARKS.tunnelEnd,
    tailDistance: tail,
    length: TRAIN_LENGTH,
    acceleration: accelAt(t),
    phase: phaseAt(t),
  };
}

export function clampTime(t) {
  if (!Number.isFinite(t)) return 0;
  return Math.min(DURATION, Math.max(0, t));
}

export function shotIndexAt(t) {
  let index = 0;
  for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i].start) index = i;
  return index;
}

/** Start time of the shot after the one playing at t, or null on the last. */
export function nextShotStart(t) {
  const i = shotIndexAt(t);
  return i + 1 < SHOTS.length ? SHOTS[i + 1].start : null;
}
