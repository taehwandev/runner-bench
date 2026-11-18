// Pure track centreline. `s` is arc length in metres; the line swings through
// an S-curve between the towers and is dead straight (down -Z, x = 0) from
// TRACK.straightFrom onwards, where station, tunnel and bridge sit.

import { TRACK } from '../config.js';
import { smoothstep } from './rng.js';

const STEP = 1; // metres of arc length per table entry
const Q_MAX = TRACK.straightFrom - TRACK.from + 200;

// Lateral offset as a function of q = longitudinal metres before the straight.
function lateral(q) {
  if (q <= 0) return 0;
  return TRACK.curveAmp * Math.sin(q / TRACK.curveWave) * smoothstep(0, TRACK.curveEase, q);
}

// Table of q at uniform arc-length steps, built once by marching the curve.
function buildArcTable() {
  const table = [0];
  const fine = 0.05;
  let q = 0;
  let arc = 0;
  let next = STEP;
  let prev = lateral(0);
  while (q < Q_MAX) {
    q += fine;
    const cur = lateral(q);
    arc += Math.hypot(fine, cur - prev);
    prev = cur;
    if (arc >= next) {
      table.push(q);
      next += STEP;
    }
  }
  return table;
}

const ARC_TABLE = buildArcTable();

function qAtArc(arc) {
  const f = arc / STEP;
  const i = Math.min(ARC_TABLE.length - 2, Math.floor(f));
  return ARC_TABLE[i] + (ARC_TABLE[i + 1] - ARC_TABLE[i]) * (f - i);
}

/**
 * Sample the centreline. Writes into `out` (or a fresh object):
 * x, y, z position on the rail head; tx, tz unit direction of travel;
 * rx, rz unit vector to the right of travel.
 */
export function sampleTrack(s, out = {}) {
  const arc = TRACK.straightFrom - s;
  out.y = TRACK.railY;
  if (arc <= 0) {
    out.x = 0;
    out.z = -s;
    out.tx = 0;
    out.tz = -1;
  } else {
    const q = qAtArc(arc);
    const e = 0.25;
    const slope = (lateral(q + e) - lateral(q - e)) / (2 * e);
    const inv = 1 / Math.hypot(slope, 1);
    out.x = lateral(q);
    out.z = q - TRACK.straightFrom;
    out.tx = -slope * inv;
    out.tz = -inv;
  }
  out.rx = -out.tz;
  out.rz = out.tx;
  return out;
}

/** World position at distance s, `side` metres to the right and `up` above the rail. */
export function trackPoint(s, side = 0, up = 0, out = {}) {
  sampleTrack(s, out);
  out.x += out.rx * side;
  out.z += out.rz * side;
  out.y += up;
  return out;
}

/** Shortest horizontal distance from (x, z) to the centreline, coarse but cheap. */
export function distanceToTrack(x, z) {
  const tmp = {};
  let best = Infinity;
  for (let s = TRACK.from; s <= TRACK.to; s += 12) {
    sampleTrack(s, tmp);
    const d = Math.hypot(tmp.x - x, tmp.z - z);
    if (d < best) best = d;
  }
  return best;
}
