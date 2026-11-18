// Camera -> train sight lines sampled across the whole film. The city generator
// removes any tower that would block one, so the train reads in every shot.

import { DURATION } from '../config.js';
import { cameraAt } from './shots.js';
import { trainDistance, TRAIN_LENGTH } from './kinematics.js';
import { track } from './landmarks.js';

function inFrustum(cam, p) {
  const fx = cam.look[0] - cam.pos[0], fy = cam.look[1] - cam.pos[1], fz = cam.look[2] - cam.pos[2];
  const dx = p[0] - cam.pos[0], dy = p[1] - cam.pos[1], dz = p[2] - cam.pos[2];
  const lf = Math.hypot(fx, fy, fz), ld = Math.hypot(dx, dy, dz);
  const cos = (fx * dx + fy * dy + fz * dz) / (lf * ld);
  const halfDiag = Math.atan(Math.tan((cam.fov * Math.PI) / 360) * 1.15);
  return cos > Math.cos(halfDiag * 1.15);
}

export function computeSightlines(step = 0.2) {
  const lines = [];
  for (let t = 0; t <= DURATION; t += step) {
    const cam = cameraAt(t);
    const nose = trainDistance(t);
    for (let k = 0; k <= 5; k++) {
      const p = track.offsetPoint(nose - (TRAIN_LENGTH * k) / 5, 0, 2.5);
      if (inFrustum(cam, p)) lines.push([cam.pos, p]);
    }
    lines.push([cam.pos, cam.pos]);   // the camera itself must be in open air
  }
  return lines;
}

// Segment vs axis-aligned box (slab test); box = {min:[..], max:[..]}
export function segmentHitsBox(a, b, box) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) {
      if (a[i] < box.min[i] || a[i] > box.max[i]) return false;
    } else {
      let ta = (box.min[i] - a[i]) / d;
      let tb = (box.max[i] - a[i]) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return true;
}
