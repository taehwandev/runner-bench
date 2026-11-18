// Procedural, seeded city layout: tower boxes, street lamps and roof beacons.
// Pure data; render/city.js turns it into instanced geometry.

import { mulberry32, range } from './rng.js';
import { yawForHeading } from './track.js';
import { track as worldTrack, STATION, TUNNEL, SHORE, CITY } from './landmarks.js';
import { segmentHitsBox } from './sightlines.js';

const TINTS = [0x5b606c, 0x343c4a, 0x574a46, 0x777b86, 0x3a4658, 0x4a4f58, 0x625a54];
const DOWNTOWN = { x: -90, z: -590 };

function shoreSide(x, z, margin) {
  const p = worldTrack.pointAt(SHORE);
  return (x - p.x) * Math.cos(p.h) + (z - p.z) * Math.sin(p.h) < -margin;
}

function style(rng, lit = 1) {
  return [rng() * 100, (0.12 + rng() * 0.4) * lit, 3.3 + rng() * 0.9, 2.4 + rng() * 1.8];
}

function box(x, z, y0, w, d, h, st, tint, rot = 0) {
  return { x, z, y0, w, d, h, rot, style: st, tint };
}

function towerBoxes(rng, x, z, w, d, h) {
  const st = style(rng);
  const tint = TINTS[Math.floor(rng() * TINTS.length)];
  const out = [];
  let top = h;
  let cx = x, cz = z, cw = w, cd = d;
  if (h > 75 && rng() < 0.6) {
    const h1 = h * range(rng, 0.42, 0.68);
    out.push(box(x, z, 0, w, d, h1, st, tint));
    cw = w * range(rng, 0.58, 0.8);
    cd = d * range(rng, 0.58, 0.8);
    cx = x + (rng() - 0.5) * (w - cw) * 0.8;
    cz = z + (rng() - 0.5) * (d - cd) * 0.8;
    out.push(box(cx, cz, h1, cw, cd, h - h1, st, tint));
    if (rng() < 0.45) {
      const ch = range(rng, 6, 16);
      out.push(box(cx, cz, h, cw * 0.55, cd * 0.55, ch, st, tint));
      top = h + ch;
    }
  } else {
    out.push(box(x, z, 0, w, d, h, st, tint));
  }
  const dark = [st[0], 0, 4, 40];
  if (top > 150 && rng() < 0.65) {
    const ah = range(rng, 16, 34);
    out.push(box(cx, cz, top, 1.1, 1.1, ah, dark, 0x2a2d33));
    top += ah;
  } else if (rng() < 0.7) {
    out.push(box(cx + (rng() - 0.5) * cw * 0.4, cz + (rng() - 0.5) * cd * 0.4, top, cw * 0.3, cd * 0.3, range(rng, 2, 4.5), dark, 0x3d4048));
  }
  return { boxes: out, top, bounds: { min: [x - w / 2 - 1.5, -1, z - d / 2 - 1.5], max: [x + w / 2 + 1.5, top + 2, z + d / 2 + 1.5] } };
}

// A line [a, b] with a === b is a camera position that needs 3 m of clearance.
function blockedBySightline(bounds, lines) {
  for (const [a, b] of lines) {
    if (Math.max(a[0], b[0]) < bounds.min[0] - 3 || Math.min(a[0], b[0]) > bounds.max[0] + 3) continue;
    if (Math.max(a[2], b[2]) < bounds.min[2] - 3 || Math.min(a[2], b[2]) > bounds.max[2] + 3) continue;
    if (a === b) {
      const inside = [0, 1, 2].every((i) => a[i] > bounds.min[i] - 3 && a[i] < bounds.max[i] + 3);
      if (inside) return true;
    } else if (segmentHitsBox(a, b, bounds)) return true;
  }
  return false;
}

function allowedSite(x, z, r) {
  if (!shoreSide(x, z, r + 12)) return false;
  const pr = worldTrack.project(x, z);
  if (pr.dist < r + 8) return false;
  if (pr.d > STATION.start - 20 && pr.d < STATION.end + 20 && pr.dist < r + 22) return false;
  if (pr.d > TUNNEL.start - 60 && pr.d < TUNNEL.end + 60 && pr.dist < r + 50) return false;
  return true;
}

function tunnelTowerBoxes() {
  const len = TUNNEL.end - TUNNEL.start;
  const mid = worldTrack.pointAt((TUNNEL.start + TUNNEL.end) / 2);
  const yaw = yawForHeading(mid.h);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const W = TUNNEL.tower.width;
  const hw = TUNNEL.halfWidth + 0.25;
  const floorY = worldTrack.deckY - 2.4;
  const roofY = worldTrack.deckY + TUNNEL.height + 0.3;
  const st = [42.0, 0.22, 3.5, 2.2];
  const tint = 0x323846;
  const place = (lx, lz, y0, w, d, h, stOverride) => box(mid.x + lx * c + lz * s, mid.z - lx * s + lz * c, y0, w, d, h, stOverride || st, tint, yaw);
  const sideW = W / 2 - hw;
  return [
    place(0, 0, 0, W, len, floorY),
    place(hw + sideW / 2, 0, floorY, sideW, len, roofY - floorY),
    place(-hw - sideW / 2, 0, floorY, sideW, len, roofY - floorY),
    place(0, 0, roofY, W, len, 128 - roofY),
    place(0, 0, 128, W * 0.7, len * 0.82, 66),
    place(0, 0, 194, W * 0.42, len * 0.5, 20),
    place(0, 0, 214, 1.4, 1.4, 38, [1, 0, 4, 40]),
  ];
}

export function generateCity(seed, sightlines) {
  const rng = mulberry32(seed);
  const boxes = [];
  const lamps = [];
  const beacons = [];
  const B = CITY.block;
  const lot = B - CITY.street;

  const addTower = (x, z, w, d, h) => {
    const r = 0.5 * Math.hypot(w, d);
    if (!allowedSite(x, z, r)) return;
    const t = towerBoxes(rng, x, z, w, d, h);
    if (blockedBySightline(t.bounds, sightlines)) return;
    boxes.push(...t.boxes);
    if (t.top > 140) beacons.push({ p: [x, t.top + 1, z], phase: rng() * 6.28, color: [1.0, 0.12, 0.08] });
  };

  for (let gx = -17; gx <= 15; gx++) {
    for (let gz = -19; gz <= 13; gz++) {
      const x0 = gx * B, z0 = gz * B;
      const dc = Math.hypot(x0 - DOWNTOWN.x, z0 - DOWNTOWN.z);
      const down = Math.exp(-dc / 520);
      const height = () => {
        let h = 20 + Math.pow(rng(), 1.5) * (60 + 200 * down);
        if (rng() < 0.04 + 0.12 * down) h = range(rng, 190, 360);
        return h;
      };
      const kind = rng();
      if (kind < 0.07) continue; // plaza
      if (kind < 0.42) {
        addTower(x0, z0, range(rng, 26, lot), range(rng, 26, lot), height() * 1.1);
      } else if (kind < 0.7) {
        const alongX = rng() < 0.5;
        for (const sgn of [-1, 1]) {
          const w = alongX ? lot / 2 - 2 : range(rng, 24, lot);
          const d = alongX ? range(rng, 24, lot) : lot / 2 - 2;
          addTower(x0 + (alongX ? sgn * lot / 4 : 0), z0 + (alongX ? 0 : sgn * lot / 4), w, d, height());
        }
      } else {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          addTower(x0 + sx * lot / 4, z0 + sz * lot / 4, range(rng, 13, lot / 2 - 2), range(rng, 13, lot / 2 - 2), height() * 0.8);
        }
      }
    }
  }

  // Distant skyline ring: tall, sparse silhouettes that sell the scale.
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 1150, 2600);
    const x = DOWNTOWN.x + 300 + Math.cos(a) * r, z = DOWNTOWN.z + 450 + Math.sin(a) * r;
    if (!shoreSide(x, z, 60)) continue;
    const w = range(rng, 30, 80), d = range(rng, 30, 80);
    const h = range(rng, 90, 260) + (rng() < 0.25 ? range(rng, 120, 280) : 0);
    boxes.push(box(x, z, 0, w, d, h, style(rng, 0.7), TINTS[i % TINTS.length]));
    if (h > 220 && rng() < 0.5) beacons.push({ p: [x, h + 1, z], phase: rng() * 6.28, color: [1.0, 0.15, 0.1] });
  }

  boxes.push(...tunnelTowerBoxes());

  // Street lamps on alternating sides of every street.
  for (let g = -19; g <= 15; g++) {
    for (let v = -19 * B; v <= 15 * B; v += 34) {
      const side = (Math.round(v / 34) & 1) ? 6 : -6;
      const x = g * B + B / 2 + side;
      if (shoreSide(x, v, 8)) lamps.push([x, 6.5, v]);
      const z = g * B + B / 2 - side;
      if (shoreSide(v, z, 8)) lamps.push([v, 6.5, z]);
    }
  }
  return { boxes, lamps, beacons };
}
