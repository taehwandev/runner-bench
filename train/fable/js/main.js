// Bootstrap: renderer, clock, letterboxed sizing, and the wiring between the
// world, the sound, the controls and window.__scene.

import * as THREE from 'three';
import { DURATION, RENDER, SHOTS } from './config.js';
import { clampTime, nextShotStart, trainAt, shotIndexAt } from './core/timeline.js';
import { createWorld } from './scene/world.js';
import { createPost } from './render/post.js';
import { createAudio } from './audio/audio.js';
import { createControls } from './ui/controls.js';

const SLOW_FRAME = 1 / 48; // sustained frames slower than this lower the resolution
const SLOW_STREAK = 40;

function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}

/** Keeps the drawing buffer matched to the 9:16 stage, capped for phone GPUs. */
function createViewport(renderer, post, stage) {
  let scale = 1;
  const size = { width: 0, height: 0 };
  function apply() {
    const cssH = stage.clientHeight || 1;
    const ratio = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio, RENDER.maxHeight / cssH) * scale;
    const height = Math.max(2, Math.round(cssH * ratio));
    const width = Math.max(2, Math.round(height * RENDER.aspect));
    if (width === size.width && height === size.height) return false;
    size.width = width;
    size.height = height;
    renderer.setSize(width, height, false);
    post.setSize(width, height);
    return true;
  }
  return {
    size,
    apply,
    /** Drop resolution one step; returns false once at the floor. */
    lower() {
      if (scale <= RENDER.minScale) return false;
      scale = Math.max(RENDER.minScale, scale * 0.85);
      return apply();
    },
  };
}

/** The inspection and control surface for tests and tools: window.__scene. */
function exposeScene(player, seek, handlers) {
  window.__scene = {
    get shot() { return shotIndexAt(player.time); }, // index into `shots`
    get shotName() { return SHOTS[shotIndexAt(player.time)].id; },
    get time() { return player.time; },
    get playing() { return player.playing; },
    get ended() { return player.ended; },
    get train() { return trainAt(player.time); },
    duration: DURATION,
    shots: SHOTS.map((s) => ({ id: s.id, label: s.label, start: s.start })),
    seek,
    play() {
      if (!player.started || player.ended) handlers.start();
      else if (!player.playing) handlers.toggle();
    },
    pause() { if (player.playing) handlers.toggle(); },
    next: handlers.next,
  };
}

function start() {
  const canvas = document.getElementById('view');
  const stage = document.getElementById('stage');
  const renderer = createRenderer(canvas);
  const post = createPost(renderer);
  const world = createWorld();
  const audio = createAudio();
  const viewport = createViewport(renderer, post, stage);
  const player = { time: 0, playing: false, started: false, ended: false, userPaused: false };
  let frame = null;
  let lastNow = 0;
  let slow = 0;

  function draw() {
    const { width, height } = viewport.size;
    frame = world.update(player.time, width, height);
    frame.t = player.time;
    const fade = player.started ? frame.grade.fade : 1; // the title card shows the first frame undimmed
    post.render(world.scene, world.camera, { exposure: frame.grade.exposure, fade, seed: Math.floor(player.time * 60) * 0.017 });
    controls.show({
      phase: !player.started ? 'idle' : player.ended ? 'ended' : player.playing ? 'playing' : 'paused',
      time: player.time, shot: frame.shot, muted: audio.muted, chip: player.userPaused,
    });
  }

  function setPlaying(playing) {
    player.playing = playing && !player.ended;
    audio.setRunning(player.playing);
    lastNow = performance.now();
    slow = 0;
  }

  function seek(t) {
    player.time = clampTime(Number(t));
    player.started = true;
    player.ended = player.time >= DURATION;
    if (player.ended) setPlaying(false);
    audio.seek(player.time, trainAt(player.time).distance);
    draw();
  }

  const handlers = {
    start() {
      audio.start();
      player.started = true;
      player.userPaused = false;
      seek(0);
      setPlaying(true);
    },
    toggle() {
      if (!player.started || player.ended) return;
      player.userPaused = player.playing;
      setPlaying(!player.playing);
      draw();
    },
    next() {
      const next = nextShotStart(player.time);
      const wasPlaying = player.playing;
      seek(next === null ? DURATION : next);
      if (wasPlaying && !player.ended) setPlaying(true);
    },
    replay() {
      handlers.start();
    },
    mute() {
      audio.setMuted(!audio.muted);
      draw();
    },
  };
  const controls = createControls(handlers);

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;
    if (!player.playing) return;
    player.time = Math.min(DURATION, player.time + dt);
    if (player.time >= DURATION) {
      player.ended = true;
      setPlaying(false);
    }
    draw();
    if (frame && player.playing) audio.update(frame);
    slow = dt > SLOW_FRAME ? slow + 1 : 0;
    if (slow > SLOW_STREAK) {
      slow = 0;
      viewport.lower();
    }
  }

  window.addEventListener('resize', () => {
    viewport.apply();
    draw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && player.playing) handlers.toggle();
  });

  exposeScene(player, seek, handlers);

  // one teardown path for listeners, audio and GPU resources
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    controls.dispose();
    audio.dispose();
    post.dispose();
    renderer.dispose();
  });

  viewport.apply();
  renderer.compile(world.scene, world.camera);
  draw();
  controls.ready();
  requestAnimationFrame(tick);
}

try {
  start();
} catch (error) {
  console.error(error);
  const message = document.getElementById('load-error');
  message.textContent = 'This film needs WebGL 2. Try a current browser with hardware acceleration on.';
  message.hidden = false;
  document.getElementById('btn-start').textContent = 'Unavailable';
}
