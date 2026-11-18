// Static configuration: timetable, layout and look. No logic lives here.

export const DURATION = 60;

// Speed keyframes (seconds, m/s). Between keys the speed eases with a
// smoothstep, so distance has a closed form and never depends on frame rate.
export const SPEED_KEYS = [
  { t: 0, v: 38 },
  { t: 24, v: 38 }, // cruise between the towers
  { t: 30, v: 0 }, // braking into the station
  { t: 34, v: 0 }, // standing at the platform
  { t: 40, v: 46 }, // pulling away
  { t: 46, v: 54 }, // through the tunnel
  { t: 60, v: 58 }, // across the bridge
];

export const PHASES = [
  { until: 24, name: 'running' },
  { until: 30, name: 'braking' },
  { until: 34, name: 'stopped' },
  { until: 40, name: 'departing' },
  { until: 46, name: 'tunnel' },
  { until: Infinity, name: 'bridge' },
];

export const TIMES = { brake: 24, stop: 30, depart: 34, tunnelIn: 40, tunnelOut: 46 };

// Train consist. Lengths in metres; `gap` is the coupling gap between bodies.
export const TRAIN = {
  locoLength: 23,
  carLength: 15,
  gap: 1,
  cars: ['coach', 'coach', 'turret', 'coach', 'cargo', 'coach', 'turret', 'coach', 'cargo', 'caboose'],
};

// Track layout. `s` is metres along the centreline; the head of the train is
// at s = distance(t). Everything past `straightFrom` runs straight down -Z.
export const TRACK = {
  railY: 46, // height of the rail head above the frozen streets
  straightFrom: 760,
  curveAmp: 70,
  curveWave: 210,
  curveEase: 300,
  from: -900,
  to: 3600,
  beamHalfWidth: 1.7, // slender viaduct beam between the towers
  deckHalfWidth: 4.2, // full deck on the bridge and in the tunnel
};

export const STATION = { platformBack: 205, platformAhead: 16, side: -1, edge: 2.15, width: 11, floorY: 1.15, canopySetback: 4.6 };

export const TUNNEL = { halfWidth: 6.5, height: 8.2, coreHalfWidth: 30, blockHalfWidth: 95, blockHeight: 430 };

export const BRIDGE = { startPad: 14, length: 1500, pylonEvery: 260, pylonHeight: 96 };

// Shot list. `start` times are the only place cuts are defined.
export const SHOTS = [
  { id: 'establishing', label: 'Establishing', start: 0 },
  { id: 'tracking', label: 'Alongside', start: 8 },
  { id: 'underpass', label: 'Passing overhead', start: 15 },
  { id: 'approach', label: 'Station approach', start: 21 },
  { id: 'arrival', label: 'Arrival', start: 27 },
  { id: 'platform', label: 'Platform', start: 31 },
  { id: 'departure', label: 'Departure', start: 35.5 },
  { id: 'tunnel', label: 'Tunnel', start: 40 },
  { id: 'breakout', label: 'Breakout', start: 44.6 },
  { id: 'bridge', label: 'Into the night', start: 52 },
];

export const RENDER = { aspect: 9 / 16, maxPixelRatio: 2, maxHeight: 1920, minScale: 0.6 };

export const SEED = 20261118;

// Direction of the last light on the horizon (dusk afterglow), unit-ish.
export const GLOW_DIR = [0.3, 0.1, 0.95];
// The moon hangs over the far end of the bridge.
export const MOON_DIR = [-0.035, 0.19, -0.98];

// Whistle blasts: start time and length in seconds. Steam and sound both read this.
export const WHISTLES = [
  { t: 3.2, d: 1.8 },
  { t: 21.4, d: 1.7 },
  { t: 34.1, d: 0.45 },
  { t: 34.85, d: 0.9 },
  { t: 38.4, d: 1.4 },
  { t: 49.4, d: 2.8 },
];

// Prevailing wind (m/s) that carries both snow and steam.
export const WIND = [1.7, 0, 0.6];
