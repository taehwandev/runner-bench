export const LANE_WIDTH = 2.15;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];

export const PHYSICS = {
  gravity: -44,
  jumpVelocity: 16.6,
  fastFallVelocity: -34,
  slideDuration: 0.62,
  laneSwitchSpeed: 16.5,
  standingHeight: 1.85,
  slidingHeight: 0.78,
  runnerHalfWidth: 0.42,
  runnerHalfDepth: 0.42,
};

export const SPEED = {
  initial: 25,
  max: 52,
  rampPerSecond: 0.36,
  nitroMultiplier: 1.72,
  demoSpeed: 18,
};

export const SCORING = {
  distanceFactor: 1.8,
  shardPoints: 50,
  nearMissPoints: 150,
  smashPoints: 300,
  powerupPoints: 120,
  maxCombo: 10,
  comboDecaySeconds: 4.5,
  nearMissWindowZ: 2.35,
  nearMissAdjacentDist: 2.55,
};

export const POWERUPS = {
  shield: {
    id: 'shield',
    label: 'AEGIS SHIELD',
    shortLabel: 'SHIELD',
    duration: 12.0,
    color: '#00f0ff',
    hex: 0x00f0ff,
  },
  magnet: {
    id: 'magnet',
    label: 'FLUX MAGNET',
    shortLabel: 'MAGNET',
    duration: 10.0,
    color: '#ff2a9d',
    hex: 0xff2a9d,
    pullRadius: 15.0,
    pullSpeed: 28.0,
  },
  nitro: {
    id: 'nitro',
    label: 'NITRO OVERDRIVE',
    shortLabel: 'NITRO',
    duration: 5.2,
    color: '#ffbe0b',
    hex: 0xffbe0b,
  },
};

export const POWERUP_KEYS = ['shield', 'magnet', 'nitro'];

export const DISTRICTS = [
  {
    id: 'downtown',
    name: 'NEON MIDTOWN',
    subtitle: 'WET ASPHALT // HIGH TRAFFIC',
    lengthUnits: 260,
    fogColor: 0x07091c,
    fogDensity: 0.0135,
    skyColor: 0x040612,
    ambientColor: 0x263268,
    accentPrimary: 0x00f0ff,
    accentSecondary: 0xff1e8a,
    lampColor: 0x00e5ff,
    roadTint: 0x0b0f1d,
  },
  {
    id: 'overpass',
    name: 'SKYWAY CONSTRUCTION',
    subtitle: 'OVERPASS DECK // WORK ZONE',
    lengthUnits: 250,
    fogColor: 0x120c1c,
    fogDensity: 0.014,
    skyColor: 0x090612,
    ambientColor: 0x3b2854,
    accentPrimary: 0xffaa00,
    accentSecondary: 0x00f0ff,
    lampColor: 0xffb703,
    roadTint: 0x10101b,
  },
  {
    id: 'tunnel',
    name: 'SUB-METRO TUNNEL',
    subtitle: 'EXPRESS CONDUIT // ECHO SECTOR',
    lengthUnits: 240,
    fogColor: 0x05131c,
    fogDensity: 0.0165,
    skyColor: 0x030b11,
    ambientColor: 0x184252,
    accentPrimary: 0x39ff88,
    accentSecondary: 0x00d9ff,
    lampColor: 0x39ff88,
    roadTint: 0x081218,
  },
  {
    id: 'railyard',
    name: 'CROSSING SECTOR 09',
    subtitle: 'ACTIVE RAIL // FREIGHT CORRIDOR',
    lengthUnits: 260,
    fogColor: 0x160814,
    fogDensity: 0.014,
    skyColor: 0x0c040c,
    ambientColor: 0x451d3a,
    accentPrimary: 0xff2a55,
    accentSecondary: 0xffbe0b,
    lampColor: 0xff3366,
    roadTint: 0x120b14,
  },
];

export const STORAGE_KEYS = {
  bestScore: 'neon_overdrive_best_score_v1',
  muted: 'neon_overdrive_muted_v1',
};
