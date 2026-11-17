import * as THREE from 'three';
import { WorldScene } from './scene.js';
import { Spaceship } from './spaceship.js';
import { ParticleManager } from './particles.js';
import { FlightController } from './flightController.js';
import { CameraController } from './cameraController.js';
import { AudioManager } from './audio.js';
import { UIController } from './ui.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 2. Initialize Scene
    this.scene = new THREE.Scene();

    // 3. Initialize Camera
    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.2,
      600
    );

    // 4. Initialize Sound Manager
    this.audio = new AudioManager();

    // 5. Initialize World Scene (Lighting, Sky, Pad, Spaceport scenery)
    this.world = new WorldScene(this.scene);

    // 6. Initialize Spaceship
    this.spaceship = new Spaceship();
    this.scene.add(this.spaceship.getMesh());

    // 7. Initialize Particle Systems
    this.particles = new ParticleManager(this.scene);

    // 8. Initialize Flight Controller
    this.flight = new FlightController(this.spaceship, this.particles, this.scene, this.audio);

    // 9. Initialize Camera Controller
    this.cameraCtrl = new CameraController(this.camera, this.renderer.domElement, this.spaceship);

    // 10. Initialize UI Controller
    this.ui = new UIController(this.flight, this.cameraCtrl, this.audio);

    // Timing
    this.clock = new THREE.Clock();

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Start render loop
    this.animate();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1); // Clamp delta to avoid huge jumps

    // Update world scenery animations (radar dish rotation, runway lights pulsing)
    this.world.update(delta);

    // Update flight dynamics & spaceship pose
    this.flight.update(delta);

    // Update camera tracking & orbit controls
    this.cameraCtrl.update(delta);

    // Update telemetry UI overlay
    this.ui.update();

    // Render 3D view
    this.renderer.render(this.scene, this.camera);
  }
}

// Bootstrap application once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
