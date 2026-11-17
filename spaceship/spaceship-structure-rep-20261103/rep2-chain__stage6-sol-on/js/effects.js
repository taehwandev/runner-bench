// Visual effects: soft glow texture and the exhaust plume particle system.
import * as THREE from 'three';

const MAX_PARTICLES = 500;
const EMIT_PER_SECOND = 140;          // particles per second at thrust 1
const PLUME_COLOR = [0.55, 0.9, 1.0];  // cyan-white, multiplied by fade for additive blending

let glowTexture = null;

// Soft round sprite with a radial falloff. Used for exhaust puffs and engine glow.
export function makeGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// Exhaust puffs: world-space particles spawned at the engine nozzles that drift back and fade,
// leaving a trail behind the ship.
export function createExhaust(scene, nozzles) {
  const position = new Float32Array(MAX_PARTICLES * 3);
  const color = new Float32Array(MAX_PARTICLES * 3);
  const velocity = new Float32Array(MAX_PARTICLES * 3);
  const age = new Float32Array(MAX_PARTICLES).fill(1);
  const life = new Float32Array(MAX_PARTICLES).fill(1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  const material = new THREE.PointsMaterial({
    map: makeGlowTexture(),
    size: 1.2,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // positions change every frame, so cached bounds would be stale
  scene.add(points);

  const origin = new THREE.Vector3();
  let head = 0;
  let carry = 0;
  let emitted = 0;

  function emit(ship, thrust, back) {
    origin.copy(nozzles[emitted++ % nozzles.length]);
    ship.localToWorld(origin);
    const i = head;
    head = (head + 1) % MAX_PARTICLES;
    const speed = 3 + thrust * 2.5;
    position[i * 3] = origin.x;
    position[i * 3 + 1] = origin.y;
    position[i * 3 + 2] = origin.z;
    velocity[i * 3] = back.x * speed + (Math.random() - 0.5) * 0.6;
    velocity[i * 3 + 1] = back.y * speed + (Math.random() - 0.5) * 0.6;
    velocity[i * 3 + 2] = back.z * speed + (Math.random() - 0.5) * 0.6;
    age[i] = 0;
    life[i] = 0.6 + Math.random() * 0.5;
  }

  const back = new THREE.Vector3();

  function update(dt, thrust, ship) {
    ship.updateMatrixWorld(true);
    back.set(0, 0, -1).applyQuaternion(ship.quaternion);
    carry += thrust * EMIT_PER_SECOND * dt;
    while (carry >= 1) {
      carry -= 1;
      emit(ship, thrust, back);
    }
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const o = i * 3;
      if (age[i] < life[i]) {
        age[i] += dt;
        position[o] += velocity[o] * dt;
        position[o + 1] += velocity[o + 1] * dt;
        position[o + 2] += velocity[o + 2] * dt;
        const fade = Math.max(0, 1 - age[i] / life[i]);
        const brightness = fade * fade;
        color[o] = PLUME_COLOR[0] * brightness;
        color[o + 1] = PLUME_COLOR[1] * brightness;
        color[o + 2] = PLUME_COLOR[2] * brightness;
      } else {
        color[o] = 0;
        color[o + 1] = 0;
        color[o + 2] = 0;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  }

  return { update };
}
