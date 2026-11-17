// Scene builder for the ground: rolling terrain kept flat around the pad, plus trees, rocks and mountains.
import * as THREE from 'three';
import { smoothstep } from './util.js';

// Terrain height. It stays flat near the pad so the landing area reads clearly.
export function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  const rolling = 7 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017)
    + 4 * Math.sin(x * 0.047 - z * 0.039 + 0.7)
    + 2 * Math.cos(z * 0.09 + x * 0.03);
  return rolling * smoothstep(d, 24, 70);
}

function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#6fa34f';
  g.fillRect(0, 0, size, size);
  const shades = ['#5c9242', '#82b35c', '#7fae55', '#5f9447', '#93bd68'];
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = shades[i % shades.length];
    g.globalAlpha = 0.35 + Math.random() * 0.4;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(200, 200);
  tex.anisotropy = 8;
  return tex;
}

function buildGround(scene) {
  const geo = new THREE.PlaneGeometry(2000, 2000, 240, 240).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.95 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

function buildTrees(scene, rng) {
  const COUNT = 220;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.3, 1.4, 8).translate(0, 0.7, 0),
    new THREE.MeshStandardMaterial({ color: '#7a5a3a', roughness: 0.9 }),
    COUNT,
  );
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.5, 4.2, 9).translate(0, 3.3, 0),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
    COUNT,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const shade = new THREE.Color();
  let placed = 0;
  while (placed < COUNT) {
    const x = (rng() * 2 - 1) * 380;
    const z = (rng() * 2 - 1) * 380;
    if (Math.hypot(x, z) < 26) continue; // keep the pad clear
    const k = 0.8 + rng() * 0.7;
    p.set(x, groundHeight(x, z), z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    s.set(k, k, k);
    m.compose(p, q, s);
    trunk.setMatrixAt(placed, m);
    crown.setMatrixAt(placed, m);
    crown.setColorAt(placed, shade.setHSL(0.28 + rng() * 0.06, 0.45, 0.22 + rng() * 0.1));
    placed++;
  }
  for (const mesh of [trunk, crown]) {
    mesh.castShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
  }
  crown.instanceColor.needsUpdate = true;
  scene.add(trunk, crown);
}

function buildRocks(scene, rng) {
  const COUNT = 40;
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: '#8d8579', roughness: 1, flatShading: true }),
    COUNT,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < COUNT; i++) {
    let x;
    let z;
    do {
      x = (rng() * 2 - 1) * 300;
      z = (rng() * 2 - 1) * 300;
    } while (Math.hypot(x, z) < 22);
    const k = 0.4 + rng() * 1.4;
    p.set(x, groundHeight(x, z) + k * 0.25, z);
    q.setFromAxisAngle(up, rng() * Math.PI * 2);
    s.set(k, k * (0.6 + rng() * 0.4), k);
    m.compose(p, q, s);
    rocks.setMatrixAt(i, m);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);
}

// Low-poly mountains on a distant ring. The fog softens them into the horizon.
function buildMountains(scene, rng) {
  const mountainMat = new THREE.MeshStandardMaterial({ color: '#7d93a8', flatShading: true, roughness: 1 });
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rng() * 0.15;
    const r = 540 + rng() * 120;
    const h = 90 + rng() * 110;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(70 + rng() * 60, h, 7), mountainMat);
    peak.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r);
    peak.rotation.y = rng() * 3;
    scene.add(peak);
  }
}

export function buildTerrain(scene, rng) {
  buildGround(scene);
  buildTrees(scene, rng);
  buildRocks(scene, rng);
  buildMountains(scene, rng);
}
