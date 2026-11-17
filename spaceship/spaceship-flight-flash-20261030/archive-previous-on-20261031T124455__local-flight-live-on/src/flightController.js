import * as THREE from 'three';

export const FlightPhase = {
  READY_ON_PAD: 'READY_ON_PAD',
  TAKEOFF_SPOOL: 'TAKEOFF_SPOOL',
  VERTICAL_ASCENT: 'VERTICAL_ASCENT',
  CIRCUIT_FLIGHT: 'CIRCUIT_FLIGHT',
  APPROACH_HOVER: 'APPROACH_HOVER',
  VERTICAL_DESCENT: 'VERTICAL_DESCENT',
  TOUCHDOWN: 'TOUCHDOWN',
  LANDED_SUCCESS: 'LANDED_SUCCESS',
};

export class FlightController {
  constructor(spaceship, audioController) {
    this.ship = spaceship;
    this.audio = audioController;

    this.phase = FlightPhase.READY_ON_PAD;
    this.speedMultiplier = 1.0;
    this.isPaused = false;

    // Flight spline definition
    this.circuitCurve = null;
    this.circuitDuration = 22.0; // seconds for full circuit at 1x
    this.circuitProgress = 0;   // 0 to 1

    // State timers
    this.phaseTimer = 0;
    this.ascentHeight = 13.0;
    this.padY = 0.72; // Rest height on pad
    this.currentPosition = new THREE.Vector3(0, this.padY, 0);
    this.currentQuaternion = new THREE.Quaternion();

    // Telemetry state
    this.telemetry = {
      airspeed: 0,
      altitude: 0,
      throttle: 0,
      verticalSpeed: 0,
      distanceToPad: 0,
      currentWaypoint: 'PAD 04',
      phaseName: 'READY ON PAD',
    };

    // Touchdown bounce physics
    this.bounceTimer = 0;

    this.setupCircuit();
    this.reset();
  }

  setupCircuit() {
    // 3D waypoints for scenic local test circuit
    this.circuitWaypoints = [
      new THREE.Vector3(0, 13.0, 0),       // 0: Hover exit
      new THREE.Vector3(5, 17.0, 28),      // 1: Acceleration exit
      new THREE.Vector3(42, 24.0, 36),     // 2: Solar farm climb turn
      new THREE.Vector3(64, 32.0, -10),    // 3: Overlook radar ridge apex
      new THREE.Vector3(30, 30.0, -55),    // 4: Northern pass high-speed sweep
      new THREE.Vector3(-36, 22.0, -42),   // 5: Cryo depot wide bank
      new THREE.Vector3(-34, 15.0, 16),    // 6: South-west base turn
      new THREE.Vector3(-10, 10.5, 20),    // 7: Runway approach line-up
      new THREE.Vector3(0, 8.0, 6),        // 8: Final corridor
      new THREE.Vector3(0, 7.0, 0),        // 9: Pad threshold hover
    ];

    this.circuitCurve = new THREE.CatmullRomCurve3(this.circuitWaypoints, false, 'catmullrom', 0.4);
  }

  getWaypoints() {
    return this.circuitWaypoints;
  }

  reset() {
    this.phase = FlightPhase.READY_ON_PAD;
    this.circuitProgress = 0;
    this.phaseTimer = 0;
    this.bounceTimer = 0;
    this.isPaused = false;

    this.ship.group.position.set(0, this.padY, 0);
    this.ship.group.quaternion.set(0, 0, 0, 1);
    this.ship.setGearProgress(1.0);
    this.ship.setThrottle(0.04);

    this.updateTelemetry(0, 0, 0.04, 0, 'PAD 04', 'READY ON PAD');
  }

  startTakeoff() {
    if (this.phase === FlightPhase.READY_ON_PAD || this.phase === FlightPhase.LANDED_SUCCESS) {
      this.phase = FlightPhase.TAKEOFF_SPOOL;
      this.phaseTimer = 0;
      this.isPaused = false;
      this.audio.playChime('takeoff');
      return true;
    }
    return false;
  }

  abortAndLand() {
    if (this.phase === FlightPhase.CIRCUIT_FLIGHT) {
      // Shortcut directly to approach hover
      this.phase = FlightPhase.APPROACH_HOVER;
      this.phaseTimer = 0;
      this.audio.playChime('approach');
    } else if (this.phase === FlightPhase.VERTICAL_ASCENT) {
      this.phase = FlightPhase.APPROACH_HOVER;
      this.phaseTimer = 0;
    }
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  setSpeedMultiplier(speed) {
    this.speedMultiplier = Math.max(0.2, Math.min(3.0, speed));
  }

  update(delta) {
    if (this.isPaused) {
      this.ship.update(0, this.telemetry.altitude);
      return;
    }

    const dt = delta * this.speedMultiplier;
    this.phaseTimer += dt;

    switch (this.phase) {
      case FlightPhase.READY_ON_PAD:
        this.updateReadyOnPad(dt);
        break;

      case FlightPhase.TAKEOFF_SPOOL:
        this.updateTakeoffSpool(dt);
        break;

      case FlightPhase.VERTICAL_ASCENT:
        this.updateVerticalAscent(dt);
        break;

      case FlightPhase.CIRCUIT_FLIGHT:
        this.updateCircuitFlight(dt);
        break;

      case FlightPhase.APPROACH_HOVER:
        this.updateApproachHover(dt);
        break;

      case FlightPhase.VERTICAL_DESCENT:
        this.updateVerticalDescent(dt);
        break;

      case FlightPhase.TOUCHDOWN:
        this.updateTouchdown(dt);
        break;

      case FlightPhase.LANDED_SUCCESS:
        this.updateLandedSuccess(dt);
        break;
    }

    this.ship.update(delta, this.telemetry.altitude);
    this.audio.updateEngine(this.telemetry.throttle, this.telemetry.airspeed / 160);
  }

  updateReadyOnPad(dt) {
    this.ship.group.position.set(0, this.padY, 0);
    this.ship.group.quaternion.identity();
    this.ship.setGearProgress(1.0);
    this.ship.setThrottle(0.04);
    this.updateTelemetry(0, 0, 0.04, 0, 'PAD 04', 'READY ON PAD');
  }

  updateTakeoffSpool(dt) {
    const spoolDuration = 1.2;
    const progress = Math.min(1.0, this.phaseTimer / spoolDuration);
    const throttle = 0.05 + progress * 0.95;
    this.ship.setThrottle(throttle);

    // Subtle pre-launch airframe vibration
    const shake = Math.sin(this.phaseTimer * 45) * 0.015 * progress;
    this.ship.group.position.set(shake * 0.5, this.padY, shake * 0.3);

    this.updateTelemetry(0, 0, throttle, 0, 'PREFLIGHT SPOOL', 'TAKEOFF SPOOL');

    if (progress >= 1.0) {
      this.phase = FlightPhase.VERTICAL_ASCENT;
      this.phaseTimer = 0;
    }
  }

  updateVerticalAscent(dt) {
    const ascentDuration = 3.5;
    const progress = Math.min(1.0, this.phaseTimer / ascentDuration);
    // Smooth easeInOut
    const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

    const currentY = THREE.MathUtils.lerp(this.padY, this.ascentHeight, ease);
    const verticalSpeed = (this.ascentHeight - this.padY) / ascentDuration;

    // Retract landing gear between progress 0.25 and 0.8
    if (progress >= 0.25 && progress <= 0.85) {
      const gearProgress = 1.0 - (progress - 0.25) / 0.6;
      this.ship.setGearProgress(gearProgress);
      if (progress - dt < 0.25) {
        this.audio.playGearSound(false);
      }
    } else if (progress > 0.85) {
      this.ship.setGearProgress(0.0);
    }

    // Gentle nose tilt forward to transition
    const pitchAngle = Math.sin(progress * Math.PI) * 0.08;
    this.ship.group.rotation.x = pitchAngle;
    this.ship.group.position.set(0, currentY, 0);

    const airspeed = progress * 40;
    this.ship.setThrottle(0.95);
    this.updateTelemetry(airspeed, currentY - this.padY, 0.95, verticalSpeed, 'VERTICAL CLIMB', 'LIFTOFF ASCENT');

    if (progress >= 1.0) {
      this.phase = FlightPhase.CIRCUIT_FLIGHT;
      this.circuitProgress = 0;
      this.phaseTimer = 0;
      this.audio.playChime('waypoint');
    }
  }

  updateCircuitFlight(dt) {
    this.circuitProgress += dt / this.circuitDuration;

    if (this.circuitProgress >= 1.0) {
      this.phase = FlightPhase.APPROACH_HOVER;
      this.phaseTimer = 0;
      this.audio.playChime('approach');
      return;
    }

    const t = Math.min(0.999, Math.max(0.001, this.circuitProgress));
    const point = this.circuitCurve.getPoint(t);
    const tangent = this.circuitCurve.getTangent(t).normalize();

    // Look slightly ahead on curve for smooth rotation
    const lookAheadT = Math.min(1.0, t + 0.03);
    const aheadPoint = this.circuitCurve.getPoint(lookAheadT);
    const forwardVec = aheadPoint.clone().sub(point).normalize();

    // Calculate turning curvature to derive realistic bank/roll angle
    const prevT = Math.max(0, t - 0.02);
    const prevTangent = this.circuitCurve.getTangent(prevT).normalize();
    const curTangent = this.circuitCurve.getTangent(t).normalize();
    const turnAngle = (curTangent.x * prevTangent.z - curTangent.z * prevTangent.x);
    const targetRoll = -Math.max(-0.65, Math.min(0.65, turnAngle * 28.0));

    // Position ship
    this.ship.group.position.copy(point);

    // Orientation: combine heading and roll
    const dummy = new THREE.Object3D();
    dummy.position.copy(point);
    dummy.lookAt(point.clone().add(forwardVec));
    dummy.rotateZ(targetRoll);

    this.ship.group.quaternion.slerp(dummy.quaternion, 0.15);

    // Gear remains cleanly retracted
    this.ship.setGearProgress(0.0);

    // Throttle management during flight circuit
    let throttle = 0.85;
    if (t < 0.2) throttle = 0.95;       // Acceleration out of pad
    else if (t > 0.4 && t < 0.6) throttle = 1.0; // Ridge flyby speed run
    else if (t > 0.75) throttle = 0.65; // Decelerating on final approach
    this.ship.setThrottle(throttle);

    const airspeed = 90 + throttle * 55;
    const altitude = point.y - this.padY;
    const distToPad = new THREE.Vector2(point.x, point.z).length();

    // Waypoint name identification
    let wpName = 'WP 1: CANYON CLIMB';
    if (t > 0.25 && t <= 0.5) wpName = 'WP 2: OVERLOOK RIDGE';
    else if (t > 0.5 && t <= 0.75) wpName = 'WP 3: CRYO FACILITY';
    else if (t > 0.75) wpName = 'WP 4: FINAL APPROACH';

    this.updateTelemetry(airspeed, altitude, throttle, tangent.y * 15, wpName, 'LOCAL TEST CIRCUIT');
  }

  updateApproachHover(dt) {
    const hoverDuration = 2.8;
    const progress = Math.min(1.0, this.phaseTimer / hoverDuration);
    const ease = 1 - Math.pow(1 - progress, 3);

    // Transition smoothly from entry point to exact hover position above pad (0, 7.2, 0)
    const hoverPos = new THREE.Vector3(0, 7.2, 0);
    this.ship.group.position.lerp(hoverPos, 0.08);

    // Level wings and align heading forward (0, 0, 0)
    const targetQuat = new THREE.Quaternion().identity();
    this.ship.group.quaternion.slerp(targetQuat, 0.08);

    // Deploy landing gear with sound
    if (progress >= 0.15 && progress <= 0.85) {
      const gearProgress = (progress - 0.15) / 0.7;
      this.ship.setGearProgress(gearProgress);
      if (progress - dt < 0.15) {
        this.audio.playGearSound(true);
      }
    } else if (progress > 0.85) {
      this.ship.setGearProgress(1.0);
    }

    const altitude = this.ship.group.position.y - this.padY;
    this.ship.setThrottle(0.5);
    this.updateTelemetry(15 * (1 - progress), altitude, 0.5, -0.4, 'PAD 04 ALIGNMENT', 'APPROACH & HOVER');

    if (progress >= 1.0) {
      this.phase = FlightPhase.VERTICAL_DESCENT;
      this.phaseTimer = 0;
    }
  }

  updateVerticalDescent(dt) {
    const descentDuration = 4.2;
    const progress = Math.min(1.0, this.phaseTimer / descentDuration);
    const ease = progress * progress * (3 - 2 * progress);

    const currentY = THREE.MathUtils.lerp(7.2, this.padY, ease);
    this.ship.group.position.set(0, currentY, 0);
    this.ship.group.quaternion.identity();
    this.ship.setGearProgress(1.0);

    // Spool down throttle as ground approaches
    const throttle = THREE.MathUtils.lerp(0.5, 0.15, progress);
    this.ship.setThrottle(throttle);

    const altitude = Math.max(0, currentY - this.padY);
    const verticalSpeed = -((7.2 - this.padY) / descentDuration) * (1 - progress * 0.5);

    this.updateTelemetry(4 * (1 - progress), altitude, throttle, verticalSpeed, 'TOUCHDOWN DESCENT', 'VERTICAL DESCENT');

    if (progress >= 1.0) {
      this.phase = FlightPhase.TOUCHDOWN;
      this.phaseTimer = 0;
      this.audio.playChime('land');
    }
  }

  updateTouchdown(dt) {
    const bounceDuration = 0.9;
    const progress = Math.min(1.0, this.phaseTimer / bounceDuration);

    // Damped shock-absorber bounce on gear
    const bounceY = Math.sin(progress * Math.PI * 2) * Math.exp(-progress * 4) * 0.06;
    this.ship.group.position.set(0, this.padY - bounceY, 0);

    // Throttle cut to idle
    const throttle = THREE.MathUtils.lerp(0.15, 0.04, progress);
    this.ship.setThrottle(throttle);

    this.updateTelemetry(0, 0, throttle, 0, 'PAD 04', 'TOUCHDOWN CONFIRMED');

    if (progress >= 1.0) {
      this.phase = FlightPhase.LANDED_SUCCESS;
      this.ship.group.position.set(0, this.padY, 0);
    }
  }

  updateLandedSuccess(dt) {
    this.ship.group.position.set(0, this.padY, 0);
    this.ship.group.quaternion.identity();
    this.ship.setGearProgress(1.0);
    this.ship.setThrottle(0.04);
    this.updateTelemetry(0, 0, 0.04, 0, 'PAD 04', 'LANDING COMPLETE');
  }

  updateTelemetry(airspeed, altitude, throttle, verticalSpeed, waypoint, phaseName) {
    this.telemetry.airspeed = Math.round(airspeed);
    this.telemetry.altitude = Math.max(0, parseFloat(altitude.toFixed(1)));
    this.telemetry.throttle = Math.round(throttle * 100);
    this.telemetry.verticalSpeed = parseFloat(verticalSpeed.toFixed(1));
    this.telemetry.distanceToPad = Math.round(
      new THREE.Vector2(this.ship.group.position.x, this.ship.group.position.z).length()
    );
    this.telemetry.currentWaypoint = waypoint;
    this.telemetry.phaseName = phaseName;
  }
}
