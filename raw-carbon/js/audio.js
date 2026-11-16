// Procedural WebAudio Engine — Synthwave Pulse + Dynamic SFX (Zero external audio files)

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicFilter = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;

    this.muted = false;
    this.playingMusic = false;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.tempo = 122;
    this.intensity = 0.2; // 0..1 based on speed & combo
    this.inTunnel = false;
    this.slowTime = false;
    this.shardStreak = 0;
    this.lastShardTime = 0;
    this.lastHornTime = 0;
    this.lastBellTime = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.78;

      // Subtle compressor so layered SFX + synth bass never clip
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;

      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 2600;
      this.musicFilter.Q.value = 1.2;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.34;
      this.musicFilter.connect(this.musicGain);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.masterGain);

      // Pre-generate 1.5s white/pinkish noise buffer for snares, slides, crashes, whooshes
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 1.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (_) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.78, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  startMusic() {
    this.init();
    if (!this.ctx) return;
    if (!this.playingMusic) {
      this.playingMusic = true;
      this.stepIndex = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.05;
    }
  }

  stopMusic() {
    this.playingMusic = false;
  }

  update(dt, state) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // Modulate filter for tunnel / slow-time immersion
    this.inTunnel = !!state.inTunnel;
    this.slowTime = !!state.slowTime;
    this.intensity = Math.min(1, Math.max(0, (state.speedRatio || 0) * 0.65 + ((state.combo || 1) - 1) * 0.07));
    this.tempo = this.slowTime ? 92 : 120 + Math.round((state.speedRatio || 0) * 20);

    const targetCutoff = this.slowTime
      ? 620
      : this.inTunnel
        ? 1050
        : 2200 + this.intensity * 2600;
    this.musicFilter.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.08);

    if (!this.playingMusic) return;

    const secondsPer16th = 60 / this.tempo / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.11) {
      this._scheduleStep(this.stepIndex, this.nextNoteTime, secondsPer16th);
      this.nextNoteTime += secondsPer16th;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  _scheduleStep(step, t, stepDur) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);

    // Kick on 0, 4, 8, 12 (+ syncopated 14 on bar 3)
    if (s16 % 4 === 0 || (bar === 3 && s16 === 14)) {
      this._playKick(t, 0.48);
    }

    // Snare on 4, 12
    if (s16 === 4 || s16 === 12) {
      this._playSnare(t, 0.28);
    }

    // Offbeat open/closed hi-hat
    if (s16 % 2 === 1 || this.intensity > 0.35) {
      const accent = s16 % 4 === 2 ? 0.14 : 0.06;
      this._playHat(t, accent, s16 % 4 === 2 ? 0.07 : 0.032);
    }

    // Driving F-minor darksynth rolling bassline (MIDI notes: F1=29, Ab1=32, Bb1=34, C2=36, Db2=37)
    const rootByBar = [29, 29, 37, 34]; // F, F, Db, Bb
    const baseMidi = rootByBar[bar];
    const octaveBump = (s16 % 2 === 1) ? 12 : 0;
    const freq = 440 * Math.pow(2, (baseMidi + octaveBump - 69) / 12);
    this._playBass(t, freq, stepDur * 0.82, s16 % 4 === 0 ? 0.24 : 0.17);

    // Neon Synth Arpeggio at higher combo/speed
    if (this.intensity > 0.25 && (s16 % 2 === 0 || this.intensity > 0.65)) {
      const arpScale = [65, 68, 72, 75, 77, 75, 72, 68]; // Fm7 shimmer
      const note = arpScale[(step + bar * 2) % arpScale.length];
      const arpFreq = 440 * Math.pow(2, (note - 69) / 12);
      this._playArp(t, arpFreq, stepDur * 0.7, 0.055 * this.intensity);
    }
  }

  _playKick(t, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  _playSnare(t, vol) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1650;
    filter.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(t);
    src.stop(t + 0.14);
  }

  _playHat(t, vol, dur) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  _playBass(t, freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(580, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  _playArp(t, freq, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  // ================= SOUND EFFECTS =================

  playLaneSwitch(dir = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Crisp synth swipe + air whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const startF = dir < 0 ? 360 : 410;
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(startF * 1.65, t + 0.075);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    if (this.ctx.createStereoPanner) {
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.7, Math.min(0.7, dir * 0.45));
      osc.connect(gain);
      gain.connect(pan);
      pan.connect(this.sfxGain);
    } else {
      osc.connect(gain);
      gain.connect(this.sfxGain);
    }
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playJump() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.14);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playSlide() {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2800, t);
    filter.frequency.exponentialRampToValueAtTime(950, t + 0.24);
    filter.Q.value = 1.6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.19, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.27);
  }

  playSlam() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.15);
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.19);
  }

  playShard(combo = 1, isRisk = false) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastShardTime < 0.9) {
      this.shardStreak = Math.min(14, this.shardStreak + 1);
    } else {
      this.shardStreak = 0;
    }
    this.lastShardTime = t;

    const pentatonic = [523.25, 622.25, 698.46, 783.99, 932.33, 1046.5, 1244.5, 1396.9, 1567.98];
    const idx = Math.min(pentatonic.length - 1, Math.floor((this.shardStreak + (combo - 1)) % pentatonic.length));
    const baseFreq = pentatonic[idx];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isRisk ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.02, t + 0.12);
    gain.gain.setValueAtTime(isRisk ? 0.25 : 0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (isRisk ? 0.24 : 0.14));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);

    if (isRisk) {
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(baseFreq * 1.5, t + 0.03);
      g2.gain.setValueAtTime(0.18, t + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc2.connect(g2);
      g2.connect(this.sfxGain);
      osc2.start(t + 0.03);
      osc2.stop(t + 0.27);
    }
  }

  playNearMiss(combo = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Electric Doppler whoosh + high reward ping
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.5;
      filter.frequency.setValueAtTime(600, t);
      filter.frequency.exponentialRampToValueAtTime(2900, t + 0.06);
      filter.frequency.exponentialRampToValueAtTime(500, t + 0.18);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.26, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      src.connect(filter);
      filter.connect(ng);
      ng.connect(this.sfxGain);
      src.start(t);
      src.stop(t + 0.2);
    }

    const ping = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    ping.type = 'triangle';
    const pitch = 660 + Math.min(8, combo) * 65;
    ping.frequency.setValueAtTime(pitch, t + 0.02);
    ping.frequency.exponentialRampToValueAtTime(pitch * 1.5, t + 0.18);
    pg.gain.setValueAtTime(0.22, t + 0.02);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    ping.connect(pg);
    pg.connect(this.sfxGain);
    ping.start(t + 0.02);
    ping.stop(t + 0.23);
  }

  playPowerup(type) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const chords = {
      shield: [523.25, 659.25, 783.99, 1046.5],
      magnet: [440, 554.37, 659.25, 880],
      dash: [349.23, 523.25, 698.46, 1046.5],
      chrono: [783.99, 622.25, 523.25, 392.0]
    };
    const notes = chords[type] || chords.shield;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type === 'dash' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.045);
      gain.gain.setValueAtTime(0.16, t + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.29);
    });
  }

  playSmash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this._playKick(t, 0.55);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, t);
      filter.frequency.exponentialRampToValueAtTime(420, t + 0.28);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.36, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(t);
      src.stop(t + 0.31);
    }
  }

  playHorn() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastHornTime < 1.8) return;
    this.lastHornTime = t;

    [370, 466.16].forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f * 1.04, t);
      osc.frequency.linearRampToValueAtTime(f * 0.92, t + 0.28); // Doppler drop
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.31);
    });
  }

  playRailBell() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (t - this.lastBellTime < 0.42) return;
    this.lastBellTime = t;

    [987.77, 1480].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(idx === 0 ? 0.11 : 0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.33);
    });
  }

  playCrash() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Sub impact + crunch + power-down pitch drop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, t);
      filter.frequency.exponentialRampToValueAtTime(180, t + 0.48);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.45, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      src.connect(filter);
      filter.connect(ng);
      ng.connect(this.sfxGain);
      src.start(t);
      src.stop(t + 0.52);
    }
  }
}
