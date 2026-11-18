// Pure placement of the vehicles along the track. Used by the renderer and by
// the effects, which need to know where a vehicle was at an earlier time.

import { TRAIN } from '../config.js';
import { sampleTrack } from './track.js';

function buildVehicles() {
  const list = [{ type: 'loco', length: TRAIN.locoLength, center: TRAIN.locoLength / 2, wheelbase: 8 }];
  let back = TRAIN.locoLength;
  for (const type of TRAIN.cars) {
    back += TRAIN.gap;
    list.push({ type, length: TRAIN.carLength, center: back + TRAIN.carLength / 2, wheelbase: 4.8 });
    back += TRAIN.carLength;
  }
  return list;
}

/** Vehicles front to back; `center` is metres behind the head of the train. */
export const VEHICLES = buildVehicles();

const _a = {};
const _b = {};

/**
 * Pose of a vehicle when the head of the train is at `distance`.
 * Writes x, y, z (rail level under the vehicle centre), fx, fz (unit forward),
 * yaw and s (track distance of the centre) into `out`.
 */
export function vehiclePose(distance, vehicle, out = {}) {
  const s = distance - vehicle.center;
  sampleTrack(s + vehicle.wheelbase, _a);
  sampleTrack(s - vehicle.wheelbase, _b);
  const dx = _a.x - _b.x;
  const dz = _a.z - _b.z;
  const inv = 1 / Math.hypot(dx, dz);
  out.x = (_a.x + _b.x) / 2;
  out.y = _a.y;
  out.z = (_a.z + _b.z) / 2;
  out.fx = dx * inv;
  out.fz = dz * inv;
  out.yaw = Math.atan2(dx, dz);
  out.s = s;
  return out;
}

/** Vehicle-local point (x left, y up, z forward) to world space. */
export function localToWorld(pose, lx, ly, lz, out = {}) {
  out.x = pose.x + pose.fx * lz + pose.fz * lx;
  out.y = pose.y + ly;
  out.z = pose.z + pose.fz * lz - pose.fx * lx;
  return out;
}
