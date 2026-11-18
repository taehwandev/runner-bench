// Cable-stayed bridge over the frozen bay: pylons, stay cables, lamp posts.

import * as THREE from 'three';
import { track, BRIDGE, SHORE } from '../core/landmarks.js';
import { instancedBoxes, trackBox } from './viaduct.js';
import { createGlowPoints } from './glowPoints.js';

const PYLON_TOP = 132;

function cableMesh(cables, material) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const mesh = new THREE.InstancedMesh(geo, material, cables.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  cables.forEach(([a, b], i) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    q.setFromUnitVectors(yAxis, dir.normalize());
    m.compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(0.11, len, 0.11));
    mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingSphere();
  return mesh;
}

export function createBridge(mats) {
  const group = new THREE.Group();
  const deckY = track.deckY;
  const parts = [];
  const cables = [];
  const glows = [];
  for (const pd of BRIDGE.pylons) {
    for (const lat of [-7.6, 7.6]) {
      parts.push(trackBox(pd, lat, BRIDGE.waterY, [3.2, PYLON_TOP - BRIDGE.waterY, 4.2]));
      parts.push(trackBox(pd, lat, PYLON_TOP, [2.0, 6, 2.6]));
      glows.push({ p: track.offsetPoint(pd, lat, PYLON_TOP + 7 - deckY), color: [1, 0.1, 0.05], size: 6, blink: lat > 0 ? 1.0 : 2.3 });
      for (let k = 0; k < 9; k++) {
        const anchorY = PYLON_TOP - 4 - k * 3.2 - deckY;
        for (const s of [-1, 1]) {
          const dd = pd + s * (24 + k * 15);
          cables.push([track.offsetPoint(pd, lat * 0.92, anchorY), track.offsetPoint(dd, Math.sign(lat) * 4.2, 0.9)]);
        }
      }
    }
    parts.push(trackBox(pd, 0, deckY - 6.5, [18.4, 2.6, 3.4]));
    parts.push(trackBox(pd, 0, PYLON_TOP - 22, [16, 3, 3]));
    parts.push(trackBox(pd, 0, PYLON_TOP - 50, [16, 2.4, 2.6]));
  }
  // lamp posts every 25 m along both parapets, from the quay into the night
  for (let d = SHORE + 10; d < BRIDGE.end; d += 25) {
    for (const lat of [-4.1, 4.1]) {
      parts.push(trackBox(d, lat, deckY + 0.9, [0.16, 3.6, 0.16]));
      glows.push({ p: track.offsetPoint(d, lat * 0.93, 4.5), color: [1.0, 0.62, 0.3], size: 1.6 });
    }
  }
  group.add(instancedBoxes(parts, mats.steel));
  group.add(cableMesh(cables, mats.rail));
  const lamps = createGlowPoints(glows);
  group.add(lamps.object);
  return { object: group, glow: [lamps] };
}
