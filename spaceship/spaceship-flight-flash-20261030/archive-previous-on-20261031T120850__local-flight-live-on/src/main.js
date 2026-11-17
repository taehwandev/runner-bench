import * as THREE from 'three';
import { Environment } from './Environment.js';
import { LandingPad } from './LandingPad.js';
import { Spaceship } from './Spaceship.js';
import { ParticleSystem } from './ParticleSystem.js';
import { SoundEffects } from './SoundEffects.js';
import { FlightController, FLIGHT_STATE } from './FlightController.js';
import { CameraController, CAMERA_MODE } from './CameraController.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initThree();
    this.initComponents();
    this.initUI();
    this.bindEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.2,
      600
    );

    // 3. Renderer
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

  initComponents() {
    // Sound System
    this.sound = new SoundEffects();

    // Particles
    this.particles = new ParticleSystem(this.scene);

    // Environment & Scenery
    this.environment = new Environment(this.scene);

    // Landing Pad
    this.landingPad = new LandingPad(this.scene);

    // Spaceship
    this.spaceship = new Spaceship(this.scene);

    // Flight Controller
    this.flight = new FlightController(
      this.spaceship,
      this.landingPad,
      this.environment,
      this.particles,
      this.sound
    );

    // Camera Controller
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
      this.spaceship,
      this.landingPad
    );
  }

  initUI() {
    // DOM Element handles
    this.ui = {
      // Top bar
      statusPill: document.getElementById('status-pill'),
      statusLabel: document.getElementById('status-label'),
      btnAudio: document.getElementById('btn-audio'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnHelp: document.getElementById('btn-help'),

      // Telemetry
      valAlt: document.getElementById('val-alt'),
      valSpeed: document.getElementById('val-speed'),
      valThrottle: document.getElementById('val-throttle'),
      valGforce: document.getElementById('val-gforce'),
      meterAlt: document.getElementById('meter-alt'),
      meterSpeed: document.getElementById('meter-speed'),
      meterThrottle: document.getElementById('meter-throttle'),
      meterGforce: document.getElementById('meter-gforce'),
      circuitPct: document.getElementById('circuit-pct'),
      routeFill: document.getElementById('route-fill'),
      steps: {
        pad: document.getElementById('step-pad'),
        a: document.getElementById('step-a'),
        b: document.getElementById('step-b'),
        c: document.getElementById('step-c'),
        d: document.getElementById('step-d'),
        land: document.getElementById('step-land')
      },

      // Camera
      camOrbit: document.getElementById('cam-orbit'),
      camChase: document.getElementById('cam-chase'),
      camTower: document.getElementById('cam-tower'),
      camCockpit: document.getElementById('cam-cockpit'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      btnCamReset: document.getElementById('btn-cam-reset'),

      // Flight Controls
      btnPrimaryAction: document.getElementById('btn-primary-action'),
      btnActionIcon: document.getElementById('btn-action-icon'),
      btnActionText: document.getElementById('btn-action-text'),
      btnActionSub: document.getElementById('btn-action-sub'),
      btnHoverHold: document.getElementById('btn-hover-hold'),
      textHoverHold: document.getElementById('text-hover-hold'),
      speed05: document.getElementById('speed-05'),
      speed10: document.getElementById('speed-10'),
      speed20: document.getElementById('speed-20'),
      btnResetPad: document.getElementById('btn-reset-pad'),

      // Modal
      helpModal: document.getElementById('help-modal'),
      btnCloseHelp: document.getElementById('btn-close-help'),
      btnAckHelp: document.getElementById('btn-ack-help')
    };

    // Connect Flight state callbacks
    this.flight.onStateChange = (state) => this.handleFlightStateChange(state);
    this.flight.onTelemetryUpdate = (data) => this.handleTelemetryUpdate(data);

    // Connect Camera mode callback
    this.cameraController.onModeChange = (mode) => this.handleCameraModeChange(mode);
  }

  handleFlightStateChange(state) {
    const { statusPill, statusLabel, btnPrimaryAction, btnActionIcon, btnActionText, btnActionSub, btnHoverHold } = this.ui;

    // Reset base classes
    statusPill.className = 'status-pill';
    btnPrimaryAction.classList.remove('abort-mode');
    btnHoverHold.classList.remove('active');

    switch (state) {
      case FLIGHT_STATE.STANDBY:
        statusPill.classList.add('state-standby');
        statusLabel.textContent = 'PAD STANDBY';
        btnActionIcon.textContent = '▲';
        btnActionText.textContent = 'INITIATE TAKEOFF';
        btnActionSub.textContent = 'START LOCAL TEST CIRCUIT';
        break;

      case FLIGHT_STATE.LIFTOFF:
        statusPill.classList.add('state-flight');
        statusLabel.textContent = 'ASCENDING';
        btnPrimaryAction.classList.add('abort-mode');
        btnActionIcon.textContent = '▼';
        btnActionText.textContent = 'RETURN TO PAD';
        btnActionSub.textContent = 'ABORT TO APPROACH';
        break;

      case FLIGHT_STATE.CIRCUIT:
        statusPill.classList.add('state-flight');
        statusLabel.textContent = 'CIRCUIT FLIGHT';
        btnPrimaryAction.classList.add('abort-mode');
        btnActionIcon.textContent = '▼';
        btnActionText.textContent = 'RETURN TO PAD';
        btnActionSub.textContent = 'ABORT TO APPROACH';
        break;

      case FLIGHT_STATE.APPROACH:
        statusPill.classList.add('state-approach');
        statusLabel.textContent = 'APPROACH & ALIGN';
        btnActionIcon.textContent = '●';
        btnActionText.textContent = 'APPROACHING...';
        btnActionSub.textContent = 'AUTOLAND ENGAGED';
        break;

      case FLIGHT_STATE.TOUCHDOWN:
        statusPill.classList.add('state-approach');
        statusLabel.textContent = 'TOUCHDOWN';
        btnActionIcon.textContent = '●';
        btnActionText.textContent = 'LANDING ON PAD';
        btnActionSub.textContent = 'REVERSERS ACTIVE';
        break;

      case FLIGHT_STATE.HOVER_HOLD:
        statusPill.classList.add('state-hover');
        statusLabel.textContent = 'HOVER HOLD';
        btnHoverHold.classList.add('active');
        btnActionIcon.textContent = '►';
        btnActionText.textContent = 'RESUME FLIGHT';
        btnActionSub.textContent = 'DISENGAGE HOVER';
        break;
    }
  }

  handleTelemetryUpdate(data) {
    const {
      valAlt, valSpeed, valThrottle, valGforce,
      meterAlt, meterSpeed, meterThrottle, meterGforce,
      circuitPct, routeFill, steps
    } = this.ui;

    valAlt.textContent = data.altitude.toFixed(1);
    valSpeed.textContent = Math.round(data.airspeed);
    valThrottle.textContent = data.throttle;
    valGforce.textContent = data.gForce;

    // Meters
    meterAlt.style.width = `${Math.min(100, (data.altitude / 30) * 100)}%`;
    meterSpeed.style.width = `${Math.min(100, (data.airspeed / 140) * 100)}%`;
    meterThrottle.style.width = `${Math.min(100, data.throttle)}%`;
    meterGforce.style.width = `${Math.min(100, (parseFloat(data.gForce) / 3.5) * 100)}%`;

    // Circuit track progress
    circuitPct.textContent = `${data.circuitProgress}%`;
    routeFill.style.width = `${data.circuitProgress}%`;

    // Step indicators
    Object.values(steps).forEach(s => s.classList.remove('active'));
    if (data.state === FLIGHT_STATE.STANDBY) {
      steps.pad.classList.add('active');
    } else if (data.circuitProgress < 20) {
      steps.a.classList.add('active');
    } else if (data.circuitProgress < 45) {
      steps.b.classList.add('active');
    } else if (data.circuitProgress < 70) {
      steps.c.classList.add('active');
    } else if (data.circuitProgress < 90) {
      steps.d.classList.add('active');
    } else {
      steps.land.classList.add('active');
    }
  }

  handleCameraModeChange(mode) {
    const { camOrbit, camChase, camTower, camCockpit } = this.ui;
    [camOrbit, camChase, camTower, camCockpit].forEach(btn => btn.classList.remove('active'));

    if (mode === CAMERA_MODE.ORBIT) camOrbit.classList.add('active');
    if (mode === CAMERA_MODE.CHASE) camChase.classList.add('active');
    if (mode === CAMERA_MODE.TOWER) camTower.classList.add('active');
    if (mode === CAMERA_MODE.COCKPIT) camCockpit.classList.add('active');
  }

  bindEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Primary Action Launch / Abort
    this.ui.btnPrimaryAction.addEventListener('click', () => {
      this.sound.init();
      if (this.flight.state === FLIGHT_STATE.STANDBY) {
        this.flight.initiateTakeoff();
      } else if (this.flight.state === FLIGHT_STATE.HOVER_HOLD) {
        this.flight.toggleHoverHold();
      } else if (this.flight.state === FLIGHT_STATE.CIRCUIT || this.flight.state === FLIGHT_STATE.LIFTOFF) {
        this.flight.returnToPad();
      }
    });

    // Hover / Hold
    this.ui.btnHoverHold.addEventListener('click', () => {
      this.sound.init();
      this.flight.toggleHoverHold();
    });

    // Reset Pad
    this.ui.btnResetPad.addEventListener('click', () => {
      this.sound.init();
      this.flight.resetToPad();
      this.cameraController.resetCamera();
    });

    // Speed Rate Buttons
    const speedButtons = [this.ui.speed05, this.ui.speed10, this.ui.speed20];
    speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        this.flight.setSpeedMultiplier(speed);
      });
    });

    // Camera Mode Switchers
    this.ui.camOrbit.addEventListener('click', () => this.cameraController.setMode(CAMERA_MODE.ORBIT));
    this.ui.camChase.addEventListener('click', () => this.cameraController.setMode(CAMERA_MODE.CHASE));
    this.ui.camTower.addEventListener('click', () => this.cameraController.setMode(CAMERA_MODE.TOWER));
    this.ui.camCockpit.addEventListener('click', () => this.cameraController.setMode(CAMERA_MODE.COCKPIT));

    // Zoom Controls
    this.ui.btnZoomIn.addEventListener('click', () => this.cameraController.zoomIn(0.25));
    this.ui.btnZoomOut.addEventListener('click', () => this.cameraController.zoomOut(0.25));

    // Reset Camera
    this.ui.btnCamReset.addEventListener('click', () => this.cameraController.resetCamera());

    // Audio Toggle
    this.ui.btnAudio.addEventListener('click', () => {
      this.sound.init();
      const muted = this.sound.toggleMute();
      this.ui.iconSoundOn.classList.toggle('hidden', muted);
      this.ui.iconSoundOff.classList.toggle('hidden', !muted);
    });

    // Help Modal
    this.ui.btnHelp.addEventListener('click', () => this.ui.helpModal.classList.remove('hidden'));
    this.ui.btnCloseHelp.addEventListener('click', () => this.ui.helpModal.classList.add('hidden'));
    this.ui.btnAckHelp.addEventListener('click', () => this.ui.helpModal.classList.add('hidden'));
    this.ui.helpModal.addEventListener('click', (e) => {
      if (e.target === this.ui.helpModal) this.ui.helpModal.classList.add('hidden');
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if user is in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.ui.btnPrimaryAction.click();
          break;
        case 'KeyH':
          this.flight.toggleHoverHold();
          break;
        case 'KeyC': {
          const modes = [CAMERA_MODE.ORBIT, CAMERA_MODE.CHASE, CAMERA_MODE.TOWER, CAMERA_MODE.COCKPIT];
          const currIdx = modes.indexOf(this.cameraController.mode);
          const nextMode = modes[(currIdx + 1) % modes.length];
          this.cameraController.setMode(nextMode);
          break;
        }
        case 'KeyR':
          this.cameraController.resetCamera();
          break;
        case 'KeyM':
          this.ui.btnAudio.click();
          break;
        case 'Slash':
          if (e.shiftKey) this.ui.helpModal.classList.toggle('hidden');
          break;
      }
    });

    // Unlock Audio Context on first document interaction
    const unlockAudio = () => {
      this.sound.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update Flight Simulation
    this.flight.update(delta, elapsedTime);

    // 2. Update Landing Pad (lights, target rings)
    this.landingPad.update(elapsedTime, this.flight.state);

    // 3. Update Environment (radar dishes, waypoint rings)
    this.environment.update(elapsedTime, delta);

    // 4. Update Particle System (exhaust sparks, dust shockwaves)
    this.particles.update(delta);

    // 5. Update Camera Controller (orbit damping, chase camera, reset easing)
    this.cameraController.update(delta, elapsedTime);

    // 6. Render
    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate App
new App();
