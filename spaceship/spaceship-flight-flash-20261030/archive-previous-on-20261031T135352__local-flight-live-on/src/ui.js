import { FlightPhase } from './flightController.js';
import { CameraMode } from './cameraController.js';

export class UIController {
  constructor(flightController, cameraController, audioSystem) {
    this.flight = flightController;
    this.cam = cameraController;
    this.audio = audioSystem;

    // Cache DOM elements
    this.btnTakeoff = document.getElementById('btn-takeoff');
    this.btnLand = document.getElementById('btn-land');
    this.btnPause = document.getElementById('btn-pause');
    this.btnResetShip = document.getElementById('btn-reset-ship');
    this.pauseIcon = document.getElementById('pause-icon');
    this.pauseLabel = document.getElementById('pause-label');

    this.btnSound = document.getElementById('btn-sound');
    this.btnInfo = document.getElementById('btn-info');
    this.modal = document.getElementById('info-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.btnModalGotIt = document.getElementById('btn-modal-gotit');

    // Camera buttons
    this.camBtns = {
      [CameraMode.FOLLOW]: document.getElementById('cam-follow'),
      [CameraMode.PAD]: document.getElementById('cam-pad'),
      [CameraMode.FREE]: document.getElementById('cam-free'),
      [CameraMode.COCKPIT]: document.getElementById('cam-cockpit'),
    };
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnResetCam = document.getElementById('btn-reset-cam');

    // Telemetry fields
    this.hudStatus = document.getElementById('hud-status');
    this.hudAlt = document.getElementById('hud-alt');
    this.hudSpeed = document.getElementById('hud-speed');
    this.hudThrottle = document.getElementById('hud-throttle');
    this.hudGear = document.getElementById('hud-gear');
    this.hudProgressPct = document.getElementById('hud-progress-pct');
    this.hudProgressFill = document.getElementById('hud-progress-fill');

    // Speed pills
    this.speedPills = document.querySelectorAll('.btn-pill');

    this.initEvents();
    this.bindFlightCallbacks();
  }

  initEvents() {
    // Takeoff button
    this.btnTakeoff.addEventListener('click', () => {
      this.flight.startTakeoff();
    });

    // Land Now button
    this.btnLand.addEventListener('click', () => {
      this.flight.landNow();
    });

    // Pause / Resume button
    this.btnPause.addEventListener('click', () => {
      const isPaused = this.flight.togglePause();
      this.updatePauseState(isPaused);
    });

    // Reset Ship to Pad button
    this.btnResetShip.addEventListener('click', () => {
      this.flight.resetToPad();
    });

    // Sound toggle
    this.btnSound.addEventListener('click', () => {
      const isEnabled = this.audio.toggle();
      this.btnSound.classList.toggle('active', isEnabled);
      this.btnSound.querySelector('.icon-sound').textContent = isEnabled ? '🔊' : '🔇';
    });

    // Info modal open/close
    this.btnInfo.addEventListener('click', () => {
      this.modal.classList.remove('hidden');
    });
    this.btnCloseModal.addEventListener('click', () => {
      this.modal.classList.add('hidden');
    });
    this.btnModalGotIt.addEventListener('click', () => {
      this.modal.classList.add('hidden');
      if (this.flight.phase === FlightPhase.IDLE) {
        this.flight.startTakeoff();
      }
    });

    // Speed selector pills
    this.speedPills.forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        this.flight.setSpeed(speed);
        this.speedPills.forEach((p) => p.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Camera Mode buttons
    Object.entries(this.camBtns).forEach(([mode, btn]) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        this.cam.setMode(mode);
        this.updateActiveCamButton(mode);
      });
    });

    // Zoom & Reset camera buttons
    this.btnZoomIn.addEventListener('click', () => this.cam.zoomIn(3.5));
    this.btnZoomOut.addEventListener('click', () => this.cam.zoomOut(3.5));
    this.btnResetCam.addEventListener('click', () => this.cam.resetView());

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if modal or input is focused
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (this.flight.phase === FlightPhase.IDLE) {
          this.flight.startTakeoff();
        } else {
          const isPaused = this.flight.togglePause();
          this.updatePauseState(isPaused);
        }
      } else if (e.code === 'KeyR') {
        this.cam.resetView();
      } else if (e.code === 'KeyL') {
        this.flight.landNow();
      } else if (e.code === 'KeyM') {
        this.btnSound.click();
      } else if (e.code === 'Digit1') {
        this.camBtns[CameraMode.FOLLOW].click();
      } else if (e.code === 'Digit2') {
        this.camBtns[CameraMode.PAD].click();
      } else if (e.code === 'Digit3') {
        this.camBtns[CameraMode.FREE].click();
      } else if (e.code === 'Digit4') {
        this.camBtns[CameraMode.COCKPIT].click();
      } else if (e.code === 'Escape') {
        this.modal.classList.add('hidden');
      }
    });
  }

  updatePauseState(isPaused) {
    if (isPaused) {
      this.pauseIcon.textContent = '▶️';
      this.pauseLabel.textContent = 'Resume';
      this.hudStatus.textContent = 'FLIGHT PAUSED';
    } else {
      this.pauseIcon.textContent = '⏸️';
      this.pauseLabel.textContent = 'Pause';
      this.onPhaseChange(this.flight.phase);
    }
  }

  updateActiveCamButton(activeMode) {
    Object.entries(this.camBtns).forEach(([mode, btn]) => {
      if (btn) {
        btn.classList.toggle('active', mode === activeMode);
      }
    });
  }

  bindFlightCallbacks() {
    this.flight.onPhaseChange = (phase) => {
      this.onPhaseChange(phase);
    };

    this.flight.onTelemetryUpdate = (telemetry) => {
      this.onTelemetryUpdate(telemetry);
    };
  }

  onPhaseChange(phase) {
    switch (phase) {
      case FlightPhase.IDLE:
        this.btnTakeoff.disabled = false;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'INITIATE TAKEOFF';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Fly local circuit & return to pad';
        this.btnLand.disabled = true;
        this.btnPause.disabled = true;
        this.hudStatus.textContent = 'READY ON PAD';
        break;

      case FlightPhase.TAKEOFF:
        this.btnTakeoff.disabled = true;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'LIFTOFF IN PROGRESS';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Ascending to hover altitude...';
        this.btnLand.disabled = true;
        this.btnPause.disabled = false;
        this.hudStatus.textContent = 'VERTICAL CLIMB';
        break;

      case FlightPhase.CIRCUIT:
        this.btnTakeoff.disabled = true;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'FLYING CIRCUIT';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Local waypoint test pattern';
        this.btnLand.disabled = false; // user can command early return/landing anytime
        this.btnPause.disabled = false;
        this.hudStatus.textContent = 'CIRCUIT CRUISE';
        break;

      case FlightPhase.APPROACH:
        this.btnTakeoff.disabled = true;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'APPROACH & ALIGN';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Steering to pad hover axis...';
        this.btnLand.disabled = true;
        this.btnPause.disabled = false;
        this.hudStatus.textContent = 'PAD APPROACH';
        break;

      case FlightPhase.LANDING:
        this.btnTakeoff.disabled = true;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'FINAL DESCENT';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Controlled vertical touchdown...';
        this.btnLand.disabled = true;
        this.btnPause.disabled = false;
        this.hudStatus.textContent = 'FINAL DESCENT';
        break;

      case FlightPhase.TOUCHDOWN:
        this.btnTakeoff.disabled = true;
        this.btnTakeoff.querySelector('.btn-headline').textContent = 'TOUCHDOWN';
        this.btnTakeoff.querySelector('.btn-subtext').textContent = 'Engines spooling down to idle';
        this.btnLand.disabled = true;
        this.btnPause.disabled = true;
        this.hudStatus.textContent = 'TOUCHDOWN OK';
        break;
    }
  }

  onTelemetryUpdate(data) {
    if (!this.flight.isPaused) {
      if (this.hudStatus.textContent !== data.phase) {
        this.hudStatus.textContent = data.phase.replace('_', ' ');
      }
    }

    this.hudAlt.innerHTML = `${data.altitude} <span class="unit">m</span>`;
    this.hudSpeed.innerHTML = `${data.speed} <span class="unit">km/h</span>`;
    this.hudThrottle.innerHTML = `${data.throttle}<span class="unit">%</span>`;
    this.hudGear.textContent = data.gear;

    // Progress bar
    let pct = 0;
    if (data.phase === FlightPhase.TAKEOFF) {
      pct = Math.min(15, Math.round(parseFloat(data.altitude) / 16.0 * 15));
    } else if (data.phase === FlightPhase.CIRCUIT) {
      pct = 15 + Math.round(data.progress * 0.7);
    } else if (data.phase === FlightPhase.APPROACH) {
      pct = 88;
    } else if (data.phase === FlightPhase.LANDING) {
      pct = 95;
    } else if (data.phase === FlightPhase.TOUCHDOWN) {
      pct = 100;
    }

    this.hudProgressPct.textContent = `${pct}%`;
    this.hudProgressFill.style.width = `${pct}%`;
  }
}
