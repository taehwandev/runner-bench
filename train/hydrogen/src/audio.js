import { clamp } from './prng.js';

export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let windFilter = null;
  let windGain = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineSub = null;
  let engineFilter = null;
  let engineGain = null;
  let noiseBuffer = null;

  let initialized = false;
  let lastJointIdx = -1;
  let lastTime = 0;

  function ensureInit() {
    if (initialized) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.0;
      masterGain.connect(ctx.destination);

      // Shared 2.5s deterministic white/pinkish noise buffer
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 2.5);
      noiseBuffer = ctx.createBuffer(1, len, sr);
      const data = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 0.35;
      }

      // 1. Arctic Wind
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = noiseBuffer;
      windSrc.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 340;
      windFilter.Q.value = 1.2;
      windGain = ctx.createGain();
      windGain.gain.value = 0.18;
      windSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(masterGain);
      windSrc.start();

      // 2. Heavy Diesel/Turbine Engine Drone
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 140;
      engineFilter.Q.value = 1.8;

      engineGain = ctx.createGain();
      engineGain.gain.value = 0.16;

      engineOsc1 = ctx.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 44;

      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'triangle';
      engineOsc2.frequency.value = 66;

      engineSub = ctx.createOscillator();
      engineSub.type = 'sine';
      engineSub.frequency.value = 33;

      const oscGain1 = ctx.createGain();
      oscGain1.gain.value = 0.35;
      const oscGain2 = ctx.createGain();
      oscGain2.gain.value = 0.35;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.45;

      engineOsc1.connect(oscGain1);
      engineOsc2.connect(oscGain2);
      engineSub.connect(subGain);
      oscGain1.connect(engineFilter);
      oscGain2.connect(engineFilter);
      subGain.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(masterGain);

      engineOsc1.start();
      engineOsc2.start();
      engineSub.start();

      initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  function triggerRailClack(speed, inTunnel) {
    if (!ctx || !noiseBuffer) return;
    const now = ctx.currentTime;
    const gapSec = clamp(0.095 * (28 / Math.max(8, speed)), 0.055, 0.18);

    for (let p = 0; p < 2; p++) {
      const t0 = now + p * gapSec;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = inTunnel ? 520 : 880;
      bp.Q.value = inTunnel ? 3.2 : 2.0;

      const g = ctx.createGain();
      const vol = clamp(0.06 + (speed / 40) * 0.12, 0.04, 0.2) * (inTunnel ? 1.45 : 1.0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (inTunnel ? 0.14 : 0.075));

      src.connect(bp);
      bp.connect(g);
      g.connect(masterGain);
      src.start(t0, Math.random() * 1.5, 0.18);

      // Low rail thud
      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(98, t0);
      thud.frequency.exponentialRampToValueAtTime(38, t0 + 0.06);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(vol * 0.75, t0);
      tg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
      thud.connect(tg);
      tg.connect(masterGain);
      thud.start(t0);
      thud.stop(t0 + 0.08);
    }
  }

  function triggerAirBrakeHiss() {
    if (!ctx || !noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400, now);
    hp.frequency.exponentialRampToValueAtTime(900, now + 0.9);
    hp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    src.connect(hp);
    hp.connect(g);
    g.connect(masterGain);
    src.start(now, 0.2, 1.0);
  }

  function triggerHorn(duration = 1.6) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [146.83, 185.0, 220.0]; // heavy moody D-minor/power chord horn
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 680;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.13, now + 0.14);
    g.gain.setValueAtTime(0.12, now + duration * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(g);
    g.connect(masterGain);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 0.985, now);
      osc.frequency.linearRampToValueAtTime(f, now + 0.16);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }
  }

  function unlockAndPlay() {
    if (!ensureInit()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    masterGain.gain.setTargetAtTime(0.75, ctx.currentTime, 0.08);
  }

  function setPlaying(playing) {
    if (!initialized || !ctx) return;
    if (playing && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const target = playing ? 0.75 : 0.0;
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  }

  function syncSeek(timeSec, trainState) {
    lastTime = timeSec;
    lastJointIdx = Math.floor(trainState.distance / 14.0);
  }

  function update(timeSec, trainState, playing) {
    if (!initialized || !ctx || !playing) {
      lastTime = timeSec;
      lastJointIdx = Math.floor(trainState.distance / 14.0);
      return;
    }

    const now = ctx.currentTime;
    const spdNorm = clamp(trainState.speed / 40.0, 0, 1);

    // Wind modulation (louder on open bridge, muffled in tunnel)
    const bridgeBoost = timeSec > 46 ? 1.35 : 1.0;
    const tunnelMuffle = trainState.inTunnel ? 0.35 : 1.0;
    const windFreq = 260 + 180 * Math.sin(timeSec * 0.7) + 120 * spdNorm;
    windFilter.frequency.setTargetAtTime(windFreq * (trainState.inTunnel ? 0.65 : 1.0), now, 0.08);
    windGain.gain.setTargetAtTime((0.12 + 0.1 * spdNorm) * bridgeBoost * tunnelMuffle, now, 0.08);

    // Engine turbine rumble modulation
    const baseFreq = 36 + spdNorm * 28;
    engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.06);
    engineSub.frequency.setTargetAtTime(baseFreq * 0.75, now, 0.06);
    engineFilter.frequency.setTargetAtTime(95 + spdNorm * 280 + (trainState.inTunnel ? 110 : 0), now, 0.06);
    engineGain.gain.setTargetAtTime(0.1 + spdNorm * 0.14 + (trainState.inTunnel ? 0.06 : 0), now, 0.06);

    // Distance-based rail clacks
    const jointIdx = Math.floor(trainState.distance / 14.0);
    if (jointIdx > lastJointIdx && trainState.speed > 1.0) {
      triggerRailClack(trainState.speed, trainState.inTunnel);
    }
    lastJointIdx = jointIdx;

    // One-shot timetable cues
    if (lastTime < 29.7 && timeSec >= 29.7) triggerAirBrakeHiss();
    if (lastTime < 34.05 && timeSec >= 34.05) triggerHorn(1.65);
    if (lastTime < 46.15 && timeSec >= 46.15) triggerHorn(1.35);
    lastTime = timeSec;
  }

  return {
    unlockAndPlay,
    setPlaying,
    syncSeek,
    update,
  };
}
