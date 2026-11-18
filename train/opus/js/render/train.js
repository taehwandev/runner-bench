// Armoured train: locomotive with snow plough, stack and headlight rig, plus
// car variants (troop, turret, cargo, guard) built from the CONSIST table.
// Models face +z; local +x is the left side of travel.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { UNIT_OFFSETS, trainDistance, trainSpeed } from '../core/kinematics.js';
import { track } from '../core/landmarks.js';
import { noise1 } from '../core/rng.js';
import { RAIL_TOP } from './viaduct.js';
import { patchMaterial } from './atmosShader.js';
import { makeWindowStripTexture, makeFlareTexture } from './textures.js';

// ------------------------------------------------------------------ helpers
function part(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// Side profile (z, y) extruded across the width, centred on x.
// rotateY(-90°) maps the shape's x (length) onto +z and the extrusion onto x.
function sideExtrude(points, width, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

// Cross-section (x, y) extruded along the length, centred on z.
function crossExtrude(points, length, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1,
  });
  geo.translate(0, 0, -(length - bevel * 2) / 2);
  return geo;
}

// Collapse a static group into one mesh per material (few draw calls per car).
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const list = buckets.get(o.material) || [];
    list.push(g);
    buckets.set(o.material, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of buckets) out.add(new THREE.Mesh(mergeGeometries(list), mat));
  return out;
}

function wheels(g, mats, zs, gauge = 1.3, r = 0.48) {
  const w = new THREE.CylinderGeometry(r, r, 0.16, 14);
  w.rotateZ(Math.PI / 2);
  for (const z of zs) for (const x of [-gauge, gauge]) g.add(part(w, mats.under, x, r, z));
}

function bogie(g, mats, z) {
  g.add(part(box(2.5, 0.42, 2.9), mats.under, 0, 0.62, z));
  wheels(g, mats, [z - 0.95, z + 0.95]);
}

function windowStrip(g, mat, len, y, halfWidth, h = 0.55, z = 0) {
  const geo = new THREE.PlaneGeometry(len, h);
  // sits just proud of the extrusion bevel (+0.05)
  g.add(part(geo, mat, halfWidth + 0.07, y, z, 0, Math.PI / 2, 0));
  g.add(part(geo, mat, -halfWidth - 0.07, y, z, 0, -Math.PI / 2, 0));
}

// ------------------------------------------------------------------ units
function buildLoco(mats, M) {
  const g = new THREE.Group();
  const cab = sideExtrude([[-10, 1.4], [-3.5, 1.4], [-3.5, 4.45], [-3.8, 4.72], [-9.6, 4.72], [-10, 4.35]], 3.1);
  // long hood with chamfered armour, then a heavy wedge prow
  const hood = crossExtrude([[-1.4, 1.4], [1.4, 1.4], [1.4, 3.2], [0.92, 3.95], [-0.92, 3.95], [-1.4, 3.2]], 9.0);
  const prow = sideExtrude([[5.0, 1.4], [9.7, 1.4], [9.7, 1.9], [8.4, 3.0], [5.0, 3.85]], 2.6);
  g.add(part(cab, mats.hull), part(hood, mats.hull, 0, 0, 0.9), part(prow, mats.hull));
  // livery band with running number, louvres and grab rails along the hood
  const livery = new THREE.PlaneGeometry(8.6, 0.62);
  g.add(part(livery, M.livery, 1.47, 2.45, 0.9, 0, Math.PI / 2, 0));
  g.add(part(livery, M.liveryMirror, -1.47, 2.45, 0.9, 0, -Math.PI / 2, 0));
  for (const z of [-2.2, -1.2, 2.4, 3.4]) {
    for (const x of [-1.46, 1.46]) g.add(part(box(0.04, 0.5, 0.75), mats.under, x, 1.85, z));
  }
  const rail = new THREE.CylinderGeometry(0.035, 0.035, 8.4, 6);
  rail.rotateX(Math.PI / 2);
  for (const x of [-1.5, 1.5]) g.add(part(rail, mats.steel, x, 3.3, 0.9));
  g.add(part(box(3.3, 0.12, 0.9), mats.hullDark, 0, 4.62, -3.25));   // armoured visor over the cab glass
  g.add(part(box(3.0, 0.45, 19.4), mats.under, 0, 1.18, 0));
  for (const x of [-1.6, 1.6]) g.add(part(box(0.1, 1.15, 17.6), mats.hullDark, x, 0.98, 0.2));
  // snow plough
  const plow = new THREE.Shape([new THREE.Vector2(-1.65, 0), new THREE.Vector2(1.65, 0), new THREE.Vector2(0.35, 1.9), new THREE.Vector2(-0.35, 1.9)]);
  const pg = new THREE.ExtrudeGeometry(plow, { depth: 1.3, bevelEnabled: false });
  pg.rotateX(Math.PI / 2);
  g.add(part(pg, mats.chevron, 0, 1.55, 9.6));
  // stack, vents, cab windows
  g.add(part(new THREE.CylinderGeometry(0.4, 0.48, 1.2, 14), mats.hullDark, 0, 4.5, 3.2));
  g.add(part(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 14), mats.steel, 0, 5.1, 3.2));
  for (const z of [-1.5, 0.4, 5.6]) g.add(part(box(1.7, 0.28, 1.1), mats.hullDark, 0, 4.08, z));
  g.add(part(box(0.08, 1.6, 0.08), mats.steel, 0.9, 5.4, -8.2));
  g.add(part(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 8), mats.steel, -0.7, 4.9, -5.5, Math.PI / 2, 0, 0));
  g.add(part(box(2.3, 0.34, 0.06), M.cabGlass, 0, 4.2, -3.47));
  windowStrip(g, M.cabSide, 4.6, 3.75, 1.55, 0.5, -6.6);
  // headlight housing and marker lamps
  g.add(part(new THREE.CylinderGeometry(0.42, 0.46, 0.5, 18), mats.hullDark, 0, 3.12, 8.55, Math.PI / 2, 0, 0));
  g.add(part(new THREE.CircleGeometry(0.34, 18), M.headLamp, 0, 3.12, 8.81));
  for (const x of [-1.05, 1.05]) g.add(part(new THREE.CircleGeometry(0.13, 10), M.marker, x, 1.75, 9.76));
  wheels(g, mats, [-7.6, -6.0, -4.4, 4.4, 6.0, 7.6]);
  g.add(part(box(1.9, 2.4, 1.0), mats.under, 0, 2.6, -10.5));
  return g;
}

const TROOP_SECTION = [[-1.55, 1.4], [1.55, 1.4], [1.55, 3.35], [1.1, 3.95], [-1.1, 3.95], [-1.55, 3.35]];
const LOW_SECTION = [[-1.55, 1.4], [1.55, 1.4], [1.55, 2.9], [1.2, 3.3], [-1.2, 3.3], [-1.55, 2.9]];

function carBase(g, mats, len) {
  g.add(part(box(2.8, 0.4, len - 0.3), mats.under, 0, 1.2, 0));
  bogie(g, mats, len / 2 - 2.3);
  bogie(g, mats, -len / 2 + 2.3);
  g.add(part(box(2.3, 2.5, 1.25), mats.under, 0, 2.55, len / 2 + 0.6));
}

function buildTroop(mats, M, len, variant) {
  const g = new THREE.Group();
  carBase(g, mats, len);
  g.add(part(crossExtrude(TROOP_SECTION, len - 0.2), mats.hull));
  windowStrip(g, M.windows[variant % M.windows.length], len - 2.6, 2.62, 1.55);
  for (let z = -len / 2 + 1; z < len / 2; z += 1.6) {
    for (const x of [-1.6, 1.6]) g.add(part(box(0.07, 1.7, 0.14), mats.hullDark, x, 2.3, z));
  }
  for (const z of [-3.5, 0.5, 4]) g.add(part(box(1.3, 0.22, 1.4), mats.hullDark, 0, 4.02, z));
  return g;
}

function buildTurretCar(mats, M, len) {
  const g = new THREE.Group();
  carBase(g, mats, len);
  g.add(part(crossExtrude(LOW_SECTION, len - 0.2), mats.hull));
  windowStrip(g, M.slits, len - 4, 2.3, 1.55, 0.18);
  const turret = new THREE.Group();
  turret.add(part(new THREE.CylinderGeometry(1.15, 1.3, 0.8, 20), mats.hull, 0, 0.4, 0));
  const dome = new THREE.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.55, 1);
  turret.add(part(dome, mats.hull, 0, 0.8, 0));
  const barrel = new THREE.CylinderGeometry(0.11, 0.14, 3.6, 10);
  barrel.rotateX(Math.PI / 2);
  for (const x of [-0.28, 0.28]) turret.add(part(barrel, mats.hullDark, x, 0.75, 2.4, -0.1, 0, 0));
  turret.position.set(0, 3.3, 2.6);
  const cupola = part(new THREE.CylinderGeometry(0.6, 0.7, 0.6, 14), mats.hull, 0, 3.6, -3.6);
  const merged = mergeByMaterial(g);
  merged.add(turret, cupola);
  merged.userData.turret = turret;
  return merged;
}

function buildCargo(mats, M, len) {
  const g = new THREE.Group();
  carBase(g, mats, len);
  g.add(part(box(3.0, 0.3, len - 0.2), mats.hullDark, 0, 1.55, 0));
  for (const x of [-1.5, 1.5]) g.add(part(box(0.12, 0.9, len - 0.2), mats.hull, x, 2.0, 0));
  const tarp = crossExtrude([[-1.3, 0], [1.3, 0], [1.3, 1.2], [0.9, 1.65], [-0.9, 1.65], [-1.3, 1.2]], 5.2, 0.12);
  for (const z of [-3.2, 3.2]) g.add(part(tarp, M.tarp, 0, 1.7, z));
  return g;
}

function buildGuard(mats, M, len) {
  const g = buildTroop(mats, M, len, 1);
  g.add(part(box(2.2, 0.9, 3.2), mats.hull, 0, 4.3, -3.6));
  windowStrip(g, M.windows[0], 2.6, 4.35, 1.1, 0.4, -3.6);
  for (const x of [-1.05, 1.05]) g.add(part(new THREE.CircleGeometry(0.15, 10), M.tail, x, 1.9, -len / 2 - 0.02, 0, Math.PI, 0));
  return g;
}

// ------------------------------------------------------------------ lights
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uStrength: { value: 0.12 }, uFacing: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        vAlong = 1.0 - uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uStrength;
      uniform float uFacing;   // 1 when looking straight down the beam: fade so it never blankets the frame
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() {
        // every term clamped: a NaN here would be smeared across the frame by bloom
        float ndv = clamp(abs(dot(normalize(vN + 1e-5), normalize(vV + 1e-5))), 0.0, 1.0);
        float a = clamp(vAlong, 0.0, 1.0);
        float fall = (1.0 - a) * (1.0 - a) * smoothstep(0.0, 0.06, a);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * (ndv * ndv * fall * uStrength * (1.0 - 0.85 * uFacing)), 1.0);
      }`,
  });
}

function poolMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 q = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float a = exp(-q.x * q.x * 3.0) * smoothstep(0.0, 0.12, q.y) * pow(1.0 - q.y, 1.4);
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * a * 0.55, 1.0);
      }`,
  });
}

function createHeadlightRig(flareTex) {
  const rig = new THREE.Group();
  rig.position.set(0, 3.12, 8.85);
  const spot = new THREE.SpotLight(0xfff0d8, 95, 160, 0.3, 0.55, 1.0);
  spot.position.set(0, 0, 0);
  const target = new THREE.Object3D();
  target.position.set(0, -2.6, 40);
  spot.target = target;
  rig.add(spot, target);
  const cone = new THREE.ConeGeometry(6.5, 60, 28, 1, true);
  cone.rotateX(-Math.PI / 2);
  cone.translate(0, 0, 30);
  const beam = new THREE.Mesh(cone, beamMaterial());
  beam.rotation.x = 0.045;
  beam.frustumCulled = false;
  rig.add(beam);
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flareTex, color: 0xfff2dc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  flare.position.set(0, 0, 0.35);
  flare.scale.set(7, 7, 1);
  rig.add(flare);
  return { rig, spot, beam, flare };
}

// ------------------------------------------------------------------ train
const BUILDERS = {
  loco: (mats, M) => buildLoco(mats, M),
  troop: (mats, M, len, i) => buildTroop(mats, M, len, i),
  turret: (mats, M, len) => buildTurretCar(mats, M, len),
  cargo: (mats, M, len) => buildCargo(mats, M, len),
  guard: (mats, M, len) => buildGuard(mats, M, len),
};

// Oxblood band with a stencilled running number; mirrored for the far side so
// the number reads front-to-back on both flanks.
function liveryMaterial(mirror) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 74;
  const ctx = c.getContext('2d');
  if (mirror) { ctx.translate(1024, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = '#6e1a16';
  ctx.fillRect(0, 10, 1024, 54);
  ctx.fillStyle = '#d9b16a';
  ctx.fillRect(0, 4, 1024, 5);
  ctx.fillRect(0, 65, 1024, 5);
  ctx.save();
  if (mirror) { ctx.translate(1024, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = '#f2e6cf';
  ctx.font = '700 46px "Arial Narrow", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('FL-07', mirror ? 60 : 820, 38);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return patchMaterial(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 }), { snow: 0 });
}

function trainMaterials() {
  const lit = (tex, intensity) => patchMaterial(new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: intensity, roughness: 0.4,
  }));
  const basic = (r, g, b, k) => patchMaterial(new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b).multiplyScalar(k) }), { lit: false });
  return {
    windows: [lit(makeWindowStripTexture(3), 2.6), lit(makeWindowStripTexture(8), 2.4), lit(makeWindowStripTexture(21), 2.8)],
    cabSide: lit(makeWindowStripTexture(5), 2.2),
    slits: lit(makeWindowStripTexture(9, false), 2.0),
    cabGlass: basic(1.0, 0.7, 0.4, 2.2),
    livery: liveryMaterial(false),
    liveryMirror: liveryMaterial(true),
    headLamp: basic(1.0, 0.96, 0.88, 8),
    marker: basic(1.0, 0.92, 0.8, 6),
    tail: basic(1.0, 0.05, 0.02, 8),
    tarp: patchMaterial(new THREE.MeshStandardMaterial({ color: 0x3b4033, roughness: 0.95 }), { snow: 0.6 }),
  };
}

export function createTrain(mats) {
  const M = trainMaterials();
  const flareTex = makeFlareTexture();
  const root = new THREE.Group();
  const units = UNIT_OFFSETS.map((u, i) => {
    let obj = BUILDERS[u.type](mats, M, u.length, i);
    if (!obj.userData.turret) obj = mergeByMaterial(obj);
    root.add(obj);
    return { ...u, obj, turret: obj.userData.turret || null, index: i };
  });
  const head = createHeadlightRig(flareTex);
  units[0].obj.add(head.rig);

  const tailFlares = [-1.05, 1.05].map((x) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: 0xff2010, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, 1.9, -UNIT_OFFSETS[UNIT_OFFSETS.length - 1].length / 2 - 0.3);
    s.scale.set(1.6, 1.6, 1);
    units[units.length - 1].obj.add(s);
    return s;
  });

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const lampWorld = new THREE.Vector3();
  const lampDir = new THREE.Vector3();

  function update(t, camera) {
    const nose = trainDistance(t);
    const speed = trainSpeed(t);
    for (const u of units) {
      const inset = Math.min(2.6, u.length * 0.2);
      const a = track.offsetPoint(nose - u.front - inset, 0, RAIL_TOP);
      const b = track.offsetPoint(nose - u.rear + inset, 0, RAIL_TOP);
      const sway = (speed / 35) * noise1(t * 1.7 + u.index * 3.1, 31) * 0.012;
      u.obj.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + Math.abs(sway) * 2, (a[2] + b[2]) / 2);
      u.obj.rotation.set(0, Math.atan2(a[0] - b[0], a[2] - b[2]), sway, 'YXZ');
      if (u.turret) u.turret.rotation.y = 0.5 * Math.sin(t * 0.21 + u.index) + (u.index % 2 ? 0.35 : -0.3);
    }
    root.updateMatrixWorld(true);
    // flare brightens when the lamp faces the camera
    head.flare.getWorldPosition(lampWorld);
    lampDir.set(0, 0, 1).transformDirection(units[0].obj.matrixWorld);
    tmpA.copy(camera.position).sub(lampWorld).normalize();
    const facing = Math.max(0, tmpA.dot(lampDir));
    head.flare.material.opacity = 0.75 * Math.pow(facing, 2);
    const s = 1.6 + 2.4 * Math.pow(facing, 4);
    head.beam.material.uniforms.uFacing.value = Math.pow(facing, 2);
    head.flare.scale.set(s, s, 1);
    tmpB.copy(camera.position).sub(tailFlares[0].getWorldPosition(tmpA)).normalize();
    for (const f of tailFlares) f.material.opacity = 0.35 + 0.65 * Math.max(0, -tmpB.dot(lampDir));
  }

  function headlight() {
    return { pos: lampWorld.clone(), dir: lampDir.clone() };
  }

  return { object: root, update, headlight, units };
}
