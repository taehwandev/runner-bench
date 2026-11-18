import * as THREE from 'three';
import { clamp } from './prng.js';
import {
  DURATION,
  SHOTS,
  getShotIndex,
  createAtmosphereState,
  evaluateAtmosphere,
  evaluateCamera,
} from './timeline.js';
import { createIslandGroup, createHeightmapTexture } from './terrain.js';
import { createSkySystem } from './sky.js';
import { createOcean } from './ocean.js';
import { createFoliageSystem } from './foliage.js';
import { createLighthouseSystem } from './lighthouse.js';
import { createAudioEngine } from './audio.js';

// --- DOM Elements ---
const stageEl = document.getElementById('stage');
const canvas = document.getElementById('scene-canvas');
const overlayStart = document.getElementById('overlay-start');
const overlayReplay = document.getElementById('overlay-replay');
const btnStart = document.getElementById('btn-start');
const btnReplay = document.getElementById('btn-replay');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnNextShot = document.getElementById('btn-next-shot');
const btnMute = document.getElementById('btn-mute');
const iconPause = document.getElementById('icon-pause');
const iconPlay = document.getElementById('icon-play');
const playPauseText = document.getElementById('play-pause-text');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const shotLabelEl = document.getElementById('shot-label');
const timeDisplayEl = document.getElementById('time-display');
const progressFillEl = document.getElementById('progress-fill');
const shotMarkersEl = document.getElementById('shot-markers');

// Build timeline shot cut markers
for (let i = 1; i < SHOTS.length; i++) {
  const m = document.createElement('div');
  m.className = 'shot-marker';
  m.style.left = `${(SHOTS[i].start / DURATION) * 100}%`;
  shotMarkersEl.appendChild(m);
}

// --- Renderer & Scene ---
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0xdcc7ab, 0.002);
scene.fog = fog;

// Locked 9:16 portrait camera so every shot keeps identical framing on any display
const PORTRAIT_ASPECT = 9 / 16;
const camera = new THREE.PerspectiveCamera(46, PORTRAIT_ASPECT, 0.35, 520);

// --- Lights ---
const hemiLight = new THREE.HemisphereLight(0x8cc6f2, 0x7a7c58, 1.35);
scene.add(hemiLight);

// Subtle ocean-bounce fill light from the South-East so shaded beach/palm fronts never crush to black
const bounceLight = new THREE.DirectionalLight(0x9ec4e6, 0.55);
bounceLight.position.set(28, 18, 42);
scene.add(bounceLight);

const keyLight = new THREE.DirectionalLight(0xfff3d8, 3.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 5;
keyLight.shadow.camera.far = 140;
keyLight.shadow.camera.left = -36;
keyLight.shadow.camera.right = 36;
keyLight.shadow.camera.top = 36;
keyLight.shadow.camera.bottom = -36;
keyLight.shadow.bias = -0.0008;
scene.add(keyLight);

// --- World Systems ---
const heightmapTex = createHeightmapTexture(256);
const skySystem = createSkySystem();
scene.add(skySystem.group);

const islandGroup = createIslandGroup();
scene.add(islandGroup);

const foliageSystem = createFoliageSystem();
scene.add(foliageSystem.group);

const lighthouseSystem = createLighthouseSystem();
scene.add(lighthouseSystem.group);

const ocean = createOcean(heightmapTex);
scene.add(ocean.mesh);

const audio = createAudioEngine();

// --- State ---
const atmo = createAtmosphereState();
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();

let currentTime = 0;
let currentShot = 0;
let isPlaying = false;
let hasStarted = false;
let hasEnded = false;
let lastFrameMs = 0;
let currentPixelRatio = 1;

// --- Resize Handler (caps DPR & max internal buffer at 1080x1920 for smooth 60fps on phones) ---
function handleResize() {
  const w = Math.max(1, stageEl.clientWidth);
  const h = Math.max(1, stageEl.clientHeight);
  const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
  // Ensure internal width never exceeds 1080px for mobile GPU stability
  const cappedDpr = Math.min(rawDpr, 1080 / w);
  currentPixelRatio = Math.max(1, Math.min(rawDpr, cappedDpr));

  renderer.setPixelRatio(currentPixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = PORTRAIT_ASPECT;
  camera.updateProjectionMatrix();

  renderFrame(currentTime);
}

window.addEventListener('resize', handleResize);
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(handleResize).observe(stageEl);
}

// --- Format Time ---
function formatClock(sec) {
  const s = Math.floor(clamp(sec, 0, DURATION));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// --- Deterministic Frame Evaluation & Render ---
function renderFrame(t) {
  const ct = clamp(t, 0, DURATION);
  currentTime = ct;

  // 1. Atmosphere & Lighting
  evaluateAtmosphere(ct, atmo);
  renderer.toneMappingExposure = atmo.exposure;

  fog.color.copy(atmo.fogColor);
  fog.density = atmo.fogDensity;

  hemiLight.color.copy(atmo.hemiSky);
  hemiLight.groundColor.copy(atmo.hemiGround);
  hemiLight.intensity = atmo.hemiIntensity;

  bounceLight.color.copy(atmo.skyHorizon);
  bounceLight.intensity = 0.55 * (1.0 - atmo.nightFactor * 0.65);

  keyLight.color.copy(atmo.sunLight);
  keyLight.intensity = atmo.sunIntensity;
  keyLight.position.copy(atmo.keyLightDir).multiplyScalar(68);

  // 2. World Updates (pure functions of ct)
  skySystem.update(ct, atmo, currentPixelRatio);
  foliageSystem.update(ct);
  lighthouseSystem.update(ct, atmo);
  ocean.update(ct, atmo, lighthouseSystem.beamState);

  // 3. Camera
  const { shotIdx, fov } = evaluateCamera(ct, camPos, camTarget);
  currentShot = shotIdx;
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  // 4. HUD Sync
  shotLabelEl.textContent = SHOTS[shotIdx].label;
  timeDisplayEl.textContent = `${formatClock(ct)} / 01:00`;
  progressFillEl.style.width = `${(ct / DURATION) * 100}%`;

  // 5. Render synchronously
  renderer.render(scene, camera);
}

function updateOverlayUI() {
  const showStart = !hasStarted && !hasEnded;
  const showReplay = hasEnded;
  overlayStart.classList.toggle('is-visible', showStart);
  overlayReplay.classList.toggle('is-visible', showReplay);
  stageEl.classList.toggle('is-overlay-open', showStart || showReplay);

  iconPause.toggleAttribute('hidden', !isPlaying);
  iconPlay.toggleAttribute('hidden', isPlaying);
  playPauseText.textContent = isPlaying ? 'Pause' : 'Resume';
}

function startPlayback() {
  hasStarted = true;
  hasEnded = false;
  currentTime = 0;
  isPlaying = true;
  lastFrameMs = performance.now();
  audio.resetTriggers();
  audio.setPlaying(true);
  updateOverlayUI();
  renderFrame(0);
}

function togglePlayPause() {
  if (!hasStarted || hasEnded) {
    startPlayback();
    return;
  }
  isPlaying = !isPlaying;
  if (isPlaying) {
    lastFrameMs = performance.now();
  }
  audio.setPlaying(isPlaying);
  updateOverlayUI();
}

function skipToNextShot() {
  if (!hasStarted) {
    hasStarted = true;
    hasEnded = false;
    isPlaying = true;
    lastFrameMs = performance.now();
    audio.setPlaying(true);
  }
  const nextIdx = currentShot + 1;
  if (nextIdx < SHOTS.length) {
    hasEnded = false;
    renderFrame(SHOTS[nextIdx].start);
    lastFrameMs = performance.now();
  } else {
    // On final shot, skipping completes to Replay
    isPlaying = false;
    hasEnded = true;
    audio.setPlaying(false);
    renderFrame(DURATION);
  }
  updateOverlayUI();
}

function skipToPrevShot() {
  if (!hasStarted) return;
  hasEnded = false;
  const shotStart = SHOTS[currentShot].start;
  const targetIdx = currentTime - shotStart > 1.2 ? currentShot : Math.max(0, currentShot - 1);
  renderFrame(SHOTS[targetIdx].start);
  lastFrameMs = performance.now();
  updateOverlayUI();
}

function toggleMute() {
  const nextMuted = !audio.isMuted();
  audio.setMuted(nextMuted);
  iconSoundOn.toggleAttribute('hidden', nextMuted);
  iconSoundOff.toggleAttribute('hidden', !nextMuted);
}

// --- Main Animation Loop ---
function tick(nowMs) {
  requestAnimationFrame(tick);
  if (!isPlaying) return;

  const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
  lastFrameMs = nowMs;

  const nextT = currentTime + dt;
  if (nextT >= DURATION) {
    isPlaying = false;
    hasEnded = true;
    audio.setPlaying(false);
    renderFrame(DURATION);
    updateOverlayUI();
    return;
  }

  renderFrame(nextT);
  audio.update(currentTime, currentShot);
}

// --- Event Listeners (Buttons, Keyboard, Touch Gestures) ---
btnStart.addEventListener('click', startPlayback);
btnReplay.addEventListener('click', startPlayback);
btnPlayPause.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePlayPause();
});
btnNextShot.addEventListener('click', (e) => {
  e.stopPropagation();
  skipToNextShot();
});
btnMute.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMute();
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'KeyK') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'ArrowRight' || e.code === 'KeyN' || e.code === 'KeyL') {
    e.preventDefault();
    skipToNextShot();
  } else if (e.code === 'ArrowLeft' || e.code === 'KeyJ') {
    e.preventDefault();
    skipToPrevShot();
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    toggleMute();
  } else if (e.code === 'KeyR') {
    e.preventDefault();
    startPlayback();
  }
});

// Touch & click on canvas: tap to pause/resume, swipe left/right to skip shots
let pointerStartX = 0;
let pointerStartY = 0;
let pointerActive = false;

canvas.addEventListener('pointerdown', (e) => {
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  pointerActive = true;
});

canvas.addEventListener('pointerup', (e) => {
  if (!pointerActive) return;
  pointerActive = false;
  if (!hasStarted || hasEnded) return;

  const dx = e.clientX - pointerStartX;
  const dy = e.clientY - pointerStartY;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    if (dx < 0) {
      skipToNextShot();
    } else {
      skipToPrevShot();
    }
  } else if (Math.hypot(dx, dy) < 16) {
    togglePlayPause();
  }
});

// --- Automated Check & Frame Capture API ---
window.__scene = {
  get shot() {
    return currentShot;
  },
  get time() {
    return currentTime;
  },
  get playing() {
    return isPlaying;
  },
  seek(t) {
    const target = clamp(Number(t) || 0, 0, DURATION);
    hasStarted = true;
    hasEnded = false;
    updateOverlayUI();
    lastFrameMs = performance.now();
    renderFrame(target);
    if (isPlaying) {
      audio.update(currentTime, currentShot);
    }
    return currentTime;
  },
};

// Initial layout & deterministic frame 0
handleResize();
updateOverlayUI();
requestAnimationFrame(tick);
