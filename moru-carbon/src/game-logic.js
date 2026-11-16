import {
  DISTRICTS,
  LANES,
  LANE_WIDTH,
  PHYSICS,
  POWERUPS,
  POWERUP_KEYS,
  SCORING,
  SPEED,
} from './config.js';

export function createRng(seed = Date.now()) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createGameState(seed = Date.now()) {
  return {
    mode: 'start', // 'start' | 'playing' | 'gameover'
    alive: false,
    score: 0,
    distance: 0,
    shards: 0,
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    baseSpeed: SPEED.initial,
    currentSpeed: SPEED.demoSpeed,
    elapsed: 0,
    districtIndex: 0,
    districtProgress: 0,
    runner: {
      lane: 1,
      prevLane: 1,
      timeSinceLaneSwap: 99,
      x: 0,
      y: 0,
      vy: 0,
      isJumping: false,
      isSliding: false,
      slideTimer: 0,
      queuedSlide: false,
      bufferedAction: null,
      bufferTimer: 0,
      invulnTimer: 0,
    },
    powerups: {
      shield: 0,
      magnet: 0,
      nitro: 0,
    },
    obstacles: [],
    collectibles: [],
    pickups: [],
    nextEntityId: 1,
    nextWaveZ: -38,
    waveCount: 0,
    safeLane: 1,
    rng: createRng(seed),
    events: [],
  };
}

export function startNewRun(state, seed = Date.now()) {
  const fresh = createGameState(seed);
  Object.assign(state, fresh);
  state.mode = 'playing';
  state.alive = true;
  state.currentSpeed = SPEED.initial;
  // Pre-populate initial visible corridor (-34 to -135) so action starts immediately
  while (state.nextWaveZ > -140) {
    spawnNextWave(state);
  }
  state.events.push({ type: 'run_start', district: DISTRICTS[0] });
  return state;
}

export function applyRunnerAction(state, action) {
  if (state.mode !== 'playing' || !state.alive) return false;
  const r = state.runner;

  if (action === 'left') {
    if (r.lane > 0) {
      r.prevLane = r.lane;
      r.lane -= 1;
      r.timeSinceLaneSwap = 0;
      state.events.push({ type: 'lane_swap', dir: -1, lane: r.lane });
      return true;
    }
    return false;
  }

  if (action === 'right') {
    if (r.lane < 2) {
      r.prevLane = r.lane;
      r.lane += 1;
      r.timeSinceLaneSwap = 0;
      state.events.push({ type: 'lane_swap', dir: 1, lane: r.lane });
      return true;
    }
    return false;
  }

  if (action === 'jump') {
    if (!r.isJumping) {
      r.isJumping = true;
      r.isSliding = false;
      r.slideTimer = 0;
      r.queuedSlide = false;
      r.vy = PHYSICS.jumpVelocity;
      state.events.push({ type: 'jump' });
      return true;
    }
    r.bufferedAction = 'jump';
    r.bufferTimer = 0.18;
    return false;
  }

  if (action === 'slide') {
    if (r.isJumping) {
      r.vy = Math.min(r.vy, PHYSICS.fastFallVelocity);
      r.queuedSlide = true;
      state.events.push({ type: 'fast_fall' });
      return true;
    }
    r.isSliding = true;
    r.slideTimer = PHYSICS.slideDuration;
    state.events.push({ type: 'slide' });
    return true;
  }

  return false;
}

function updateRunnerPhysics(state, dt) {
  const r = state.runner;
  r.timeSinceLaneSwap += dt;
  if (r.invulnTimer > 0) r.invulnTimer = Math.max(0, r.invulnTimer - dt);

  if (r.bufferTimer > 0) {
    r.bufferTimer -= dt;
    if (r.bufferTimer <= 0) r.bufferedAction = null;
  }

  const targetX = LANES[r.lane];
  const blend = 1 - Math.exp(-PHYSICS.laneSwitchSpeed * dt);
  r.x += (targetX - r.x) * blend;
  if (Math.abs(targetX - r.x) < 0.005) r.x = targetX;

  if (r.isJumping) {
    r.y += r.vy * dt;
    r.vy += PHYSICS.gravity * dt;
    if (r.y <= 0) {
      r.y = 0;
      r.vy = 0;
      r.isJumping = false;
      state.events.push({ type: 'land' });
      if (r.queuedSlide) {
        r.queuedSlide = false;
        r.isSliding = true;
        r.slideTimer = PHYSICS.slideDuration;
        state.events.push({ type: 'slide' });
      } else if (r.bufferedAction === 'jump') {
        r.bufferedAction = null;
        r.bufferTimer = 0;
        applyRunnerAction(state, 'jump');
      }
    }
  }

  if (r.isSliding) {
    r.slideTimer -= dt;
    if (r.slideTimer <= 0) {
      r.isSliding = false;
      r.slideTimer = 0;
    }
  }
}

function updateDistrictAndSpeed(state, dt) {
  state.elapsed += dt;
  state.baseSpeed = Math.min(
    SPEED.max,
    SPEED.initial + state.elapsed * SPEED.rampPerSecond
  );
  const nitroBoost = state.powerups.nitro > 0 ? SPEED.nitroMultiplier : 1;
  state.currentSpeed = state.baseSpeed * nitroBoost;

  const deltaDist = state.currentSpeed * dt;
  state.distance += deltaDist;
  state.score += deltaDist * SCORING.distanceFactor * (1 + (state.combo - 1) * 0.15);

  const curDistrict = DISTRICTS[state.districtIndex];
  state.districtProgress += deltaDist;
  if (state.districtProgress >= curDistrict.lengthUnits) {
    state.districtProgress -= curDistrict.lengthUnits;
    state.districtIndex = (state.districtIndex + 1) % DISTRICTS.length;
    state.events.push({
      type: 'district_change',
      districtIndex: state.districtIndex,
      district: DISTRICTS[state.districtIndex],
    });
  }

  for (const key of POWERUP_KEYS) {
    if (state.powerups[key] > 0) {
      state.powerups[key] = Math.max(0, state.powerups[key] - dt);
    }
  }

  if (state.combo > 1) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      state.comboTimer = 0;
    }
  }
}

function makeObstacleDef(state, kind, lane, z, extra = {}) {
  const templates = {
    low_barrier: { yMin: 0, yMax: 1.12, halfW: 0.84, halfD: 0.52, velZ: 0 },
    steam_trench: { yMin: 0, yMax: 1.02, halfW: 0.84, halfD: 0.68, velZ: 0 },
    high_gantry: { yMin: 1.16, yMax: 3.2, halfW: 0.92, halfD: 0.55, velZ: 0 },
    full_truck: { yMin: 0, yMax: 3.45, halfW: 0.86, halfD: 2.25, velZ: 0 },
    full_pillar: { yMin: 0, yMax: 4.4, halfW: 0.8, halfD: 0.88, velZ: 0 },
    moving_car: { yMin: 0, yMax: 1.48, halfW: 0.8, halfD: 1.72, velZ: 12.5 },
    lane_shifter: { yMin: 0, yMax: 1.46, halfW: 0.78, halfD: 1.68, velZ: 9.5 },
    rail_train: { yMin: 0, yMax: 3.65, halfW: 0.88, halfD: 3.35, velZ: 14.5 },
  };
  const base = templates[kind];
  return {
    id: state.nextEntityId++,
    kind,
    lane,
    targetLane: extra.targetLane ?? lane,
    x: LANES[lane],
    z,
    yMin: base.yMin,
    yMax: base.yMax,
    halfW: base.halfW,
    halfD: base.halfD,
    velZ: extra.velZ ?? base.velZ,
    variant: extra.variant ?? Math.floor(state.rng() * 3),
    nearMissChecked: false,
    smashed: false,
    shiftTriggered: false,
  };
}

function addShardLine(state, lane, startZ, count, stepZ = -2.7, arcJump = false) {
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const y = arcJump ? 0.95 + Math.sin(t * Math.PI) * 1.65 : 0.9;
    state.collectibles.push({
      id: state.nextEntityId++,
      lane,
      x: LANES[lane],
      y,
      z: startZ + i * stepZ,
      collected: false,
    });
  }
}

export function spawnNextWave(state) {
  const rng = state.rng;
  state.waveCount += 1;
  const waveIdx = state.waveCount;
  const z = state.nextWaveZ;
  const districtId = DISTRICTS[state.districtIndex].id;
  const difficulty = Math.min(1, state.elapsed / 55);

  // Move safeLane by at most 1 step so a player never needs a double-swipe instantaneously
  const candidates = [0, 1, 2].filter((l) => Math.abs(l - state.safeLane) <= 1);
  const nextSafe = candidates[Math.floor(rng() * candidates.length)];
  state.safeLane = nextSafe;

  // Safe lane action: clear corridor, jump barrier, or slide gantry
  const safeRoll = rng();
  let safeAction = 'run';
  if (waveIdx > 1 && safeRoll < 0.34) {
    safeAction = 'jump';
    const lowKind = districtId === 'overpass' && rng() < 0.45 ? 'steam_trench' : 'low_barrier';
    state.obstacles.push(makeObstacleDef(state, lowKind, nextSafe, z));
    addShardLine(state, nextSafe, z + 3.2, 4, -2.2, true);
  } else if (waveIdx > 1 && safeRoll < 0.64) {
    safeAction = 'slide';
    state.obstacles.push(makeObstacleDef(state, 'high_gantry', nextSafe, z));
    addShardLine(state, nextSafe, z + 2.8, 3, -2.5, false);
  } else if (rng() < 0.55) {
    addShardLine(state, nextSafe, z + 2.5, 3, -2.6, false);
  }

  // Populate non-safe lanes with varied hazards + high-reward risky shards
  const otherLanes = [0, 1, 2].filter((l) => l !== nextSafe);
  populateHazardLanes(state, otherLanes, nextSafe, z, districtId, difficulty, safeAction);

  // Guaranteed early power-up on wave 4, then periodic every 7-9 waves
  if (waveIdx === 4 || (waveIdx > 8 && waveIdx % 8 === 0)) {
    const pType = POWERUP_KEYS[(Math.floor(waveIdx / 4) + Math.floor(rng() * 3)) % POWERUP_KEYS.length];
    const pickupY = safeAction === 'jump' ? 2.45 : 1.05;
    state.pickups.push({
      id: state.nextEntityId++,
      kind: pType,
      lane: nextSafe,
      x: LANES[nextSafe],
      y: pickupY,
      z: z - 5.5,
      collected: false,
    });
  }

  const gap = Math.max(16.5, state.baseSpeed * (0.68 - difficulty * 0.12));
  state.nextWaveZ -= gap;
}

function populateHazardLanes(state, otherLanes, safeLane, z, districtId, difficulty) {
  const rng = state.rng;
  const blockCount = rng() < 0.45 + difficulty * 0.4 ? 2 : 1;

  for (let i = 0; i < blockCount; i++) {
    const lane = otherLanes[i];
    const roll = rng();
    if (districtId === 'railyard' && roll < 0.38) {
      state.obstacles.push(makeObstacleDef(state, 'rail_train', lane, z - 4));
      // Risky shards in front of oncoming train
      addShardLine(state, lane, z + 6.5, 3, -2.2, false);
    } else if (roll < 0.3 + difficulty * 0.22 && state.waveCount >= 3) {
      // Moving oncoming traffic or lane-shifter
      const canShift = difficulty > 0.22 && rng() < 0.32 && otherLanes.length === 2;
      const altHazardLane = otherLanes[1 - i];
      if (canShift && altHazardLane !== undefined && altHazardLane !== safeLane) {
        state.obstacles.push(
          makeObstacleDef(state, 'lane_shifter', lane, z - 3, { targetLane: altHazardLane })
        );
      } else if (rng() < 0.34) {
        // Slower same-way traffic overtaken from behind (red taillights)
        state.obstacles.push(makeObstacleDef(state, 'moving_car', lane, z - 1.5, { velZ: -9.5 }));
      } else {
        const speedVar = 11 + difficulty * 6 + rng() * 3;
        state.obstacles.push(makeObstacleDef(state, 'moving_car', lane, z - 2.5, { velZ: speedVar }));
      }
      // Tempting risky shards directly in the traffic lane!
      if (rng() < 0.78) {
        addShardLine(state, lane, z + 6.2, 3, -2.1, false);
      }
    } else if (roll < 0.68) {
      const fullKind =
        districtId === 'overpass' || districtId === 'tunnel'
          ? rng() < 0.5 ? 'full_pillar' : 'full_truck'
          : 'full_truck';
      state.obstacles.push(makeObstacleDef(state, fullKind, lane, z));
      if (rng() < 0.52) {
        addShardLine(state, lane, z + 5.2, 3, -2.0, false);
      }
    } else if (roll < 0.85) {
      state.obstacles.push(makeObstacleDef(state, 'low_barrier', lane, z));
    } else {
      state.obstacles.push(makeObstacleDef(state, 'high_gantry', lane, z));
    }
  }
}

function awardNearMiss(state, obs, reason) {
  obs.nearMissChecked = true;
  state.combo = Math.min(SCORING.maxCombo, state.combo + 1);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = SCORING.comboDecaySeconds;
  const pts = SCORING.nearMissPoints * state.combo;
  state.score += pts;
  state.events.push({
    type: 'near_miss',
    points: pts,
    combo: state.combo,
    reason,
    x: obs.x,
    z: obs.z,
  });
}

function smashObstacle(state, obs, source) {
  obs.smashed = true;
  obs.nearMissChecked = true;
  const pts = SCORING.smashPoints * state.combo;
  state.score += pts;
  state.combo = Math.min(SCORING.maxCombo, state.combo + 1);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = SCORING.comboDecaySeconds;
  state.events.push({
    type: 'smash',
    source,
    points: pts,
    x: obs.x,
    z: obs.z,
    kind: obs.kind,
  });
}

function updateObstaclesAndCollisions(state, dt) {
  const r = state.runner;
  const rMinY = r.y;
  const rMaxY = r.y + (r.isSliding ? PHYSICS.slidingHeight : PHYSICS.standingHeight);

  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const obs = state.obstacles[i];
    obs.z += (state.currentSpeed + obs.velZ) * dt;

    if (obs.kind === 'lane_shifter' && obs.z > -48) {
      obs.shiftTriggered = true;
      const targetX = LANES[obs.targetLane];
      obs.x += (targetX - obs.x) * Math.min(1, dt * 5.5);
      if (Math.abs(targetX - obs.x) < 0.25) obs.lane = obs.targetLane;
    }

    if (obs.smashed) {
      if (obs.z > 18) state.obstacles.splice(i, 1);
      continue;
    }

    const zOverlap =
      obs.z + obs.halfD >= -PHYSICS.runnerHalfDepth &&
      obs.z - obs.halfD <= PHYSICS.runnerHalfDepth;
    const xDist = Math.abs(r.x - obs.x);
    const xOverlap = xDist < obs.halfW + PHYSICS.runnerHalfWidth - 0.08;
    const yOverlap = rMaxY > obs.yMin + 0.05 && rMinY < obs.yMax - 0.05;

    if (zOverlap && xOverlap && yOverlap) {
      if (state.powerups.nitro > 0) {
        smashObstacle(state, obs, 'nitro');
        continue;
      }
      if (state.powerups.shield > 0) {
        state.powerups.shield = 0;
        r.invulnTimer = 0.65;
        smashObstacle(state, obs, 'shield');
        continue;
      }
      if (r.invulnTimer > 0) continue;

      state.alive = false;
      state.mode = 'gameover';
      state.events.push({ type: 'crash', kind: obs.kind, x: r.x, y: r.y });
      return;
    }

    // Check near-miss when obstacle crosses or just passed runner plane
    if (!obs.nearMissChecked && obs.z - obs.halfD > -0.35 && obs.z - obs.halfD < 4.5) {
      if (xOverlap && !yOverlap) {
        awardNearMiss(state, obs, r.isSliding ? 'tight_slide' : 'close_jump');
      } else if (!xOverlap && xDist <= SCORING.nearMissAdjacentDist) {
        const lastSecondDodge = r.timeSinceLaneSwap < 0.52 && r.prevLane === obs.lane;
        const movingSkim = obs.velZ !== 0 && xDist <= LANE_WIDTH + 0.22;
        if (lastSecondDodge || movingSkim) {
          awardNearMiss(state, obs, lastSecondDodge ? 'dodge' : 'traffic_skim');
        } else {
          obs.nearMissChecked = true;
        }
      }
    }

    if (obs.z - obs.halfD > 18) {
      state.obstacles.splice(i, 1);
    }
  }
}

function updateCollectiblesAndPickups(state, dt) {
  const r = state.runner;
  const runnerCenterY = r.y + (r.isSliding ? 0.5 : 0.95);
  const magnetActive = state.powerups.magnet > 0;

  for (let i = state.collectibles.length - 1; i >= 0; i--) {
    const c = state.collectibles[i];
    c.z += state.currentSpeed * dt;

    if (magnetActive && c.z > -POWERUPS.magnet.pullRadius && c.z < 3.5) {
      const pull = Math.min(1, POWERUPS.magnet.pullSpeed * dt * 0.45);
      c.x += (r.x - c.x) * pull;
      c.y += (runnerCenterY - c.y) * pull;
      c.z += (0 - c.z) * (pull * 0.55);
    }

    const dx = Math.abs(c.x - r.x);
    const dy = Math.abs(c.y - runnerCenterY);
    const dz = Math.abs(c.z);
    if (dx < 0.95 && dy < 1.25 && dz < 1.15) {
      state.shards += 1;
      const pts = SCORING.shardPoints * state.combo;
      state.score += pts;
      if (state.combo > 1) {
        state.comboTimer = Math.min(SCORING.comboDecaySeconds, state.comboTimer + 0.65);
      }
      state.events.push({ type: 'shard', points: pts, x: c.x, y: c.y, z: c.z });
      state.collectibles.splice(i, 1);
      continue;
    }

    if (c.z > 14) state.collectibles.splice(i, 1);
  }

  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    p.z += state.currentSpeed * dt;
    const dx = Math.abs(p.x - r.x);
    const dy = Math.abs(p.y - runnerCenterY);
    const dz = Math.abs(p.z);
    if (dx < 1.05 && dy < 1.45 && dz < 1.35) {
      const cfg = POWERUPS[p.kind];
      state.powerups[p.kind] = cfg.duration;
      state.score += SCORING.powerupPoints * state.combo;
      state.events.push({ type: 'powerup', kind: p.kind, label: cfg.label });
      state.pickups.splice(i, 1);
      continue;
    }
    if (p.z > 14) state.pickups.splice(i, 1);
  }
}

export function stepGame(state, rawDt) {
  const dt = Math.min(0.05, Math.max(0, rawDt));
  if (state.mode !== 'playing' || !state.alive) {
    return state.events;
  }

  updateDistrictAndSpeed(state, dt);
  updateRunnerPhysics(state, dt);

  const advance = state.currentSpeed * dt;
  state.nextWaveZ += advance;
  while (state.nextWaveZ > -142) {
    spawnNextWave(state);
  }

  updateObstaclesAndCollisions(state, dt);
  if (state.alive) {
    updateCollectiblesAndPickups(state, dt);
  }

  return state.events;
}

export function consumeEvents(state) {
  const out = state.events.slice();
  state.events.length = 0;
  return out;
}
