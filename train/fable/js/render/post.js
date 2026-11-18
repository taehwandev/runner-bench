// Post-processing: HDR scene buffer, a small bloom pyramid, an anamorphic
// streak for the brightest lamps, then tone mapping, grade, vignette and
// grain. Grain is seeded by scene time, so a frame always looks the same.

import * as THREE from 'three';

const FS_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const DOWN_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
void main(){
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * uTexel;
    vec3 c = clamp(texture2D(tSrc, vUv + o).rgb, vec3(0.0), vec3(64.0));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    if (uThreshold > 0.0) c *= smoothstep(uThreshold, uThreshold * 2.4, l);
    float w = 1.0 / (1.0 + l * step(0.0001, uThreshold)); // tame single hot pixels
    sum += c * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
void main(){
  vec3 c = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb
         + texture2D(tSrc, vUv + vec2( 1.0, -1.0) * uTexel).rgb
         + texture2D(tSrc, vUv + vec2(-1.0,  1.0) * uTexel).rgb
         + texture2D(tSrc, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
  gl_FragColor = vec4(c * 0.25 + texture2D(tAdd, vUv).rgb, 1.0);
}
`;

const STREAK_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main(){
  vec3 c = vec3(0.0);
  float wsum = 0.0;
  for (int i = -8; i <= 8; i++) {
    float w = exp(-float(i * i) / 22.0);
    vec3 s = texture2D(tSrc, vUv + vec2(float(i) * 2.2 * uTexel.x, 0.0)).rgb;
    c += max(s - 0.6, 0.0) * w;
    wsum += w;
  }
  gl_FragColor = vec4(c / wsum, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tStreak;
uniform float uExposure;
uniform float uFade;
uniform float uSeed;
uniform vec2 uRes;

float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec2 ca = c * r2 * 0.004;
  vec3 hdr = vec3(texture2D(tScene, vUv + ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - ca).b);
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  vec3 streak = texture2D(tStreak, vUv).rgb;
  vec3 col = hdr + bloom * 0.12 + streak * vec3(0.45, 0.62, 1.0) * 0.16;
  col *= uExposure;
  col = aces(col);
  // grade: cool lifted shadows, warm highlights, a touch more contrast
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col * vec3(0.90, 0.98, 1.10) + vec3(0.004, 0.008, 0.018), 1.0 - smoothstep(0.0, 0.5, l));
  col = mix(col, col * vec3(1.06, 1.0, 0.92), smoothstep(0.4, 1.0, l));
  col = mix(vec3(l), col, 1.08);
  col = smoothstep(vec3(-0.02), vec3(1.02), col);
  col *= 1.0 - smoothstep(0.10, 0.62, r2) * 0.62;
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash(floor(vUv * uRes / max(uRes.y / 1280.0, 1.0)) + uSeed) - 0.5) * 0.035;
  gl_FragColor = vec4(col * uFade, 1.0);
}
`;

const LEVELS = 5;

function pass(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
}

/** Pick a render-target type the device can render into and filter. */
function targetType(renderer) {
  const gl2 = renderer.capabilities.isWebGL2;
  const float = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  return gl2 && float ? THREE.HalfFloatType : THREE.UnsignedByteType;
}

/**
 * Create the pipeline. render(scene, camera, { exposure, fade, seed }) draws a
 * finished frame to the canvas; setSize(w, h) takes drawing-buffer pixels.
 */
export function createPost(renderer) {
  const type = targetType(renderer);
  const opts = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  // dense screens already hide stair-steps, so they get the cheaper 2x multisampling
  const samples = (window.devicePixelRatio || 1) >= 2 ? 2 : 4;
  const sceneRT = new THREE.WebGLRenderTarget(4, 4, { type, samples, depthBuffer: true });
  const down = Array.from({ length: LEVELS }, () => new THREE.WebGLRenderTarget(4, 4, opts));
  const up = Array.from({ length: LEVELS - 1 }, () => new THREE.WebGLRenderTarget(4, 4, opts));
  const streakRT = new THREE.WebGLRenderTarget(4, 4, opts);

  const downMat = pass(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } });
  const upMat = pass(UP_FRAG, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const streakMat = pass(STREAK_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const finalMat = pass(FINAL_FRAG, {
    tScene: { value: sceneRT.texture }, tBloom: { value: null }, tStreak: { value: streakRT.texture },
    uExposure: { value: 1 }, uFade: { value: 1 }, uSeed: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), downMat);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function draw(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCam);
  }

  function setSize(w, h) {
    sceneRT.setSize(w, h);
    finalMat.uniforms.uRes.value.set(w, h);
    let lw = w, lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(2, Math.round(lw / 2));
      lh = Math.max(2, Math.round(lh / 2));
      down[i].setSize(lw, lh);
      if (i < LEVELS - 1) up[i].setSize(lw, lh);
      if (i === 2) streakRT.setSize(lw, lh);
    }
  }

  function bloom() {
    let src = sceneRT;
    for (let i = 0; i < LEVELS; i++) {
      downMat.uniforms.tSrc.value = src.texture;
      downMat.uniforms.uTexel.value.set(0.5 / src.width, 0.5 / src.height);
      downMat.uniforms.uThreshold.value = i === 0 ? 1.1 : 0;
      draw(downMat, down[i]);
      src = down[i];
    }
    let low = down[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      upMat.uniforms.tSrc.value = low.texture;
      upMat.uniforms.tAdd.value = down[i].texture;
      upMat.uniforms.uTexel.value.set(1.0 / low.width, 1.0 / low.height);
      draw(upMat, up[i]);
      low = up[i];
    }
    streakMat.uniforms.tSrc.value = down[2].texture;
    streakMat.uniforms.uTexel.value.set(1 / down[2].width, 1 / down[2].height);
    draw(streakMat, streakRT);
    finalMat.uniforms.tBloom.value = up[0].texture;
  }

  function render(scene, camera, look) {
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);
    bloom();
    finalMat.uniforms.uExposure.value = look.exposure;
    finalMat.uniforms.uFade.value = look.fade;
    finalMat.uniforms.uSeed.value = look.seed;
    draw(finalMat, null);
  }

  function dispose() {
    [sceneRT, streakRT, ...down, ...up].forEach((t) => t.dispose());
    [downMat, upMat, streakMat, finalMat].forEach((m) => m.dispose());
    quad.geometry.dispose();
  }

  return { setSize, render, dispose };
}
