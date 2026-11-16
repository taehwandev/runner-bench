// All sound is synthesized with WebAudio: SFX + a small synthwave sequencer.
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.tempo = 104;
    this.intensity = 0; // 0..1 adds layers
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.8;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp).connect(ctx.destination);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000; this.musicFilter.Q.value = 0.7;
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.musicFilter).connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);

    // simple feedback delay for music sparkle
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createGain(); dl.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay); this.delay.connect(dl).connect(this.musicGain);

    // noise buffer
    const len = ctx.sampleRate * 1.5;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.timer = setInterval(() => this.schedule(), 25);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- primitives ----------
  tone({ type = 'sine', f0 = 440, f1 = null, t = 0, dur = 0.15, vol = 0.3, attack = 0.005, dest = null, q = 0, filter = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx; const st = this.now() + t;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, st);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), st + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(vol, st + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    let node = o;
    if (filter) {
      const bf = ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = filter; bf.Q.value = q;
      o.connect(bf); node = bf;
    }
    node.connect(g).connect(dest || this.sfx);
    o.start(st); o.stop(st + dur + 0.05);
  }

  noiseHit({ t = 0, dur = 0.2, vol = 0.3, type = 'bandpass', f0 = 1000, f1 = null, q = 1, dest = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx; const st = this.now() + t;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, st);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, st + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, st);
    g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
    s.connect(f).connect(g).connect(dest || this.sfx);
    s.start(st, Math.random() * 0.5); s.stop(st + dur + 0.05);
  }

  // ---------- SFX ----------
  jump() { this.tone({ type: 'square', f0: 220, f1: 660, dur: 0.16, vol: 0.12, filter: 2400 }); this.noiseHit({ dur: 0.12, vol: 0.08, f0: 2000, f1: 5000 }); }
  slide() { this.noiseHit({ dur: 0.32, vol: 0.18, type: 'lowpass', f0: 2500, f1: 300, q: 2 }); }
  lane() { this.noiseHit({ dur: 0.12, vol: 0.1, f0: 1800, f1: 600, q: 2 }); }
  land() { this.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.1, vol: 0.18 }); }
  coin(pitch = 0) {
    const base = 880 * Math.pow(2, (pitch % 12) / 12);
    this.tone({ type: 'triangle', f0: base, dur: 0.09, vol: 0.13 });
    this.tone({ type: 'sine', f0: base * 1.5, t: 0.05, dur: 0.14, vol: 0.1 });
  }
  gem() {
    [0, 4, 7, 12].forEach((s, i) => this.tone({ type: 'triangle', f0: 660 * Math.pow(2, s / 12), t: i * 0.045, dur: 0.18, vol: 0.12 }));
  }
  nearMiss(level = 0) {
    this.noiseHit({ dur: 0.35, vol: 0.28, f0: 400, f1: 3500, q: 1.5 });
    const b = 523 * Math.pow(2, Math.min(level, 12) / 12);
    this.tone({ type: 'sawtooth', f0: b, dur: 0.12, vol: 0.06, t: 0.04, filter: 3000 });
    this.tone({ type: 'sawtooth', f0: b * 1.5, dur: 0.2, vol: 0.06, t: 0.1, filter: 3000 });
  }
  powerup() {
    [0, 5, 7, 12, 17, 19, 24].forEach((s, i) => this.tone({ type: 'square', f0: 330 * Math.pow(2, s / 12), t: i * 0.04, dur: 0.12, vol: 0.06, filter: 4000 }));
  }
  shieldBreak() {
    this.noiseHit({ dur: 0.5, vol: 0.4, type: 'highpass', f0: 3000, q: 0.5 });
    [0, 3, 7].forEach((s, i) => this.tone({ type: 'triangle', f0: 1400 * Math.pow(2, -s / 12), t: i * 0.03, dur: 0.3, vol: 0.1 }));
    this.tone({ type: 'sine', f0: 120, f1: 40, dur: 0.3, vol: 0.3 });
  }
  smash() {
    this.noiseHit({ dur: 0.35, vol: 0.35, type: 'lowpass', f0: 3000, f1: 200 });
    this.tone({ type: 'square', f0: 110, f1: 40, dur: 0.25, vol: 0.15, filter: 800 });
  }
  crash() {
    this.noiseHit({ dur: 1.2, vol: 0.6, type: 'lowpass', f0: 5000, f1: 120, q: 0.5 });
    this.tone({ type: 'sine', f0: 90, f1: 25, dur: 0.8, vol: 0.6 });
    this.tone({ type: 'sawtooth', f0: 300, f1: 40, dur: 0.6, vol: 0.12, filter: 1200 });
  }
  horn() {
    this.tone({ type: 'sawtooth', f0: 392, dur: 0.35, vol: 0.05, filter: 1400, attack: 0.02 });
    this.tone({ type: 'sawtooth', f0: 494, dur: 0.35, vol: 0.05, filter: 1400, attack: 0.02 });
  }
  bell(t = 0) { this.tone({ type: 'square', f0: 1250, dur: 0.12, vol: 0.04, t, filter: 3000 }); }
  ui() { this.tone({ type: 'triangle', f0: 660, f1: 1320, dur: 0.15, vol: 0.12 }); }

  // ---------- music ----------
  startMusic() {
    if (!this.ctx) return;
    this.musicOn = true; this.step = 0; this.nextTime = this.now() + 0.08;
    const g = this.musicGain.gain; g.cancelScheduledValues(this.now());
    g.setTargetAtTime(0.55, this.now(), 0.3);
    this.setMuffle(false);
  }
  stopMusic() {
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(0.0, this.now(), 0.4);
    setTimeout(() => { this.musicOn = false; }, 1200);
  }
  setMuffle(on, amount = 600) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? amount : 18000, this.now(), 0.08);
  }

  schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / this.tempo / 4; // 16th
    while (this.nextTime < this.now() + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += spb; this.step++;
    }
  }

  playStep(step, t) {
    const ctx = this.ctx, out = this.musicGain;
    const s16 = step % 16, bar = Math.floor(step / 16);
    // progression: Am F C G  (A minor synthwave)
    const roots = [45, 41, 48, 43];
    const root = roots[bar % 4];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const lvl = this.intensity;

    // kick
    if (s16 % 4 === 0) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
    }
    // snare
    if (s16 === 4 || s16 === 12) {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.2);
      const o = ctx.createOscillator(); const g2 = ctx.createGain(); o.frequency.value = 190;
      g2.gain.setValueAtTime(0.15, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g2).connect(out); o.start(t); o.stop(t + 0.12);
    }
    // hats
    if (s16 % 2 === 1 || (lvl > 0.5 && s16 % 2 === 0)) {
      const s = ctx.createBufferSource(); s.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
      const g = ctx.createGain(); g.gain.setValueAtTime(s16 % 2 ? 0.08 : 0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.06);
    }
    // bass: driving 8ths w/ octave jumps
    if (s16 % 2 === 0) {
      const n = root - 12 + ((s16 % 4 === 2) ? 12 : 0);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(300 + lvl * 900, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.14);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.18);
    }
    // arp (minor/major triad depending on root)
    const minor = (bar % 4 === 0);
    const tri = minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    if (lvl > 0.15 || bar >= 2) {
      const n = root + 24 + tri[(s16 * 3) % 4] + (s16 >= 8 ? 12 : 0) * (lvl > 0.6 ? 1 : 0);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(n);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800 + lvl * 2500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.045, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(f).connect(g); g.connect(out); g.connect(this.delay); o.start(t); o.stop(t + 0.14);
    }
    // pad at bar start
    if (s16 === 0) {
      const dur = (60 / this.tempo) * 4;
      [0, tri[1], 7].forEach(iv => {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(root + 12 + iv); o.detune.value = det;
          const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
          const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
        }
      });
    }
  }
}
