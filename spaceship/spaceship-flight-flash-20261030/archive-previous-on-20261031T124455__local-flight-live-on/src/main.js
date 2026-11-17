import * as THREE from 'three';
import { Spaceship } from './spaceship.js';
import { Environment } from './environment.js';
import { FlightController } from './flightController.js';
import { CameraController } from './cameraController.js';
import { AudioController } from './audio.js';
import { UIController } from './uiController.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initThree();
    this.initComponents();
    this.setupEvents();
    this.animate();
  }

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.2, 1000);
    this.camera.position.set(16, 9, 18);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);
  }

  initComponents() {
    // Audio engine
    this.audioController = new AudioController();

    // Environment & Lighting
    this.environment = new Environment(this.scene);

    // Spaceship Model
    this.spaceship = new Spaceship();
    this.scene.add(this.spaceship.group);

    // Flight Dynamics Controller
    this.flightController = new FlightController(this.spaceship, this.audioController);

    // Create 3D Flight Circuit Visualizer trajectory line
    this.environment.createFlightPathVisualizer(this.flightController.getWaypoints());

    // Camera Controller (Smart Orbit / Chase / Tower / Free)
    this.cameraController = new CameraController(
      this.camera,
      this.renderer.domElement,
      this.spaceship
    );

    // UI Controller
    this.uiController = new UIController(
      this.flightController,
      this.cameraController,
      this.audioController,
      this.environment
    );
  }

  setupEvents() {
    window.addEventListener('resize', () => this.onResize(), false);

    // User gesture handler to resume AudioContext cleanly
    const startAudioOnInteraction = () => {
      this.audioController.resume();
      window.removeEventListener('pointerdown', startAudioOnInteraction);
      window.removeEventListener('keydown', startAudioOnInteraction);
    };
    window.addEventListener('pointerdown', startAudioOnInteraction);
    window.addEventListener('keydown', startAudioOnInteraction);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Update all systems
    this.flightController.update(delta);
    this.environment.update(delta);
    this.cameraController.update(delta);
    this.uiController.update();

    // Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start application on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
