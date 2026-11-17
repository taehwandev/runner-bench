import * as THREE from 'three';
import { Spaceship } from './spaceship.js';
import { Environment } from './environment.js';
import { FlightPathController, FLIGHT_STATES } from './flightPath.js';
import { CameraManager, CAMERA_MODES } from './cameraManager.js';
import { soundManager } from './audio.js';

class FlightApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initThree();
    this.initScene();
    this.initUI();
    this.bindEvents();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0035);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);
  }

  initScene() {
    // Spaceship Model
    this.spaceship = new Spaceship();
    this.scene.add(this.spaceship.group);
    this.scene.add(this.spaceship.particleMesh);

    // Flight Controller
    this.flightCtrl = new FlightPathController(this.spaceship);

    // Environment & Spaceport Scenery
    this.environment = new Environment(this.scene, this.flightCtrl.circuitWaypoints);

    // Camera Manager with Orbit, Zoom, Reset & Mode controls
    this.camManager = new CameraManager(this.camera, this.renderer.domElement, this.spaceship);
  }

  initUI() {
    // Telemetry Elements
    this.elStatus = document.getElementById('telem-status');
    this.elAlt = document.getElementById('telem-alt');
    this.elSpeed = document.getElementById('telem-speed');
    this.elThrust = document.getElementById('telem-thrust');
    this.elThrustBar = document.getElementById('telem-thrust-bar');
    this.elWaypoint = document.getElementById('telem-waypoint');
    this.elProgressFill = document.getElementById('flight-progress-fill');
    this.stageTags = document.querySelectorAll('.stage-tag');

    // Controls
    this.btnLaunch = document.getElementById('btn-launch-circuit');
    this.btnLaunchTitle = document.getElementById('launch-btn-title');
    this.btnLaunchSub = document.getElementById('launch-btn-sub');
    this.btnLand = document.getElementById('btn-land-now');
    this.btnPause = document.getElementById('btn-pause-flight');
    this.iconPause = document.getElementById('icon-pause');
    this.iconResume = document.getElementById('icon-resume');
    this.labelPause = document.getElementById('label-pause-btn');

    // Camera Buttons
    this.camButtons = document.querySelectorAll('.cam-btn');
    this.btnZoomIn = document.getElementById('cam-zoom-in');
    this.btnZoomOut = document.getElementById('cam-zoom-out');
    this.btnReset = document.getElementById('cam-reset');

    // Audio & Path Toggles
    this.btnSound = document.getElementById('btn-sound-toggle');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.btnPath = document.getElementById('btn-path-toggle');
    this.pathVisible = true;

    // Help Modal
    this.btnInfo = document.getElementById('btn-info-toggle');
    this.modalInfo = document.getElementById('modal-info');
    this.btnModalClose = document.getElementById('btn-modal-close');
    this.btnModalGotIt = document.getElementById('btn-modal-got-it');

    // Screen Tracker Box
    this.screenTracker = document.getElementById('ship-screen-tracker');
    this.trackerTag = document.getElementById('tracker-tag-text');
  }

  bindEvents() {
    // Resize Listener
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Primary Launch Button
    this.btnLaunch.addEventListener('click', () => {
      soundManager.ensureContext();
      soundManager.playClick();
      if (this.flightCtrl.state === FLIGHT_STATES.PAD_READY || this.flightCtrl.state === FLIGHT_STATES.COMPLETED) {
        this.flightCtrl.startTakeoff();
      } else {
        // If already flying, toggle hover or trigger return
        this.flightCtrl.landNow();
      }
    });

    // Land Now Button
    this.btnLand.addEventListener('click', () => {
      soundManager.ensureContext();
      soundManager.playClick();
      this.flightCtrl.landNow();
    });

    // Pause / Hover Button
    this.btnPause.addEventListener('click', () => {
      soundManager.ensureContext();
      soundManager.playClick();
      const paused = this.flightCtrl.togglePause();
      this.updatePauseUI(paused);
    });

    // Speed Selector Pills
    const speedPills = document.querySelectorAll('.speed-pill');
    speedPills.forEach(pill => {
      pill.addEventListener('click', () => {
        soundManager.playClick();
        speedPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const speed = parseFloat(pill.dataset.speed);
        this.flightCtrl.setSpeed(speed);
      });
    });

    // Camera Mode Selectors
    this.camButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        soundManager.playClick();
        this.camButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.cam;
        this.camManager.setMode(mode);
      });
    });

    // Camera Zoom & Reset Buttons
    this.btnZoomIn.addEventListener('click', () => {
      soundManager.playClick();
      this.camManager.zoomIn();
    });

    this.btnZoomOut.addEventListener('click', () => {
      soundManager.playClick();
      this.camManager.zoomOut();
    });

    this.btnReset.addEventListener('click', () => {
      soundManager.playClick();
      this.camManager.resetCamera(true);
      this.setActiveCamButton('orbit');
    });

    // Audio Toggle
    this.btnSound.addEventListener('click', () => {
      const active = soundManager.toggleMute();
      this.iconSoundOn.classList.toggle('hidden', !active);
      this.iconSoundOff.classList.toggle('hidden', active);
      this.btnSound.classList.toggle('active', active);
    });

    // Flight Path Visualizer Toggle
    this.btnPath.addEventListener('click', () => {
      soundManager.playClick();
      this.pathVisible = !this.pathVisible;
      this.environment.toggleFlightPath(this.pathVisible);
      this.btnPath.classList.toggle('active', this.pathVisible);
    });

    // Modal Events
    this.btnInfo.addEventListener('click', () => {
      soundManager.playClick();
      this.modalInfo.classList.remove('hidden');
    });
    this.btnModalClose.addEventListener('click', () => {
      this.modalInfo.classList.add('hidden');
    });
    this.btnModalGotIt.addEventListener('click', () => {
      this.modalInfo.classList.add('hidden');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept if inside input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (this.flightCtrl.state === FLIGHT_STATES.PAD_READY || this.flightCtrl.state === FLIGHT_STATES.COMPLETED) {
            this.flightCtrl.startTakeoff();
          } else {
            const paused = this.flightCtrl.togglePause();
            this.updatePauseUI(paused);
          }
          break;

        case 'KeyL':
          this.flightCtrl.landNow();
          break;

        case 'KeyR':
          this.camManager.resetCamera(true);
          this.setActiveCamButton('orbit');
          break;

        case 'KeyC':
          this.cycleCameraMode();
          break;

        case 'KeyP':
          this.pathVisible = !this.pathVisible;
          this.environment.toggleFlightPath(this.pathVisible);
          this.btnPath.classList.toggle('active', this.pathVisible);
          break;

        case 'KeyM':
          const active = soundManager.toggleMute();
          this.iconSoundOn.classList.toggle('hidden', !active);
          this.iconSoundOff.classList.toggle('hidden', active);
          this.btnSound.classList.toggle('active', active);
          break;

        case 'KeyH':
          this.modalInfo.classList.toggle('hidden');
          break;
      }
    });
  }

  cycleCameraMode() {
    const modes = [CAMERA_MODES.ORBIT, CAMERA_MODES.CHASE, CAMERA_MODES.PAD_TOWER, CAMERA_MODES.COCKPIT];
    const currentIndex = modes.indexOf(this.camManager.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.camManager.setMode(nextMode);
    this.setActiveCamButton(nextMode);
  }

  setActiveCamButton(mode) {
    this.camButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cam === mode);
    });
  }

  updatePauseUI(isPaused) {
    this.iconPause.classList.toggle('hidden', isPaused);
    this.iconResume.classList.toggle('hidden', !isPaused);
    this.labelPause.textContent = isPaused ? 'Resume Flight' : 'Hover / Hold';
    this.btnPause.classList.toggle('active', isPaused);
  }

  updateHUD() {
    const state = this.flightCtrl.state;
    const isFlying = state !== FLIGHT_STATES.PAD_READY && state !== FLIGHT_STATES.COMPLETED;

    // Telemetry text
    this.elStatus.textContent = state;
    this.elAlt.innerHTML = `${this.flightCtrl.altitude.toFixed(1)} <small>m</small>`;
    this.elSpeed.innerHTML = `${this.flightCtrl.airspeed} <small>km/h</small>`;
    this.elThrust.textContent = `${this.flightCtrl.thrustOutput}%`;
    this.elThrustBar.style.width = `${this.flightCtrl.thrustOutput}%`;
    this.elWaypoint.textContent = `${this.flightCtrl.getWaypointIndex()} / 6`;

    // Status styling
    this.elStatus.classList.toggle('in-flight', isFlying && state !== FLIGHT_STATES.LANDING);
    this.elStatus.classList.toggle('landing', state === FLIGHT_STATES.LANDING || state === FLIGHT_STATES.APPROACH);

    // Launch Button States
    if (state === FLIGHT_STATES.PAD_READY) {
      this.btnLaunch.classList.remove('flying');
      this.btnLaunchTitle.textContent = 'INITIATE TAKEOFF';
      this.btnLaunchSub.textContent = 'Fly local test circuit & return to pad';
      this.btnLand.disabled = true;
      this.btnPause.disabled = true;
    } else if (state === FLIGHT_STATES.COMPLETED) {
      this.btnLaunch.classList.remove('flying');
      this.btnLaunchTitle.textContent = 'RESTART TEST CIRCUIT';
      this.btnLaunchSub.textContent = 'Spaceship landed safely on Pad-01';
      this.btnLand.disabled = true;
      this.btnPause.disabled = true;
    } else {
      this.btnLaunch.classList.add('flying');
      this.btnLaunchTitle.textContent = 'RETURN & LAND';
      this.btnLaunchSub.textContent = 'Recall ship to Pad-01';
      this.btnLand.disabled = false;
      this.btnPause.disabled = false;
    }

    // Circuit Progress Bar
    let progressPct = 0;
    if (state === FLIGHT_STATES.LIFTOFF) {
      progressPct = 12 * (this.flightCtrl.phaseTime / this.flightCtrl.liftoffDuration);
    } else if (state === FLIGHT_STATES.CIRCUIT) {
      progressPct = 12 + this.flightCtrl.flightProgress * 70;
    } else if (state === FLIGHT_STATES.APPROACH) {
      progressPct = 85;
    } else if (state === FLIGHT_STATES.LANDING) {
      progressPct = 88 + 12 * (this.flightCtrl.phaseTime / this.flightCtrl.landingDuration);
    } else if (state === FLIGHT_STATES.COMPLETED) {
      progressPct = 100;
    }
    this.elProgressFill.style.width = `${progressPct.toFixed(1)}%`;

    // Stage tags highlight
    this.stageTags.forEach(tag => {
      const stage = tag.dataset.stage;
      let active = false;
      if (stage === 'pad' && (state === FLIGHT_STATES.PAD_READY || state === FLIGHT_STATES.COMPLETED)) active = true;
      if (stage === 'takeoff' && state === FLIGHT_STATES.LIFTOFF) active = true;
      if (stage === 'climb' && state === FLIGHT_STATES.CIRCUIT && this.flightCtrl.flightProgress < 0.25) active = true;
      if (stage === 'canyon' && state === FLIGHT_STATES.CIRCUIT && this.flightCtrl.flightProgress >= 0.25 && this.flightCtrl.flightProgress < 0.55) active = true;
      if (stage === 'coastal' && state === FLIGHT_STATES.CIRCUIT && this.flightCtrl.flightProgress >= 0.55 && this.flightCtrl.flightProgress < 0.85) active = true;
      if (stage === 'approach' && (state === FLIGHT_STATES.APPROACH || (state === FLIGHT_STATES.CIRCUIT && this.flightCtrl.flightProgress >= 0.85))) active = true;
      if (stage === 'land' && state === FLIGHT_STATES.LANDING) active = true;
      tag.classList.toggle('active', active);
    });

    // Screen Space Tracker Box
    this.updateScreenTracker();
  }

  updateScreenTracker() {
    if (this.camManager.mode === CAMERA_MODES.COCKPIT) {
      this.screenTracker.classList.add('hidden');
      return;
    }

    const shipWorldPos = this.spaceship.group.position.clone().add(new THREE.Vector3(0, 0.7, 0));
    const projected = shipWorldPos.clone().project(this.camera);

    // Check if ship is in front of camera
    if (projected.z < 1.0) {
      const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

      this.screenTracker.style.left = `${screenX}px`;
      this.screenTracker.style.top = `${screenY}px`;
      this.screenTracker.classList.remove('hidden');

      const dist = this.camera.position.distanceTo(this.spaceship.group.position);
      this.trackerTag.textContent = `APEX-VII [${dist.toFixed(0)}m]`;
    } else {
      this.screenTracker.classList.add('hidden');
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Flight Physics & Trajectory
    this.flightCtrl.update(delta);

    // 2. Update Surrounding Environment & Animation
    this.environment.update(delta, elapsedTime);

    // 3. Update Camera System
    const isFlying = this.flightCtrl.state !== FLIGHT_STATES.PAD_READY && this.flightCtrl.state !== FLIGHT_STATES.COMPLETED;
    this.camManager.update(
      delta,
      isFlying,
      this.spaceship.group.position,
      this.spaceship.group.quaternion
    );

    // 4. Update HUD Overlays & Telemetry
    this.updateHUD();

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new FlightApp();
});
