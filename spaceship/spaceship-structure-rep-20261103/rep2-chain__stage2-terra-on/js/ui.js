// DOM controls. Phase copy comes from one table, so every state reads the same wherever it is shown.
const PHASE_COPY = {
  hover: { badge: 'Standby', status: 'Hovering over the landing pad.', button: 'Launch departure' },
  lap: { badge: 'Lap', status: 'Making one slow lap around the pad.', button: 'Pause departure' },
  depart: { badge: 'Departing', status: 'Climbing out toward the horizon.', button: 'Pause departure' },
  fade: { badge: 'Departing', status: 'Leaving the area.', button: 'Pause departure' },
  gone: { badge: 'Departed', status: 'Out of sight. The ship has left the area.', button: 'Replay departure' },
};

const $ = (id) => document.getElementById(id);

export function createUi(handlers) {
  const el = {
    launch: $('launch'),
    follow: $('follow'),
    zoomIn: $('zoomIn'),
    zoomOut: $('zoomOut'),
    reset: $('reset'),
    status: $('status'),
    badge: $('badge'),
    hint: $('hint'),
  };

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  el.hint.textContent = coarse
    ? 'Drag to orbit · Pinch to zoom · Two fingers to pan'
    : 'Drag to orbit · Scroll to zoom · Right-drag to pan · Space to launch / pause / replay · R to reset';

  el.launch.addEventListener('click', handlers.onLaunch);
  el.zoomIn.addEventListener('click', handlers.onZoomIn);
  el.zoomOut.addEventListener('click', handlers.onZoomOut);
  el.reset.addEventListener('click', handlers.onReset);
  el.follow.addEventListener('change', () => handlers.onFollow(el.follow.checked));

  // Shortcuts are skipped while a button or input has focus, so native keyboard behaviour still works.
  const onKey = (e) => {
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
    if (e.key === ' ') {
      e.preventDefault();
      handlers.onLaunch();
    } else if (e.key === 'r' || e.key === 'R') {
      handlers.onReset();
    } else if (e.key === '+' || e.key === '=') {
      handlers.onZoomIn();
    } else if (e.key === '-' || e.key === '_') {
      handlers.onZoomOut();
    } else if (e.key === 'f' || e.key === 'F') {
      el.follow.checked = !el.follow.checked;
      handlers.onFollow(el.follow.checked);
    }
  };
  window.addEventListener('keydown', onKey);

  return {
    showPhase(phase, paused) {
      const copy = PHASE_COPY[phase];
      el.badge.textContent = paused ? 'Paused' : copy.badge;
      el.badge.dataset.phase = phase;
      el.status.textContent = paused ? `Paused. ${copy.status}` : copy.status;
      el.launch.textContent = paused ? 'Resume departure' : copy.button;
    },

    setFollow(on) {
      if (el.follow.checked !== on) el.follow.checked = on;
    },

    dispose() {
      window.removeEventListener('keydown', onKey);
    },
  };
}
