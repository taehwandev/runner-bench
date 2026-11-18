// Elevated track: deck, parapets, rails, city pillars and bridge piers.

import * as THREE from 'three';
import { sweepGeometry } from './ribbon.js';
import { track, STATION, TUNNEL, SHORE, BRIDGE } from '../core/landmarks.js';
import { TRACK_LAYOUT } from '../config.js';
import { yawForHeading } from '../core/track.js';

const RAIL_TOP = 0.17;
export { RAIL_TOP };

// [concrete, trackbed, snow, platform]
const DECK = [
  { a: [-3.9, 0], b: [3.9, 0], mat: 1 },
  { a: [3.9, 0], b: [3.9, 0.9], mat: 0 },
  { a: [3.9, 0.9], b: [4.3, 0.9], mat: 2 },
  { a: [4.3, 0.9], b: [4.3, -2.3], mat: 0, uScale: 6 },
  { a: [4.3, -2.3], b: [-4.3, -2.3], mat: 0, uScale: 6 },
  { a: [-4.3, -2.3], b: [-4.3, 0.9], mat: 0, uScale: 6 },
  { a: [-4.3, 0.9], b: [-3.9, 0.9], mat: 2 },
  { a: [-3.9, 0.9], b: [-3.9, 0], mat: 0 },
  { a: [2.6, -2.3], b: [2.6, -3.8], mat: 0, uScale: 6 },
  { a: [2.6, -3.8], b: [-2.6, -3.8], mat: 0, uScale: 6 },
  { a: [-2.6, -3.8], b: [-2.6, -2.3], mat: 0, uScale: 6 },
];

const STATION_DECK = [
  { a: [-2.15, 0], b: [2.15, 0], mat: 1 },
  { a: [2.15, 0], b: [2.15, STATION.platformHeight], mat: 0 },
  { a: [-2.15, STATION.platformHeight], b: [-2.15, 0], mat: 0 },
  { a: [8.4, STATION.platformHeight], b: [8.4, -2.3], mat: 0, uScale: 6 },
  { a: [8.4, -2.3], b: [-8.4, -2.3], mat: 0, uScale: 6 },
  { a: [-8.4, -2.3], b: [-8.4, STATION.platformHeight], mat: 0, uScale: 6 },
  { a: [2.15, STATION.platformHeight], b: [8.4, STATION.platformHeight], mat: 3, uScale: 6 },
  { a: [-8.4, STATION.platformHeight], b: [-2.15, STATION.platformHeight], mat: 3, uScale: 6 },
];

function railEdges(lat) {
  return [
    { a: [lat - 0.05, RAIL_TOP], b: [lat + 0.05, RAIL_TOP], mat: 0 },
    { a: [lat + 0.05, RAIL_TOP], b: [lat + 0.05, 0], mat: 0 },
    { a: [lat - 0.05, 0], b: [lat - 0.05, RAIL_TOP], mat: 0 },
  ];
}

function instancedBoxes(list, material) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  list.forEach((b, i) => {
    q.setFromAxisAngle(up, b.yaw);
    m.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(...b.s));
    mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingSphere();
  return mesh;
}

// Box placed on the track frame: lateral/along offsets, y0 bottom, size [lat, h, along].
export function trackBox(d, lateral, y0, size) {
  const p = track.offsetPoint(d, lateral, 0);
  const h = track.pointAt(d).h;
  return { p: [p[0], y0, p[2]], s: size, yaw: yawForHeading(h) };
}

export function createViaduct(mats) {
  const group = new THREE.Group();
  const deckMats = [mats.concrete, mats.trackbed, mats.snow, mats.platform];
  const spans = [
    [TRACK_LAYOUT.drawFrom, STATION.start, DECK],
    [STATION.start, STATION.end, STATION_DECK],
    [STATION.end, TRACK_LAYOUT.drawTo, DECK],
  ];
  for (const [a, b, profile] of spans) {
    group.add(new THREE.Mesh(sweepGeometry(track, a, b, 3, profile, 6), deckMats));
  }
  const rails = sweepGeometry(track, TRACK_LAYOUT.drawFrom, TRACK_LAYOUT.drawTo, 3, [...railEdges(-0.75), ...railEdges(0.75)]);
  group.add(new THREE.Mesh(rails, mats.rail));

  const deckY = track.deckY;
  const pillars = [];
  for (let d = TRACK_LAYOUT.drawFrom + 10; d < SHORE; d += 32) {
    if (d > TUNNEL.start - 8 && d < TUNNEL.end + 8) continue;
    const inStation = d > STATION.start && d < STATION.end;
    for (const lat of inStation ? [-5.6, 5.6] : [0]) {
      pillars.push(trackBox(d, lat, 0, [2.6, deckY - 3.8, 3.0]));
      pillars.push(trackBox(d, lat, deckY - 5.2, [inStation ? 4 : 6.4, 1.4, 3.6]));
    }
  }
  for (let d = SHORE + 45; d < BRIDGE.end; d += 72) {
    if (BRIDGE.pylons.some((p) => Math.abs(p - d) < 30)) continue;
    pillars.push(trackBox(d, 0, BRIDGE.waterY, [4.2, deckY - 3.8 - BRIDGE.waterY, 5]));
    pillars.push(trackBox(d, 0, BRIDGE.waterY, [6.5, 2.2, 7.5]));
  }
  group.add(instancedBoxes(pillars, mats.concrete));
  return { object: group };
}

export { instancedBoxes };
