// Post chain: HDR render -> bloom -> ACES tone map -> film grade (vignette,
// split-tone, grain seeded by frame time, fades).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFade: { value: 1 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.45 },
    uAspect: { value: 9 / 16 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uFade, uGrain, uVignette, uAspect;
    varying vec2 vUv;
    float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect * 1.6, 1.0);
      float v = smoothstep(0.95, 0.25, length(q));
      c.rgb *= mix(1.0 - uVignette, 1.0, v);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += vec3(-0.012, 0.0, 0.03) * (1.0 - l) + vec3(0.025, 0.01, -0.015) * l;
      float g = h12(floor(vUv * vec2(720.0, 1280.0)) + floor(uTime * 24.0) * 1.37) - 0.5;
      c.rgb += g * uGrain * (1.0 - l * 0.6);
      c.rgb *= uFade;
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
};

export function createPost(renderer, scene, camera, bloomCfg) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), bloomCfg.strength, bloomCfg.radius, bloomCfg.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  return {
    render(t, fade) {
      grade.uniforms.uTime.value = t;
      grade.uniforms.uFade.value = fade;
      composer.render();
    },
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      bloom.resolution.set((w * dpr) / 2, (h * dpr) / 2);
      grade.uniforms.uAspect.value = w / h;
    },
    dispose() { composer.dispose(); target.dispose(); bloom.dispose(); },
  };
}
