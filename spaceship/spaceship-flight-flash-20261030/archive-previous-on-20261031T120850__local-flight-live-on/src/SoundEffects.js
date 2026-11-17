export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    
    // Engine sound nodes
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineNoiseNode = null;
    this.engineGain = null;
    this.filterNode = null;
    this.isEngineRunning = false;

    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSound();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not allowed or supported yet:", e);
    }
  }

  setupEngineSound() {
    if (!this.ctx) return;

    // High turbine/ion whine
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(95, this.ctx.currentTime);

    // Deep sub rumble
    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Filter
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(3, this.ctx.currentTime);

    // Engine Master Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    // Filtered noise generator for rocket plume hiss
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.engineGain);

    this.engineOsc.connect(this.filterNode);
    this.engineSubOsc.connect(this.filterNode);
    this.filterNode.connect(this.engineGain);

    this.engineGain.connect(this.masterGain);

    this.engineOsc.start();
    this.engineSubOsc.start();
    whiteNoise.start();
    this.isEngineRunning = true;
  }

  updateEngine(throttle, speedRatio) {
    if (!this.initialized || !this.ctx || !this.isEngineRunning) return;
    const now = this.ctx.currentTime;
    
    // Base frequency ramps from 85Hz at idle to 220Hz at max throttle
    const targetFreq = 85 + throttle * 135 + speedRatio * 40;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.1);
    this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.45, now, 0.1);

    // Filter opens up as throttle increases
    const targetCutoff = 250 + throttle * 1800 + speedRatio * 600;
    this.filterNode.frequency.setTargetAtTime(targetCutoff, now, 0.15);

    // Engine volume: quiet idle (0.05) to full power (0.55)
    const targetVolume = 0.05 + throttle * 0.5;
    this.engineGain.gain.setTargetAtTime(targetVolume, now, 0.1);
  }

  playTakeoffWhoosh() {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 1.2);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.6);
  }

  playGearSound(isDeploying = true) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Servo sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isDeploying ? 320 : 440, now);
    osc.frequency.linearRampToValueAtTime(isDeploying ? 220 : 560, now + 0.5);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.6);

    // Hydraulic lock click
    setTimeout(() => {
      if (!this.ctx) return;
      const clickTime = this.ctx.currentTime;
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(180, clickTime);
      clickOsc.frequency.exponentialRampToValueAtTime(40, clickTime + 0.08);

      clickGain.gain.setValueAtTime(0.2, clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.08);

      clickOsc.connect(clickGain);
      clickGain.connect(this.masterGain);

      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.09);
    }, 520);
  }

  playWaypointChime() {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    const tones = [587.33, 880]; // D5, A5
    tones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.09;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }

  playTouchdown() {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep hydraulic compression thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);

    // Pneumatic release hiss
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.3, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.1));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(now);
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }
}
