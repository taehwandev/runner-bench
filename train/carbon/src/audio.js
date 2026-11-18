import { createRng } from "./rng.js";

function buildNoiseBuffer(ctx, seconds, seed) {
  const rng = createRng(seed);
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = rng.signed();
    last = (last + 0.045 * white) / 1.045;
    data[i] = last * 2.8 + white * 0.18;
  }
  return buffer;
}

function buildReverbImpulse(ctx, seconds, seed) {
  const rng = createRng(seed);
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const env = Math.pow(1 - i / length, 2.6);
      data[i] = rng.signed() * env * 0.5;
    }
  }
  return impulse;
}

function createLoopingNoise(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.start();
  return src;
}

export function createAudioEngine() {
  let ctx = null;
  let nodes = null;
  let lastClackIndex = -1;
  let hornDepartPlayed = false;
  let hornTunnelPlayed = false;
  let airReleasePlayed = false;

  function ensureGraph() {
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);

    const noiseBuf = buildNoiseBuffer(ctx, 4.0, 44100);
    const reverb = ctx.createConvolver();
    reverb.buffer = buildReverbImpulse(ctx, 2.2, 88200);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.28;
    reverb.connect(reverbGain);
    reverbGain.connect(master);

    // 1. Arctic blizzard wind layer
    const windSrc = createLoopingNoise(ctx, noiseBuf);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 1.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.14;
    windSrc.connect(windFilter).connect(windGain).connect(master);

    // 2. Heavy locomotive diesel-turbine rumble
    const engOscA = ctx.createOscillator();
    engOscA.type = "sawtooth";
    engOscA.frequency.value = 46;
    const engOscB = ctx.createOscillator();
    engOscB.type = "triangle";
    engOscB.frequency.value = 69;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = "lowpass";
    engFilter.frequency.value = 160;
    const engGain = ctx.createGain();
    engGain.gain.value = 0.12;
    engOscA.connect(engFilter);
    engOscB.connect(engFilter);
    engFilter.connect(engGain).connect(master);
    engFilter.connect(reverb);
    engOscA.start();
    engOscB.start();

    // 3. Steam hiss & rail rolling noise
    const steamSrc = createLoopingNoise(ctx, noiseBuf);
    const steamFilter = ctx.createBiquadFilter();
    steamFilter.type = "highpass";
    steamFilter.frequency.value = 1600;
    const steamGain = ctx.createGain();
    steamGain.gain.value = 0.03;
    steamSrc.connect(steamFilter).connect(steamGain).connect(master);

    // 4. Braking metallic harmonic
    const brakeOsc = ctx.createOscillator();
    brakeOsc.type = "sine";
    brakeOsc.frequency.value = 1480;
    const brakeGain = ctx.createGain();
    brakeGain.gain.value = 0.0;
    brakeOsc.connect(brakeGain).connect(reverb);
    brakeOsc.start();

    // 5. Restrained dark-ambient winter drone pad (D2 + A2)
    const padOsc1 = ctx.createOscillator();
    padOsc1.type = "sine";
    padOsc1.frequency.value = 73.42;
    const padOsc2 = ctx.createOscillator();
    padOsc2.type = "triangle";
    padOsc2.frequency.value = 110.0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 260;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.055;
    padOsc1.connect(padFilter);
    padOsc2.connect(padFilter);
    padFilter.connect(padGain).connect(master);
    padOsc1.start();
    padOsc2.start();

    nodes = {
      master,
      reverb,
      noiseBuf,
      windFilter,
      windGain,
      engOscA,
      engOscB,
      engFilter,
      engGain,
      steamGain,
      brakeOsc,
      brakeGain,
      padGain,
    };
    return true;
  }

  function triggerRailClack(speedNorm, inTunnel) {
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    for (const delay of [0, 0.085]) {
      const src = ctx.createBufferSource();
      src.buffer = nodes.noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = inTunnel ? 320 : 230;
      bp.Q.value = 3.2;
      const g = ctx.createGain();
      const peak = (0.045 + speedNorm * 0.065) * (inTunnel ? 1.45 : 1.0);
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(peak, now + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.075);
      src.connect(bp).connect(g).connect(nodes.master);
      if (inTunnel) g.connect(nodes.reverb);
      src.start(now + delay);
      src.stop(now + delay + 0.09);
    }
  }

  function triggerHorn(duration = 1.4, pitchScale = 1.0) {
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    const freqs = [146.83 * pitchScale, 220.0 * pitchScale, 261.63 * pitchScale];
    const hornBus = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 780;

    hornBus.gain.setValueAtTime(0.0001, now);
    hornBus.gain.linearRampToValueAtTime(0.085, now + 0.14);
    hornBus.gain.setValueAtTime(0.075, now + duration - 0.32);
    hornBus.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    hornBus.connect(lp);
    lp.connect(nodes.master);
    lp.connect(nodes.reverb);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, now);
      osc.connect(hornBus);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }
  }

  function triggerPneumaticRelease() {
    if (!ctx || !nodes) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = nodes.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = "bandpass";
    hp.frequency.value = 2600;
    hp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.075, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    src.connect(hp).connect(g).connect(nodes.master);
    src.start(now);
    src.stop(now + 0.8);
  }

  function resetCuesForTime(time, distance) {
    lastClackIndex = Math.floor(distance / 14.0);
    airReleasePlayed = time >= 30.0;
    hornDepartPlayed = time >= 33.9;
    hornTunnelPlayed = time >= 39.6;
  }

  return {
    unlockAndPlay(state) {
      if (!ensureGraph()) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      resetCuesForTime(state.time, state.exactDistance);
      nodes.master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.08);
    },
    pause() {
      if (!ctx || !nodes) return;
      nodes.master.gain.setTargetAtTime(0.0, ctx.currentTime, 0.04);
    },
    onSeek(state, playing) {
      if (!ctx || !nodes) return;
      resetCuesForTime(state.time, state.exactDistance);
      nodes.master.gain.setTargetAtTime(
        playing ? 0.85 : 0.0,
        ctx.currentTime,
        0.04
      );
    },
    update(state, playing) {
      if (!ctx || !nodes || !playing) return;
      const now = ctx.currentTime;
      const speedNorm = state.exactSpeed / 36.0;
      const inTunnel = state.train.inTunnel;

      // Wind rises on open bridge, muffles inside concrete tunnel
      const windFreq = inTunnel
        ? 180
        : 360 + Math.sin(state.time * 0.7) * 110 + (state.time > 46 ? 140 : 0);
      nodes.windFilter.frequency.setTargetAtTime(windFreq, now, 0.08);
      nodes.windGain.gain.setTargetAtTime(
        inTunnel ? 0.04 : 0.13 + (state.time > 46 ? 0.05 : 0),
        now,
        0.08
      );

      // Engine rumble scales with speed, idles deeply at station
      nodes.engOscA.frequency.setTargetAtTime(34 + speedNorm * 28, now, 0.06);
      nodes.engOscB.frequency.setTargetAtTime(51 + speedNorm * 42, now, 0.06);
      nodes.engFilter.frequency.setTargetAtTime(
        (inTunnel ? 260 : 120) + speedNorm * 160,
        now,
        0.06
      );
      nodes.engGain.gain.setTargetAtTime(
        (0.065 + speedNorm * 0.11) * (inTunnel ? 1.35 : 1.0),
        now,
        0.06
      );

      // Steam valve hiss peaks when standing at station
      const dwellHiss = state.train.atStation ? 0.065 : 0.018 + speedNorm * 0.025;
      nodes.steamGain.gain.setTargetAtTime(dwellHiss, now, 0.08);

      // Brake harmonic during 24..30s deceleration
      const brakeAmt =
        state.braking * Math.min(1.0, state.exactSpeed / 6.0) * 0.016;
      nodes.brakeGain.gain.setTargetAtTime(brakeAmt, now, 0.05);

      // Deterministic rail-joint clacks every 14m of track distance
      const clackIdx = Math.floor(state.exactDistance / 14.0);
      if (clackIdx > lastClackIndex && state.exactSpeed > 1.5) {
        lastClackIndex = clackIdx;
        triggerRailClack(speedNorm, inTunnel);
      }

      if (!airReleasePlayed && state.time >= 30.0 && state.time < 31.0) {
        airReleasePlayed = true;
        triggerPneumaticRelease();
      }
      if (!hornDepartPlayed && state.time >= 33.9 && state.time < 35.2) {
        hornDepartPlayed = true;
        triggerHorn(1.45, 1.0);
      }
      if (!hornTunnelPlayed && state.time >= 39.6 && state.time < 40.5) {
        hornTunnelPlayed = true;
        triggerHorn(0.95, 1.12);
      }
    },
  };
}
