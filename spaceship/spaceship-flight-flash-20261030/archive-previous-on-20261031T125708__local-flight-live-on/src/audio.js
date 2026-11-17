/**
 * Procedural Audio Synthesizer for Spaceship Flight Test
 * Uses Web Audio API - zero external audio asset dependencies!
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
    
    // Thruster Audio Nodes
    this.thrustGain = null;
    this.thrustFilter = null;
    this.thrustNoiseSource = null;
    this.turbineOsc = null;
    this.turbineGain = null;

    // Wind / Atmosphere Audio Nodes
    this.windGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.setupEngineSound();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio could not be initialized:', e);
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupEngineSound() {
    if (!this.ctx) return;

    // 1. Noise-based rocket / jet rumble
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise filter for deep thruster roar
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    this.thrustNoiseSource = this.ctx.createBufferSource();
    this.thrustNoiseSource.buffer = noiseBuffer;
    this.thrustNoiseSource.loop = true;

    this.thrustFilter = this.ctx.createBiquadFilter();
    this.thrustFilter.type = 'lowpass';
    this.thrustFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.thrustFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.thrustGain = this.ctx.createGain();
    this.thrustGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

    this.thrustNoiseSource.connect(this.thrustFilter);
    this.thrustFilter.connect(this.thrustGain);
    this.thrustGain.connect(this.ctx.destination);
    this.thrustNoiseSource.start();

    // 2. High-frequency turbine / ion drive whine oscillator
    this.turbineOsc = this.ctx.createOscillator();
    this.turbineOsc.type = 'sine';
    this.turbineOsc.frequency.setValueAtTime(220, this.ctx.currentTime);

    this.turbineGain = this.ctx.createGain();
    this.turbineGain.gain.setValueAtTime(0.015, this.ctx.currentTime);

    this.turbineOsc.connect(this.turbineGain);
    this.turbineGain.connect(this.ctx.destination);
    this.turbineOsc.start();
  }

  updateEngine(throttleNorm, speedNorm) {
    if (!this.ctx || this.isMuted || !this.thrustGain) return;
    const now = this.ctx.currentTime;
    
    // Smooth ramp parameters
    const targetNoiseVol = 0.02 + throttleNorm * 0.16 + speedNorm * 0.08;
    const targetFilterFreq = 120 + throttleNorm * 420 + speedNorm * 380;
    const targetTurbineFreq = 180 + throttleNorm * 340 + speedNorm * 260;
    const targetTurbineVol = 0.01 + throttleNorm * 0.035;

    this.thrustGain.gain.setTargetAtTime(targetNoiseVol, now, 0.08);
    this.thrustFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
    this.turbineOsc.frequency.setTargetAtTime(targetTurbineFreq, now, 0.1);
    this.turbineGain.gain.setTargetAtTime(targetTurbineVol, now, 0.1);
  }

  playLaunchChime() {
    if (!this.ctx || this.isMuted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playLandingChime() {
    if (!this.ctx || this.isMuted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Dual chime tone
    [587.33, 880].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.1, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.85);
    });

    // Hydraulic / landing gear hiss
    this.playPneumaticHiss();
  }

  playPneumaticHiss() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
  }

  playClick() {
    if (!this.ctx || this.isMuted) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  toggleMute() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    if (this.ctx) {
      if (this.isMuted) {
        if (this.thrustGain) this.thrustGain.gain.setValueAtTime(0, this.ctx.currentTime);
        if (this.turbineGain) this.turbineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    }
    return !this.isMuted;
  }
}

export const soundManager = new SoundManager();
