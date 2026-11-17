/**
 * Procedural Web Audio API sound generator for spaceship engine and flight events
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;

    this.engineGain = null;
    this.engineFilter = null;
    this.noiseNode = null;
    this.humOsc = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Procedural engine roar using filtered brown noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise
        lastOut = output[i];
        output[i] *= 3.5;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.noiseNode.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.noiseNode.start();

      // Gentle sub-harmonic hum
      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sine';
      this.humOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.humGain = this.ctx.createGain();
      this.humGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      this.humOsc.connect(this.humGain);
      this.humGain.connect(this.masterGain);
      this.humOsc.start();

      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext not allowed or supported:', e);
    }
  }

  updateEngine(throttlePercent) {
    if (!this.initialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    const factor = Math.max(0.05, Math.min(1.0, throttlePercent / 100));

    // Filter cut-off opens with engine power
    const targetFreq = 120 + factor * 680;
    this.engineFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);

    // Gain increases with throttle
    const targetGain = 0.08 + factor * 0.45;
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);

    // Subtle pitch modulation on the hum
    this.humOsc.frequency.setTargetAtTime(55 + factor * 30, t, 0.1);
  }

  playTakeoffChime() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.35);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  playTouchdownChime() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880, t + 0.15); // A5

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.45, t, 0.05);
    }
    return this.isMuted;
  }
}
