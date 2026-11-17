// Bootstrap: renderer, loop, and wiring between flight state, scene, camera and UI.
import * as THREE from 'three';
import { createFlight, launch, step } from './flight.js';
import { buildWorld } from './world.js';
import { createShip } from './ship.js';
import { createExhaust } from './exhaust.js';
import { createCameraRig } from './camera-rig.js';
import { createUi } from './ui.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 3000);
const world = buildWorld(scene);
const ship = createShip();
const exhaust = createExhaust(scene);
const rig = createCameraRig(camera, canvas);
const ui = createUi();
scene.add(ship.object);

let flight = createFlight();
let lastPhase = flight.phase;
let lastFollowing = flight.following;
const clock = new THREE.Clock();
const backward = new THREE.Vector3();
const origin = new THREE.Vector3();

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false); // CSS sizes the canvas to the viewport
  rig.setAspect(width / height);
}

// Phase changes update the UI; camera follow is driven by the flight model's flag
function syncPhase() {
  ui.render(flight.phase);
}

function onLaunch() {
  if (launch(flight)) syncPhase();
}

function onReplay() {
  flight = createFlight();
  exhaust.clear();
  rig.reset();
  lastPhase = flight.phase;
  lastFollowing = flight.following;
  syncPhase();
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); // clamp so a backgrounded tab does not jump
  step(flight, dt);

  if (flight.phase !== lastPhase) {
    lastPhase = flight.phase;
    syncPhase();
  }
  // Only forward changes: a user reset can cancel follow mid-flight without it re-arming
  if (flight.following !== lastFollowing) {
    lastFollowing = flight.following;
    rig.setFollowing(flight.following);
  }

  ship.applyFlight(flight);
  if (flight.thrust > 0.2) {
    const d = flight.dir;
    backward.set(-d.x, -d.y, -d.z);
    exhaust.emit(dt, ship.engineOrigin(origin), backward, flight.thrust);
  }
  exhaust.update(dt);

  rig.update(dt, ship.object.position);
  world.update(dt, clock.elapsedTime, camera.position);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

const { launch: launchBtn, replay, reset, zoomIn, zoomOut } = ui.controls;
launchBtn.addEventListener('click', onLaunch);
replay.addEventListener('click', onReplay);
reset.addEventListener('click', () => rig.reset());
zoomIn.addEventListener('click', () => rig.zoomBy(0.7));
zoomOut.addEventListener('click', () => rig.zoomBy(1.4));

// Shortcuts: L launch, R reset camera, +/- zoom. Ignored while typing in a field.
window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.matches('input, textarea, select')) return;
  switch (event.key.toLowerCase()) {
    case 'l':
      onLaunch();
      break;
    case 'r':
      rig.reset();
      break;
    case '+':
    case '=':
      rig.zoomBy(0.7);
      break;
    case '-':
    case '_':
      rig.zoomBy(1.4);
      break;
  }
});

window.addEventListener('resize', resize);
resize();
rig.snapHome();
syncPhase();
frame();
ui.hideLoading();
