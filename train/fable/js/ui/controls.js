// DOM controls: Start and Replay overlays, the playback bar, and the touch and
// keyboard bindings. It knows nothing about the scene; it calls the handlers
// it is given and mirrors the player state it is shown.

import { DURATION, SHOTS } from '../config.js';

const HIDE_AFTER_MS = 2600;
const SWIPE_PX = 48;

const $ = (id) => document.getElementById(id);

function formatClock(t) {
  const s = Math.min(DURATION, Math.max(0, Math.floor(t)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function buildTicks(container) {
  for (const shot of SHOTS.slice(1)) {
    const tick = document.createElement('span');
    tick.style.left = `${(shot.start / DURATION) * 100}%`;
    container.appendChild(tick);
  }
}

/**
 * handlers: { start, toggle, next, replay, mute }.
 * Returns { ready(), show(view), dispose() } where view is
 * { phase: 'idle'|'playing'|'paused'|'ended', time, shot, muted, chip }.
 */
export function createControls(handlers) {
  const el = {
    stage: $('stage'), hud: $('hud'), start: $('overlay-start'), end: $('overlay-end'), chip: $('paused-chip'),
    btnStart: $('btn-start'), btnReplay: $('btn-replay'), btnPlay: $('btn-play'), btnNext: $('btn-next'), btnMute: $('btn-mute'),
    label: $('shot-label'), clock: $('clock'), bar: $('progress'), fill: $('progress-fill'),
  };
  const abort = new AbortController();
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: abort.signal });
  let phase = 'idle';
  let hideTimer = 0;
  let last = {};
  buildTicks($('progress-ticks'));

  function wake() {
    el.hud.classList.add('visible');
    clearTimeout(hideTimer);
    if (phase === 'playing') hideTimer = setTimeout(() => el.hud.classList.remove('visible'), HIDE_AFTER_MS);
  }

  function primary() {
    if (phase === 'idle') handlers.start();
    else if (phase === 'ended') handlers.replay();
    else handlers.toggle();
    wake();
  }

  on(el.btnStart, 'click', () => handlers.start());
  on(el.btnReplay, 'click', () => handlers.replay());
  on(el.btnPlay, 'click', () => { handlers.toggle(); wake(); });
  on(el.btnNext, 'click', () => { handlers.next(); wake(); });
  on(el.btnMute, 'click', () => { handlers.mute(); wake(); });

  // Tap the picture to pause or resume; swipe left to skip to the next shot.
  let down = null;
  on(el.stage, 'pointerdown', (e) => {
    down = e.target.closest('button') ? null : { x: e.clientX, y: e.clientY };
  });
  on(el.stage, 'pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    down = null;
    if (phase === 'idle' || phase === 'ended') return;
    if (dx < -SWIPE_PX && Math.abs(dx) > Math.abs(dy)) handlers.next();
    else if (Math.hypot(dx, dy) < 12) handlers.toggle();
    wake();
  });
  on(el.stage, 'pointermove', (e) => { if (e.pointerType === 'mouse') wake(); });

  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target instanceof HTMLButtonElement;
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'k' || key === 'enter') {
      if (onButton) return; // the focused button handles its own activation
      e.preventDefault();
      primary();
    } else if (key === 'arrowright' || key === 'n') {
      e.preventDefault();
      if (phase !== 'idle' && phase !== 'ended') handlers.next();
      wake();
    } else if (key === 'm') {
      handlers.mute();
      wake();
    } else if (key === 'r' && phase === 'ended') {
      handlers.replay();
    }
  });

  function show(view) {
    if (view.phase !== last.phase) {
      phase = view.phase;
      el.start.hidden = phase !== 'idle';
      el.end.hidden = phase !== 'ended';
      el.hud.hidden = phase === 'idle' || phase === 'ended';
      el.btnPlay.classList.toggle('is-paused', phase !== 'playing');
      el.btnPlay.setAttribute('aria-label', phase === 'playing' ? 'Pause' : 'Resume');
      if (phase === 'ended') el.btnReplay.focus({ preventScroll: true });
      wake();
    }
    if (view.chip !== last.chip) el.chip.hidden = !view.chip;
    if (view.muted !== last.muted) {
      el.btnMute.classList.toggle('is-muted', view.muted);
      el.btnMute.setAttribute('aria-pressed', String(view.muted));
      el.btnMute.setAttribute('aria-label', view.muted ? 'Unmute sound' : 'Mute sound');
    }
    if (view.shot !== last.shot) el.label.textContent = `Shot ${view.shot + 1}/${SHOTS.length} · ${SHOTS[view.shot].label}`;
    const second = Math.floor(view.time);
    if (second !== last.second) {
      el.clock.textContent = `${formatClock(view.time)} / ${formatClock(DURATION)}`;
      el.bar.setAttribute('aria-valuenow', String(second));
    }
    el.fill.style.width = `${(view.time / DURATION) * 100}%`;
    last = { ...view, second };
  }

  return {
    show,
    ready() {
      el.btnStart.disabled = false;
      el.btnStart.textContent = 'Start';
      el.btnStart.focus({ preventScroll: true });
    },
    dispose() {
      clearTimeout(hideTimer);
      abort.abort();
    },
  };
}
