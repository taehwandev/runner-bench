// Vehicle factories for the armoured train. Every vehicle is built in its own
// local frame: +Z is the direction of travel, y = 0 is the rail head.
// A factory fills three buckets (textured armour, plain paint, emissive) and
// returns the points other systems need (lamps, stacks, tail lights).

import * as THREE from 'three';
import { MeshBuilder, mirrorProfile, xform } from './geo.js';
import { TRAIN } from '../config.js';

const ARMOR = [0.36, 0.4, 0.45];
const ARMOR_DARK = [0.21, 0.23, 0.27];
const PLATE = [0.15, 0.17, 0.2]; // untextured armour
const IRON = [0.055, 0.058, 0.07];
const BLACK = [0.02, 0.022, 0.028];
const STRIPE = [0.36, 0.05, 0.04];
const SNOW = [0.8, 0.85, 0.95];
const HAZARD = [0.6, 0.4, 0.08];
const BRASS = [0.5, 0.34, 0.1];
const GLASS = [0.015, 0.02, 0.03];
const WARM = [2.3, 1.25, 0.5];
const COOL = [2.0, 2.6, 3.2];
const AMBER = [3.6, 1.7, 0.36];
const FIRE = [5.5, 1.6, 0.35];
const RED = [7, 0.4, 0.25];
const HEAD = [18, 16, 12];

const CAR_HALF = [[1.45, 0.35], [1.75, 1.25], [1.75, 3.15], [1.25, 4.05]];
const LOW_HALF = [[1.45, 0.35], [1.75, 1.25], [1.75, 2.75], [1.3, 3.4]];
const HULL_HALF = [[1.62, 1.25], [1.8, 1.5], [1.8, 3.0], [1.3, 3.85]];
const NOSE_HALF = [[1.3, 1.25], [1.45, 1.5], [1.45, 2.7], [0.95, 3.3]];
const CAB_HALF = [[1.62, 1.25], [1.8, 1.5], [1.8, 3.7], [1.45, 4.7]];
const TENDER_HALF = [[1.5, 0.5], [1.8, 1.4], [1.8, 3.3], [1.4, 3.95]];

/** Local points on the locomotive that lights and effects attach to. */
export const LOCO_POINTS = {
  headlight: [0, 3.95, 8.9],
  stack: [0, 5.95, 6.3],
  stack2: [0, 5.6, 4.4],
  whistle: [0.3, 5.5, -3.6],
  cocks: [1.75, 0.9, 8.2],
  plough: [1.5, 0.7, 10.6],
  firebox: [0, 0.7, -4.2],
  driverZ: [5.4, 2.9, 0.4, -2.1],
  driverRadius: 0.98,
  crankRadius: 0.5,
};

const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

function newParts() {
  return { armor: new MeshBuilder(), plain: new MeshBuilder(), glow: new MeshBuilder() };
}

/** Armoured shell lofted along the vehicle with snow on the roof. */
function shell(parts, half, zFront, zBack, { caps = true, snow = true } = {}) {
  const prof = mirrorProfile(half);
  const paint = (i) => (i === 0 || i === 6 ? ARMOR_DARK : i === 7 ? BLACK : ARMOR);
  parts.armor.loft(prof, zFront, prof, zBack, ARMOR, paint);
  if (caps) {
    parts.armor.cap(prof, zFront, 1, ARMOR_DARK);
    parts.armor.cap(prof, zBack, -1, ARMOR_DARK);
  }
  if (snow) {
    const top = half[3];
    parts.plain.box(0, top[1] + 0.1, (zFront + zBack) / 2, top[0] * 2 - 0.12, 0.2, zFront - zBack - 0.5, SNOW);
  }
}

/** A flat panel standing proud of the side wall, on one or both sides. */
function sidePanel(builder, y, z, h, w, color, proud = 0.03, wallX = 1.75, sides = [-1, 1]) {
  for (const sx of sides) builder.box(sx * (wallX + proud / 2), y, z, proud, h, w, color);
}

function bogie(parts, z) {
  parts.plain.box(0, 0.5, z, 2.3, 0.45, 3.1, BLACK);
  for (const dz of [-0.95, 0.95]) {
    for (const sx of [-1, 1]) {
      parts.plain.append(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 12), xform(sx * 0.78, 0.46, z + dz, 0, 0, Math.PI / 2), IRON);
    }
  }
}

/** Running gear, couplings and the lights along the skirt shared by all cars. */
function undercarriage(parts, L) {
  bogie(parts, L / 2 - 2.7);
  bogie(parts, -L / 2 + 2.7);
  parts.plain.box(0, 0.75, 0, 1.6, 0.6, L - 6.6, BLACK);
  parts.plain.box(0, 2.15, -L / 2 - TRAIN.gap / 2, 2.0, 2.9, TRAIN.gap, BLACK);
  parts.plain.box(0, 1.0, L / 2 + 0.2, 0.36, 0.3, 0.5, IRON);
  for (const z of [-L / 2 + 1.2, 0, L / 2 - 1.2]) {
    for (const sx of [-1, 1]) parts.glow.box(sx * 1.49, 0.44, z, 0.06, 0.08, 0.3, AMBER);
  }
  parts.plain.box(0, 1.52, 0, 3.54, 0.2, L - 0.4, STRIPE);
}

function windowRow(parts, rng, zs, y, w, h, litChance) {
  for (const z of zs) {
    for (const sx of [-1, 1]) {
      sidePanel(parts.plain, y, z, h + 0.18, w + 0.18, BLACK, 0.02, 1.75, [sx]);
      if (rng.chance(litChance)) {
        const tone = rng.chance(0.12) ? COOL : WARM;
        const hh = rng.chance(0.25) ? h * 0.55 : h; // half-closed shutter
        parts.glow.box(sx * 1.775, y - (h - hh) / 2, z, 0.02, hh, w, scale(tone, rng.range(0.55, 1.2)));
      } else {
        parts.glow.box(sx * 1.775, y, z, 0.02, h, w, GLASS);
      }
    }
  }
}

function roofBoxes(parts, zs, y) {
  for (const z of zs) {
    parts.plain.box(0, y + 0.28, z, 0.9, 0.36, 1.2, PLATE);
    parts.plain.box(0, y + 0.52, z, 0.96, 0.14, 1.26, SNOW);
  }
}

function buildCoach(parts, rng) {
  const L = TRAIN.carLength;
  shell(parts, CAR_HALF, L / 2, -L / 2);
  undercarriage(parts, L);
  const zs = [];
  for (let i = 0; i < 7; i++) zs.push(-4.8 + i * 1.6);
  windowRow(parts, rng, zs, 2.5, 1.0, 0.6, 0.84);
  for (const z of [-6.55, 6.55]) {
    sidePanel(parts.plain, 2.0, z, 2.3, 1.0, PLATE, 0.06);
    sidePanel(parts.glow, 2.6, z, 0.3, 0.36, scale(WARM, 0.7), 0.02, 1.81);
  }
  roofBoxes(parts, [-4, 0.5, 4.4], 4.05);
  return { spill: 1 };
}

function buildCargo(parts, rng) {
  const L = TRAIN.carLength;
  shell(parts, CAR_HALF, L / 2, -L / 2);
  undercarriage(parts, L);
  for (const z of [-3.2, 3.2]) {
    sidePanel(parts.plain, 2.2, z, 2.5, 3.6, PLATE, 0.08);
    sidePanel(parts.plain, 2.2, z, 0.16, 3.6, IRON, 0.12);
    sidePanel(parts.plain, 2.2, z, 2.5, 0.16, IRON, 0.12);
    sidePanel(parts.glow, 3.3, z, 0.12, 0.5, scale(COOL, 0.9), 0.02, 1.83);
  }
  windowRow(parts, rng, [-6.4, 0, 6.4], 2.75, 0.55, 0.2, 0.7);
  roofBoxes(parts, [-2.4, 2.4], 4.05);
  return { spill: 0.35 };
}

function turret(parts, z, radius, barrel, dir) {
  const y = 3.4;
  parts.plain.append(new THREE.CylinderGeometry(radius * 0.86, radius, 0.95, 10), xform(0, y + 0.47, z), PLATE);
  parts.plain.append(new THREE.CylinderGeometry(radius * 0.8, radius * 0.86, 0.12, 10), xform(0, y + 1.0, z), SNOW);
  const tilt = dir * (Math.PI / 2 - 0.2);
  const cy = y + 0.55 + Math.sin(0.2) * barrel * 0.5;
  for (const dx of barrel > 4 ? [0] : [-0.32, 0.32]) {
    parts.plain.append(
      new THREE.CylinderGeometry(0.11, 0.15, barrel, 8),
      xform(dx, cy, z + dir * (radius * 0.6 + Math.cos(0.2) * barrel * 0.5), tilt, 0, 0), IRON,
    );
  }
  parts.glow.box(dir * 0.5, y + 0.6, z + dir * radius * 0.9, 0.3, 0.14, 0.05, scale(COOL, 1.6));
}

function buildTurret(parts, rng) {
  const L = TRAIN.carLength;
  shell(parts, LOW_HALF, L / 2, -L / 2, { snow: false });
  parts.plain.box(0, 3.46, 0, 2.5, 0.14, L - 0.5, SNOW);
  undercarriage(parts, L);
  turret(parts, 2.4, 1.4, 4.8, 1);
  turret(parts, -3.9, 0.95, 2.6, -1);
  windowRow(parts, rng, [-6.2, -1.2, 0.2, 6.2], 2.3, 0.6, 0.22, 0.75);
  sidePanel(parts.plain, 1.9, -0.5, 1.5, 2.0, PLATE, 0.07);
  return { spill: 0.3 };
}

function buildCaboose(parts, rng) {
  const L = TRAIN.carLength;
  shell(parts, CAR_HALF, L / 2, -L / 2);
  undercarriage(parts, L);
  const zs = [];
  for (let i = 0; i < 5; i++) zs.push(-1.8 + i * 1.6);
  windowRow(parts, rng, zs, 2.5, 1.0, 0.6, 0.9);
  // look-out cupola
  parts.plain.box(0, 4.52, -4.2, 2.3, 0.95, 3.2, PLATE);
  parts.plain.box(0, 5.07, -4.2, 2.4, 0.16, 3.3, SNOW);
  for (const z of [-5.1, -4.2, -3.3]) sidePanel(parts.glow, 4.6, z, 0.4, 0.62, scale(WARM, 0.9), 0.02, 1.15);
  parts.glow.box(0, 4.6, -5.81, 1.5, 0.4, 0.02, scale(WARM, 0.8));
  const tail = [];
  for (const sx of [-1, 1]) {
    parts.glow.box(sx * 1.2, 2.95, -L / 2 - 0.02, 0.3, 0.3, 0.04, RED);
    tail.push([sx * 1.2, 2.95, -L / 2 - 0.12]);
  }
  parts.glow.box(0, 3.75, -L / 2 - 0.02, 0.5, 0.16, 0.04, scale(RED, 0.5));
  return { spill: 0.9, tail };
}

const CAR_BUILDERS = { coach: buildCoach, cargo: buildCargo, turret: buildTurret, caboose: buildCaboose };

/** Snow plough with hazard stripes, built as strips so the paint alternates. */
function plough(parts) {
  const strips = 6;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const a = i / strips, b = (i + 1) / strips;
      const at = (t, top) => [sx * 1.98 * t, top ? 2.0 - 0.2 * t : 0.12, top ? 10.95 - 1.85 * t : 11.5 - 2.2 * t];
      const color = i % 2 ? IRON : HAZARD;
      if (sx > 0) parts.plain.quad(at(a, 0), at(b, 0), at(b, 1), at(a, 1), color);
      else parts.plain.quad(at(b, 0), at(a, 0), at(a, 1), at(b, 1), color);
    }
  }
  parts.plain.box(0, 0.75, 8.9, 3.0, 1.0, 2.2, IRON);
}

function boiler(parts) {
  const P = LOCO_POINTS;
  parts.armor.append(new THREE.CylinderGeometry(1.12, 1.12, 13.6, 18), xform(0, 3.72, 1.2, Math.PI / 2), ARMOR);
  for (const z of [-4.6, -1.8, 1.0, 3.8, 6.9]) {
    parts.plain.append(new THREE.CylinderGeometry(1.16, 1.16, 0.2, 18), xform(0, 3.72, z, Math.PI / 2), IRON);
  }
  parts.plain.append(new THREE.CylinderGeometry(0.84, 1.0, 0.3, 16), xform(0, 3.72, 8.1, Math.PI / 2), IRON);
  parts.plain.box(0, 4.86, 1.2, 0.7, 0.12, 12.6, SNOW);
  // stacks, domes, valves
  parts.plain.append(new THREE.CylinderGeometry(0.52, 0.38, 1.15, 12), xform(0, 5.3, P.stack[2]), IRON);
  parts.plain.append(new THREE.CylinderGeometry(0.3, 0.26, 0.8, 10), xform(0, 5.15, P.stack2[2]), IRON);
  parts.armor.append(new THREE.SphereGeometry(0.62, 12, 8), xform(0, 4.66, 1.9, 0, 0, 0, 1, 0.8, 1), ARMOR);
  parts.armor.append(new THREE.SphereGeometry(0.5, 12, 8), xform(0, 4.66, -1.0, 0, 0, 0, 1, 0.8, 1), ARMOR);
  for (const dx of [-0.3, 0.3]) {
    parts.plain.append(new THREE.CylinderGeometry(0.06, 0.08, 0.75, 6), xform(dx, 5.1, -3.6), BRASS);
  }
  for (const sx of [-1, 1]) {
    parts.plain.append(new THREE.CylinderGeometry(0.07, 0.07, 12.4, 6), xform(sx * 1.12, 4.2, 1.2, Math.PI / 2), IRON);
  }
}

function locoLamps(parts) {
  const [hx, hy, hz] = LOCO_POINTS.headlight;
  parts.plain.box(hx, hy, hz - 0.4, 0.95, 0.95, 0.7, IRON, SNOW);
  parts.glow.append(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 18), xform(hx, hy, hz - 0.03, Math.PI / 2), HEAD);
  const lower = [];
  for (const sx of [-1, 1]) {
    parts.plain.box(sx * 1.02, 2.05, 9.8, 0.42, 0.42, 0.3, IRON);
    parts.glow.append(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 12), xform(sx * 1.02, 2.05, 9.97, Math.PI / 2), scale(HEAD, 0.22));
    lower.push([sx * 1.02, 2.05, 10.05]);
    // firebox grilles glowing through the armour
    for (let i = 0; i < 4; i++) parts.glow.box(sx * 1.815, 1.95 + i * 0.2, -4.0, 0.03, 0.08, 1.7, FIRE);
    parts.glow.box(sx * 1.3, 0.62, -4.2, 0.5, 0.06, 2.2, scale(FIRE, 0.7));
  }
  return lower;
}

function locoBody(parts) {
  const hull = mirrorProfile(HULL_HALF);
  const nose = mirrorProfile(NOSE_HALF);
  shell(parts, HULL_HALF, 8.4, -6.0, { caps: false, snow: false });
  parts.armor.loft(hull, 8.4, nose, 9.9, ARMOR, (i) => (i === 7 ? BLACK : ARMOR));
  parts.armor.cap(nose, 9.9, 1, ARMOR_DARK);
  parts.plain.box(0, 3.36, 9.3, 1.7, 0.1, 1.0, SNOW);
  shell(parts, CAB_HALF, -6.0, -9.2);
  shell(parts, TENDER_HALF, -9.2, -11.5);
  parts.plain.box(0, 2.15, -11.5 - TRAIN.gap / 2, 2.0, 2.9, TRAIN.gap, BLACK);
  for (const z of [-6.9, -8.25]) {
    sidePanel(parts.plain, 3.1, z, 0.74, 1.0, BLACK, 0.02, 1.8);
    sidePanel(parts.glow, 3.1, z, 0.56, 0.84, scale(WARM, 1.15), 0.02, 1.825);
  }
  for (const sx of [-1, 1]) parts.glow.box(sx * 1.38, 4.15, -5.98, 0.5, 0.3, 0.04, scale(WARM, 0.8));
  parts.plain.box(0, 1.52, 0.2, 3.64, 0.2, 12.2, STRIPE);
  // frame, cylinders and the small wheels front and back
  parts.plain.box(0, 0.95, 1.0, 2.1, 0.7, 15.6, BLACK);
  for (const sx of [-1, 1]) {
    parts.plain.box(sx * 1.5, 1.0, 7.5, 0.7, 0.85, 1.7, PLATE);
    parts.plain.box(sx * 1.36, 1.0, 5.9, 0.1, 0.1, 1.6, IRON);
  }
  for (const z of [8.5, -7.6, -10.3]) {
    for (const sx of [-1, 1]) {
      parts.plain.append(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 12), xform(sx * 0.78, 0.5, z, 0, 0, Math.PI / 2), IRON);
    }
  }
}

/** One driving axle: both wheels with rims, spokes and quartered cranks. */
function driverAxle() {
  const b = new MeshBuilder();
  const r = LOCO_POINTS.driverRadius;
  for (const sx of [-1, 1]) {
    const phase = sx > 0 ? 0 : Math.PI / 2;
    b.append(new THREE.CylinderGeometry(r, r, 0.2, 22), xform(sx * 0.95, 0, 0, 0, 0, Math.PI / 2), IRON);
    b.append(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.06, 22), xform(sx * 1.06, 0, 0, 0, 0, Math.PI / 2), STRIPE);
    for (let i = 0; i < 3; i++) {
      b.append(new THREE.BoxGeometry(0.05, r * 1.84, 0.13), xform(sx * 1.07, 0, 0, phase + (i * Math.PI) / 3), [0.2, 0.2, 0.23]);
    }
    b.append(new THREE.BoxGeometry(0.08, 0.5, 0.9), xform(sx * 1.08, -Math.cos(phase) * 0.55, -Math.sin(phase) * 0.55, phase), [0.12, 0.12, 0.14]);
  }
  return b.build();
}

/** Build the locomotive. Returns geometry buckets plus its moving parts. */
export function buildLocomotive() {
  const parts = newParts();
  plough(parts);
  locoBody(parts);
  boiler(parts);
  const lowerLamps = locoLamps(parts);
  const axleGeometry = driverAxle();
  const rodGeometry = new THREE.BoxGeometry(0.1, 0.2, 7.9);
  return { parts, length: TRAIN.locoLength, lowerLamps, axleGeometry, rodGeometry, spill: 0.5 };
}

/** Build one car of the given type from the consist table. */
export function buildCar(type, rng) {
  const parts = newParts();
  const info = CAR_BUILDERS[type](parts, rng);
  return { parts, length: TRAIN.carLength, ...info };
}
