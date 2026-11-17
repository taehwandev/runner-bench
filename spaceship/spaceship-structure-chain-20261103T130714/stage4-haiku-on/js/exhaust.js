// Engine exhaust: a pool of soft, additive glow sprites that trail behind the ship.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const POOL_SIZE = 90;
const SPAWN_RATE = 30; // particles per second at full thrust, before scaling by strength

// Radial gradient with falloff, so particles read as light rather than squares
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.35, 'rgba(200, 250, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(120, 220, 255, 0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createExhaust(scene) {
  const map = glowTexture();
  const pool = Array.from({ length: POOL_SIZE }, () => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        color: CONFIG.colors.exhaust,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, life: 0, maxLife: 1, size: 1, vel: new THREE.Vector3() };
  });

  let cursor = 0;
  let accumulator = 0;
  const jitter = (amount) => (Math.random() - 0.5) * amount;

  function spawn(origin, backward, strength) {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    p.maxLife = p.life = 0.5 + Math.random() * 0.5;
    p.size = (1.2 + Math.random() * 0.6) * (0.6 + strength);
    p.sprite.position.set(origin.x + jitter(0.3), origin.y + jitter(0.3), origin.z + jitter(0.3));
    p.vel.copy(backward).multiplyScalar(3 + 6 * strength);
    p.vel.add({ x: jitter(1), y: jitter(1), z: jitter(1) });
    p.sprite.visible = true;
  }

  return {
    // origin: world point at the engines. backward: unit vector opposite the motion.
    emit(dt, origin, backward, strength) {
      accumulator += SPAWN_RATE * (0.3 + 2.5 * strength) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        spawn(origin, backward, strength);
      }
    },

    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.sprite.visible = false;
          continue;
        }
        p.sprite.position.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - 0.5 * dt);
        const k = p.life / p.maxLife;
        p.sprite.scale.setScalar(p.size * (0.3 + 0.7 * k));
        p.sprite.material.opacity = k * 0.9;
      }
    },

    clear() {
      for (const p of pool) {
        p.life = 0;
        p.sprite.visible = false;
      }
    },
  };
}
