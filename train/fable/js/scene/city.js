// The frozen city: canyon rows beside the track, a deep grid of towers, low
// snow-buried blocks, skybridges and the huge tower block over the tunnel.
// Everything is planned from a seeded RNG, then drawn as one instanced mesh.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { sampleTrack, distanceToTrack } from '../core/track.js';
import { LAYOUT } from '../core/layout.js';
import { SEED, TRACK } from '../config.js';
import { sightSamples } from '../camera/shots.js';
import { createTowerMaterial, createGroundMaterial } from './cityShaders.js';

const BEACON = [3.2, 0.25, 0.2];

function inBlock(x, z, pad) {
  const b = LAYOUT.block;
  return Math.abs(x) < b.halfWidth + pad && z < b.zNear + pad && z > b.zFar - pad;
}

function inRiver(z, pad) {
  return z < LAYOUT.river.zNear + pad && z > LAYOUT.river.zFar - pad;
}

const SIGHT_CELL = 64;

/** Bucket the cameras' sight-line samples so each building checks only its neighbours. */
function buildSightGrid() {
  const grid = new Map();
  for (const p of sightSamples()) {
    const key = `${Math.floor(p.x / SIGHT_CELL)},${Math.floor(p.z / SIGHT_CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  return grid;
}

/** Would a box at (x, z) of this footprint and height hide the train from a camera? */
function blocksSight(grid, x, z, w, d, y0, h) {
  const r = Math.hypot(w, d) / 2 + 7;
  for (let cx = Math.floor((x - r) / SIGHT_CELL); cx <= Math.floor((x + r) / SIGHT_CELL); cx++) {
    for (let cz = Math.floor((z - r) / SIGHT_CELL); cz <= Math.floor((z + r) / SIGHT_CELL); cz++) {
      const cell = grid.get(`${cx},${cz}`);
      if (!cell) continue;
      for (const p of cell) {
        if (p.y > y0 - 5 && p.y < y0 + h + 5 && Math.hypot(p.x - x, p.z - z) < r) return true;
      }
    }
  }
  return false;
}

/** One tower = a base box plus optional setbacks and a spire. */
function pushTower(plan, rng, t) {
  if (blocksSight(plan.sight, t.x, t.z, t.w, t.d, 0, t.h)) return;
  const seed = rng.range(1, 900);
  const lit = t.lit ?? (rng.chance(0.18) ? rng.range(0.3, 0.55) : rng.range(0.04, 0.24));
  const add = (w, d, y0, h) => plan.boxes.push({ x: t.x, z: t.z, w, d, y0, h, yaw: t.yaw || 0, seed, lit });
  add(t.w, t.d, 0, t.h);
  let top = t.h;
  let w = t.w;
  let d = t.d;
  const tiers = t.h > 120 ? rng.int(0, 2) : 0;
  for (let i = 0; i < tiers; i++) {
    w *= rng.range(0.55, 0.8);
    d *= rng.range(0.55, 0.8);
    const h = t.h * rng.range(0.12, 0.3);
    add(w, d, top, h);
    top += h;
  }
  if (t.h > 160 && rng.chance(0.45)) {
    const h = rng.range(20, 70);
    add(2.2, 2.2, top, h);
    top += h;
  }
  if (t.h > 150 && rng.chance(0.7)) plan.beacons.push({ x: t.x, y: top + 2, z: t.z, phase: rng.range(0, 1) });
}

/** Tall rows hugging both sides of the viaduct: the canyon the train runs in. */
function planCanyon(plan, rng) {
  const p = {};
  for (let s = TRACK.from; s < LAYOUT.viaduct.toS - 40; s += rng.range(52, 84)) {
    for (const side of [-1, 1]) {
      if (rng.chance(0.14)) continue;
      sampleTrack(s, p);
      const w = rng.range(32, 62);
      const d = rng.range(36, 70);
      const stationSide = side === LAYOUT.station.side && s > LAYOUT.station.fromS - 60 && s < LAYOUT.station.toS + 30;
      const clear = (stationSide ? 30 : 17) + rng.range(0, 26);
      const lat = side * (clear + w / 2);
      const x = p.x + p.rx * lat;
      const z = p.z + p.rz * lat;
      if (inBlock(x, z, 40)) continue;
      pushTower(plan, rng, { x, z, w, d, h: rng.range(150, 380), yaw: Math.atan2(p.tx, p.tz) });
    }
  }
}

/** Jittered grid out to the horizon; taller the further from the line. */
function planGrid(plan, rng) {
  const cell = 96;
  for (let gx = -22; gx <= 22; gx++) {
    for (let gz = -48; gz <= 12; gz++) {
      const x = gx * cell + rng.range(-22, 22);
      const z = gz * cell + rng.range(-22, 22);
      const keep = rng();
      const w = rng.range(34, 74);
      const d = rng.range(34, 74);
      const far = distanceToTrack(x, z);
      if (far < 95 + Math.max(w, d) / 2) continue;
      if (inBlock(x, z, 70) || inRiver(z, 60)) continue;
      const density = far < 500 ? 0.84 : far < 1300 ? 0.66 : 0.42;
      if (keep > density) continue;
      const giant = far > 420 && rng.chance(0.09);
      const h = giant ? rng.range(520, 900) : rng.range(110, 300) + Math.min(far, 1100) * rng.range(0.1, 0.34);
      const scale = giant ? rng.range(1.5, 2.4) : 1;
      pushTower(plan, rng, { x, z, w: w * scale, d: d * scale, h, yaw: rng.chance(0.2) ? rng.range(-0.5, 0.5) : 0 });
    }
  }
}

/** Low blocks near the line, roofs heaped with snow. */
function planLowRise(plan, rng) {
  const p = {};
  for (let s = TRACK.from; s < LAYOUT.viaduct.toS - 20; s += 34) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) {
        if (rng.chance(0.3)) continue;
        sampleTrack(s + rng.range(-10, 10), p);
        const w = rng.range(16, 30);
        const lat = side * (10 + w / 2 + row * 34 + rng.range(0, 12));
        const x = p.x + p.rx * lat;
        const z = p.z + p.rz * lat;
        const d = rng.range(16, 30);
        const h = rng.range(9, 30);
        if (inBlock(x, z, 20) || blocksSight(plan.sight, x, z, w, d, 0, h)) continue;
        plan.boxes.push({
          x, z, w, d, y0: 0, h,
          yaw: Math.atan2(p.tx, p.tz), seed: rng.range(1, 900), lit: rng.range(0.03, 0.2),
        });
      }
    }
  }
}

/** Enclosed bridges high above the track, anchored in a tower at each end. */
function planSkybridges(plan, rng) {
  const p = {};
  for (const s of [-420, -60, 205, 610]) {
    sampleTrack(s, p);
    const y0 = TRACK.railY + rng.range(64, 118);
    const span = rng.range(64, 84);
    const yaw = Math.atan2(p.tx, p.tz);
    if (blocksSight(plan.sight, p.x, p.z, span * 2, 9, y0, 7.5)) continue;
    plan.boxes.push({ x: p.x, z: p.z, w: span * 2, d: 9, y0, h: 7.5, yaw, seed: rng.range(1, 900), lit: 0.7 });
    for (const side of [-1, 1]) {
      const w = rng.range(44, 60);
      const lat = side * (span + w / 2 - 4);
      pushTower(plan, rng, { x: p.x + p.rx * lat, z: p.z + p.rz * lat, w, d: rng.range(44, 64), h: y0 + rng.range(60, 200), yaw });
    }
  }
}

/** The tower block: two wings and a crown around the tunnel's concrete core. */
function planBlock(plan, rng) {
  const b = LAYOUT.block;
  const zc = (b.zNear + b.zFar) / 2;
  const depth = b.zNear - b.zFar;
  const core = b.coreHalfWidth;
  const wing = b.halfWidth - core;
  const seed = 417;
  const lit = 0.13;
  const coreTop = b.coreTopY;
  const box = (x, w, y0, h, z = zc, d = depth, s = seed) =>
    plan.boxes.push({ x, z, w, d, y0, h, yaw: 0, seed: s, lit });
  box(-(core + wing / 2), wing, 0, b.height);
  box(core + wing / 2, wing, 0, b.height);
  box(0, core * 2, coreTop, b.height - coreTop);
  box(0, core * 2, 0, TRACK.railY - 1.4);
  // crown towers stepping up along the block
  const crowns = [
    { z: b.zNear - 60, w: 120, d: 90, h: 150 },
    { z: zc, w: 96, d: 80, h: 250 },
    { z: b.zFar + 55, w: 130, d: 84, h: 110 },
  ];
  for (const c of crowns) {
    box(rng.range(-20, 20), c.w, b.height, c.h, c.z, c.d, seed + c.h);
    plan.beacons.push({ x: 0, y: b.height + c.h + 3, z: c.z, phase: rng.range(0, 1) });
  }
}

function buildTowerMesh(plan) {
  const boxes = plan.boxes;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, createTowerMaterial(), boxes.length);
  const size = new Float32Array(boxes.length * 3);
  const info = new Float32Array(boxes.length * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  boxes.forEach((b, i) => {
    q.setFromAxisAngle(up, b.yaw);
    m.compose(new THREE.Vector3(b.x, b.y0, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
    size.set([b.w, b.h, b.d], i * 3);
    info.set([b.seed, b.lit, b.y0, 0], i * 4);
  });
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
  geo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4));
  mesh.frustumCulled = false;
  return mesh;
}

function createGround() {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), createGroundMaterial(LAYOUT.river));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, -1500);
  mesh.frustumCulled = false;
  return mesh;
}

/** Build the city. Beacon glows are appended to the shared glow list. */
export function createCity(glows) {
  const rng = makeRng(SEED + 101);
  const plan = { boxes: [], beacons: [], sight: buildSightGrid() };
  planSkybridges(plan, rng);
  planCanyon(plan, rng);
  planLowRise(plan, rng);
  planBlock(plan, rng);
  planGrid(plan, rng);
  for (const b of plan.beacons) glows.add(b.x, b.y, b.z, BEACON, 3.4, 0.55, b.phase);
  const group = new THREE.Group();
  group.add(createGround(), buildTowerMesh(plan));
  return { group };
}
