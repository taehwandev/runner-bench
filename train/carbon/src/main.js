import * as THREE from "three";
import { createTimeline } from "./timeline.js";
import { createProceduralTextures } from "./textures.js";
import { createWinterEnvMap } from "./envmap.js";
import { createTrackSystem } from "./track.js";
import { createTrainSystem } from "./train.js";
import { createCityEnvironment } from "./city.js";
import { createStructures } from "./structures.js";
import { createBridgeEnvironment } from "./bridge.js";
import { createAtmosphereSystem } from "./atmosphere.js";
import { createCameraDirector } from "./camera.js";
import { createAudioEngine } from "./audio.js";
import { createHudController } from "./ui.js";

const PORTRAIT_ASPECT = 9 / 16;

export function bootScene() {
  const timeline = createTimeline();
  const canvas = document.getElementById("scene-canvas");
  const stageFrame = document.getElementById("stage-frame");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.environment = createWinterEnvMap(renderer);
  scene.environmentIntensity = 0.88;

  const camera = new THREE.PerspectiveCamera(50, PORTRAIT_ASPECT, 0.4, 2400);

  const textures = createProceduralTextures();
  const track = createTrackSystem(scene, textures);
  const city = createCityEnvironment(scene, track, textures);
  createStructures(scene, track, timeline, textures);
  const bridge = createBridgeEnvironment(scene, track, timeline, textures);
  const atmosphere = createAtmosphereSystem(scene, track, timeline, textures);
  const train = createTrainSystem(scene, track, timeline, textures);
  const cameraDirector = createCameraDirector(camera, track);
  const audio = createAudioEngine();

  let currentTime = 0.0;
  let playing = false;
  let playAnchorWallMs = 0;
  let playAnchorSceneSec = 0;

  const sceneApi = {
    shot: 1,
    time: 0,
    playing: false,
    train: {
      distance: 0,
      speed: 28,
      cars: timeline.carCount,
      atStation: false,
      inTunnel: false,
    },
    seek(targetSeconds) {
      const clamped = timeline.clampTime(targetSeconds);
      currentTime = clamped;
      playAnchorWallMs = performance.now();
      playAnchorSceneSec = clamped;
      const state = renderAtTime(clamped);
      audio.onSeek(state, playing);
      if (clamped < timeline.duration && hud.getMode() === "ended") {
        hud.setMode("active");
      }
      return sceneApi.train;
    },
  };
  window.__scene = sceneApi;

  const hud = createHudController(timeline, {
    onStart() {
      currentTime = 0.0;
      playing = true;
      playAnchorWallMs = performance.now();
      playAnchorSceneSec = 0.0;
      const state = renderAtTime(0.0);
      audio.unlockAndPlay(state);
    },
    onReplay() {
      currentTime = 0.0;
      playing = true;
      playAnchorWallMs = performance.now();
      playAnchorSceneSec = 0.0;
      const state = renderAtTime(0.0);
      audio.unlockAndPlay(state);
    },
    onTogglePause() {
      if (playing) {
        playing = false;
        audio.pause();
        renderAtTime(currentTime);
      } else {
        if (currentTime >= timeline.duration) {
          currentTime = 0.0;
        }
        playing = true;
        playAnchorWallMs = performance.now();
        playAnchorSceneSec = currentTime;
        const state = renderAtTime(currentTime);
        audio.unlockAndPlay(state);
      }
    },
    onNextShot() {
      const nextT = timeline.getNextShotTime(currentTime);
      sceneApi.seek(nextT);
    },
    onPrevShot() {
      const prevT = timeline.getPrevShotTime(currentTime);
      sceneApi.seek(prevT);
    },
  });

  function resizeStage() {
    const rect = stageFrame.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const maxBufferScale = 1920 / height;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      2.0,
      Math.max(1.0, maxBufferScale)
    );

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = PORTRAIT_ASPECT;
    camera.updateProjectionMatrix();
    atmosphere.setPixelRatio(dpr);
    renderAtTime(currentTime);
  }

  function renderAtTime(t) {
    const state = timeline.getStateAtTime(t);
    cameraDirector.update(state);
    city.update(state.time);
    bridge.update(state.time);
    train.update(state, camera);
    atmosphere.update(state, camera);

    sceneApi.shot = state.shot;
    sceneApi.time = Number(state.time.toFixed(4));
    sceneApi.playing = playing;
    sceneApi.train = state.train;

    hud.updateHud(state, playing);
    renderer.render(scene, camera);
    return state;
  }

  function tick(nowMs) {
    requestAnimationFrame(tick);
    if (!playing) return;

    const nextTime = playAnchorSceneSec + (nowMs - playAnchorWallMs) / 1000;
    if (nextTime >= timeline.duration) {
      currentTime = timeline.duration;
      playing = false;
      audio.pause();
      hud.setMode("ended");
      renderAtTime(timeline.duration);
      return;
    }

    currentTime = nextTime;
    const state = renderAtTime(currentTime);
    audio.update(state, true);
  }

  window.addEventListener("resize", resizeStage);
  resizeStage();
  requestAnimationFrame(tick);
  return sceneApi;
}

bootScene();
