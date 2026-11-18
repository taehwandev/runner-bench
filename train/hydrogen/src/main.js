import * as THREE from 'three';
import { clamp, lerp } from './prng.js';
import {
  DURATION,
  SHOTS,
  getShotIndexAtTime,
  getShotAtTime,
  getTrainState,
} from './timeline.js';
import {
  createArmorTextures,
  createTowerFacadeTextures,
  createConcreteTexture,
  createSnowGroundTexture,
} from './textures.js';
import { createTrainSystem } from './train.js';
import { createWorld } from './world.js';
import { createCameraRig } from './camera.js';
import { createAudioEngine } from './audio.js';

const stageFrame = document.getElementById('stage-frame');
const canvas = document.getElementById('scene-canvas');
const startOverlay = document.getElementById('start-overlay');
const replayOverlay = document.getElementById('replay-overlay');
const btnStart = document.getElementById('btn-start');
const btnReplay = document.getElementById('btn-replay');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNextShot = document.getElementById('btn-next-shot');
const hudBar = document.getElementById('hud-bar');
const hudTime = document.getElementById('hud-time');
const hudShot = document.getElementById('hud-shot');
const hudProgressFill = document.getElementById('hud-progress-fill');
const iconPause = document.getElementById('icon-pause');
const iconPlay = document.getElementById('icon-play');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let currentPixelRatio = Math.min(window.devicePixelRatio || 1, 2);

function updateViewportSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const targetAspect = 9 / 16;

  let frameW = vw;
  let frameH = vw / targetAspect;
  if (frameH > vh) {
    frameH = vh;
    frameW = vh * targetAspect;
  }

  frameW = Math.max(180, Math.floor(frameW));
  frameH = Math.max(320, Math.floor(frameH));

  stageFrame.style.width = `${frameW}px`;
  stageFrame.style.height = `${frameH}px`;

  currentPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(currentPixelRatio);
  renderer.setSize(frameW, frameH, false);
}

// --- Scene & Lighting ---
const scene = new THREE.Scene();
const fogColorDusk = new THREE.Color(0x1b2842);
const fogColorNight = new THREE.Color(0x070d19);
const fog = new THREE.FogExp2(fogColorDusk.getHex(), 0.003);
scene.fog = fog;
scene.background = fogColorDusk.clone();

const ambientLight = new THREE.AmbientLight(0x3a4f74, 0.72);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x82a2dc, 0x26344d, 1.15);
scene.add(hemiLight);

const sunColorDusk = new THREE.Color(0xffb48a);
const sunColorNight = new THREE.Color(0x7aa0e6);
const dirLight = new THREE.DirectionalLight(sunColorDusk.getHex(), 1.55);
dirLight.position.set(-140, 56, -240);
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x7898cf, 0.95);
fillLight.position.set(140, 32, 120);
scene.add(fillLight);

// --- World, Train, Camera, Audio ---
const textures = {
  armor: createArmorTextures(),
  tower: createTowerFacadeTextures(4201),
  concrete: createConcreteTexture(),
  snowGround: createSnowGroundTexture(),
};

const world = createWorld(scene, textures);
const trainSystem = createTrainSystem(scene, textures);
const cameraRig = createCameraRig();
const audio = createAudioEngine();

// --- Playback State ---
let currentTime = 0;
let isPlaying = false;
let hasStarted = false;
let currentShot = 1;
let currentTrainState = getTrainState(0);
let lastFrameMs = null;

function formatTimecode(sec) {
  const s = Math.floor(clamp(sec, 0, DURATION));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateUI() {
  const showStart = !hasStarted && currentTime === 0 && !isPlaying;
  const showReplay = currentTime >= DURATION && !isPlaying;

  startOverlay.hidden = !showStart;
  replayOverlay.hidden = !showReplay;
  hudBar.hidden = showStart;

  iconPause.hidden = !isPlaying;
  iconPlay.hidden = isPlaying;
  btnPlayPause.setAttribute('aria-label', isPlaying ? 'Pause' : 'Resume');

  const shotIdx = getShotIndexAtTime(currentTime);
  hudShot.textContent = `SHOT ${String(shotIdx + 1).padStart(2, '0')}/${String(SHOTS.length).padStart(2, '0')}`;
  hudTime.textContent = `${formatTimecode(currentTime)} / 01:00`;
  hudProgressFill.style.width = `${(clamp(currentTime / DURATION, 0, 1) * 100).toFixed(2)}%`;
}

function renderAtTime(tSec) {
  const t = clamp(tSec, 0, DURATION);
  currentTime = t;
  currentTrainState = getTrainState(t);
  currentShot = getShotAtTime(t);

  // Dusk-to-night atmosphere interpolation
  const night = clamp(t / DURATION, 0, 1);
  fog.color.copy(fogColorDusk).lerp(fogColorNight, night);
  scene.background.copy(fog.color);
  fog.density = currentTrainState.inTunnel ? 0.0034 : lerp(0.0029, 0.0032, night);

  ambientLight.intensity = lerp(0.72, 0.42, night);
  hemiLight.intensity = lerp(1.15, 0.58, night);
  dirLight.color.copy(sunColorDusk).lerp(sunColorNight, night);
  dirLight.intensity = lerp(1.55, 0.65, night);
  fillLight.intensity = lerp(0.95, 0.52, night);

  trainSystem.update(t, currentTrainState, currentPixelRatio);
  const camInfo = cameraRig.update(t, currentTrainState);
  world.update(t, camInfo.focusPos, currentTrainState, currentPixelRatio, fog.color);

  renderer.render(scene, cameraRig.camera);
  updateUI();
}

function startPlayback() {
  hasStarted = true;
  currentTime = 0;
  isPlaying = true;
  lastFrameMs = null;
  audio.unlockAndPlay();
  audio.syncSeek(0, getTrainState(0));
  renderAtTime(0);
}

function togglePlayPause() {
  if (!hasStarted && currentTime === 0) {
    startPlayback();
    return;
  }
  if (currentTime >= DURATION) {
    startPlayback();
    return;
  }
  isPlaying = !isPlaying;
  lastFrameMs = null;
  if (isPlaying) {
    audio.unlockAndPlay();
  }
  audio.setPlaying(isPlaying);
  updateUI();
}

function seek(tSec) {
  const t = clamp(Number(tSec) || 0, 0, DURATION);
  if (t > 0) hasStarted = true;
  if (t >= DURATION) {
    isPlaying = false;
    audio.setPlaying(false);
  }
  lastFrameMs = null;
  renderAtTime(t);
  audio.syncSeek(t, currentTrainState);
}

function skipToNextShot() {
  if (!hasStarted && currentTime === 0) {
    hasStarted = true;
  }
  const idx = getShotIndexAtTime(currentTime);
  if (idx < SHOTS.length - 1) {
    const nextStart = SHOTS[idx + 1].start;
    seek(nextStart);
  } else {
    seek(DURATION);
  }
}

// --- Expose window.__scene API ---
window.__scene = Object.defineProperties(
  {
    seek,
  },
  {
    shot: {
      enumerable: true,
      get: () => currentShot,
    },
    time: {
      enumerable: true,
      get: () => currentTime,
    },
    playing: {
      enumerable: true,
      get: () => isPlaying,
    },
    train: {
      enumerable: true,
      get: () => ({
        distance: currentTrainState.distance,
        speed: currentTrainState.speed,
        cars: currentTrainState.cars,
        atStation: currentTrainState.atStation,
        inTunnel: currentTrainState.inTunnel,
      }),
    },
  }
);

// --- Events: Buttons, Touch & Keyboard ---
btnStart.addEventListener('click', (e) => {
  e.stopPropagation();
  startPlayback();
});

btnReplay.addEventListener('click', (e) => {
  e.stopPropagation();
  startPlayback();
});

btnPlayPause.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePlayPause();
});

btnNextShot.addEventListener('click', (e) => {
  e.stopPropagation();
  skipToNextShot();
});

// Tap canvas to pause/resume, horizontal swipe left to skip to next shot
let touchStartX = null;
let touchStartY = null;
let suppressClick = false;

stageFrame.addEventListener(
  'touchstart',
  (e) => {
    if (e.target.closest('button')) return;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  },
  { passive: true }
);

stageFrame.addEventListener(
  'touchend',
  (e) => {
    if (e.target.closest('button')) return;
    if (touchStartX === null || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    touchStartX = null;
    touchStartY = null;

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && dx < 0) {
      suppressClick = true;
      skipToNextShot();
    }
  },
  { passive: true }
);

canvas.addEventListener('click', () => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (hasStarted && currentTime < DURATION) {
    togglePlayPause();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'KeyK') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'ArrowRight' || e.code === 'KeyN') {
    e.preventDefault();
    skipToNextShot();
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    startPlayback();
  } else if (e.code === 'Enter' && (!hasStarted || currentTime >= DURATION)) {
    e.preventDefault();
    startPlayback();
  }
});

window.addEventListener('resize', () => {
  updateViewportSize();
  renderAtTime(currentTime);
});

// --- Main Loop ---
function animate(nowMs) {
  requestAnimationFrame(animate);

  if (isPlaying) {
    if (lastFrameMs === null) lastFrameMs = nowMs;
    const dt = clamp((nowMs - lastFrameMs) / 1000, 0, 0.1);
    lastFrameMs = nowMs;

    const nextTime = currentTime + dt;
    if (nextTime >= DURATION) {
      currentTime = DURATION;
      isPlaying = false;
      audio.setPlaying(false);
      renderAtTime(DURATION);
    } else {
      renderAtTime(nextTime);
      audio.update(currentTime, currentTrainState, true);
    }
  }
}

updateViewportSize();
renderAtTime(0);
requestAnimationFrame(animate);
