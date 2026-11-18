// All sound is synthesised with WebAudio: wind, the train's rumble and rail
// roar, exhaust beats, rail joints, whistle, brake squeal, station chime, the
// tunnel's reverb and a quiet pad. Levels follow scene time and how close the
// camera is to the train; one-shot sounds fire as playback crosses their time.

import { mulberry32, clamp, smoothstep } from '../core/rng.js';
import { DURATION, SHOTS, TIMES, WHISTLES } from '../config.js';

const BEAT_METRES = 6.2; // exhaust beat
const JOINT_METRES = 25; // rail joints

function noiseBuffer(ctx, seconds, seed) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rnd = mulberry32(seed);
  for (let i = 0; i < data.length; i++) data[i] = rnd() * 2 - 1;
  return buffer;
}

function impulse(ctx, seconds, seed) {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const rnd = mulberry32(seed);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = (rnd() * 2 - 1) * Math.pow(1 - i / data.length, 2.6);
  }
  return buffer;
}

/** Looping filtered noise with its own gain; the building block of most layers. */
function noiseLayer(ctx, buffer, type, freq, q, out) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  src.start();
  return { filter, gain };
}

function buildGraph(ctx) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  wet.gain.value = 0;
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 2.2, 77);
  dry.connect(master);
  dry.connect(verb).connect(wet).connect(master);
  const noise = noiseBuffer(ctx, 3, 12345);
  const pad = ctx.createGain();
  pad.gain.value = 0;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 420;
  pad.connect(padFilter).connect(master);
  for (const [freq, detune] of [[73.42, -6], [110, 5], [146.83, 0], [174.61, -4]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(pad);
    osc.start();
  }
  const squeal = ctx.createOscillator();
  squeal.type = 'sine';
  squeal.frequency.value = 2300;
  const squealGain = ctx.createGain();
  squealGain.gain.value = 0;
  squeal.connect(squealGain).connect(dry);
  squeal.start();
  return {
    master, dry, wet, noise, pad, squeal, squealGain,
    wind: noiseLayer(ctx, noise, 'bandpass', 480, 0.6, master),
    rumble: noiseLayer(ctx, noise, 'lowpass', 110, 0.4, dry),
    roar: noiseLayer(ctx, noise, 'bandpass', 950, 0.5, dry),
    hiss: noiseLayer(ctx, noise, 'highpass', 2600, 0.3, dry),
  };
}

/** Short filtered noise burst (exhaust beat, rail joint, hiss). */
function burst(ctx, g, { type, freq, q, level, attack, decay, when = 0 }) {
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(level, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  src.connect(filter).connect(gain).connect(g.dry);
  src.start(t0, ((freq + level * 1000) % 7) / 3.5); // a different slice of noise per kind of burst
  src.stop(t0 + attack + decay + 0.05);
}

function tone(ctx, out, { type, freq, level, attack, hold, release, when = 0, vibrato = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  const t0 = ctx.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(level, t0 + attack);
  gain.gain.setValueAtTime(level, t0 + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + attack + hold + release + 0.1);
  }
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + attack + hold + release + 0.1);
}

function whistle(ctx, g, length, level) {
  for (const freq of [277.2, 329.6, 415.3]) {
    tone(ctx, g.dry, { type: 'triangle', freq, level: level * 0.11, attack: 0.07, hold: length, release: 0.6, vibrato: 2.5 });
    tone(ctx, g.dry, { type: 'sawtooth', freq: freq * 2.005, level: level * 0.018, attack: 0.1, hold: length, release: 0.5 });
  }
  burst(ctx, g, { type: 'bandpass', freq: 1800, q: 0.8, level: level * 0.05, attack: 0.05, decay: length + 0.5 });
}

function chime(ctx, g) {
  [659.3, 523.3, 392.0].forEach((freq, i) => {
    tone(ctx, g.master, { type: 'sine', freq, level: 0.09, attack: 0.01, hold: 0.05, release: 1.6, when: i * 0.42 });
    tone(ctx, g.master, { type: 'sine', freq: freq * 2.76, level: 0.02, attack: 0.01, hold: 0.02, release: 0.7, when: i * 0.42 });
  });
}

// One-shot cues on the timeline. `near` scales with how close the camera is.
const CUES = [
  ...WHISTLES.map((w) => ({ t: w.t, play: (ctx, g, near) => whistle(ctx, g, w.d, 0.35 + 0.65 * near) })),
  { t: TIMES.stop + 0.1, play: (ctx, g) => burst(ctx, g, { type: 'highpass', freq: 3200, q: 0.3, level: 0.2, attack: 0.08, decay: 2.6 }) },
  { t: TIMES.stop + 1.1, play: (ctx, g) => chime(ctx, g) },
  { t: TIMES.depart - 0.3, play: (ctx, g) => burst(ctx, g, { type: 'highpass', freq: 2400, q: 0.3, level: 0.16, attack: 0.3, decay: 3.2 }) },
];

const setParam = (ctx, param, value) => param.setTargetAtTime(value, ctx.currentTime, 0.06);

/** Continuous layers: levels are a pure function of the frame description. */
function mix(ctx, g, f, muted) {
  const { t, state } = f;
  const near = 1 / (1 + f.listenerDistance / 16);
  const speed = clamp(state.speed / 55, 0, 1);
  const bore = SHOTS[f.shot].id === 'tunnel' ? 1 : 0;
  const out = 1 - smoothstep(DURATION - 1.2, DURATION, t);
  setParam(ctx, g.master.gain, muted ? 0 : 0.9 * out * smoothstep(0, 0.6, t + 0.3));
  setParam(ctx, g.wind.gain.gain, 0.05 * (1 - 0.85 * bore) * (0.8 + 0.3 * Math.sin(t * 0.7)));
  setParam(ctx, g.wind.filter.frequency, 420 + 180 * Math.sin(t * 0.43) + 260 * speed * near);
  setParam(ctx, g.rumble.gain.gain, (0.025 + 0.78 * speed) * (0.25 + 1.3 * near) * (1 + 0.6 * bore));
  setParam(ctx, g.roar.gain.gain, 0.16 * speed * speed * (0.15 + 1.6 * near));
  setParam(ctx, g.roar.filter.frequency, 600 + 700 * speed);
  setParam(ctx, g.hiss.gain.gain, state.speed === 0 ? 0.005 + 0.011 * near : 0.008 * near);
  setParam(ctx, g.wet.gain, 0.12 + 0.75 * bore);
  const braking = smoothstep(TIMES.brake + 2.2, TIMES.brake + 3.4, t) * (1 - smoothstep(TIMES.stop - 0.5, TIMES.stop + 0.1, t));
  setParam(ctx, g.squealGain.gain, 0.022 * braking * (0.3 + near));
  setParam(ctx, g.squeal.frequency, 2500 - 700 * smoothstep(TIMES.brake, TIMES.stop, t) + 30 * Math.sin(t * 31));
  setParam(ctx, g.pad.gain, 0.012 + 0.03 * smoothstep(44, 56, t));
}

/** Exhaust beats and rail joints, triggered as the train crosses distance marks. */
function rhythm(ctx, g, f, from) {
  const { distance, speed } = f.state;
  if (speed <= 0 || distance <= from) return;
  const near = 1 / (1 + f.listenerDistance / 16);
  if (Math.floor(distance / BEAT_METRES) !== Math.floor(from / BEAT_METRES)) {
    const soft = 1 - 0.6 * clamp(speed / 55, 0, 1); // beats blur together at speed
    burst(ctx, g, { type: 'bandpass', freq: 240, q: 0.9, level: 0.5 * soft * (0.2 + near), attack: 0.012, decay: 0.16 });
  }
  if (Math.floor(distance / JOINT_METRES) !== Math.floor(from / JOINT_METRES)) {
    for (const when of [0, 4.4 / Math.max(speed, 4)]) {
      burst(ctx, g, { type: 'bandpass', freq: 1400, q: 1.6, level: 0.3 * near, attack: 0.003, decay: 0.07, when });
      tone(ctx, g.dry, { type: 'sine', freq: 82, level: 0.3 * near, attack: 0.004, hold: 0.01, release: 0.12, when });
    }
  }
}

/**
 * Create the audio engine. Nothing is created until start() runs inside a
 * user gesture. update(frame) is called once per rendered frame while playing.
 */
export function createAudio() {
  let ctx = null;
  let g = null;
  let muted = false;
  let lastTime = 0;
  let lastDistance = 0;

  return {
    start() {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor || ctx) return;
      ctx = new Ctor();
      g = buildGraph(ctx);
    },
    /** frame: { t, state, shot, listenerDistance } */
    update(f) {
      if (!ctx) return;
      mix(ctx, g, f, muted);
      const near = 1 / (1 + f.listenerDistance / 16);
      for (const cue of CUES) if (cue.t > lastTime && cue.t <= f.t) cue.play(ctx, g, near);
      rhythm(ctx, g, f, lastDistance);
      lastTime = f.t;
      lastDistance = f.state.distance;
    },
    /** Jump without firing the cues in between. */
    seek(t, distance) {
      lastTime = t;
      lastDistance = distance;
    },
    setRunning(running) {
      if (!ctx) return;
      if (running) ctx.resume();
      else ctx.suspend();
    },
    setMuted(value) {
      muted = value;
      if (ctx) g.master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
    },
    get muted() {
      return muted;
    },
    dispose() {
      if (ctx) ctx.close();
      ctx = null;
    },
  };
}
