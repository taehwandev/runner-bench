export const LAP_DURATION = 24;
export const DEPARTURE_DURATION = 22;
const TAU = Math.PI * 2;

// Compute outbound position, speed, and stage along the extended departure trajectory.
function outboundFlight(outbound) {
  const v0 = 8 * TAU / LAP_DURATION; // ~2.094 m/s matching lap tangent speed

  if (outbound <= 7) {
    // Stage 1: Climb away from the spaceport outpost
    const dist = v0 * outbound + 6 * outbound ** 2;
    const alt = 3.2 + 4.4 * outbound ** 2;
    const speed = v0 + 12 * outbound;
    const pitch = Math.min(outbound / 7, 1) * 0.28;
    return {
      stage: 'climb',
      distance: dist,
      altitude: alt,
      speed,
      pitch,
      bank: -.1 * Math.max(1 - outbound / 3, 0),
      spaceProgress: 0,
      jumpActive: false,
      jumpProgress: 0,
      arrivalProgress: 0,
    };
  }

  // Position at outbound = 7
  const x7 = v0 * 7 + 6 * 49; // 308.66
  const y7 = 3.2 + 4.4 * 49; // 218.8
  const v7 = v0 + 84; // 86.09

  if (outbound <= 14) {
    // Stage 2: Climbing out of the atmosphere into space
    const dt = outbound - 7;
    const dist = x7 + v7 * dt + 0.5 * 30 * dt ** 2;
    const alt = y7 + (3500 - y7) * Math.sin((dt / 7) * (Math.PI / 2));
    const speed = v7 + 30 * dt;
    const pitch = 0.28 * Math.cos((dt / 7) * (Math.PI / 2));
    const spaceProgress = Math.min(Math.max((outbound - 7.5) / 6.0, 0), 1);
    return {
      stage: 'space',
      distance: dist,
      altitude: alt,
      speed,
      pitch,
      bank: 0,
      spaceProgress,
      jumpActive: false,
      jumpProgress: 0,
      arrivalProgress: 0,
    };
  }

  // Position at outbound = 14
  const x14 = x7 + v7 * 7 + 0.5 * 30 * 49; // 1646.3
  const v14 = v7 + 30 * 7; // 296.09

  if (outbound <= 16.5) {
    // Stage 3: In space, warp drive charging
    const dt = outbound - 14;
    const dist = x14 + v14 * dt + 0.5 * 20 * dt ** 2;
    const speed = v14 + 20 * dt;
    return {
      stage: 'warp-spool',
      distance: dist,
      altitude: 3500,
      speed,
      pitch: 0,
      bank: 0,
      spaceProgress: 1,
      jumpActive: false,
      jumpProgress: 0,
      arrivalProgress: 0,
      warpCharge: Math.min(Math.max((outbound - 15) / 1.5, 0), 1),
    };
  }

  // Position at outbound = 16.5
  const x16_5 = x14 + v14 * 2.5 + 0.5 * 20 * 6.25; // 2449.0
  const xDest = 20000;

  if (outbound <= 17.5) {
    // Stage 4: Teleport jump to distant destination
    const u = (outbound - 16.5) / 1.0;
    const ease = u < 0.5 ? 4 * u ** 3 : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const dist = x16_5 + (xDest - x16_5) * ease;
    return {
      stage: 'jump',
      distance: dist,
      altitude: 3500,
      speed: 17500,
      pitch: 0,
      bank: 0,
      spaceProgress: 1,
      jumpActive: true,
      jumpProgress: u,
      arrivalProgress: 0,
    };
  }

  if (outbound <= 22) {
    // Stage 5: Arrival at distant destination
    const dt = outbound - 17.5;
    const speed = 120 + 180 * Math.exp(-dt * 1.2);
    const dist = xDest + 120 * dt + (180 / 1.2) * (1 - Math.exp(-dt * 1.2));
    return {
      stage: 'arrival',
      distance: dist,
      altitude: 3500,
      speed,
      pitch: 0,
      bank: 0,
      spaceProgress: 1,
      jumpActive: false,
      jumpProgress: 1,
      arrivalProgress: Math.min(dt / 3, 1),
    };
  }

  // Stage 6: Cruise at distant destination
  const dt = outbound - 22;
  const distAt22 = xDest + 120 * 4.5 + (180 / 1.2) * (1 - Math.exp(-4.5 * 1.2));
  return {
    stage: 'destination-cruise',
    distance: distAt22 + 120 * dt,
    altitude: 3500,
    speed: 120,
    pitch: 0,
    bank: 0,
    spaceProgress: 1,
    jumpActive: false,
    jumpProgress: 1,
    arrivalProgress: 1,
  };
}

// A circle tangent to the final outbound path; the ship begins directly over the pad.
export function flightAt(elapsed) {
  const t = Math.max(0, elapsed);
  if (t <= LAP_DURATION) {
    const angle = t / LAP_DURATION * TAU;
    return {
      phase: 'lap',
      stage: 'lap',
      progress: t / LAP_DURATION,
      position: [8 * Math.sin(angle), 3.2 + 2 * Math.sin(angle / 2) ** 2, 8 * (1 - Math.cos(angle))],
      heading: Math.PI / 2 - angle,
      bank: -.1 * Math.sin(Math.min(t / 2, 1) * Math.PI / 2),
      pitch: 0,
      speed: 8 * TAU / LAP_DURATION,
      spaceProgress: 0,
      jumpActive: false,
      jumpProgress: 0,
      arrivalProgress: 0,
    };
  }
  const outbound = t - LAP_DURATION;
  const flight = outboundFlight(outbound);
  return {
    phase: outbound < DEPARTURE_DURATION ? 'depart' : 'cruise',
    stage: flight.stage,
    progress: Math.min(outbound / DEPARTURE_DURATION, 1),
    position: [flight.distance, flight.altitude, 0],
    heading: Math.PI / 2,
    bank: flight.bank,
    pitch: flight.pitch,
    speed: flight.speed,
    spaceProgress: flight.spaceProgress,
    jumpActive: flight.jumpActive,
    jumpProgress: flight.jumpProgress,
    arrivalProgress: flight.arrivalProgress,
    warpCharge: flight.warpCharge ?? 0,
  };
}

// Wall-clock timing excludes paused intervals, independently of render frame rate.
export class FlightPlayback {
  startedAt = null;
  pausedAt = null;

  get started() { return this.startedAt !== null; }
  get paused() { return this.pausedAt !== null; }

  start(now) {
    this.startedAt = now;
    this.pausedAt = null;
  }

  elapsed(now) {
    if (!this.started) return 0;
    return Math.max(0, ((this.pausedAt ?? now) - this.startedAt) / 1000);
  }

  pause(now) {
    if (this.started && !this.paused) this.pausedAt = now;
  }

  resume(now) {
    if (!this.paused) return;
    this.startedAt += now - this.pausedAt;
    this.pausedAt = null;
  }
}
