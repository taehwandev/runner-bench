import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const materials = new Map();
function material(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .75, ...options }));
  return materials.get(key);
}
function mesh(geometry, color, parent, position = [0, 0, 0], options = {}) {
  const object = new THREE.Mesh(geometry, material(color, options));
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function cylinder(parent, color, radius, height, position, top = radius) {
  return mesh(new THREE.CylinderGeometry(top, radius, height, 80), color, parent, position);
}
function box(parent, color, size, position) {
  return mesh(new THREE.BoxGeometry(...size), color, parent, position);
}
function ring(parent, color, inner, outer, position) {
  const object = mesh(new THREE.RingGeometry(inner, outer, 128), color, parent, position);
  object.rotation.x = -Math.PI / 2;
  return object;
}
function sphere(parent, color, scale, position, options = {}) {
  const object = mesh(new THREE.SphereGeometry(1, 48, 32), color, parent, position, options);
  object.scale.set(...scale);
  return object;
}

export function createShip() {
  const ship = new THREE.Group();
  const hull = new THREE.Group();
  ship.add(hull);
  sphere(hull, '#d5e2d8', [2.8, .48, 2.1], [0, 0, 0], { metalness: .62, roughness: .32 });
  sphere(hull, '#5f7770', [2.5, .26, 1.88], [0, -.18, 0], { metalness: .7, roughness: .36 });
  sphere(hull, '#e5ede3', [2.72, .32, 2.05], [0, .13, 0], { metalness: .45, roughness: .33 });
  const band = cylinder(hull, '#e59b4f', 2.06, .07, [0, -.015, 0]);
  band.scale.x = 1.35;
  sphere(hull, '#eff4e8', [1.58, .62, 1.5], [0, .34, 0], { metalness: .35, roughness: .3 });
  const canopy = sphere(hull, '#234c59', [1.18, .68, 1.12], [0, .64, .12], {
    metalness: .72, roughness: .13,
  });
  canopy.rotation.x = -.12;
  sphere(hull, '#79a9b1', [.62, .055, .5], [-.3, 1.2, .34], { metalness: .75, roughness: .2 });
  for (const x of [-1.9, 1.9]) {
    const fin = box(hull, '#d6e3d6', [.11, .65, 1.3], [x, .35, -.65]);
    fin.rotation.z = x > 0 ? -.4 : .4;
    box(hull, '#e7a05a', [.13, .08, .8], [x, .7, -.65]);
  }
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const rivet = sphere(hull, '#677f75', [.045, .045, .045], [2.58 * Math.sin(a), .26, 1.82 * Math.cos(a)]);
    rivet.castShadow = false;
  }
  for (const x of [-1.12, 1.12]) {
    cylinder(hull, '#425b57', .3, .28, [x, -.43, -.65]);
    const glow = cylinder(hull, '#b2e9e1', .23, .1, [x, -.59, -.65]);
    glow.material = material('#c8fff1', { emissive: '#75e6c5', emissiveIntensity: 1.8 });
    const plume = mesh(new THREE.ConeGeometry(.2, .8, 24), '#b2f5e3', hull, [x, -1, -.65], {
      transparent: true, opacity: .34, emissive: '#7fdacb', emissiveIntensity: .8, depthWrite: false,
    });
    plume.rotation.z = Math.PI;
    plume.name = 'plume';
  }
  box(hull, '#d9e8da', [.08, .65, .08], [.63, 1.38, -.5]);
  sphere(hull, '#eaab62', [.09, .09, .09], [.63, 1.72, -.5]);
  return ship;
}

function createPad(scene) {
  cylinder(scene, '#899b8b', 8.3, .42, [0, .02, 0]);
  cylinder(scene, '#b8c6b3', 8, .22, [0, .32, 0]);
  cylinder(scene, '#556b65', 6.9, .1, [0, .47, 0]);
  ring(scene, '#e9eddc', 6.37, 6.49, [0, .532, 0]);
  ring(scene, '#82958a', 5.75, 5.79, [0, .534, 0]);
  ring(scene, '#c7d19b', 2.95, 3.04, [0, .536, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const mark = box(scene, '#dbe1c9', [.22, .012, .7], [6.76 * Math.sin(a), .54, 6.76 * Math.cos(a)]);
    mark.rotation.y = a;
    if (i % 2 === 0) {
      cylinder(scene, '#566a61', .12, .22, [7.6 * Math.sin(a), .55, 7.6 * Math.cos(a)]);
      sphere(scene, '#f3d5a0', [.1, .07, .1], [7.6 * Math.sin(a), .71, 7.6 * Math.cos(a)], {
        emissive: '#ffc673', emissiveIntensity: .5,
      });
    }
  }
  for (const x of [-.73, .73]) box(scene, '#dfe7d0', [.19, .015, 1.8], [x, .544, .15]);
  box(scene, '#dfe7d0', [1.5, .015, .2], [0, .544, .15]);
  // The markings are textures on the pad rather than floating UI.
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#dfe7d0'; ctx.font = '500 74px monospace'; ctx.textAlign = 'center';
  ctx.fillText('01', 256, 160);
  const text = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false,
  }));
  text.rotation.x = -Math.PI / 2; text.position.set(0, .55, 4.5); scene.add(text);
}

function tree(scene, x, z, size = 1) {
  const group = new THREE.Group();
  group.position.set(x, -.1, z); group.scale.setScalar(size);
  cylinder(group, '#8c8970', .13, 1.1, [0, .4, 0]);
  mesh(new THREE.ConeGeometry(1.1, 2.6, 7), '#597a58', group, [0, 2, 0]);
  mesh(new THREE.ConeGeometry(.85, 2.2, 7), '#719064', group, [0, 2.9, 0]);
  mesh(new THREE.ConeGeometry(.55, 1.7, 7), '#8dA276', group, [0, 3.7, 0]);
  scene.add(group);
}
function createOutpost(scene) {
  const group = new THREE.Group(); group.position.set(-15, 0, -10);
  cylinder(group, '#9fada0', 2.6, .4, [0, .1, 0]);
  cylinder(group, '#d9dfc9', 1.2, 6, [0, 3.2, 0], .85);
  cylinder(group, '#c5cebc', 2.3, .25, [0, 6, 0]);
  cylinder(group, '#3c666a', 1.85, 1.4, [0, 6.8, 0]);
  cylinder(group, '#e7e9d7', 2.3, .25, [0, 7.6, 0]);
  cylinder(group, '#d3dac6', 2.25, .3, [0, 7.9, 0], .9);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    box(group, '#d4decb', [.09, 1.5, .09], [1.84 * Math.sin(a), 6.8, 1.84 * Math.cos(a)]);
  }
  cylinder(group, '#7f9384', .06, 2, [0, 8.8, 0]);
  sphere(group, '#e9ad68', [.15, .15, .15], [0, 9.9, 0]);
  scene.add(group);
  const terminal = new THREE.Group(); terminal.position.set(15, 0, -10); terminal.rotation.y = -.2;
  box(terminal, '#d5dcc8', [8, 2.5, 4.5], [0, 1.15, 0]);
  box(terminal, '#536f6a', [6.8, 1, .08], [0, 1.65, 2.29]);
  box(terminal, '#e3e8d5', [8.6, .28, 5.2], [0, 2.6, 0]);
  for (let x = -2.5; x <= 2.5; x += 1.25) box(terminal, '#bdcbb6', [.1, 1.1, .12], [x, 1.6, 2.36]);
  for (let i = 0; i < 3; i++) {
    const panel = box(terminal, '#386677', [1.7, .12, 2.8], [-2.3 + i * 2.3, 2.93, 0]);
    panel.rotation.x = .17;
  }
  box(terminal, '#afbf9b', [9, .1, 2], [0, .05, 3]);
  scene.add(terminal);
  const path = box(scene, '#c0c6ac', [34, .025, 2.6], [0, -.04, -10]);
  path.rotation.y = .02;
  box(scene, '#c0c6ac', [3, .03, 6], [0, -.03, -6]);
  for (const x of [10, 12]) {
    box(scene, '#c0b48c', [1.2, .9, 1.1], [x, .4, -4]);
    box(scene, '#8b9b7d', [1.23, .12, 1.13], [x, .89, -4]);
  }
  cylinder(scene, '#8b9981', .07, 5.5, [10, 2.65, 4]);
  const sock = mesh(new THREE.ConeGeometry(.37, 1.9, 12, 1, true), '#e8a665', scene, [10.8, 5.2, 4]);
  sock.rotation.z = Math.PI / 2 + .15;
}

function createLandscape(scene) {
  cylinder(scene, '#a5ac89', 62, 8, [0, -4.2, 0], 65);
  cylinder(scene, '#a5b68b', 65, .15, [0, -.17, 0]);
  const water = mesh(new THREE.PlaneGeometry(12000, 12000), '#83bac5', scene, [0, -8.4, 0], { roughness: .36, metalness: .15 });
  water.rotation.x = -Math.PI / 2; water.castShadow = false;
  let seed = 87;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 100; i++) {
    const a = random() * Math.PI * 2;
    const r = 24 + random() * 34;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    tree(scene, x, z, .65 + random() * .7);
  }
  for (let i = 0; i < 46; i++) {
    const a = random() * Math.PI * 2;
    const r = 61 + random() * 3;
    const rock = mesh(new THREE.DodecahedronGeometry(1, 0), '#9fa58c', scene,
      [Math.cos(a) * r, -3 - random() * 2, Math.sin(a) * r]);
    rock.scale.set(3 + random() * 4, 4 + random() * 3, 3 + random() * 3);
    rock.rotation.set(random(), random(), random());
  }
  for (let i = 0; i < 18; i++) {
    const x = -200 + i * 26;
    const mountain = mesh(new THREE.ConeGeometry(25 + random() * 25, 18 + random() * 24, 6),
      i % 2 ? '#91b6ad' : '#9cbeb5', scene, [x, -6, -160 - random() * 70]);
    mountain.scale.z = .6;
  }
  for (let i = 0; i < 18; i++) {
    const x = (random() - .5) * 500, z = (random() - .5) * 450;
    const cloud = new THREE.Group(); cloud.position.set(x, 40 + random() * 30, z);
    for (let j = 0; j < 5; j++) {
      const puff = sphere(cloud, '#fffdf1', [5 + random() * 5, 2 + random() * 2, 3 + random() * 3],
        [j * 5, random() * 2, random() * 3]);
      puff.castShadow = false; puff.receiveShadow = false;
    }
    scene.add(cloud);
  }
  // Sparse grass tufts and pale stones give the immediate ground a sense of scale.
  for (let i = 0; i < 180; i++) {
    const a = random() * Math.PI * 2, r = 10 + random() * 39;
    const object = mesh(new THREE.DodecahedronGeometry(.15 + random() * .35), '#c0c7a5', scene,
      [Math.cos(a) * r, .05, Math.sin(a) * r]);
    object.scale.y = .4;
  }
}

function batchScenery(scene) {
  scene.updateMatrixWorld(true);
  const batches = new Map();
  scene.traverse((object) => {
    if (!object.isMesh || !object.material.isMeshStandardMaterial) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(object);
  });
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map((object) => object.geometry.clone().applyMatrix4(object.matrixWorld));
    const combined = new THREE.Mesh(mergeGeometries(geometries), objects[0].material);
    combined.castShadow = objects[0].castShadow;
    combined.receiveShadow = objects[0].receiveShadow;
    for (const object of objects) { object.removeFromParent(); object.geometry.dispose(); }
    geometries.forEach((geometry) => geometry.dispose());
    scene.add(combined);
  }
}

export function createWorld(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uSpace: { value: 0.0 },
    },
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      uniform float uSpace;
      varying vec3 vPosition;
      void main() {
        vec3 dir = normalize(vPosition);
        float h = dir.y;
        vec3 dayColor = mix(vec3(0.80,0.89,0.87), vec3(0.44,0.70,0.84), smoothstep(0.0,0.8,h));
        vec3 spaceVoid = vec3(0.008, 0.012, 0.022);
        vec3 nebula = vec3(0.035, 0.045, 0.09) * smoothstep(-0.5, 0.8, sin(dir.x * 2.2 + dir.z * 1.7));
        vec3 spaceColor = spaceVoid + nebula;
        gl_FragColor = vec4(mix(dayColor, spaceColor, uSpace), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 24), skyMat);
  sky.name = 'sky';
  scene.add(sky);

  // 3D Starfield
  const starCount = 2200;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  let sSeed = 197;
  const sRng = () => { sSeed = (sSeed * 16807) % 2147483647; return (sSeed - 1) / 2147483646; };
  for (let i = 0; i < starCount; i++) {
    const theta = sRng() * Math.PI * 2;
    const phi = Math.acos(2.0 * sRng() - 1.0);
    const r = 4100 + sRng() * 300;
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i * 3 + 2] = r * Math.cos(phi);
    const pick = sRng();
    if (pick < 0.6) {
      starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.98; starColors[i * 3 + 2] = 1.0;
    } else if (pick < 0.85) {
      starColors[i * 3] = 0.68; starColors[i * 3 + 1] = 0.88; starColors[i * 3 + 2] = 1.0;
    } else {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.86; starColors[i * 3 + 2] = 0.62;
    }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  const starMat = new THREE.PointsMaterial({
    size: 3.5, vertexColors: true, transparent: true, opacity: 0.0, depthWrite: false,
  });
  const starfield = new THREE.Points(starGeo, starMat);
  starfield.name = 'starfield';
  scene.add(starfield);

  scene.fog = new THREE.FogExp2('#c6e3dd', .0028);
  scene.add(new THREE.HemisphereLight('#f0f9ff', '#8b9b65', 2.6));
  const sun = new THREE.DirectionalLight('#fff6db', 3.3);
  sun.position.set(-35, 65, 35); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, far: 160 });
  sun.shadow.normalBias = .035; sun.shadow.bias = -.0001;
  sun.shadow.radius = 4;
  scene.add(sun);
  createLandscape(scene);
  createPad(scene);
  createOutpost(scene);
  batchScenery(scene);

  createDistantDestination(scene);
  createEmberDestination(scene);

  const ship = createShip();
  ship.name = 'ship';
  ship.position.set(0, 3.2, 0);
  scene.add(ship);

  createJumpEffects(scene, ship);

  return ship;
}

function createDistantDestination(scene) {
  const destGroup = new THREE.Group();
  destGroup.name = 'distantDestination';
  destGroup.visible = false;

  // Ringed Gas Giant Planet (Aurelia Prime)
  const planetCanvas = document.createElement('canvas');
  planetCanvas.width = 512; planetCanvas.height = 256;
  const pctx = planetCanvas.getContext('2d');
  const pgrad = pctx.createLinearGradient(0, 0, 0, 256);
  pgrad.addColorStop(0, '#1c2237');
  pgrad.addColorStop(0.2, '#283d5a');
  pgrad.addColorStop(0.35, '#3a667b');
  pgrad.addColorStop(0.5, '#7fa3b3');
  pgrad.addColorStop(0.65, '#395b64');
  pgrad.addColorStop(0.8, '#d49b59');
  pgrad.addColorStop(1, '#1b2234');
  pctx.fillStyle = pgrad;
  pctx.fillRect(0, 0, 512, 256);
  for (let b = 0; b < 24; b++) {
    pctx.fillStyle = b % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    pctx.fillRect(0, b * 10 + 6, 512, 4 + (b % 3));
  }
  const planetTex = new THREE.CanvasTexture(planetCanvas);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(850, 48, 32),
    new THREE.MeshStandardMaterial({ map: planetTex, roughness: 0.85, metalness: 0.08 })
  );
  planet.position.set(18400, 3900, -2600);
  destGroup.add(planet);

  // Planet Rings
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 256; ringCanvas.height = 1;
  const rctx = ringCanvas.getContext('2d');
  const rgrad = rctx.createLinearGradient(0, 0, 256, 0);
  rgrad.addColorStop(0, 'rgba(200,215,220,0.0)');
  rgrad.addColorStop(0.12, 'rgba(215,230,235,0.8)');
  rgrad.addColorStop(0.46, 'rgba(180,200,208,0.9)');
  rgrad.addColorStop(0.49, 'rgba(25,35,45,0.15)');
  rgrad.addColorStop(0.53, 'rgba(195,212,220,0.85)');
  rgrad.addColorStop(0.9, 'rgba(150,170,180,0.4)');
  rgrad.addColorStop(1, 'rgba(140,160,170,0.0)');
  rctx.fillStyle = rgrad;
  rctx.fillRect(0, 0, 256, 1);
  const ringTex = new THREE.CanvasTexture(ringCanvas);
  const rings = new THREE.Mesh(
    new THREE.RingGeometry(1100, 2100, 96),
    new THREE.MeshStandardMaterial({
      map: ringTex, side: THREE.DoubleSide, transparent: true, opacity: 0.88, roughness: 0.65,
    })
  );
  rings.position.copy(planet.position);
  rings.rotation.x = -Math.PI / 2 + 0.38;
  rings.rotation.y = 0.22;
  destGroup.add(rings);

  // Companion Moon
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(85, 32, 24),
    new THREE.MeshStandardMaterial({ color: '#b2beb5', roughness: 0.9 })
  );
  moon.position.set(19100, 4700, -1800);
  destGroup.add(moon);

  // Distant Space Station (Kepler Haven 01)
  const station = new THREE.Group();
  station.name = 'station';
  station.position.set(19800, 3500, -180);

  // Central hub cylinder
  const hub = cylinder(station, '#d8e4d9', 18, 140, [0, 0, 0], 18);
  hub.rotation.z = Math.PI / 2;

  // Station end caps and docking bays
  cylinder(station, '#4e6761', 22, 14, [-70, 0, 0]);
  cylinder(station, '#4e6761', 22, 14, [70, 0, 0]);
  const dockGate = ring(station, '#73e9d2', 12, 18, [-77, 0, 0]);
  dockGate.rotation.z = Math.PI / 2;

  // Habitat Ring (Rotating)
  const habitatRing = new THREE.Group();
  habitatRing.name = 'habitatRing';
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(85, 6, 24, 64),
    new THREE.MeshStandardMaterial({ color: '#e0ebd8', roughness: 0.45, metalness: 0.3 })
  );
  habitatRing.add(torus);
  for (let i = 0; i < 4; i++) {
    const a = i * (Math.PI / 2);
    const spoke = cylinder(habitatRing, '#6a847b', 2.2, 85, [Math.cos(a) * 42.5, Math.sin(a) * 42.5, 0]);
    spoke.rotation.z = a + Math.PI / 2;
  }
  habitatRing.rotation.y = Math.PI / 2;
  station.add(habitatRing);

  // Solar Arrays
  for (const x of [-35, 35]) {
    for (const z of [-75, 75]) {
      const panel = box(station, '#1c364d', [40, 1.2, 100], [x, 0, z], { metalness: 0.85, roughness: 0.2 });
      panel.rotation.x = 0.25;
      cylinder(station, '#7a8e84', 1.4, 45, [x, 0, z > 0 ? 25 : -25]);
    }
  }

  // Communications spire
  cylinder(station, '#8ca094', 0.8, 65, [0, 48, 0]);
  sphere(station, '#f3b464', [3.5, 3.5, 3.5], [0, 81, 0], { emissive: '#ffb347', emissiveIntensity: 1.5 });

  destGroup.add(station);

  // Approach Guidance Pylons along flight corridor
  const pylons = new THREE.Group();
  pylons.name = 'approachPylons';
  for (let px = 19900; px <= 20700; px += 200) {
    for (const pz of [-38, 38]) {
      cylinder(pylons, '#536d65', 0.9, 14, [px, 3485, pz]);
      const beacon = sphere(pylons, pz > 0 ? '#5fffd7' : '#ffa84d', [1.8, 1.8, 1.8], [px, 3493, pz], {
        emissive: pz > 0 ? '#38f5c6' : '#ff9526', emissiveIntensity: 2.2,
      });
      beacon.name = 'beacon';
    }
  }
  destGroup.add(pylons);

  scene.add(destGroup);
}

function createEmberDestination(scene) {
  const belt = new THREE.Group();
  belt.name = 'emberDestination';
  belt.visible = false;
  // A rocky copper moon and scattered ice-lit asteroids replace Aurelia's station.
  const moon = mesh(new THREE.IcosahedronGeometry(720, 3), '#b76542', belt,
    [18700, 3900, -1700], { roughness: 1, flatShading: true });
  moon.rotation.set(.3, .5, .2);
  for (let i = 0; i < 48; i++) {
    const angle = i * 2.39996;
    const radius = 220 + (i % 9) * 80;
    const rock = mesh(new THREE.DodecahedronGeometry(12 + (i % 7) * 9),
      i % 3 ? '#77685e' : '#9bc8cb', belt,
      [19500 + i * 28, 3500 + Math.sin(angle) * radius, Math.cos(angle) * radius],
      { roughness: .95, flatShading: true });
    rock.rotation.set(angle, angle * .7, angle * .4);
    rock.scale.set(1, .65 + (i % 3) * .25, 1.3);
  }
  // Amber navigation arches keep a clear corridor through the belt.
  for (let i = 0; i < 4; i++) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(28, .6, 8, 48),
      material('#ffc27a', { emissive: '#f38d38', emissiveIntensity: 1.3 }));
    arch.position.set(19850 + i * 220, 3500, 0);
    arch.rotation.y = Math.PI / 2;
    belt.add(arch);
  }
  scene.add(belt);
}

function createJumpEffects(scene, ship) {
  const jumpGroup = new THREE.Group();
  jumpGroup.name = 'jumpEffects';

  // 1. Warp Bubble on the Ship
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 32, 24),
    new THREE.MeshBasicMaterial({
      color: '#6df2ff',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  bubble.name = 'warpBubble';
  ship.add(bubble);

  // 2. Jump Origin Shockwave Ring at [2449, 3500, 0]
  const originRing = new THREE.Mesh(
    new THREE.RingGeometry(2, 6, 64),
    new THREE.MeshBasicMaterial({
      color: '#4ef0ff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  originRing.position.set(2449, 3500, 0);
  originRing.rotation.y = Math.PI / 2;
  originRing.name = 'originRing';
  jumpGroup.add(originRing);

  // 3. Jump Arrival Shockwave Ring & Burst Flare at [20000, 3500, 0]
  const arrivalRing = new THREE.Mesh(
    new THREE.RingGeometry(2, 6, 64),
    new THREE.MeshBasicMaterial({
      color: '#75f7ff',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  arrivalRing.position.set(20000, 3500, 0);
  arrivalRing.rotation.y = Math.PI / 2;
  arrivalRing.name = 'arrivalRing';
  jumpGroup.add(arrivalRing);

  const arrivalBurst = new THREE.Mesh(
    new THREE.SphereGeometry(14, 24, 16),
    new THREE.MeshBasicMaterial({
      color: '#c2faff',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  arrivalBurst.position.set(20000, 3500, 0);
  arrivalBurst.name = 'arrivalBurst';
  jumpGroup.add(arrivalBurst);

  // 4. Warp Streaks / Hyperspace Tunnel lines
  const streakCount = 180;
  const streakPos = new Float32Array(streakCount * 6);
  let wSeed = 51;
  const wRng = () => { wSeed = (wSeed * 16807) % 2147483647; return (wSeed - 1) / 2147483646; };
  for (let i = 0; i < streakCount; i++) {
    const a = wRng() * Math.PI * 2;
    const r = 8 + wRng() * 45;
    const y = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const x1 = -80 - wRng() * 60;
    const x2 = 80 + wRng() * 60;
    streakPos[i * 6] = x1;     streakPos[i * 6 + 1] = y; streakPos[i * 6 + 2] = z;
    streakPos[i * 6 + 3] = x2; streakPos[i * 6 + 4] = y; streakPos[i * 6 + 5] = z;
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streakMat = new THREE.LineBasicMaterial({
    color: '#8afcff',
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.name = 'warpStreaks';
  jumpGroup.add(streaks);

  scene.add(jumpGroup);
}

export function updateWorld(scene, state, now, camera, destination = 'aurelia') {
  const sky = scene.getObjectByName('sky');
  const starfield = scene.getObjectByName('starfield');
  const jumpGroup = scene.getObjectByName('jumpEffects');
  const station = scene.getObjectByName('station');
  const pylons = scene.getObjectByName('approachPylons');

  const space = state?.spaceProgress ?? 0;
  const atDestination = (state?.jumpProgress ?? 0) > .5;
  scene.getObjectByName('distantDestination').visible = atDestination && destination === 'aurelia';
  scene.getObjectByName('emberDestination').visible = atDestination && destination === 'ember';

  // Sky and fog transition
  if (sky?.material?.uniforms?.uSpace) {
    sky.material.uniforms.uSpace.value = space;
  }
  if (starfield) {
    starfield.position.copy(camera.position);
    starfield.material.opacity = space;
  }
  if (scene.fog) {
    scene.fog.density = THREE.MathUtils.lerp(0.0028, 0.00002, space);
  }

  // Station animations
  if (station) {
    const habitatRing = station.getObjectByName('habitatRing');
    if (habitatRing) habitatRing.rotation.x = now * 0.0004;
  }
  // Guidance beacons blinking
  if (pylons) {
    const blink = Math.sin(now * 0.008) > 0 ? 1 : 0.3;
    pylons.traverse((obj) => {
      if (obj.name === 'beacon' && obj.material) {
        obj.material.emissiveIntensity = 1.2 + blink * 1.5;
      }
    });
  }

  // Jump and Warp Effects
  if (jumpGroup) {
    const bubble = scene.getObjectByName('warpBubble');
    const originRing = jumpGroup.getObjectByName('originRing');
    const arrivalRing = jumpGroup.getObjectByName('arrivalRing');
    const arrivalBurst = jumpGroup.getObjectByName('arrivalBurst');
    const streaks = jumpGroup.getObjectByName('warpStreaks');

    const warpCharge = state?.warpCharge ?? 0;
    const jumpActive = state?.jumpActive ?? false;
    const jumpProgress = state?.jumpProgress ?? 0;
    const arrivalProgress = state?.arrivalProgress ?? 0;

    if (bubble) {
      if (jumpActive) {
        bubble.material.opacity = 0.85;
        bubble.scale.set(1.1 + Math.sin(now * 0.05) * 0.1, 1.1, 1.1);
      } else if (warpCharge > 0) {
        bubble.material.opacity = warpCharge * 0.45;
        bubble.scale.setScalar(1.0 + warpCharge * 0.15 + Math.sin(now * 0.03) * 0.05);
      } else if (arrivalProgress > 0 && arrivalProgress < 1) {
        bubble.material.opacity = (1 - arrivalProgress) * 0.6;
      } else {
        bubble.material.opacity = 0.0;
      }
    }

    // Origin shockwave
    if (originRing) {
      if (jumpActive) {
        const ringScale = 1.0 + jumpProgress * 25.0;
        originRing.scale.setScalar(ringScale);
        originRing.material.opacity = (1.0 - jumpProgress) * 0.9;
      } else {
        originRing.material.opacity = 0.0;
      }
    }

    // Arrival shockwave and burst
    if (arrivalRing && arrivalBurst) {
      if (arrivalProgress > 0 && arrivalProgress < 1) {
        const aScale = 1.0 + arrivalProgress * 28.0;
        arrivalRing.scale.setScalar(aScale);
        arrivalRing.material.opacity = Math.max(0, 1.0 - arrivalProgress) * 0.85;
        arrivalBurst.scale.setScalar(1.0 + arrivalProgress * 4.0);
        arrivalBurst.material.opacity = Math.max(0, 1.0 - arrivalProgress * 2.0) * 0.9;
      } else {
        arrivalRing.material.opacity = 0.0;
        arrivalBurst.material.opacity = 0.0;
      }
    }

    // Warp tunnel streaks
    if (streaks) {
      if (jumpActive) {
        streaks.position.copy(camera.position);
        streaks.material.opacity = 0.92;
        streaks.rotation.x = now * 0.01;
      } else {
        streaks.material.opacity = 0.0;
      }
    }
  }

  // Engine plume intensity
  const ship = scene.getObjectByName('ship');
  if (ship) {
    const plumes = [];
    ship.traverse((o) => { if (o.name === 'plume') plumes.push(o); });
    for (const plume of plumes) {
      if (state?.jumpActive) {
        plume.scale.set(1.8, 3.5, 1.8);
        plume.material.emissiveIntensity = 3.5;
        plume.material.opacity = 0.85;
      } else if (state?.stage === 'climb' || state?.stage === 'space' || (state?.warpCharge ?? 0) > 0) {
        plume.scale.set(1.4, 2.0, 1.4);
        plume.material.emissiveIntensity = 2.2;
        plume.material.opacity = 0.65;
      } else {
        plume.scale.set(1, 1, 1);
        plume.material.emissiveIntensity = 0.8;
        plume.material.opacity = 0.34;
      }
    }
  }
}
