// Steam, smoke and thrown snow. Every puff is a pure function of time: its
// birth time comes from its index, and its position from where the train was
// at that birth time. Seeking to any time therefore reproduces the same cloud.

import * as THREE from 'three';
import { hash1, hash2, clamp, lerp, smoothstep } from '../core/rng.js';
import { trainAt } from '../core/timeline.js';
import { VEHICLES, vehiclePose, localToWorld } from '../core/consist.js';
import { LAYOUT } from '../core/layout.js';
import { TIMES, WHISTLES, WIND } from '../config.js';
import { ATMO_GLSL, atmoUniforms } from './atmosphere.js';
import { LOCO_POINTS } from './vehicles.js';
import { puffTexture } from './textures.js';

const WHEEL_BEAT = (2 * Math.PI * LOCO_POINTS.driverRadius) / 4;
const WHITE = [0.82, 0.86, 0.95];
const LAST = VEHICLES.length - 1;

const pulse = (t, a, b, edge = 0.4) => smoothstep(a, a + edge, t) * (1 - smoothstep(b - edge, b, t));

function whistling(t) {
  for (const w of WHISTLES) if (t >= w.t && t < w.t + w.d) return 1;
  return 0;
}

// One entry per effect. rate(t, train) is the chance a puff is emitted.
const EMITTERS = [
  {
    id: 'stack', vehicle: () => 0, at: LOCO_POINTS.stack, count: 260, life: 4.8,
    rate: (t, s) => (s.speed < 0.5 ? 0.3 : (s.distance / WHEEL_BEAT) % 1 < 0.5 ? 1 : 0.3),
    up: [6, 9.5], out: [0, 0.8], inherit: 0.42, drag: 1.5, rise: 1.7, gravity: 0,
    size: [0.8, 6.2], alpha: 0.62, young: [1.0, 0.72, 0.5], old: [0.5, 0.55, 0.68],
  },
  {
    id: 'stack2', vehicle: () => 0, at: LOCO_POINTS.stack2, count: 50, life: 3,
    rate: () => 0.7, up: [3, 5], out: [0, 0.5], inherit: 0.5, drag: 1.8, rise: 1.4, gravity: 0,
    size: [0.5, 4.5], alpha: 0.4, young: WHITE, old: WHITE,
  },
  {
    id: 'cocks', vehicle: () => 0, at: LOCO_POINTS.cocks, mirror: true, count: 70, life: 1.9,
    rate: (t) => Math.max(0.6 * pulse(t, TIMES.stop - 0.9, TIMES.stop + 1.2), 0.95 * pulse(t, TIMES.depart - 0.5, TIMES.depart + 3.4)),
    up: [0.4, 2], out: [5, 9], inherit: 0.75, drag: 2.2, rise: 1.3, gravity: 0,
    size: [0.5, 4.6], alpha: 0.55, young: WHITE, old: WHITE,
  },
  {
    id: 'brakes', vehicle: (k) => 1 + (k % (LAST - 1)), at: [1.5, 0.5, 4.6], mirror: true, bothEnds: true, count: 90, life: 3.2,
    rate: (t) => 0.7 * pulse(t, TIMES.stop - 1.6, TIMES.depart - 0.4, 1.2),
    up: [0.2, 1], out: [1, 3], inherit: 0.8, drag: 1.6, rise: 0.8, gravity: 0,
    size: [0.6, 4], alpha: 0.32, young: WHITE, old: WHITE,
  },
  {
    id: 'whistle', vehicle: () => 0, at: LOCO_POINTS.whistle, count: 36, life: 1.4,
    rate: (t) => whistling(t), up: [12, 16], out: [0, 0.6], inherit: 0.6, drag: 2.4, rise: 1.5, gravity: 0,
    size: [0.3, 2.8], alpha: 0.7, young: WHITE, old: WHITE,
  },
  {
    id: 'plough', vehicle: () => 0, at: LOCO_POINTS.plough, mirror: true, count: 110, life: 1.5,
    rate: (t, s) => clamp((s.speed - 3) / 25, 0, 1),
    up: [2, 5], out: [2.5, 6], inherit: 0.82, drag: 1.3, rise: 0, gravity: 8,
    size: [0.4, 2.6], alpha: 0.22, young: [1.15, 1.1, 1.0], old: WHITE,
  },
  {
    id: 'wake', vehicle: () => LAST, at: [0.9, 1.0, -7.6], mirror: true, count: 80, life: 2.6,
    rate: (t, s) => clamp(s.speed / 30, 0, 1),
    up: [0.5, 2.2], out: [0, 2], inherit: 0.3, drag: 1.2, rise: 0.3, gravity: 0,
    size: [1.2, 7], alpha: 0.22, young: WHITE, old: WHITE,
  },
];

const TOTAL = EMITTERS.reduce((n, e) => n + e.count, 0);

const VERT = /* glsl */ `
attribute vec4 aPosSize;
attribute vec4 aColor;
attribute float aRot;
varying vec2 vUv;
varying vec4 vColor;
varying vec3 vView;
void main(){
  vec4 mv = viewMatrix * vec4(aPosSize.xyz, 1.0);
  float c = cos(aRot), s = sin(aRot);
  vec2 corner = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
  mv.xy += corner * aPosSize.w;
  vUv = uv;
  vColor = aColor;
  vColor.rgb *= 0.74 + 0.36 * corner.y; // lit from above, shadowed underneath
  vColor.a *= smoothstep(1.5, 11.0, -mv.z);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vColor;
varying vec3 vView;
${ATMO_GLSL}
void main(){
  float a = texture2D(uMap, vUv).a * vColor.a;
  if (a < 0.003) discard;
  gl_FragColor = vec4(atmoApply(vColor.rgb, vView), a);
}
`;

function buildMesh() {
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  const posSize = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const rot = new THREE.InstancedBufferAttribute(new Float32Array(TOTAL), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPosSize', posSize);
  geo.setAttribute('aColor', color);
  geo.setAttribute('aRot', rot);
  const material = new THREE.ShaderMaterial({
    uniforms: { ...atmoUniforms, uMap: { value: puffTexture() } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  return { mesh, geo, posSize, color, rot };
}

const _pose = {};
const _p = {};

/** Fill `out` (x, y, z, size, r, g, b, a, rot, depth) for puff k of an emitter; false if not alive. */
function simulate(e, ei, k, t, light, out) {
  const offset = ((k + hash1(k * 1.31 + ei * 7.7)) / e.count) * e.life;
  const cycle = Math.floor((t - offset) / e.life);
  const born = cycle * e.life + offset;
  const age = t - born;
  const key = k + ei * 1000;
  const state = trainAt(born);
  if (hash2(key, cycle) >= e.rate(born, state)) return false;
  const r1 = hash2(key + 0.37, cycle), r2 = hash2(key + 0.71, cycle), r3 = hash2(key + 0.13, cycle);
  const side = e.mirror ? (k & 1 ? 1 : -1) : r3 < 0.5 ? 1 : -1;
  vehiclePose(state.distance, VEHICLES[e.vehicle(k)], _pose);
  localToWorld(_pose, e.at[0] * (e.mirror ? side : 1), e.at[1], e.at[2] * (e.bothEnds && (k >> 1) % 2 ? -1 : 1), _p);
  const fwd = state.speed * e.inherit;
  const out_ = lerp(e.out[0], e.out[1], r2) * side;
  const vx = _pose.fx * fwd + _pose.fz * out_;
  const vz = _pose.fz * fwd - _pose.fx * out_;
  const vy = lerp(e.up[0], e.up[1], r1);
  const g = (1 - Math.exp(-e.drag * age)) / e.drag;
  const u = age / e.life;
  const wob = age * 0.55;
  out.x = _p.x + vx * g + WIND[0] * (age - g) + Math.sin(r1 * 40 + age * 1.7) * wob;
  out.y = _p.y + vy * g + e.rise * age - 0.5 * e.gravity * age * age + Math.sin(r2 * 40 + age * 1.3) * wob * 0.5;
  out.z = _p.z + vz * g + WIND[2] * (age - g) + Math.cos(r3 * 40 + age * 1.5) * wob;
  const girth = 0.55 + 0.45 * Math.min(1, state.speed / 20); // a standing engine makes a thin column
  out.size = lerp(e.size[0], e.size[1], Math.pow(u, 0.6)) * (0.8 + 0.4 * r3) * girth;
  // steam cannot rise through the tunnel roof: it pools under it
  const inside = out.z < LAYOUT.block.zNear && out.z > LAYOUT.block.zFar;
  if (inside) out.y = Math.min(out.y, LAYOUT.tunnel.ceilY - out.size * 0.35);
  const shade = inside ? 0.2 : light;
  const mix = smoothstep(0, 0.35, u);
  out.r = lerp(e.young[0], e.old[0], mix) * shade;
  out.g = lerp(e.young[1], e.old[1], mix) * shade;
  out.b = lerp(e.young[2], e.old[2], mix) * shade;
  out.a = e.alpha * smoothstep(0, 0.06, u) * Math.pow(1 - u, 1.4);
  out.rot = r1 * 6.283 + age * (r2 - 0.5) * 0.9;
  return true;
}

/** Create the steam system. update(t, camera, night) refills the buffers. */
export function createSteam() {
  const { mesh, geo, posSize, color, rot } = buildMesh();
  const slots = Array.from({ length: TOTAL }, () => ({}));
  const order = [];
  const fwd = new THREE.Vector3();

  function update(t, camera, night) {
    camera.getWorldDirection(fwd);
    const cam = camera.position;
    const light = 0.62 - 0.36 * night;
    order.length = 0;
    let n = 0;
    EMITTERS.forEach((e, ei) => {
      for (let k = 0; k < e.count; k++) {
        const slot = slots[n];
        if (!simulate(e, ei, k, t, light, slot)) continue;
        slot.depth = (slot.x - cam.x) * fwd.x + (slot.y - cam.y) * fwd.y + (slot.z - cam.z) * fwd.z;
        order.push(slot);
        n++;
      }
    });
    order.sort((a, b) => b.depth - a.depth);
    for (let i = 0; i < n; i++) {
      const s = order[i];
      posSize.setXYZW(i, s.x, s.y, s.z, s.size);
      color.setXYZW(i, s.r, s.g, s.b, s.a);
      rot.setX(i, s.rot);
    }
    geo.instanceCount = n;
    posSize.needsUpdate = color.needsUpdate = rot.needsUpdate = true;
  }

  return { mesh, update };
}
