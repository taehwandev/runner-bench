import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  DEFAULT_TARGET, DEFAULT_DIR, DEFAULT_DIST, FOOT_OFFSET, FOLLOW_AFTER_DEPART, ZOOM_TAP,
} from './config.js';
import { easeInOut } from './util.js';
import { createFlight, resetFlight, startLap, stepFlight } from './flight.js';
import { buildShip, updateShip } from './ship.js';
import { buildPad, updatePad, surfaceHeight } from './pad.js';
import { buildEnvironment } from './environment.js';
import { createUi, renderControls, renderHud, bindZoomButton } from './ui.js';

// ---------- Renderer, scene, camera ----------
const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (err) {
  document.getElementById('fallback').hidden = false;
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);

const env = buildEnvironment(scene);
const pad = buildPad(scene);
const ship = buildShip();
scene.add(ship.root);
const flight = createFlight();
const ui = createUi();

// ---------- Orbit controls ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;                 // follow mode owns the target
controls.minDistance = 3;
controls.maxDistance = 220;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI * 0.49;    // stay above the ground
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;

// ---------- Camera rig ----------
let follow = false;
let tween = null;
const tmp = new THREE.Vector3();

// Pad view, widened on portrait screens so the pad still fits
function defaultView() {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const needed = 9 / (tanHalf * camera.aspect);
  return {
    pos: DEFAULT_TARGET.clone().addScaledVector(DEFAULT_DIR, Math.max(DEFAULT_DIST, needed)),
    target: DEFAULT_TARGET.clone(),
  };
}

function startTween(toPos, toTarget, dur) {
  tween = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos,
    toTarget,
    t: 0,
    dur,
  };
}

function updateTween(dt) {
  tween.t = Math.min(tween.dur, tween.t + dt);
  const k = easeInOut(tween.t / tween.dur);
  camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
  controls.target.lerpVectors(tween.fromTarget, tween.toTarget, k);
  if (tween.t >= tween.dur) tween = null;
}

// Keeps the camera rigidly attached to the ship, so the user's orbit and zoom
// stay relative to it. A short pull-in closes any gap when follow turns on.
function updateFollow(dt) {
  const move = tmp.subVectors(flight.position, flight.prevPosition);
  controls.target.add(move);
  camera.position.add(move);
  const gap = tmp.subVectors(flight.position, controls.target).multiplyScalar(1 - Math.exp(-dt * 5));
  controls.target.add(gap);
  camera.position.add(gap);
}

function setFollow(on) {
  follow = on;
  if (on) tween = null;
  renderControls(ui, flight.phase, follow);
}

function resetCamera() {
  setFollow(false);
  const v = defaultView();
  startTween(v.pos, v.target, 1.2);
}

function zoomBy(factor) {
  tween = null;
  const offset = tmp.copy(camera.position).sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
}

function launch() {
  if (flight.phase === 'away') {
    resetFlight(flight);
    resetCamera();
  } else if (flight.phase === 'hover') {
    setFollow(true);
    startLap(flight);
  }
  renderControls(ui, flight.phase, follow);
}

// ---------- Input ----------
ui.launch.addEventListener('click', launch);
ui.follow.addEventListener('click', () => setFollow(!follow));
ui.reset.addEventListener('click', resetCamera);
bindZoomButton(ui.zoomIn, zoomBy, ZOOM_TAP);
bindZoomButton(ui.zoomOut, zoomBy, 1 / ZOOM_TAP);

addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case 'l': launch(); break;
    case 'f': setFollow(!follow); break;
    case 'r': resetCamera(); break;
    case '+': case '=': zoomBy(ZOOM_TAP); break;
    case '-': case '_': zoomBy(1 / ZOOM_TAP); break;
  }
});

// Direct orbit or zoom cancels an in-progress camera move
controls.addEventListener('start', () => { tween = null; });

// ---------- Sizing ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.9 ? 58 : 50;
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);

// ---------- Start ----------
onResize();
{
  const v = defaultView();
  camera.position.copy(v.pos);
  controls.target.copy(v.target);
  controls.update();
}
renderControls(ui, flight.phase, follow);

function renderHudNow() {
  const p = flight.position;
  renderHud(ui, {
    altitude: Math.max(0, p.y - FOOT_OFFSET - surfaceHeight(p.x, p.z)),
    speed: flight.speed,
    range: Math.hypot(p.x, p.z),
  });
}

let last = performance.now();
let hudTimer = 0;
let lastPhase = flight.phase;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  stepFlight(flight, dt);
  if (flight.phase !== lastPhase) {
    lastPhase = flight.phase;
    renderControls(ui, flight.phase, follow);
  }
  if (flight.phase === 'away' && flight.t > FOLLOW_AFTER_DEPART && follow) setFollow(false);

  updateShip(ship, flight, dt);
  updatePad(pad, flight, flight.elapsed);

  if (tween) updateTween(dt);
  else if (follow) updateFollow(dt);
  controls.update();

  env.update(camera, dt);
  renderer.render(scene, camera);

  hudTimer += dt;
  if (hudTimer > 0.1) {
    hudTimer = 0;
    renderHudNow();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
