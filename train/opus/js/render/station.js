// Elevated station: twin side platforms, snow-laden canopies, lamps, name boards
// and a few waiting passengers for scale.

import * as THREE from 'three';
import { track, STATION } from '../core/landmarks.js';
import { STOP_DISTANCE } from '../core/kinematics.js';
import { yawForHeading } from '../core/track.js';
import { mulberry32 } from '../core/rng.js';
import { instancedBoxes, trackBox } from './viaduct.js';
import { createGlowPoints } from './glowPoints.js';
import { makeSignTexture } from './textures.js';
import { patchMaterial } from './atmosShader.js';
import { TITLES } from '../config.js';

const PH = STATION.platformHeight;
const CANOPY_Y = PH + 5.4;

function placeOnTrack(obj, d, lat, up) {
  const p = track.offsetPoint(d, lat, up);
  obj.position.set(...p);
  obj.rotation.y = yawForHeading(track.pointAt(d).h);
  return obj;
}

function signBoards(group) {
  const tex = makeSignTexture(TITLES.station);
  const mat = patchMaterial(new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.6,
  }), { snow: 0 });
  const geo = new THREE.PlaneGeometry(5.6, 0.88);
  for (const d of [STOP_DISTANCE - 40, STOP_DISTANCE - 110]) {
    for (const lat of [-3.4, 3.4]) {
      // two back-to-back boards so the name reads from either platform;
      // in the track frame local +x points to the left of travel
      for (const flip of [0, Math.PI]) {
        const board = placeOnTrack(new THREE.Mesh(geo, mat), d, lat, CANOPY_Y - 1.1);
        board.rotation.y += (lat > 0 ? Math.PI / 2 : -Math.PI / 2) + flip;
        group.add(board);
      }
    }
  }
}

function passengers(group, mats) {
  const rng = mulberry32(44);
  const body = new THREE.CylinderGeometry(0.2, 0.27, 1.25, 8);
  body.translate(0, 0.62, 0);
  const head = new THREE.SphereGeometry(0.14, 8, 6);
  head.translate(0, 1.42, 0);
  const coat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.9 }), { snow: 0.6 });
  // kept behind the stopped locomotive so no camera ever stands inside a figure
  for (let i = 0; i < 9; i++) {
    const lat = (i % 2 ? 1 : -1) * (4.8 + rng() * 2.6);
    const d = STATION.start + 16 + rng() * (STOP_DISTANCE - 30 - STATION.start - 16);
    const g = placeOnTrack(new THREE.Group(), d, lat, PH);
    g.add(new THREE.Mesh(body, coat), new THREE.Mesh(head, coat));
    g.rotation.y += rng() * Math.PI * 2;
    group.add(g);
  }
}

export function createStation(mats) {
  const group = new THREE.Group();
  const len = STATION.end - STATION.start;
  const mid = (STATION.start + STATION.end) / 2;
  // canopies stop just past the locomotive so the platform-end cameras stand under open sky
  const canopyStart = STATION.start + 8;
  const canopyEnd = STOP_DISTANCE + 9;
  const canopyMid = (canopyStart + canopyEnd) / 2;
  const canopyLen = canopyEnd - canopyStart;
  const steel = [];
  const snow = [];
  const lampBoxes = [];
  const glows = [];
  for (const s of [-1, 1]) {
    steel.push(trackBox(canopyMid, s * 5.7, CANOPY_Y + track.deckY, [6.6, 0.35, canopyLen]));
    snow.push(trackBox(canopyMid, s * 5.7, CANOPY_Y + track.deckY + 0.35, [6.3, 0.32, canopyLen - 0.4]));
    for (let d = canopyStart + 4; d < canopyEnd - 6; d += 12) {
      steel.push(trackBox(d, s * 8.0, track.deckY + PH, [0.32, CANOPY_Y - PH, 0.32]));
      lampBoxes.push(trackBox(d + 6, s * 4.6, track.deckY + CANOPY_Y - 0.12, [0.22, 0.1, 3.2]));
      glows.push({ p: track.offsetPoint(d + 6, s * 4.6, CANOPY_Y - 0.3), color: [0.8, 0.55, 0.32], size: 1.5 });
    }
    // platform end caps and a fence along the outer edge
    for (const d of [STATION.start, STATION.end]) {
      steel.push(trackBox(d, s * 5.3, track.deckY - 2.3, [6.2, 2.3 + PH, 0.4]));
    }
    steel.push(trackBox(mid, s * 8.3, track.deckY + PH, [0.08, 1.1, len - 2]));
  }
  group.add(instancedBoxes(steel, mats.canopy));
  group.add(instancedBoxes(snow, mats.snow));
  group.add(instancedBoxes(lampBoxes, mats.lampWarm));
  const lamps = createGlowPoints(glows);
  group.add(lamps.object);
  signBoards(group);
  passengers(group, mats);

  const lights = [];
  // one warm fill over each platform, well below the canopy so it pools on the floor
  for (const [d, lat] of [[STOP_DISTANCE - 30, -5.6], [STOP_DISTANCE - 95, 5.6]]) {
    const l = new THREE.PointLight(0xffb070, 8, 45, 1.5);
    l.position.set(...track.offsetPoint(d, lat, CANOPY_Y - 2.8));
    group.add(l);
    lights.push(l);
  }
  return { object: group, glow: [lamps], lights };
}
