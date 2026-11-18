// Bootstrap: letterboxed layout, render loop, adaptive resolution, wiring of
// player / audio / controls, and the window.__scene inspection API.

import { DURATION, SHOTS, QUALITY } from './config.js';
import { createPlayer } from './core/player.js';
import { trainState, trainDistance } from './core/kinematics.js';
import { shotIndexAt, nextShotStart } from './core/shots.js';
import { track, TUNNEL } from './core/landmarks.js';
import { createWorld } from './render/world.js';
import { createSoundtrack } from './audio/soundtrack.js';
import { createControls } from './ui/controls.js';

const POSTER_TIME = 21.5;
const frame = document.getElementById('frame');
const canvas = document.getElementById('view');

function fail(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.hidden = false;
}

let world;
try {
  world = createWorld(canvas);
} catch (err) {
  const hasGL2 = !!document.createElement('canvas').getContext('webgl2');
  fail(hasGL2 ? 'The 3D scene could not start on this device. Please reload the page.'
    : 'This film needs WebGL 2. Please open it in a current browser.');
  throw err;
}
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('The graphics context was lost. Reloading…'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());

const player = createPlayer(DURATION);
const audio = createSoundtrack();
let dirty = true;
let lastRig = null;
let quality = 1;

// ------------------------------------------------------------- layout
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  let w = W, h = (W * 16) / 9;
  if (h > H) { h = H; w = (H * 9) / 16; }
  w = Math.round(w); h = Math.round(h);
  Object.assign(frame.style, { width: `${w}px`, height: `${h}px`, left: `${Math.round((W - w) / 2)}px`, top: `${Math.round((H - h) / 2)}px` });
  frame.style.setProperty('--fh', `${h}px`);
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.maxDpr, QUALITY.maxPixelWidth / w) * quality;
  world.resize(w, h, Math.max(0.5, dpr));
  dirty = true;
}

// ------------------------------------------------------------- actions
const controls = createControls({
  isPlaying: () => player.state.playing,
  isStarted: () => player.state.started,
  start() { audio.start(0); player.seek(0); player.play(); },
  replay() { audio.start(0); player.seek(0); player.play(); },
  toggle() {
    if (player.state.ended) return;
    if (!player.state.playing) audio.start(player.state.time);
    player.toggle();
  },
  next() { player.seek(nextShotStart(player.state.time)); },
  prev() {
    const t = player.state.time;
    const i = shotIndexAt(t);
    const target = t - SHOTS[i].start > 1 || i === 0 ? SHOTS[i].start : SHOTS[i - 1].start;
    player.seek(target);
  },
  seek(t) { player.seek(t); },
  toggleMute() { audio.setMuted(!audio.muted); dirty = true; },
});

player.on((type, state) => {
  if (type === 'seek') { audio.seek(state.time); if (!state.playing) audio.pause(); }
  if (type === 'pause') audio.pause();
  if (type === 'play') audio.resume();
  if (type === 'end') { audio.pause(); setTimeout(() => controls.focusReplay(), 0); }
  dirty = true;
});

// ------------------------------------------------------------- frame
function draw() {
  const t = player.state.time;
  lastRig = world.renderAt(t);
  controls.update(player.state, SHOTS[lastRig.index].name, audio.muted);
  dirty = false;
}

function audioInfo(t) {
  const nose = trainDistance(t);
  const p = track.offsetPoint(nose - 30, 0, 2);
  const c = lastRig ? lastRig.pos : p;
  const camD = nose - 13.6;
  return {
    camDist: Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]),
    camInTunnel: SHOTS[shotIndexAt(t)].kind === 'cabPOV' && camD > TUNNEL.start && camD < TUNNEL.end,
  };
}

// Adaptive resolution: drop render scale when frames run long, recover slowly.
const perf = { n: 0, sum: 0, last: 0, good: 0 };
function adapt(now) {
  if (perf.last) { perf.sum += now - perf.last; perf.n++; }
  perf.last = now;
  if (perf.n < 90) return;
  const avg = perf.sum / perf.n;
  perf.n = 0; perf.sum = 0;
  if (avg > 19 && quality > QUALITY.minScale) { quality = Math.max(QUALITY.minScale, quality * 0.85); perf.good = 0; layout(); }
  else if (avg < 14 && quality < 1 && ++perf.good >= 3) { quality = Math.min(1, quality * 1.1); perf.good = 0; layout(); }
}

let rafId = 0;
function loop(now) {
  const advanced = player.tick(now);
  if (advanced || dirty) draw();
  audio.update(player.state.time, player.state.playing, audioInfo(player.state.time));
  if (player.state.playing) adapt(now); else perf.last = 0;
  rafId = requestAnimationFrame(loop);
}

const onVisibility = () => { if (document.hidden) player.pause(); };
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', onVisibility);

// Single cleanup path for the loop, listeners, audio and GPU resources.
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', layout);
  document.removeEventListener('visibilitychange', onVisibility);
  controls.dispose();
  audio.dispose();
  world.dispose();
}, { once: true });
window.addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });

// ------------------------------------------------------------- inspection API
window.__scene = {
  get shot() { return shotIndexAt(player.state.time); },
  get shotName() { return SHOTS[shotIndexAt(player.state.time)].name; },
  get time() { return player.state.time; },
  get playing() { return player.state.playing; },
  get duration() { return DURATION; },
  get shots() { return SHOTS.map((s) => ({ name: s.name, start: s.start, end: s.end })); },
  get train() {
    const s = trainState(player.state.time);
    return { distance: s.distance, speed: s.speed, cars: s.cars, atStation: s.atStation, inTunnel: s.inTunnel };
  },
  seek(t) {
    player.seek(t);
    if (!player.state.started) { player.state.started = true; }
    draw();
    return player.state.time;
  },
  play() { if (!player.state.playing) { audio.start(player.state.time); player.play(); } },
  pause() { player.pause(); },
  nextShot() { player.seek(nextShotStart(player.state.time)); draw(); },
};

layout();
player.seek(POSTER_TIME);
draw();
rafId = requestAnimationFrame(loop);
