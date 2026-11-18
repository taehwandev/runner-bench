import { clamp, lerp, mulberry32, smoothstep } from './prng.js';

export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let surfFilter = null;
  let surfGain = null;
  let breezeGain = null;
  let padFilter = null;
  let padGain = null;
  let oscs = [];
  let initialized = false;
  let duskChimeTriggered = false;

  function init() {
    if (initialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);

    // Deterministic 4-second pink-ish noise buffer
    const sr = ctx.sampleRate;
    const len = sr * 4;
    const buffer = ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    const rng = mulberry32(44100);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = rng() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = clamp((b0 + b1 + b2 + white * 0.04) * 1.4, -1, 1);
    }

    // 1. Ocean surf
    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = buffer;
    surfSrc.loop = true;
    surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 340;
    surfFilter.Q.value = 0.7;
    surfGain = ctx.createGain();
    surfGain.gain.value = 0.22;
    surfSrc.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(masterGain);
    surfSrc.start();

    // 2. Tropical breeze
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = buffer;
    breezeSrc.loop = true;
    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 680;
    breezeFilter.Q.value = 1.4;
    breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.045;
    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterGain);
    breezeSrc.start();

    // 3. Evolving warm ambient pad (4 voices)
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 520;
    padFilter.Q.value = 0.6;
    padGain = ctx.createGain();
    padGain.gain.value = 0.09;
    padFilter.connect(padGain);
    padGain.connect(masterGain);

    const baseFreqs = [130.81, 196.00, 246.94, 329.63]; // C3, G3, B3, E4
    for (let i = 0; i < baseFreqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = baseFreqs[i];
      osc.detune.value = (i - 1.5) * 4;
      const vGain = ctx.createGain();
      vGain.gain.value = i === 0 ? 0.45 : 0.24;
      osc.connect(vGain);
      vGain.connect(padFilter);
      osc.start();
      oscs.push(osc);
    }

    initialized = true;
  }

  function triggerDuskChime() {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 3.4);
  }

  function update(t, playing) {
    if (!initialized || !ctx) return;

    const now = ctx.currentTime;
    if (!playing) {
      masterGain.gain.setTargetAtTime(0.0, now, 0.08);
      return;
    }

    // Fade in at start, fade out smoothly at 58..60s
    const fadeIn = smoothstep(0.0, 1.5, t);
    const fadeOut = 1.0 - smoothstep(57.8, 60.0, t);
    masterGain.gain.setTargetAtTime(0.75 * fadeIn * fadeOut, now, 0.08);

    // Wave surf swell LFO
    const waveSwell = 0.5 + 0.5 * Math.sin(t * 1.05);
    const beachBoost = smoothstep(22, 27, t) * (1.0 - smoothstep(34, 38, t));
    surfFilter.frequency.setTargetAtTime(240 + waveSwell * 240 + beachBoost * 160, now, 0.1);
    surfGain.gain.setTargetAtTime(0.16 + waveSwell * 0.09 + beachBoost * 0.08, now, 0.1);

    breezeGain.gain.setTargetAtTime(0.035 + 0.02 * Math.sin(t * 0.42), now, 0.12);

    // Evolve pad harmony from warm afternoon -> sunset -> starry night
    const nightMix = smoothstep(26, 46, t);
    const targetFreqs = [
      lerp(130.81, 110.00, nightMix), // C3 -> A2
      lerp(196.00, 164.81, nightMix), // G3 -> E3
      lerp(246.94, 220.00, nightMix), // B3 -> A3
      lerp(329.63, 293.66, nightMix)  // E4 -> D4
    ];
    for (let i = 0; i < oscs.length; i++) {
      oscs[i].frequency.setTargetAtTime(targetFreqs[i], now, 0.35);
    }
    padFilter.frequency.setTargetAtTime(lerp(560, 340, nightMix), now, 0.25);

    if (t >= 27.5 && t <= 29.0 && !duskChimeTriggered) {
      duskChimeTriggered = true;
      triggerDuskChime();
    } else if (t < 26.0) {
      duskChimeTriggered = false;
    }
  }

  function start() {
    init();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    duskChimeTriggered = false;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function pause() {
    if (ctx && masterGain) {
      masterGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.06);
    }
  }

  return { start, resume, pause, update };
}
