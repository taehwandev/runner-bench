// Environment builders: lights, sky, ground, landing pad, mountains, trees, rocks, clouds.
import * as THREE from 'three';
import { CONFIG, DESTINATIONS } from './config.js';

const C = CONFIG.colors;
const TAU = Math.PI * 2;

// Deterministic PRNG so the scenery is identical on every load
export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gentle rolling terrain; flat within 30 units of the pad so the apron sits level
export function groundHeight(x, z) {
  const d = Math.hypot(x, z);
  const h = Math.sin(x * 0.012) * 2.2 + Math.cos(z * 0.015) * 2.2 + Math.sin((x + z) * 0.04) * 0.8;
  return h * THREE.MathUtils.smoothstep(d, 30, 120);
}

// Builds the whole environment into `scene`. Returns an update hook for animated bits.
export function buildWorld(scene) {
  const rand = mulberry32(7);
  scene.fog = new THREE.Fog(C.horizon, 180, 900);

  const sky = buildSky();
  const pad = buildPad();
  const clouds = buildClouds(rand);
  const space = buildSpace(rand);
  scene.add(space.stars, ...Object.values(space.planets), space.jump);

  scene.add(buildLights(), sky, buildGround(), pad.group, buildMountains(rand), buildTrees(rand), buildRocks(rand));
  scene.add(...clouds.map((c) => c.group));

  return {
    update(dt, time, cameraPos, flight, shipPos) {
      sky.position.copy(cameraPos);
      sky.material.uniforms.space.value = flight.space;
      scene.fog.color.set(C.horizon).lerp(new THREE.Color(0x030716), flight.space);
      scene.fog.near = THREE.MathUtils.lerp(180, 1800, flight.space);
      scene.fog.far = THREE.MathUtils.lerp(900, 2900, flight.space);
      space.stars.position.copy(cameraPos);
      space.stars.material.opacity = flight.space;
      space.jump.position.copy(shipPos);
      space.jump.quaternion.copy(sceneCameraFacing(space.jump.position, cameraPos));
      space.jump.scale.setScalar(1 + flight.jump * 3);
      space.jump.material.opacity = flight.jump * 0.9;
      for (const [id, planet] of Object.entries(space.planets)) {
        const arrived = flight.jumps > 0 && id === flight.destination;
        if (arrived && !planet.visible) {
          // Place the arrival in the current view without changing the user's camera.
          const view = shipPos.clone().sub(cameraPos).normalize();
          const right = new THREE.Vector3().crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize();
          planet.userData.offset = view.multiplyScalar(350).addScaledVector(right, 55);
        }
        // Keep the distant world ahead during the ongoing arrival cruise.
        if (arrived) planet.position.copy(shipPos).add(planet.userData.offset);
        planet.visible = arrived;
      }
      for (const c of clouds) {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > 560) c.group.position.x = -560;
      }
      pad.blink(time);
    },
  };
}

function sceneCameraFacing(position, cameraPos) {
  const matrix = new THREE.Matrix4().lookAt(position, cameraPos, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(matrix);
}

function buildSpace(rand) {
  const positions = [];
  for (let i = 0; i < 1800; i++) {
    const y = rand() * 2 - 1;
    const angle = rand() * TAU;
    const radius = Math.sqrt(1 - y * y) * 1200;
    positions.push(Math.cos(angle) * radius, y * 1200, Math.sin(angle) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdcecff, size: 3, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  const planets = Object.fromEntries(Object.entries(DESTINATIONS).map(
    ([id, destination]) => [id, buildArrivalWorld(id, destination)],
  ));
  const jump = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 64), new THREE.MeshBasicMaterial({ color: 0x91f6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  return { stars, planets, jump };
}

function buildArrivalWorld(id, destination) {
  const planet = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(64, 48, 32), new THREE.MeshStandardMaterial({
    color: destination.color, roughness: 0.9, emissive: destination.emissive, emissiveIntensity: 0.5,
  }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(68, 48, 32), new THREE.MeshBasicMaterial({
    color: destination.halo, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false,
  }));
  planet.add(globe, halo);
  if (id === 'ember') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(84, 118, 96), new THREE.MeshStandardMaterial({
      color: 0xe9ba82, emissive: 0x593715, emissiveIntensity: 0.4,
      side: THREE.DoubleSide, transparent: true, opacity: 0.8,
    }));
    ring.rotation.set(1.1, 0.35, 0.2);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), new THREE.MeshStandardMaterial({
      color: 0xd7c8ba, roughness: 1, emissive: 0x332a24,
    }));
    moon.position.set(-110, 65, 10);
    planet.add(ring, moon);
  } else {
    const land = new THREE.MeshStandardMaterial({ color: 0x72aa6a, roughness: 1, flatShading: true });
    const rand = mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const island = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rand() * 8, 1), land);
      const direction = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      island.position.copy(direction).multiplyScalar(62);
      island.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
      island.scale.set(1, 0.7, 0.25);
      planet.add(island);
    }
  }
  planet.visible = false;
  return planet;
}

function buildLights() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xdff3ff, 0x6b8f47, 1.2));

  const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
  sun.position.set(70, 130, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 320 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  group.add(sun);

  return group;
}

// Vertical gradient dome; drawn first and never depth-tested against the scene
function buildSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      zenith: { value: new THREE.Color(C.zenith) },
      horizon: { value: new THREE.Color(C.horizon) },
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
      uniform float space;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 atmosphere = mix(horizon, zenith, pow(h, 0.6));
        vec3 deepSpace = mix(vec3(0.012, 0.018, 0.045), vec3(0.002, 0.004, 0.015), h);
        gl_FragColor = vec4(mix(atmosphere, deepSpace, space), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), material);
  mesh.renderOrder = -1;
  return mesh;
}

function buildGround() {
  const geo = new THREE.PlaneGeometry(3000, 3000, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C.grass, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

function padTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const m = size / 2;

  g.fillStyle = '#5b626b';
  g.beginPath();
  g.arc(m, m, m, 0, TAU);
  g.fill();

  g.strokeStyle = '#ffd23f';
  g.lineWidth = 22;
  g.beginPath();
  g.arc(m, m, m - 40, 0, TAU);
  g.stroke();

  g.lineWidth = 12;
  g.setLineDash([34, 26]);
  g.beginPath();
  g.arc(m, m, m - 108, 0, TAU);
  g.stroke();
  g.setLineDash([]);

  g.fillStyle = '#ffffff';
  g.font = 'bold 230px system-ui, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', m, m + 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Concrete apron, the pad itself with its marking, and a ring of chasing beacons
function buildPad() {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: C.apron, roughness: 0.9 });

  const apron = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 0.12, 96), concrete);
  apron.position.y = 0.06;
  apron.receiveShadow = true;

  const pad = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.3, 96), concrete);
  pad.position.y = 0.15;
  pad.receiveShadow = true;
  pad.castShadow = true;

  const decal = new THREE.Mesh(
    new THREE.CircleGeometry(12.5, 96),
    new THREE.MeshStandardMaterial({ map: padTexture(), roughness: 0.7 }),
  );
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = 0.302;
  decal.receiveShadow = true;

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(12.9, 0.3, 12, 96),
    new THREE.MeshStandardMaterial({ color: 0x8e96a0, metalness: 0.3, roughness: 0.5 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  rim.castShadow = true;

  const beaconMat = new THREE.MeshBasicMaterial({ color: C.beacon });
  const beaconGeo = new THREE.SphereGeometry(0.28, 12, 8);
  const beacons = Array.from({ length: 8 }, (_, i) => {
    const b = new THREE.Mesh(beaconGeo, beaconMat);
    const a = (i / 8) * TAU;
    b.position.set(Math.cos(a) * 12.9, 0.5, Math.sin(a) * 12.9);
    group.add(b);
    return b;
  });

  group.add(apron, pad, decal, rim);

  return {
    group,
    blink(time) {
      beacons.forEach((b, i) => {
        b.scale.setScalar(0.8 + 0.4 * Math.max(0, Math.sin(time * 3 - i * 0.8)));
      });
    },
  };
}

function buildMountains(rand) {
  const group = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ color: C.mountain, roughness: 1, flatShading: true });
  const snow = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });

  for (let i = 0; i < 18; i++) {
    const a = rand() * TAU;
    const d = 640 + rand() * 140;
    // Keep the ship's departure corridor (+Z) open so it flies into clear sky
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.6) continue;
    const r = 90 + rand() * 70;
    const h = 170 + rand() * 140;

    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock);
    peak.position.set(Math.cos(a) * d, h / 2 - 6, Math.sin(a) * d);
    group.add(peak);

    if (h > 240) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.28, 7), snow);
      cap.position.set(peak.position.x, peak.position.y + h * 0.36, peak.position.z);
      group.add(cap);
    }
  }
  return group;
}

function buildTrees(rand) {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.4, 7);
  trunkGeo.translate(0, 1.2, 0);
  const crownGeo = new THREE.ConeGeometry(2.4, 5, 8);
  crownGeo.translate(0, 4.9, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: C.trunk, roughness: 1 });
  const crownMats = C.foliage.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true }),
  );

  for (let i = 0; i < 170; i++) {
    const a = rand() * TAU;
    const d = 34 + Math.pow(rand(), 0.8) * 340; // keep the pad apron clear
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;

    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    const crown = new THREE.Mesh(crownGeo, crownMats[Math.floor(rand() * crownMats.length)]);
    trunk.castShadow = true;
    crown.castShadow = true;
    tree.add(trunk, crown);

    const s = 0.8 + rand() * 1.2;
    tree.scale.setScalar(s);
    tree.rotation.y = rand() * TAU;
    tree.position.set(x, groundHeight(x, z), z);
    group.add(tree);
  }
  return group;
}

function buildRocks(rand) {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: C.rock, roughness: 0.95, flatShading: true });

  for (let i = 0; i < 30; i++) {
    const a = rand() * TAU;
    const d = 30 + rand() * 280;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const rock = new THREE.Mesh(geo, mat);
    const s = 0.6 + rand() * 1.6;
    rock.scale.set(s, s * 0.6, s * 0.9);
    rock.rotation.set(rand() * TAU, rand() * TAU, 0);
    rock.position.set(x, groundHeight(x, z) + s * 0.1, z);
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}

function buildClouds(rand) {
  const material = new THREE.MeshStandardMaterial({
    color: C.cloud,
    roughness: 1,
    emissive: C.cloud,
    emissiveIntensity: 0.12,
  });
  const puffGeo = new THREE.SphereGeometry(1, 16, 12);

  return Array.from({ length: 22 }, () => {
    const group = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const s = 6 + rand() * 6;
      const puff = new THREE.Mesh(puffGeo, material);
      puff.scale.set(s, s * 0.6, s * 0.8);
      puff.position.set((p - puffs / 2) * s * 0.9, rand() * 2, (rand() - 0.5) * s);
      group.add(puff);
    }
    const a = rand() * TAU;
    const d = 90 + rand() * 420;
    group.position.set(Math.cos(a) * d, 55 + rand() * 35, Math.sin(a) * d);
    return { group, speed: 0.8 + rand() * 1.6 };
  });
}
