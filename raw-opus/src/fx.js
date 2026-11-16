import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { R } from './models.js';

// ---------- particles (single draw call) ----------
export class Particles {
  constructor(scene, N = 700) {
    this.N = N;
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.size = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.max = new Float32Array(N);
    this.grav = new Float32Array(N);
    this.world = new Uint8Array(N);
    this.s0 = new Float32Array(N);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: R.glowTex }, uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = min(size * uScale / max(0.5, -mv.z), 70.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ float a = texture2D(map, gl_PointCoord).r * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
  }
  emit(x, y, z, { n = 10, color = [1, 1, 1], speed = 4, up = 2, life = 0.7, size = 0.3, grav = 9, world = true, spread = 1, dir = null } = {}) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.N;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.3 * spread;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3 * spread;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3 * spread;
      const a = Math.random() * Math.PI * 2, b = Math.random() * 2 - 1, sp = speed * (0.4 + Math.random() * 0.6);
      const sq = Math.sqrt(1 - b * b);
      this.vel[i * 3] = Math.cos(a) * sq * sp + (dir ? dir[0] : 0);
      this.vel[i * 3 + 1] = b * sp * 0.6 + up * Math.random() + (dir ? dir[1] : 0);
      this.vel[i * 3 + 2] = Math.sin(a) * sq * sp + (dir ? dir[2] : 0);
      const c = Array.isArray(color[0]) ? color[Math.floor(Math.random() * color.length)] : color;
      this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
      this.s0[i] = size * (0.6 + Math.random() * 0.8);
      this.grav[i] = grav; this.world[i] = world ? 1 : 0;
    }
  }
  update(dt, scroll) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + (this.world[i] ? scroll : 0);
      this.alpha[i] = f;
      this.size[i] = this.s0[i] * (0.4 + f * 0.6);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

// ---------- post-processing ----------
const FXShader = {
  uniforms: {
    tDiffuse: { value: null }, uCA: { value: 0 }, uVig: { value: 1.0 }, uTint: { value: new THREE.Vector3(0, 0, 0) },
    uTime: { value: 0 }, uRadial: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uCA; uniform float uVig; uniform vec3 uTint; uniform float uTime; uniform float uRadial;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - vec2(0.5, 0.55);
      float r2 = dot(c,c);
      vec2 off = c * (uCA * 0.012 + r2 * 0.004);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      if (uRadial > 0.001) {
        vec3 acc = col;
        for (int i=1;i<4;i++){ acc += texture2D(tDiffuse, vUv - c * float(i) * 0.012 * uRadial).rgb; }
        col = mix(col, acc * 0.25, smoothstep(0.02, 0.15, r2));
      }
      col += uTint * (0.35 + r2 * 2.0);
      col *= 1.0 - uVig * smoothstep(0.12, 0.55, r2) * 0.75;
      // scanline shimmer, very light
      col *= 0.985 + 0.015 * sin(vUv.y * 900.0 + uTime * 8.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const size = renderer.getSize(new THREE.Vector2());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.62, 0.42, 0.82);
    this.composer.addPass(this.bloom);
    this.fx = new ShaderPass(FXShader);
    this.composer.addPass(this.fx);
    this.composer.addPass(new OutputPass());
    this.setBloom(quality.bloom);
  }
  setBloom(on) { this.bloom.enabled = on; }
  setSize(w, h, dpr) {
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    // bloom at reduced resolution keeps it cheap on phones
    this.bloom.setSize(Math.floor(w * dpr / 2), Math.floor(h * dpr / 2));
  }
  render() { this.composer.render(); }
}
