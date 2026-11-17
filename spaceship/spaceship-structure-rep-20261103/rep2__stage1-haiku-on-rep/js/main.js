// Bootstrap: builds the renderer, scene and controls, then runs the frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFlight, launch, stepFlight } from './flight.js';
import { buildShip, NOZZLES } from './ship.js';
import { createExhaust } from './effects.js';
import { buildSky, HORIZON_COLOR } from './sky.js';
import { buildTerrain } from './terrain.js';
import { buildPad } from './pad.js';
import { createCameraRig } from './camera-rig.js';
import { createUi } from './ui.js';
import { mulberry32, disposeTree } from './util.js';

const HOME = {
  pos: new THREE.Vector3(-16, 9, 22),
  target: new THREE.Vector3(0, 2.5, 0),
};

function main() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(HORIZON_COLOR), 160, 900);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 3000);
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 3;
  controls.maxDistance = 420;
  controls.maxPolarAngle = Math.PI * 0.48; // keep the camera above the ground
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  const rng = mulberry32(7);
  const sky = buildSky(scene, rng);
  buildTerrain(scene, rng);
  const pad = buildPad(scene);
  const ship = buildShip();
  scene.add(ship.group);
  const exhaust = createExhaust(scene, NOZZLES);

  const flight = createFlight();
  const rig = createCameraRig({ camera, controls, home: HOME });
  const ui = createUi({
    onLaunch: () => {
      if (launch(flight)) rig.startLaunchCamera();
    },
    onZoomIn: () => rig.zoom(0.8),
    onZoomOut: () => rig.zoom(1.25),
    onReset: () => rig.reset(),
    onFollow: (on) => rig.setFollow(on),
  });
  controls.addEventListener('start', () => rig.cancelAuto());

  let shownPhase = null;

  // Copies the flight state onto the ship's transform, glow and visibility.
  function applyShip() {
    const { position: p, heading: h, thrust } = flight;
    ship.group.visible = flight.visible;
    ship.group.position.set(p.x, p.y, p.z);
    ship.group.scale.setScalar(flight.scale);
    ship.group.lookAt(p.x + h.x, p.y + h.y, p.z + h.z);
    for (const glow of ship.glows) {
      glow.material.opacity = Math.min(thrust, 1) * 0.9;
      glow.scale.setScalar(0.9 + 0.4 * Math.min(thrust, 2));
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 62 : 45; // portrait phones need a wider vertical view
    camera.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  let frameId = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    stepFlight(flight, dt);
    if (flight.phase !== shownPhase) {
      shownPhase = flight.phase;
      ui.showPhase(shownPhase);
    }
    applyShip();
    exhaust.update(dt, flight.thrust, ship.group);

    rig.update(dt, flight);
    ui.setFollow(rig.followOn);
    controls.update();

    sky.update(dt, camera.position);
    pad.update(elapsed, flight.phase);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  frame();

  return function dispose() {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    ui.dispose();
    controls.dispose();
    disposeTree(scene);
    renderer.dispose();
  };
}

try {
  const dispose = main();
  window.__sceneReady = true;
  document.getElementById('loading').classList.add('hidden');
  window.addEventListener('pagehide', dispose, { once: true });
} catch (err) {
  console.error(err);
  document.querySelector('#loading span').textContent = 'The 3D view needs WebGL. Try another browser or device.';
}
