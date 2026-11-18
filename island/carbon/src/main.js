import * as THREE from 'three';
import { clamp, lerp } from './math.js';
import { buildBathymetryTexture } from './terrain-data.js';
import {
  TOTAL_DURATION,
  createAtmosphereState,
  evaluateAtmosphere,
  evaluateCameraRig,
  getNextShotStartTime,
} from './timeline.js';
import { createSkySystem } from './sky-stars.js';
import { createOceanSystem } from './ocean.js';
import { createIslandSystem } from './island.js';
import { createFoliageSystem } from './foliage.js';
import { createLighthouseSystem } from './lighthouse.js';
import { createSoundscape } from './audio.js';
import { createUIController } from './ui.js';

const ASPECT = 9 / 16;

const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd9c7a8, 0.0022);

const camera = new THREE.PerspectiveCamera(52, ASPECT, 0.25, 1200);

// Scene lighting rig
const hemiLight = new THREE.HemisphereLight(0x7cb2e8, 0x4d4232, 1.0);
const sunLight = new THREE.DirectionalLight(0xfff0c8, 3.0);
const moonLight = new THREE.DirectionalLight(0x7ea8eb, 0.0);
scene.add(hemiLight, sunLight, moonLight);

// Deterministic procedural world subsystems
const bathymetryTex = buildBathymetryTexture(256);
const skySystem = createSkySystem(1);
const islandSystem = createIslandSystem();
const foliageSystem = createFoliageSystem();
const lighthouseSystem = createLighthouseSystem();
const oceanSystem = createOceanSystem(bathymetryTex);

// Sync exact lantern world elevation to ocean reflection uniform
oceanSystem.mesh.material.uniforms.uLighthousePos.value.copy(lighthouseSystem.lanternWorldPos);

scene.add(
  skySystem.group,
  islandSystem.group,
  foliageSystem.group,
  lighthouseSystem.group,
  oceanSystem.mesh
);

const soundscape = createSoundscape();
const atmoState = createAtmosphereState();
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const upVec = new THREE.Vector3();

let currentTime = 0.0;
let currentShotId = 1;
let isPlaying = false;
let playAnchorWallMs = 0;
let playAnchorSceneSec = 0;

// Public deterministic scene controller
const sceneApi = {
  shot: 1,
  time: 0.0,
  playing: false,
  seek(t) {
    const targetTime = clamp(Number.isFinite(t) ? t : 0, 0, TOTAL_DURATION);
    currentTime = targetTime;
    playAnchorWallMs = performance.now();
    playAnchorSceneSec = targetTime;

    if (targetTime >= TOTAL_DURATION && isPlaying) {
      isPlaying = false;
      soundscape.setPlaying(false, TOTAL_DURATION);
      ui.setOverlayMode('replay');
    } else if (ui.getOverlayMode() !== 'hidden') {
      ui.setOverlayMode('hidden');
    }

    soundscape.onSeek(targetTime);
    renderAt(targetTime);
    return sceneApi;
  },
};
window.__scene = sceneApi;

const ui = createUIController({
  isPlaying: () => isPlaying,
  onPrimaryAction() {
    soundscape.unlock();
    startPlaybackFrom(currentTime >= TOTAL_DURATION ? 0.0 : currentTime);
  },
  onTogglePlay() {
    soundscape.unlock();
    if (isPlaying) {
      pausePlayback();
    } else if (currentTime >= TOTAL_DURATION) {
      startPlaybackFrom(0.0);
    } else {
      startPlaybackFrom(currentTime);
    }
  },
  onNextShot() {
    soundscape.unlock();
    const nextStart = getNextShotStartTime(currentTime);
    currentTime = nextStart;
    playAnchorWallMs = performance.now();
    playAnchorSceneSec = nextStart;
    if (ui.getOverlayMode() === 'replay') {
      ui.setOverlayMode('hidden');
    }
    soundscape.onSeek(nextStart);
    renderAt(nextStart);
    ui.wakeHudTemporarily(isPlaying);
  },
  onScrub(targetSec) {
    const clamped = clamp(targetSec, 0, TOTAL_DURATION);
    currentTime = clamped;
    playAnchorWallMs = performance.now();
    playAnchorSceneSec = clamped;
    if (ui.getOverlayMode() !== 'hidden' && clamped < TOTAL_DURATION) {
      ui.setOverlayMode('hidden');
    }
    soundscape.onSeek(clamped);
    renderAt(clamped);
    ui.wakeHudTemporarily(isPlaying);
  },
  onToggleMute() {
    return soundscape.toggleMute();
  },
});

function startPlaybackFrom(startSec) {
  currentTime = clamp(startSec, 0, TOTAL_DURATION);
  isPlaying = true;
  playAnchorWallMs = performance.now();
  playAnchorSceneSec = currentTime;
  ui.setOverlayMode('hidden');
  ui.wakeHudTemporarily(true);
  soundscape.setPlaying(true, currentTime);
  renderAt(currentTime);
}

function pausePlayback() {
  if (!isPlaying) return;
  isPlaying = false;
  ui.wakeHudTemporarily(false);
  soundscape.setPlaying(false, currentTime);
  syncApiState();
  ui.syncState(currentTime, evaluateCameraRig(currentTime, camPos, camTarget).shot, isPlaying);
}

function syncApiState() {
  sceneApi.shot = currentShotId;
  sceneApi.time = currentTime;
  sceneApi.playing = isPlaying;
}

function resizeStage() {
  const rect = ui.stage.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  // Cap DPR for smooth 60fps on phone GPUs and cap physical buffer height at 1920px
  const rawDpr = window.devicePixelRatio || 1;
  const dpr = clamp(Math.min(rawDpr, 2, 1920 / height), 1, 2);

  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  camera.aspect = ASPECT;
  camera.updateProjectionMatrix();
  skySystem.setPixelRatio(dpr);
  renderAt(currentTime);
}

function renderAt(t) {
  const time = clamp(t, 0, TOTAL_DURATION);
  currentTime = time;

  evaluateAtmosphere(time, atmoState);
  const { shot, fov, roll } = evaluateCameraRig(time, camPos, camTarget);
  currentShotId = shot.id;

  if (Math.abs(camera.fov - fov) > 1e-3) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.position.copy(camPos);
  upVec.set(Math.sin(roll), Math.cos(roll), 0).normalize();
  camera.up.copy(upVec);
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();

  // Update atmosphere, fog, tone mapping exposure, and scene lights
  scene.fog.color.copy(atmoState.fogColor);
  scene.fog.density = atmoState.fogDensity;
  renderer.toneMappingExposure = lerp(1.06, 1.22, atmoState.starVisibility);

  hemiLight.color.copy(atmoState.ambientSky);
  hemiLight.groundColor.copy(atmoState.ambientGround);
  hemiLight.intensity = lerp(1.06, 0.74, atmoState.starVisibility);

  sunLight.color.copy(atmoState.sunColor);
  sunLight.intensity = atmoState.sunIntensity;
  sunLight.position.copy(atmoState.sunDir).multiplyScalar(120);

  moonLight.intensity = atmoState.moonIntensity;
  moonLight.position.copy(atmoState.moonDir).multiplyScalar(100);

  // Update all deterministic visual and audio systems
  skySystem.update(time, atmoState, camera.position);
  islandSystem.update(time, atmoState);
  foliageSystem.update(time, atmoState);
  lighthouseSystem.update(time, atmoState, camera.position);
  oceanSystem.update(time, atmoState);
  soundscape.update(time, atmoState, camera.position);

  syncApiState();
  ui.syncState(time, shot, isPlaying);

  renderer.render(scene, camera);
}

function tick(nowMs) {
  if (isPlaying) {
    const elapsed = (nowMs - playAnchorWallMs) / 1000;
    const nextTime = playAnchorSceneSec + elapsed;
    if (nextTime >= TOTAL_DURATION) {
      currentTime = TOTAL_DURATION;
      isPlaying = false;
      soundscape.setPlaying(false, TOTAL_DURATION);
      ui.setOverlayMode('replay');
      ui.wakeHudTemporarily(false);
      renderAt(TOTAL_DURATION);
    } else {
      renderAt(nextTime);
    }
  }
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resizeStage);
resizeStage();
ui.setOverlayMode('start');
renderAt(0.0);
requestAnimationFrame(tick);
