// The camera plan. Every shot is a pure function of time that returns a
// camera pose; cuts happen where config.SHOTS says. Also derives the look of
// each moment (night level, haze, exposure, practical lamp) and the sight
// lines the city planner must keep clear so the train is always readable.

import { SHOTS, DURATION, TIMES } from '../config.js';
import { clamp, lerp, smoothstep, smootherstep } from '../core/rng.js';
import { trackPoint } from '../core/track.js';
import { distanceAt, shotIndexAt, TRAIN_LENGTH } from '../core/timeline.js';
import { LAYOUT } from '../core/layout.js';

const st = LAYOUT.station;
const tn = LAYOUT.tunnel;
const P = (s, side, up) => trackPoint(s, side, up, {});
const pose = (cam, target, fov, shake = 0.03) => ({ cam, target, fov, shake });

// One entry per shot id. u runs 0..1 across the shot, t is scene time.
const CAMERAS = {
  // High crane ahead of the train, sinking as it snakes through the canyon.
  establishing(t, u) {
    const e = smootherstep(0, 1, u);
    const d = distanceAt(t);
    return pose(P(345, 8.5, lerp(44, 13, e)), P(d - lerp(40, 18, e), 0, lerp(15, 3, e)), lerp(23, 31, e), 0.05);
  },
  // Riding ahead of the locomotive, then letting the cars slide past.
  tracking(t, u) {
    const d = distanceAt(t);
    const lead = lerp(24, -64, smoothstep(0, 1, u));
    return pose(P(d + lead, 6.4 - 0.8 * u, 2.4 + 0.8 * u), P(d + lead - 26, 0, 2.9), 50, 0.07);
  },
  // Down among the buried roofs as the train thunders overhead.
  underpass(t) {
    const d = distanceAt(t);
    const rumble = Math.exp(-Math.pow((d - 790) / 130, 2));
    return pose(P(700, 19, -27), P(clamp(d - 14, 560, 800), 0, 2.5), 60, 0.04 + 0.22 * rumble);
  },
  // Long lens from the end of the platform: headlight first, braking.
  approach(t, u) {
    const d = distanceAt(t);
    return pose(P(st.stopS + 11.5, st.side * 4.6, 2.7), P(d - 4, 0, 2.6), lerp(15, 30, u), 0.02);
  },
  // Low on the platform as the locomotive eases to a stand.
  arrival(t) {
    const d = distanceAt(t);
    return pose(P(st.stopS + 7.5, st.side * 5.4, 2.5), P(d - 6, st.side * 0.3, 2.9), 54, 0.03);
  },
  // Standing train, lamps, snow; the signal ahead goes green.
  platform(t, u) {
    return pose(P(st.stopS - 50 + 5 * u, st.side * 4.5, 2.8), P(st.stopS + 26, -st.side * 0.4, 7.5), 48, 0.015);
  },
  // Above the roofs as it pulls out towards the tower block.
  departure(t, u) {
    return pose(P(st.stopS - 150 + 55 * u, -st.side * 3.4, 8.5 + 3 * u), P(tn.fromS - 50, 0, 3 - u), 42, 0.03);
  },
  // Inside the bore, drifting in front of the locomotive.
  tunnel(t, u) {
    const d = distanceAt(t);
    const e = smootherstep(0, 1, u);
    return pose(P(d + lerp(9, 17, u), lerp(4.4, 0.9, e), lerp(1.7, 2.3, u)), P(d - 6, 0, 3.2), lerp(50, 44, u), 0.09);
  },
  // Outside the far portal: tilt down the facade, then it bursts out.
  breakout(t) {
    const d = distanceAt(t);
    const w = smootherstep(TIMES.tunnelOut + 0.2, TIMES.tunnelOut + 1.9, t);
    const tilt = smoothstep(44.6, 45.9, t);
    const pass = Math.exp(-Math.pow((t - 47.4) / 1.2, 2));
    return pose(P(tn.toS + 60, st.side * 5.3, 2.3), P(lerp(tn.toS - 4, d - 24, w), 0, lerp(lerp(30, 5.5, tilt), 2.6, w)), 56, 0.03 + 0.14 * pass);
  },
  // High over the bridge, letting the train go into the night.
  bridge(t, u) {
    const d = distanceAt(t);
    const e = smootherstep(0, 1, u);
    // rises over the centreline, between the pylon legs, tilting up to the moon
    return pose(P(tn.toS + 158 + 38 * (t - 52), 0, 10 + 20 * e), P(d + lerp(-40, 120, e), 0, lerp(2, 14, e)), lerp(40, 26, e), 0.03);
  },
};

function wobble(t, f, phase) {
  return Math.sin(t * f + phase) * 0.6 + Math.sin(t * f * 2.3 + phase * 1.7) * 0.4;
}

/**
 * Camera pose for time t in the given shot (defaults to the shot on screen).
 * Returns { cam: {x,y,z}, target: {x,y,z}, fov } with handheld motion applied.
 */
export function cameraAt(t, shotIndex = shotIndexAt(t)) {
  const shot = SHOTS[shotIndex];
  const end = shotIndex + 1 < SHOTS.length ? SHOTS[shotIndex + 1].start : DURATION;
  const p = CAMERAS[shot.id](t, (t - shot.start) / (end - shot.start));
  const a = p.shake;
  p.cam.x += wobble(t, 1.3, 0.3) * a;
  p.cam.y += wobble(t, 1.7, 1.9) * a * 0.7;
  p.cam.z += wobble(t, 1.1, 4.1) * a;
  const reach = Math.hypot(p.target.x - p.cam.x, p.target.y - p.cam.y, p.target.z - p.cam.z);
  const b = a * reach * 0.012;
  p.target.x += wobble(t, 6.1, 2.2) * b;
  p.target.y += wobble(t, 7.3, 5.4) * b;
  return p;
}

const NIGHT_KEYS = [[0, 0.1], [24, 0.24], [34, 0.36], [46, 0.52], [60, 0.94]];

function nightAt(t) {
  for (let i = 0; i < NIGHT_KEYS.length - 1; i++) {
    const [t0, n0] = NIGHT_KEYS[i];
    const [t1, n1] = NIGHT_KEYS[i + 1];
    if (t <= t1) return lerp(n0, n1, clamp((t - t0) / (t1 - t0), 0, 1));
  }
  return NIGHT_KEYS[NIGHT_KEYS.length - 1][1];
}

/** Practical lamp: station lamps, then the tunnel ribs, then the far portal. */
function lampAt(t, inBore) {
  if (inBore) {
    const d = distanceAt(t);
    const rib = ((d - tn.fromS) / 15) % 1;
    const flick = 0.3 + 0.7 * Math.exp(-Math.min(rib, 1 - rib) * 15 * 0.35);
    return { pos: P(d - 3, 2.6, 6), color: [0.72, 0.9, 1.0], intensity: 700 * flick };
  }
  if (t < TIMES.tunnelIn) return { pos: P(st.stopS - 5, st.side * 4.8, st.floorY - LAYOUT.railY + 4.4), color: [1.0, 0.74, 0.46], intensity: 130 };
  return { pos: P(tn.toS + 5, 0, 6.5), color: [1.0, 0.62, 0.3], intensity: 300 };
}

/** Grade and atmosphere for time t: everything the renderer needs besides the camera. */
export function gradeAt(t) {
  const shot = SHOTS[shotIndexAt(t)];
  const inBore = shot.id === 'tunnel';
  const fadeIn = lerp(0.3, 1, smoothstep(0, 1.6, t));
  const fadeOut = 1 - 0.86 * smoothstep(DURATION - 1.1, DURATION, t);
  return {
    night: nightAt(t),
    haze: inBore ? 0.08 : 1,
    exposure: inBore ? 1.0 : 1.3,
    fade: fadeIn * fadeOut,
    lamp: lampAt(t, inBore),
  };
}

// Times at which the camera looks down a long avenue: reach (m) and rise (m).
const VISTAS = [
  { t: 0, reach: 2400, rise: 40 },
  { t: 0, reach: 2400, rise: 260 },
  { t: 4, reach: 2400, rise: 120 },
  { t: 22, reach: 2200, rise: 30 },
  { t: 22, reach: 2200, rise: 220 },
];

/**
 * Points along the lines of sight from each shot's camera to the train.
 * The city planner keeps buildings off these so no tower hides the train.
 */
export function sightSamples() {
  const points = [];
  const line = (a, b) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 10));
    for (let j = 0; j <= steps; j++) {
      const f = j / steps;
      points.push({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f) });
    }
  };
  // Vistas: open avenues to the horizon so the dusk sky shows behind the train.
  for (const v of VISTAS) {
    const { cam, target } = cameraAt(v.t);
    const run = Math.hypot(target.x - cam.x, target.z - cam.z);
    const far = { x: cam.x + ((target.x - cam.x) / run) * v.reach, y: cam.y + v.rise, z: cam.z + ((target.z - cam.z) / run) * v.reach };
    line(cam, far);
  }
  SHOTS.forEach((shot, i) => {
    if (shot.id === 'tunnel') return;
    const end = i + 1 < SHOTS.length ? SHOTS[i + 1].start : DURATION;
    for (let t = shot.start; t < end; t += 0.5) {
      const { cam } = cameraAt(t, i);
      const d = distanceAt(t);
      for (let k = 0; k <= 4; k++) {
        const p = P(d - (TRAIN_LENGTH * k) / 4, 0, 3);
        if (Math.hypot(p.x - cam.x, p.y - cam.y, p.z - cam.z) < 900) line(cam, p);
      }
    }
  });
  return points;
}
