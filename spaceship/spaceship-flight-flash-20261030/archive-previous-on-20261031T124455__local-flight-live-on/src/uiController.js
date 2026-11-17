import { FlightPhase } from './flightController.js';
import { CameraMode } from './cameraController.js';

export class UIController {
  constructor(flightController, cameraController, audioController, environment) {
    this.flight = flightController;
    this.cam = cameraController;
    this.audio = audioController;
    this.env = environment;

    this.isPathVisible = true;

    this.initElements();
    this.attachEventListeners();
    this.updateHUD();
  }

  initElements() {
    // Top Bar
    this.btnAudio = document.getElementById('btn-audio');
    this.btnPath = document.getElementById('btn-path');
    this.btnInfo = document.getElementById('btn-info');
    this.btnFullscreen = document.getElementById('btn-fullscreen');
    this.infoModal = document.getElementById('info-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');

    // Flight Telemetry
    this.badgeStatus = document.getElementById('badge-status');
    this.valSpeed = document.getElementById('val-speed');
    this.valAltitude = document.getElementById('val-altitude');
    this.valThrottle = document.getElementById('val-throttle');
    this.barThrottle = document.getElementById('bar-throttle');
    this.valDistance = document.getElementById('val-distance');
    this.valWaypoint = document.getElementById('val-waypoint');
    this.valVRate = document.getElementById('val-vrate');

    // Primary Flight Action
    this.btnPrimary = document.getElementById('btn-primary-action');
    this.btnPrimaryLabel = document.getElementById('btn-primary-label');
    this.btnPrimaryIcon = document.getElementById('btn-primary-icon');
    this.btnPause = document.getElementById('btn-pause');
    this.btnReset = document.getElementById('btn-reset');
    this.speedButtons = document.querySelectorAll('.btn-speed');

    // Camera Controls
    this.camButtons = document.querySelectorAll('.btn-cam-mode');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnOrbitLeft = document.getElementById('btn-orbit-left');
    this.btnOrbitRight = document.getElementById('btn-orbit-right');
    this.btnResetCam = document.getElementById('btn-reset-cam');
  }

  attachEventListeners() {
    // Primary Action Button (Takeoff / Land / Re-launch)
    this.btnPrimary.addEventListener('click', () => {
      this.audio.resume();
      this.audio.playChime('click');

      const phase = this.flight.phase;
      if (phase === FlightPhase.READY_ON_PAD || phase === FlightPhase.LANDED_SUCCESS) {
        this.flight.startTakeoff();
      } else if (phase === FlightPhase.CIRCUIT_FLIGHT || phase === FlightPhase.VERTICAL_ASCENT) {
        this.flight.abortAndLand();
      }
      this.updateHUD();
    });

    // Pause / Resume
    this.btnPause.addEventListener('click', () => {
      this.audio.resume();
      this.audio.playChime('click');
      const isPaused = this.flight.togglePause();
      this.btnPause.innerHTML = isPaused
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Resume</span>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span>Pause</span>`;
      this.updateHUD();
    });

    // Reset to Pad
    this.btnReset.addEventListener('click', () => {
      this.audio.resume();
      this.audio.playChime('click');
      this.flight.reset();
      this.cam.resetCamera();
      this.updateHUD();
    });

    // Speed multiplier buttons (0.5x, 1x, 2x)
    this.speedButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.resume();
        this.audio.playChime('click');
        const speed = parseFloat(btn.getAttribute('data-speed'));
        this.flight.setSpeedMultiplier(speed);

        this.speedButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Camera Mode Selectors
    this.camButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.resume();
        this.audio.playChime('click');
        const mode = btn.getAttribute('data-cam');
        this.cam.setMode(mode);

        this.camButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Camera Orbit & Zoom Quick Actions
    this.btnZoomIn.addEventListener('click', () => {
      this.cam.zoom(1.25);
    });

    this.btnZoomOut.addEventListener('click', () => {
      this.cam.zoom(0.8);
    });

    this.btnOrbitLeft.addEventListener('click', () => {
      this.cam.orbitByAngle(Math.PI / 8); // 22.5 deg
    });

    this.btnOrbitRight.addEventListener('click', () => {
      this.cam.orbitByAngle(-Math.PI / 8);
    });

    this.btnResetCam.addEventListener('click', () => {
      this.cam.resetCamera();
      this.camButtons.forEach((b) => b.classList.remove('active'));
      const defaultCamBtn = document.querySelector('[data-cam="TRACKING"]');
      if (defaultCamBtn) defaultCamBtn.classList.add('active');
    });

    // Top Bar Actions
    this.btnAudio.addEventListener('click', () => {
      this.audio.resume();
      const isMuted = this.audio.toggleMute();
      this.btnAudio.innerHTML = isMuted
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      this.btnAudio.setAttribute('title', isMuted ? 'Unmute Sound' : 'Mute Sound');
    });

    this.btnPath.addEventListener('click', () => {
      this.isPathVisible = !this.isPathVisible;
      this.env.setPathVisible(this.isPathVisible);
      this.btnPath.classList.toggle('active', this.isPathVisible);
    });

    // Info Modal
    this.btnInfo.addEventListener('click', () => {
      this.infoModal.classList.toggle('open');
    });
    this.btnCloseModal.addEventListener('click', () => {
      this.infoModal.classList.remove('open');
    });
    this.infoModal.addEventListener('click', (e) => {
      if (e.target === this.infoModal) {
        this.infoModal.classList.remove('open');
      }
    });

    // Fullscreen Toggle
    this.btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  updateHUD() {
    const telem = this.flight.telemetry;
    const phase = this.flight.phase;

    // Update numbers
    this.valSpeed.textContent = telem.airspeed;
    this.valAltitude.textContent = telem.altitude;
    this.valThrottle.textContent = `${telem.throttle}%`;
    this.barThrottle.style.width = `${telem.throttle}%`;
    this.valDistance.textContent = `${telem.distanceToPad}m`;
    this.valWaypoint.textContent = telem.currentWaypoint;

    const vrateSign = telem.verticalSpeed > 0 ? '+' : '';
    this.valVRate.textContent = `${vrateSign}${telem.verticalSpeed} m/s`;
    this.valVRate.className = telem.verticalSpeed > 0.2 ? 'val positive' : (telem.verticalSpeed < -0.2 ? 'val negative' : 'val');

    // Status Badge & Primary Action Button Configuration
    this.badgeStatus.textContent = telem.phaseName;

    if (phase === FlightPhase.READY_ON_PAD) {
      this.badgeStatus.className = 'status-badge ready';
      this.btnPrimaryLabel.textContent = 'INITIATE TAKEOFF';
      this.btnPrimary.className = 'btn-primary-action launch';
      this.btnPrimaryIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"/></svg>`;
      this.btnPause.disabled = true;
    } else if (phase === FlightPhase.LANDED_SUCCESS) {
      this.badgeStatus.className = 'status-badge success';
      this.btnPrimaryLabel.textContent = 'RE-LAUNCH CIRCUIT';
      this.btnPrimary.className = 'btn-primary-action relaunch';
      this.btnPrimaryIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
      this.btnPause.disabled = true;
    } else {
      this.badgeStatus.className = 'status-badge in-flight';
      this.btnPrimaryLabel.textContent = 'RETURN & LAND NOW';
      this.btnPrimary.className = 'btn-primary-action abort-land';
      this.btnPrimaryIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
      this.btnPause.disabled = false;
    }
  }

  update() {
    this.updateHUD();
  }
}
