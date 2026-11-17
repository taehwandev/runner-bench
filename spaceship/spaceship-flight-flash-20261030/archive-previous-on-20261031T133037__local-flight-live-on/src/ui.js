import { FLIGHT_STATE } from './flightController.js';

/**
 * Handles DOM UI interactions, telemetry display updates, keyboard shortcuts,
 * and responsive state presentation.
 */
export class UIController {
  constructor(flightController, cameraController, audioManager) {
    this.flight = flightController;
    this.camera = cameraController;
    this.audio = audioManager;

    // Cache DOM Elements
    this.statusBadge = document.getElementById('status-badge');
    this.statusText = document.getElementById('status-text');
    this.launchBtn = document.getElementById('btn-launch-flight');
    this.launchBtnText = document.getElementById('launch-btn-text');
    this.pauseBtn = document.getElementById('btn-pause-flight');
    this.pauseBtnText = document.getElementById('pause-btn-text');
    this.speedBtn = document.getElementById('btn-speed-toggle');
    this.speedLabel = document.getElementById('speed-label');
    this.trajectoryBtn = document.getElementById('btn-trajectory-toggle');

    this.valAltitude = document.getElementById('val-altitude');
    this.barAltitude = document.getElementById('bar-altitude');
    this.valSpeed = document.getElementById('val-speed');
    this.barSpeed = document.getElementById('bar-speed');
    this.valThrottlePct = document.getElementById('val-throttle-pct');
    this.barThrottle = document.getElementById('bar-throttle');
    this.valCircuitPct = document.getElementById('val-circuit-pct');
    this.telemetryTime = document.getElementById('telemetry-time');

    this.camResetBtn = document.getElementById('btn-cam-reset');
    this.zoomInBtn = document.getElementById('btn-zoom-in');
    this.zoomOutBtn = document.getElementById('btn-zoom-out');
    this.camModeBtns = document.querySelectorAll('.cam-mode-btn');

    this.audioBtn = document.getElementById('btn-audio');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.fullscreenBtn = document.getElementById('btn-fullscreen');

    this.speedOptions = [1.0, 1.5, 0.5];
    this.speedIndex = 0;

    this.setupListeners();
    this.setupKeyboardShortcuts();
  }

  setupListeners() {
    // Launch / Return button
    this.launchBtn.addEventListener('click', () => {
      this.audio.playClick();
      if (this.flight.state === FLIGHT_STATE.READY) {
        this.flight.launch();
      } else if (this.flight.state === FLIGHT_STATE.CIRCUIT) {
        this.flight.returnToPad();
      }
    });

    // Pause button
    this.pauseBtn.addEventListener('click', () => {
      this.audio.playClick();
      const isPaused = this.flight.togglePause();
      this.pauseBtnText.textContent = isPaused ? 'Resume' : 'Pause';
      this.pauseBtn.classList.toggle('active', isPaused);
    });

    // Speed button
    this.speedBtn.addEventListener('click', () => {
      this.audio.playClick();
      this.speedIndex = (this.speedIndex + 1) % this.speedOptions.length;
      const speed = this.speedOptions[this.speedIndex];
      this.flight.setSpeedMultiplier(speed);
      this.speedLabel.textContent = `${speed.toFixed(1)}x`;
    });

    // Trajectory Path toggle
    this.trajectoryBtn.addEventListener('click', () => {
      this.audio.playClick();
      const visible = this.flight.toggleFlightPathRibbon();
      this.trajectoryBtn.classList.toggle('active', visible);
    });

    // Camera mode buttons
    this.camModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.audio.playClick();
        const mode = btn.dataset.mode;
        this.camera.setMode(mode);
        this.camModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Camera Reset
    this.camResetBtn.addEventListener('click', () => {
      this.audio.playClick();
      this.camera.resetCamera();
      // Set active mode pill back to DIRECTOR
      this.camModeBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.mode === 'DIRECTOR');
      });
    });

    // Zoom buttons
    this.zoomInBtn.addEventListener('click', () => {
      this.audio.playClick();
      this.camera.zoomIn();
    });
    this.zoomOutBtn.addEventListener('click', () => {
      this.audio.playClick();
      this.camera.zoomOut();
    });

    // Audio toggle
    this.audioBtn.addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      this.iconSoundOn.style.display = isMuted ? 'none' : 'block';
      this.iconSoundOff.style.display = isMuted ? 'block' : 'none';
      if (!isMuted) this.audio.playClick();
    });

    // Fullscreen toggle
    this.fullscreenBtn.addEventListener('click', () => {
      this.audio.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Avoid firing if active on an input
      if (e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.launchBtn.click();
          break;
        case 'KeyP':
          this.pauseBtn.click();
          break;
        case 'KeyR':
          this.camResetBtn.click();
          break;
        case 'KeyC': {
          // Cycle camera modes
          const modes = ['DIRECTOR', 'CHASE', 'TOWER', 'FREE'];
          const currentIdx = modes.indexOf(this.camera.mode);
          const nextMode = modes[(currentIdx + 1) % modes.length];
          const btn = Array.from(this.camModeBtns).find(b => b.dataset.mode === nextMode);
          if (btn) btn.click();
          break;
        }
        case 'KeyM':
          this.audioBtn.click();
          break;
        case 'Digit1':
          this.flight.setSpeedMultiplier(1.0);
          this.speedIndex = 0;
          this.speedLabel.textContent = '1.0x';
          break;
        case 'Digit2':
          this.flight.setSpeedMultiplier(1.5);
          this.speedIndex = 1;
          this.speedLabel.textContent = '1.5x';
          break;
        case 'Digit3':
          this.flight.setSpeedMultiplier(0.5);
          this.speedIndex = 2;
          this.speedLabel.textContent = '0.5x';
          break;
        case 'Equal':
        case 'NumpadAdd':
          this.camera.zoomIn();
          break;
        case 'Minus':
        case 'NumpadSubtract':
          this.camera.zoomOut();
          break;
      }
    });
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
  }

  update() {
    const tele = this.flight.getTelemetry();

    // 1. Update Status Badge & Action Button
    switch (tele.state) {
      case FLIGHT_STATE.READY:
        this.statusText.textContent = 'READY ON PAD';
        this.statusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        this.statusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        this.launchBtnText.textContent = 'INITIATE TAKEOFF';
        this.launchBtn.classList.remove('returning');
        this.launchBtn.disabled = false;
        break;

      case FLIGHT_STATE.TAKEOFF:
        this.statusText.textContent = 'TAKEOFF & CLIMB';
        this.statusBadge.style.background = 'rgba(6, 182, 212, 0.2)';
        this.statusBadge.style.borderColor = 'rgba(6, 182, 212, 0.5)';
        this.launchBtnText.textContent = 'CLIMBING...';
        this.launchBtn.disabled = true;
        break;

      case FLIGHT_STATE.CIRCUIT:
        this.statusText.textContent = 'CIRCUIT FLIGHT';
        this.statusBadge.style.background = 'rgba(14, 165, 233, 0.2)';
        this.statusBadge.style.borderColor = 'rgba(14, 165, 233, 0.5)';
        this.launchBtnText.textContent = 'RETURN TO PAD';
        this.launchBtn.classList.add('returning');
        this.launchBtn.disabled = false;
        break;

      case FLIGHT_STATE.APPROACH:
        this.statusText.textContent = 'FINAL APPROACH';
        this.statusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
        this.statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.5)';
        this.launchBtnText.textContent = 'ALIGNING ON PAD...';
        this.launchBtn.disabled = true;
        break;

      case FLIGHT_STATE.LANDING:
        this.statusText.textContent = 'DESCENT & LANDING';
        this.statusBadge.style.background = 'rgba(245, 158, 11, 0.25)';
        this.statusBadge.style.borderColor = 'rgba(245, 158, 11, 0.6)';
        this.launchBtnText.textContent = 'TOUCHDOWN...';
        this.launchBtn.disabled = true;
        break;
    }

    // 2. Update Telemetry Numbers & Gauges
    this.valAltitude.textContent = tele.altitude.toFixed(1);
    const altPct = Math.min(100, (tele.altitude / 26.0) * 100);
    this.barAltitude.style.width = `${altPct}%`;

    this.valSpeed.textContent = tele.speed.toFixed(1);
    const spdPct = Math.min(100, (tele.speed / 60.0) * 100);
    this.barSpeed.style.width = `${spdPct}%`;

    const throttlePct = Math.round(tele.throttle * 100);
    this.valThrottlePct.textContent = `${throttlePct}%`;
    this.barThrottle.style.width = `${throttlePct}%`;
    if (throttlePct > 80) {
      this.barThrottle.style.background = 'var(--accent-orange)';
    } else {
      this.barThrottle.style.background = 'var(--primary-cyan)';
    }

    const circuitPercent = Math.round(Math.min(1.0, tele.circuitProgress) * 100);
    this.valCircuitPct.textContent = `${circuitPercent}%`;

    this.telemetryTime.textContent = this.formatTime(tele.flightTime);
  }
}
