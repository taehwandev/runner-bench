// Web Audio API procedural sound system for spaceship flight
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;

    // Engine sound nodes
    this.engineGain = null;
    this.engineFilter = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineNoise = null;
    this.isEngineRunning = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSound();
    } catch (e) {
      console.warn('Web Audio not supported or failed to initialize:', e);
    }
  }

  toggle() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = !this.enabled;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.25 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  setupEngineSound() {
    if (!this.ctx) return;

    // Create brownian noise for deep engine roar
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // gain compensation
    }

    this.engineNoise = this.ctx.createBufferSource();
    this.engineNoise.buffer = noiseBuffer;
    this.engineNoise.loop = true;

    // Filter for the noise (opens up as throttle increases)
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // Twin tonal oscillators for turbine whine
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(75, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sine';
    this.engineOsc2.frequency.setValueAtTime(150, this.ctx.currentTime);

    const oscMix = this.ctx.createGain();
    oscMix.gain.setValueAtTime(0.12, this.ctx.currentTime);

    this.engineOsc1.connect(oscMix);
    this.engineOsc2.connect(oscMix);

    // Engine main gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineNoise.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    oscMix.connect(this.engineGain);

    this.engineGain.connect(this.masterGain);

    this.engineNoise.start();
    this.engineOsc1.start();
    this.engineOsc2.start();
    this.isEngineRunning = true;
  }

  updateEngine(throttle, altitude) {
    if (!this.ctx || !this.isEngineRunning || !this.enabled) return;

    const t = this.ctx.currentTime;
    // Map throttle (0.0 to 1.0) to filter frequency and volume
    const targetFreq = 160 + throttle * 900;
    const targetOscFreq1 = 60 + throttle * 220;
    const targetOscFreq2 = 120 + throttle * 440;
    const targetGain = 0.05 + throttle * 0.45;

    this.engineFilter.frequency.setTargetAtTime(targetFreq, t, 0.1);
    this.engineOsc1.frequency.setTargetAtTime(targetOscFreq1, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(targetOscFreq2, t, 0.1);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.1);
  }

  playGearSound(isDeploying) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';

      const startFreq = isDeploying ? 520 : 340;
      const endFreq = isDeploying ? 340 : 520;

      osc.frequency.setValueAtTime(startFreq, t);
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.6);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.6);
    } catch (e) {}
  }

  playTouchdownSound() {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;

      // Low thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);

      // Metallic settle click
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'highpass';
      clickOsc.frequency.setValueAtTime(800, t + 0.05);
      clickGain.gain.setValueAtTime(0.08, t + 0.05);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      clickOsc.connect(clickGain);
      clickGain.connect(this.masterGain);
      clickOsc.start(t + 0.05);
      clickOsc.stop(t + 0.25);
    } catch (e) {}
  }

  playBeep(success = true) {
    if (!this.ctx || !this.enabled) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 440, t);
      if (success) {
        osc.frequency.setValueAtTime(1320, t + 0.1);
      }
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (success ? 0.25 : 0.2));
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + (success ? 0.25 : 0.2));
    } catch (e) {}
  }
}
