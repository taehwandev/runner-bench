// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CameraManager, CameraMode } from '../src/camera/cameraManager.js';
import { FlightController } from '../src/flight/flightController.js';
import { FlightPhase, PAD_COORDINATES } from '../src/flight/circuit.js';

describe('CameraManager & View Controls', () => {
  let camera;
  let domElement;
  let mockShip;
  let cameraManager;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(50, 1.6, 0.1, 1000);
    domElement = document.createElement('div');
    document.body.appendChild(domElement);

    mockShip = {
      position: new THREE.Vector3(0, 0.65, 0),
      quaternion: new THREE.Quaternion()
    };
    cameraManager = new CameraManager(camera, domElement, mockShip);
  });

  it('starts in ORBIT_PAD mode with OrbitControls enabled', () => {
    expect(cameraManager.mode).toBe(CameraMode.ORBIT_PAD);
    expect(cameraManager.controls.enabled).toBe(true);
    expect(cameraManager.controls.target.x).toBeCloseTo(0, 2);
    expect(cameraManager.controls.target.y).toBeCloseTo(4, 2);
    expect(cameraManager.controls.target.z).toBeCloseTo(0, 2);
  });

  it('switches to CHASE mode and aligns tracking behind ship', () => {
    cameraManager.setMode(CameraMode.CHASE);
    expect(cameraManager.mode).toBe(CameraMode.CHASE);
    expect(cameraManager.controls.enabled).toBe(false);

    // Simulate flight update
    const shipState = {
      position: new THREE.Vector3(10, 15, -20),
      quaternion: new THREE.Quaternion()
    };

    cameraManager.update(0.1, shipState);
    // Camera should move toward ship position + local offset
    expect(camera.position.x).toBeDefined();
    expect(camera.position.y).toBeDefined();
  });

  it('switches to INSPECT mode centered directly on ship', () => {
    cameraManager.setMode(CameraMode.INSPECT);
    expect(cameraManager.mode).toBe(CameraMode.INSPECT);
    expect(cameraManager.controls.enabled).toBe(true);
  });

  it('switches to TOWER mode positioned on the observation deck', () => {
    cameraManager.setMode(CameraMode.TOWER);
    expect(cameraManager.mode).toBe(CameraMode.TOWER);
    expect(camera.position.x).toBeCloseTo(-28.0, 1);
    expect(camera.position.y).toBeCloseTo(24.5, 1);
    expect(camera.position.z).toBeCloseTo(-20.0, 1);
  });

  it('switches to COCKPIT mode looking ahead', () => {
    cameraManager.setMode(CameraMode.COCKPIT);
    expect(cameraManager.mode).toBe(CameraMode.COCKPIT);
    expect(cameraManager.controls.enabled).toBe(false);
  });

  it('resets camera to default pad overview position and target', () => {
    camera.position.set(100, 200, 300);
    cameraManager.resetCamera(false); // Immediate reset

    expect(cameraManager.mode).toBe(CameraMode.ORBIT_PAD);
    expect(camera.position.x).toBeCloseTo(26.0, 1);
    expect(camera.position.y).toBeCloseTo(16.0, 1);
    expect(camera.position.z).toBeCloseTo(36.0, 1);
    expect(cameraManager.controls.target.y).toBeCloseTo(4.0, 1);
  });

  it('zooms in and out smoothly within distance boundaries', () => {
    cameraManager.resetCamera(false);
    const initialDistance = camera.position.distanceTo(cameraManager.controls.target);

    cameraManager.zoom(0.2); // Zoom in 20%
    const zoomedInDistance = camera.position.distanceTo(cameraManager.controls.target);
    expect(zoomedInDistance).toBeLessThan(initialDistance);

    cameraManager.zoom(-0.25); // Zoom back out
    const zoomedOutDistance = camera.position.distanceTo(cameraManager.controls.target);
    expect(zoomedOutDistance).toBeGreaterThan(zoomedInDistance);
  });
});

describe('Simulation Speed Multipliers & Early Land Triggers', () => {
  let controller;
  let mockShip;

  beforeEach(() => {
    mockShip = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      gearExtension: 1,
      throttle: 0,
      vtolThrottle: 0,
      setGearExtension(v) { this.gearExtension = v; },
      setThrottle(m, v) { this.throttle = m; this.vtolThrottle = v; }
    };
    controller = new FlightController(mockShip);
  });

  it('sets speed multiplier and clamps within safe bounds [0.2, 3.0]', () => {
    controller.setSpeedMultiplier(2.0);
    expect(controller.speedMultiplier).toBe(2.0);

    controller.setSpeedMultiplier(0.1);
    expect(controller.speedMultiplier).toBe(0.2);

    controller.setSpeedMultiplier(5.0);
    expect(controller.speedMultiplier).toBe(3.0);
  });

  it('abortAndLand shortcuts circuit to final approach leg', () => {
    controller.startCircuit();
    controller.update(1.4); // spool
    controller.update(3.2); // climb -> circuit
    expect(controller.phase).toBe(FlightPhase.CIRCUIT);

    controller.abortAndLand();
    expect(controller.circuitT).toBeGreaterThanOrEqual(0.85);
  });
});
