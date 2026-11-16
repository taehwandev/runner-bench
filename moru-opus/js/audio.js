// All sound is synthesized with WebAudio: SFX + a small synthwave sequencer.
export class Sound {
  constructor() {
    this.ctx = null; this.muted = localStorage.getItem('nightline_muted') === '1';
    this.intensity = 0; this.step = 0; this.nextTime = 0; this.timer = null; this.coinChain = 0; this.coinTime = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 600; this.musicFilter.Q.value = 0.7;
    this.music = c.createGain(); this.music.gain.value = 0.42; this.music.connect(this.musicFilter); this.musicFilter.connect(this.master);
    // feedback delay for arps
    this.delay = c.createDelay(1); this.delay.delayTime.value = 60 / 124 * 0.75;
    const fb = c.createGain(); fb.gain.value = 0.32; const dl = c.createGain(); dl.gain.value = 0.35;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(dl); dl.connect(this.music);
    const len = c.sampleRate * 1.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.nextTime = c.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  setMuted(m) {
    this.muted = m; localStorage.setItem('nightline_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }
  setIntensity(v, cutoff) {
    this.intensity = v;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.25);
  }
  // ---------- primitives ----------
  osc(type, f0, f1, t, dur, vol, dest = this.sfx, attack = 0.005) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  nz(t, dur, vol, type, f0, f1, q = 1, dest = this.sfx) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  get ok() { return this.ctx && !this.muted && this.ctx.state === 'running'; }
  // ---------- sfx ----------
  coin(gem) {
    if (!this.ok) return; const t = this.ctx.currentTime;
    if (t - this.coinTime < 0.6) this.coinChain = Math.min(this.coinChain + 1, 12); else this.coinChain = 0;
    this.coinTime = t;
    const base = 880 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][this.coinChain] / 12);
    if (gem) { [0, 4, 7, 12].forEach((s, i) => this.osc('triangle', base * Math.pow(2, s / 12), base * Math.pow(2, s / 12), t + i * 0.04, 0.25, 0.16)); return; }
    this.osc('square', base, base, t, 0.07, 0.06); this.osc('sine', base * 1.5, base * 1.5, t + 0.04, 0.16, 0.1);
  }
  jump() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('triangle', 260, 620, t, 0.16, 0.18); this.nz(t, 0.18, 0.08, 'bandpass', 900, 3000, 2); }
  land() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('sine', 140, 50, t, 0.12, 0.25); this.nz(t, 0.08, 0.05, 'lowpass', 1200, 300); }
  slide() { if (!this.ok) return; const t = this.ctx.currentTime; this.nz(t, 0.4, 0.14, 'bandpass', 2400, 500, 1.5); }
  lane() { if (!this.ok) return; const t = this.ctx.currentTime; this.nz(t, 0.11, 0.07, 'highpass', 2000, 5000, 0.8); }
  whoosh(pan) {
    if (!this.ok) return; const t = this.ctx.currentTime, c = this.ctx;
    const p = c.createStereoPanner ? c.createStereoPanner() : null; let dest = this.sfx;
    if (p) { p.pan.value = pan; p.connect(this.sfx); dest = p; }
    this.nz(t, 0.45, 0.22, 'bandpass', 600, 2400, 1.2, dest);
    this.osc('sawtooth', 220, 110, t, 0.35, 0.05, dest);
  }
  nearMiss(level) {
    if (!this.ok) return; const t = this.ctx.currentTime, b = 660 * Math.pow(2, Math.min(level, 10) / 12);
    this.osc('sawtooth', b, b * 2, t, 0.12, 0.08); this.osc('square', b * 1.5, b * 3, t + 0.05, 0.14, 0.06);
    this.nz(t, 0.25, 0.1, 'highpass', 3000, 8000, 0.7);
  }
  comboLost() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('triangle', 520, 180, t, 0.3, 0.1); }
  power(kind) {
    if (!this.ok) return; const t = this.ctx.currentTime;
    const seq = kind === 'shield' ? [0, 7, 12, 19] : kind === 'magnet' ? [0, 3, 7, 10, 15] : [0, 5, 7, 12, 17, 24];
    seq.forEach((s, i) => this.osc('square', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), t + i * 0.055, 0.18, 0.09));
    if (kind === 'overdrive') { this.nz(t, 1.0, 0.2, 'bandpass', 300, 4000, 1); this.osc('sawtooth', 80, 400, t, 0.9, 0.12); }
  }
  shieldBreak() { if (!this.ok) return; const t = this.ctx.currentTime; this.nz(t, 0.5, 0.35, 'highpass', 1500, 6000, 0.5); this.osc('square', 900, 120, t, 0.4, 0.12); }
  smash() { if (!this.ok) return; const t = this.ctx.currentTime; this.nz(t, 0.35, 0.35, 'lowpass', 3000, 200, 0.8); this.osc('sine', 120, 40, t, 0.25, 0.4); }
  hit() {
    if (!this.ok) return; const t = this.ctx.currentTime;
    this.nz(t, 0.9, 0.6, 'lowpass', 4000, 100, 0.8); this.osc('sawtooth', 200, 30, t, 0.8, 0.3); this.osc('sine', 90, 25, t, 0.7, 0.6);
    this.nz(t + 0.05, 0.6, 0.25, 'highpass', 4000, 2000, 1);
  }
  bell() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('triangle', 1320, 1320, t, 0.3, 0.07); this.osc('sine', 1980, 1980, t, 0.2, 0.04); }
  cone() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('square', 300, 180, t, 0.08, 0.05); this.nz(t, 0.08, 0.06, 'bandpass', 800, 400, 2); }
  ui() { if (!this.ok) return; const t = this.ctx.currentTime; this.osc('triangle', 660, 1320, t, 0.12, 0.12); }
  district() { if (!this.ok) return; const t = this.ctx.currentTime; [0, 4, 7, 11, 14].forEach((s, i) => this.osc('triangle', 440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), t + i * 0.08, 0.5, 0.06)); }
  // ---------- music ----------
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const spb = 60 / 124 / 4; // 16th notes
    while (this.nextTime < c.currentTime + 0.12) { this.playStep(this.step, this.nextTime); this.nextTime += spb; this.step = (this.step + 1) % 256; }
  }
  playStep(s, t) {
    if (this.muted) return;
    const I = this.intensity, bar = Math.floor(s / 16) % 4, st = s % 16;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
    const ch = prog[bar], mf = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const M = this.music;
    // bass: driving 8ths with octave pops
    if (st % 2 === 0) { const n = ch[0] - 24 + (st % 8 === 6 ? 12 : 0); this.osc('sawtooth', mf(n), mf(n), t, 0.2, 0.16, M, 0.003); this.osc('square', mf(n - 12), mf(n - 12), t, 0.18, 0.08, M, 0.003); }
    // pad
    if (st === 0) ch.forEach(n => { const o = this.osc('triangle', mf(n), mf(n), t, 1.9, 0.028, M, 0.3); });
    if (I > 0.3) {
      // arp into delay
      const arpN = ch[[0, 1, 2, 1][st % 4]] + 12 + (st >= 8 ? 12 : 0);
      if (st % 2 === 0 || I > 0.7) this.osc('square', mf(arpN), mf(arpN), t, 0.09, 0.03, this.delay, 0.002);
      this.osc('square', mf(arpN), mf(arpN), t, 0.09, 0.025, M, 0.002);
      // drums
      if (st % 4 === 0) this.osc('sine', 150, 40, t, 0.22, 0.6, M, 0.002);
      if (st === 4 || st === 12) this.nz(t, 0.18, 0.22, 'bandpass', 1800, 1200, 0.8, M);
      if (st % 2 === 1 || (I > 0.75)) this.nz(t, 0.04, st % 4 === 2 ? 0.08 : 0.05, 'highpass', 7000, 7000, 0.7, M);
    }
  }
}
