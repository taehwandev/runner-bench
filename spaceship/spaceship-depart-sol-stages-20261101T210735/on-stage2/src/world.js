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
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vPosition; void main(){float h=normalize(vPosition).y; gl_FragColor=vec4(mix(vec3(0.80,0.89,0.87),vec3(0.44,0.70,0.84),smoothstep(0.0,0.8,h)),1.0);}',
  }));
  sky.name = 'sky';
  scene.add(sky);
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
  const ship = createShip(); ship.position.set(0, 3.2, 0); scene.add(ship);
  return ship;
}
