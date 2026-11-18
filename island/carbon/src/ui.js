import { TOTAL_DURATION, SHOTS } from './timeline.js';
import { clamp } from './math.js';

function formatClock(seconds) {
  const totalSec = Math.floor(clamp(seconds, 0, TOTAL_DURATION) + 1e-4);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createUIController(callbacks) {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('scene-canvas');
  const promptCard = document.getElementById('prompt-card');
  const promptEyebrow = document.getElementById('prompt-eyebrow');
  const promptTitle = document.getElementById('prompt-title');
  const promptSub = document.getElementById('prompt-sub');
  const primaryBtn = document.getElementById('primary-action-btn');
  const primaryLabel = document.getElementById('primary-action-label');
  const primaryIconPlay = document.getElementById('primary-icon-play');
  const primaryIconReplay = document.getElementById('primary-icon-replay');

  const hud = document.querySelector('.hud');
  const shotBadge = document.getElementById('shot-badge');
  const timeReadout = document.getElementById('time-readout');
  const timelineTrack = document.getElementById('timeline-track');
  const timelineFill = document.getElementById('timeline-fill');

  const playPauseBtn = document.getElementById('play-pause-btn');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const nextShotBtn = document.getElementById('next-shot-btn');
  const muteBtn = document.getElementById('mute-btn');
  const iconUnmuted = document.getElementById('icon-unmuted');
  const iconMuted = document.getElementById('icon-muted');

  let overlayMode = 'start'; // 'start' | 'hidden' | 'replay'
  let scrubbing = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let quietTimer = null;

  function wakeHudTemporarily(isPlaying) {
    hud.classList.remove('is-quiet');
    if (quietTimer) clearTimeout(quietTimer);
    if (isPlaying) {
      quietTimer = setTimeout(() => {
        hud.classList.add('is-quiet');
      }, 2600);
    }
  }

  function setOverlayMode(mode) {
    overlayMode = mode;
    if (mode === 'hidden') {
      promptCard.classList.add('is-dismissed');
      promptCard.setAttribute('aria-hidden', 'true');
      primaryBtn.tabIndex = -1;
      return;
    }

    promptCard.classList.remove('is-dismissed');
    promptCard.setAttribute('aria-hidden', 'false');
    primaryBtn.tabIndex = 0;

    if (mode === 'replay') {
      promptEyebrow.textContent = '60s Time-Lapse Complete';
      promptTitle.textContent = 'Starry Night';
      promptSub.textContent = 'Replay from late afternoon through sunset to night';
      primaryLabel.textContent = 'Replay';
      primaryIconPlay.classList.add('hidden');
      primaryIconReplay.classList.remove('hidden');
    } else {
      promptEyebrow.textContent = '60s Time-Lapse · Audio & 3D';
      promptTitle.textContent = 'Solstice Cay';
      promptSub.textContent = 'Late afternoon through sunset to starry night';
      primaryLabel.textContent = 'Start';
      primaryIconPlay.classList.remove('hidden');
      primaryIconReplay.classList.add('hidden');
    }
  }

  function scrubFromClientX(clientX) {
    const rect = timelineTrack.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    callbacks.onScrub(ratio * TOTAL_DURATION);
  }

  primaryBtn.addEventListener('click', () => {
    callbacks.onPrimaryAction();
  });

  playPauseBtn.addEventListener('click', () => {
    callbacks.onTogglePlay();
  });

  nextShotBtn.addEventListener('click', () => {
    callbacks.onNextShot();
  });

  muteBtn.addEventListener('click', () => {
    const muted = callbacks.onToggleMute();
    iconMuted.classList.toggle('hidden', !muted);
    iconUnmuted.classList.toggle('hidden', muted);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  });

  timelineTrack.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    timelineTrack.setPointerCapture(e.pointerId);
    scrubFromClientX(e.clientX);
  });

  timelineTrack.addEventListener('pointermove', (e) => {
    if (!scrubbing) return;
    scrubFromClientX(e.clientX);
  });

  const endScrub = () => {
    scrubbing = false;
  };
  timelineTrack.addEventListener('pointerup', endScrub);
  timelineTrack.addEventListener('pointercancel', endScrub);

  // Touch & pointer tap-to-pause and horizontal swipe-to-next-shot on canvas
  canvas.addEventListener('pointerdown', (e) => {
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    touchStartTime = performance.now();
  });

  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - touchStartX;
    const dy = e.clientY - touchStartY;
    const dt = performance.now() - touchStartTime;

    if (dt < 550 && dx < -46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      callbacks.onNextShot();
      return;
    }
    if (dt < 350 && Math.hypot(dx, dy) < 12 && overlayMode === 'hidden') {
      callbacks.onTogglePlay();
    }
  });

  stage.addEventListener('pointermove', () => {
    wakeHudTemporarily(callbacks.isPlaying());
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' || e.code === 'KeyK') {
      e.preventDefault();
      callbacks.onTogglePlay();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyN') {
      e.preventDefault();
      callbacks.onNextShot();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      muteBtn.click();
    }
  });

  return {
    stage,
    canvas,
    setOverlayMode,
    getOverlayMode() {
      return overlayMode;
    },
    wakeHudTemporarily,
    syncState(time, shot, playing) {
      shotBadge.textContent = `Shot ${shot.id}/${SHOTS.length} · ${shot.name}`;
      timeReadout.textContent = `${formatClock(time)} / 01:00`;

      const pct = clamp((time / TOTAL_DURATION) * 100, 0, 100);
      timelineFill.style.width = `${pct.toFixed(2)}%`;
      timelineTrack.setAttribute('aria-valuenow', time.toFixed(1));

      iconPlay.classList.toggle('hidden', playing);
      iconPause.classList.toggle('hidden', !playing);
      playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : time >= TOTAL_DURATION ? 'Replay' : time > 0 ? 'Resume' : 'Play');
    },
  };
}
