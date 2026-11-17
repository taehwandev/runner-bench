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
        space: { value: 0 },
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
        uniform float space;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += vec3(1.0, 0.95, 0.8) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.12);
          col = mix(col, vec3(0.004, 0.008, 0.035), space);
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

  // A camera-centred star field stays infinitely distant as the ship travels.
  const starPositions = [];
  for (let i = 0; i < 1500; i++) {
    const y = rng() * 2 - 1;
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y) * 850;
    starPositions.push(Math.cos(angle) * r, y * 850, Math.sin(angle) * r);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({ color: '#d9eaff', size: 2, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  // A luminous ring and flash frame the ship during both halves of the jump.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.18, 'rgba(138,231,255,0.25)');
  glow.addColorStop(0.48, 'rgba(63,170,255,0.05)');
  glow.addColorStop(0.64, 'rgba(169,244,255,0.95)');
  glow.addColorStop(0.72, 'rgba(76,126,255,0.45)');
  glow.addColorStop(1, 'rgba(29,68,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);
  const jumpMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const jump = new THREE.Sprite(jumpMat);
  scene.add(jump);

  const planet = new THREE.Mesh(new THREE.SphereGeometry(45, 48, 32),
    new THREE.MeshStandardMaterial({ color: '#5d83bd', roughness: 0.9, emissive: '#12244a', emissiveIntensity: 0.4 }));
  planet.position.set(5070, 1980, -6050);
  planet.visible = false;
  scene.add(planet);
  const fogDay = new THREE.Color(HORIZON_COLOR);
  const fogSpace = new THREE.Color('#02051a');

  return {
    update(dt, cameraPos, flight) {
      dome.position.copy(cameraPos);
      dome.material.uniforms.space.value = flight.space;
      stars.position.copy(cameraPos);
      starMat.opacity = flight.space;
      scene.fog.color.copy(fogDay).lerp(fogSpace, flight.space);
      scene.fog.near = 160 + flight.space * 1840;
      scene.fog.far = 900 + flight.space * 2100;
      cloudMat.opacity = 0.92 * (1 - flight.space);
      jump.position.set(flight.position.x, flight.position.y, flight.position.z);
      jumpMat.opacity = flight.jump;
      jump.scale.setScalar(8 + flight.jump * 22);
      planet.visible = flight.teleported;
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 320) cloud.position.x -= 640;
      }
    },
  };
}
