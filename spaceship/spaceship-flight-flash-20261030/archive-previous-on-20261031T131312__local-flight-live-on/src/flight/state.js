/**
 * Flight State Machine and Circuit Trajectory Controller
 */

export const FlightPhase = {
  READY: 'READY',
  TAKEOFF: 'TAKEOFF',
  CIRCUIT: 'CIRCUIT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING'
};

export const PAD_POSITION = { x: 0, y: 0.46, z: 0 };
export const HOVER_ALTITUDE = 12.0;

// Scenic test circuit waypoints around the landing pad
export const CIRCUIT_WAYPOINTS = [
  { x: 0, y: HOVER_ALTITUDE, z: 0 },         // Station hover point
  { x: 18, y: 18, z: -22 },                   // Outbound climb toward radar ridge
  { x: 44, y: 26, z: -18 },                   // High bank around eastern mesa
  { x: 50, y: 30, z: 22 },                    // Scenic ridge traverse
  { x: 22, y: 28, z: 46 },                    // Turn over southern canyon
  { x: -28, y: 24, z: 40 },                   // Western turnaround past outpost
  { x: -44, y: 20, z: 8 },                    // Low pass over solar array
  { x: -18, y: 15, z: -8 },                   // Inbound approach alignment
  { x: 0, y: HOVER_ALTITUDE, z: 0 }          // Re-entry into station hover
];

export class FlightController {
  constructor() {
    this.phase = FlightPhase.READY;
    this.timeInPhase = 0;
    this.circuitProgress = 0; // 0 to 1 along circuit waypoints
    this.flightSpeed = 1.0;
    this.isPaused = false;

    // Kinematics
    this.position = { ...PAD_POSITION };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.speedKmh = 0;
    this.throttle = 0; // 0 to 100%
    this.gearExtension = 1.0; // 1 = fully deployed, 0 = retracted
    this.thrusterFlare = 0.0; // 0 to 1.0

    // Configuration durations (seconds at 1x speed)
    this.takeoffDuration = 4.0;
    this.circuitDuration = 22.0;
    this.approachDuration = 3.5;
    this.landingDuration = 4.0;
  }

  initiateTakeoff() {
    if (this.phase === FlightPhase.READY) {
      this.phase = FlightPhase.TAKEOFF;
      this.timeInPhase = 0;
      this.isPaused = false;
      return true;
    }
    return false;
  }

  requestLandNow() {
    if (this.phase === FlightPhase.CIRCUIT) {
      // Transition directly to approach vector from current position
      this.phase = FlightPhase.APPROACH;
      this.timeInPhase = 0;
      return true;
    }
    return false;
  }

  setSpeed(multiplier) {
    this.flightSpeed = Math.max(0.2, Math.min(3.0, multiplier));
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  resetToPad() {
    this.phase = FlightPhase.READY;
    this.timeInPhase = 0;
    this.circuitProgress = 0;
    this.isPaused = false;
    this.position = { ...PAD_POSITION };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.speedKmh = 0;
    this.throttle = 0;
    this.gearExtension = 1.0;
    this.thrusterFlare = 0.0;
  }

  update(deltaSec) {
    if (this.isPaused) return this.getTelemetry();

    const dt = deltaSec * this.flightSpeed;
    this.timeInPhase += dt;

    switch (this.phase) {
      case FlightPhase.READY:
        this.updateReadyPhase(dt);
        break;
      case FlightPhase.TAKEOFF:
        this.updateTakeoffPhase(dt);
        break;
      case FlightPhase.CIRCUIT:
        this.updateCircuitPhase(dt);
        break;
      case FlightPhase.APPROACH:
        this.updateApproachPhase(dt);
        break;
      case FlightPhase.LANDING:
        this.updateLandingPhase(dt);
        break;
    }

    return this.getTelemetry();
  }

  updateReadyPhase(dt) {
    this.position = { ...PAD_POSITION };
    this.rotation = { x: 0, y: 0, z: 0 };
    this.gearExtension = 1.0;
    this.speedKmh = 0;
    // Gentle engine idling pulse
    this.throttle = 8 + Math.sin(this.timeInPhase * 3) * 3;
    this.thrusterFlare = 0.15 + Math.sin(this.timeInPhase * 4) * 0.05;
  }

  updateTakeoffPhase(dt) {
    const t = Math.min(1.0, this.timeInPhase / this.takeoffDuration);
    // Smooth ease-in ease-out
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    this.position.x = 0;
    this.position.z = 0;
    this.position.y = PAD_POSITION.y + ease * (HOVER_ALTITUDE - PAD_POSITION.y);

    // Gear retracts during second half of takeoff
    if (t > 0.4) {
      this.gearExtension = Math.max(0, 1.0 - (t - 0.4) / 0.5);
    } else {
      this.gearExtension = 1.0;
    }

    // Engine throttle spools up
    this.throttle = 40 + ease * 55;
    this.thrusterFlare = 0.6 + ease * 0.4;
    this.speedKmh = ease * 65;

    // Pitch forward slightly towards first waypoint
    this.rotation.x = -0.08 * Math.sin(t * Math.PI);
    this.rotation.z = 0;
    this.rotation.y = 0;

    if (t >= 1.0) {
      this.phase = FlightPhase.CIRCUIT;
      this.timeInPhase = 0;
      this.circuitProgress = 0;
    }
  }

  updateCircuitPhase(dt) {
    const step = dt / this.circuitDuration;
    this.circuitProgress += step;

    if (this.circuitProgress >= 1.0) {
      this.phase = FlightPhase.APPROACH;
      this.timeInPhase = 0;
      this.circuitProgress = 1.0;
      return;
    }

    const pos = evaluateCircuit(this.circuitProgress);
    const nextPos = evaluateCircuit(Math.min(1.0, this.circuitProgress + 0.015));

    this.position.x = pos.x;
    this.position.y = pos.y;
    this.position.z = pos.z;

    // Compute heading and banking
    const dx = nextPos.x - pos.x;
    const dy = nextPos.y - pos.y;
    const dz = nextPos.z - pos.z;
    const groundDist = Math.hypot(dx, dz) || 0.001;

    // Yaw heading
    const targetYaw = Math.atan2(dx, dz);
    this.rotation.y = targetYaw;

    // Pitch angle
    const targetPitch = -Math.atan2(dy, groundDist);
    this.rotation.x = targetPitch * 0.8;

    // Bank angle based on yaw rate of change (centripetal tilt)
    const futurePos = evaluateCircuit(Math.min(1.0, this.circuitProgress + 0.03));
    const fdx = futurePos.x - nextPos.x;
    const fdz = futurePos.z - nextPos.z;
    const futureYaw = Math.atan2(fdx, fdz);
    let deltaYaw = futureYaw - targetYaw;
    while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
    while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
    this.rotation.z = Math.max(-0.5, Math.min(0.5, -deltaYaw * 12.0));

    this.gearExtension = 0.0;
    this.throttle = 80 + Math.sin(this.circuitProgress * Math.PI * 4) * 15;
    this.thrusterFlare = 0.85 + Math.sin(this.circuitProgress * 20) * 0.15;
    this.speedKmh = 140 + Math.sin(this.circuitProgress * Math.PI * 2) * 30;
  }

  updateApproachPhase(dt) {
    const t = Math.min(1.0, this.timeInPhase / this.approachDuration);
    const ease = t * (2 - t); // Quad ease out

    const startX = this.position.x;
    const startZ = this.position.z;
    const startY = this.position.y;

    // Decelerate and settle back into hover over pad
    this.position.x = startX * (1 - ease * 0.15);
    this.position.z = startZ * (1 - ease * 0.15);
    this.position.y = startY + (HOVER_ALTITUDE - startY) * ease * 0.15;

    // Level out ship
    this.rotation.x *= 0.92;
    this.rotation.z *= 0.9;
    this.rotation.y *= 0.95;

    // Extend landing gear
    this.gearExtension = Math.min(1.0, t * 1.3);

    this.throttle = 60 - t * 25;
    this.thrusterFlare = 0.5 - t * 0.2;
    this.speedKmh = Math.max(20, (1 - t) * 80);

    if (t >= 1.0) {
      this.phase = FlightPhase.LANDING;
      this.timeInPhase = 0;
      this.landingStartY = this.position.y;
    }
  }

  updateLandingPhase(dt) {
    const t = Math.min(1.0, this.timeInPhase / this.landingDuration);
    // Smooth ease in out for touchdown
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const startY = this.landingStartY || HOVER_ALTITUDE;
    this.position.x = 0;
    this.position.z = 0;
    this.position.y = startY - ease * (startY - PAD_POSITION.y);

    this.rotation.x = 0;
    this.rotation.y = 0;
    this.rotation.z = 0;
    this.gearExtension = 1.0;

    // Thruster flare cushions vertical descent then powers down
    if (t < 0.9) {
      this.throttle = 50 * (1 - t * 0.7);
      this.thrusterFlare = 0.6 * (1 - t * 0.5);
      this.speedKmh = (1 - t) * 35;
    } else {
      this.throttle = 0;
      this.thrusterFlare = 0.05;
      this.speedKmh = 0;
    }

    if (t >= 1.0) {
      this.phase = FlightPhase.READY;
      this.timeInPhase = 0;
      this.position = { ...PAD_POSITION };
    }
  }

  getTelemetry() {
    const distToPad = Math.hypot(
      this.position.x - PAD_POSITION.x,
      this.position.z - PAD_POSITION.z
    );
    const altitude = Math.max(0, this.position.y - PAD_POSITION.y);

    return {
      phase: this.phase,
      position: { ...this.position },
      rotation: { ...this.rotation },
      altitudeMeters: Math.round(altitude * 10) / 10,
      speedKmh: Math.round(this.speedKmh),
      throttlePercent: Math.round(this.throttle),
      distanceToPadMeters: Math.round(distToPad * 10) / 10,
      gearExtension: this.gearExtension,
      thrusterFlare: this.thrusterFlare,
      isPaused: this.isPaused,
      flightSpeed: this.flightSpeed
    };
  }
}

/**
 * Catmull-Rom cubic spline interpolation across waypoints
 */
export function evaluateCircuit(progress) {
  const points = CIRCUIT_WAYPOINTS;
  const numSections = points.length - 1;
  const tGlobal = Math.max(0, Math.min(0.9999, progress)) * numSections;
  const index = Math.floor(tGlobal);
  const tLocal = tGlobal - index;

  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[Math.min(points.length - 1, index + 1)];
  const p3 = points[Math.min(points.length - 1, index + 2)];

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, tLocal),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, tLocal),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, tLocal)
  };
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}
