// Shot list -> camera rig evaluation. Pure: returns plain arrays for a time t.

import { SHOTS, DURATION } from '../config.js';
import { trainDistance, STOP_DISTANCE, TRAIN_LENGTH } from './kinematics.js';
import { track, TUNNEL, BRIDGE } from './landmarks.js';
import { noise1 } from './rng.js';

const tp = track.offsetPoint;
const ease = (u) => u * u * (3 - 2 * u);
const clamp01 = (u) => Math.min(1, Math.max(0, u));
const smooth = (a, b, x) => ease(clamp01((x - a) / (b - a)));
const mix = (a, b, u) => a + (b - a) * u;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function drift(t, amp, freq, seed) {
  return [
    noise1(t * freq, seed) * amp,
    noise1(t * freq, seed + 11) * amp * 0.7,
    noise1(t * freq, seed + 23) * amp,
  ];
}

// Each rig: (t, u in [0,1] across the shot) -> { pos, look, fov, roll }
const RIGS = {
  establish(t, u) {
    const dF = trainDistance(t);
    return {
      pos: add(tp(372 + 16 * t, -34 + 8 * u, 50 - 20 * ease(u)), drift(t, 0.5, 0.35, 1)),
      look: tp(dF - 42 + 16 * u, 0, 2),
      fov: 34 - 3 * u,
      roll: 0,
    };
  },
  tracking(t, u) {
    const dF = trainDistance(t);
    const camD = dF - 128 + 106 * ease(u);   // ends alongside the cab, nose in frame
    return {
      pos: add(tp(camD, 8.2, 3.0 + 1.6 * u), drift(t, 0.12, 1.4, 2)),
      look: tp(camD + 24, 0.8, 1.6),
      fov: 54,
      roll: -0.02,
    };
  },
  // from a rooftop below the deck, looking up as the train thunders past
  underpass(t, u) {
    const anchor = 548;
    const dF = trainDistance(t);
    return {
      pos: add(tp(anchor - 6, 21, -3.2), drift(t, 0.08, 0.5, 3)),
      look: tp(Math.min(anchor + 40, Math.max(anchor - 70, dF - 10)), 0, 5),
      fov: 60,
      roll: 0.05 - 0.04 * u,
    };
  },
  arrival(t, u) {
    const dF = trainDistance(t);
    const lookD = Math.max(dF - 30, STOP_DISTANCE - 70);
    return {
      pos: add(tp(STOP_DISTANCE + 30, 5.4, 2.7), drift(t, 0.05, 0.6, 4)),
      look: tp(lookD, -0.4, 4.4),
      fov: 32 + 6 * u,
      roll: 0,
    };
  },
  standing(t, u) {
    return {
      pos: add(tp(STOP_DISTANCE + 15 - 1.5 * u, -5.0, 2.1), drift(t, 0.04, 0.5, 5)),
      look: tp(STOP_DISTANCE - 9, 0.4, 3.1),
      fov: 44,
      roll: 0,
    };
  },
  // beside the viaduct between station and tower: the train pulls away toward us,
  // rushes past, and the camera pans with the nose until it enters the portal
  departure(t, u) {
    const dF = trainDistance(t);
    return {
      pos: add(tp(STOP_DISTANCE + 62 - 4 * u, -9.5, 3.2), drift(t, 0.06, 0.5, 6)),
      look: tp(dF - 2, 0, mix(2.4, 4.6, smooth(38, 40, t))),
      fov: 44,
      roll: 0,
    };
  },
  cabPOV(t, u) {
    const dF = trainDistance(t);
    const shake = drift(t, 0.035, 9, 7);
    return {
      pos: add(tp(dF - 12.5, 3.55, 4.1), shake),
      look: tp(dF + 70, 0.6, 2.2),
      fov: 62,
      roll: noise1(t * 3, 9) * 0.01,
    };
  },
  // watch the cars pour out of the portal, then whip round after the tail
  portal(t, u) {
    const base = TUNNEL.end;
    const rear = trainDistance(t) - TRAIN_LENGTH;
    const follow = smooth(45.6, 48.4, t);
    return {
      pos: add(tp(base + 62, -7, 2.6), drift(t, 0.05, 0.6, 8)),
      look: tp(mix(base - 4, rear + 30, follow), 0, mix(7, 2.5, follow)),
      fov: 50,
      roll: 0,
    };
  },
  pylon(t, u) {
    const dF = trainDistance(t);
    return {
      pos: add(tp(dF - 150 + 25 * u, -44, 30 + 6 * u), drift(t, 0.3, 0.3, 9)),
      look: tp(dF - 45, 0, 0),
      fov: 44,
      roll: 0,
    };
  },
  finale(t, u) {
    const dF = trainDistance(t);
    return {
      pos: add(tp(BRIDGE.pylons[0] - 40, 0, 20 + 10 * ease(u)), drift(t, 0.2, 0.3, 10)),
      look: tp(dF + 90, 0, 0),
      fov: 42,
      roll: 0,
    };
  },
};

export function shotIndexAt(t) {
  let i = 0;
  for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k].start) i = k;
  return i;
}

export function nextShotStart(t) {
  const i = shotIndexAt(t);
  return i + 1 < SHOTS.length ? SHOTS[i + 1].start : DURATION;
}

export function cameraAt(t) {
  const index = shotIndexAt(t);
  const shot = SHOTS[index];
  const u = clamp01((t - shot.start) / (shot.end - shot.start));
  const rig = RIGS[shot.kind](t, u);
  return { ...rig, index, name: shot.name };
}
