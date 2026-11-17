import * as THREE from 'three';
import { Environment } from './scene.js';
import { Spaceship } from './spaceship.js';
import { FlightController } from './flightController.js';
import { CameraController } from './cameraController.js';
import { AudioSystem } from './audioSystem.js';
import { UIController } from './ui.js';

class App {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.clock = new THREE.Clock();

    this.initEngine();
    this.initScene();
    this.initShip();
    this.initControllers();
    this.initEvents();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initEngine() {
    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.2, 1000);
    this.camera.position.set(0, 4.5, -11);

    // 3. WebGL Renderer
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

  initScene() {
    this.env = new Environment(this.scene);
  }

  initShip() {
    this.ship = new Spaceship();
    this.scene.add(this.ship.group);

    // Add dust particles points directly to scene
    this.scene.add(this.ship.dustPoints);
  }

  initControllers() {
    this.audio = new AudioSystem();
    this.flight = new FlightController(this.ship, this.audio);
    this.cameraController = new CameraController(this.camera, this.renderer.domElement, this.ship);
    this.ui = new UIController(this.flight, this.cameraController, this.audio);

    // Expose app on window for testing & inspection
    window.__FLIGHT_APP__ = this;
  }

  initEvents() {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Clamp delta time to avoid large jumps if tab is inactive
    const delta = Math.min(0.1, this.clock.getDelta());
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update environment animations (radar dish, wind turbine, beacon lights)
    this.env.update(delta, elapsedTime);

    // 2. Update flight simulation state
    this.flight.update(delta);

    // 3. Update spaceship components (landing gear, particles, lights)
    const altitude = Math.max(0, this.ship.group.position.y - this.flight.padRestY);
    this.ship.update(delta, altitude);

    // 4. Update camera position & tracking
    this.cameraController.update(delta);

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
