// Static light glows (lamps, beacons, signals) drawn as one instanced batch of
// soft additive billboards. Halos widen and dim with the fog between the lamp
// and the camera. Blinking is a pure function of time.

import * as THREE from 'three';
import { ATMO_GLSL, atmoUniforms } from './atmosphere.js';

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aColor;
attribute vec3 aParams; // size (m), blink rate (Hz, 0 = steady), blink phase
uniform float uTime;
varying vec2 vUv;
varying vec3 vColor;
${ATMO_GLSL}
void main(){
  vec4 mv = viewMatrix * vec4(aPos, 1.0);
  float dist = length(mv.xyz);
  vec3 dir = normalize((vec4(mv.xyz, 0.0) * viewMatrix).xyz);
  float fogA = atmoFogAmount(cameraPosition.y, dir, dist);
  float blink = 1.0;
  if (aParams.y > 0.0) {
    float ph = fract(uTime * aParams.y + aParams.z);
    blink = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.22, 0.5, ph));
  }
  float size = max(aParams.x * (1.0 + 2.2 * fogA), dist * 0.0022);
  mv.xy += position.xy * size;
  mv.z += min(size, 1.2);
  vUv = position.xy;
  vColor = aColor * blink * pow(1.0 - fogA, 0.65);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vColor;
void main(){
  float r = length(vUv);
  float a = exp(-r * r * 11.0) + 0.20 * exp(-r * 3.6);
  a *= 1.0 - smoothstep(0.65, 1.0, r);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

/** Collects glow points, then builds one mesh. */
export class GlowList {
  constructor() {
    this.items = [];
  }

  add(x, y, z, color, size, rate = 0, phase = 0) {
    this.items.push(x, y, z, color[0], color[1], color[2], size, rate, phase);
  }

  build() {
    const n = this.items.length / 9;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const par = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        pos[i * 3 + k] = this.items[i * 9 + k];
        col[i * 3 + k] = this.items[i * 9 + 3 + k];
        par[i * 3 + k] = this.items[i * 9 + 6 + k];
      }
    }
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 3));
    geo.instanceCount = n;
    const material = new THREE.ShaderMaterial({
      uniforms: atmoUniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    return mesh;
  }
}
