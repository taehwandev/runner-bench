export const LAP_DURATION = 24;
export const DEPARTURE_DURATION = 22;
const TAU = Math.PI * 2;

// A circle tangent to the final outbound path; the ship begins directly over the pad.
export function flightAt(elapsed) {
  const t = Math.max(0, elapsed);
  if (t <= LAP_DURATION) {
    const angle = t / LAP_DURATION * TAU;
    return {
      phase: 'lap', progress: t / LAP_DURATION,
      position: [8 * Math.sin(angle), 3.2 + 2 * Math.sin(angle / 2) ** 2, 8 * (1 - Math.cos(angle))],
      heading: Math.PI / 2 - angle,
      bank: -.1 * Math.sin(Math.min(t / 2, 1) * Math.PI / 2),
      speed: 8 * TAU / LAP_DURATION,
    };
  }
  const outbound = t - LAP_DURATION;
  const distance = 8 * TAU / LAP_DURATION * outbound + .5 * .52 * outbound ** 2;
  return {
    phase: outbound < DEPARTURE_DURATION ? 'depart' : 'cruise',
    progress: Math.min(outbound / DEPARTURE_DURATION, 1),
    position: [distance, 3.2 + .012 * distance ** 1.7, 0],
    heading: Math.PI / 2, bank: -.1 * Math.max(1 - outbound / 3, 0),
    speed: 8 * TAU / LAP_DURATION + .52 * outbound,
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
