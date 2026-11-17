import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCircuitCurve, calculateBankAngle, PAD_COORDINATES, CIRCUIT_WAYPOINTS } from '../src/flight/circuit.js';

describe('Circuit Math & Curve Utilities', () => {
  it('creates a smooth Catmull-Rom curve with valid start and end points', () => {
    const curve = createCircuitCurve();
    expect(curve).toBeDefined();

    const startPoint = curve.getPointAt(0);
    const endPoint = curve.getPointAt(1.0);

    // Should start and end at the hover point directly above pad (0, HOVER_ALTITUDE, 0)
    expect(startPoint.x).toBeCloseTo(0, 1);
    expect(startPoint.z).toBeCloseTo(0, 1);
    expect(endPoint.x).toBeCloseTo(0, 1);
    expect(endPoint.z).toBeCloseTo(0, 1);
  });

  it('keeps all waypoints within visual range of the spaceport', () => {
    CIRCUIT_WAYPOINTS.forEach((wp) => {
      const horizontalDist = Math.sqrt(wp.x * wp.x + wp.z * wp.z);
      // Horizontal radius should remain within 75m to keep spaceship clearly visible
      expect(horizontalDist).toBeLessThanOrEqual(75.0);
      // Altitude should be between 10m and 35m
      expect(wp.y).toBeGreaterThanOrEqual(10.0);
      expect(wp.y).toBeLessThanOrEqual(35.0);
    });
  });

  it('calculates proper bank angles into turns without exceeding maximum limit', () => {
    const tangent = new THREE.Vector3(0, 0, -1); // Facing North
    const nextTangentRight = new THREE.Vector3(0.5, 0, -0.866).normalize(); // Turning East (Right)
    const nextTangentLeft = new THREE.Vector3(-0.5, 0, -0.866).normalize(); // Turning West (Left)

    const bankRight = calculateBankAngle(tangent, nextTangentRight, 0.65);
    const bankLeft = calculateBankAngle(tangent, nextTangentLeft, 0.65);

    // Turning right produces negative bank (roll starboard)
    expect(bankRight).toBeLessThan(0);
    expect(Math.abs(bankRight)).toBeLessThanOrEqual(0.65);

    // Turning left produces positive bank (roll port)
    expect(bankLeft).toBeGreaterThan(0);
    expect(Math.abs(bankLeft)).toBeLessThanOrEqual(0.65);
  });
});
