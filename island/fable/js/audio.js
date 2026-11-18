// WebAudio soundscape: surf, wind, a slow pad, gulls by day, crickets by
// night and a chime when the lamp is lit. All levels follow scene time.
import { rng, smooth, lerp } from './common.js';

const SURF_BY_SHOT = [0.55, 0.36, 1.0, 0.8, 0.5];
const WIND_BY_SHOT = [0.5, 1.0, 0.35, 0.6, 0.7];
const DAY_CHORD = [73.42, 146.83, 220.0, 329.63, 369.99];
const NIGHT_CHORD = [61.74, 123.47, 185.0, 293.66, 440.0];

export function createAudio() {
  let ctx = null, n = null, lastT = 0;

  function noiseBuffer(seconds, seed, pink) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0), r = rng(seed);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      if (pink) {
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      } else d[i] = w;
    }
    // crossfade the loop seam
    const xf = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < xf; i++) { const k = i / xf; d[i] = d[i] * k + d[len - xf + i] * (1 - k); }
    return buf;
  }
  function loop(buf, offset) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopEnd = buf.duration - 0.25; s.start(0, offset);
    return s;
  }
  function gain(v, dest) { const g = ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }
  function filter(type, f, q, dest) {
    const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (dest) b.connect(dest); return b;
  }
  function reverbImpulse() {
    const len = Math.floor(ctx.sampleRate * 2.8), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c), r = rng(900 + c);
      for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const master = gain(0, ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.connect(master);
    const rev = ctx.createConvolver(); rev.buffer = reverbImpulse();
    rev.connect(gain(0.5, comp));
    const pinkBuf = noiseBuffer(7, 7, true), whiteBuf = noiseBuffer(5, 8, false);

    const surfG = gain(0, comp), surfF = filter('lowpass', 600, 0.4, surfG);
    loop(pinkBuf, 0).connect(surfF);
    const hissG = gain(0, comp), hissF = filter('highpass', 2600, 0.3, hissG);
    loop(whiteBuf, 1.3).connect(hissF);
    const windG = gain(0, comp), windF = filter('bandpass', 380, 0.9, windG);
    loop(pinkBuf, 3.1).connect(windF);

    const padG = gain(0, comp), padF = filter('lowpass', 900, 0.5, padG);
    padG.connect(rev);
    const voices = (chord) => {
      const g = gain(0, padF);
      chord.forEach((f, i) => {
        for (const det of [-4, 5]) {
          const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
          o.frequency.value = f; o.detune.value = det + i * 1.5;
          o.connect(gain(i === 0 ? 0.5 : 0.22 / (1 + i * 0.25), g)); o.start();
        }
      });
      return g;
    };
    const dayG = voices(DAY_CHORD), nightG = voices(NIGHT_CHORD);

    // crickets: carrier gated by two LFOs (trill and chirp rhythm)
    const crG = gain(0, comp);
    const g1 = gain(0.5, crG), g2 = gain(0.5, g1);
    const car = ctx.createOscillator(); car.frequency.value = 4350; car.connect(g2); car.start();
    const l1 = ctx.createOscillator(); l1.type = 'square'; l1.frequency.value = 31; l1.connect(gain(0.5, g2.gain)); l1.start();
    const l2 = ctx.createOscillator(); l2.type = 'sine'; l2.frequency.value = 1.7; l2.connect(gain(0.5, g1.gain)); l2.start();

    n = { master, comp, rev, surfG, surfF, hissG, windG, windF, padG, padF, dayG, nightG, crG };
  }

  function gull(level) {
    const out = gain(level, n.comp); out.connect(n.rev);
    const bp = filter('bandpass', 2300, 5, out);
    const t0 = ctx.currentTime + 0.02;
    [0, 0.26, 0.5, 0.86].forEach((dt, i) => {
      const o = ctx.createOscillator(), g = gain(0, bp); o.type = 'sawtooth'; o.connect(g);
      const s = t0 + dt, len = i === 3 ? 0.42 : 0.2;
      o.frequency.setValueAtTime(1500, s); o.frequency.linearRampToValueAtTime(2500, s + len * 0.35);
      o.frequency.linearRampToValueAtTime(1750, s + len);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(1, s + 0.03); g.gain.linearRampToValueAtTime(0, s + len);
      o.start(s); o.stop(s + len + 0.05);
    });
  }
  function chime() {
    const out = gain(0.11, n.comp); out.connect(n.rev);
    const t0 = ctx.currentTime + 0.02;
    [[392, 1], [587.33, 0.6], [783.99, 0.45], [1174.66, 0.2], [98, 0.9]].forEach(([f, a], i) => {
      const o = ctx.createOscillator(), g = gain(0, out); o.frequency.value = f; o.connect(g);
      const s = t0 + i * 0.07;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(a, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 4.5);
      o.start(s); o.stop(s + 4.6);
    });
  }
  const EVENTS = [
    [2.4, () => gull(0.05)], [6.9, () => gull(0.035)], [11.2, () => gull(0.05)], [16.4, () => gull(0.03)],
    [21.0, () => gull(0.04)], [28.6, () => gull(0.022)], [39.6, chime],
  ];

  // Called every rendered frame while playing.
  function update(t, shot) {
    if (!ctx) return;
    const now = ctx.currentTime, set = (p, v, tc = 0.12) => p.setTargetAtTime(v, now, tc);
    for (const [te, fn] of EVENTS) if (lastT < te && t >= te && t - te < 0.5) fn();
    lastT = t;
    const swell = Math.pow(0.5 + 0.5 * Math.sin(t * 0.93 + Math.sin(t * 0.37) * 0.8), 1.6);
    const surf = SURF_BY_SHOT[shot], wind = WIND_BY_SHOT[shot];
    set(n.master.gain, 0.9 * smooth(0, 2.2, t) * (1 - smooth(57.4, 59.9, t)));
    set(n.surfG.gain, surf * (0.30 + 0.55 * swell));
    set(n.surfF.frequency, 380 + 1100 * swell * surf);
    set(n.hissG.gain, surf * surf * 0.05 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.93 - 0.9), 3));
    set(n.windG.gain, wind * (0.10 + 0.05 * Math.sin(t * 0.21 + 1)));
    set(n.windF.frequency, 360 + 140 * Math.sin(t * 0.17));
    const dusk = smooth(29, 41, t);
    set(n.dayG.gain, 1 - dusk, 0.4); set(n.nightG.gain, dusk, 0.4);
    set(n.padG.gain, 0.075 * smooth(0.5, 5, t) * (0.85 + 0.15 * Math.sin(t * 0.4)));
    set(n.padF.frequency, lerp(1100, 650, dusk) + 150 * Math.sin(t * 0.3));
    set(n.crG.gain, 0.012 * smooth(34, 45, t) * (shot === 3 ? 0.6 : 1));
  }

  return {
    init,
    update,
    resync(t) { lastT = t; },
    resume() { if (ctx && ctx.state !== 'running') ctx.resume(); },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  };
}
