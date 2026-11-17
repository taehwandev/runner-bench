/**
 * Procedural Audio Controller using Web Audio API
 * No external audio files required!
 */
export class AudioController {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Audio nodes
    this.masterGain = null;
    this.engineGain = null;
    this.thrusterNoiseGain = null;
    this.engineOsc = null;
    this.noiseNode = null;
    this.noiseFilter = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSound();
      this.setupThrusterNoise();
      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio initialization failed:', e);
    }
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupEngineSound() {
    // Engine tonal hum
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A1

    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
  }

  setupThrusterNoise() {
    // Generate pink-like noise buffer for thrusters
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
    this.noiseFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.thrusterNoiseGain = this.ctx.createGain();
    this.thrusterNoiseGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

    this.noiseNode.connect(this.noiseFilter);
    this.noiseFilter.connect(this.thrusterNoiseGain);
    this.thrusterNoiseGain.connect(this.masterGain);

    this.noiseNode.start();
  }

  updateEngine(throttle, speedRatio) {
    if (!this.ctx || !this.isInitialized) return;
    const now = this.ctx.currentTime;

    // Pitch changes with throttle and speed
    const baseFreq = 50 + throttle * 45 + speedRatio * 25;
    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);

    // Engine hum volume
    const humVol = 0.03 + throttle * 0.08;
    this.engineGain.gain.setTargetAtTime(humVol, now, 0.08);

    // Thruster roar volume & filter cutoff
    const noiseVol = 0.02 + Math.pow(throttle, 1.4) * 0.28;
    this.thrusterNoiseGain.gain.setTargetAtTime(noiseVol, now, 0.08);

    const filterFreq = 180 + throttle * 650;
    this.noiseFilter.frequency.setTargetAtTime(filterFreq, now, 0.08);
  }

  playGearSound(isDeploying) {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    const startF = isDeploying ? 320 : 180;
    const endF = isDeploying ? 160 : 360;

    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.6);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.75);
  }

  playChime(type = 'info') {
    if (!this.ctx || this.isMuted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const notes = {
      takeoff: [392, 587.33, 783.99], // G4, D5, G5
      waypoint: [523.25, 659.25],       // C5, E5
      approach: [659.25, 523.25],       // E5, C5
      land: [587.33, 440, 293.66],      // D5, A4, D4
      click: [880],
    }[type] || [523.25, 783.99];

    notes.forEach((freq, idx) => {
      const t = now + idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}
