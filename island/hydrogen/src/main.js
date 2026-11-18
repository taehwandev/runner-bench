import * as THREE from 'three';
import { createAudioEngine } from './audio.js';
import { DURATION, evaluateCamera, getShotIndex, SHOTS } from './camera.js';
import { createFoliage } from './foliage.js';
import { createLighthouse } from './lighthouse.js';
import { createOcean } from './ocean.js';
import { createAtmosphereState, evaluateAtmosphere } from './palette.js';
import { clamp } from './prng.js';
import { createSky } from './sky.js';
import { createIsland } from './terrain.js';

const stageEl = document.getElementById('stage');
const canvasHost = document.getElementById('canvas-host');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const startBtn = document.getElementById('start-btn');
const hudEl = document.getElementById('hud');
const progressFill = document.getElementById('progress-fill');
const shotLabel = document.getElementById('shot-label');
const timeLabel = document.getElementById('time-label');
const pauseBtn = document.getElementById('pause-btn');
const nextBtn = document.getElementById('next-btn');

const dpr = Math.min(window.devicePixelRatio || 1, 2);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasHost.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const fog = new THREE.FogExp2('#d9ccb8', 0.0021);
scene.fog = fog;

// Strict 9:16 portrait camera
const camera = new THREE.PerspectiveCamera(52, 9 / 16, 0.4, 420);

// Lighting
const hemiLight = new THREE.HemisphereLight('#8ac7f2', '#594b38', 1.05);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#fff0cc', 3.1);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 160;
const shadowBounds = 38;
sunLight.shadow.camera.left = -shadowBounds;
sunLight.shadow.camera.right = shadowBounds;
sunLight.shadow.camera.top = shadowBounds;
sunLight.shadow.camera.bottom = -shadowBounds;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const moonLight = new THREE.DirectionalLight('#b5d2ff', 0);
scene.add(moonLight);

// World modules
const sky = createSky(dpr);
scene.add(sky.group);

const island = createIsland(2026);
scene.add(island.group);

const foliage = createFoliage(8080);
scene.add(foliage.group);

const lighthouse = createLighthouse();
scene.add(lighthouse.group);

const ocean = createOcean({
  heightTexture: island.heightTexture,
  mapHalfSize: island.mapHalfSize
});
scene.add(ocean.mesh);

const audio = createAudioEngine();

const atmo = createAtmosphereState();
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();

let currentTime = 0;
let currentShot = 0;
let isPlaying = false;
let hasStarted = false;
let hasEnded = false;
let lastTimestamp = 0;

function formatTime(sec) {
  const s = Math.floor(clamp(sec, 0, DURATION));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateHUD() {
  const pct = (clamp(currentTime, 0, DURATION) / DURATION) * 100;
  progressFill.style.width = `${pct.toFixed(2)}%`;
  const shotObj = SHOTS[currentShot] || SHOTS[0];
  shotLabel.textContent = `Shot ${currentShot + 1}/${SHOTS.length} · ${shotObj.name}`;
  timeLabel.textContent = `${formatTime(currentTime)} / 01:00`;
  pauseBtn.textContent = isPlaying ? 'Pause' : 'Resume';
}

function renderAt(t) {
  const ct = clamp(t, 0, DURATION);
  currentTime = ct;

  evaluateAtmosphere(ct, atmo);

  fog.color.copy(atmo.fogColor);
  fog.density = atmo.fogDensity;
  renderer.toneMappingExposure = atmo.exposure;

  hemiLight.color.copy(atmo.hemiSky);
  hemiLight.groundColor.copy(atmo.hemiGround);
  hemiLight.intensity = atmo.hemiIntensity;

  sunLight.position.copy(atmo.sunDir).multiplyScalar(75);
  sunLight.color.copy(atmo.sunColor);
  sunLight.intensity = atmo.sunIntensity;

  moonLight.position.copy(atmo.moonDir).multiplyScalar(75);
  moonLight.intensity = atmo.moonIntensity;

  island.cottageWindowMat.emissiveIntensity = atmo.cottagePower * 2.4;

  foliage.update(ct);
  lighthouse.update(ct, atmo.lighthousePower);

  const camState = evaluateCamera(ct, camPos, camTarget);
  currentShot = camState.shot;
  if (camera.fov !== camState.fov) {
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  sky.update(ct, atmo, camera.position);
  ocean.update(ct, atmo, lighthouse);

  renderer.render(scene, camera);
  updateHUD();
}

function resizeRenderer() {
  const rect = stageEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  renderer.setSize(w, h, false);
  // Keep camera aspect strictly 9:16 matching #stage
  camera.aspect = 9 / 16;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  resizeRenderer();
  renderAt(currentTime);
});

function showReplayOverlay() {
  overlayTitle.textContent = 'Nightfall';
  overlaySub.textContent = 'Sixty seconds from late afternoon to starry night.';
  startBtn.textContent = 'Replay';
  overlayEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
}

function startOrReplay() {
  hasStarted = true;
  hasEnded = false;
  isPlaying = true;
  currentTime = 0;
  lastTimestamp = performance.now();
  overlayEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  audio.start();
  renderAt(0);
}

function togglePause() {
  if (!hasStarted || hasEnded) return;
  isPlaying = !isPlaying;
  if (isPlaying) {
    lastTimestamp = performance.now();
    audio.resume();
  } else {
    audio.pause();
  }
  updateHUD();
}

function skipToNextShot() {
  if (!hasStarted || hasEnded) return;
  const idx = getShotIndex(currentTime);
  if (idx < SHOTS.length - 1) {
    const nextStart = SHOTS[idx + 1].start;
    lastTimestamp = performance.now();
    renderAt(nextStart);
  } else {
    // At last shot, jump to end
    isPlaying = false;
    hasEnded = true;
    audio.pause();
    renderAt(DURATION);
    showReplayOverlay();
  }
}

startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startOrReplay();
});

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

nextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  skipToNextShot();
});

// Touch & click on canvas: tap toggles pause, horizontal swipe-left skips shot
let touchStartX = 0;
let touchStartY = 0;
let touchHandledSwipe = false;

stageEl.addEventListener('touchstart', (e) => {
  if (e.target.closest('button')) return;
  if (e.touches.length === 1) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchHandledSwipe = false;
  }
}, { passive: true });

stageEl.addEventListener('touchend', (e) => {
  if (e.target.closest('button')) return;
  if (!hasStarted || hasEnded) return;
  const touch = e.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (dx < -42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    touchHandledSwipe = true;
    skipToNextShot();
  }
}, { passive: true });

canvasHost.addEventListener('click', () => {
  if (touchHandledSwipe) {
    touchHandledSwipe = false;
    return;
  }
  togglePause();
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
    e.preventDefault();
    if (!hasStarted || hasEnded) {
      startOrReplay();
    } else {
      togglePause();
    }
  } else if (e.code === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    skipToNextShot();
  }
});

// Expose deterministic inspection & frame-capture API
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
    hasEnded = target >= DURATION;
    if (hasEnded) {
      isPlaying = false;
      audio.pause();
      showReplayOverlay();
    } else {
      overlayEl.classList.add('hidden');
      hudEl.classList.remove('hidden');
    }
    lastTimestamp = performance.now();
    renderAt(target);
  }
};

function tick(now) {
  requestAnimationFrame(tick);
  if (!isPlaying) return;

  const dt = Math.min(0.1, Math.max(0, (now - lastTimestamp) / 1000));
  lastTimestamp = now;

  const nextT = currentTime + dt;
  if (nextT >= DURATION) {
    isPlaying = false;
    hasEnded = true;
    audio.update(DURATION, false);
    audio.pause();
    renderAt(DURATION);
    showReplayOverlay();
    return;
  }

  renderAt(nextT);
  audio.update(nextT, true);
}

resizeRenderer();
renderAt(0);
requestAnimationFrame(tick);
