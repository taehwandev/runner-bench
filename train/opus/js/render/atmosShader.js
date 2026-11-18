// Shared height-fog / mist / sunset-tint model used by every material, so the
// sky, city, train and particles all fade into the same air.

import * as THREE from 'three';

export const atmosUniforms = {
  uFogColor: { value: new THREE.Color() },
  uFogDensity: { value: 0.0017 },
  uSunDir: { value: new THREE.Vector3(-1, 0, 0) },
  uSunGlow: { value: new THREE.Color() },
  uMistColor: { value: new THREE.Color() },
  uMistAmount: { value: 0.4 },
  uTime: { value: 0 },
};

export const ATMOS_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
uniform vec3 uSunGlow;
uniform vec3 uMistColor;
uniform float uMistAmount;
uniform float uTime;

float atmosFogFactor(vec3 wp) {
  float dist = length(wp - cameraPosition);
  float h = mix(1.0, 0.42, smoothstep(20.0, 340.0, wp.y));
  float x = uFogDensity * dist * h;
  return 1.0 - exp(-x * x);
}
vec3 atmosFogColor(vec3 dir) {
  float s = max(dot(dir, uSunDir), 0.0);
  return uFogColor + uSunGlow * (pow(s, 6.0) * 0.55 + s * s * 0.08);
}
vec3 applyAtmos(vec3 col, vec3 wp) {
  vec3 v = wp - cameraPosition;
  float dist = length(v);
  vec3 dir = v / max(dist, 1e-3);
  col = mix(col, atmosFogColor(dir), atmosFogFactor(wp));
  float m = exp(-max(wp.y, 0.0) / 12.0) * (1.0 - exp(-dist * 0.005)) * uMistAmount;
  return mix(col, uMistColor, clamp(m, 0.0, 0.88));
}
`;

// Patch a built-in lit material: shared fog + optional snow on up-facing surfaces.
export function patchMaterial(material, { snow = 0, lit = true } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, atmosUniforms);
    shader.uniforms.uSnowAmt = { value: snow };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtmosWP;\nvarying vec3 vAtmosN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 awp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            awp = instanceMatrix * awp;
          #endif
          vAtmosWP = (modelMatrix * awp).xyz;
          ${lit ? `vec3 an = objectNormal;
          #ifdef USE_INSTANCING
            an = mat3(instanceMatrix) * an;
          #endif
          vAtmosN = normalize(mat3(modelMatrix) * an);` : 'vAtmosN = vec3(0.0, 1.0, 0.0);'}
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAtmosWP;\nvarying vec3 vAtmosN;\nuniform float uSnowAmt;\n${ATMOS_GLSL}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.88, 0.97), smoothstep(0.45, 0.8, vAtmosN.y) * uSnowAmt);`,
      )
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyAtmos(gl_FragColor.rgb, vAtmosWP);');
  };
  material.customProgramCacheKey = () => `atmos-${lit ? 1 : 0}`;
  return material;
}

export function updateAtmosUniforms(atm, t) {
  atmosUniforms.uFogColor.value.setRGB(...atm.fog);
  atmosUniforms.uFogDensity.value = atm.fogDensity;
  atmosUniforms.uSunDir.value.set(...atm.sunDir);
  atmosUniforms.uSunGlow.value.setRGB(...atm.sunGlow).multiplyScalar(atm.sunGlowAmt);
  atmosUniforms.uMistColor.value.setRGB(...atm.mist);
  atmosUniforms.uTime.value = t;
}
