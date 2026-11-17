import * as THREE from 'three';

/**
 * Waypoint data for the local test circuit around the landing pad.
 * Origin (0, 0, 0) is the center of the landing base.
 */
export const PAD_COORDINATES = new THREE.Vector3(0, 0.65, 0);
export const HOVER_ALTITUDE = 14.0;
export const HOVER_COORDINATES = new THREE.Vector3(0, HOVER_ALTITUDE, 0);

// Circuit waypoints starting and ending at the hover point above the pad
export const CIRCUIT_WAYPOINTS = [
  new THREE.Vector3(0, HOVER_ALTITUDE, 0),         // 0: Hover above pad
  new THREE.Vector3(0, 17.0, -25.0),               // 1: Initial climb forward
  new THREE.Vector3(30.0, 22.0, -45.0),            // 2: Sweeping banked right turn
  new THREE.Vector3(58.0, 26.0, -20.0),            // 3: Crosswind leg past radar tower
  new THREE.Vector3(62.0, 28.0, 25.0),             // 4: Downwind leg over scenic ridge
  new THREE.Vector3(35.0, 26.0, 55.0),             // 5: Downwind leg overlooking base
  new THREE.Vector3(-25.0, 22.0, 50.0),            // 6: Base turn over bay
  new THREE.Vector3(-48.0, 18.0, 15.0),            // 7: Approach corridor alignment
  new THREE.Vector3(-25.0, 15.5, -8.0),            // 8: Final approach curve
  new THREE.Vector3(0, HOVER_ALTITUDE, 0)          // 9: Re-enter hover above pad
];

/**
 * Creates a Catmull-Rom spline curve for the flight path.
 */
export function createCircuitCurve() {
  return new THREE.CatmullRomCurve3(CIRCUIT_WAYPOINTS, false, 'catmullrom', 0.5);
}

/**
 * Helper to calculate bank (roll) angle based on curvature and heading change.
 */
export function calculateBankAngle(tangent, nextTangent, maxBankRad = 0.55) {
  // Cross product of horizontal components indicates turn direction
  const crossY = tangent.x * nextTangent.z - tangent.z * nextTangent.x;
  // Desired roll banking into the turn
  const bank = -crossY * 8.0;
  return THREE.MathUtils.clamp(bank, -maxBankRad, maxBankRad);
}

/**
 * Flight phases
 */
export const FlightPhase = Object.freeze({
  LANDED: 'LANDED',
  SPOOLING: 'SPOOLING',
  TAKEOFF_VERTICAL: 'TAKEOFF_VERTICAL',
  CIRCUIT: 'CIRCUIT',
  APPROACH_HOVER: 'APPROACH_HOVER',
  LANDING_VERTICAL: 'LANDING_VERTICAL',
  TOUCHDOWN: 'TOUCHDOWN'
});
