import * as THREE from 'three';
import { TREE_COUNT } from './config.js';
import { rand, pick, ss, makeRadialTexture, makeGrassTexture } from './util.js';

const HORIZON = '#e4f3ff';
export const SUN_DIR = new THREE.Vector3(-0.55, 0.62, -0.25).normalize();

// Rolling terrain that stays flat around the pad
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const k = ss(30, 120, r);
  return k * (Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) * 7 + Math.sin((x + z) * 0.043) * 2.5);
}

// Builds sky, lights, terrain, scenery and clouds. Returns the handles
// the main loop needs to keep the sky and sun attached to the camera.
export function buildEnvironment(scene) {
  scene.fog = new THREE.Fog(HORIZON, 260, 900);

  // Gradient sky dome, re-centred on the camera every frame
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#2d7bd4') },
        mid: { value: new THREE.Color('#8ec9f4') },
        bottom: { value: new THREE.Color(HORIZON) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 bottom;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0
            ? mix(mid, top, smoothstep(0.02, 0.5, h))
            : mix(bottom, mid, smoothstep(-0.25, 0.0, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // Sun disc glow
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeRadialTexture([[0, 'rgba(255,255,240,1)'], [0.15, 'rgba(255,250,220,0.9)'], [0.4, 'rgba(255,240,200,0.25)'], [1, 'rgba(255,240,200,0)']]),
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }));
  sunSprite.scale.setScalar(260);
  scene.add(sunSprite);

  // Lighting: sky fill plus a warm sun that casts shadows
  scene.add(new THREE.HemisphereLight('#cfe9ff', '#5b7a3c', 1.1));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 320 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // Terrain
  const groundGeo = new THREE.PlaneGeometry(1600, 1600, 160, 160).rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  for (let i = 0; i < gPos.count; i++) gPos.setY(i, groundHeight(gPos.getX(i), gPos.getZ(i)));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  addTrees(scene);
  addMountains(scene);
  addHangar(scene, -50, -30, 0.4);
  addHangar(scene, -68, 28, -0.2);
  addTower(scene);
  const clouds = addClouds(scene);

  return {
    sky,
    sunSprite,
    // Keep the sky and sun following the camera; drift the clouds
    update(camera, dt) {
      sky.position.copy(camera.position);
      sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 780);
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 460) c.position.x = -460;
      }
    },
  };
}

function addTrees(scene) {
  const palette = ['#3f8f3a', '#4c9c3e', '#2f7a3a', '#5aa84a', '#6fb04f'];
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8).translate(0, 0.8, 0);
  const crownGeo = new THREE.ConeGeometry(1.4, 3.6, 10).translate(0, 3.4, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 }), TREE_COUNT);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), TREE_COUNT);
  trunks.castShadow = crowns.castShadow = true;

  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (let i = 0; i < TREE_COUNT; i++) {
    const a = rand() * Math.PI * 2;
    const r = pick(34, 240);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const sc = pick(0.8, 1.7);
    p.set(x, groundHeight(x, z), z);
    s.set(sc, sc * pick(0.9, 1.25), sc);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, col.set(palette[Math.floor(rand() * palette.length)]));
  }
  scene.add(trunks, crowns);
}

// Distant blue-green peaks that fade into the haze
function addMountains(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: '#7d96b5', roughness: 1, flatShading: true });
  const coneGeo = new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rand() * 0.12;
    const r = pick(430, 560);
    const w = pick(90, 170);
    const h = pick(55, 140);
    const m = new THREE.Mesh(coneGeo, mat);
    m.scale.set(w, h, w);
    m.position.set(Math.cos(a) * r, -6, Math.sin(a) * r);
    m.rotation.y = rand() * Math.PI;
    scene.add(m);
  }
}

function addHangar(scene, x, z, ry) {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 20), new THREE.MeshStandardMaterial({ color: '#e4e8ee', roughness: 0.8 }));
  wall.position.y = 3.5;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 21), new THREE.MeshStandardMaterial({ color: '#7f8a99', roughness: 0.6, metalness: 0.2 }));
  roof.position.y = 7.6;
  const door = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.2), new THREE.MeshStandardMaterial({ color: '#3c4655', roughness: 0.7 }));
  door.position.set(0, 2.5, 10.1);
  wall.castShadow = wall.receiveShadow = true;
  roof.castShadow = true;
  g.add(wall, roof, door);
  g.position.set(x, groundHeight(x, z), z);
  g.rotation.y = ry;
  scene.add(g);
}

function addTower(scene) {
  const x = 48;
  const z = -40;
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 20, 16), new THREE.MeshStandardMaterial({ color: '#f1f3f6', roughness: 0.7 }));
  shaft.position.y = 10;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.2, 3, 20), new THREE.MeshStandardMaterial({ color: '#5d7189', roughness: 0.3, metalness: 0.2 }));
  cab.position.y = 21.5;
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff3b3b', emissiveIntensity: 1.5 }));
  beacon.position.y = 24.3;
  shaft.castShadow = cab.castShadow = true;
  tower.add(shaft, cab, beacon);
  tower.position.set(x, groundHeight(x, z), z);
  scene.add(tower);
}

function addClouds(scene) {
  const puff = new THREE.SphereGeometry(1, 14, 10);
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.08 });
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rand() * 4);
    for (let j = 0; j < n; j++) {
      const blob = new THREE.Mesh(puff, mat);
      blob.position.set((j - n / 2) * pick(3, 5), pick(-1, 1), pick(-2, 2));
      blob.scale.setScalar(pick(4, 7));
      g.add(blob);
    }
    g.position.set(pick(-420, 420), pick(70, 120), pick(-420, 420));
    g.userData.speed = pick(1.5, 4);
    scene.add(g);
    clouds.push(g);
  }
  return clouds;
}
