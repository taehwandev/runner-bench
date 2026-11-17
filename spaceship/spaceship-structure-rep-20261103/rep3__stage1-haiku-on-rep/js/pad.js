import * as THREE from 'three';
import { PAD_RADIUS, PAD_TOP, FOOT_OFFSET } from './config.js';
import { makeRadialTexture } from './util.js';
import { groundHeight } from './environment.js';

// Landing pad: concrete disc, glowing ring with lights, H marking,
// and a contact shadow that tightens as the ship nears the surface.
export function buildPad(scene) {
  const group = new THREE.Group();

  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(15, 80).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#d8cfbd', roughness: 1 })
  );
  apron.position.y = 0.02;
  apron.receiveShadow = true;
  group.add(apron);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.2, PAD_TOP, 96),
    new THREE.MeshStandardMaterial({ color: '#c3c6cb', roughness: 0.85 })
  );
  base.position.y = PAD_TOP / 2;
  base.receiveShadow = true;
  group.add(base);

  const hLetter = [
    [-1.5, -1.8], [-0.9, -1.8], [-0.9, -0.35], [0.9, -0.35], [0.9, -1.8], [1.5, -1.8],
    [1.5, 1.8], [0.9, 1.8], [0.9, 0.35], [-0.9, 0.35], [-0.9, 1.8], [-1.5, 1.8],
  ].map(([x, y]) => new THREE.Vector2(x * 0.8, y * 0.8));
  const hMark = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(hLetter)),
    new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.6 })
  );
  hMark.rotation.x = -Math.PI / 2;
  hMark.position.y = PAD_TOP + 0.008;
  group.add(hMark);

  const glowMat = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 1.2, roughness: 0.4 });
  const ringRadius = PAD_RADIUS - 0.35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.09, 8, 120), glowMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = PAD_TOP + 0.02;
  group.add(ring);

  const dotGeo = new THREE.SphereGeometry(0.14, 12, 8);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const dot = new THREE.Mesh(dotGeo, glowMat);
    dot.position.set(Math.cos(a) * ringRadius, PAD_TOP + 0.04, Math.sin(a) * ringRadius);
    group.add(dot);
  }

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: makeRadialTexture([[0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    })
  );
  blob.visible = false;

  scene.add(group, blob);
  return { glowMat, blob };
}

// Per-frame pad effects: light pulse and contact shadow
export function updatePad(pad, ship, elapsed) {
  pad.glowMat.emissiveIntensity = 1.1 + 0.4 * Math.sin(elapsed * 2.2);

  const p = ship.position;
  const surfaceY = surfaceHeight(p.x, p.z);
  const footAlt = Math.max(0, p.y - FOOT_OFFSET - surfaceY);
  const opacity = THREE.MathUtils.clamp(1 - footAlt / 22, 0, 1) * 0.5;

  pad.blob.visible = opacity > 0.01;
  pad.blob.material.opacity = opacity;
  pad.blob.position.set(p.x, surfaceY + 0.01, p.z);
  pad.blob.scale.setScalar(2.5 + footAlt * 0.25);
}

// Ground height directly under a point, used by the HUD and the shadow
export function surfaceHeight(x, z) {
  return Math.hypot(x, z) < PAD_RADIUS ? PAD_TOP : groundHeight(x, z);
}
