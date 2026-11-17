import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FlightController, FlightPhase } from './flight/state.js';
import { createSpaceship } from './scene/spaceship.js';
import { createEnvironment } from './scene/environment.js';
import { AudioManager } from './audio/sound.js';

// Setup Three.js Core
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.2,
  800
);
const DEFAULT_CAM_POS = new THREE.Vector3(16, 9, 22);
const DEFAULT_CAM_TARGET = new THREE.Vector3(0, 1.8, 0);
camera.position.copy(DEFAULT_CAM_POS);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.04; // Keep above ground level
controls.minDistance = 3.0;
controls.maxDistance = 140.0;
controls.target.copy(DEFAULT_CAM_TARGET);

// Audio & Flight Systems
const audio = new AudioManager();
const flight = new FlightController();
const spaceship = createSpaceship();
scene.add(spaceship.mesh);
const env = createEnvironment(scene);

// Camera modes: 'ORBIT', 'CHASE', 'TOWER'
let cameraMode = 'ORBIT';
const TOWER_POS = new THREE.Vector3(26, 14, -22);

// UI Element References
const elStatusBadge = document.getElementById('status-badge');
const elStatusText = document.getElementById('status-text');
const elAlt = document.getElementById('telemetry-alt');
const elSpd = document.getElementById('telemetry-spd');
const elThr = document.getElementById('telemetry-thr');
const elDist = document.getElementById('telemetry-dist');
const btnMainAction = document.getElementById('btn-main-action');
const mainActionText = document.getElementById('main-action-text');
const mainActionIcon = document.getElementById('main-action-icon');
const btnPause = document.getElementById('btn-pause');
const pauseText = document.getElementById('pause-text');
const pauseIcon = document.getElementById('pause-icon');
const btnSound = document.getElementById('btn-sound');
const soundIcon = document.getElementById('sound-icon');
const soundText = document.getElementById('sound-text');

// Camera UI Buttons
const btnCamOrbit = document.getElementById('cam-orbit');
const btnCamChase = document.getElementById('cam-chase');
const btnCamTower = document.getElementById('cam-tower');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnResetCam = document.getElementById('btn-reset-cam');

function setCameraMode(mode) {
  cameraMode = mode;
  [btnCamOrbit, btnCamChase, btnCamTower].forEach(b => b.classList.remove('active'));
  if (mode === 'ORBIT') {
    btnCamOrbit.classList.add('active');
    controls.enabled = true;
  } else if (mode === 'CHASE') {
    btnCamChase.classList.add('active');
    controls.enabled = false;
  } else if (mode === 'TOWER') {
    btnCamTower.classList.add('active');
    controls.enabled = false;
  }
}

btnCamOrbit.addEventListener('click', () => setCameraMode('ORBIT'));
btnCamChase.addEventListener('click', () => setCameraMode('CHASE'));
btnCamTower.addEventListener('click', () => setCameraMode('TOWER'));

// Smooth Camera Reset
let isResettingCamera = false;
let resetStartTime = 0;
const resetStartPos = new THREE.Vector3();
const resetStartTarget = new THREE.Vector3();

btnResetCam.addEventListener('click', () => {
  setCameraMode('ORBIT');
  isResettingCamera = true;
  resetStartTime = performance.now();
  resetStartPos.copy(camera.position);
  resetStartTarget.copy(controls.target);
});

// Zoom In & Out Buttons
btnZoomIn.addEventListener('click', () => {
  if (cameraMode !== 'ORBIT') setCameraMode('ORBIT');
  const dir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
  const currentDist = camera.position.distanceTo(controls.target);
  if (currentDist > controls.minDistance + 2) {
    camera.position.addScaledVector(dir, 4.0);
  }
});

btnZoomOut.addEventListener('click', () => {
  if (cameraMode !== 'ORBIT') setCameraMode('ORBIT');
  const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
  const currentDist = camera.position.distanceTo(controls.target);
  if (currentDist < controls.maxDistance - 4) {
    camera.position.addScaledVector(dir, 5.0);
  }
});

// Primary Flight Action Trigger
let lastPhase = FlightPhase.READY;

function handleMainAction() {
  audio.init();
  if (flight.phase === FlightPhase.READY) {
    flight.initiateTakeoff();
    audio.playTakeoffChime();
  } else if (flight.phase === FlightPhase.CIRCUIT) {
    flight.requestLandNow();
  }
  updateUI();
}

btnMainAction.addEventListener('click', handleMainAction);

// Pause / Hold Trigger
btnPause.addEventListener('click', () => {
  audio.init();
  const paused = flight.togglePause();
  pauseText.textContent = paused ? 'Resume' : 'Hold';
  pauseIcon.textContent = paused ? '▶️' : '⏸️';
});

// Speed Toggle Buttons
document.querySelectorAll('.speed-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const speed = parseFloat(btn.getAttribute('data-speed'));
    flight.setSpeed(speed);
  });
});

// Sound Toggle
btnSound.addEventListener('click', () => {
  audio.init();
  const muted = audio.toggleMute();
  soundIcon.textContent = muted ? '🔇' : '🔊';
  soundText.textContent = muted ? 'Muted' : 'Sound';
});

// Telemetry & UI Refresh
function updateUI() {
  const t = flight.getTelemetry();

  elAlt.textContent = `${t.altitudeMeters.toFixed(1)} m`;
  elSpd.textContent = `${t.speedKmh} km/h`;
  elThr.textContent = `${t.throttlePercent}%`;
  elDist.textContent = `${t.distanceToPadMeters.toFixed(1)} m`;

  // Status badge update
  let statusText = 'PAD READY';
  let badgeClass = 'status-badge';

  if (t.phase === FlightPhase.READY) {
    statusText = 'PAD READY';
    btnMainAction.disabled = false;
    btnMainAction.className = 'primary-btn';
    mainActionIcon.textContent = '🚀';
    mainActionText.textContent = 'Initiate Takeoff';
    btnPause.disabled = true;
  } else if (t.phase === FlightPhase.TAKEOFF) {
    statusText = 'ASCENT TO HOVER';
    btnMainAction.disabled = true;
    btnMainAction.className = 'primary-btn';
    mainActionIcon.textContent = '⏳';
    mainActionText.textContent = 'Climbing...';
    btnPause.disabled = false;
  } else if (t.phase === FlightPhase.CIRCUIT) {
    statusText = 'TEST CIRCUIT';
    btnMainAction.disabled = false;
    btnMainAction.className = 'primary-btn land-btn';
    mainActionIcon.textContent = '🛬';
    mainActionText.textContent = 'Land Now';
    btnPause.disabled = false;
  } else if (t.phase === FlightPhase.APPROACH) {
    statusText = 'APPROACH VECTOR';
    btnMainAction.disabled = true;
    btnMainAction.className = 'primary-btn land-btn';
    mainActionIcon.textContent = '⏳';
    mainActionText.textContent = 'Aligning...';
    btnPause.disabled = false;
  } else if (t.phase === FlightPhase.LANDING) {
    statusText = 'FINAL TOUCHDOWN';
    btnMainAction.disabled = true;
    btnMainAction.className = 'primary-btn land-btn';
    mainActionIcon.textContent = '⏳';
    mainActionText.textContent = 'Landing...';
    btnPause.disabled = false;
  }

  elStatusText.textContent = statusText;

  // Sound cues on phase transitions
  if (lastPhase !== t.phase) {
    if (t.phase === FlightPhase.READY && lastPhase === FlightPhase.LANDING) {
      audio.playTouchdownChime();
    }
    lastPhase = t.phase;
  }

  audio.updateEngine(t.throttlePercent);
}

// Chase and Tower Camera update helpers
function updateDynamicCameras(shipPos, shipRot) {
  if (cameraMode === 'CHASE') {
    // Over-the-shoulder chase view behind ship
    const heading = shipRot.y;
    const distanceBehind = 9.0;
    const heightAbove = 4.2;

    const targetCamX = shipPos.x - Math.sin(heading) * distanceBehind;
    const targetCamZ = shipPos.z - Math.cos(heading) * distanceBehind;
    const targetCamY = shipPos.y + heightAbove;

    camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);

    // Look slightly forward of ship
    const lookTarget = new THREE.Vector3(
      shipPos.x + Math.sin(heading) * 4.0,
      shipPos.y + 1.0,
      shipPos.z + Math.cos(heading) * 4.0
    );
    camera.lookAt(lookTarget);
  } else if (cameraMode === 'TOWER') {
    camera.position.lerp(TOWER_POS, 0.1);
    camera.lookAt(shipPos.x, shipPos.y + 0.8, shipPos.z);
  }
}

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(0.1, clock.getDelta());
  const elapsed = clock.getElapsedTime();

  // Update flight mechanics
  const telemetry = flight.update(delta);
  spaceship.updateState(telemetry, elapsed);
  env.update(elapsed);

  // Update camera
  if (isResettingCamera) {
    const elapsedReset = (performance.now() - resetStartTime) / 700;
    if (elapsedReset >= 1.0) {
      camera.position.copy(DEFAULT_CAM_POS);
      controls.target.copy(DEFAULT_CAM_TARGET);
      isResettingCamera = false;
    } else {
      const ease = 0.5 - 0.5 * Math.cos(elapsedReset * Math.PI);
      camera.position.lerpVectors(resetStartPos, DEFAULT_CAM_POS, ease);
      controls.target.lerpVectors(resetStartTarget, DEFAULT_CAM_TARGET, ease);
    }
  } else if (cameraMode === 'ORBIT') {
    controls.update();
  } else {
    updateDynamicCameras(telemetry.position, telemetry.rotation);
  }

  updateUI();
  renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Enable audio on user interaction
['click', 'touchstart'].forEach((eventType) => {
  window.addEventListener(eventType, () => audio.init(), { once: true });
});

// Start loop
animate();
