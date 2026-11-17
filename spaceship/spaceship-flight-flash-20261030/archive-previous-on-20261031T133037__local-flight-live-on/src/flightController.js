import * as THREE from 'three';

export const FLIGHT_STATE = {
  READY: 'READY',
  TAKEOFF: 'TAKEOFF',
  CIRCUIT: 'CIRCUIT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING',
  PAUSED: 'PAUSED'
};

/**
 * Manages spaceship flight state, Catmull-Rom circuit spline path,
 * aerodynamic banking & pitch calculations, and live telemetry data.
 */
export class FlightController {
  constructor(spaceship, particleManager, scene, audioManager) {
    this.spaceship = spaceship;
    this.particleManager = particleManager;
    this.scene = scene;
    this.audio = audioManager;

    this.state = FLIGHT_STATE.READY;
    this.previousState = FLIGHT_STATE.READY;
    this.isPaused = false;
    this.speedMultiplier = 1.0;

    // Flight timers & parameters
    this.stateTime = 0;
    this.totalFlightTime = 0;
    this.circuitProgress = 0; // 0.0 to 1.0
    this.takeoffDuration = 4.0;
    this.circuitDuration = 20.0;
    this.approachDuration = 3.5;
    this.landingDuration = 4.5;

    // Pad position & resting height
    this.padPos = new THREE.Vector3(0, 0.46, 0);
    this.hoverHeight = 12.0;

    // Kinematics & telemetry
    this.currentPosition = this.padPos.clone();
    this.velocity = new THREE.Vector3();
    this.currentSpeed = 0; // m/s
    this.altitude = 0; // relative to pad
    this.throttle = 0.1;
    this.bankingAngle = 0;
    this.heading = 0;

    // Setup the local circuit spline
    this.initCircuitPath();

    // Setup Holographic Flight Ribbon
    this.initFlightPathRibbon();

    // Temporary vectors for orientation calculations
    this._tangent = new THREE.Vector3();
    this._nextTangent = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._targetRot = new THREE.Quaternion();
    this._matrix = new THREE.Matrix4();
  }

  initCircuitPath() {
    // 8 carefully placed waypoints around the local spaceport
    // Designed so spaceship is always clearly visible and passes over landmarks
    this.waypoints = [
      new THREE.Vector3(0, 12, 0),        // Waypoint 0: Lift-off transition
      new THREE.Vector3(18, 16, 20),      // Waypoint 1: Climb over runway & road
      new THREE.Vector3(34, 22, 14),      // Waypoint 2: Right bank over fuel tanks
      new THREE.Vector3(38, 25, -16),     // Waypoint 3: South turn over outer edge
      new THREE.Vector3(12, 24, -36),     // Waypoint 4: Scenic flyby with spaceport backdrop
      new THREE.Vector3(-24, 21, -32),    // Waypoint 5: Southwest banking turn
      new THREE.Vector3(-36, 17, -6),     // Waypoint 6: Turn near control tower
      new THREE.Vector3(-20, 14, 16),     // Waypoint 7: Final approach alignment
      new THREE.Vector3(0, 12, 0)         // Waypoint 8: Return over pad
    ];

    // CatmullRomCurve3 with centripetal tension for smooth, organic turns
    this.circuitCurve = new THREE.CatmullRomCurve3(this.waypoints, false, 'centripetal', 0.5);
    this.circuitLength = this.circuitCurve.getLength();
  }

  initFlightPathRibbon() {
    // Generates a subtle glowing 3D flight path ribbon
    const points = this.circuitCurve.getPoints(120);

    // Add vertical takeoff line and landing line to the ribbon for completeness
    const fullPathPoints = [
      new THREE.Vector3(0, 0.46, 0),
      ...points,
      new THREE.Vector3(0, 0.46, 0)
    ];

    const pathGeo = new THREE.BufferGeometry().setFromPoints(fullPathPoints);
    const pathMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      linewidth: 2
    });

    this.pathRibbon = new THREE.Line(pathGeo, pathMat);
    this.pathRibbon.visible = true; // Visible by default for easy following
    this.scene.add(this.pathRibbon);

    // Glowing waypoint beacons along the path
    this.waypointMarkers = new THREE.Group();
    const wpGeo = new THREE.RingGeometry(0.6, 0.8, 16);
    wpGeo.rotateX(-Math.PI / 2);
    const wpMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    [this.waypoints[1], this.waypoints[3], this.waypoints[5], this.waypoints[7]].forEach(pt => {
      const ring = new THREE.Mesh(wpGeo, wpMat);
      ring.position.copy(pt);
      this.waypointMarkers.add(ring);
    });

    this.scene.add(this.waypointMarkers);
  }

  toggleFlightPathRibbon() {
    const visible = !this.pathRibbon.visible;
    this.pathRibbon.visible = visible;
    this.waypointMarkers.visible = visible;
    return visible;
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
  }

  togglePause() {
    if (this.state === FLIGHT_STATE.READY) return false;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      if (this.audio) this.audio.setFlightActive(false);
    } else {
      if (this.audio) this.audio.setFlightActive(true);
    }
    return this.isPaused;
  }

  launch() {
    if (this.state !== FLIGHT_STATE.READY) return false;
    this.state = FLIGHT_STATE.TAKEOFF;
    this.stateTime = 0;
    this.totalFlightTime = 0;
    this.circuitProgress = 0;
    this.isPaused = false;
    if (this.audio) {
      this.audio.playLaunchTone();
      this.audio.setFlightActive(true);
    }
    return true;
  }

  returnToPad() {
    if (this.state === FLIGHT_STATE.CIRCUIT) {
      // Smoothly transition directly to approach phase
      this.state = FLIGHT_STATE.APPROACH;
      this.stateTime = 0;
      this.approachStartPos = this.currentPosition.clone();
      return true;
    }
    return false;
  }

  update(rawDelta) {
    if (this.isPaused) {
      // Keep thrusters visual idle effect updating while paused
      this.spaceship.update(rawDelta, this.throttle, true);
      this.particleManager.update(rawDelta);
      return;
    }

    const delta = rawDelta * this.speedMultiplier;
    this.stateTime += delta;
    if (this.state !== FLIGHT_STATE.READY) {
      this.totalFlightTime += delta;
    }

    switch (this.state) {
      case FLIGHT_STATE.READY:
        this.updateReady(delta);
        break;
      case FLIGHT_STATE.TAKEOFF:
        this.updateTakeoff(delta);
        break;
      case FLIGHT_STATE.CIRCUIT:
        this.updateCircuit(delta);
        break;
      case FLIGHT_STATE.APPROACH:
        this.updateApproach(delta);
        break;
      case FLIGHT_STATE.LANDING:
        this.updateLanding(delta);
        break;
    }

    // Update spaceship orientation, mesh position, throttle & landing gear
    const shipMesh = this.spaceship.getMesh();
    shipMesh.position.copy(this.currentPosition);
    this.altitude = Math.max(0, this.currentPosition.y - this.padPos.y);

    this.spaceship.update(rawDelta, this.throttle, this.state !== FLIGHT_STATE.READY);
    this.particleManager.update(rawDelta);

    // Emit thruster exhaust particles during flight
    if (this.state !== FLIGHT_STATE.READY) {
      const leftNozzle = this.spaceship.getThrusterWorldPosition(0);
      const rightNozzle = this.spaceship.getThrusterWorldPosition(1);

      // Vector pointing backward from the ship
      const backDir = new THREE.Vector3(0, 0, -1).applyQuaternion(shipMesh.quaternion).normalize();

      this.particleManager.emitExhaust(leftNozzle, backDir, this.throttle);
      this.particleManager.emitExhaust(rightNozzle, backDir, this.throttle);

      // Emit ground dust if ship is near the pad (altitude < 3.5m)
      if (this.altitude < 3.5 && (this.state === FLIGHT_STATE.TAKEOFF || this.state === FLIGHT_STATE.LANDING)) {
        this.particleManager.emitGroundDust(this.padPos, this.throttle);
      }
    }

    // Audio pitch & throttle update
    if (this.audio) {
      this.audio.updateEngineSound(this.throttle, this.currentSpeed);
    }
  }

  updateReady(delta) {
    this.currentPosition.set(0, this.padPos.y, 0);
    this.throttle = 0.1;
    this.currentSpeed = 0;
    this.spaceship.setLandingGear(1.0);

    // Level pitch & roll facing north
    const shipMesh = this.spaceship.getMesh();
    shipMesh.rotation.set(0, 0, 0);
  }

  updateTakeoff(delta) {
    const t = Math.min(1.0, this.stateTime / this.takeoffDuration);
    // Smooth ease-in-out curve for vertical ascent
    const easeY = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    this.currentPosition.y = THREE.MathUtils.lerp(this.padPos.y, this.hoverHeight, easeY);
    this.currentPosition.x = 0;
    this.currentPosition.z = 0;

    // Throttle profile: Ramps up to 95%
    this.throttle = Math.min(0.95, 0.2 + t * 0.75);

    // Retract landing gear once airborne (altitude > 1.5m)
    if (this.altitude > 1.5) {
      this.spaceship.setLandingGear(Math.max(0, 1.0 - (this.altitude - 1.5) / 3.0));
    }

    // Slight nose-down pitch at top of climb into forward flight
    const pitch = t > 0.6 ? Math.sin((t - 0.6) / 0.4 * Math.PI) * 0.15 : 0;
    const shipMesh = this.spaceship.getMesh();
    shipMesh.rotation.set(pitch, 0, 0);

    this.currentSpeed = (this.hoverHeight / this.takeoffDuration) * (t < 0.5 ? t * 2 : 1.0) * 3.6; // km/h

    if (t >= 1.0) {
      this.state = FLIGHT_STATE.CIRCUIT;
      this.stateTime = 0;
      this.circuitProgress = 0;
    }
  }

  updateCircuit(delta) {
    this.circuitProgress += delta / this.circuitDuration;
    const u = Math.min(1.0, this.circuitProgress);

    // Get current position on spline
    this.circuitCurve.getPointAt(u, this.currentPosition);

    // Get tangent direction (forward velocity vector)
    this.circuitCurve.getTangentAt(u, this._tangent);

    // Compute curvature/banking by sampling slightly ahead
    const lookAheadU = Math.min(1.0, u + 0.02);
    this.circuitCurve.getTangentAt(lookAheadU, this._nextTangent);

    // Cross product of tangent & nextTangent reveals turning rate & direction
    const cross = new THREE.Vector3().crossVectors(this._tangent, this._nextTangent);
    const turnRate = cross.y; // positive = left turn, negative = right turn

    // Target bank angle (roll into the turn)
    const targetBank = turnRate * 35.0; // Scaled banking angle
    this.bankingAngle = THREE.MathUtils.lerp(this.bankingAngle, targetBank, delta * 4);

    // Apply orientation: Look forward along tangent, roll by bankingAngle
    const forward = this._tangent.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    // Banking roll
    const bankedUp = up.clone().applyAxisAngle(forward, this.bankingAngle);

    this._matrix.lookAt(new THREE.Vector3(0, 0, 0), forward, bankedUp);
    this._targetRot.setFromRotationMatrix(this._matrix);

    const shipMesh = this.spaceship.getMesh();
    shipMesh.quaternion.slerp(this._targetRot, delta * 8);

    // High cruising throttle
    this.throttle = 0.85 + Math.sin(u * Math.PI * 4) * 0.1;
    this.currentSpeed = (this.circuitLength / this.circuitDuration) * 3.6; // km/h (~45-55 km/h)

    if (u >= 1.0) {
      this.state = FLIGHT_STATE.APPROACH;
      this.stateTime = 0;
      this.approachStartPos = this.currentPosition.clone();
      this.approachStartRot = shipMesh.quaternion.clone();
    }
  }

  updateApproach(delta) {
    const t = Math.min(1.0, this.stateTime / this.approachDuration);
    const ease = t * (2 - t); // ease-out

    if (!this.approachStartPos) this.approachStartPos = this.currentPosition.clone();

    // Interpolate smoothly towards hover point directly above pad
    const targetHover = new THREE.Vector3(0, this.hoverHeight, 0);
    this.currentPosition.lerpVectors(this.approachStartPos, targetHover, ease);

    // Level wings and nose horizontally
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const shipMesh = this.spaceship.getMesh();
    shipMesh.quaternion.slerp(targetQuat, delta * 3);

    // Throttle down to cushion level
    this.throttle = THREE.MathUtils.lerp(0.85, 0.45, ease);
    this.currentSpeed = (1.0 - ease) * 35;

    // Deploy landing gear
    if (t > 0.4) {
      this.spaceship.setLandingGear((t - 0.4) / 0.6);
    }

    if (t >= 1.0) {
      this.state = FLIGHT_STATE.LANDING;
      this.stateTime = 0;
      this.landingStartPos = this.currentPosition.clone();
    }
  }

  updateLanding(delta) {
    const t = Math.min(1.0, this.stateTime / this.landingDuration);
    // Smooth ease-out descent
    const easeY = 1.0 - Math.pow(1.0 - t, 2.5);

    this.currentPosition.x = 0;
    this.currentPosition.z = 0;
    this.currentPosition.y = THREE.MathUtils.lerp(this.hoverHeight, this.padPos.y, easeY);

    // Controlled throttle for soft touchdown
    if (t < 0.8) {
      this.throttle = 0.45;
    } else {
      // Throttle drops to idle as ship settles on pad
      this.throttle = THREE.MathUtils.lerp(0.45, 0.1, (t - 0.8) / 0.2);
    }

    this.currentSpeed = Math.max(0, (1.0 - t) * 12);

    const shipMesh = this.spaceship.getMesh();
    // Subtle hover suspension wobble settling to level
    const settleWobble = (1.0 - t) * Math.sin(this.stateTime * 12) * 0.02;
    shipMesh.rotation.set(settleWobble, 0, 0);

    if (t >= 1.0) {
      // Touchdown complete!
      this.currentPosition.y = this.padPos.y;
      shipMesh.rotation.set(0, 0, 0);
      this.state = FLIGHT_STATE.READY;
      this.stateTime = 0;
      this.throttle = 0.1;
      this.currentSpeed = 0;
      this.spaceship.setLandingGear(1.0);

      if (this.audio) {
        this.audio.playTouchdownTone();
        this.audio.setFlightActive(false);
      }
    }
  }

  getTelemetry() {
    return {
      state: this.state,
      isPaused: this.isPaused,
      altitude: this.altitude,
      speed: this.currentSpeed,
      throttle: this.throttle,
      flightTime: this.totalFlightTime,
      circuitProgress: this.circuitProgress,
      speedMultiplier: this.speedMultiplier,
      position: this.currentPosition
    };
  }
}
