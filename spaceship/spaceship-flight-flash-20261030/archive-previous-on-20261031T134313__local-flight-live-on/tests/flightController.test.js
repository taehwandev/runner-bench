import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { FlightController } from '../src/flight/flightController.js';
import { FlightPhase, PAD_COORDINATES, HOVER_ALTITUDE } from '../src/flight/circuit.js';

describe('FlightController State Machine & Flight Mechanics', () => {
  let mockShip;
  let controller;

  beforeEach(() => {
    mockShip = {
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      gearExtension: 1,
      throttle: 0,
      vtolThrottle: 0,
      setGearExtension(val) { this.gearExtension = val; },
      setThrottle(mainThr, vtolThr) {
        this.throttle = mainThr;
        this.vtolThrottle = vtolThr;
      }
    };
    controller = new FlightController(mockShip);
  });

  it('initializes in LANDED state on the pad with gear down and zero throttle', () => {
    expect(controller.phase).toBe(FlightPhase.LANDED);
    expect(controller.position.x).toBeCloseTo(PAD_COORDINATES.x, 2);
    expect(controller.position.y).toBeCloseTo(PAD_COORDINATES.y, 2);
    expect(controller.position.z).toBeCloseTo(PAD_COORDINATES.z, 2);
    expect(controller.throttle).toBe(0);
    expect(controller.gearExtension).toBe(1.0);
    expect(controller.altitude).toBeCloseTo(0, 2);
  });

  it('initiates takeoff sequence and enters SPOOLING on startCircuit', () => {
    let capturedPhase = null;
    controller.onPhaseChange = (phase) => { capturedPhase = phase; };

    controller.startCircuit();
    expect(controller.phase).toBe(FlightPhase.SPOOLING);
    expect(capturedPhase).toBe(FlightPhase.SPOOLING);

    // After 1.5 seconds of spooling, should transition to TAKEOFF_VERTICAL
    controller.update(1.5);
    expect(controller.phase).toBe(FlightPhase.TAKEOFF_VERTICAL);
    expect(controller.vtolThrottle).toBeGreaterThan(0.5);
  });

  it('climbs vertically and retracts landing gear during TAKEOFF_VERTICAL', () => {
    controller.startCircuit();
    controller.update(1.4); // Spooling finishes at 1.4s
    expect(controller.phase).toBe(FlightPhase.TAKEOFF_VERTICAL);

    // Update through middle of climb
    controller.update(1.6);
    expect(controller.position.y).toBeGreaterThan(PAD_COORDINATES.y + 4.0);
    expect(controller.gearExtension).toBeLessThan(1.0); // Gear is retracting

    // Finish climb (total climbDuration 3.2s)
    controller.update(1.6);
    expect(controller.phase).toBe(FlightPhase.CIRCUIT);
    expect(controller.gearExtension).toBe(0); // Fully retracted
  });

  it('flies along the circuit spline with positive airspeed and throttle', () => {
    controller.startCircuit();
    controller.update(1.4); // spool
    controller.update(3.2); // climb -> circuit
    expect(controller.phase).toBe(FlightPhase.CIRCUIT);

    const initialPos = controller.position.clone();
    controller.update(2.0);

    expect(controller.circuitT).toBeGreaterThan(0);
    expect(controller.throttle).toBeGreaterThan(0.5);
    // Ship must have moved from initial hover point
    expect(controller.position.distanceTo(initialPos)).toBeGreaterThan(1.0);
  });

  it('supports pausing and holding hover in mid-flight', () => {
    controller.startCircuit();
    controller.update(1.4); // spool
    controller.update(3.2); // climb -> circuit
    expect(controller.phase).toBe(FlightPhase.CIRCUIT);

    // Pause hover
    const isPaused = controller.togglePause();
    expect(isPaused).toBe(true);
    expect(controller.isPaused).toBe(true);

    const pausedPos = controller.position.clone();
    const pausedT = controller.circuitT;

    controller.update(1.0); // Advance clock while paused
    expect(controller.position.x).toBeCloseTo(pausedPos.x, 3);
    expect(controller.position.y).toBeCloseTo(pausedPos.y, 3);
    expect(controller.position.z).toBeCloseTo(pausedPos.z, 3);
    expect(controller.circuitT).toBe(pausedT);

    // Resume
    controller.togglePause();
    expect(controller.isPaused).toBe(false);
    controller.update(1.0);
    expect(controller.circuitT).toBeGreaterThan(pausedT);
  });

  it('completes the circuit and executes a smooth vertical landing back on pad', () => {
    controller.startCircuit();
    controller.update(1.4); // spool (1.4s)
    controller.update(3.2); // climb (3.2s) -> circuit
    expect(controller.phase).toBe(FlightPhase.CIRCUIT);

    // Advance circuit through completion (circuitDuration is 22.0s)
    controller.update(22.0);
    expect(controller.phase).toBe(FlightPhase.APPROACH_HOVER);

    // Approach hover settles over pad and extends gear (2.4s)
    controller.update(2.4);
    expect(controller.phase).toBe(FlightPhase.LANDING_VERTICAL);
    expect(controller.gearExtension).toBe(1.0); // Gear extended

    // Vertical descent to pad (3.6s)
    controller.update(3.6);
    expect(controller.phase).toBe(FlightPhase.TOUCHDOWN);

    // Settle onto pad (1.2s)
    controller.update(1.2);
    expect(controller.phase).toBe(FlightPhase.LANDED);
    expect(controller.position.x).toBeCloseTo(PAD_COORDINATES.x, 2);
    expect(controller.position.y).toBeCloseTo(PAD_COORDINATES.y, 2);
    expect(controller.position.z).toBeCloseTo(PAD_COORDINATES.z, 2);
    expect(controller.throttle).toBe(0);
    expect(controller.vtolThrottle).toBe(0);
  });

  it('resets cleanly to pad at any moment with resetToPad', () => {
    controller.startCircuit();
    controller.update(5.0);
    expect(controller.phase).not.toBe(FlightPhase.LANDED);

    controller.resetToPad();
    expect(controller.phase).toBe(FlightPhase.LANDED);
    expect(controller.position.x).toBe(PAD_COORDINATES.x);
    expect(controller.position.y).toBe(PAD_COORDINATES.y);
    expect(controller.position.z).toBe(PAD_COORDINATES.z);
    expect(controller.gearExtension).toBe(1.0);
    expect(controller.throttle).toBe(0);
  });
});
