// DOM controls. Phase copy comes from one table, so every state reads the same wherever it is shown.
const PHASE_COPY = {
  hover: { badge: 'Standby', status: 'Hovering over the landing pad.', button: 'Launch departure' },
  lap: { badge: 'Lap', status: 'Making one slow lap around the pad.', button: 'Pause departure' },
  depart: { badge: 'Departing', status: 'Climbing out toward the horizon.', button: 'Pause departure' },
  ascent: { badge: 'Ascent', status: 'Climbing through the atmosphere.', button: 'Pause departure' },
  jump: { badge: 'Jump', status: 'Jumping to a distant destination.', button: 'Pause departure' },
  arrival: { badge: 'Arrival', status: 'Emerging at the destination.', button: 'Pause departure' },
  gone: { badge: 'Arrived', status: 'The ship has arrived at its destination.', button: 'Replay departure' },
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

  const destinationLabel = document.createElement('label');
  destinationLabel.className = 'destination';
  destinationLabel.textContent = 'Destination';
  const destination = document.createElement('select');
  destination.id = 'destination';
  for (const { id, name } of handlers.destinations) {
    destination.add(new Option(name, id));
  }
  destinationLabel.append(destination);
  el.launch.before(destinationLabel);
  const onDestination = () => handlers.onDestination(destination.value);
  destination.addEventListener('change', onDestination);

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
    if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
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
    showPhase(phase, paused, destinationName) {
      const copy = PHASE_COPY[phase];
      const status = phase === 'hover'
        ? `Hovering over the landing pad. Next stop: ${destinationName}.`
        : ['jump', 'arrival', 'gone'].includes(phase)
          ? { jump: `Jumping to ${destinationName}.`, arrival: `Emerging at ${destinationName}.`, gone: `The ship has arrived at ${destinationName}.` }[phase]
          : copy.status;
      destination.disabled = phase !== 'hover' && phase !== 'gone';
      el.badge.textContent = paused ? 'Paused' : copy.badge;
      el.badge.dataset.phase = phase;
      el.status.textContent = paused ? `Paused. ${status}` : status;
      el.launch.textContent = paused ? 'Resume departure' : copy.button;
    },

    setFollow(on) {
      if (el.follow.checked !== on) el.follow.checked = on;
    },

    dispose() {
      window.removeEventListener('keydown', onKey);
      destination.removeEventListener('change', onDestination);
      destinationLabel.remove();
    },
  };
}
