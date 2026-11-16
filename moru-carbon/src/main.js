import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { DISTRICTS, POWERUPS, SPEED } from './config.js';
import {
  applyRunnerAction,
  consumeEvents,
  createGameState,
  startNewRun,
  stepGame,
} from './game-logic.js';
import {
  createHazardTexture,
  createNeonSignTextures,
  createRoadTextures,
  createSoftGlowTexture,
  createWindowTextures,
} from './textures.js';
import { SynthAudio } from './audio.js';
import { createPlayerRig, updatePlayerRig } from './player-mesh.js';
import { CityWorld } from './world-builder.js';
import { EntityMeshSync } from './entity-meshes.js';
import { FxController } from './fx.js';
import { InputController } from './input.js';
import { GameUI, syncWindowGameHandle } from './ui.js';

const state = createGameState();
syncWindowGameHandle(window, state);

const audio = new SynthAudio();
const ui = new GameUI(document, audio);

function initSceneAndRenderer(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DISTRICTS[0].skyColor);
  scene.fog = new THREE.FogExp2(DISTRICTS[0].fogColor, DISTRICTS[0].fogDensity);

  const camera = new THREE.PerspectiveCamera(
    68,
    window.innerWidth / Math.max(1, window.innerHeight),
    0.25,
    175
  );

  const ambientLight = new THREE.AmbientLight(DISTRICTS[0].ambientColor, 1.35);
  const hemiLight = new THREE.HemisphereLight(0x4864b8, 0x0b0e1c, 1.15);
  const rimLight = new THREE.DirectionalLight(0x7be8ff, 1.65);
  rimLight.position.set(-8, 18, -22);
  const magentaBack = new THREE.DirectionalLight(0xff2a9d, 0.95);
  magentaBack.position.set(10, 12, 14);

  const runnerLight = new THREE.PointLight(0x00f0ff, 2.6, 12, 1.6);
  runnerLight.position.set(0, 2.2, 0.5);

  scene.add(ambientLight, hemiLight, rimLight, magentaBack, runnerLight);

  let renderer = null;
  let composer = null;
  let bloomPass = null;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.85);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(dpr, 1.35));
    composer.addPass(new RenderPass(scene, camera));

    // Half-resolution bloom keeps mobile GPUs smooth at 60fps
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(
        Math.max(128, Math.floor(window.innerWidth * 0.5)),
        Math.max(128, Math.floor(window.innerHeight * 0.5))
      ),
      0.58,
      0.34,
      0.72
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch {
    renderer = null;
    composer = null;
  }

  return { scene, camera, renderer, composer, bloomPass, ambientLight, runnerLight };
}

function handleGameEvents(events, fx) {
  for (const ev of events) {
    if (ev.type === 'lane_swap') {
      audio.playLaneSwap(ev.dir);
    } else if (ev.type === 'jump') {
      audio.playJump();
      fx.burst({ x: state.runner.x, y: 0.15, z: 0, colorHex: 0x00f0ff, count: 8, speed: 5.5 });
    } else if (ev.type === 'slide' || ev.type === 'fast_fall') {
      audio.playSlide();
    } else if (ev.type === 'shard') {
      audio.playShard(state.combo);
      fx.burst({ x: ev.x, y: ev.y, z: ev.z, colorHex: 0x00f0ff, count: 10, speed: 6.8 });
    } else if (ev.type === 'near_miss') {
      audio.playNearMiss(ev.combo);
      fx.addShake(0.24);
      fx.burst({ x: state.runner.x, y: 1.0, z: 0, colorHex: 0xff2a9d, count: 16, speed: 8.5 });
      ui.spawnCallout(`NEAR MISS +${ev.points} (x${ev.combo})`, 'pink');
    } else if (ev.type === 'powerup') {
      audio.playPowerup();
      fx.addShake(0.28);
      const hex = POWERUPS[ev.kind].hex;
      fx.burst({ x: state.runner.x, y: 1.1, z: 0, colorHex: hex, count: 24, speed: 10 });
      ui.spawnCallout(`${ev.label} ONLINE`, 'gold');
      ui.triggerFlash('powerup');
    } else if (ev.type === 'smash') {
      audio.playSmash();
      fx.addShake(0.55);
      fx.burst({ x: ev.x, y: 1.2, z: ev.z, colorHex: 0xffbe0b, count: 28, speed: 13 });
      ui.spawnCallout(`SMASH +${ev.points}!`, 'gold');
      ui.triggerFlash('smash');
    } else if (ev.type === 'district_change') {
      audio.playDistrictChange();
      ui.showDistrictBanner(ev.district);
    } else if (ev.type === 'crash') {
      audio.playCrash();
      fx.addShake(0.95);
      fx.burst({ x: ev.x, y: ev.y + 0.9, z: 0, colorHex: 0xff2a55, count: 36, speed: 14 });
      ui.onGameOver(state);
      syncWindowGameHandle(window, state);
    }
  }
}

function bootstrap() {
  const gameCanvas = document.getElementById('game-canvas');
  const speedCanvas = document.getElementById('speed-canvas');
  const gfx = initSceneAndRenderer(gameCanvas);

  const textures = {
    road: createRoadTextures(),
    windows: createWindowTextures(),
    signs: createNeonSignTextures(),
    hazard: createHazardTexture(),
    glow: createSoftGlowTexture(),
  };

  const city = new CityWorld(gfx.scene, textures);
  const entities = new EntityMeshSync(gfx.scene, textures);
  const playerRig = createPlayerRig(textures.glow);
  gfx.scene.add(playerRig.root);
  const fx = new FxController(gfx.scene, speedCanvas);

  let viewportW = window.innerWidth;
  let viewportH = window.innerHeight;
  let useBloom = Boolean(gfx.composer);
  let slowFrameStreak = 0;

  const resize = () => {
    viewportW = window.innerWidth;
    viewportH = Math.max(1, window.innerHeight);
    if (speedCanvas) {
      speedCanvas.width = viewportW;
      speedCanvas.height = viewportH;
    }
    gfx.camera.aspect = viewportW / viewportH;
    gfx.camera.updateProjectionMatrix();
    if (gfx.renderer) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.85);
      gfx.renderer.setPixelRatio(dpr);
      gfx.renderer.setSize(viewportW, viewportH, false);
    }
    if (gfx.composer) {
      gfx.composer.setSize(viewportW, viewportH);
    }
  };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  resize();

  const launchOrRestart = () => {
    startNewRun(state);
    city.resetToStart();
    ui.onRunStart();
    consumeEvents(state);
    syncWindowGameHandle(window, state);
  };

  const muteBtn = document.getElementById('mute-btn');
  muteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.toggleMute();
    ui.updateMuteButton();
  });

  new InputController({
    targetElement: window,
    onFirstGesture: () => audio.unlock(),
    onAction: (action) => {
      if (state.mode !== 'playing') {
        launchOrRestart();
        return;
      }
      applyRunnerAction(state, action);
    },
    onTapStartOrRestart: () => {
      if (state.mode === 'start' || state.mode === 'gameover') {
        launchOrRestart();
        return true;
      }
      return false;
    },
    onToggleMute: () => {
      audio.toggleMute();
      ui.updateMuteButton();
    },
  });

  let prevTime = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const rawDt = (now - prevTime) / 1000;
    prevTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    // Adaptive GPU governor for mobile stability
    if (rawDt > 0.028 && state.mode === 'playing') {
      slowFrameStreak += 1;
      if (slowFrameStreak > 35 && useBloom) {
        useBloom = false;
        if (gfx.renderer) gfx.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      }
    } else {
      slowFrameStreak = Math.max(0, slowFrameStreak - 1);
    }

    if (state.mode === 'playing') {
      stepGame(state, dt);
      const events = consumeEvents(state);
      handleGameEvents(events, fx);
    }

    const worldSpeed =
      state.mode === 'playing' ? state.currentSpeed : state.mode === 'start' ? SPEED.demoSpeed : 0;
    city.update(dt, worldSpeed, state.districtIndex, gfx.scene, gfx.ambientLight);
    entities.sync(state, dt);
    updatePlayerRig(playerRig, state, dt);
    gfx.runnerLight.position.set(state.runner.x, state.runner.y + 2.2, 0.6);
    fx.update(dt, state, gfx.camera, viewportW, viewportH);

    const speedNorm = Math.min(1, (state.currentSpeed - SPEED.initial) / (SPEED.max - SPEED.initial));
    audio.updateMusic(dt, state.mode === 'playing' && state.alive, speedNorm, state.powerups.nitro > 0);
    ui.update(state, dt);

    if (gfx.renderer) {
      if (useBloom && gfx.composer) {
        gfx.composer.render();
      } else {
        gfx.renderer.render(gfx.scene, gfx.camera);
      }
    }
  };

  requestAnimationFrame(tick);
}

bootstrap();
