import { STORAGE_KEYS } from './config.js';

const PENTATONIC = [293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99, 880.0];
const BASS_SEQ = [73.42, 73.42, 146.83, 73.42, 87.31, 87.31, 130.81, 98.0];

export class SynthAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.shardStep = 0;
    this.beatAccum = 0;
    this.stepIndex = 0;
    try {
      this.muted = localStorage.getItem(STORAGE_KEYS.muted) === '1';
    } catch {
      this.muted = false;
    }
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    try {
      localStorage.setItem(STORAGE_KEYS.muted, this.muted ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted contexts
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  buildNoiseBuffer() {
    const len = Math.floor(this.ctx.sampleRate * 0.5);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  tone({ type = 'sawtooth', f0 = 220, f1 = f0, dur = 0.12, gain = 0.2, delay = 0, pan = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (this.ctx.createStereoPanner && pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
      osc.connect(g).connect(panner).connect(this.master);
    } else {
      osc.connect(g).connect(this.master);
    }
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.15, freq = 1400, q = 2.0, gain = 0.16, pan = 0 }) {
    if (!this.ctx || !this.noiseBuffer || this.muted) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 0.45), t0 + dur);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (this.ctx.createStereoPanner && pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      src.connect(filter).connect(g).connect(panner).connect(this.master);
    } else {
      src.connect(filter).connect(g).connect(this.master);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playLaneSwap(dir = 0) {
    this.tone({ type: 'sine', f0: 240, f1: 510, dur: 0.085, gain: 0.16, pan: dir * 0.45 });
    this.noise({ dur: 0.07, freq: 2200, q: 1.5, gain: 0.08, pan: dir * 0.45 });
  }

  playJump() {
    this.tone({ type: 'triangle', f0: 175, f1: 540, dur: 0.16, gain: 0.24 });
    this.tone({ type: 'sine', f0: 95, f1: 190, dur: 0.11, gain: 0.2 });
  }

  playSlide() {
    this.noise({ dur: 0.24, freq: 2600, q: 2.8, gain: 0.15 });
    this.tone({ type: 'sawtooth', f0: 260, f1: 95, dur: 0.16, gain: 0.12 });
  }

  playShard(combo = 1) {
    const note = PENTATONIC[(this.shardStep++ + combo) % PENTATONIC.length];
    this.tone({ type: 'sine', f0: note, f1: note * 1.01, dur: 0.13, gain: 0.18 });
    this.tone({ type: 'triangle', f0: note * 2, f1: note * 2, dur: 0.08, gain: 0.08, delay: 0.02 });
  }

  playNearMiss(combo = 1) {
    const base = 360 + Math.min(8, combo) * 42;
    this.tone({ type: 'sawtooth', f0: base * 0.65, f1: base * 1.65, dur: 0.17, gain: 0.18 });
    this.tone({ type: 'triangle', f0: base * 1.25, f1: base * 1.5, dur: 0.19, gain: 0.15, delay: 0.04 });
    this.noise({ dur: 0.12, freq: 3400, q: 3.2, gain: 0.12 });
  }

  playPowerup() {
    const notes = [293.66, 369.99, 440.0, 587.33];
    notes.forEach((f, idx) => {
      this.tone({ type: 'triangle', f0: f, f1: f * 1.02, dur: 0.22, gain: 0.17, delay: idx * 0.045 });
    });
  }

  playSmash() {
    this.tone({ type: 'sawtooth', f0: 150, f1: 36, dur: 0.28, gain: 0.32 });
    this.noise({ dur: 0.26, freq: 1100, q: 1.1, gain: 0.26 });
  }

  playDistrictChange() {
    this.tone({ type: 'sawtooth', f0: 146.83, f1: 293.66, dur: 0.38, gain: 0.12 });
    this.tone({ type: 'triangle', f0: 220.0, f1: 440.0, dur: 0.42, gain: 0.1, delay: 0.05 });
  }

  playCrash() {
    this.tone({ type: 'sawtooth', f0: 190, f1: 32, dur: 0.48, gain: 0.36 });
    this.tone({ type: 'square', f0: 98, f1: 28, dur: 0.42, gain: 0.22 });
    this.noise({ dur: 0.38, freq: 750, q: 0.9, gain: 0.28 });
  }

  updateMusic(dt, isPlaying, speedNorm = 0, nitro = false) {
    if (!this.ctx || this.muted || !isPlaying || this.ctx.state !== 'running') return;
    const stepDur = nitro ? 0.105 : 0.138 - speedNorm * 0.025;
    this.beatAccum += dt;
    if (this.beatAccum < stepDur) return;
    this.beatAccum -= stepDur;

    const step = this.stepIndex++ % BASS_SEQ.length;
    const freq = BASS_SEQ[step] * (nitro ? 1.122 : 1);
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t0);

    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(340 + speedNorm * 580 + (nitro ? 550 : 0), t0);
    flt.frequency.exponentialRampToValueAtTime(140, t0 + stepDur * 0.9);
    flt.Q.value = 3.5;

    g.gain.setValueAtTime(0.001, t0);
    g.gain.linearRampToValueAtTime(0.11, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + stepDur * 0.92);

    osc.connect(flt).connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + stepDur);
  }
}
