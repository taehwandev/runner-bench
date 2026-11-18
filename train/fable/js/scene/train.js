// The train: assembles locomotive and cars from the vehicle factories, places
// them on the track for a given distance, and drives the headlight, lamps,
// wheels and rods. Nothing here keeps state between frames.

import * as THREE from 'three';
import { makeRng, smoothstep } from '../core/rng.js';
import { VEHICLES, vehiclePose, localToWorld } from '../core/consist.js';
import { LAYOUT } from '../core/layout.js';
import { SEED } from '../config.js';
import { buildLocomotive, buildCar, LOCO_POINTS } from './vehicles.js';
import { armorTexture, flareTexture, spillTexture } from './textures.js';

const BEAM_VERT = /* glsl */ `
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
void main(){
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const BEAM_FRAG = /* glsl */ `
varying float vAlong;
varying vec3 vN;
varying vec3 vV;
uniform float uPower;
void main(){
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
  float fall = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.7) * smoothstep(0.0, 0.03, vAlong);
  gl_FragColor = vec4(vec3(1.0, 0.90, 0.72) * edge * fall * uPower, 1.0);
}
`;

function makeSprite(tex, color, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sprite.scale.setScalar(size);
  return sprite;
}

/** Headlight: a real spot on the track, a soft volumetric cone and a flare. */
function createHeadlight(tex) {
  const group = new THREE.Group();
  group.position.fromArray(LOCO_POINTS.headlight);
  const spot = new THREE.SpotLight(0xfff0d2, 1150, 320, 0.27, 0.8, 1.35);
  spot.target.position.set(0, -6.2, 60);
  group.add(spot, spot.target);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uPower: { value: 0.1 } },
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  for (const [radius, length] of [[9, 90], [4.2, 62]]) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(radius, 0.3, length, 28, 1, true), beamMat);
    cone.rotation.x = Math.PI / 2 + 0.05;
    cone.position.set(0, -Math.sin(0.05) * length * 0.5, Math.cos(0.05) * length * 0.5);
    cone.renderOrder = 6;
    group.add(cone);
  }
  const flare = makeSprite(tex, new THREE.Color(1.5, 1.3, 1.0), 4);
  flare.position.set(0, 0, 0.25);
  flare.renderOrder = 8;
  group.add(flare);
  return { group, flare, beamMat };
}

function createSpill(tex, length, strength, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (const sx of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, length - 1), material);
    plane.rotation.set(-Math.PI / 2, 0, sx > 0 ? 0 : Math.PI);
    plane.position.set(sx * 2.95, -0.2, 0);
    group.add(plane);
  }
  return { group, material, strength };
}

function vehicleMeshes(built, base) {
  const group = new THREE.Group();
  const lit = [];
  for (const key of ['armor', 'plain', 'glow']) {
    if (built.parts[key].empty) continue;
    const material = base[key].clone();
    if (key !== 'glow') lit.push(material);
    group.add(new THREE.Mesh(built.parts[key].build(), material));
  }
  return { group, lit };
}

/** Driving wheels and coupling rods of the locomotive. */
function createRunningGear(built, material) {
  const group = new THREE.Group();
  const axles = LOCO_POINTS.driverZ.map((z) => {
    const mesh = new THREE.Mesh(built.axleGeometry, material);
    mesh.position.set(0, LOCO_POINTS.driverRadius, z);
    group.add(mesh);
    return mesh;
  });
  const zMid = (LOCO_POINTS.driverZ[0] + LOCO_POINTS.driverZ[LOCO_POINTS.driverZ.length - 1]) / 2;
  const rods = [-1, 1].map((sx) => {
    const mesh = new THREE.Mesh(built.rodGeometry, material);
    group.add(mesh);
    return { mesh, sx, phase: sx > 0 ? 0 : Math.PI / 2 };
  });
  return {
    group,
    update(distance) {
      const angle = distance / LOCO_POINTS.driverRadius;
      for (const axle of axles) axle.rotation.x = angle;
      for (const rod of rods) {
        const a = angle + rod.phase;
        rod.mesh.position.set(
          rod.sx * 1.22,
          LOCO_POINTS.driverRadius + Math.cos(a) * LOCO_POINTS.crankRadius,
          zMid + Math.sin(a) * LOCO_POINTS.crankRadius,
        );
      }
    },
  };
}

function baseMaterials() {
  return {
    armor: new THREE.MeshStandardMaterial({ map: armorTexture(), vertexColors: true, roughness: 0.5, metalness: 0.4 }),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.1 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
}

/** How much open sky reaches track position s (0 deep inside the tunnel). */
function skyAt(s) {
  const { fromS, toS } = LAYOUT.tunnel;
  return 1 - smoothstep(fromS - 4, fromS + 10, s) * (1 - smoothstep(toS - 10, toS + 4, s));
}

/** 1 where the deck is wide enough to catch the light spilling from windows. */
function deckAt(s) {
  return smoothstep(LAYOUT.tunnel.fromS - 8, LAYOUT.tunnel.fromS, s);
}

function createUnit(vehicle, index, base, textures, rng) {
  const built = vehicle.type === 'loco' ? buildLocomotive() : buildCar(vehicle.type, rng);
  const { group, lit } = vehicleMeshes(built, base);
  const spill = createSpill(textures.spill, vehicle.length, built.spill, new THREE.Color(1.0, 0.62, 0.3));
  group.add(spill.group);
  const unit = { vehicle, index, group, lit, spill, sprites: [] };
  if (built.tail) {
    for (const p of built.tail) {
      const s = makeSprite(textures.flare, new THREE.Color(5, 0.3, 0.18), 2.6);
      s.position.fromArray(p);
      group.add(s);
      unit.sprites.push(s);
    }
  }
  if (vehicle.type === 'loco') {
    unit.gear = createRunningGear(built, lit[1]);
    unit.head = createHeadlight(textures.flare);
    unit.fire = makeSprite(textures.flare, new THREE.Color(3.2, 0.9, 0.2), 6);
    unit.fire.position.fromArray(LOCO_POINTS.firebox);
    group.add(unit.gear.group, unit.head.group, unit.fire);
    for (const p of built.lowerLamps) {
      const s = makeSprite(textures.flare, new THREE.Color(1.2, 1.05, 0.8), 0.95);
      s.position.fromArray(p);
      group.add(s);
    }
  }
  return unit;
}

const _pose = {};
const _w = {};
const _toCam = new THREE.Vector3();

function placeUnit(unit, distance, t, speedNorm) {
  vehiclePose(distance, unit.vehicle, _pose);
  const i = unit.index;
  const sway = Math.sin(t * 5.3 + i * 1.7) * 0.004 * speedNorm;
  const bounce = Math.sin(t * 17 + i * 2.3) * 0.012 * speedNorm;
  unit.group.position.set(_pose.x, _pose.y + bounce, _pose.z);
  unit.group.rotation.set(0, _pose.yaw, sway);
  const sky = 0.12 + 0.88 * skyAt(_pose.s);
  for (const m of unit.lit) m.color.setScalar(sky);
  unit.spill.material.opacity = unit.spill.strength * 0.55 * deckAt(_pose.s);
  unit.spill.group.visible = unit.spill.material.opacity > 0.01;
}

/**
 * Create the train. Returns
 * { group, headPos, headDir, update(t, state, camera) }
 * where headPos/headDir are { value: Vector3 } uniforms tracking the headlight.
 */
export function createTrain() {
  const rng = makeRng(SEED + 307);
  const base = baseMaterials();
  const textures = { flare: flareTexture(), spill: spillTexture() };
  const group = new THREE.Group();
  const units = VEHICLES.map((v, i) => createUnit(v, i, base, textures, rng));
  for (const u of units) group.add(u.group);
  const loco = units[0];
  const headPos = { value: new THREE.Vector3() };
  const headDir = { value: new THREE.Vector3(0, 0, -1) };

  function update(t, state, camera) {
    const speedNorm = Math.min(1, state.speed / 40);
    for (const u of units) placeUnit(u, state.distance, t, speedNorm);
    loco.gear.update(state.distance);
    vehiclePose(state.distance, loco.vehicle, _pose);
    const [hx, hy, hz] = LOCO_POINTS.headlight;
    localToWorld(_pose, hx, hy, hz, _w);
    headPos.value.set(_w.x, _w.y, _w.z);
    headDir.value.set(_pose.fx, -0.09, _pose.fz).normalize();
    // the flare blooms when the lamp points at the lens
    _toCam.copy(camera.position).sub(headPos.value);
    const dist = _toCam.length();
    const facing = Math.max(0, _toCam.normalize().dot(headDir.value));
    const glare = Math.pow(facing, 6);
    loco.head.flare.scale.setScalar((1.5 + 2.4 * glare) * (0.7 + Math.min(dist, 220) / 110));
    loco.head.flare.material.opacity = 0.55 + 0.45 * glare;
    loco.head.beamMat.uniforms.uPower.value = 0.1 * (1 - 0.88 * glare);
    const flicker = 0.8 + 0.2 * Math.sin(t * 23.0) * Math.sin(t * 7.3 + 1.0);
    loco.fire.material.opacity = flicker;
  }

  return { group, headPos, headDir, update };
}
