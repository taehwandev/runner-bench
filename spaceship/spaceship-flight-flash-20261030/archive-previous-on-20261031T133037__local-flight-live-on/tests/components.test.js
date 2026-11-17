import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Spaceship } from '../src/spaceship.js';
import { ParticleManager } from '../src/particles.js';
import { CameraController, CAMERA_MODES } from '../src/cameraController.js';

describe('Spaceship Component', () => {
  it('builds spaceship group with hull, landing gear, and thruster plumes', () => {
    const ship = new Spaceship();
    const mesh = ship.getMesh();
    expect(mesh).toBeDefined();
    expect(mesh.name).toBe('Spaceship');
    expect(ship.landingGear.length).toBe(3);
    expect(ship.thrusterPlumes.length).toBe(2);
    expect(ship.navLights.length).toBe(2);
  });

  it('updates landing gear extension cleanly', () => {
    const ship = new Spaceship();
    expect(ship.targetGearExtension).toBe(1.0);
    ship.setLandingGear(0.0);
    expect(ship.targetGearExtension).toBe(0.0);

    // Update with delta
    ship.update(0.5, 0.5, true);
    expect(ship.gearExtension).toBeLessThan(1.0);
  });

  it('computes world positions for thruster plumes', () => {
    const ship = new Spaceship();
    const p0 = ship.getThrusterWorldPosition(0);
    const p1 = ship.getThrusterWorldPosition(1);
    expect(p0).toBeInstanceOf(THREE.Vector3);
    expect(p1).toBeInstanceOf(THREE.Vector3);
    expect(p0.x).not.toBe(p1.x); // Left and right nozzles
  });
});

describe('ParticleManager Component', () => {
  it('initializes exhaust and dust particle buffers in the scene', () => {
    const scene = new THREE.Scene();
    const pm = new ParticleManager(scene);
    expect(pm.exhaustMesh).toBeDefined();
    expect(pm.dustMesh).toBeDefined();
    expect(scene.children).toContain(pm.exhaustMesh);
    expect(scene.children).toContain(pm.dustMesh);
  });

  it('emits and updates particles safely', () => {
    const scene = new THREE.Scene();
    const pm = new ParticleManager(scene);

    // Emit exhaust
    pm.emitExhaust(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, -1), 0.8);
    expect(pm.exhaustParticles.some(p => p.life > 0)).toBe(true);

    // Emit dust
    pm.emitGroundDust(new THREE.Vector3(0, 0, 0), 0.7);
    expect(pm.dustParticles.some(p => p.life > 0)).toBe(true);

    // Advance time
    pm.update(0.1);
  });
});

describe('CameraController Component', () => {
  let camera;
  let ship;
  let domElement;
  let camCtrl;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    ship = new Spaceship();
    const ownerDoc = {
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    domElement = {
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
      ownerDocument: ownerDoc,
      getRootNode: () => ownerDoc
    };
    camCtrl = new CameraController(camera, domElement, ship);
  });

  it('initializes with DIRECTOR mode and default framing', () => {
    expect(camCtrl.mode).toBe(CAMERA_MODES.DIRECTOR);
    expect(camera.position.x).toBeCloseTo(16, 1);
    expect(camera.position.y).toBeCloseTo(7.5, 1);
    expect(camera.position.z).toBeCloseTo(20, 1);
  });

  it('switches camera modes properly', () => {
    camCtrl.setMode(CAMERA_MODES.CHASE);
    expect(camCtrl.mode).toBe(CAMERA_MODES.CHASE);

    camCtrl.setMode(CAMERA_MODES.TOWER);
    expect(camCtrl.mode).toBe(CAMERA_MODES.TOWER);
    expect(camera.position.x).toBeCloseTo(camCtrl.towerPosition.x, 1);

    camCtrl.setMode(CAMERA_MODES.FREE);
    expect(camCtrl.mode).toBe(CAMERA_MODES.FREE);
  });

  it('supports zoomIn and zoomOut', () => {
    const initialDist = camera.position.distanceTo(camCtrl.controls.target);
    camCtrl.zoomIn();
    const zoomedInDist = camera.position.distanceTo(camCtrl.controls.target);
    expect(zoomedInDist).toBeLessThan(initialDist);

    camCtrl.zoomOut();
    const zoomedOutDist = camera.position.distanceTo(camCtrl.controls.target);
    expect(zoomedOutDist).toBeGreaterThan(zoomedInDist);
  });

  it('triggers camera reset back towards default framing', () => {
    camera.position.set(50, 40, 50);
    camCtrl.resetCamera();
    expect(camCtrl.isResetting).toBe(true);
    expect(camCtrl.mode).toBe(CAMERA_MODES.DIRECTOR);

    // Advance reset animation
    camCtrl.update(1.2);
    expect(camCtrl.isResetting).toBe(false);
    expect(camera.position.x).toBeCloseTo(camCtrl.defaultPosition.x, 1);
  });
});
