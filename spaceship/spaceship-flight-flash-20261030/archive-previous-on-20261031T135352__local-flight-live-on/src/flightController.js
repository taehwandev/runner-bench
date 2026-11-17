import * as THREE from 'three';

export const FlightPhase = {
  IDLE: 'IDLE',
  TAKEOFF: 'TAKEOFF',
  CIRCUIT: 'CIRCUIT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING',
  TOUCHDOWN: 'TOUCHDOWN',
};

export class FlightController {
  constructor(spaceship, audioSystem) {
    this.ship = spaceship;
    this.audio = audioSystem;

    // Resting altitude on pad
    this.padRestY = 0.69;
    this.hoverAltitude = 16.0;

    // Flight state
    this.phase = FlightPhase.IDLE;
    this.isPaused = false;
    this.speedMultiplier = 1.0;

    // Spline & timing
    this.circuitProgress = 0; // 0 to 1
    this.circuitDuration = 22.0; // seconds for full circuit at 1x speed
    this.phaseTimer = 0;

    // Touchdown bounce animation
    this.bounceTimer = 0;

    // Build Catmull-Rom flight spline
    this.buildFlightPath();

    // Reset ship to initial resting position
    this.resetToPad();

    // Callbacks
    this.onPhaseChange = null;
    this.onTelemetryUpdate = null;
  }

  buildFlightPath() {
    // 3D waypoints for the local test circuit near the pad (radius ~40-75m, altitude 16-36m)
    // All points are in comfortable daytime viewing distance of pad (0,0)
    const points = [
      new THREE.Vector3(0, 16.0, 5),     // Transition from liftoff hover
      new THREE.Vector3(5, 20.0, 22),    // WP1: Climb out over approach lights
      new THREE.Vector3(38, 28.0, 55),   // WP2: Valley turn
      new THREE.Vector3(75, 34.0, 15),   // WP3: Canyon ridge sweeping turn
      new THREE.Vector3(50, 32.0, -45),  // WP4: Downwind leg with outpost view
      new THREE.Vector3(-25, 26.0, -55), // WP5: Base turn over hills
      new THREE.Vector3(-35, 22.0, -10), // WP6: Final turn aligning with pad
      new THREE.Vector3(0, 18.0, 0),     // Arrive directly above landing pad
    ];

    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
  }

  resetToPad() {
    this.phase = FlightPhase.IDLE;
    this.isPaused = false;
    this.circuitProgress = 0;
    this.phaseTimer = 0;
    this.bounceTimer = 0;

    this.ship.group.position.set(0, this.padRestY, 0);
    this.ship.group.rotation.set(0, 0, 0);

    this.ship.setLandingGear(true);
    this.ship.gearExtension = 1;
    this.ship.setThrusterScale(0);
    this.ship.setVtolPower(0);

    if (this.audio) {
      this.audio.updateEngine(0, 0);
    }

    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  startTakeoff() {
    if (this.phase !== FlightPhase.IDLE) return;
    this.phase = FlightPhase.TAKEOFF;
    this.phaseTimer = 0;
    if (this.audio) {
      this.audio.playBeep(true);
    }
    if (this.onPhaseChange) this.onPhaseChange(this.phase);
  }

  landNow() {
    if (this.phase === FlightPhase.CIRCUIT) {
      // Abort remaining circuit and initiate smooth approach
      this.phase = FlightPhase.APPROACH;
      this.phaseTimer = 0;
      this.approachStartPos = this.ship.group.position.clone();
      this.approachStartRot = this.ship.group.quaternion.clone();
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  togglePause() {
    if (this.phase !== FlightPhase.IDLE) {
      this.isPaused = !this.isPaused;
    }
    return this.isPaused;
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
  }

  update(delta) {
    if (this.isPaused) return;
    const dt = delta * this.speedMultiplier;

    switch (this.phase) {
      case FlightPhase.IDLE:
        this.updateIdle(dt);
        break;
      case FlightPhase.TAKEOFF:
        this.updateTakeoff(dt);
        break;
      case FlightPhase.CIRCUIT:
        this.updateCircuit(dt);
        break;
      case FlightPhase.APPROACH:
        this.updateApproach(dt);
        break;
      case FlightPhase.LANDING:
        this.updateLanding(dt);
        break;
      case FlightPhase.TOUCHDOWN:
        this.updateTouchdown(dt);
        break;
    }

    // Telemetry updates
    this.broadcastTelemetry();
  }

  updateIdle(dt) {
    // Ship resting solidly on pad
    this.ship.group.position.set(0, this.padRestY, 0);
    this.ship.group.rotation.set(0, 0, 0);
    this.ship.setThrusterScale(0);
    this.ship.setVtolPower(0);
    if (this.audio) {
      this.audio.updateEngine(0, 0);
    }
  }

  updateTakeoff(dt) {
    this.phaseTimer += dt;
    const t = this.phaseTimer;

    // Stage 1: Spool up (0 to 1.2s)
    if (t < 1.2) {
      const spool = t / 1.2;
      this.ship.setVtolPower(spool * 0.7);
      this.ship.setThrusterScale(spool * 0.25);
      if (this.audio) {
        this.audio.updateEngine(spool * 0.4, 0);
      }
      return;
    }

    // Stage 2: Vertical Lift (1.2s to 4.5s)
    const liftT = Math.min(1.0, (t - 1.2) / 3.3);
    const smoothLift = liftT * liftT * (3 - 2 * liftT); // smoothstep
    const targetY = THREE.MathUtils.lerp(this.padRestY, this.hoverAltitude, smoothLift);
    this.ship.group.position.y = targetY;

    // Retract landing gear once 4m above ground
    if (targetY > 4.5 && this.ship.targetGearExtension === 1) {
      this.ship.setLandingGear(false);
      if (this.audio) {
        this.audio.playGearSound(false);
      }
    }

    // Slight nose dip and thruster spool as ship transitions
    if (liftT > 0.6) {
      const pitchAngle = (liftT - 0.6) * 0.2;
      this.ship.group.rotation.x = pitchAngle;
      this.ship.setThrusterScale(0.3 + (liftT - 0.6) * 1.2);
    }

    this.ship.setVtolPower(0.85);
    if (this.audio) {
      this.audio.updateEngine(0.55 + liftT * 0.2, targetY);
    }

    // Transition to Circuit
    if (liftT >= 1.0) {
      this.phase = FlightPhase.CIRCUIT;
      this.circuitProgress = 0;
      this.phaseTimer = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateCircuit(dt) {
    // Advance progress along spline
    const step = dt / this.circuitDuration;
    this.circuitProgress = Math.min(1.0, this.circuitProgress + step);

    const u = this.circuitProgress;
    const currentPos = this.curve.getPoint(u);
    this.ship.group.position.copy(currentPos);

    // Calculate heading / tangent
    const tangent = this.curve.getTangent(u).normalize();

    // Calculate curvature / bank angle by comparing tangent with tangent slightly ahead
    const lookAheadU = Math.min(1.0, u + 0.02);
    const nextTangent = this.curve.getTangent(lookAheadU).normalize();

    // Cross product between horizontal tangents gives turn direction and rate
    const yawDelta = Math.atan2(
      tangent.x * nextTangent.z - tangent.z * nextTangent.x,
      tangent.x * nextTangent.x + tangent.z * nextTangent.z
    );

    // Bank angle (roll into turn)
    const targetBank = THREE.MathUtils.clamp(-yawDelta * 38.0, -0.65, 0.65); // up to ~37 degrees

    // Pitch based on climb/descent
    const targetPitch = Math.asin(tangent.y);

    // Create target orientation matrix
    // In Three.js, Object forward is +Z. We want +Z facing tangent direction!
    const targetRotMatrix = new THREE.Matrix4();
    const upVector = new THREE.Vector3(0, 1, 0);

    // Apply roll bank rotation around tangent
    const rightVector = new THREE.Vector3().crossVectors(upVector, tangent).normalize();
    const bankedUp = new THREE.Vector3().crossVectors(tangent, rightVector);
    bankedUp.applyAxisAngle(tangent, targetBank);

    targetRotMatrix.lookAt(new THREE.Vector3(0, 0, 0), tangent, bankedUp);
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(targetRotMatrix);

    // Slerp for silky smooth flight rotations
    this.ship.group.quaternion.slerp(targetQuaternion, 0.12);

    // Modulate engine power
    const throttle = 0.65 + Math.abs(tangent.y) * 0.25;
    this.ship.setThrusterScale(throttle);
    this.ship.setVtolPower(0.08); // minimal during cruise

    if (this.audio) {
      this.audio.updateEngine(throttle, currentPos.y);
    }

    // Circuit completion check
    if (this.circuitProgress >= 1.0) {
      this.phase = FlightPhase.APPROACH;
      this.phaseTimer = 0;
      this.approachStartPos = this.ship.group.position.clone();
      this.approachStartRot = this.ship.group.quaternion.clone();
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateApproach(dt) {
    this.phaseTimer += dt;
    const duration = 2.8;
    const t = Math.min(1.0, this.phaseTimer / duration);
    const ease = t * t * (3 - 2 * t);

    // Align ship directly over pad at hover altitude (0, hoverAltitude, 0)
    const targetHoverPos = new THREE.Vector3(0, this.hoverAltitude, 0);
    this.ship.group.position.lerpVectors(this.approachStartPos, targetHoverPos, ease);

    // Level out attitude (level roll & pitch, facing forward Z)
    const targetRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    this.ship.group.quaternion.slerp(targetRot, ease);

    // Deploy landing gear during approach
    if (t > 0.3 && this.ship.targetGearExtension === 0) {
      this.ship.setLandingGear(true);
      if (this.audio) {
        this.audio.playGearSound(true);
      }
    }

    // Engine transitions to VTOL hover
    this.ship.setThrusterScale(0.3 * (1 - ease));
    this.ship.setVtolPower(0.5 + ease * 0.4);

    if (this.audio) {
      this.audio.updateEngine(0.55, this.ship.group.position.y);
    }

    if (t >= 1.0) {
      this.phase = FlightPhase.LANDING;
      this.phaseTimer = 0;
      this.landingStartY = this.ship.group.position.y;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateLanding(dt) {
    this.phaseTimer += dt;
    const duration = 4.2;
    const t = Math.min(1.0, this.phaseTimer / duration);

    // Smooth cushioned descent: fast initial descent, gentle deceleration near touch
    // easeInOutQuad / cubic smoothstep
    const descentEase = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.ship.group.position.y = THREE.MathUtils.lerp(this.landingStartY, this.padRestY, descentEase);
    this.ship.group.position.x = 0;
    this.ship.group.position.z = 0;

    // Small atmospheric wobble during descent
    const wobble = Math.sin(this.phaseTimer * 8) * (1 - t) * 0.02;
    this.ship.group.rotation.z = wobble;

    // VTOL thrusters flare to cushion touchdown
    this.ship.setVtolPower(0.7 + (1 - t) * 0.25);
    this.ship.setThrusterScale(0.1);

    if (this.audio) {
      this.audio.updateEngine(0.45 + (1 - t) * 0.25, this.ship.group.position.y);
    }

    if (t >= 1.0) {
      // Touchdown contact!
      this.phase = FlightPhase.TOUCHDOWN;
      this.bounceTimer = 0;
      this.ship.group.position.y = this.padRestY;
      this.ship.group.rotation.set(0, 0, 0);

      if (this.audio) {
        this.audio.playTouchdownSound();
        this.audio.playBeep(true);
      }
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  updateTouchdown(dt) {
    this.bounceTimer += dt;

    // Gentle suspension bounce and settle
    if (this.bounceTimer < 0.6) {
      const b = this.bounceTimer / 0.6;
      const bounce = Math.sin(b * Math.PI) * 0.04 * (1 - b);
      this.ship.group.position.y = this.padRestY - bounce;
    } else {
      this.ship.group.position.y = this.padRestY;
    }

    // Engine spool down to zero
    const spoolDown = Math.max(0, 1.0 - this.bounceTimer / 1.5);
    this.ship.setVtolPower(spoolDown * 0.4);
    this.ship.setThrusterScale(0);

    if (this.audio) {
      this.audio.updateEngine(spoolDown * 0.2, 0);
    }

    // Return to IDLE after settle
    if (this.bounceTimer > 2.0) {
      this.phase = FlightPhase.IDLE;
      this.circuitProgress = 0;
      if (this.onPhaseChange) this.onPhaseChange(this.phase);
    }
  }

  broadcastTelemetry() {
    if (!this.onTelemetryUpdate) return;

    const altitude = Math.max(0, this.ship.group.position.y - this.padRestY);

    // Estimate speed in km/h based on state
    let speed = 0;
    if (this.phase === FlightPhase.CIRCUIT) {
      speed = 180 + this.ship.throttle * 80;
    } else if (this.phase === FlightPhase.TAKEOFF || this.phase === FlightPhase.LANDING) {
      speed = 25 + this.ship.vtolPower * 20;
    } else if (this.phase === FlightPhase.APPROACH) {
      speed = 65;
    }

    // Pitch & Roll angles in degrees
    const euler = new THREE.Euler().setFromQuaternion(this.ship.group.quaternion, 'YXZ');
    const pitchDeg = THREE.MathUtils.radToDeg(euler.x);
    const rollDeg = THREE.MathUtils.radToDeg(euler.z);

    this.onTelemetryUpdate({
      phase: this.phase,
      altitude: altitude.toFixed(1),
      speed: Math.round(speed),
      throttle: Math.round(Math.max(this.ship.throttle, this.ship.vtolPower) * 100),
      gear: this.ship.gearExtension > 0.8 ? 'DOWN' : (this.ship.gearExtension < 0.2 ? 'UP' : 'MOVING'),
      pitch: pitchDeg.toFixed(0),
      roll: rollDeg.toFixed(0),
      progress: Math.round(this.circuitProgress * 100),
      isPaused: this.isPaused,
    });
  }
}
