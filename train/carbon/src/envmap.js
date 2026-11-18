import * as THREE from "three";

// Generates a procedural winter dusk/moonlight PMREM environment map so PBR
// metallic armor, rails, bridge steel, and ice catch realistic sky reflections
// instead of reflecting black.
export function createWinterEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(50, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 ground = vec3(0.14, 0.19, 0.28);
        vec3 horizonWarm = vec3(0.72, 0.46, 0.36);
        vec3 horizonCool = vec3(0.28, 0.42, 0.64);
        vec3 zenith = vec3(0.10, 0.20, 0.38);

        float warmSide = clamp(vDir.z * 0.5 + 0.5, 0.0, 1.0);
        vec3 horiz = mix(horizonCool, horizonWarm, warmSide * 0.65);

        vec3 col = y < 0.0
          ? mix(horiz, ground, clamp(-y * 2.5, 0.0, 1.0))
          : mix(horiz, zenith, pow(clamp(y, 0.0, 1.0), 0.65));

        // Bright cold skylight strip overhead so train roofs & bevels gleam
        float strip = smoothstep(0.55, 0.92, y);
        col += vec3(0.22, 0.32, 0.48) * strip;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(skyGeo, skyMat));

  const rt = pmrem.fromScene(envScene, 0.03);
  skyGeo.dispose();
  skyMat.dispose();
  pmrem.dispose();
  return rt.texture;
}
