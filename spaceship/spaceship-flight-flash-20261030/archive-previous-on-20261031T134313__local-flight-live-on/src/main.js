import * as THREE from 'three';
import { createEnvironment } from './scene/environment.js';
import { createSpaceship } from './models/spaceship.js';
import { FlightController } from './flight/flightController.js';
import { CameraManager } from './camera/cameraManager.js';
import { ParticleSystem } from './effects/particles.js';
import { SynthAudio } from './audio/synthAudio.js';
import { Hud } from './ui/hud.js';

export class App {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.2, 800);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Environment
    this.env = createEnvironment(this.scene);

    // 5. Spaceship Model
    this.ship = createSpaceship();
    this.scene.add(this.ship);

    // 6. Particle System
    this.particles = new ParticleSystem(this.scene);

    // 7. Flight Controller
    this.flight = new FlightController(this.ship);

    // 8. Camera Manager
    this.cameraManager = new CameraManager(this.camera, this.renderer.domElement, this.ship);

    // 9. Procedural Audio Synthesizer
    this.synthAudio = new SynthAudio();

    // 10. HUD & Telemetry Interface
    this.hud = new Hud({
      flightController: this.flight,
      cameraManager: this.cameraManager,
      synthAudio: this.synthAudio
    });

    // 11. Timing & Clock
    this.clock = new THREE.Clock();
    this.missionTime = 0;

    // Window Resize Event
    window.addEventListener('resize', () => this.onWindowResize(), false);

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    // Update Environment (Clouds drift, radar spins, pad lights pulse)
    if (this.env && this.env.group && typeof this.env.group.update === 'function') {
      this.env.group.update(delta);
    }

    // Update Spaceship strobe lights
    if (this.ship && typeof this.ship.updateBeacons === 'function') {
      this.ship.updateBeacons(delta);
    }

    // Update Flight State Machine & Kinematics
    this.flight.update(delta);

    // Update Particles (Thrusters & Ground Dust)
    const flightState = {
      position: this.flight.position,
      quaternion: this.flight.quaternion,
      throttle: this.flight.throttle,
      vtolThrottle: this.flight.vtolThrottle,
      altitude: this.flight.altitude,
      phase: this.flight.phase
    };
    this.particles.update(delta, this.ship, flightState);

    // Update Audio Synthesizer
    this.synthAudio.update(flightState);

    // Update Camera Mode & Controls
    this.cameraManager.update(delta, flightState);

    // Update Mission Timer in HUD
    if (this.flight.phase !== 'LANDED') {
      this.missionTime += delta;
      const mins = Math.floor(this.missionTime / 60);
      const secs = Math.floor(this.missionTime % 60);
      const elTimer = document.getElementById('flight-timer');
      if (elTimer) {
        elTimer.textContent = `T+ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
    } else {
      this.missionTime = 0;
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
