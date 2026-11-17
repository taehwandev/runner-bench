// Scene builder for the spaceship. The nose points along +Z so lookAt() aims it along its motion.
import * as THREE from 'three';
import { makeGlowTexture } from './effects.js';

// Engine nozzle exhaust origins in ship space, just behind each nozzle.
export const NOZZLES = [new THREE.Vector3(-0.42, -0.05, -2.2), new THREE.Vector3(0.42, -0.05, -2.2)];

export function buildShip() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#e4eaf2', metalness: 0.55, roughness: 0.28 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: '#ff7a3d',
    metalness: 0.2,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#7fd3ff',
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.72,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#2b323c', metalness: 0.6, roughness: 0.4 });

  const solid = (geometry, material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Hull: a lathe around Y, turned so the nose faces +Z.
  const profile = [
    [0, 2.0], [0.3, 1.8], [0.6, 1.3], [0.82, 0.5], [0.86, -0.2],
    [0.72, -1.0], [0.45, -1.6], [0.25, -1.85], [0, -1.9],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  solid(new THREE.LatheGeometry(profile, 32).rotateX(Math.PI / 2), hullMat);

  // Cockpit dome.
  const canopy = solid(
    new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat,
  );
  canopy.scale.set(0.8, 0.55, 1.5);
  canopy.position.set(0, 0.62, 0.55);

  // Swept wings: one extruded shape, mirrored by a negative X scale.
  const wingShape = new THREE.Shape([
    new THREE.Vector2(0.4, 0.7),
    new THREE.Vector2(2.2, -0.6),
    new THREE.Vector2(2.2, -1.0),
    new THREE.Vector2(0.4, -1.1),
  ]);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2);
  for (const side of [1, -1]) {
    const wing = solid(wingGeo, accentMat);
    wing.position.y = -0.1;
    wing.scale.x = side;
  }

  // Tail fin.
  const fin = solid(new THREE.BoxGeometry(0.08, 0.9, 0.9), accentMat);
  fin.position.set(0, 0.85, -1.1);

  // Engine nozzles.
  const nozzleGeo = new THREE.CylinderGeometry(0.2, 0.26, 0.45, 16).rotateX(Math.PI / 2);
  for (const n of NOZZLES) {
    solid(nozzleGeo, darkMat).position.set(n.x, n.y, -1.9);
  }

  // Engine glow: soft additive sprites, invisible until the engines fire.
  const glowTexture = makeGlowTexture();
  const glows = NOZZLES.map((n) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: '#9af0ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }));
    sprite.position.copy(n);
    group.add(sprite);
    return sprite;
  });

  return { group, glows };
}
