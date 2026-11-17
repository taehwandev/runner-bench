// DOM controls and status text. Reads phase names; never touches the scene.
import { PHASE_TEXT, DESTINATIONS } from './config.js';

const LAUNCH_LABEL = {
  hover: 'Launch',
  lap: 'Lap in progress',
  depart: 'Departing…',
  gone: 'Departed',
};

export function createUi() {
  const byId = (id) => document.getElementById(id);
  const status = byId('status');
  const destination = byId('destination');
  for (const [id, world] of Object.entries(DESTINATIONS)) {
    destination.add(new Option(`${world.name} · ${world.description}`, id));
  }
  const launch = byId('launch');
  const replay = byId('replay');
  const pause = byId('pause');
  const loading = byId('loading');
  const phaseItems = [...document.querySelectorAll('.phases li')];

  return {
    controls: {
      destination,
      launch,
      replay,
      pause,
      reset: byId('reset'),
      zoomIn: byId('zoomIn'),
      zoomOut: byId('zoomOut'),
    },

    render(phase, paused = false) {
      status.textContent = paused ? `Paused. ${PHASE_TEXT[phase]}` : PHASE_TEXT[phase];
      phaseItems.forEach((item) => item.classList.toggle('active', item.dataset.phase === phase));

      const gone = phase === 'gone';
      destination.disabled = phase !== 'hover' && !gone;
      byId('destination-help').textContent = gone
        ? 'Choose a world, then Replay to fly again.'
        : destination.disabled ? 'Route locked until arrival.' : 'Choose a world before launch.';
      launch.textContent = LAUNCH_LABEL[phase];
      launch.disabled = phase !== 'hover';
      launch.hidden = gone;
      replay.hidden = !gone;
      pause.hidden = phase === 'hover' || gone;
      pause.textContent = paused ? 'Resume' : 'Pause';
      // Keep keyboard focus alive when the launch button disappears
      if (gone && (document.activeElement === launch || document.activeElement === pause)) replay.focus({ preventScroll: true });
    },

    hideLoading() {
      loading.classList.add('done');
    },
  };
}
