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

function createDestinationChooser(destinations, onChange) {
  const label = document.createElement('label');
  label.className = 'destination-chooser';
  label.htmlFor = 'destination';
  const title = document.createElement('span');
  title.textContent = 'Destination';
  const select = document.createElement('select');
  select.id = 'destination';
  select.className = 'btn';
  select.setAttribute('aria-describedby', 'destination-detail');
  for (const destination of destinations) {
    select.add(new Option(destination.name, destination.id));
  }
  const detail = document.createElement('span');
  detail.id = 'destination-detail';
  detail.className = 'destination-detail';
  detail.textContent = destinations[0].description;
  select.addEventListener('change', () => {
    detail.textContent = destinations.find((item) => item.id === select.value).description;
    onChange(select.value);
  });
  label.append(title, select, detail);
  $('launch').before(label);
  return select;
}

export function createUi(handlers) {
  const destination = createDestinationChooser(handlers.destinations, handlers.onDestination);
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
    showPhase(phase, paused) {
      const copy = PHASE_COPY[phase];
      const name = handlers.destinations.find((item) => item.id === destination.value).name;
      const status = {
        hover: `Choose a destination, then launch departure.`,
        jump: `Jumping to ${name}.`,
        arrival: `Emerging at ${name}.`,
        gone: `Arrived at ${name}. Choose a destination to fly again.`,
      }[phase] ?? copy.status;
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
    },
  };
}
