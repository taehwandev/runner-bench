import * as THREE from 'three';
import { soundManager } from './audio.js';

export const FLIGHT_STATES = {
  PAD_READY: 'PAD READY',
  LIFTOFF: 'LIFTOFF',
  CIRCUIT: 'LOCAL CIRCUIT',
  APPROACH: 'APPROACHING PAD',
  LANDING: 'TOUCHDOWN DESCENT',
  HOVER_HOLD: 'HOVER / HOLD',
  COMPLETED: 'LANDED SAFELY'
};

export class FlightPathController {
  constructor(spaceship) {
    this.ship = spaceship;
    this.state = FLIGHT_STATES.PAD_READY;
    this.speedMultiplier = 1.0;
    this.isPaused = false;
    this.flightProgress = 0; // 0 to 1 along circuit
    
    // Pad resting coordinates
    this.padPosition = new THREE.Vector3(0, 1.25, 0);
    this.hoverHeight = 14.0;
    
    // Flight Circuit Waypoints (Local circuit orbiting the spaceport & surrounding landmarks)
    this.circuitWaypoints = [
      new THREE.Vector3(0, 14.0, 0),       // Liftoff apex above pad
      new THREE.Vector3(0, 18.0, -28.0),   // WP1: North Tower Climb
      new THREE.Vector3(-36.0, 24.0, -42.0),// WP2: Ridge High Bank
      new THREE.Vector3(-45.0, 22.0, 15.0), // WP3: Coastal Downwind
      new THREE.Vector3(-18.0, 16.0, 40.0), // WP4: Base Entry Turn
      new THREE.Vector3(0, 12.0, 18.0),    // WP5: Inbound Corridor
      new THREE.Vector3(0, 12.0, 0)        // WP6: Final Hover Gate over Pad
    ];

    // Spline curve for smooth flight trajectory
    this.curve = new THREE.CatmullRomCurve3(this.circuitWaypoints, false, 'centripetal', 0.5);

    // Current spatial coordinates & orientation
    this.currentPosition = this.padPosition.clone();
    this.targetRotation = new THREE.Quaternion();
    this.currentRotation = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.airspeed = 0; // km/h display
    this.altitude = 0; // meters display
    this.thrustOutput = 12; // %

    // State transition tracking
    this.phaseTime = 0;
    this.liftoffDuration = 3.6;
    this.landingDuration = 4.2;
    this.circuitDuration = 22.0; // base seconds for 1 full circuit

    // Initialize ship at pad
    this.resetToPad();
  }

  resetToPad() {
    this.state = FLIGHT_STATES.PAD_READY;
    this.flightProgress = 0;
    this.phaseTime = 0;
    this.isPaused = false;
    this.airspeed = 0;
    this.altitude = 0;
    this.thrustOutput = 12;

    this.currentPosition.copy(this.padPosition);
    this.currentRotation.set(0, 0, 0, 1);
    this.targetRotation.set(0, 0, 0, 1);
    
    this.ship.group.position.copy(this.currentPosition);
    this.ship.group.quaternion.copy(this.currentRotation);
    this.ship.setThrust(0.12);
  }

  startTakeoff() {
    if (this.state !== FLIGHT_STATES.PAD_READY && this.state !== FLIGHT_STATES.COMPLETED) return;
    this.state = FLIGHT_STATES.LIFTOFF;
    this.phaseTime = 0;
    this.flightProgress = 0;
    this.isPaused = false;
    soundManager.playLaunchChime();
  }

  landNow() {
    if (this.state === FLIGHT_STATES.PAD_READY || this.state === FLIGHT_STATES.COMPLETED) return;
    // Transition smoothly to landing approach
    this.state = FLIGHT_STATES.APPROACH;
    this.phaseTime = 0;
  }

  togglePause() {
    if (this.state === FLIGHT_STATES.PAD_READY || this.state === FLIGHT_STATES.COMPLETED) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.previousState = this.state;
      this.state = FLIGHT_STATES.HOVER_HOLD;
    } else {
      this.state = this.previousState || FLIGHT_STATES.CIRCUIT;
    }
    return this.isPaused;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  update(delta) {
    if (this.isPaused && this.state === FLIGHT_STATES.HOVER_HOLD) {
      this.updateHoverHold(delta);
      return;
    }

    const effectiveDelta = delta * this.speedMultiplier;

    switch (this.state) {
      case FLIGHT_STATES.PAD_READY:
      case FLIGHT_STATES.COMPLETED:
        this.updateOnPad(delta);
        break;

      case FLIGHT_STATES.LIFTOFF:
        this.updateLiftoff(effectiveDelta);
        break;

      case FLIGHT_STATES.CIRCUIT:
        this.updateCircuit(effectiveDelta);
        break;

      case FLIGHT_STATES.APPROACH:
        this.updateApproach(effectiveDelta);
        break;

      case FLIGHT_STATES.LANDING:
        this.updateLanding(effectiveDelta);
        break;
    }

    // Sync Three.js ship transform
    this.ship.group.position.copy(this.currentPosition);
    this.ship.group.quaternion.slerp(this.targetRotation, 0.12);
    
    // Ship internal updates (particles, strobes, lights)
    const isFlying = this.state !== FLIGHT_STATES.PAD_READY && this.state !== FLIGHT_STATES.COMPLETED;
    this.ship.update(delta, this.currentPosition, this.ship.group.quaternion, isFlying);

    // Audio frequency & rumble update
    const speedNorm = Math.min(this.airspeed / 260, 1.0);
    const throttleNorm = this.thrustOutput / 100;
    soundManager.updateEngine(throttleNorm, speedNorm);
  }

  updateOnPad(delta) {
    this.airspeed = 0;
    this.altitude = 0.0;
    this.thrustOutput = 12;
    this.ship.setThrust(0.12, delta);
  }

  updateLiftoff(delta) {
    this.phaseTime += delta;
    const progress = Math.min(this.phaseTime / this.liftoffDuration, 1.0);
    
    // Smooth cubic ease-in-out for liftoff vertical acceleration
    const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    const targetY = THREE.MathUtils.lerp(this.padPosition.y, this.hoverHeight, ease);
    this.currentPosition.set(0, targetY, 0);

    // Slight gentle nose-down pitch to prepare for forward transition
    const pitchEuler = new THREE.Euler(-0.06 * ease, 0, 0, 'YXZ');
    this.targetRotation.setFromEuler(pitchEuler);

    // Telemetry
    this.altitude = (this.currentPosition.y - this.padPosition.y);
    this.airspeed = Math.round(progress * 75);
    this.thrustOutput = Math.round(75 + Math.sin(this.phaseTime * 8) * 4);
    this.ship.setThrust(0.85, delta);

    if (progress >= 1.0) {
      this.state = FLIGHT_STATES.CIRCUIT;
      this.flightProgress = 0;
      this.phaseTime = 0;
    }
  }

  updateCircuit(delta) {
    // Progress along spline
    const step = delta / this.circuitDuration;
    this.flightProgress += step;

    if (this.flightProgress >= 1.0) {
      this.flightProgress = 1.0;
      this.state = FLIGHT_STATES.APPROACH;
      this.phaseTime = 0;
      return;
    }

    const t = Math.min(Math.max(this.flightProgress, 0), 1.0);
    const pos = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t).normalize();

    // Natural banking physics: calculate curvature/turn rate
    const tNext = Math.min(t + 0.015, 1.0);
    const tangentNext = this.curve.getTangentAt(tNext).normalize();
    const cross = new THREE.Vector3().crossVectors(tangent, tangentNext);
    const turnRate = cross.y; // Positive = turning left, Negative = turning right

    // Dynamic bank angle proportional to turn rate
    const maxBank = 0.55; // ~32 degrees
    const rollAngle = -turnRate * 28.0;
    const clampedRoll = THREE.MathUtils.clamp(rollAngle, -maxBank, maxBank);

    // Pitch derived from climb/dive tangent angle
    const pitchAngle = Math.asin(tangent.y);

    // Build rotation matrix from forward tangent and desired up-vector with bank
    const upVector = new THREE.Vector3(0, 1, 0);
    const normalVector = new THREE.Vector3().crossVectors(tangent, upVector).normalize();
    
    // Apply roll rotation around forward tangent
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(tangent, clampedRoll);
    
    // Forward orientation
    const m = new THREE.Matrix4();
    const eye = pos;
    const lookTarget = pos.clone().add(tangent);
    m.lookAt(eye, lookTarget, upVector);
    this.targetRotation.setFromRotationMatrix(m);
    this.targetRotation.multiply(rollQuat);

    this.currentPosition.copy(pos);

    // Telemetry
    this.altitude = (this.currentPosition.y - this.padPosition.y);
    this.airspeed = Math.round(180 + Math.abs(clampedRoll) * 50 + (1 - tangent.y) * 35);
    this.thrustOutput = Math.round(82 + Math.sin(t * 12) * 8);
    this.ship.setThrust(this.thrustOutput / 100, delta);
  }

  updateApproach(delta) {
    this.phaseTime += delta;
    const approachDuration = 2.8;
    const progress = Math.min(this.phaseTime / approachDuration, 1.0);

    // Ease toward center hovering gate (0, 12, 0)
    const targetHover = new THREE.Vector3(0, 12.0, 0);
    this.currentPosition.lerp(targetHover, 0.06);

    // Level out rotation to flat hover pose
    const levelQuat = new THREE.Quaternion().set(0, 0, 0, 1);
    this.targetRotation.slerp(levelQuat, 0.08);

    // Deceleration telemetry
    this.altitude = (this.currentPosition.y - this.padPosition.y);
    this.airspeed = Math.round((1 - progress) * 90);
    this.thrustOutput = Math.round(55 + (1 - progress) * 20);
    this.ship.setThrust(0.6, delta);

    if (progress >= 1.0 || this.currentPosition.distanceTo(targetHover) < 0.6) {
      this.state = FLIGHT_STATES.LANDING;
      this.phaseTime = 0;
    }
  }

  updateLanding(delta) {
    this.phaseTime += delta;
    const progress = Math.min(this.phaseTime / this.landingDuration, 1.0);

    // Smooth landing descent ease
    const startY = 12.0;
    const endY = this.padPosition.y;
    // Cubic ease out for soft touchdown cushion
    const ease = 1 - Math.pow(1 - progress, 2.5);
    
    this.currentPosition.x = THREE.MathUtils.lerp(this.currentPosition.x, 0, 0.1);
    this.currentPosition.z = THREE.MathUtils.lerp(this.currentPosition.z, 0, 0.1);
    this.currentPosition.y = THREE.MathUtils.lerp(startY, endY, ease);

    // Perfect level landing orientation
    this.targetRotation.set(0, 0, 0, 1);

    // Telemetry
    this.altitude = Math.max(0, this.currentPosition.y - endY);
    this.airspeed = Math.round((1 - progress) * 35);
    this.thrustOutput = Math.round(45 + Math.sin(this.phaseTime * 6) * 10);
    this.ship.setThrust(0.45 * (1 - progress * 0.7), delta);

    if (progress >= 1.0) {
      this.currentPosition.copy(this.padPosition);
      this.state = FLIGHT_STATES.COMPLETED;
      this.altitude = 0;
      this.airspeed = 0;
      this.thrustOutput = 12;
      this.flightProgress = 1.0;
      this.ship.setThrust(0.12);
      soundManager.playLandingChime();
    }
  }

  updateHoverHold(delta) {
    // Gentle station-keeping hover oscillation
    this.phaseTime += delta;
    const hoverBob = Math.sin(this.phaseTime * 3) * 0.15;
    this.currentPosition.y += hoverBob * delta;
    
    this.airspeed = 0;
    this.altitude = (this.currentPosition.y - this.padPosition.y);
    this.thrustOutput = 58;
    this.ship.setThrust(0.58, delta);
    this.ship.update(delta, this.currentPosition, this.ship.group.quaternion, true);
  }

  getWaypointIndex() {
    if (this.state === FLIGHT_STATES.PAD_READY) return 0;
    if (this.state === FLIGHT_STATES.LIFTOFF) return 1;
    if (this.state === FLIGHT_STATES.CIRCUIT) {
      return Math.min(Math.floor(this.flightProgress * 5) + 1, 5);
    }
    if (this.state === FLIGHT_STATES.APPROACH) return 6;
    if (this.state === FLIGHT_STATES.LANDING) return 6;
    if (this.state === FLIGHT_STATES.COMPLETED) return 6;
    return 0;
  }
}
