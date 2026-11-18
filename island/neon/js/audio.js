// Procedural WebAudio soundscape synchronized to the 60-second island time-lapse
import { clamp, smoothstep, lerp } from './prng.js';

export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let surfGain = null;
  let surfFilter = null;
  let breezeGain = null;
  let cricketGain = null;
  let padGain = null;
  let padOscs = [];
  let padFilter = null;
  let muted = false;
  let active = false;
  let lastGullBucket = -1;
  let lastChimeTriggered = false;

  // Deterministic pink-ish noise buffer
  function createNoiseBuffer(audioCtx, seconds = 4) {
    const length = audioCtx.sampleRate * seconds;
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let seed = 1234567;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  function ensureInit() {
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);

    const noiseBuf = createNoiseBuffer(ctx, 5);

    // 1. Ocean surf layer (low-pass filtered pink noise)
    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = noiseBuf;
    surfSrc.loop = true;
    surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.value = 420;
    surfFilter.Q.value = 0.7;
    surfGain = ctx.createGain();
    surfGain.gain.value = 0.32;
    surfSrc.connect(surfFilter);
    surfFilter.connect(surfGain);
    surfGain.connect(masterGain);
    surfSrc.start();

    // 2. Tropical palm breeze layer (gentle bandpass noise)
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = noiseBuf;
    breezeSrc.loop = true;
    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.value = 780;
    breezeFilter.Q.value = 1.6;
    breezeGain = ctx.createGain();
    breezeGain.gain.value = 0.06;
    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(masterGain);
    breezeSrc.start();

    // 3. Night crickets / dusk chorus (high-frequency subtle pulse)
    const cricketOsc = ctx.createOscillator();
    cricketOsc.type = 'sine';
    cricketOsc.frequency.value = 4180;
    const cricketLfo = ctx.createOscillator();
    cricketLfo.type = 'sine';
    cricketLfo.frequency.value = 5.5;
    const cricketLfoGain = ctx.createGain();
    cricketLfoGain.gain.value = 0.5;
    const cricketModGain = ctx.createGain();
    cricketModGain.gain.value = 0.5;
    cricketLfo.connect(cricketLfoGain);
    cricketLfoGain.connect(cricketModGain.gain);
    cricketGain = ctx.createGain();
    cricketGain.gain.value = 0.0;
    cricketOsc.connect(cricketModGain);
    cricketModGain.connect(cricketGain);
    cricketGain.connect(masterGain);
    cricketOsc.start();
    cricketLfo.start();

    // 4. Evolving cinematic ambient synth pad (4 warm detuned voices)
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 560;
    padFilter.Q.value = 0.8;
    padGain = ctx.createGain();
    padGain.gain.value = 0.09;
    padFilter.connect(padGain);
    padGain.connect(masterGain);

    // Warm D-major9 -> D-add9 -> D-minor9 voicing evolution
    const baseFreqs = [146.83, 220.0, 293.66, 369.99];
    padOscs = baseFreqs.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4.5;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.34 : 0.22;
      osc.connect(g);
      g.connect(padFilter);
      osc.start();
      return osc;
    });

    return true;
  }

  function triggerDistantGull() {
    if (!ctx || muted || !active) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(1920, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(1280, now + 0.42);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.018, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  function triggerDuskBeaconChime() {
    if (!ctx || muted || !active) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110.0, now); // warm distant maritime low horn/bell
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.045, now + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 3.4);
  }

  function setPlaying(isPlaying) {
    active = isPlaying;
    if (isPlaying) {
      if (!ensureInit()) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
    if (ctx && masterGain) {
      const target = active && !muted ? 0.85 : 0.0001;
      masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.18);
    }
  }

  function setMuted(isMuted) {
    muted = isMuted;
    if (ctx && masterGain) {
      const target = active && !muted ? 0.85 : 0.0001;
      masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    }
  }

  function isMuted() {
    return muted;
  }

  function resetTriggers() {
    lastGullBucket = -1;
    lastChimeTriggered = false;
  }

  function update(t, shotIdx) {
    if (!ctx || !active) return;
    const now = ctx.currentTime;
    const ct = clamp(t, 0, 60);

    // Surf swells gently, louder & brighter during the low beach pass (Shot 3)
    const waveLfo = 0.5 + 0.5 * Math.sin(ct * 0.92);
    const beachBoost = shotIdx === 2 ? 1.45 : shotIdx === 0 ? 1.15 : 0.85;
    surfGain.gain.setTargetAtTime((0.24 + waveLfo * 0.16) * beachBoost, now, 0.12);
    surfFilter.frequency.setTargetAtTime(320 + waveLfo * 340 + (shotIdx === 2 ? 220 : 0), now, 0.12);

    // Gentle breeze
    const breeze = 0.045 + 0.025 * Math.sin(ct * 0.43 + 1.1);
    breezeGain.gain.setTargetAtTime(breeze, now, 0.2);

    // Night crickets fade in after dusk
    const night = smoothstep(35.0, 48.0, ct);
    cricketGain.gain.setTargetAtTime(night * 0.014, now, 0.25);

    // Evolving cinematic pad harmony (major -> suspended -> serene night minor/open fifth)
    if (padOscs.length === 4) {
      const thirdFreq = lerp(369.99, 329.63, smoothstep(24.0, 44.0, ct)); // F#4 -> E4 (warm sus2/open night)
      padOscs[3].frequency.setTargetAtTime(thirdFreq, now, 0.35);
      padFilter.frequency.setTargetAtTime(lerp(640, 380, night), now, 0.3);
      // Gentle swell in at start, graceful fade at end
      const env = smoothstep(0, 2.5, ct) * (1.0 - smoothstep(56.5, 60.0, ct));
      padGain.gain.setTargetAtTime(0.085 * env, now, 0.2);
    }

    // Occasional distant gull calls during late afternoon / early golden hour
    if (ct > 2.5 && ct < 24.0) {
      const bucket = Math.floor(ct / 7.5);
      if (bucket !== lastGullBucket) {
        lastGullBucket = bucket;
        triggerDistantGull();
      }
    }

    // Soft warm maritime horn/chime right as the lighthouse ignites at dusk
    if (ct >= 32.0 && ct < 34.0 && !lastChimeTriggered) {
      lastChimeTriggered = true;
      triggerDuskBeaconChime();
    } else if (ct < 31.0) {
      lastChimeTriggered = false;
    }
  }

  return {
    setPlaying,
    setMuted,
    isMuted,
    resetTriggers,
    update,
  };
}
