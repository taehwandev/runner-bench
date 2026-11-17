// Scene builder for the landing pad: a concrete disc with a painted H and a ring of lights.
import * as THREE from 'three';

const PAD_RADIUS = 7;
const LIGHT_COUNT = 24;

function makePadTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#8b9199';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  g.strokeStyle = '#f5f1e6';
  g.lineWidth = 14;
  g.beginPath();
  g.arc(256, 256, 240, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 8;
  g.setLineDash([24, 18]);
  g.beginPath();
  g.arc(256, 256, 196, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = '#f5f1e6';
  g.fillRect(170, 150, 34, 212);
  g.fillRect(308, 150, 34, 212);
  g.fillRect(170, 233, 172, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Returns an update hook that pulses the lights (faster while the ship is on its lap).
export function buildPad(scene) {
  const top = new THREE.MeshStandardMaterial({ map: makePadTexture(), roughness: 0.85 });
  const side = new THREE.MeshStandardMaterial({ color: '#7a8089', roughness: 0.9 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.2, 0.4, 96), [side, top, side]);
  disc.position.y = 0.2;
  disc.receiveShadow = true;
  disc.castShadow = true;
  scene.add(disc);

  const lightMat = new THREE.MeshBasicMaterial({ color: '#7fe9ff' });
  const lightGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const ring = new THREE.Group();
  for (let i = 0; i < LIGHT_COUNT; i++) {
    const a = (i / LIGHT_COUNT) * Math.PI * 2;
    const bulb = new THREE.Mesh(lightGeo, lightMat);
    bulb.position.set(Math.cos(a) * (PAD_RADIUS - 0.2), 0.5, Math.sin(a) * (PAD_RADIUS - 0.2));
    ring.add(bulb);
  }
  scene.add(ring);

  return {
    update(time, phase) {
      const rate = phase === 'lap' ? 5 : 2;
      const pulse = 0.5 + 0.5 * Math.sin(time * rate);
      lightMat.color.setRGB(0.35 + 0.65 * pulse, 0.9, 1.0);
    },
  };
}
