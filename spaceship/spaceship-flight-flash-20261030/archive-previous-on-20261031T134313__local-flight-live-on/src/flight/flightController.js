import * as THREE from 'three';
import { PAD_COORDINATES, HOVER_ALTITUDE, FlightPhase, createCircuitCurve, calculateBankAngle } from './circuit.js';

export class FlightController {
  constructor(spaceshipModel) {
    this.ship = spaceshipModel;
    this.curve = createCircuitCurve();
    
    // State
    this.phase = FlightPhase.LANDED;
    this.isPaused = false;
    this.speedMultiplier = 1.0;
    
    // Timers & progress counters
    this.timer = 0;
    this.circuitT = 0; // 0 to 1 along curve
    
    // Physics / Motion state
    this.position = PAD_COORDINATES.clone();
    this.quaternion = new THREE.Quaternion();
    this.velocity = new THREE.Vector3();
    this.throttle = 0; // 0 to 1
    this.vtolThrottle = 0; // 0 to 1 (downward thrusters)
    this.gearExtension = 1.0; // 1 = deployed on pad, 0 = retracted in flight
    this.altitude = 0; // Relative to pad surface
    this.airspeed = 0; // km/h
    this.verticalSpeed = 0; // m/s
    this.heading = 0; // deg
    this.pitch = 0; // deg
    this.roll = 0; // deg
    
    // Previous position for velocity derivation
    this.prevPosition = this.position.clone();
    
    // Targets for smooth damping
    this.targetQuat = new THREE.Quaternion();
    
    // Callbacks
    this.onPhaseChange = null;
    this.onTelemetryUpdate = null;
    
    // Initialize ship transform
    this.applyTransform();
  }

  startCircuit() {
    if (this.phase === FlightPhase.LANDED || this.phase === FlightPhase.TOUCHDOWN) {
      this.phase = FlightPhase.SPOOLING;
      this.timer = 0;
      this.circuitT = 0;
      this.isPaused = false;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    } else if (this.isPaused) {
      this.isPaused = false;
    }
  }

  togglePause() {
    if (this.phase !== FlightPhase.LANDED && this.phase !== FlightPhase.TOUCHDOWN) {
      this.isPaused = !this.isPaused;
      return this.isPaused;
    }
    return false;
  }

  setPaused(paused) {
    if (this.phase !== FlightPhase.LANDED && this.phase !== FlightPhase.TOUCHDOWN) {
      this.isPaused = !!paused;
    }
  }

  abortAndLand() {
    if (this.phase === FlightPhase.CIRCUIT) {
      // Jump forward to final approach leg smoothly
      this.circuitT = Math.max(this.circuitT, 0.85);
    } else if (this.phase === FlightPhase.TAKEOFF_VERTICAL) {
      this.phase = FlightPhase.APPROACH_HOVER;
      this.timer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  resetToPad() {
    this.phase = FlightPhase.LANDED;
    this.isPaused = false;
    this.timer = 0;
    this.circuitT = 0;
    this.position.copy(PAD_COORDINATES);
    this.targetQuat.setFromEuler(new THREE.Euler(0, 0, 0));
    this.quaternion.copy(this.targetQuat);
    this.throttle = 0;
    this.vtolThrottle = 0;
    this.gearExtension = 1.0;
    this.altitude = 0;
    this.airspeed = 0;
    this.verticalSpeed = 0;
    this.applyTransform();
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = Math.max(0.2, Math.min(3.0, multiplier));
  }

  update(deltaSeconds) {
    // Sub-step to ensure deterministic kinematics even with varying frame rates or large steps
    const maxStep = 0.05;
    const steps = Math.min(Math.ceil(deltaSeconds / maxStep), 600);
    const dt = steps > 0 ? deltaSeconds / steps : 0;

    for (let i = 0; i < steps; i++) {
      this.step(dt);
    }

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        phase: this.phase,
        altitude: this.altitude,
        airspeed: this.airspeed,
        verticalSpeed: this.verticalSpeed,
        throttle: Math.round(this.throttle * 100),
        vtolThrottle: Math.round(this.vtolThrottle * 100),
        gearExtension: this.gearExtension,
        circuitProgress: Math.round(this.circuitT * 100),
        heading: Math.round(this.heading),
        pitch: Math.round(this.pitch),
        roll: Math.round(this.roll),
        isPaused: this.isPaused
      });
    }
  }

  step(deltaSeconds) {
    const dt = this.isPaused ? 0 : deltaSeconds * this.speedMultiplier;

    this.prevPosition.copy(this.position);

    switch (this.phase) {
      case FlightPhase.LANDED:
        this.updateLanded(dt);
        break;
      case FlightPhase.SPOOLING:
        this.updateSpooling(dt);
        break;
      case FlightPhase.TAKEOFF_VERTICAL:
        this.updateTakeoff(dt);
        break;
      case FlightPhase.CIRCUIT:
        this.updateCircuit(dt);
        break;
      case FlightPhase.APPROACH_HOVER:
        this.updateApproachHover(dt);
        break;
      case FlightPhase.LANDING_VERTICAL:
        this.updateLanding(dt);
        break;
      case FlightPhase.TOUCHDOWN:
        this.updateTouchdown(dt);
        break;
    }

    // Smoothly apply quaternion rotation
    this.quaternion.slerp(this.targetQuat, Math.min(1.0, 6.0 * deltaSeconds));

    // Update telemetry metrics
    if (deltaSeconds > 0) {
      this.velocity.subVectors(this.position, this.prevPosition).divideScalar(deltaSeconds);
      this.airspeed = this.velocity.length() * 3.6; // m/s to km/h
      this.verticalSpeed = this.velocity.y;
    }
    this.altitude = Math.max(0, this.position.y - PAD_COORDINATES.y);

    // Compute Euler angles
    const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ');
    this.heading = (THREE.MathUtils.radToDeg(euler.y) + 360) % 360;
    this.pitch = THREE.MathUtils.radToDeg(euler.x);
    this.roll = THREE.MathUtils.radToDeg(euler.z);

    this.applyTransform();
  }

  updateLanded(dt) {
    this.throttle = 0;
    this.vtolThrottle = 0;
    this.gearExtension = 1.0;
    this.position.copy(PAD_COORDINATES);
    this.targetQuat.setFromEuler(new THREE.Euler(0, 0, 0));
  }

  updateSpooling(dt) {
    this.timer += dt;
    const spoolDuration = 1.4;
    const progress = Math.min(1.0, this.timer / spoolDuration);
    this.vtolThrottle = progress * 0.9;
    this.throttle = progress * 0.3;
    
    // Subtle pre-launch engine vibration
    const shake = Math.sin(this.timer * 40) * 0.02 * progress;
    this.position.set(
      PAD_COORDINATES.x,
      PAD_COORDINATES.y + Math.max(0, shake),
      PAD_COORDINATES.z
    );

    if (this.timer >= spoolDuration - 1e-4) {
      this.phase = FlightPhase.TAKEOFF_VERTICAL;
      this.timer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateTakeoff(dt) {
    this.timer += dt;
    const climbDuration = 3.2;
    const t = Math.min(1.0, this.timer / climbDuration);
    
    // Smooth ease-in-out climb
    const ease = t * t * (3 - 2 * t);
    this.position.y = THREE.MathUtils.lerp(PAD_COORDINATES.y, HOVER_ALTITUDE, ease);
    this.position.x = 0;
    this.position.z = 0;

    this.vtolThrottle = 1.0;
    this.throttle = 0.2 + ease * 0.3;
    
    // Retract gear after clearing pad
    if (t > 0.25) {
      this.gearExtension = Math.max(0, 1.0 - (t - 0.25) / 0.5);
    }

    // Keep ship facing north initially with subtle pitch up as climb finishes
    const pitchUp = Math.sin(ease * Math.PI) * 0.08;
    this.targetQuat.setFromEuler(new THREE.Euler(-pitchUp, 0, 0));

    if (this.timer >= climbDuration - 1e-4) {
      this.phase = FlightPhase.CIRCUIT;
      this.timer = 0;
      this.circuitT = 0;
      this.gearExtension = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateCircuit(dt) {
    // Total circuit flight duration is ~22 seconds at 1x speed
    const circuitDuration = 22.0;
    const step = dt / circuitDuration;
    this.circuitT = Math.min(1.0, this.circuitT + step);

    // Get position on curve
    const currentPoint = this.curve.getPointAt(this.circuitT);
    this.position.copy(currentPoint);

    // Get forward tangent vector
    const tangent = this.curve.getTangentAt(this.circuitT).normalize();
    
    // Look ahead to calculate bank
    const lookAheadT = Math.min(1.0, this.circuitT + 0.02);
    const nextTangent = this.curve.getTangentAt(lookAheadT).normalize();
    const bankAngle = calculateBankAngle(tangent, nextTangent, 0.65);

    // Throttle & VTOL during circuit
    this.gearExtension = 0;
    this.vtolThrottle = 0.15; // Low stabilization thrust
    this.throttle = 0.85 + Math.sin(this.circuitT * Math.PI * 4) * 0.15;

    // Create forward orientation
    // Three.js spaceship model points along -Z axis by convention
    const forward = tangent.clone();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const correctedUp = new THREE.Vector3().crossVectors(right, forward).normalize();

    // Apply roll bank rotation around forward axis
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(forward, bankAngle);
    
    // Basis matrix for ship orientation (model nose is -Z)
    const m = new THREE.Matrix4();
    m.makeBasis(right, correctedUp, forward.clone().negate());
    this.targetQuat.setFromRotationMatrix(m);
    this.targetQuat.premultiply(rollQuat);

    if (this.circuitT >= 1.0 - 1e-4) {
      this.phase = FlightPhase.APPROACH_HOVER;
      this.timer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateApproachHover(dt) {
    this.timer += dt;
    const hoverDuration = 2.4;
    const t = Math.min(1.0, this.timer / hoverDuration);
    const ease = t * t * (3 - 2 * t);

    // Position settles smoothly onto hover coordinates above pad
    this.position.x = THREE.MathUtils.lerp(this.position.x, 0, ease * 0.2);
    this.position.z = THREE.MathUtils.lerp(this.position.z, 0, ease * 0.2);
    this.position.y = THREE.MathUtils.lerp(HOVER_ALTITUDE, HOVER_ALTITUDE - 2.0, ease);

    // Deploy landing gear
    this.gearExtension = Math.min(1.0, t * 1.2);

    this.throttle = Math.max(0.1, 0.6 * (1 - ease));
    this.vtolThrottle = 0.8 + ease * 0.2;

    // Level out wings and align facing forward (Euler 0, 0, 0)
    const levelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    this.targetQuat.slerp(levelQuat, 0.1);

    if (this.timer >= hoverDuration - 1e-4) {
      this.phase = FlightPhase.LANDING_VERTICAL;
      this.timer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateLanding(dt) {
    this.timer += dt;
    const descentDuration = 3.6;
    const t = Math.min(1.0, this.timer / descentDuration);
    
    // Smooth deceleration curve toward pad
    const ease = t * t * (3 - 2 * t);
    const startY = HOVER_ALTITUDE - 2.0;
    this.position.y = THREE.MathUtils.lerp(startY, PAD_COORDINATES.y, ease);
    this.position.x = 0;
    this.position.z = 0;

    this.gearExtension = 1.0;
    this.vtolThrottle = 1.0 - ease * 0.4;
    this.throttle = 0.15 * (1 - ease);

    this.targetQuat.setFromEuler(new THREE.Euler(0, 0, 0));

    if (this.timer >= descentDuration - 1e-4) {
      this.phase = FlightPhase.TOUCHDOWN;
      this.timer = 0;
      this.position.copy(PAD_COORDINATES);
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateTouchdown(dt) {
    this.timer += dt;
    const settleDuration = 1.2;
    const t = Math.min(1.0, this.timer / settleDuration);

    // Landing gear suspension settle compression
    const bounce = Math.sin(t * Math.PI) * 0.05 * (1 - t);
    this.position.y = PAD_COORDINATES.y - bounce;

    // Spool down engines
    this.throttle = Math.max(0, 0.15 * (1 - t));
    this.vtolThrottle = Math.max(0, 0.6 * (1 - t));

    if (this.timer >= settleDuration - 1e-4) {
      this.phase = FlightPhase.LANDED;
      this.position.copy(PAD_COORDINATES);
      this.throttle = 0;
      this.vtolThrottle = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  applyTransform() {
    if (this.ship) {
      this.ship.position.copy(this.position);
      this.ship.quaternion.copy(this.quaternion);
      if (typeof this.ship.setGearExtension === 'function') {
        this.ship.setGearExtension(this.gearExtension);
      }
      if (typeof this.ship.setThrottle === 'function') {
        this.ship.setThrottle(this.throttle, this.vtolThrottle);
      }
    }
  }
}
