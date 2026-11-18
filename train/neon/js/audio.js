import { createPRNG, clamp, lerp } from './prng.js';

/**
 * 100% procedural WebAudio cinematic soundscape (zero external audio files).
 * Layers:
 *  - Freezing dusk arctic wind (modulated bandpass pink noise)
 *  - Heavy armored locomotive sub-bass engine & traction rumble
 *  - Speed-synced metallic rail-joint clacks (stops cleanly at t=30..34)
 *  - Air-brake hiss (24-30s) & station idle steam hiss (30-34s)
 *  - Claustrophobic tunnel air-resonance roar (40-46s)
 *  - Haunting low dual-tone train horn on departure (34.2s) & bridge emergence (46.0s)
 *  - Sparse cinematic dark-ambient string/pad drone
 */
export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let windGain = null;
  let windFilter = null;
  let rumbleGain = null;
  let rumbleOsc1 = null;
  let rumbleOsc2 = null;
  let rumbleFilter = null;
  let steamGain = null;
  let steamFilter = null;
  let tunnelGain = null;
  let tunnelFilter = null;
  let padGain = null;
  let padFilter = null;
  let noiseBuffer = null;

  let initialized = false;
  let muted = false;
  let lastClackIndex = -1;
  let lastHornKey = '';

  function buildNoiseBuffer(audioCtx) {
    const sampleRate = audioCtx.sampleRate;
    const len = sampleRate * 4;
    const buf = audioCtx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    const rand = createPRNG(0x40D10A01);

    // Pink-ish noise via Paul Kellet filter for warm natural wind/steam/rumble
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = rand() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.055;
      b6 = white * 0.115926;
    }
    return buf;
  }

  function makeLoopingNoise(audioCtx) {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function init() {
    if (initialized) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    try {
      ctx = new AudioCtx();
    } catch {
      return false;
    }

    noiseBuffer = buildNoiseBuffer(ctx);

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);

    // 1. Arctic dusk wind
    const windSrc = makeLoopingNoise(ctx);
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 2.4;
    windGain = ctx.createGain();
    windGain.gain.value = 0.25;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSrc.start();

    // 2. Armored engine sub-bass rumble
    rumbleOsc1 = ctx.createOscillator();
    rumbleOsc1.type = 'sawtooth';
    rumbleOsc1.frequency.value = 44;

    rumbleOsc2 = ctx.createOscillator();
    rumbleOsc2.type = 'triangle';
    rumbleOsc2.frequency.value = 66.2;

    rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 115;
    rumbleFilter.Q.value = 2.2;

    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.0;

    rumbleOsc1.connect(rumbleFilter);
    rumbleOsc2.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    rumbleOsc1.start();
    rumbleOsc2.start();

    // 3. Brake air-hiss & steam vents
    const steamSrc = makeLoopingNoise(ctx);
    steamFilter = ctx.createBiquadFilter();
    steamFilter.type = 'highpass';
    steamFilter.frequency.value = 1400;
    steamGain = ctx.createGain();
    steamGain.gain.value = 0.0;
    steamSrc.connect(steamFilter);
    steamFilter.connect(steamGain);
    steamGain.connect(masterGain);
    steamSrc.start();

    // 4. Tunnel enclosed resonance roar
    const tunnelSrc = makeLoopingNoise(ctx);
    tunnelFilter = ctx.createBiquadFilter();
    tunnelFilter.type = 'bandpass';
    tunnelFilter.frequency.value = 195;
    tunnelFilter.Q.value = 3.2;
    tunnelGain = ctx.createGain();
    tunnelGain.gain.value = 0.0;
    tunnelSrc.connect(tunnelFilter);
    tunnelFilter.connect(tunnelGain);
    tunnelGain.connect(masterGain);
    tunnelSrc.start();

    // 5. Atmospheric frozen minor-9th dusk-to-night cinematic pad (D2, A2, F3, E4)
    const padNotes = [73.42, 110.0, 174.61, 329.63];
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 460;
    padFilter.Q.value = 0.8;

    padGain = ctx.createGain();
    padGain.gain.value = 0.08;

    for (let i = 0; i < padNotes.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'sine';
      osc.frequency.value = padNotes[i];
      osc.detune.value = (i - 1.5) * 4.5;
      const g = ctx.createGain();
      g.gain.value = i < 2 ? 0.14 : 0.07;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
    }
    padFilter.connect(padGain);
    padGain.connect(masterGain);

    initialized = true;
    return true;
  }

  function triggerRailClack(speedNorm, inTunnel) {
    if (!ctx || !noiseBuffer || muted) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = inTunnel ? 320 : 520;
    filter.Q.value = inTunnel ? 4.2 : 2.6;

    const g = ctx.createGain();
    const peak = (0.14 + speedNorm * 0.24) * (inTunnel ? 1.35 : 1.0);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

    src.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    src.start(now, (lastClackIndex % 7) * 0.35, 0.11);
  }

  function triggerHorn(durationSec = 2.1, gainLevel = 0.12) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // Deep armored diesel-electric chord (D3 + F#3 + A3 slightly detuned for haunting brass warmth)
    const freqs = [146.83, 185.0, 220.0];
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.setValueAtTime(640, now);
    hornFilter.frequency.exponentialRampToValueAtTime(340, now + durationSec);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gainLevel, now + 0.28);
    env.gain.setValueAtTime(gainLevel * 0.85, now + durationSec * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    hornFilter.connect(env);
    env.connect(masterGain);

    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i], now);
      osc.detune.value = (i - 1) * 6;
      const og = ctx.createGain();
      og.gain.value = i === 0 ? 0.45 : 0.28;
      osc.connect(og);
      og.connect(hornFilter);
      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    }
  }

  function resume() {
    if (!init()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function pause() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(0.0001, now, 0.06);
  }

  function setMuted(nextMuted) {
    muted = !!nextMuted;
    if (ctx && masterGain) {
      const now = ctx.currentTime;
      masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.72, now, 0.05);
    }
  }

  function isMuted() {
    return muted;
  }

  function resetTriggers() {
    lastClackIndex = -1;
    lastHornKey = '';
  }

  function update(t, trainState, playing) {
    if (!initialized || !ctx) return;
    const now = ctx.currentTime;

    // Fade master in when playing & unmuted, fade out gracefully at t=58.5..60
    const endFade = t > 58.2 ? clamp((60.0 - t) / 1.8, 0, 1) : 1.0;
    const targetMaster = playing && !muted ? 0.72 * endFade : 0.0001;
    masterGain.gain.setTargetAtTime(targetMaster, now, 0.07);

    if (!playing || muted) return;

    const speedNorm = clamp(trainState.speed / 44.0, 0, 1);
    const inTunnel = trainState.inTunnel;
    const onBridge = t >= 46.0;

    // Wind sweeps wider on the exposed frozen bridge and muffles inside the concrete tunnel
    const windMod = 0.5 + 0.5 * Math.sin(t * 0.42) * Math.cos(t * 0.19);
    const windFreq = inTunnel ? 180 : lerp(290, 560, windMod) + (onBridge ? 110 : 0);
    const windAmp = inTunnel ? 0.07 : (onBridge ? 0.36 : 0.24) * (0.85 + 0.3 * windMod);
    windFilter.frequency.setTargetAtTime(windFreq, now, 0.12);
    windGain.gain.setTargetAtTime(windAmp, now, 0.12);

    // Armored locomotive engine rumble
    const basePitch = 36 + speedNorm * 28 + trainState.throttle * 6;
    rumbleOsc1.frequency.setTargetAtTime(basePitch, now, 0.08);
    rumbleOsc2.frequency.setTargetAtTime(basePitch * 1.505, now, 0.08);
    rumbleFilter.frequency.setTargetAtTime(inTunnel ? 195 : 85 + speedNorm * 110, now, 0.08);
    rumbleGain.gain.setTargetAtTime(
      trainState.atStation ? 0.045 : (0.09 + speedNorm * 0.16) * (inTunnel ? 1.35 : 1.0),
      now,
      0.08
    );

    // Air-brake hiss (24-30s) & station steam hiss (30-35.5s)
    let steamAmp = 0.015;
    if (t >= 24.5 && t < 30.2) {
      steamAmp = 0.06 + trainState.braking * 0.16;
    } else if (t >= 30.2 && t <= 34.0) {
      steamAmp = 0.045;
    } else if (t > 34.0 && t < 36.8) {
      steamAmp = lerp(0.14, 0.02, (t - 34.0) / 2.8);
    }
    steamGain.gain.setTargetAtTime(steamAmp, now, 0.1);
    steamFilter.frequency.setTargetAtTime(trainState.braking > 0.2 ? 1900 : 1250, now, 0.1);

    // Claustrophobic tunnel echo roar (40-46s)
    tunnelGain.gain.setTargetAtTime(inTunnel ? 0.34 : 0.0001, now, 0.08);
    tunnelFilter.frequency.setTargetAtTime(175 + Math.sin(t * 9.0) * 32, now, 0.06);

    // Cinematic dusk pad swells warmly during station & bridge finale
    const padTarget = trainState.atStation ? 0.11 : onBridge ? 0.14 : inTunnel ? 0.04 : 0.085;
    padGain.gain.setTargetAtTime(padTarget, now, 0.25);
    padFilter.frequency.setTargetAtTime(onBridge ? 620 : inTunnel ? 240 : 420, now, 0.25);

    // Speed-synced rhythmic rail-joint clacks (every 12.9m car pitch along rails)
    if (trainState.speed > 1.5) {
      const clackIdx = Math.floor(trainState.distance / 12.9);
      if (clackIdx !== lastClackIndex) {
        lastClackIndex = clackIdx;
        triggerRailClack(speedNorm, inTunnel);
      }
    }

    // Iconic train horn cues: departure from Frost Terminal (34.1s) and bridge emergence (46.05s)
    if (t >= 34.05 && t < 34.5 && lastHornKey !== 'depart') {
      lastHornKey = 'depart';
      triggerHorn(2.2, 0.11);
    } else if (t >= 46.0 && t < 46.5 && lastHornKey !== 'bridge') {
      lastHornKey = 'bridge';
      triggerHorn(2.6, 0.13);
    } else if (t < 33.0) {
      lastHornKey = '';
    }
  }

  return {
    resume,
    pause,
    setMuted,
    isMuted,
    resetTriggers,
    update
  };
}
