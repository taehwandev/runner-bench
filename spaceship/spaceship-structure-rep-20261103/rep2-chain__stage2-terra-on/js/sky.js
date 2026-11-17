// Scene builder for the daytime sky: gradient dome, sun, sky light and drifting clouds.
import * as THREE from 'three';

export const HORIZON_COLOR = '#cfe7fb';
const SUN_DIRECTION = new THREE.Vector3(60, 80, 40).normalize();

export function buildSky(scene, rng) {
  // Gradient dome with a soft sun glow. It follows the camera, so it never clips.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color('#2a6fd1') },
        horizon: { value: new THREE.Color(HORIZON_COLOR) },
        sunDir: { value: SUN_DIRECTION },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.95, 0.8) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.12);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.frustumCulled = false;
  scene.add(dome);

  const hemi = new THREE.HemisphereLight('#dbefff', '#6f8f4a', 1.25);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.3);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 300 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun);

  // Clouds: clusters of flattened puffs that drift slowly across the sky.
  const cloudGeo = new THREE.SphereGeometry(1, 14, 10);
  const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rng() * 4);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      const s = 2.4 + rng() * 2.2;
      puff.scale.set(s, s * 0.7, s);
      puff.position.set((j - puffs / 2) * 3.2 + rng() * 2, rng() * 1.5, rng() * 2 - 1);
      cloud.add(puff);
    }
    cloud.position.set((rng() * 2 - 1) * 300, 48 + rng() * 40, (rng() * 2 - 1) * 300);
    cloud.userData.speed = 0.8 + rng() * 1.2;
    scene.add(cloud);
    clouds.push(cloud);
  }

  return {
    update(dt, cameraPos) {
      dome.position.copy(cameraPos);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 320) cloud.position.x -= 640;
      }
    },
  };
}
