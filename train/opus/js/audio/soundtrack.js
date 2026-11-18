// Fully synthesized sound: wheel rumble and rail joints, wind, brake squeal,
// steam hiss, horns, a platform chime and a slow pad score. Continuous layers
// follow t every frame; one-shot cues come from a pure event list and are
// scheduled a little ahead on the audio clock.

import { trainDistance, trainSpeed, UNIT_OFFSETS } from '../core/kinematics.js';
import { mulberry32 } from '../core/rng.js';

const JOINT = 24;   // rail joint spacing (m)
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

// Axles of the locomotive and first car, as offsets from the nose (m).
const AXLES = UNIT_OFFSETS.slice(0, 2).flatMap((u) => {
  const inset = Math.min(2.6, u.length * 0.2);
  return [u.front + inset - 0.95, u.front + inset + 0.95, u.rear - inset - 0.95, u.rear - inset + 0.95];
});

const CUES = [
  { t: 1.6, type: 'horn', dur: 2.2, far: true },
  { t: 30.7, type: 'chime' },
  { t: 33.65, type: 'horn', dur: 0.4 },
  { t: 34.25, type: 'horn', dur: 1.3 },
  { t: 41.7, type: 'horn', dur: 1.6 },
  { t: 56.4, type: 'horn', dur: 2.6, far: true },
];

// Chord roots for the pad, in Hz (three voices each).
const CHORDS = [
  { t: 0, f: [110, 164.81, 261.63] },     // A minor colour
  { t: 22, f: [87.31, 130.81, 220] },     // F
  { t: 31, f: [98, 146.83, 246.94] },     // G
  { t: 36, f: [73.42, 146.83, 174.61] },  // D minor
  { t: 40, f: [82.41, 123.47, 207.65] },  // E (tension in the tunnel)
  { t: 46, f: [110, 164.81, 261.63] },    // A minor resolves on the bridge
  { t: 52, f: [130.81, 196, 329.63] },    // C lift into the night
];

function crossingTime(a, k, t0, t1) {
  let lo = t0, hi = t1;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (trainDistance(mid) - a >= k * JOINT) hi = mid; else lo = mid;
  }
  return hi;
}

// Pure: every one-shot sound whose start time lies in [t0, t1).
export function eventsBetween(t0, t1) {
  const out = CUES.filter((c) => c.t >= t0 && c.t < t1).map((c) => ({ ...c }));
  for (const a of AXLES) {
    const k0 = Math.floor((trainDistance(t0) - a) / JOINT);
    const k1 = Math.floor((trainDistance(t1) - a) / JOINT);
    for (let k = k0 + 1; k <= k1; k++) {
      const t = crossingTime(a, k, t0, t1);
      out.push({ t, type: 'clack', speed: trainSpeed(t) });
    }
  }
  for (let b = Math.ceil(t0 / 0.75) * 0.75; b < t1; b += 0.75) {      // heartbeat pulse 34–46 s
    if (b >= 34 && b < 46) out.push({ t: b, type: 'kick', level: 0.5 + 0.5 * smooth(34, 44, b) });
  }
  return out.sort((x, y) => x.t - y.t);
}

function noiseBuffer(ctx, seconds, brown) {
  const rng = mulberry32(brown ? 99 : 98);
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = rng() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
  }
  return buf;
}

function impulse(ctx, seconds) {
  const rng = mulberry32(5);
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (rng() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  return buf;
}

function clackBuffer(ctx) {
  const rng = mulberry32(7);
  const len = Math.floor(ctx.sampleRate * 0.14);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    lp += 0.35 * ((rng() * 2 - 1) - lp);
    d[i] = lp * Math.exp(-t * 70) * 0.9 + Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 32) * 0.8;
  }
  return buf;
}

export function createSoundtrack() {
  let ctx = null;
  let G = null;            // graph nodes
  let scheduledUntil = 0;
  let active = [];
  let muted = false;
  let chordIndex = -1;

  function loop(buf, dest) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true; s.connect(dest); s.start();
    return s;
  }
  function filter(type, f, q = 0.7) {
    const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n;
  }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = gain(muted ? 0 : 0.9);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2);
    const wet = gain(0.32);
    reverb.connect(wet).connect(master);
    const white = noiseBuffer(ctx, 4, false);
    const brown = noiseBuffer(ctx, 4, true);

    const rumbleF = filter('lowpass', 140);
    const rumble = gain();
    loop(brown, rumbleF); rumbleF.connect(rumble).connect(master);
    const hissF = filter('bandpass', 3200, 0.8);
    const railHiss = gain();
    loop(white, hissF); hissF.connect(railHiss).connect(master);
    const windF = filter('bandpass', 520, 0.6);
    const wind = gain();
    loop(white, windF); windF.connect(wind); wind.connect(master); wind.connect(reverb);
    const steamF = filter('highpass', 2400, 0.5);
    const steam = gain();
    loop(white, steamF); steamF.connect(steam); steam.connect(master); steam.connect(reverb);

    const squeal = gain();
    const sqF = filter('bandpass', 2600, 6);
    for (const f of [2410, 3620]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      const lg = gain(f * 0.004); lfo.connect(lg).connect(o.frequency); lfo.start();
      o.connect(sqF); o.start();
    }
    sqF.connect(squeal); squeal.connect(master); squeal.connect(reverb);

    const padF = filter('lowpass', 900, 0.4);
    const pad = gain();
    const voices = [0, 1, 2].map((i) => {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine';
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.detune.value = 7;
      const vg = gain(i === 0 ? 0.5 : 0.32);
      o.connect(vg); o2.connect(vg); vg.connect(padF); o.start(); o2.start();
      return [o, o2];
    });
    padF.connect(pad); pad.connect(master); pad.connect(reverb);

    G = { master, reverb, wet, rumble, rumbleF, railHiss, wind, windF, steam, squeal, pad, padF, voices, clack: clackBuffer(ctx) };
  }

  function set(param, v, tc = 0.06) { param.setTargetAtTime(v, ctx.currentTime, tc); }

  function updateContinuous(t, info) {
    const v = trainSpeed(t);
    const near = 1 / (1 + info.camDist / 45);
    const tunnel = info.camInTunnel ? 1 : 0;
    set(G.rumble.gain, (v / 35) * (0.22 + 0.55 * near) * (1 + tunnel * 1.4));
    set(G.rumbleF.frequency, 90 + v * 4 + tunnel * 120);
    set(G.railHiss.gain, (v / 35) * 0.05 * (0.3 + near) * (1 + tunnel * 2));
    set(G.wind.gain, 0.05 + 0.05 * (1 - near));
    set(G.windF.frequency, 420 + 180 * Math.sin(t * 0.37) + 90 * Math.sin(t * 1.3));
    const ventEnv = smooth(28.6, 29.8, t) * (1 - smooth(35.2, 37, t)) * (1 + 0.8 * smooth(33.4, 34, t));
    set(G.steam.gain, ventEnv * 0.07 * (0.4 + near));
    const sq = smooth(25.5, 28.5, t) * (1 - smooth(29.6, 30.05, t));
    set(G.squeal.gain, sq * 0.035 * (0.3 + near));
    const padLevel = 0.06 * smooth(0, 4, t) + 0.03 * smooth(34, 46, t) + 0.03 * smooth(46, 54, t);
    set(G.pad.gain, padLevel * (1 - smooth(57.6, 60, t)), 0.2);
    set(G.padF.frequency, 500 + 900 * smooth(30, 50, t), 0.4);
    set(G.wet.gain, 0.3 + tunnel * 0.25);
    let ci = 0;
    for (let i = 0; i < CHORDS.length; i++) if (t >= CHORDS[i].t) ci = i;
    if (ci !== chordIndex) {
      const glide = chordIndex < 0 ? 0.001 : 0.5;
      CHORDS[ci].f.forEach((f, i) => {
        G.voices[i][0].frequency.setTargetAtTime(f / (i === 0 ? 2 : 1), ctx.currentTime, glide);
        G.voices[i][1].frequency.setTargetAtTime(f, ctx.currentTime, glide);
      });
      chordIndex = ci;
    }
  }

  function track(node, end) { active.push({ node, end }); }

  function playEvent(e, when, info) {
    const near = 1 / (1 + info.camDist / 45);
    if (e.type === 'clack') {
      const s = ctx.createBufferSource(); s.buffer = G.clack;
      s.playbackRate.value = 0.85 + 0.3 * ((e.t * 7.31) % 1);
      const g = gain(0.1 + 0.32 * near * Math.min(1, e.speed / 25));
      s.connect(g).connect(G.master); s.start(when); track(s, when + 0.2);
    } else if (e.type === 'horn') {
      const out = gain(0);
      const lp = filter('lowpass', e.far ? 900 : 2200, 0.5);
      for (const f of [311.1, 370, 466.2]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.connect(lp); o.start(when); o.stop(when + e.dur + 0.6); track(o, when + e.dur + 0.6);
      }
      const level = e.far ? 0.05 : 0.11;
      out.gain.setValueAtTime(0, when);
      out.gain.linearRampToValueAtTime(level, when + 0.06);
      out.gain.setValueAtTime(level, when + e.dur);
      out.gain.linearRampToValueAtTime(0, when + e.dur + 0.35);
      lp.connect(out); out.connect(G.master); out.connect(G.reverb);
    } else if (e.type === 'chime') {
      [[659.25, 0], [523.25, 0.55]].forEach(([f, dt]) => {
        for (const [mult, amp] of [[1, 0.09], [2.76, 0.03], [5.4, 0.012]]) {
          const o = ctx.createOscillator(); o.frequency.value = f * mult;
          const g = gain(0);
          g.gain.setValueAtTime(amp, when + dt);
          g.gain.exponentialRampToValueAtTime(0.0001, when + dt + 2.4);
          o.connect(g); g.connect(G.master); g.connect(G.reverb);
          o.start(when + dt); o.stop(when + dt + 2.5); track(o, when + dt + 2.5);
        }
      });
    } else if (e.type === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(78, when);
      o.frequency.exponentialRampToValueAtTime(38, when + 0.35);
      const g = gain(0);
      g.gain.setValueAtTime(0.22 * e.level, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
      o.connect(g).connect(G.master); o.start(when); o.stop(when + 0.55); track(o, when + 0.55);
    }
  }

  function stopScheduled() {
    for (const a of active) { try { a.node.stop(); } catch (e) { /* already stopped */ } }
    active = [];
  }

  return {
    // Must be called from a user gesture.
    start(t) {
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
      stopScheduled();          // drop cues queued before a pause so they are not doubled
      scheduledUntil = t;
    },
    update(t, playing, info) {
      if (!ctx || !playing) return;
      updateContinuous(t, info);
      const ahead = t + 0.3;
      if (ahead > scheduledUntil) {
        for (const e of eventsBetween(scheduledUntil, ahead)) {
          playEvent(e, ctx.currentTime + Math.max(0, e.t - t), info);
        }
        scheduledUntil = ahead;
      }
      const now = ctx.currentTime;
      active = active.filter((a) => a.end > now);
    },
    seek(t) { stopScheduled(); scheduledUntil = t; chordIndex = -1; },
    pause() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      muted = m;
      if (G) G.master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    get muted() { return muted; },
    dispose() { stopScheduled(); if (ctx) ctx.close(); ctx = null; },
  };
}
