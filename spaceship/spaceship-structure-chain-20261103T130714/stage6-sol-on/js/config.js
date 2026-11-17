// Tunables and static data. No DOM or three.js access.

const unit = ({ x, y, z }) => {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
};

export const CONFIG = {
  // Flight timing (seconds) and geometry (scene units)
  hoverHeight: 2.6,
  lapRadius: 14,
  lapDuration: 26, // one slow lap, including the spiral-out entry from the pad centre
  entryTime: 2.5, // time to spiral from the pad centre out to the lap ring
  departTurnTime: 2.5, // time to turn from the lap tangent onto the departure heading
  departDuration: 12, // accelerating flight before the ship is considered gone
  goneFollowTime: 6, // seconds the camera keeps tracking after the ship is gone
  cruiseSpeed: 18, // speed the ship settles to after leaving the camera's follow
  departSpeed: { base: 4, accel: 0.6 }, // speed = base + accel * t^2

  // Heading conventions: the ship's nose points along the lap tangent at angle 0 (+Z).
  // The departure heads away from the default camera, which sits on the -Z side.
  startDir: { x: 0, y: 0, z: 1 },
  departDir: unit({ x: 0.25, y: 0.5, z: 1 }),

  // Camera
  home: {
    target: { x: 0, y: 2.6, z: 0 }, // = hoverHeight, so the ship stays centred when zoomed in and orbiting
    dir: unit({ x: -20, y: 12, z: -34 }),
    distanceLandscape: 34,
    distancePortrait: 56, // wider framing so the full lap fits a narrow screen
  },
  follow: { smoothing: 10 }, // higher = tighter tracking
  zoom: { min: 6, max: 160, smoothing: 8 },
  resetDuration: 1.1,

  // Palette
  colors: {
    horizon: 0xcfe9ff,
    zenith: 0x2f7fd8,
    grass: 0x7cbf55,
    apron: 0xc4cad2,
    mountain: 0x7f9cb8,
    trunk: 0x7a5230,
    foliage: [0x2f7d3a, 0x3f8f43, 0x4fa04a],
    rock: 0x9aa0a8,
    cloud: 0xffffff,
    hull: 0xe9eef5,
    accent: 0xff6b35,
    glass: 0x6fd3ff,
    exhaust: 0x7ff3ff,
    beacon: 0xffd23f,
  },
};

export const PHASE_TEXT = {
  hover: 'Ship hovering over the landing pad. Press Launch to begin its lap.',
  lap: 'One slow lap around the pad…',
  depart: 'Departing. The camera is following the ship.',
  gone: 'The ship has left the pad. Press Replay to start over.',
};

// Shared destination catalog: UI labels, jump coordinates and arrival palette.
export const DESTINATIONS = {
  azure: {
    name: 'Azure', description: 'Ocean world',
    offset: { x: 8000, y: 4000, z: 12000 },
    color: 0x3974a4, emissive: 0x122a4b, halo: 0x60c8ff,
  },
  ember: {
    name: 'Ember', description: 'Ringed desert world',
    offset: { x: -10000, y: 6000, z: 9000 },
    color: 0xc46b38, emissive: 0x54200d, halo: 0xffba72,
  },
};
export const DEFAULT_DESTINATION = 'azure';
