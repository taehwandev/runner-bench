import { Renderer } from './renderer.js';
import { makeWorld, makeTrain, particlesAt } from './world.js';
import { FilmSound } from './sound.js';
import { DURATION, SHOTS, cameraAt, clamp, shotAt, smooth, trainAt } from './timeline.js';

const find = id => document.getElementById(id);
const canvas = find('film');
const start = find('start');
const splash = find('splash');
const transport = find('transport');
const pause = find('pause');
const skip = find('skip');
const soundButton = find('sound');
const timecode = find('timecode');
const progress = find('progress');
const audio = new FilmSound();

let renderer, world, models;
let time = 0, shot = 0, train = trainAt(0);
let mode = 'ready', anchor = 0, raf = 0, lastSecond = -1;

function render(t) {
  time = clamp(t, 0, DURATION);
  shot = shotAt(time);
  train = trainAt(time);
  const camera = cameraAt(time, train, shot);
  const night = .14 * smooth(time / 32) + .86 * smooth((time - 36) / 20);
  renderer.render(time, night, train.distance, camera, world, models, particlesAt(time, train, camera[0]));
  progress.style.transform = 'scaleX(' + time / DURATION + ')';
  const seconds = Math.floor(time);
  if (lastSecond !== seconds) {
    timecode.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    timecode.dateTime = 'PT' + seconds + 'S';
    lastSecond = seconds;
  }
  audio.update(time, train, mode === 'playing');
}

function syncControls() {
  const visible = mode === 'ready' || mode === 'ended';
  splash.hidden = !visible;
  transport.hidden = visible;
  const running = mode === 'playing';
  start.querySelector('span').textContent = mode === 'ended' ? 'Replay' : 'Start';
  pause.setAttribute('aria-label', running ? 'Pause' : 'Resume');
  pause.firstElementChild.className = running ? 'pause-icon' : 'play-icon';
}

function finish() {
  const hadFocus = transport.contains(document.activeElement);
  mode = 'ended';
  cancelAnimationFrame(raf);
  render(DURATION);
  syncControls();
  if (hadFocus) start.focus({ preventScroll: true });
}

function tick(now) {
  if (mode !== 'playing') return;
  const next = (now - anchor) / 1000;
  if (next >= DURATION) {
    finish();
    return;
  }
  render(next);
  raf = requestAnimationFrame(tick);
}

function seek(t) {
  if (!Number.isFinite(t) || !renderer) return;
  const next = clamp(t, 0, DURATION);
  if (next === DURATION) {
    finish();
    return;
  }
  if (mode === 'ended') {
    mode = 'paused';
    syncControls();
  }
  if (mode === 'playing') anchor = performance.now() - next * 1000;
  render(next);
}

function play() {
  if (!renderer || mode === 'playing') return;
  audio.start();
  const fromSplash = mode === 'ready' || mode === 'ended';
  mode = 'playing';
  if (fromSplash) render(0);
  anchor = performance.now() - time * 1000;
  syncControls();
  if (fromSplash && document.activeElement === start) pause.focus({ preventScroll: true });
  raf = requestAnimationFrame(tick);
}

function togglePause() {
  if (mode !== 'playing') {
    play();
    return;
  }
  mode = 'paused';
  cancelAnimationFrame(raf);
  render((performance.now() - anchor) / 1000);
  if (time >= DURATION) finish();
  else syncControls();
}

function nextShot() {
  if (mode === 'playing' || mode === 'paused') seek(SHOTS[shot + 1] ?? DURATION);
}

function toggleSound() {
  audio.muted = !audio.muted;
  soundButton.setAttribute('aria-pressed', String(audio.muted));
  audio.update(time, train, mode === 'playing');
}

try {
  renderer = new Renderer(canvas);
  world = makeWorld(renderer);
  models = makeTrain(renderer);
  renderer.resize();
  render(0);
  window.__scene = {
    get shot() { return shot; },
    get time() { return time; },
    get playing() { return mode === 'playing'; },
    seek,
    get train() { return { ...train }; }
  };
  start.disabled = false;
  start.addEventListener('click', play);
  pause.addEventListener('click', togglePause);
  skip.addEventListener('click', nextShot);
  soundButton.addEventListener('click', toggleSound);
  const resize = () => {
    renderer.resize();
    render(time);
  };
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', event => event.preventDefault());
  canvas.addEventListener('webglcontextrestored', () => {
    renderer = new Renderer(canvas);
    world = makeWorld(renderer);
    models = makeTrain(renderer);
    resize();
  });
  window.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space' && (!event.target.closest?.('button') || event.target === pause)) {
      event.preventDefault();
      togglePause();
    } else if (event.key === 'ArrowRight' && (mode === 'playing' || mode === 'paused')) {
      event.preventDefault();
      nextShot();
    } else if (event.key.toLowerCase() === 'm') {
      toggleSound();
    }
  });
} catch (error) {
  renderer = null;
  find('error').hidden = false;
  console.error(error);
}
