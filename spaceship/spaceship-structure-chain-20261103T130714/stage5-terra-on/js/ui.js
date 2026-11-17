// DOM controls and status text. Reads phase names; never touches the scene.
import { PHASE_TEXT } from './config.js';

const LAUNCH_LABEL = {
  hover: 'Launch',
  lap: 'Lap in progress',
  depart: 'Departing…',
  gone: 'Departed',
};

export function createUi() {
  const byId = (id) => document.getElementById(id);
  const status = byId('status');
  const launch = byId('launch');
  const replay = byId('replay');
  const pause = byId('pause');
  const loading = byId('loading');
  const phaseItems = [...document.querySelectorAll('.phases li')];

  return {
    controls: {
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
