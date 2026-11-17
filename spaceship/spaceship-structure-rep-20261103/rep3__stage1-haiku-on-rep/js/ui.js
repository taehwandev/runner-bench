import { PHASE_LABEL, LAUNCH_LABEL, ZOOM_HOLD } from './config.js';

// DOM access for the HUD and dock. Nothing here touches the renderer.
export function createUi() {
  return {
    launch: document.getElementById('launch'),
    follow: document.getElementById('follow'),
    reset: document.getElementById('reset'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    phase: document.getElementById('phase'),
    alt: document.getElementById('alt'),
    spd: document.getElementById('spd'),
    rng: document.getElementById('rng'),
  };
}

export function renderControls(ui, phase, follow) {
  ui.launch.textContent = LAUNCH_LABEL[phase];
  ui.launch.disabled = phase === 'lap' || phase === 'depart';
  ui.follow.setAttribute('aria-pressed', String(follow));
  ui.phase.textContent = PHASE_LABEL[phase];
  ui.phase.dataset.phase = phase;
}

export function renderHud(ui, { altitude, speed, range }) {
  ui.alt.textContent = `${altitude.toFixed(1)} m`;
  ui.spd.textContent = `${speed.toFixed(1)} m/s`;
  ui.rng.textContent = `${Math.round(range)} m`;
}

// Tap steps once, holding repeats, and keyboard activation (detail 0) steps once
export function bindZoomButton(btn, zoom, tapFactor) {
  const holdFactor = tapFactor < 1 ? ZOOM_HOLD : 1 / ZOOM_HOLD;
  let delay = 0;
  let repeat = 0;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };

  btn.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    zoom(tapFactor);
    delay = setTimeout(() => {
      repeat = setInterval(() => zoom(holdFactor), 60);
    }, 280);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => btn.addEventListener(type, stop));
  btn.addEventListener('click', (e) => {
    if (e.detail === 0) zoom(tapFactor);
  });
}
