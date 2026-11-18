// Everything the train runs on: the slender viaduct beam between the towers,
// the full deck through the tunnel and over the bridge, rails, piers, lamps
// and the cable-stayed bridge itself.

import * as THREE from 'three';
import { sampleTrack } from '../core/track.js';
import { LAYOUT } from '../core/layout.js';
import { TRACK, BRIDGE } from '../config.js';
import { MeshBuilder, xform } from './geo.js';
import { deckTexture } from './textures.js';

const CONCRETE = [0.2, 0.215, 0.25];
const CONCRETE_DARK = [0.11, 0.12, 0.145];
const SNOW = [0.8, 0.85, 0.95];
const STEEL = [0.13, 0.14, 0.17];
const LAMP = [2.6, 1.9, 1.1];
const RED = [3.0, 0.22, 0.16];

const _p0 = {};
const _p1 = {};

function at(p, side, up) {
  return [p.x + p.rx * side, p.y + up, p.z + p.rz * side];
}

/**
 * Sweep an open cross-section ([side, up] pairs, walked clockwise looking
 * along travel) down the track. `paint(i)` gives each facet its colour;
 * `uRange` maps the deck texture across the section.
 */
function sweep(builder, section, fromS, toS, step, paint, uRange = null) {
  for (let s = fromS; s < toS - 1e-6; s += step) {
    const s1 = Math.min(s + step, toS);
    sampleTrack(s, _p0);
    sampleTrack(s1, _p1);
    for (let i = 0; i < section.length - 1; i++) {
      const [l0, y0] = section[i];
      const [l1, y1] = section[i + 1];
      const uv = uRange ? [uRange[0], s / 8, uRange[1], s1 / 8] : [0, 0, 1, 1];
      builder.quad(at(_p0, l0, y0), at(_p0, l1, y1), at(_p1, l1, y1), at(_p1, l0, y0), paint(i), uv);
    }
  }
}

const dT = -0.25; // top of the deck relative to the rail head

function deckSections(half) {
  const top = [[-half, dT], [half, dT]];
  const body = [[half, dT], [half, -1.7], [-half, -1.7], [-half, dT]];
  return { top, body };
}

/** Deck surfaces. `dark` is the stretch inside the tunnel (no sky light). */
function buildDecks(group) {
  const topMap = deckTexture();
  const topMat = new THREE.MeshStandardMaterial({ map: topMap, roughness: 0.86, metalness: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ map: topMap, roughness: 0.8, color: 0x2a2c33 });
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tops = new MeshBuilder();
  const darkTop = new MeshBuilder();
  const body = new MeshBuilder();
  const white = [1, 1, 1];
  const beam = deckSections(TRACK.beamHalfWidth);
  const wide = deckSections(TRACK.deckHalfWidth);
  const paintBody = (i) => (i === 1 ? CONCRETE_DARK : CONCRETE);
  const { tunnel, bridge } = LAYOUT;

  sweep(tops, beam.top, TRACK.from, tunnel.fromS - 6, 4, () => white, [0.3, 0.7]);
  sweep(body, beam.body, TRACK.from, tunnel.fromS - 6, 4, paintBody);
  sweep(tops, wide.top, tunnel.fromS - 6, tunnel.fromS, 6, () => white, [0, 1]);
  sweep(darkTop, [[-tunnel.halfWidth, dT], [tunnel.halfWidth, dT]], tunnel.fromS, tunnel.toS, 10, () => white, [-0.27, 1.27]);
  sweep(tops, wide.top, tunnel.toS, TRACK.to, 10, () => white, [0, 1]);
  sweep(body, wide.body, tunnel.toS, TRACK.to, 10, paintBody);
  // low parapets with a cap of snow along the bridge
  for (const side of [-1, 1]) {
    const a = side * TRACK.deckHalfWidth;
    const b = side * (TRACK.deckHalfWidth + 0.3);
    const wall = side > 0 ? [[a, dT], [a, 0.6], [b, 0.6], [b, dT]] : [[b, dT], [b, 0.6], [a, 0.6], [a, dT]];
    sweep(body, wall, bridge.fromS, TRACK.to, 10, (i) => (i === 1 ? SNOW : CONCRETE));
  }
  group.add(new THREE.Mesh(tops.build(), topMat), new THREE.Mesh(darkTop.build(), darkMat), new THREE.Mesh(body.build(), bodyMat));
}

function buildRails(group) {
  const rails = new MeshBuilder();
  const steel = [1, 1, 1];
  for (const c of [-0.75, 0.75]) {
    const section = [[c - 0.05, -0.22], [c - 0.05, 0], [c + 0.05, 0], [c + 0.05, -0.22]];
    sweep(rails, section, TRACK.from, TRACK.straightFrom, 4, () => steel);
    sweep(rails, section, TRACK.straightFrom, TRACK.to, 60, () => steel);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d949e, roughness: 0.32, metalness: 0.55 });
  group.add(new THREE.Mesh(rails.build(), mat));
}

/** Piers under the viaduct and lamp masts beside the line. */
function buildPiersAndLamps(group, glows) {
  const b = new MeshBuilder();
  const p = {};
  const yaw = (q) => Math.atan2(q.tx, q.tz);
  const pierTop = TRACK.railY - 1.7;
  for (let s = TRACK.from + 20; s < LAYOUT.viaduct.toS - 30; s += 46) {
    sampleTrack(s, p);
    b.append(new THREE.BoxGeometry(2.6, pierTop - 3, 3.4), xform(p.x, (pierTop - 3) / 2, p.z, 0, yaw(p)), CONCRETE_DARK);
    b.append(new THREE.BoxGeometry(5.4, 3, 4.2), xform(p.x, pierTop - 1.5, p.z, 0, yaw(p)), CONCRETE);
  }
  // masts stand on the left only: every camera on the viaduct works from the right
  const side = -1;
  for (let s = TRACK.from + 40; s < LAYOUT.viaduct.toS - 20; s += 58) {
    if (s > LAYOUT.station.fromS - 10 && s < LAYOUT.station.toS + 10) continue;
    sampleTrack(s, p);
    const lat = side * 2.9;
    const x = p.x + p.rx * lat;
    const z = p.z + p.rz * lat;
    b.append(new THREE.BoxGeometry(0.22, 8.4, 0.22), xform(x, TRACK.railY + 2.5, z, 0, yaw(p)), STEEL);
    b.append(new THREE.BoxGeometry(1.5, 0.16, 0.2), xform(x - p.rx * side * 0.6, TRACK.railY + 6.6, z - p.rz * side * 0.6, 0, yaw(p)), STEEL);
    b.append(new THREE.BoxGeometry(1.4, 0.5, 0.6), xform(x, TRACK.railY - 1.2, z, 0, yaw(p)), CONCRETE);
    glows.add(x - p.rx * side * 1.2, TRACK.railY + 6.45, z - p.rz * side * 1.2, LAMP, 1.0);
  }
  group.add(new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
}

function addStays(lines, px, topY, z, side) {
  const deckY = TRACK.railY + 0.6;
  for (let i = 1; i <= 7; i++) {
    for (const dir of [-1, 1]) {
      lines.push(px, topY - i * 3.2, z, side * (TRACK.deckHalfWidth + 0.3), deckY, z + dir * i * 17);
    }
  }
}

/** Cable-stayed bridge: pylons, stays, lamps running out into the dark. */
function buildBridge(group, glows) {
  const b = new MeshBuilder();
  const lines = [];
  const { bridge } = LAYOUT;
  const topY = TRACK.railY + BRIDGE.pylonHeight;
  for (let s = bridge.firstPylonS; s < bridge.toS + 300; s += BRIDGE.pylonEvery) {
    const z = -s;
    for (const side of [-1, 1]) {
      const px = side * 7.6;
      b.box(px, topY / 2, z, 3.2, topY, 4.6, CONCRETE, SNOW);
      addStays(lines, px, topY - 4, z, side);
      glows.add(px, topY + 2.2, z, RED, 2.6, 0.5, (s * 0.37) % 1);
      glows.add(px - side * 1.9, TRACK.railY + 9, z, LAMP, 1.5);
    }
    b.box(0, TRACK.railY + 13.5, z, 15.2, 2.4, 3.4, CONCRETE, SNOW);
    b.box(0, topY - 9, z, 15.2, 3.2, 3.4, CONCRETE, SNOW);
    b.box(0, TRACK.railY - 4.5, z, 19, 5.6, 6, CONCRETE_DARK);
  }
  let k = 0;
  for (let s = bridge.fromS + 26; s < TRACK.to; s += 36) {
    const side = k++ % 2 ? 1 : -1;
    const x = side * (TRACK.deckHalfWidth + 0.15);
    b.box(x, TRACK.railY + 3.1, -s, 0.2, 5.6, 0.2, STEEL);
    b.box(x - side * 0.7, TRACK.railY + 5.9, -s, 1.6, 0.14, 0.2, STEEL);
    glows.add(x - side * 1.4, TRACK.railY + 5.75, -s, LAMP, 1.0);
  }
  group.add(new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const stays = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x3a4152 }));
  stays.frustumCulled = false;
  group.add(stays);
}

export function createTrackworks(glows) {
  const group = new THREE.Group();
  buildDecks(group);
  buildRails(group);
  buildPiersAndLamps(group, glows);
  buildBridge(group, glows);
  return { group };
}
