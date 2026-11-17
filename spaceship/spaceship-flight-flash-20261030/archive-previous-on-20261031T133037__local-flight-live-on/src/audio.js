/**
 * Synthesizes procedural sci-fi spaceship sound effects using Web Audio API:
 * - Engine idle hum
 * - Dynamic rocket/ion thruster roar scaling with throttle & speed
 * - Liftoff & touchdown audio chimes
 * - UI interaction feedback clicks
 * No external audio files needed; 100% offline & instantaneous.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isFlightActive = false;

    this.masterGain = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.noiseNode = null;
    this.oscDrone = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Setup continuous engine sound (Oscillator drone + Filtered White Noise)
      this.setupEngineSynth();
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  setupEngineSynth() {
    if (!this.ctx) return;

    // 1. Low frequency drone oscillator (sub-bass engine hum)
    this.oscDrone = this.ctx.createOscillator();
    this.oscDrone.type = 'sawtooth';
    this.oscDrone.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note

    const oscFilter = this.ctx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(140, this.ctx.currentTime);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    this.oscDrone.connect(oscFilter);
    oscFilter.connect(oscGain);

    // 2. Thruster rocket roar (noise buffer)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1; // White noise
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = noiseBuffer;
    this.noiseNode.loop = true;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'bandpass';
    this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

    this.noiseNode.connect(this.engineFilter);
    this.engineFilter.connect(noiseGain);

    // Combine into engine master gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    oscGain.connect(this.engineGain);
    noiseGain.connect(this.engineGain);

    this.engineGain.connect(this.masterGain);

    // Start continuous sound generators
    this.oscDrone.start();
    this.noiseNode.start();
  }

  ensureContext() {
    if (!this.ctx) {
      this.init();
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.35, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  setFlightActive(active) {
    this.isFlightActive = active;
  }

  updateEngineSound(throttle, speed) {
    if (!this.ctx || !this.engineGain || !this.engineFilter) return;

    // Calculate engine volume and frequency cutoff based on throttle & speed
    const targetGain = THREE.MathUtils.clamp(0.04 + throttle * 0.45, 0.04, 0.5);
    const targetFreq = THREE.MathUtils.clamp(180 + throttle * 600 + speed * 4, 180, 1200);

    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);

    if (this.oscDrone) {
      const dronePitch = 55 + throttle * 45;
      this.oscDrone.frequency.setTargetAtTime(dronePitch, this.ctx.currentTime, 0.08);
    }
  }

  playLaunchTone() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    // Ascending arpeggio chime
    const notes = [440, 554.37, 659.25, 880]; // A major
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.ctx.currentTime + idx * 0.08);
      osc.stop(this.ctx.currentTime + idx * 0.08 + 0.4);
    });
  }

  playTouchdownTone() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    // Welcoming harmonious chime
    const notes = [659.25, 880, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.09);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.09 + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.ctx.currentTime + idx * 0.09);
      osc.stop(this.ctx.currentTime + idx * 0.09 + 0.55);
    });
  }

  playClick() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }
}
