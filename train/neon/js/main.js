import * as THREE from 'three';
import { clamp } from './prng.js';
import {
  DURATION,
  SHOTS,
  getTrainState,
  getCameraState,
  getShotIndexAt
} from './timetable.js';
import {
  createBuildingTextures,
  createArmorTexture,
  createConcreteTexture,
  createCitySnowGroundTexture,
  createGlowTexture,
  createSteamTexture,
  createStationSignTexture
} from './textures.js';
import { createTrain } from './train.js';
import { createWorld } from './world.js';
import { createAudioEngine } from './audio.js';

const ASPECT = 9 / 16;
const MAX_RENDER_WIDTH = 1080;

// DOM references
const stageEl = document.getElementById('stage');
const canvas = document.getElementById('scene-canvas');
const topBarEl = document.getElementById('top-bar');
const bottomBarEl = document.getElementById('bottom-bar');
const shotIndexEl = document.getElementById('shot-index');
const shotNameEl = document.getElementById('shot-name');
const timeReadoutEl = document.getElementById('time-readout');
const progressTrackEl = document.getElementById('progress-track');
const progressFillEl = document.getElementById('progress-fill');
const shotMarkersEl = document.getElementById('shot-markers');

const overlayStartEl = document.getElementById('overlay-start');
const overlayReplayEl = document.getElementById('overlay-replay');
const btnStart = document.getElementById('btn-start');
const btnReplay = document.getElementById('btn-replay');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNextShot = document.getElementById('btn-next-shot');
const btnMute = document.getElementById('btn-mute');
const iconPause = document.getElementById('icon-pause');
const iconPlay = document.getElementById('icon-play');
const labelPlayPause = document.getElementById('label-play-pause');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');

// Populate shot cut markers along progress bar
for (let i = 1; i < SHOTS.length; i++) {
  const mk = document.createElement('span');
  mk.className = 'shot-marker';
  mk.style.left = `${(SHOTS[i].start / DURATION) * 100}%`;
  shotMarkersEl.appendChild(mk);
}

// ---------------------------------------------------------------------------
// Three.js Renderer, Scene & Camera (strict 9:16 portrait composition)
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1322);

const camera = new THREE.PerspectiveCamera(54, ASPECT, 0.5, 2200);

// Generate procedural textures once (seeded, zero external assets)
const buildingTex = createBuildingTextures(101);
const armorMap = createArmorTexture(202);
const concreteMap = createConcreteTexture(303);
const cityGroundMap = createCitySnowGroundTexture(505);
const glowMap = createGlowTexture();
const steamMap = createSteamTexture(404);
const stationSignMap = createStationSignTexture();

// Build world & armored train
const world = createWorld(scene, {
  buildingTex,
  concreteMap,
  cityGroundMap,
  glowMap,
  stationSignMap
});

const train = createTrain({
  armorMap,
  glowMap,
  steamMap
});
scene.add(train.root);

// Procedural WebAudio soundscape
const audio = createAudioEngine();

// ---------------------------------------------------------------------------
// Playback & Scene State
// ---------------------------------------------------------------------------
let currentTime = 0.0;
let isPlaying = false;
let hasStarted = false;
let isFinished = false;
let lastRafMs = null;
let renderPixelHeight = 960;

const publicTrainState = {
  distance: 0,
  speed: 0,
  cars: 9,
  atStation: false,
  inTunnel: false
};

let currentShotId = SHOTS[0].id;

function formatTime(sec) {
  const s = Math.max(0, Math.min(DURATION, sec));
  const whole = Math.floor(s);
  const mins = Math.floor(whole / 60);
  const rem = whole % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function syncHudUI(t, camState) {
  shotIndexEl.textContent = camState.shotNum;
  shotNameEl.textContent = camState.shotTitle;
  timeReadoutEl.textContent = `${formatTime(t)} / 01:00`;

  const pct = (clamp(t, 0, DURATION) / DURATION) * 100;
  progressFillEl.style.width = `${pct.toFixed(2)}%`;
  progressTrackEl.setAttribute('aria-valuenow', t.toFixed(1));

  // Play/Pause button state
  iconPause.classList.toggle('hidden', !isPlaying);
  iconPlay.classList.toggle('hidden', isPlaying);
  labelPlayPause.textContent = isPlaying ? 'Pause' : 'Resume';
  btnPlayPause.setAttribute('aria-label', isPlaying ? 'Pause playback' : 'Resume playback');

  // Hide HUD while Start or Replay modal covers screen
  const hideHud = !hasStarted || isFinished;
  topBarEl.classList.toggle('hud-hidden', hideHud);
  bottomBarEl.classList.toggle('hud-hidden', hideHud);
}

function setOverlayState({ showStart, showReplay, instant = false }) {
  overlayStartEl.classList.toggle('overlay-instant', instant);
  overlayReplayEl.classList.toggle('overlay-instant', instant);

  overlayStartEl.classList.toggle('overlay-visible', showStart);
  overlayStartEl.setAttribute('aria-hidden', String(!showStart));

  overlayReplayEl.classList.toggle('overlay-visible', showReplay);
  overlayReplayEl.setAttribute('aria-hidden', String(!showReplay));
}

function syncPublicScene(t, camState, trainState) {
  currentShotId = camState.shot;
  publicTrainState.distance = Number(trainState.distance.toFixed(3));
  publicTrainState.speed = trainState.speed === 0 ? 0 : Number(trainState.speed.toFixed(3));
  publicTrainState.cars = trainState.cars;
  publicTrainState.atStation = trainState.atStation;
  publicTrainState.inTunnel = trainState.inTunnel;

  // Keep window.__scene properties updated synchronously
  window.__scene.shot = currentShotId;
  window.__scene.time = Number(t.toFixed(4));
  window.__scene.playing = isPlaying;
}

/**
 * Pure deterministic render of frame at exact time t (in seconds).
 * Guaranteed identical output for identical t regardless of frame rate or history.
 */
function renderAt(rawTime) {
  const t = clamp(rawTime, 0, DURATION);
  currentTime = t;

  const trainState = getTrainState(t);
  const camState = getCameraState(t);

  // Apply camera transform & FOV (aspect locked strictly to 9:16)
  camera.position.set(camState.position.x, camState.position.y, camState.position.z);
  camera.lookAt(camState.target.x, camState.target.y, camState.target.z);
  if (Math.abs(camera.fov - camState.fov) > 0.001) {
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }

  // Update deterministic train & world geometry/shaders
  train.update(t, renderPixelHeight);
  world.update(t, camera.position, trainState.inTunnel, renderPixelHeight);

  // Render frame synchronously
  renderer.render(scene, camera);

  // Sync exposed API & HUD
  syncPublicScene(t, camState, trainState);
  syncHudUI(t, camState);
}

// ---------------------------------------------------------------------------
// Responsive 9:16 Resize & Phone-Friendly DPR Capping
// ---------------------------------------------------------------------------
function resizeRenderer() {
  const rect = stageEl.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width));
  const cssH = Math.max(1, Math.round(rect.height));

  // Cap DPR to 2 and internal drawing buffer width to <= 1080px for smooth 60fps on phone GPUs
  const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
  const effDpr = cssW * rawDpr > MAX_RENDER_WIDTH ? MAX_RENDER_WIDTH / cssW : rawDpr;

  renderer.setPixelRatio(effDpr);
  renderer.setSize(cssW, cssH, false);
  renderPixelHeight = Math.round(cssH * effDpr);

  camera.aspect = ASPECT;
  camera.updateProjectionMatrix();
}

resizeRenderer();
window.addEventListener('resize', () => {
  resizeRenderer();
  renderAt(currentTime);
});

// ---------------------------------------------------------------------------
// Expose window.__scene API
// ---------------------------------------------------------------------------
window.__scene = {
  shot: currentShotId,
  time: 0,
  playing: false,
  train: publicTrainState,
  seek(t) {
    const targetT = clamp(Number(t) || 0, 0, DURATION);
    hasStarted = true;
    isFinished = false;
    setOverlayState({ showStart: false, showReplay: false, instant: true });
    audio.resetTriggers();
    renderAt(targetT);
    if (isPlaying && targetT >= DURATION) {
      finishPlayback();
    }
    return window.__scene;
  }
};

// ---------------------------------------------------------------------------
// Playback Controls (Start, Replay, Pause/Resume, Skip Shot, Mute)
// ---------------------------------------------------------------------------
function startPlayback(fromBeginning = false) {
  if (fromBeginning) {
    currentTime = 0;
    audio.resetTriggers();
  }
  hasStarted = true;
  isFinished = false;
  isPlaying = true;
  lastRafMs = null;
  setOverlayState({ showStart: false, showReplay: false });
  audio.resume();
  renderAt(currentTime);
}

function finishPlayback() {
  isPlaying = false;
  isFinished = true;
  currentTime = DURATION;
  audio.pause();
  renderAt(DURATION);
  setOverlayState({ showStart: false, showReplay: true });
}

function togglePause() {
  if (!hasStarted) {
    startPlayback(true);
    return;
  }
  if (isFinished) {
    startPlayback(true);
    return;
  }
  isPlaying = !isPlaying;
  lastRafMs = null;
  if (isPlaying) {
    audio.resume();
  } else {
    audio.pause();
  }
  renderAt(currentTime);
}

function skipToNextShot(delta = 1) {
  if (!hasStarted) {
    hasStarted = true;
    setOverlayState({ showStart: false, showReplay: false });
  }
  if (isFinished) {
    isFinished = false;
    setOverlayState({ showStart: false, showReplay: false });
  }

  const curIdx = getShotIndexAt(currentTime);
  const nextIdx = (curIdx + delta + SHOTS.length) % SHOTS.length;
  const targetT = SHOTS[nextIdx].start;
  audio.resetTriggers();
  lastRafMs = null;
  renderAt(targetT);
}

function toggleMute() {
  const next = !audio.isMuted();
  audio.setMuted(next);
  iconSoundOn.classList.toggle('hidden', next);
  iconSoundOff.classList.toggle('hidden', !next);
  btnMute.setAttribute('aria-pressed', String(next));
  btnMute.setAttribute('aria-label', next ? 'Unmute audio' : 'Mute audio');
}

// Button listeners
btnStart.addEventListener('click', () => startPlayback(true));
btnReplay.addEventListener('click', () => startPlayback(true));
btnPlayPause.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});
btnNextShot.addEventListener('click', (e) => {
  e.stopPropagation();
  skipToNextShot(1);
});
btnMute.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMute();
});

// Progress bar scrub
progressTrackEl.addEventListener('click', (e) => {
  e.stopPropagation();
  const rect = progressTrackEl.getBoundingClientRect();
  const frac = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  audio.resetTriggers();
  renderAt(frac * DURATION);
});

// Canvas tap (pause/resume) & touch swipe-left/right (skip shot)
let pointerDownX = 0;
let pointerDownY = 0;
let pointerDownMs = 0;
let pointerActive = false;

canvas.addEventListener('pointerdown', (e) => {
  pointerActive = true;
  pointerDownX = e.clientX;
  pointerDownY = e.clientY;
  pointerDownMs = performance.now();
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerActive) return;
  pointerActive = false;
  if (!hasStarted || isFinished) return;

  const dx = e.clientX - pointerDownX;
  const dy = e.clientY - pointerDownY;
  const dt = performance.now() - pointerDownMs;

  // Horizontal swipe -> skip shot
  if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 650) {
    skipToNextShot(dx < 0 ? 1 : -1);
    return;
  }

  // Clean tap -> pause/resume
  if (Math.hypot(dx, dy) < 18 && dt < 450) {
    togglePause();
  }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.code) {
    case 'Space':
    case 'KeyP':
    case 'KeyK':
      e.preventDefault();
      togglePause();
      break;
    case 'ArrowRight':
    case 'KeyN':
      e.preventDefault();
      skipToNextShot(1);
      break;
    case 'ArrowLeft':
    case 'KeyB':
      e.preventDefault();
      skipToNextShot(-1);
      break;
    case 'KeyM':
      e.preventDefault();
      toggleMute();
      break;
    case 'KeyR':
      e.preventDefault();
      startPlayback(true);
      break;
    default:
      break;
  }
});

// ---------------------------------------------------------------------------
// Main Animation Loop (strictly wall-clock delta driven, zero frame-rate drift)
// ---------------------------------------------------------------------------
function tick(nowMs) {
  requestAnimationFrame(tick);

  if (!isPlaying) return;

  if (lastRafMs === null) {
    lastRafMs = nowMs;
    return;
  }

  // Cap single-frame delta to prevent huge jumps after background tab switch
  const dt = Math.min((nowMs - lastRafMs) / 1000, 0.1);
  lastRafMs = nowMs;

  const nextTime = currentTime + dt;
  if (nextTime >= DURATION) {
    finishPlayback();
    return;
  }

  renderAt(nextTime);
  audio.update(currentTime, getTrainState(currentTime), true);
}

// Render initial t = 0 frame immediately behind Start overlay
renderAt(0);
requestAnimationFrame(tick);
