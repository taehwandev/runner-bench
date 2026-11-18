// The tunnel bored through the tower block: lit interior lining and the two
// portals with hazard frames and amber lamps. The tower itself is part of the
// instanced city (core/cityLayout.js), with a real opening around the track.

import * as THREE from 'three';
import { sweepGeometry } from './ribbon.js';
import { track, TUNNEL } from '../core/landmarks.js';
import { instancedBoxes, trackBox } from './viaduct.js';
import { createGlowPoints } from './glowPoints.js';

const W = TUNNEL.halfWidth;
const H = TUNNEL.height;

// Inward-facing lining: walls and ceiling (normals point into the bore).
const LINING = [
  { a: [W, -0.5], b: [W, H], mat: 0, uScale: H + 0.5 },
  { a: [W, H], b: [-W, H], mat: 0, uScale: 2 * W },
  { a: [-W, H], b: [-W, -0.5], mat: 0, uScale: H + 0.5 },
];

export function createTunnel(mats) {
  const group = new THREE.Group();
  const lining = sweepGeometry(track, TUNNEL.start - 0.3, TUNNEL.end + 0.3, 2, LINING, 16);
  group.add(new THREE.Mesh(lining, mats.tunnel));
  // align the baked lamp pools (v = 0.25, 0.75 of a 16 m tile) with the lamp boxes
  const glowTex = mats.tunnel.emissiveMap;
  glowTex.offset.y = 0.25 - (((TUNNEL.start + 4) / 16) % 1);

  const frame = [];
  const chevrons = [];
  const lamps = [];
  const glows = [];
  for (const [d, dir] of [[TUNNEL.start, -1], [TUNNEL.end, 1]]) {
    const face = d + dir * 0.6;
    frame.push(trackBox(face, W + 0.7, track.deckY - 2.4, [1.4, H + 3.4, 1.2]));
    frame.push(trackBox(face, -W - 0.7, track.deckY - 2.4, [1.4, H + 3.4, 1.2]));
    chevrons.push(trackBox(face, 0, track.deckY + H, [2 * W + 2.8, 1.0, 1.25]));
    for (let k = 0; k < 7; k++) {
      const lat = -W + (2 * W * k) / 6;
      lamps.push(trackBox(face + dir * 0.4, lat, track.deckY + H + 1.15, [0.5, 0.3, 0.2]));
      glows.push({ p: track.offsetPoint(face + dir * 0.7, lat, H + 1.3), color: [1.0, 0.6, 0.18], size: 2.0 });
    }
    for (const s of [-1, 1]) {
      for (let y = 1.5; y < H; y += 2.2) {
        glows.push({ p: track.offsetPoint(face + dir * 0.8, s * (W + 0.7), y), color: [1.0, 0.55, 0.15], size: 1.3 });
      }
    }
  }
  // wall lamps along the bore, every 8 m on both sides
  for (let d = TUNNEL.start + 4; d < TUNNEL.end; d += 8) {
    for (const s of [-1, 1]) {
      lamps.push(trackBox(d, s * (W - 0.12), track.deckY + (H - 0.5) / 2 - 0.1, [0.16, 0.22, 1.6]));
    }
  }
  group.add(instancedBoxes(frame, mats.steel));
  group.add(instancedBoxes(chevrons, mats.chevron));
  group.add(instancedBoxes(lamps, mats.lampWarm));
  const glow = createGlowPoints(glows);
  group.add(glow.object);
  return { object: group, glow: [glow] };
}
