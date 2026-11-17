/**
 * Web Audio API synthesizer for realistic spaceship jet & rocket sounds.
 * Zero external audio files required.
 */
export class SynthAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Default muted until user toggles or enables
    this.isInitialized = false;

    // Audio nodes
    this.masterGain = null;
    
    // Turbine engine whine (Oscillator + Bandpass)
    this.turbineOsc = null;
    this.turbineGain = null;
    this.turbineFilter = null;

    // Thruster roar (White Noise + Lowpass + Resonant Bandpass)
    this.noiseNode = null;
    this.roarGain = null;
    this.roarFilter = null;

    // VTOL hiss
    this.vtolGain = null;
    this.vtolFilter = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- 1. Turbine Whine Synth ---
      this.turbineOsc = this.ctx.createOscillator();
      this.turbineOsc.type = 'sawtooth';
      this.turbineOsc.frequency.setValueAtTime(140, this.ctx.currentTime);

      this.turbineFilter = this.ctx.createBiquadFilter();
      this.turbineFilter.type = 'bandpass';
      this.turbineFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
      this.turbineFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.turbineGain = this.ctx.createGain();
      this.turbineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.turbineOsc.connect(this.turbineFilter);
      this.turbineFilter.connect(this.turbineGain);
      this.turbineGain.connect(this.masterGain);
      this.turbineOsc.start();

      // --- 2. Rocket Roar (Noise Buffer) ---
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.roarFilter = this.ctx.createBiquadFilter();
      this.roarFilter.type = 'lowpass';
      this.roarFilter.frequency.setValueAtTime(250, this.ctx.currentTime);
      this.roarFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      this.roarGain = this.ctx.createGain();
      this.roarGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.noiseNode.connect(this.roarFilter);
      this.roarFilter.connect(this.roarGain);
      this.roarGain.connect(this.masterGain);

      // --- 3. VTOL Lift Thrusters (Hiss) ---
      this.vtolFilter = this.ctx.createBiquadFilter();
      this.vtolFilter.type = 'bandpass';
      this.vtolFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
      this.vtolFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      this.vtolGain = this.ctx.createGain();
      this.vtolGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

      this.noiseNode.connect(this.vtolFilter);
      this.vtolFilter.connect(this.vtolGain);
      this.vtolGain.connect(this.masterGain);

      this.noiseNode.start();
      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization deferred:', e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  update(flightState) {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;

    const { throttle, vtolThrottle, phase } = flightState;
    const now = this.ctx.currentTime;

    // Turbine pitch shifts with throttle
    const targetFreq = 160 + throttle * 480;
    this.turbineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
    this.turbineFilter.frequency.setTargetAtTime(targetFreq * 2.2, now, 0.1);
    this.turbineGain.gain.setTargetAtTime(0.01 + throttle * 0.15, now, 0.1);

    // Roar filter cutoff opens with throttle
    const roarCutoff = 180 + throttle * 1200;
    this.roarFilter.frequency.setTargetAtTime(roarCutoff, now, 0.1);
    this.roarGain.gain.setTargetAtTime(throttle * 0.35, now, 0.1);

    // VTOL hiss scales with VTOL thruster
    this.vtolGain.gain.setTargetAtTime(vtolThrottle * 0.28, now, 0.08);
  }

  playTouchdown() {
    if (!this.isInitialized || this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Pneumatic pressure release hiss
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}
