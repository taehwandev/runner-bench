// Static configuration: timetable, consist, track layout, shot list, palette.
// Everything here is plain data; derived values live in core/landmarks.js.

export const DURATION = 60;
export const WORLD_SEED = 20261118;

// ---------------------------------------------------------------- train
export const CONSIST = [
  { type: 'loco', length: 20 },
  { type: 'troop', length: 13.5 },
  { type: 'troop', length: 13.5 },
  { type: 'turret', length: 13.5 },
  { type: 'troop', length: 13.5 },
  { type: 'cargo', length: 13.5 },
  { type: 'troop', length: 13.5 },
  { type: 'turret', length: 13.5 },
  { type: 'cargo', length: 13.5 },
  { type: 'guard', length: 13.5 },
];
export const COUPLING_GAP = 1.2;

// ---------------------------------------------------------------- timetable
// Distances are of the locomotive nose, in metres along the track.
export const TIMETABLE = {
  startDistance: 160,
  cruiseSpeed: 24,     // m/s, 0–24 s
  brakeStart: 24,
  stopAt: 30,
  departAt: 34,
  departEnd: 40,
  topSpeed: 35,        // m/s, reached at 40 s and held to the end
  tunnelEnter: 40,     // nose reaches the portal
  tunnelExit: 46,      // tail clears the far portal
};

// ---------------------------------------------------------------- track
// Heading in degrees; direction = (cos h, sin h) in the x/z plane. -90 = north (-z).
export const TRACK_LAYOUT = {
  start: { x: 0, z: 120 },
  heading: -90,
  deckY: 30,
  segments: [
    { type: 'straight', length: 420 },
    { type: 'arc', radius: 450, angle: -25 },
    { type: 'straight', length: 440 },
    { type: 'arc', radius: 800, angle: 17 },
    { type: 'straight', length: 1100 },
  ],
  drawFrom: -420,
  drawTo: 2500,
};

// ---------------------------------------------------------------- shots
// kind selects a camera rig in core/shots.js; params tune it.
export const SHOTS = [
  { name: 'Establishing', start: 0, end: 6.5, kind: 'establish' },
  { name: 'Tracking the cars', start: 6.5, end: 13, kind: 'tracking' },
  { name: 'Overhead pass', start: 13, end: 19.5, kind: 'underpass' },
  { name: 'Arrival', start: 19.5, end: 27, kind: 'arrival' },
  { name: 'At the platform', start: 27, end: 33.6, kind: 'standing' },
  { name: 'Departure', start: 33.6, end: 40, kind: 'departure' },
  { name: 'Into the tower', start: 40, end: 43.2, kind: 'cabPOV' },
  { name: 'Out of the tunnel', start: 43.2, end: 49, kind: 'portal' },
  { name: 'The long bridge', start: 49, end: 54.5, kind: 'pylon' },
  { name: 'Into the night', start: 54.5, end: 60, kind: 'finale' },
];

// ---------------------------------------------------------------- atmosphere
// Keyframes over the 60 s; colours are sRGB hex, interpolated in linear space.
export const ATMOS_KEYS = [
  {
    t: 0,
    zenith: 0x1d2c52, horizon: 0xd88a6e, fog: 0x7a7f9c, sunGlow: 0xff9a5c,
    ambSky: 0x5d6d96, ambGround: 0x2a2b3a, sunLight: 0xffa070, mist: 0x9aa3bf,
    fogDensity: 0.00165, sunGlowAmt: 1.0, stars: 0.0, cityGlow: 0.55, exposure: 1.0,
  },
  {
    t: 30,
    zenith: 0x121c3a, horizon: 0x9a6170, fog: 0x4c5372, sunGlow: 0xd56a52,
    ambSky: 0x3c4870, ambGround: 0x1c1d2a, sunLight: 0xc0705a, mist: 0x6d7593,
    fogDensity: 0.0018, sunGlowAmt: 0.7, stars: 0.35, cityGlow: 0.75, exposure: 1.05,
  },
  {
    t: 60,
    zenith: 0x060a1a, horizon: 0x2a2f4c, fog: 0x1d2238, sunGlow: 0x6a3a50,
    ambSky: 0x1f2848, ambGround: 0x0e0f18, sunLight: 0x50405a, mist: 0x323a58,
    fogDensity: 0.0019, sunGlowAmt: 0.35, stars: 1.0, cityGlow: 0.9, exposure: 1.1,
  },
];
export const SUN_DIR = { x: -0.88, y: -0.03, z: -0.47 };   // just under the western horizon
export const MOON_DIR = { x: -0.05, y: 0.14, z: -0.99 };   // low, just right of the bridge's heading

// ---------------------------------------------------------------- render quality
export const QUALITY = {
  maxDpr: 2,
  maxPixelWidth: 1080,      // portrait target 1080 x 1920
  minScale: 0.55,           // adaptive resolution floor
  snowNear: 5000,
  snowFar: 4000,
  bloom: { strength: 0.7, radius: 0.5, threshold: 0.9 },
};

export const TITLES = {
  title: 'FROSTLINE',
  subtitle: 'Night Service 7 · Vestra Line',
  station: 'VESTRA HEIGHTS',
  endLine: 'into the night',
};
