// The tunnel through the tower block: a concrete core with two portals and a
// lit interior. The interior has its own shader because no sky light reaches
// it: it is lit only by its rib lights and by the locomotive's headlight.

import * as THREE from 'three';
import { LAYOUT } from '../core/layout.js';
import { TRACK } from '../config.js';
import { ATMO_GLSL, NOISE_GLSL, atmoUniforms } from './atmosphere.js';
import { MeshBuilder } from './geo.js';
import { signTexture } from './textures.js';

const CONCRETE = [0.15, 0.16, 0.19];
const TRIM = [0.24, 0.255, 0.29];
const SNOW = [0.8, 0.85, 0.95];
const AMBER = [3.4, 1.7, 0.45];
const SLIT = [1.8, 1.2, 0.6];

export const RIB_SPACING = 15;

const { block, tunnel } = LAYOUT;
const HW = tunnel.halfWidth;
const FLOOR = TRACK.railY - 1.7;

const INTERIOR_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vView;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const INTERIOR_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec3 vView;
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
uniform vec3 uTunnel; // zNear, rail y, ceiling y
${NOISE_GLSL}
${ATMO_GLSL}
void main(){
  float along = (uTunnel.x - vWorld.z) / ${RIB_SPACING.toFixed(1)};
  float fr = fract(along);
  float ribDist = min(fr, 1.0 - fr) * ${RIB_SPACING.toFixed(1)};
  float h = vWorld.y - uTunnel.y;
  float onWall = step(vWorld.y, uTunnel.z - 0.02);
  float rib = (1.0 - smoothstep(0.16, 0.28, ribDist)) * mix(1.0, step(0.9, h), onWall);
  float line = (1.0 - smoothstep(0.05, 0.11, abs(h - 4.7))) * onWall;
  float panel = step(0.04, fract(vWorld.z / 3.0)) * step(0.03, fract(h / 2.6));
  vec3 conc = vec3(0.105, 0.11, 0.125) * (0.55 + 0.6 * fbm(vec2(vWorld.z * 0.35, h * 0.5 + vWorld.x))) * (0.72 + 0.28 * panel);
  float damp = smoothstep(2.2, 0.0, h) * 0.5;
  conc *= 1.0 - damp;

  vec3 ribCol = vec3(0.70, 0.92, 1.0);
  vec3 lineCol = vec3(1.0, 0.58, 0.22);
  float wash = exp(-ribDist * 0.36) * 1.5 + 0.08;
  float lineWash = exp(-abs(h - 4.7) * 0.9) * 0.9 * onWall;

  vec3 L = vWorld - uHeadPos;
  float d = length(L);
  float cone = smoothstep(0.78, 0.975, dot(L / d, uHeadDir));
  vec3 head = vec3(1.0, 0.90, 0.72) * cone * 240.0 / (d * d + 160.0);

  vec3 col = conc * (ribCol * wash + lineCol * lineWash + head);
  col += ribCol * rib * 3.4 + lineCol * line * 3.0;
  col = atmoApply(col, vView);
  gl_FragColor = vec4(col, 1.0);
}
`;

function buildInterior(uniforms) {
  const zA = block.zNear;
  const zB = block.zFar;
  const y0 = tunnel.floorY;
  const y1 = tunnel.ceilY - 0.06;
  const b = new MeshBuilder();
  const c = [1, 1, 1];
  // the lining sits just inside the concrete so the two never share a plane
  const w = HW - 0.06;
  b.quad([-w, y0, zA], [-w, y0, zB], [-w, y1, zB], [-w, y1, zA], c);
  b.quad([w, y0, zB], [w, y0, zA], [w, y1, zA], [w, y1, zB], c);
  b.quad([-w, y1, zA], [-w, y1, zB], [w, y1, zB], [w, y1, zA], c);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...atmoUniforms,
      uHeadPos: uniforms.headPos,
      uHeadDir: uniforms.headDir,
      uTunnel: { value: new THREE.Vector3(zA, TRACK.railY, y1) },
    },
    vertexShader: INTERIOR_VERT,
    fragmentShader: INTERIOR_FRAG,
    fog: false,
  });
  return new THREE.Mesh(b.build(), material);
}

/** Solid concrete around the bore, between the two glass wings. */
function buildCore(b) {
  const zc = (block.zNear + block.zFar) / 2;
  const depth = block.zNear - block.zFar;
  const core = block.coreHalfWidth;
  const sideW = core - HW;
  const coreH = block.coreTopY - FLOOR;
  for (const side of [-1, 1]) {
    b.box(side * (HW + sideW / 2), FLOOR + coreH / 2, zc, sideW, coreH, depth, CONCRETE);
  }
  const lintelH = block.coreTopY - tunnel.ceilY;
  b.box(0, tunnel.ceilY + lintelH / 2, zc, HW * 2, lintelH, depth, CONCRETE);
}

/** Portal dressing on one face. dir = +1 for the entry (faces +Z), -1 for the exit. */
function buildPortal(b, glow, glows, z, dir) {
  const out = z + dir * 0.9;
  const top = tunnel.ceilY;
  for (const side of [-1, 1]) {
    b.box(side * (HW + 1.2), (FLOOR + top + 2.4) / 2, out, 2.4, top + 2.4 - FLOOR, 1.8, TRIM, SNOW);
    glow.box(side * (HW + 0.02), TRACK.railY + 3.8, z + dir * 0.4, 0.1, 6.6, 0.24, AMBER);
    glows.add(side * (HW + 2.4), top + 3.6, z + dir * 2.2, [3.0, 1.5, 0.3], 2.2, 0.8, side > 0 ? 0 : 0.5);
  }
  b.box(0, top + 1.2, out, HW * 2 + 4.8, 2.4, 1.8, TRIM, SNOW);
  glow.box(0, top - 0.05, z + dir * 0.4, HW * 2, 0.1, 0.24, AMBER);
  // ventilation slits and service lights give the core a human scale
  for (let row = 0; row < 2; row++) {
    for (let i = -6; i <= 6; i++) {
      if (Math.abs(i) < 2) continue;
      if ((i * 7 + row * 3) % 4 === 0) continue;
      glow.box(i * 4.1, top + 6.2 + row * 3.4, z + dir * 0.06, 2.2, 0.5, 0.06, SLIT);
    }
  }
}

function buildSign(z, dir) {
  const mat = new THREE.MeshBasicMaterial({ map: signTexture('SECTOR 07', 'NORTH BORE  ·  CLEARANCE 8 M'), color: new THREE.Color(1.5, 1.5, 1.5) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.25), mat);
  sign.position.set(0, tunnel.ceilY + 4.3, z + dir * 1.86);
  sign.rotation.y = dir > 0 ? 0 : Math.PI;
  return sign;
}

/**
 * Build the tunnel. `uniforms.headPos` / `uniforms.headDir` are shared
 * { value: Vector3 } objects owned by the train's headlight.
 */
export function createTunnel(glows, uniforms) {
  const solid = new MeshBuilder();
  const glow = new MeshBuilder();
  buildCore(solid);
  buildPortal(solid, glow, glows, block.zNear, 1);
  buildPortal(solid, glow, glows, block.zFar, -1);
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(solid.build(), new THREE.MeshLambertMaterial({ vertexColors: true })),
    new THREE.Mesh(glow.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })),
    buildInterior(uniforms),
    buildSign(block.zNear, 1),
    buildSign(block.zFar, -1),
  );
  return { group };
}
