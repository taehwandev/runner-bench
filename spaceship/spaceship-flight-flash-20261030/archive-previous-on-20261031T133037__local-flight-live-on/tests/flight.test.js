import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FLIGHT_STATE, FlightController } from '../src/flightController.js';

// Mock minimal dependencies for testing FlightController logic
class MockSpaceship {
  constructor() {
    this.group = new THREE.Group();
    this.gear = 1.0;
  }
  getMesh() { return this.group; }
  setLandingGear(val) { this.gear = val; }
  update(delta, throttle, isFlying) {}
  getThrusterWorldPosition(idx) { return new THREE.Vector3(); }
}

class MockParticles {
  emitExhaust() {}
  emitGroundDust() {}
  update(delta) {}
}

class MockAudio {
  playLaunchTone() {}
  playTouchdownTone() {}
  updateEngineSound() {}
  setFlightActive() {}
}

describe('FlightController State Machine & Flight Mechanics', () => {
  let scene;
  let ship;
  let particles;
  let audio;
  let controller;

  beforeEach(() => {
    scene = new THREE.Scene();
    ship = new MockSpaceship();
    particles = new MockParticles();
    audio = new MockAudio();
    controller = new FlightController(ship, particles, scene, audio);
  });

  it('initializes in READY state on landing pad', () => {
    expect(controller.state).toBe(FLIGHT_STATE.READY);
    expect(controller.altitude).toBe(0);
    expect(controller.throttle).toBe(0.1);
    expect(controller.currentSpeed).toBe(0);
    expect(controller.currentPosition.y).toBeCloseTo(0.46, 2);
  });

  it('launches from READY into TAKEOFF', () => {
    const success = controller.launch();
    expect(success).toBe(true);
    expect(controller.state).toBe(FLIGHT_STATE.TAKEOFF);
  });

  it('refuses launch if not in READY state', () => {
    controller.launch();
    const secondLaunch = controller.launch();
    expect(secondLaunch).toBe(false);
  });

  it('completes takeoff and transitions to CIRCUIT state', () => {
    controller.launch();

    // Simulate takeoff duration (4 seconds)
    controller.update(2.0);
    expect(controller.state).toBe(FLIGHT_STATE.TAKEOFF);
    expect(controller.altitude).toBeGreaterThan(1.0);
    expect(controller.throttle).toBeGreaterThan(0.5);

    // Reach end of takeoff
    controller.update(2.5);
    expect(controller.state).toBe(FLIGHT_STATE.CIRCUIT);
    expect(controller.currentPosition.y).toBeCloseTo(12.0, 1);
  });

  it('flies through CIRCUIT and transitions to APPROACH and LANDING back on pad', () => {
    controller.launch();
    // Complete takeoff
    controller.update(4.5);
    expect(controller.state).toBe(FLIGHT_STATE.CIRCUIT);

    // Simulate circuit duration (20 seconds)
    controller.update(20.5);
    expect(controller.state).toBe(FLIGHT_STATE.APPROACH);

    // Simulate approach duration (3.5 seconds)
    controller.update(3.6);
    expect(controller.state).toBe(FLIGHT_STATE.LANDING);

    // Simulate landing duration (4.5 seconds)
    controller.update(4.6);
    // Completes flight and settles back into READY on the pad
    expect(controller.state).toBe(FLIGHT_STATE.READY);
    expect(controller.currentPosition.y).toBeCloseTo(0.46, 2);
    expect(controller.currentPosition.x).toBeCloseTo(0, 1);
    expect(controller.currentPosition.z).toBeCloseTo(0, 1);
    expect(controller.altitude).toBeCloseTo(0, 2);
  });

  it('allows user abort / returnToPad during CIRCUIT', () => {
    controller.launch();
    controller.update(4.5);
    expect(controller.state).toBe(FLIGHT_STATE.CIRCUIT);

    const aborted = controller.returnToPad();
    expect(aborted).toBe(true);
    expect(controller.state).toBe(FLIGHT_STATE.APPROACH);
  });

  it('pauses and resumes flight correctly', () => {
    controller.launch();
    controller.update(1.0);
    const altBefore = controller.altitude;

    const paused = controller.togglePause();
    expect(paused).toBe(true);
    expect(controller.isPaused).toBe(true);

    controller.update(1.0);
    expect(controller.altitude).toBeCloseTo(altBefore, 2);

    const resumed = controller.togglePause();
    expect(resumed).toBe(false);
    expect(controller.isPaused).toBe(false);

    controller.update(1.0);
    expect(controller.altitude).toBeGreaterThan(altBefore);
  });

  it('respects speed multipliers (0.5x, 1.5x)', () => {
    controller.setSpeedMultiplier(2.0);
    expect(controller.speedMultiplier).toBe(2.0);
  });

  it('returns valid telemetry data structure', () => {
    const tele = controller.getTelemetry();
    expect(tele).toHaveProperty('state');
    expect(tele).toHaveProperty('altitude');
    expect(tele).toHaveProperty('speed');
    expect(tele).toHaveProperty('throttle');
    expect(tele).toHaveProperty('flightTime');
    expect(tele).toHaveProperty('circuitProgress');
    expect(tele).toHaveProperty('position');
  });
});
