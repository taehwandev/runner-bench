// Elevated station: platform, snow-laden canopy, lamps, sign boards, a few
// waiting figures and the starting signal that turns green before departure.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { LAYOUT } from '../core/layout.js';
import { SEED, STATION, TIMES, TRACK } from '../config.js';
import { MeshBuilder, xform } from './geo.js';
import { platformTexture, signTexture, flareTexture } from './textures.js';

const CONCRETE = [0.2, 0.215, 0.25];
const DARK = [0.07, 0.078, 0.095];
const SNOW = [0.8, 0.85, 0.95];
const YELLOW = [0.75, 0.56, 0.1];
const LAMP = [2.2, 1.45, 0.75];
const PANELS = [[0.5, 2.0, 2.2], [2.4, 0.5, 1.4], [2.6, 1.5, 0.45], [1.6, 1.8, 2.4]];
const COATS = [[0.05, 0.05, 0.07], [0.09, 0.05, 0.05], [0.04, 0.07, 0.09], [0.1, 0.09, 0.08]];

const st = LAYOUT.station;
const X_EDGE = st.side * STATION.edge;
const X_BACK = st.side * (STATION.edge + STATION.width);
const X_MID = (X_EDGE + X_BACK) / 2;
const Z_FROM = -st.fromS;
const Z_TO = -st.toS;
const LENGTH = st.toS - st.fromS;
const Z_MID = (Z_FROM + Z_TO) / 2;
const CANOPY_Y = st.floorY + 5.1;

function buildStructure(b) {
  const bodyH = st.floorY - (TRACK.railY - 1.7);
  b.box(X_MID, st.floorY - bodyH / 2 - 0.02, Z_MID, STATION.width, bodyH, LENGTH, CONCRETE);
  b.box(X_EDGE + st.side * 0.45, st.floorY + 0.012, Z_MID, 0.28, 0.02, LENGTH, YELLOW);
  for (let z = Z_FROM - 12; z > Z_TO; z -= 26) {
    b.box(X_MID, (TRACK.railY - 1.7) / 2, z, 3, TRACK.railY - 1.7, 3, DARK);
  }
  // canopy with a thick load of snow, and its columns
  const cFrom = Z_FROM - 16;
  const cTo = Z_TO + 10;
  const cLen = cFrom - cTo;
  const cMid = (cFrom + cTo) / 2;
  // the roof stops short of the platform edge, which stays open to the snow
  const cW = STATION.width - STATION.canopySetback + 0.5;
  const cX = X_BACK - st.side * (cW / 2 - 0.5);
  b.box(cX, CANOPY_Y, cMid, cW, 0.34, cLen, DARK);
  b.box(cX, CANOPY_Y + 0.42, cMid, cW - 0.5, 0.5, cLen - 0.6, SNOW);
  for (let z = cFrom - 4; z > cTo; z -= 18) {
    b.box(X_BACK - st.side * 3.4, st.floorY + 2.5, z, 0.36, 5, 0.36, DARK);
    b.box(X_BACK - st.side * 3.4, CANOPY_Y - 0.4, z, cW, 0.3, 0.3, DARK);
  }
  // rear wall, benches and drifted snow
  b.box(X_BACK, st.floorY + 1.7, Z_MID, 0.4, 3.4, LENGTH, CONCRETE, SNOW);
  for (let z = Z_FROM - 28; z > Z_TO + 12; z -= 27) {
    b.box(X_BACK - st.side * 1.4, st.floorY + 0.45, z, 0.6, 0.1, 2.6, DARK);
    b.box(X_BACK - st.side * 1.4, st.floorY + 0.22, z - 1, 0.5, 0.44, 0.12, DARK);
    b.box(X_BACK - st.side * 1.4, st.floorY + 0.22, z + 1, 0.5, 0.44, 0.12, DARK);
  }
  b.box(X_BACK - st.side * 0.9, st.floorY + 0.18, Z_MID, 1.4, 0.36, LENGTH, SNOW);
}

/** Lamps, lit advert panels and their glows. */
function buildLights(glow, glows, pools) {
  const cFrom = Z_FROM - 16;
  const cTo = Z_TO + 10;
  for (let z = cFrom - 5; z > cTo; z -= 9) {
    const x = X_EDGE + st.side * (STATION.canopySetback + 0.45);
    glow.box(x, CANOPY_Y - 0.24, z, 0.26, 0.1, 2.6, LAMP);
    glows.add(x, CANOPY_Y - 0.5, z, [0.7, 0.48, 0.26], 1.1);
    pools.push(x, z);
  }
  let k = 0;
  for (let z = Z_FROM - 20; z > Z_TO + 8; z -= 23) {
    const c = PANELS[k++ % PANELS.length];
    const x = X_BACK - st.side * 0.22;
    glow.box(x, st.floorY + 1.9, z, 0.04, 1.9, 5.2, c);
    glows.add(x - st.side * 0.3, st.floorY + 1.9, z, c.map((v) => v * 0.2), 3.0);
  }
}

function buildPeople(b, rng) {
  const spots = [-8, -19, -24, -47, -52, -76, -103, -131, -160];
  for (const dz of spots) {
    const x = X_EDGE + st.side * rng.range(2.4, 7.4);
    const z = -(st.stopS + dz) + rng.range(-1, 1);
    const h = rng.range(0.92, 1.06);
    const coat = rng.pick(COATS);
    b.append(new THREE.CylinderGeometry(0.2 * h, 0.3 * h, 1.3 * h, 8), xform(x, st.floorY + 0.65 * h, z), coat);
    b.append(new THREE.SphereGeometry(0.15 * h, 8, 6), xform(x, st.floorY + 1.48 * h, z), coat);
    b.append(new THREE.BoxGeometry(0.5 * h, 0.5 * h, 0.3 * h), xform(x, st.floorY + 1.02 * h, z), coat);
  }
}

function buildPlatformTop() {
  const map = platformTexture();
  map.repeat.set(STATION.width / 6, LENGTH / 6);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(STATION.width, LENGTH),
    new THREE.MeshStandardMaterial({ map, color: 0x6b7078, roughness: 1, metalness: 0 }), // fully rough: no grazing glare from the headlight
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(X_MID, st.floorY, Z_MID);
  return mesh;
}

function buildLightPools(pools) {
  const mat = new THREE.MeshBasicMaterial({
    map: flareTexture(), color: new THREE.Color(0.16, 0.105, 0.05), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), mat, pools.length / 2);
  const m = new THREE.Matrix4();
  for (let i = 0; i < pools.length / 2; i++) {
    mesh.setMatrixAt(i, m.makeTranslation(pools[i * 2], st.floorY + 0.04, pools[i * 2 + 1]));
  }
  return mesh;
}

function buildSigns() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    map: signTexture('KALDHEIM', 'ELEVATED LINE 7  ·  PLATFORM 2'), color: new THREE.Color(1.7, 1.7, 1.7),
  });
  const geo = new THREE.PlaneGeometry(5.6, 1.4);
  for (const dz of [-34, -92, -150]) {
    // two faces back to back so the name reads correctly from both ends
    for (const facing of [0, Math.PI]) {
      const sign = new THREE.Mesh(geo, mat);
      sign.rotation.y = facing;
      sign.position.set(X_EDGE + st.side * 7.6, CANOPY_Y - 1.25, -(st.stopS + dz) + Math.cos(facing) * 0.03);
      group.add(sign);
    }
  }
  return group;
}

/** Starting signal on the far side of the track: red, then green to depart. */
function buildSignal(b) {
  const x = -st.side * 3.0;
  const z = -(st.stopS + 11);
  b.box(x, TRACK.railY + 2.6, z, 0.24, 7.6, 0.24, DARK);
  b.box(x, TRACK.railY + 5.6, z, 0.7, 1.7, 0.5, DARK, SNOW);
  b.box(x, TRACK.railY - 1.1, z, 2.6, 0.5, 0.7, CONCRETE);
  const tex = flareTexture();
  const make = (color, y) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    s.position.set(x, TRACK.railY + y, z + 0.32);
    s.scale.setScalar(2.6);
    return s;
  };
  return { red: make(new THREE.Color(6, 0.35, 0.2), 6.0), green: make(new THREE.Color(0.3, 6, 1.6), 5.2) };
}

export function createStation(glows) {
  const rng = makeRng(SEED + 211);
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  const pools = [];
  buildStructure(solid);
  buildLights(glow, glows, pools);
  buildPeople(solid, rng);
  const signal = buildSignal(solid);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(solid.build(), new THREE.MeshLambertMaterial({ vertexColors: true })),
    new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })),
    buildPlatformTop(),
    buildLightPools(pools),
    buildSigns(),
    signal.red,
    signal.green,
  );
  return {
    group,
    update(t) {
      const go = t >= TIMES.depart - 0.5;
      signal.red.visible = !go;
      signal.green.visible = go;
    },
  };
}
