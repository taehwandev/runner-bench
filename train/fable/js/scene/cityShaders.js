// Shaders for the city: one instanced tower material with procedural lit
// windows, snow caps and frost, and one ground material for the buried streets
// and the frozen river.

import * as THREE from 'three';
import { ATMO_GLSL, NOISE_GLSL, atmoUniforms } from './atmosphere.js';

const TOWER_VERT = /* glsl */ `
attribute vec3 aSize;
attribute vec4 aInfo; // seed, lit fraction, base height (m), unused
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorld;
varying vec3 vView;
varying vec4 vInfo;
varying vec3 vSize;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vObj = position * aSize;
  vObjN = normal;
  vWorldN = normalize(mat3(instanceMatrix) * normal);
  vWorld = wp.xyz;
  vInfo = aInfo;
  vSize = aSize;
  vec4 mv = viewMatrix * wp;
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const TOWER_FRAG = /* glsl */ `
varying vec3 vObj;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorld;
varying vec3 vView;
varying vec4 vInfo;
varying vec3 vSize;
${NOISE_GLSL}
${ATMO_GLSL}

vec3 skyLight(vec3 n){
  vec3 sky = mix(vec3(0.20, 0.25, 0.42), vec3(0.045, 0.06, 0.12), uNight);
  vec3 ground = mix(vec3(0.050, 0.050, 0.070), vec3(0.020, 0.022, 0.034), uNight);
  vec3 l = mix(ground, sky, n.y * 0.5 + 0.5);
  l += vec3(1.0, 0.50, 0.30) * max(dot(n, ATMO_GLOW), 0.0) * mix(0.55, 0.05, uNight);
  l += vec3(0.30, 0.38, 0.60) * max(dot(n, ATMO_MOON), 0.0) * (0.05 + 0.17 * uNight);
  return l;
}

void main(){
  vec3 n = normalize(vWorldN);
  float seed = vInfo.x;
  vec3 light = skyLight(n);
  vec3 col;
  if (vObjN.y > 0.5) {
    // roof: deep snow
    float drift = 0.85 + 0.15 * vnoise(vWorld.xz * 0.12);
    col = vec3(0.70, 0.76, 0.88) * drift * light;
  } else {
    vec2 m = abs(vObjN.x) > 0.5 ? vec2(vObj.z, vObj.y) : vec2(vObj.x, vObj.y);
    float bay = mix(2.6, 4.4, hash11(seed * 3.7));
    float flr = mix(3.3, 4.3, hash11(seed * 5.1));
    vec2 g = vec2(m.x / bay + hash11(seed) * 9.0, (m.y + vInfo.z) / flr);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float rnd = hash21(id + seed * 13.0);
    float floorR = hash21(vec2(id.y * 0.37, seed * 7.0));
    float colR = hash21(vec2(id.x * 0.71, seed * 3.0));
    float litP = clamp(vInfo.y * (0.2 + 1.7 * floorR * floorR) * (0.45 + 1.1 * colR), 0.0, 0.92);
    float lit = step(1.0 - litP, rnd);
    vec2 w = smoothstep(vec2(0.12, 0.20), vec2(0.18, 0.27), f) * (1.0 - smoothstep(vec2(0.82, 0.74), vec2(0.88, 0.81), f));
    float mask = w.x * w.y;
    float aa = max(fwidth(g.x), fwidth(g.y));
    float lod = smoothstep(0.14, 0.55, aa); // windows melt into an average before they can alias

    // wall and cold glass
    vec3 base = mix(vec3(0.060, 0.068, 0.088), vec3(0.115, 0.118, 0.135), hash11(seed * 2.3));
    vec3 viewDir = normalize(vWorld - cameraPosition);
    vec3 refl = atmoSky(reflect(viewDir, n) * vec3(1.0, 0.6, 1.0) + vec3(0.0, 0.25, 0.0));
    float fres = 0.25 + 0.75 * pow(1.0 - max(dot(-viewDir, n), 0.0), 3.0);
    vec3 wall = base * light;
    vec3 glass = refl * fres * 0.55 + base * light * 0.25;
    col = mix(wall, glass, mix(mask, 0.34, lod));

    // snow on ledges, frost creeping from the parapet, drifts at the foot
    float ledge = step(f.y, 0.10) * step(0.72, hash21(vec2(id.y, seed * 1.3))) * (1.0 - lod);
    float frost = smoothstep(vSize.y - 9.0, vSize.y, m.y) * (0.55 + 0.45 * vnoise(vec2(m.x * 0.6, seed)));
    float foot = smoothstep(26.0, 0.0, vWorld.y) * 0.8;
    vec3 snow = vec3(0.66, 0.72, 0.86) * light;
    col = mix(col, snow, clamp(ledge * 0.85 + frost * 0.6 + foot, 0.0, 1.0));

    // lit windows
    float tintSel = hash11(seed * 9.1);
    vec3 warm = mix(vec3(1.0, 0.56, 0.22), vec3(1.0, 0.80, 0.52), hash21(id + 1.7));
    vec3 wcol = tintSel > 0.80 ? vec3(0.55, 0.80, 1.0) : warm;
    wcol = mix(wcol, vec3(1.0, 0.22, 0.34), step(0.988, hash21(id + 9.3)));
    float bright = 0.5 + 1.7 * hash21(id + 4.2);
    float blind = mix(0.35, 1.0, step(f.y, 0.36 + 0.6 * hash21(id + 6.1)));
    float near = lit * mask * blind * bright;
    float far = litP * 0.30 * 1.6;
    col += wcol * mix(near, far, lod) * 1.5;
  }
  col = atmoApply(col, vView);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createTowerMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: atmoUniforms,
    vertexShader: TOWER_VERT,
    fragmentShader: TOWER_FRAG,
    fog: false,
  });
}

const GROUND_VERT = /* glsl */ `
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

const GROUND_FRAG = /* glsl */ `
varying vec3 vWorld;
varying vec3 vView;
uniform vec2 uRiver; // zNear, zFar
${NOISE_GLSL}
${ATMO_GLSL}
void main(){
  vec2 p = vWorld.xz;
  vec3 sky = mix(vec3(0.20, 0.25, 0.42), vec3(0.045, 0.06, 0.12), uNight);
  vec3 light = sky + vec3(1.0, 0.5, 0.3) * 0.10 * (1.0 - uNight);
  float drift = fbm(p * 0.018);
  vec3 col = vec3(0.62, 0.68, 0.82) * (0.62 + 0.55 * drift) * light;

  // streets: dark cuts through the drifts with a lamp at each crossing
  vec2 gp = p / 96.0;
  vec2 gf = abs(fract(gp) - 0.5);
  float street = 1.0 - smoothstep(0.045, 0.075, min(gf.x, gf.y));
  col = mix(col, col * 0.42, street * 0.8);
  vec2 lampCell = floor(gp * 2.0);
  vec2 lf = fract(gp * 2.0) - 0.5;
  float lampOn = step(0.45, hash21(lampCell));
  col += vec3(1.0, 0.62, 0.30) * exp(-dot(lf, lf) * 90.0) * lampOn * 0.9;

  // frozen river under the bridge
  float river = smoothstep(uRiver.x + 50.0, uRiver.x - 30.0, p.y) * smoothstep(uRiver.y - 50.0, uRiver.y + 30.0, p.y);
  vec3 viewDir = normalize(vWorld - cameraPosition);
  vec3 refl = atmoSky(reflect(viewDir, vec3(0.0, 1.0, 0.0)));
  float fres = 0.06 + 0.94 * pow(1.0 - max(-viewDir.y, 0.0), 4.0);
  float crack = smoothstep(0.035, 0.0, abs(fbm(p * 0.012 + 3.0) - 0.5));
  float patches = smoothstep(0.50, 0.66, fbm(p * 0.006 + 11.0));
  vec3 ice = vec3(0.012, 0.022, 0.040) + refl * fres * 0.8 + vec3(0.25, 0.32, 0.42) * crack * light;
  ice = mix(ice, vec3(0.60, 0.67, 0.82) * light * (0.7 + 0.4 * drift), patches * 0.85);
  col = mix(col, ice, river);

  col = atmoApply(col, vView);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createGroundMaterial(river) {
  return new THREE.ShaderMaterial({
    uniforms: { ...atmoUniforms, uRiver: { value: new THREE.Vector2(river.zNear, river.zFar) } },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    fog: false,
  });
}
