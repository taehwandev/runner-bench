// DOM: letterboxed 9:16 stage, overlays, transport controls, touch + keyboard.
import { DUR } from './common.js';
import { fadeAt } from './timeline.js';

const $ = (id) => document.getElementById(id);

export function createUI({ onStart, onToggle, onNext, onResize }) {
  const stage = $('stage'), fade = $('fade'), hud = $('hud'), bar = $('bar');
  const startEl = $('start'), endEl = $('end'), btnPause = $('btnPause'), btnNext = $('btnNext');
  let hideTimer = 0, userPaused = false, preview = true;

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = Math.floor(Math.min(vw, (vh * 9) / 16)), h = Math.floor((w * 16) / 9);
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    stage.style.fontSize = (w / 36) + 'px'; // all overlay type scales with the stage
    onResize(w, h);
  }
  window.addEventListener('resize', layout);

  function showHud() {
    hud.classList.add('on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { if (!userPaused) hud.classList.remove('on'); }, 2600);
  }

  // Buttons act on click; anywhere else on the stage a tap toggles pause and a
  // leftward swipe skips to the next shot.
  let down = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  stage.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (dx < -50 && Math.abs(dy) < 80) { onNext(); showHud(); return; }
    if (Math.hypot(dx, dy) < 14) { onToggle(); showHud(); }
  });
  stage.addEventListener('pointercancel', () => { down = null; });
  stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showHud(); });
  $('btnStart').addEventListener('click', onStart);
  $('btnReplay').addEventListener('click', onStart);
  btnPause.addEventListener('click', () => { onToggle(); showHud(); });
  btnNext.addEventListener('click', () => { onNext(); showHud(); });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target instanceof HTMLButtonElement;
    if (e.code === 'Space' || e.code === 'KeyK' || e.code === 'Enter') {
      if (onButton && e.code !== 'KeyK') return; // let the focused button handle it
      e.preventDefault();
      const idle = !startEl.hidden || !endEl.hidden;
      if (idle) onStart(); else { onToggle(); showHud(); }
    } else if (e.code === 'ArrowRight' || e.code === 'KeyN') {
      e.preventDefault(); onNext(); showHud();
    } else if (e.code === 'KeyR' && !endEl.hidden) onStart();
  });

  return {
    layout,
    /** Reflect player state in the DOM. */
    sync(s) {
      preview = !s.started;
      startEl.hidden = s.started;
      endEl.hidden = !s.ended;
      userPaused = s.userPaused && !s.ended; // a scripted seek() keeps the frame clean
      stage.classList.toggle('paused', userPaused);
      btnPause.setAttribute('aria-label', s.playing ? 'Pause' : 'Resume');
      btnPause.dataset.icon = s.playing ? 'pause' : 'play';
      hud.hidden = !s.started || s.ended;
      if (s.ended) { hud.classList.remove('on'); $('btnReplay').focus({ preventScroll: true }); }
    },
    /** Per-frame overlay state derived from scene time. */
    frame(t) {
      fade.style.opacity = preview ? 0 : fadeAt(t).toFixed(3);
      bar.style.transform = `scaleX(${(t / DUR).toFixed(4)})`;
    },
    ready() { startEl.classList.add('ready'); $('btnStart').disabled = false; $('btnStart').focus({ preventScroll: true }); },
    fail(msg) { $('startNote').textContent = msg; },
  };
}
