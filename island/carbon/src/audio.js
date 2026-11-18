// Procedural WebAudio soundscape: ocean surf, trade wind, seabirds, night crickets, and evolving cinema pad.
import { clamp, lerp, smoothstep, createRng } from './math.js';

const CHORD_PROGRESSION = [
  { t: 0, freqs: [174.61, 261.63, 329.63, 392.0] },   // Fmaj7 warm afternoon
  { t: 15, freqs: [138.59, 207.65, 277.18, 392.0] },  // Dbmaj7#11 sunset gold
  { t: 31, freqs: [155.56, 233.08, 311.13, 349.23] }, // Ebmaj9 sundown / beacon
  { t: 46, freqs: [130.81, 196.0, 293.66, 392.0] },   // Csus2/G starry ocean night
];

const BIRD_CALL_TIMES = [3.4, 8.9, 15.6, 22.1, 27.8];

function createPinkNoiseBuffer(ctx, seconds = 5) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const rng = createRng(998877);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = rng() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
      // Crossfade loop ends smoothly so loop seam is completely inaudible
      const edge = Math.min(i, length - 1 - i);
      const fade = Math.min(1, edge / (sampleRate * 0.15));
      data[i] = sample * fade + (fade < 1 ? sample * (1 - fade) * 0.5 : 0);
    }
  }
  return buffer;
}

export function createSoundscape() {
  let ctx = null;
  let masterGain = null;
  let surfLowFilter = null;
  let surfLowGain = null;
  let surfFoamGain = null;
  let windFilter = null;
  let windGain = null;
  let cricketGain = null;
  let padOscs = [];
  let padGain = null;
  let muted = false;
  let activePlaying = false;
  let lastTime = -1;
  let beaconChimePlayed = false;
  const triggeredBirds = new Set();

  function buildGraph() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();

    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);

    const noiseBuf = createPinkNoiseBuffer(ctx, 5);

    // 1. Deep ocean surf body
    const surfSrc = ctx.createBufferSource();
    surfSrc.buffer = noiseBuf;
    surfSrc.loop = true;
    surfLowFilter = ctx.createBiquadFilter();
    surfLowFilter.type = 'lowpass';
    surfLowFilter.frequency.value = 340;
    surfLowFilter.Q.value = 0.8;
    surfLowGain = ctx.createGain();
    surfLowGain.gain.value = 0.22;
    surfSrc.connect(surfLowFilter).connect(surfLowGain).connect(masterGain);
    surfSrc.start();

    // 2. Shoreline foam wash hiss
    const foamSrc = ctx.createBufferSource();
    foamSrc.buffer = noiseBuf;
    foamSrc.loop = true;
    foamSrc.loopStart = 0.7;
    const foamFilter = ctx.createBiquadFilter();
    foamFilter.type = 'bandpass';
    foamFilter.frequency.value = 1450;
    foamFilter.Q.value = 0.65;
    surfFoamGain = ctx.createGain();
    surfFoamGain.gain.value = 0.03;
    foamSrc.connect(foamFilter).connect(surfFoamGain).connect(masterGain);
    foamSrc.start();

    // 3. Trade wind through palm fronds
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 580;
    windFilter.Q.value = 2.2;
    windGain = ctx.createGain();
    windGain.gain.value = 0.04;
    windSrc.connect(windFilter).connect(windGain).connect(masterGain);
    windSrc.start();

    // 4. Gentle nocturnal island crickets (dusk to starry night)
    cricketGain = ctx.createGain();
    cricketGain.gain.value = 0.0;
    const cricketPulse = ctx.createGain();
    cricketPulse.gain.value = 0.5;
    const cLfo = ctx.createOscillator();
    cLfo.frequency.value = 3.6;
    cLfo.connect(cricketPulse.gain);
    cLfo.start();

    [3950, 4120].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(cricketPulse);
      osc.start();
    });
    cricketPulse.connect(cricketGain).connect(masterGain);

    // 5. Warm ambient pad with soft stereo echo
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 620;
    padGain = ctx.createGain();
    padGain.gain.value = 0.055;

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.38;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    delay.connect(fb).connect(delay);

    padFilter.connect(padGain).connect(masterGain);
    padGain.connect(delay);
    delay.connect(masterGain);

    padOscs = CHORD_PROGRESSION[0].freqs.map((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (idx - 1.5) * 4.5;
      const vGain = ctx.createGain();
      vGain.gain.value = idx === 0 ? 0.34 : 0.20;
      osc.connect(vGain).connect(padFilter);
      osc.start();
      return osc;
    });

    return true;
  }

  function triggerSeabirdCall() {
    if (!ctx || muted || !activePlaying) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1680, now);
    osc.frequency.exponentialRampToValueAtTime(2150, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.42);

    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 3.2;

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.022, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

    osc.connect(bp).connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  function triggerBeaconWarmShimmer() {
    if (!ctx || muted || !activePlaying) return;
    const now = ctx.currentTime;
    [523.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.08);
      g.gain.linearRampToValueAtTime(0.018 / (i + 1), now + i * 0.08 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      osc.connect(g).connect(masterGain);
      osc.start(now + i * 0.08);
      osc.stop(now + 2.9);
    });
  }

  function updateMasterEnvelope(t) {
    if (!ctx || !masterGain) return;
    const now = ctx.currentTime;
    if (!activePlaying || muted) {
      masterGain.gain.setTargetAtTime(0.0, now, 0.08);
      return;
    }
    const fadeIn = smoothstep(0.0, 0.9, t);
    const fadeOut = 1.0 - smoothstep(57.8, 60.0, t);
    masterGain.gain.setTargetAtTime(0.75 * fadeIn * fadeOut, now, 0.08);
  }

  return {
    unlock() {
      if (!ctx) buildGraph();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    },
    setPlaying(isPlaying, t = 0) {
      activePlaying = isPlaying;
      if (t < 1.0) {
        triggeredBirds.clear();
        beaconChimePlayed = false;
      }
      updateMasterEnvelope(t);
    },
    onSeek(t) {
      lastTime = t;
      triggeredBirds.forEach((bt) => {
        if (bt > t) triggeredBirds.delete(bt);
      });
      beaconChimePlayed = t >= 34.5;
      updateMasterEnvelope(t);
    },
    toggleMute() {
      muted = !muted;
      if (!muted) this.unlock();
      updateMasterEnvelope(Math.max(0, lastTime));
      return muted;
    },
    isMuted() {
      return muted;
    },
    update(t, atmo, cameraPos) {
      if (!ctx) return;
      const now = ctx.currentTime;
      updateMasterEnvelope(t);

      // Wave wash modulation synced with ocean rhythm & camera elevation
      const camAltFactor = clamp(1.0 - (cameraPos.y - 3.0) / 24.0, 0.35, 1.0);
      const swell = 0.5 + 0.5 * Math.sin(t * 0.85);
      const wash = 0.5 + 0.5 * Math.sin(t * 2.45 - 0.6);

      surfLowFilter.frequency.setTargetAtTime(lerp(240, 520, swell * camAltFactor), now, 0.1);
      surfLowGain.gain.setTargetAtTime(lerp(0.14, 0.30, swell) * camAltFactor, now, 0.1);
      surfFoamGain.gain.setTargetAtTime(lerp(0.012, 0.058, wash) * Math.pow(camAltFactor, 1.4), now, 0.08);

      // Palm trade wind modulation
      windFilter.frequency.setTargetAtTime(lerp(420, 760, atmo.windStrength), now, 0.12);
      windGain.gain.setTargetAtTime(0.025 + 0.032 * atmo.windStrength, now, 0.12);

      // Night crickets fade in after dusk
      const nightFactor = smoothstep(35.0, 44.0, t);
      cricketGain.gain.setTargetAtTime(nightFactor * 0.0085, now, 0.2);

      // Evolving ambient chord voicings
      let chord = CHORD_PROGRESSION[0];
      for (let i = CHORD_PROGRESSION.length - 1; i >= 0; i--) {
        if (t >= CHORD_PROGRESSION[i].t) {
          chord = CHORD_PROGRESSION[i];
          break;
        }
      }
      for (let i = 0; i < padOscs.length; i++) {
        padOscs[i].frequency.setTargetAtTime(chord.freqs[i], now, 0.9);
      }

      // One-shot cues during active forward playback
      if (activePlaying && lastTime >= 0 && t > lastTime && t - lastTime < 0.5) {
        for (let i = 0; i < BIRD_CALL_TIMES.length; i++) {
          const bt = BIRD_CALL_TIMES[i];
          if (lastTime < bt && t >= bt && !triggeredBirds.has(bt)) {
            triggeredBirds.add(bt);
            triggerSeabirdCall();
          }
        }
        if (lastTime < 34.4 && t >= 34.4 && !beaconChimePlayed) {
          beaconChimePlayed = true;
          triggerBeaconWarmShimmer();
        }
      }
      lastTime = t;
    },
  };
}
