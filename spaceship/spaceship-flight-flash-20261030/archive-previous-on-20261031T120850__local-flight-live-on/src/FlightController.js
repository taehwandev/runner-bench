import * as THREE from 'three';

export const FLIGHT_STATE = {
  STANDBY: 'STANDBY',
  LIFTOFF: 'LIFTOFF',
  CIRCUIT: 'CIRCUIT',
  APPROACH: 'APPROACH',
  TOUCHDOWN: 'TOUCHDOWN',
  HOVER_HOLD: 'HOVER_HOLD'
};

export class FlightController {
  constructor(spaceship, landingPad, environment, particles, sound) {
    this.ship = spaceship;
    this.pad = landingPad;
    this.env = environment;
    this.particles = particles;
    this.sound = sound;

    this.state = FLIGHT_STATE.STANDBY;
    this.prevState = FLIGHT_STATE.STANDBY;

    // Flight geometry
    this.padCenter = new THREE.Vector3(0, 0, 0);
    this.padSurfaceY = 1.2;
    this.landedY = 2.45; // ship center when gear touches pad at 1.2
    this.hoverAltitude = 14.0;

    // Spline for Circuit Flight
    this.initFlightPath();

    // Flight variables
    this.circuitProgress = 0.0; // 0.0 to 1.0
    this.flightSpeed = 0.048;   // base progress per second (~21 sec circuit)
    this.speedMultiplier = 1.0;
    this.liftoffProgress = 0.0;
    this.landingProgress = 0.0;

    // Telemetry state
    this.altitude = 0.0;
    this.airspeed = 0.0;
    this.throttle = 0.0;
    this.gForce = 1.0;

    // Orientation smoothing
    this.currentQuat = new THREE.Quaternion();
    this.targetQuat = new THREE.Quaternion();
    this.currentBank = 0;
    this.currentPitch = 0;

    // Waypoint tracking
    this.clearedWaypoints = new Set();

    // Callbacks for UI updates
    this.onStateChange = null;
    this.onTelemetryUpdate = null;

    // Set initial landed position
    this.resetToPad();
  }

  initFlightPath() {
    // 8 carefully shaped waypoints forming a scenic local loop around the pad & terrain
    this.circuitPoints = [
      new THREE.Vector3(0, 14.0, 0),         // WP0: Hover over pad
      new THREE.Vector3(12, 16.0, -10),      // WP1: ALPHA (Perimeter climb)
      new THREE.Vector3(36, 20.0, -32),      // WP2: BRAVO (Canyon turn)
      new THREE.Vector3(42, 26.0, 12),       // High vista crest
      new THREE.Vector3(18, 22.0, 38),       // WP3: CHARLIE (Ridge turn)
      new THREE.Vector3(-15, 18.0, 24),      // WP4: DELTA (Corridor alignment)
      new THREE.Vector3(-4, 15.0, 6),        // Pre-approach decelerate
      new THREE.Vector3(0, 14.0, 0)          // Re-enter pad hover
    ];

    this.curve = new THREE.CatmullRomCurve3(this.circuitPoints, false, 'catmullrom', 0.45);
  }

  resetToPad() {
    this.state = FLIGHT_STATE.STANDBY;
    this.circuitProgress = 0.0;
    this.liftoffProgress = 0.0;
    this.landingProgress = 0.0;
    this.clearedWaypoints.clear();
    if (this.env) this.env.resetWaypoints();

    this.ship.group.position.set(0, this.landedY, 0);
    this.ship.group.rotation.set(0, 0, 0);
    this.ship.setGearExtension(1.0);
    this.ship.setThrottle(0.0);
    this.ship.setVTOLThrottle(0.0);

    this.altitude = 0.0;
    this.airspeed = 0.0;
    this.throttle = 0.0;

    if (this.onStateChange) this.onStateChange(this.state);
  }

  initiateTakeoff() {
    if (this.state !== FLIGHT_STATE.STANDBY) return;

    if (this.sound) {
      this.sound.init();
      this.sound.playTakeoffWhoosh();
    }

    this.state = FLIGHT_STATE.LIFTOFF;
    this.liftoffProgress = 0.0;
    this.clearedWaypoints.clear();
    if (this.env) this.env.resetWaypoints();

    if (this.onStateChange) this.onStateChange(this.state);
  }

  returnToPad() {
    if (this.state === FLIGHT_STATE.CIRCUIT || this.state === FLIGHT_STATE.HOVER_HOLD) {
      // Transition gracefully directly into approach corridor
      this.state = FLIGHT_STATE.APPROACH;
      this.landingProgress = 0.0;
      if (this.sound) this.sound.playGearSound(true);
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  toggleHoverHold() {
    if (this.state === FLIGHT_STATE.HOVER_HOLD) {
      this.state = this.prevState || FLIGHT_STATE.CIRCUIT;
    } else if (this.state === FLIGHT_STATE.CIRCUIT || this.state === FLIGHT_STATE.LIFTOFF || this.state === FLIGHT_STATE.APPROACH) {
      this.prevState = this.state;
      this.state = FLIGHT_STATE.HOVER_HOLD;
    }
    if (this.onStateChange) this.onStateChange(this.state);
  }

  setSpeedMultiplier(multiplier) {
    this.speedMultiplier = multiplier;
  }

  update(delta, time) {
    const dt = Math.min(delta, 0.1);

    switch (this.state) {
      case FLIGHT_STATE.STANDBY:
        this.updateStandby(dt, time);
        break;

      case FLIGHT_STATE.LIFTOFF:
        this.updateLiftoff(dt, time);
        break;

      case FLIGHT_STATE.CIRCUIT:
        this.updateCircuit(dt, time);
        break;

      case FLIGHT_STATE.APPROACH:
        this.updateApproach(dt, time);
        break;

      case FLIGHT_STATE.TOUCHDOWN:
        this.updateTouchdown(dt, time);
        break;

      case FLIGHT_STATE.HOVER_HOLD:
        this.updateHoverHold(dt, time);
        break;
    }

    // Update ship visual components
    this.ship.update(time, dt);

    // Update sound engine pitch/volume
    if (this.sound) {
      this.sound.updateEngine(this.throttle, this.airspeed / 120);
    }

    // Telemetry dispatch
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        state: this.state,
        altitude: this.altitude,
        airspeed: this.airspeed,
        throttle: Math.round(this.throttle * 100),
        circuitProgress: Math.round(this.circuitProgress * 100),
        gForce: this.gForce.toFixed(1)
      });
    }
  }

  updateStandby(dt, time) {
    this.ship.setGearExtension(1.0);
    this.ship.setThrottle(0.03); // idle glow
    this.ship.setVTOLThrottle(0.0);
    this.altitude = 0.0;
    this.airspeed = 0.0;
    this.throttle = 0.03;
    this.gForce = 1.0;
  }

  updateLiftoff(dt, time) {
    const climbRate = 0.38 * this.speedMultiplier;
    this.liftoffProgress += dt * climbRate;

    // Smooth cubic hermite ease for vertical ascent
    const ease = THREE.MathUtils.smoothstep(this.liftoffProgress, 0, 1);
    const targetY = THREE.MathUtils.lerp(this.landedY, this.hoverAltitude, ease);
    
    // Slight aerodynamic hover drift
    const hoverSwayX = Math.sin(time * 1.5) * 0.1;
    const hoverSwayZ = Math.cos(time * 1.2) * 0.1;
    this.ship.group.position.set(hoverSwayX, targetY, hoverSwayZ);

    // Slight nose-up trim during vertical ascent
    this.ship.group.rotation.set(-0.06 * Math.sin(ease * Math.PI), 0, 0);

    // Throttle & VTOL during liftoff
    this.throttle = 0.45;
    this.ship.setThrottle(this.throttle);
    const vtolPower = Math.sin(ease * Math.PI) * 0.85 + 0.35;
    this.ship.setVTOLThrottle(vtolPower);

    // Retract landing gear after clearing 5m altitude
    const currentAlt = targetY - this.landedY;
    if (currentAlt > 3.0) {
      const gearProgress = Math.max(0, 1.0 - (currentAlt - 3.0) / 4.0);
      if (this.ship.gearExtension > 0.05 && gearProgress < 0.95 && !this.gearRetractedSoundPlayed) {
        if (this.sound) this.sound.playGearSound(false);
        this.gearRetractedSoundPlayed = true;
      }
      this.ship.setGearExtension(gearProgress);
    }

    // Ground dust emission during low altitude
    if (this.particles && targetY < 8.0) {
      this.particles.emitLandingDust(this.padCenter, targetY, (1.0 - ease) * 1.8);
    }

    // Telemetry
    this.altitude = currentAlt;
    this.airspeed = ease * 35;
    this.gForce = 1.0 + (1.0 - Math.abs(ease - 0.5) * 2) * 0.4;

    // Transition to circuit
    if (this.liftoffProgress >= 1.0) {
      this.state = FLIGHT_STATE.CIRCUIT;
      this.circuitProgress = 0.0;
      this.gearRetractedSoundPlayed = false;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  updateCircuit(dt, time) {
    const rate = this.flightSpeed * this.speedMultiplier;
    this.circuitProgress += dt * rate;

    // Clamp or loop back to approach when circuit is nearly complete
    if (this.circuitProgress >= 0.98) {
      this.state = FLIGHT_STATE.APPROACH;
      this.landingProgress = 0.0;
      if (this.sound) this.sound.playGearSound(true);
      if (this.onStateChange) this.onStateChange(this.state);
      return;
    }

    const u = THREE.MathUtils.clamp(this.circuitProgress, 0.0, 1.0);

    // Evaluate position and forward tangent along spline
    const pos = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u).normalize();

    // Look ahead a tiny fraction to calculate curvature and bank angle
    const deltaU = 0.015;
    const nextU = Math.min(1.0, u + deltaU);
    const nextTangent = this.curve.getTangentAt(nextU).normalize();

    // Curvature / turning vector in horizontal plane
    const headingCross = tangent.x * nextTangent.z - tangent.z * nextTangent.x;
    // Bank angle proportional to turn rate
    const targetBank = -headingCross * 42.0;
    this.currentBank = THREE.MathUtils.lerp(this.currentBank, targetBank, dt * 6.0);

    // Pitch: angle from horizontal + acceleration flare
    const targetPitch = Math.asin(tangent.y);
    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, targetPitch, dt * 5.0);

    // Position ship
    this.ship.group.position.copy(pos);

    // Orientation: Create rotation matrix looking along tangent with banking roll
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    m.lookAt(new THREE.Vector3(0, 0, 0), tangent, up);
    this.targetQuat.setFromRotationMatrix(m);

    // Apply bank (local Z rotation)
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.currentBank);
    this.targetQuat.multiply(rollQuat);

    // Smooth slerp
    this.ship.group.quaternion.slerp(this.targetQuat, dt * 10.0);

    // Landing gear stays cleanly tucked inside
    this.ship.setGearExtension(0.0);

    // Throttle modulation (higher when climbing or in turns)
    const climbFactor = Math.max(0, tangent.y * 1.5);
    const turnFactor = Math.abs(this.currentBank) * 0.4;
    this.throttle = 0.65 + climbFactor + turnFactor;
    this.ship.setThrottle(this.throttle);
    this.ship.setVTOLThrottle(0.0);

    // Emit wingtip trails & engine exhaust sparks
    if (this.particles) {
      const shipPos = this.ship.group.position;
      const shipDir = tangent;
      this.particles.emitEngineSpark(
        new THREE.Vector3(shipPos.x - tangent.x * 3, shipPos.y - tangent.y * 3, shipPos.z - tangent.z * 3),
        shipDir,
        14,
        0.4
      );
    }

    // Check Waypoints
    this.checkWaypoints(pos);

    // Telemetry
    this.altitude = pos.y - this.padSurfaceY;
    this.airspeed = 95 + Math.sin(u * Math.PI * 4) * 20 + this.speedMultiplier * 25;
    this.gForce = 1.0 + Math.abs(this.currentBank) * 1.8 + Math.abs(tangent.y) * 0.8;
  }

  checkWaypoints(shipPos) {
    if (!this.env || !this.env.waypoints) return;

    this.env.waypoints.forEach((wp, idx) => {
      if (!this.clearedWaypoints.has(idx)) {
        const dist = shipPos.distanceTo(wp.pos);
        if (dist < 8.5) {
          this.clearedWaypoints.add(idx);
          this.env.triggerWaypointClear(idx);
          if (this.sound) this.sound.playWaypointChime();
        }
      }
    });
  }

  updateApproach(dt, time) {
    // Decelerating and aligning precisely over the landing pad
    this.landingProgress += dt * 0.28 * this.speedMultiplier;
    const progress = THREE.MathUtils.clamp(this.landingProgress, 0.0, 1.0);
    const ease = THREE.MathUtils.smoothstep(progress, 0, 1);

    // Blend from last waypoint position back to directly above pad (0, 14, 0)
    const startApproach = this.circuitPoints[this.circuitPoints.length - 2];
    const hoverPad = new THREE.Vector3(0, this.hoverAltitude, 0);

    const currentPos = new THREE.Vector3().lerpVectors(startApproach, hoverPad, ease);
    // Subtle hover sway
    currentPos.x += Math.sin(time * 2.0) * 0.08 * (1 - ease);
    currentPos.z += Math.cos(time * 1.8) * 0.08 * (1 - ease);
    this.ship.group.position.copy(currentPos);

    // Level out orientation to flat horizontal facing runway heading (z-forward)
    const flatQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    this.ship.group.quaternion.slerp(flatQuat, dt * 4.0);

    // Extend landing gear smoothly
    const gearDeploy = THREE.MathUtils.smoothstep(progress, 0.2, 0.8);
    this.ship.setGearExtension(gearDeploy);

    // Main engines power down, VTOL power engages
    this.throttle = (1.0 - ease) * 0.4 + 0.1;
    this.ship.setThrottle(this.throttle);
    const vtolPower = 0.5 + ease * 0.35;
    this.ship.setVTOLThrottle(vtolPower);

    // Telemetry
    this.altitude = currentPos.y - this.padSurfaceY;
    this.airspeed = (1.0 - ease) * 45;
    this.gForce = 1.0 + (1.0 - ease) * 0.2;

    if (progress >= 1.0) {
      this.state = FLIGHT_STATE.TOUCHDOWN;
      this.landingProgress = 0.0;
      if (this.onStateChange) this.onStateChange(this.state);
    }
  }

  updateTouchdown(dt, time) {
    // Controlled vertical descent from 14m down to 2.45m
    this.landingProgress += dt * 0.22 * this.speedMultiplier;
    const p = THREE.MathUtils.clamp(this.landingProgress, 0.0, 1.0);

    // Cushion ease (slows down as it nears pad)
    const ease = 1 - Math.pow(1 - p, 2.5);
    const currentY = THREE.MathUtils.lerp(this.hoverAltitude, this.landedY, ease);

    // Landing gear is fully locked down
    this.ship.setGearExtension(1.0);

    // Cushion flare / gentle pitch leveling
    this.ship.group.rotation.set(0.02 * (1 - p), 0, 0);
    this.ship.group.position.set(0, currentY, 0);

    // VTOL thruster cushioning
    const vtolPower = Math.max(0.0, 0.85 * (1 - p * 0.8));
    this.ship.setVTOLThrottle(vtolPower);
    this.throttle = 0.15 * (1 - p);
    this.ship.setThrottle(this.throttle);

    // Pad dust blast on final 5 meters
    if (this.particles && currentY < 7.0) {
      this.particles.emitLandingDust(this.padCenter, currentY, (1.0 - p) * 2.2);
    }

    // Telemetry
    this.altitude = Math.max(0, currentY - this.landedY);
    this.airspeed = (1.0 - p) * 12;
    this.gForce = 1.0 - (1.0 - p) * 0.15;

    // Contact with landing pad!
    if (p >= 1.0) {
      if (this.sound) this.sound.playTouchdown();
      this.resetToPad();
    }
  }

  updateHoverHold(dt, time) {
    // Ship stays hovering at current position with thrusters active
    const pos = this.ship.group.position;
    // Micro stabilization drift
    const swayY = Math.sin(time * 2.2) * 0.06;
    const swayX = Math.cos(time * 1.5) * 0.04;
    pos.y += swayY * dt;
    pos.x += swayX * dt;

    this.ship.setThrottle(0.2);
    this.ship.setVTOLThrottle(0.75);

    this.airspeed = 0.0;
    this.altitude = Math.max(0, pos.y - this.padSurfaceY);
    this.gForce = 1.0;
  }
}
