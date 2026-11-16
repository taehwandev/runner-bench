// Mission game: the decisions, the propellant budget, scoring and the outcome.
// Pure logic with no DOM or renderer access. It watches the sequence snapshot, decides when a decision is due,
// and turns each chosen option into the plan the sequence and booster play back.
import { UNITS_TO_METERS, EARTH_RADIUS, TOUCHDOWN_TIME, LZ1_COORDS } from './sequence.js';
import { LEG_LOCK_SECONDS } from './booster.js';

export const PROPELLANT_BUDGET = 80;
const PAD_RADIUS_M = LZ1_COORDS.radius * UNITS_TO_METERS; // landing pad radius, metres
const TOUCHDOWN_SPEED_LIMIT = 6; // m/s; faster is a hard landing
const CHUTE_LIMIT = 45; // scene units (225 m); a canopy opened higher than this is shredded
const CHUTE_CEILING = 60; // altitude, scene units, at which the parachute decision comes up
const CROSSWIND = { t: 12, dx: 6, dz: -4 }; // steady drift from separation, scene units
const AUTOPILOT_DELAY = 1.6; // seconds a decision stays on screen before autopilot picks
const AUTOPILOT_RESTART = 6; // seconds a result stays up before autopilot flies again
const LANDING_BONUS = 300; // most points for landing on the pad centre
const FUEL_BONUS = 2; // points per unit of propellant left after a successful mission

const toMetres = (units) => Math.round(units * UNITS_TO_METERS);
const lockTime = (start) => (start + LEG_LOCK_SECONDS).toFixed(1);
const CROSSWIND_M = toMetres(Math.hypot(CROSSWIND.dx, CROSSWIND.dz));

// Each decision comes due once the flight reaches its trigger, in list order. A drift is applied at effectAt
// and ramps into the landing point, so the scene shows the consequence of the choice as it happens.
const DECISIONS = [
  {
    id: 'boostback',
    title: 'Boostback burn',
    prompt: `The crosswind is pushing the booster about ${CROSSWIND_M} m off line. Pick the burn that turns it back toward the pad.`,
    due: (s) => s.flight >= 14.5,
    effectAt: 16,
    options: [
      { id: 'full', label: 'Full boostback', detail: 'On schedule, no added drift.', cost: 14, score: 100, drift: [0, 0] },
      { id: 'aggressive', label: 'Aggressive burn', detail: 'Overshoots and adds about 15 m of drift.', cost: 19, score: 60, drift: [2.5, -1.5] },
      { id: 'conservative', label: 'Conservative burn', detail: 'Saves propellant, adds about 15 m of drift the other way.', cost: 11, score: 60, drift: [-2.5, 1.5] },
    ],
  },
  {
    id: 'steer',
    title: 'Glide steering',
    prompt: 'On the glide, grid fins and cold-gas thrusters can cancel the drift, at a propellant cost.',
    due: (s) => s.flight >= 22.5,
    effectAt: 23,
    options: [
      { id: 'full', label: 'Full correction', detail: 'Cancels 90% of the drift.', cost: 12, score: 100, correction: 0.9 },
      { id: 'partial', label: 'Partial correction', detail: 'Cancels half of the drift.', cost: 6, score: 70, correction: 0.5 },
      { id: 'coast', label: 'Coast', detail: 'No propellant; the drift stays.', cost: 0, score: 60, correction: 0 },
    ],
  },
  {
    id: 'landing',
    title: 'Landing burn',
    prompt: 'Light the landing burn. Propellant buys a gentler touchdown; skimping risks a hard landing.',
    due: (s) => s.flight >= 26.5,
    options: [
      { id: 'soft', label: 'Soft burn', detail: 'Touchdown at 1.2 m/s.', cost: 30, score: 75, set: { touchdownMps: 1.2 } },
      { id: 'ideal', label: 'Ideal burn', detail: 'Touchdown at 2.5 m/s.', cost: 22, score: 100, set: { touchdownMps: 2.5 } },
      { id: 'minimal', label: 'Minimal burn', detail: 'Touchdown at 7.5 m/s.', cost: 14, score: 0, set: { touchdownMps: 7.5 }, risk: 'Hard landing' },
    ],
  },
  {
    id: 'legs',
    title: 'Landing legs',
    prompt: `Deploy the landing legs. They take ${LEG_LOCK_SECONDS} s to lock and must be locked when the booster touches down at ${TOUCHDOWN_TIME} s.`,
    due: (s) => s.flight >= 29.5,
    options: [
      { id: 'early', label: 'Deploy at 30 s', detail: `Locks at ${lockTime(30)} s.`, cost: 0, score: 80, set: { legsStart: 30 } },
      { id: 'standard', label: 'Deploy at 31 s', detail: `Locks at ${lockTime(31)} s.`, cost: 0, score: 100, set: { legsStart: 31 } },
      { id: 'late', label: 'Deploy at 33.5 s', detail: `Locks at ${lockTime(33.5)} s, after touchdown.`, cost: 0, score: 0, set: { legsStart: 33.5 }, risk: 'Tip-over' },
    ],
  },
  {
    id: 'tli',
    title: 'Trans-lunar burn',
    prompt: 'Earth orbit is complete. Choose how hard the upper stage fires toward the Moon.',
    due: (s) => s.phase === 'orbit',
    options: [
      { id: 'full', label: 'Full burn', detail: 'Fastest transfer to the Moon.', cost: 30, score: 100, set: { tliBoost: 1.45 } },
      { id: 'economy', label: 'Economy burn', detail: 'Slower transfer, 14 less propellant.', cost: 16, score: 70, set: { tliBoost: 1.3 } },
    ],
  },
  {
    id: 'chutes',
    title: 'Parachute deployment',
    prompt: 'The capsule is coming down fast. Open the canopy at the right altitude.',
    due: (s) => s.phase === 'reentry' && altitudeUnits(s) <= CHUTE_CEILING,
    options: [
      { id: 'now', label: 'Deploy at 300 m', detail: 'Opens right away.', cost: 0, score: 0, set: { chuteAltitude: 60 }, risk: 'Canopy shredded', fatal: 'Canopy shredded: it opened at 300 m, above the 225 m limit' },
      { id: 'high', label: 'Deploy at 200 m', detail: 'Early; a slower, rougher descent.', cost: 0, score: 70, set: { chuteAltitude: 40 } },
      { id: 'ideal', label: 'Deploy at 150 m', detail: 'Textbook descent.', cost: 0, score: 100, set: { chuteAltitude: 30 } },
      { id: 'auto', label: 'Deploy at 120 m', detail: 'Automatic; a rough splashdown.', cost: 0, score: 60, set: { chuteAltitude: 24 } },
    ],
  },
];

function altitudeUnits(s) {
  const c = s.earth.center;
  return Math.hypot(s.position.x - c.x, s.position.y - c.y, s.position.z - c.z) - EARTH_RADIUS;
}

// Lateral error of the landing point from the pad centre, scene units.
function errorVector(drift) {
  return drift.reduce((e, d) => ({ x: e.x + d.dx, z: e.z + d.dz }), { x: 0, z: 0 });
}

function idleState() {
  return {
    begun: false,
    done: {},
    pending: null,
    autoTimer: 0,
    restartTimer: 0,
    fuel: PROPELLANT_BUDGET,
    decisionScore: 0,
    drift: [CROSSWIND],
    settings: {},
    log: [],
    landing: 0,
    boosterLost: false,
    landingChecked: false,
    outcome: null,
  };
}

export function createMissionGame() {
  let state = idleState();
  let autopilot = false;

  const isActive = () => state.begun && !state.outcome;
  const failed = () => Boolean(state.outcome && !state.outcome.success);

  function conclude(success, reason) {
    const breakdown = {
      decisions: state.decisionScore,
      landing: Math.round(state.landing),
      fuel: success ? FUEL_BONUS * state.fuel : 0,
    };
    state.pending = null;
    state.outcome = {
      success,
      title: success ? 'Mission success' : 'Mission failed',
      reason,
      breakdown,
      total: breakdown.decisions + breakdown.landing + breakdown.fuel,
    };
  }

  function lose(reason, boosterLost = false) {
    state.boosterLost = boosterLost;
    conclude(false, reason);
  }

  // Runs once the booster is on the ground: landing point, touchdown speed and legs decide whether it is kept.
  function checkLanding() {
    state.landingChecked = true;
    const e = errorVector(state.drift);
    const miss = Math.hypot(e.x, e.z) * UNITS_TO_METERS;
    const { touchdownMps, legsStart } = state.settings;
    if (miss > PAD_RADIUS_M) {
      lose(`Booster touched down ${Math.round(miss)} m from the centre of LZ-1; the pad reaches ${PAD_RADIUS_M} m.`, true);
    } else if (touchdownMps > TOUCHDOWN_SPEED_LIMIT) {
      lose(`Hard landing at ${touchdownMps} m/s; the limit is ${TOUCHDOWN_SPEED_LIMIT} m/s.`, true);
    } else if (legsStart + LEG_LOCK_SECONDS > TOUCHDOWN_TIME) {
      lose('The legs were not locked at touchdown, so the booster tipped over.', true);
    } else {
      state.landing = LANDING_BONUS * (1 - miss / PAD_RADIUS_M);
    }
  }

  // Autopilot: the highest-scoring option that still leaves propellant for the decisions that follow.
  function bestOption(decision) {
    const reserve = DECISIONS
      .filter((d) => d !== decision && !state.done[d.id])
      .reduce((sum, d) => sum + Math.min(...d.options.map((o) => o.cost)), 0);
    const usable = decision.options.filter((o) => !o.fatal && o.score > 0 && o.cost <= state.fuel);
    const affordable = usable.filter((o) => o.cost <= state.fuel - reserve);
    const pool = affordable.length ? affordable : usable;
    return pool.reduce((best, o) => (
      !best || o.score > best.score || (o.score === best.score && o.cost < best.cost) ? o : best
    ), null);
  }

  function applyOption(decision, option) {
    if (option.drift) state.drift.push({ t: decision.effectAt, dx: option.drift[0], dz: option.drift[1] });
    if (option.correction) {
      const e = errorVector(state.drift);
      state.drift.push({ t: decision.effectAt, dx: -option.correction * e.x, dz: -option.correction * e.z });
    }
    Object.assign(state.settings, option.set || {});
  }

  function choose(optionId) {
    const decision = state.pending;
    const option = decision && decision.options.find((o) => o.id === optionId);
    if (!option || option.cost > state.fuel) return false;
    state.pending = null;
    state.done[decision.id] = true;
    state.fuel -= option.cost;
    state.decisionScore += option.score;
    state.log.push({ title: decision.title, label: option.label, score: option.score, cost: option.cost });
    applyOption(decision, option);
    if (option.fatal) lose(option.fatal);
    return true;
  }

  function update(s, dt) {
    if (!state.begun) return;
    if (state.outcome) {
      if (autopilot) state.restartTimer += dt;
      return;
    }
    if (s.booster && s.booster.landed && !state.landingChecked) checkLanding();
    if (state.outcome) return;
    if (s.phase === 'departed') {
      conclude(true, 'Booster landed on LZ-1 and the capsule splashed down under canopy.');
      return;
    }
    if (state.pending) {
      if (!autopilot) return;
      state.autoTimer += dt;
      if (state.autoTimer < AUTOPILOT_DELAY) return;
      const pick = bestOption(state.pending);
      if (pick) choose(pick.id);
      else lose(`Out of propellant: ${state.pending.title}.`);
      return;
    }
    const next = DECISIONS.find((d) => !state.done[d.id]);
    if (!next || !next.due(s)) return;
    const cheapest = Math.min(...next.options.map((o) => o.cost));
    if (cheapest > state.fuel) {
      lose(`Out of propellant: ${next.title} needs at least ${cheapest} and ${state.fuel} is left.`);
      return;
    }
    state.pending = next;
    state.autoTimer = 0;
  }

  function view() {
    const pending = state.pending;
    return {
      begun: state.begun,
      active: isActive(),
      locked: isActive() || failed(),
      failed: failed(),
      fuel: state.fuel,
      budget: PROPELLANT_BUDGET,
      score: state.decisionScore,
      autopilot,
      restartIn: autopilot && state.outcome ? Math.max(0, AUTOPILOT_RESTART - state.restartTimer) : null,
      pending: pending && {
        id: pending.id,
        title: pending.title,
        prompt: pending.prompt,
        step: DECISIONS.indexOf(pending) + 1,
        total: DECISIONS.length,
        options: pending.options.map((o) => ({
          id: o.id,
          label: o.label,
          detail: o.detail,
          cost: o.cost,
          risk: o.risk ?? null,
          affordable: o.cost <= state.fuel,
        })),
      },
      outcome: state.outcome,
      log: state.log,
      boosterLost: state.boosterLost,
    };
  }

  // The plan the sequence reads. Null before the first mission, so free flight is untouched.
  function plan() {
    if (!state.begun) return null;
    return {
      drift: state.drift,
      legsStart: state.settings.legsStart,
      tliBoost: state.settings.tliBoost,
      chuteAltitude: state.settings.chuteAltitude,
      boosterFailed: state.boosterLost,
    };
  }

  return {
    begin() {
      state = idleState();
      state.begun = true;
    },
    reset() {
      state = idleState();
    },
    update,
    choose,
    plan,
    view,
    isActive,
    locked: () => isActive() || failed(),
    // The sim holds while a decision is open, and after a failure, so the scene stays where it went wrong.
    holdsSim: () => Boolean(state.pending) || failed(),
    autoRestartDue: () => autopilot && Boolean(state.outcome) && state.restartTimer >= AUTOPILOT_RESTART,
    toggleAutopilot() {
      autopilot = !autopilot;
      state.autoTimer = 0;
      return autopilot;
    },
  };
}
