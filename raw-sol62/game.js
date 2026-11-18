'use strict';

const byId = (id) => document.getElementById(id);
const ui = Object.fromEntries(['game', 'menu', 'over', 'hud', 'score', 'combo', 'combo-fill', 'district',
  'shield', 'magnet', 'toast', 'cue', 'impact', 'final-score', 'best', 'reason', 'sound'].map((id) => [id, byId(id)]));
const visibleGame = window.__game = { state: 'menu', score: 0, combo: 1, alive: false };

class AudioEngine {
  constructor() {
    this.muted = false;
    try { this.muted = localStorage.getItem('night-shift-muted') === 'true'; } catch {}
    this.next = 0;
    this.beat = 0;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      this.ctx = new Audio();
      this.master = this.ctx.createGain();
      this.master.gain.value = .53;
      this.master.connect(this.ctx.destination);
      const n = Math.floor(this.ctx.sampleRate * .28);
      this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const a = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('night-shift-muted', this.muted); } catch {}
    if (!this.muted) this.unlock();
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : .53, this.ctx.currentTime, .025);
    ui.sound.setAttribute('aria-pressed', this.muted);
    ui.sound.setAttribute('aria-label', this.muted ? 'Unmute sound' : 'Mute sound');
  }

  tone(start, end, duration, volume, type = 'sine', time = this.ctx?.currentTime) {
    if (!this.ctx || this.muted) return;
    const osc = this.ctx.createOscillator(), level = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, time);
    osc.frequency.exponentialRampToValueAtTime(end, time + duration);
    level.gain.setValueAtTime(.001, time);
    level.gain.exponentialRampToValueAtTime(volume, time + .012);
    level.gain.exponentialRampToValueAtTime(.001, time + duration);
    osc.connect(level).connect(this.master);
    osc.start(time);
    osc.stop(time + duration + .02);
  }

  hiss(duration, volume, frequency, time = this.ctx?.currentTime) {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), level = this.ctx.createGain();
    src.buffer = this.noise; filter.type = 'highpass'; filter.frequency.value = frequency;
    level.gain.setValueAtTime(volume, time);
    level.gain.exponentialRampToValueAtTime(.001, time + duration);
    src.connect(filter).connect(level).connect(this.master);
    src.start(time); src.stop(time + duration);
  }

  effect(kind, chain = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    switch (kind) {
      case 'coin': {
        const scale = [740, 831, 988, 1109, 1245, 1480];
        const note = scale[chain % scale.length];
        this.tone(note, note * 1.018, .16, .14, 'triangle');
        break;
      }
      case 'jump': this.tone(190, 385, .19, .13, 'triangle'); this.hiss(.11, .06, 800); break;
      case 'slide': this.tone(185, 66, .21, .09, 'triangle'); this.hiss(.22, .14, 450); break;
      case 'lane': this.hiss(.085, .048, 1100); break;
      case 'near': this.tone(415, 622, .17, .13, 'triangle'); this.hiss(.18, .14, 1200); break;
      case 'power':
        [330, 494, 660, 988].forEach((v, i) => this.tone(v, v * 1.01, .29, .12, 'triangle', now + i * .06));
        break;
      case 'shield': this.tone(175, 46, .27, .24, 'square'); this.hiss(.24, .23, 900); break;
      case 'hit': this.tone(112, 31, .42, .33, 'sawtooth'); this.hiss(.28, .35, 420); break;
      case 'start': this.tone(220, 440, .24, .21, 'triangle'); this.next = now; this.beat = 0; break;
    }
  }

  music() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.next < now - .3) this.next = now;
    while (this.next < now + .085) {
      const beat = this.beat++ % 32, step = beat % 8;
      const root = [55, 65.41, 49, 58.27][Math.floor(beat / 8)];
      if (step === 0 || step === 4 || step === 7) this.tone(109, 39, .17, .29, 'sine', this.next);
      if (step === 2 || step === 6) this.hiss(.097, .13, 1600, this.next);
      if (step % 2 || step === 4) this.hiss(.04, .042, 6000, this.next);
      if ([0, 3, 4, 6].includes(step)) {
        const f = root * (step === 6 ? 2 : 1);
        this.tone(f * 1.014, f, .22, .105, 'triangle', this.next);
      }
      if (step === 1 || step === 5) this.tone(root * (step === 1 ? 8 : 12), root * (step === 1 ? 8 : 12), .20, .027, 'sine', this.next);
      this.next += .199;
    }
  }
}

const HAZARDS = {
  low: { half: .86, depth: .34, hit: 'Clipped a construction barrier.' },
  high: { half: .87, depth: .34, hit: 'Hit an overhead sign.' },
  taxi: { half: .93, depth: 1.74, prompt: '← →  SWIPE TO DODGE', hit: 'Ran into a taxi.' },
  van: { half: .98, depth: 2.22, prompt: '← →  SWIPE TO DODGE', hit: 'Ran into a cargo van.' },
  mover: { half: .97, depth: 1.74, prompt: '↔  WATCH THE TRAFFIC', hit: 'Hit moving traffic.' }
};
const POWER_DURATION = { shield: 11, magnet: 9 };

function avatarBatches(batch, p, time, inMenu) {
  const slide = p.crouch, stride = p.stride, airborne = p.y > .035;
  const bounce = airborne || slide > .2 ? 0 : Math.sin(stride * 2) * .025;
  const root = matrix(p.x, p.y + bounce, 0, 1, 1, 1, 0, inMenu ? .24 : p.lean * .16, -p.lean * .13);
  const body = transform(root, matrix(0, mix(1.02, .42, slide), mix(0, .05, slide),
    1, 1, 1, mix(-.145, -.91, slide)));
  const cyan = '#72f5dc', edge = '#4297ad', jacket = '#374d6d', dark = '#1a243e', boot = '#272840';
  const part = (base, kind, x, y, z, w, h, d, color, light = 0, rx = 0, ry = 0, rz = 0) =>
    batch.add(kind, transform(base, matrix(x, y, z, w, h, d, rx, ry, rz)), color, light);
  part(body, 'box', 0, .08, 0, .48, .28, .34, dark);
  part(body, 'box', 0, .34, -.027, .65, .47, .36, jacket);
  part(body, 'box', 0, .38, .17, .58, .43, .043, '#4a738d');
  part(body, 'box', 0, .26, .207, .53, .10, .04, cyan, .64);
  part(body, 'box', 0, .48, .205, .47, .053, .04, edge, .56);
  part(body, 'box', 0, .37, .243, .34, .30, .086, '#213248');
  part(body, 'box', 0, .39, .297, .28, .107, .025, '#5deaca', .42);
  for (const s of [-1, 1]) {
    part(body, 'box', s * .12, .34, .316, .045, .12, .021, '#d6ffe9', .48, 0, 0, -.32);
    part(body, 'box', s * .264, .37, .226, .055, .32, .067, '#61edc9', .24);
  }
  part(body, 'cyl', 0, .64, -.03, .20, .18, .20, dark);
  const head = transform(body, matrix(0, .81, -.067, 1, 1, 1, .08));
  part(head, 'cyl', 0, 0, 0, .46, .32, .45, '#385571');
  part(head, 'cyl', 0, .168, .003, .34, .082, .36, '#556b91');
  part(head, 'box', 0, -.051, -.125, .40, .16, .23, '#111d33');
  part(head, 'box', 0, -.018, -.247, .31, .065, .027, '#a4ffe8', .71);
  part(head, 'box', 0, .008, .202, .27, .05, .018, '#ff5e9e', .85);
  for (const s of [-1, 1]) {
    part(head, 'cyl', s * .23, -.035, .013, .168, .047, .169, edge, .2, 0, 0, Math.PI / 2);
    part(head, 'box', s * .21, .014, .08, .069, .052, .178, cyan, .54);
  }
  for (const s of [-1, 1]) {
    const swing = Math.sin(stride) * s;
    const armAngle = mix(airborne ? swing * .45 - .42 : swing * .86, s * .28 + .15, slide);
    const arm = transform(body, matrix(s * .375, .51, -.02, 1, 1, 1, armAngle, 0, s * .10));
    part(arm, 'box', 0, -.035, 0, .198, .19, .226, jacket);
    part(arm, 'box', 0, -.044, .122, .127, .059, .021, cyan, .54);
    part(arm, 'box', 0, -.19, 0, .149, .31, .173, '#3e5173');
    const elbow = transform(arm, matrix(0, -.345, 0, 1, 1, 1, -.94 + slide * .43));
    part(elbow, 'box', 0, -.10, 0, .136, .23, .169, '#507994');
    part(elbow, 'box', 0, -.238, -.018, .141, .125, .144, dark);
    const hipAngle = mix(airborne ? -.68 + s * .29 : -swing * .86, s === 1 ? 1.42 : 1.15, slide);
    const hip = transform(root, matrix(s * .155, mix(.96, .36, slide), .01, 1, 1, 1, hipAngle, 0, s * .08));
    part(hip, 'box', 0, -.181, 0, .251, .44, .259, '#344064');
    part(hip, 'box', s * .12, -.156, 0, .024, .30, .064, edge, .19);
    const kneeAngle = mix(airborne ? .77 + s * .16 : .12 + Math.max(0, swing) * 1.27, s === 1 ? .19 : .76, slide);
    const knee = transform(hip, matrix(0, -.397, 0, 1, 1, 1, kneeAngle));
    part(knee, 'box', 0, -.16, 0, .195, .37, .213, '#344c6b');
    part(knee, 'box', 0, -.408, -.054, .239, .178, .368, boot);
    part(knee, 'box', 0, -.474, -.048, .242, .043, .375, cyan, .47);
  }
  batch.shape('shadow', p.x, .023, .12, 1.88 + p.y * .18, 2.83, 1, '#030918', .87 - p.y * .22, -Math.PI / 2);
  reflected(batch, p.x, .32, 1.37, 3.74, cyan, .21);
  glow(batch, p.x, p.y + mix(1.38, .72, slide), .8, 1.24, 1.11, cyan, .18);
  if (p.shield > 0 || p.magnet > 0) {
    const col = p.shield > 0 ? '#68ffe5' : '#ff79dd';
    const r = (p.shield > 0 ? 1.03 : 1.17) + Math.sin(time * 6) * .065;
    for (let i = 0; i < 14; i++) {
      const rad = i * TAU / 14 + time * (p.shield > 0 ? 2 : -3.5);
      const x = Math.sin(rad) * r, z = Math.cos(rad) * r;
      const y = .79 + Math.sin(rad * 2 + time * 3) * .57;
      batch.shape('gem', p.x + x, p.y + y, z, .105, .188, .091, col, .72, rad, time);
    }
    glow(batch, p.x, p.y + .93, 1.08, 2.50, 2.23, col, .30);
    reflected(batch, p.x, .45, 3, 4.8, col, .25);
  }
}

class RunnerGame {
  constructor(canvas) {
    this.renderer = new NeonRenderer(canvas);
    this.city = new City(this.renderer);
    this.audio = new AudioEngine();
    ui.sound.setAttribute('aria-pressed', this.audio.muted);
    ui.sound.setAttribute('aria-label', this.audio.muted ? 'Unmute sound' : 'Mute sound');
    this.best = 0;
    try { this.best = Math.max(0, Number(localStorage.getItem('night-shift-best')) || 0); } catch {}
    this.previousFrame = performance.now();
    this.time = 0;
    this.frameAverage = 16.7;
    this.qualityCheck = 0;
    this.fog = [...rgb(DISTRICTS[0].fog)];
    this.rain = Array.from({ length: 68 }, () => ({
      x: (Math.random() - .5) * 29, y: Math.random() * 12,
      z: -Math.random() * 56 + 4, length: .12 + Math.random() * .43
    }));
    this.reset();
    this.installInput();
    this.updateUI();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  reset() {
    this.player = { x: 0, lane: 0, y: 0, vy: 0, lean: 0, crouch: 0, slide: 0, jumpBuffer: 0,
      stride: 0, shield: 0, magnet: 0 };
    this.score = 0; this.chain = 0; this.combo = 1; this.chainTime = 0;
    this.distance = 0; this.age = 0; this.speed = 13.6;
    this.obstacles = []; this.items = []; this.particles = [];
    this.nextRow = 0; this.rng = seeded(13041); this.safeLane = 0;
    this.cameraX = 0; this.shake = 0; this.flash = 0; this.cue = '';
    this.toastTime = 0; this.district = DISTRICTS[0];
    this.opening();
  }

  opening() {
    this.trail(0, 10.8, 6, 3.55);
    this.row(41, [[0, 'low']], 0, 'low', true);
    this.row(67, [[0, 'taxi']], -1, 'flat', true);
    this.row(92.8, [[-1, 'high']], -1, 'high', true);
    this.item('shield', -1, 105.5, .82);
    this.row(124, [[-1, 'van'], [0, 'low']], 0, 'low');
    this.row(151.5, [[0, 'mover', -1]], 1, 'flat', true);
    this.row(179, [[-1, 'taxi'], [1, 'high']], 1, 'high');
    this.item('magnet', 0, 193.3, .88);
    this.trail(0, 197, 4, 3.05);
    this.row(218, [[0, 'van'], [1, 'low']], 1, 'low');
    this.row(245, [[-1, 'taxi'], [1, 'high']], 1, 'high');
    this.nextRow = 274;
    this.safeLane = 0;
  }

  item(kind, lane, z, y = .75) {
    this.items.push({ kind, x: lane * LANE, lane, depth: z, y, pulled: 0 });
  }

  trail(lane, start, count, step, height = .73) {
    for (let i = 0; i < count; i++) this.item('coin', lane, start + step * i, height);
  }

  row(z, obstacles, route, type, tutorial = false) {
    obstacles.forEach(([lane, kind, from], i) => {
      this.obstacles.push({ lane, kind, depth: z, from, tutorial: tutorial && i === 0, near: false });
    });
    const offsets = type === 'low' ? [-6.2, -3.4, 0, 3.3, 6.4] : [-7.1, -3.8, -.4, 3.4, 6.7];
    const heights = type === 'low' ? [.72, 1.44, 2.02, 1.55, .72] : type === 'high' ? [.72, .60, .37, .53, .72] : [.72, .72, .72, .72, .72];
    offsets.forEach((offset, i) => this.item('coin', route, z + offset, heights[i]));
  }

  generate() {
    const r = this.rng;
    while (this.nextRow < this.distance + 135) {
      const z = this.nextRow, difficulty = clamp(z / 1450, 0, 1);
      const choices = [-1, 0, 1];
      const safe = r() < .24 ? this.safeLane : choices[Math.floor(r() * 3)];
      this.safeLane = safe;
      const other = choices.filter((lane) => lane !== safe);
      if (r() < .19 + difficulty * .13 && Math.abs(other[0] - other[1]) === 1) {
        this.row(z, [[other[0], 'mover', other[1]]], safe, 'flat');
      } else {
        const type = r() < .49 ? 'low' : 'high';
        const danger = other.splice(Math.floor(r() * other.length), 1)[0];
        const obstacles = [[danger, r() < .30 ? (r() < .5 ? 'van' : 'taxi') : type]];
        if (r() < .57 + difficulty * .33) obstacles.push([other[0], r() < .6 ? 'taxi' : r() < .55 ? 'low' : 'high']);
        const risky = (obstacles[0][1] === 'low' || obstacles[0][1] === 'high') && r() < .79;
        this.row(z, obstacles, risky ? danger : safe, risky ? type : 'flat');
      }
      if (r() < .24) this.item(r() < .45 ? 'shield' : 'magnet', safe, z + 9.2, .86);
      const sectionSpeed = this.speedAt(z);
      this.nextRow += sectionSpeed * mix(1.64, 1.12, difficulty) + r() * 4;
    }
  }

  speedAt(z) { return 13.6 + 15.1 * (1 - Math.exp(-z / 940)); }

  setState(state) {
    visibleGame.state = state;
    visibleGame.alive = state === 'running';
    ui.menu.hidden = state !== 'menu';
    ui.over.hidden = state !== 'over';
    ui.hud.hidden = state !== 'running';
  }

  start() {
    this.reset();
    this.audio.unlock();
    this.audio.effect('start');
    this.setState('running');
    this.updateUI();
  }

  end(kind) {
    if (!visibleGame.alive) return;
    this.shake = .43; this.flash = .92;
    this.burst(this.player.x, this.player.y + .79, 0, '#ff6a91', 34);
    this.audio.effect('hit');
    const isRecord = Math.floor(this.score) > this.best;
    if (isRecord) {
      this.best = Math.floor(this.score);
      try { localStorage.setItem('night-shift-best', this.best); } catch {}
    }
    ui['final-score'].textContent = Math.floor(this.score).toLocaleString();
    ui.best.textContent = this.best.toLocaleString();
    ui.reason.textContent = HAZARDS[kind].hit + (isRecord ? ' New personal best!' : '');
    this.overAt = performance.now();
    this.setState('over');
    this.updateUI();
  }

  move(direction) {
    if (!visibleGame.alive) return;
    const p = this.player;
    switch (direction) {
      case 'left': case 'right': {
        const before = p.lane;
        p.lane = clamp(p.lane + (direction === 'left' ? -1 : 1), -1, 1);
        if (p.lane !== before) this.audio.effect('lane');
        break;
      }
      case 'up': p.jumpBuffer = .16; break;
      case 'down':
        if (p.slide > .22) break;
        if (p.y > .06) p.vy = -11;
        p.slide = .84;
        this.audio.effect('slide');
        this.burst(p.x, .06, .22, '#ff9e7e', 8);
        break;
    }
  }

  installInput() {
    const startFromMenu = (e) => {
      if (e?.isTrusted && window.matchMedia?.('(pointer: coarse)').matches && ui.game.requestFullscreen && !document.fullscreenElement) {
        ui.game.requestFullscreen().then(() => window.screen.orientation?.lock?.('portrait')).catch(() => {});
      }
      this.start();
    };
    byId('start').addEventListener('click', (e) => {
      if (visibleGame.state === 'menu') startFromMenu(e);
    });
    byId('retry').addEventListener('click', () => { if (visibleGame.state === 'over') this.start(); });
    ui.sound.addEventListener('click', () => this.audio.toggle());
    const keys = {
      arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
      arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down'
    };
    addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase(), move = keys[key];
      if (!move && key !== ' ' && key !== 'enter') return;
      if (e.target.closest?.('button') && (key === 'enter' || key === ' ')) return;
      e.preventDefault();
      if (e.repeat) return;
      if (!visibleGame.alive && (key === ' ' || key === 'enter')) this.start();
      else if (move) this.move(move);
    });
    let swipe = null;
    const measure = (e) => {
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < swipe.threshold) return;
      swipe.didMove = true;
      if (visibleGame.alive) this.move(Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
    };
    ui.game.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button !== 0 || e.target.closest('button')) return;
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, didMove: false,
        threshold: clamp(ui.game.clientWidth * .059, 17, 28) };
      ui.game.setPointerCapture(e.pointerId);
    });
    ui.game.addEventListener('pointermove', (e) => {
      if (swipe?.id === e.pointerId && !swipe.didMove) measure(e);
    });
    ui.game.addEventListener('pointerup', (e) => {
      if (swipe?.id !== e.pointerId) return;
      if (!swipe.didMove) measure(e);
      if (!swipe.didMove && visibleGame.state === 'menu') startFromMenu(e);
      else if (!swipe.didMove && visibleGame.state === 'over' && performance.now() - this.overAt > 260) this.start();
      swipe = null;
    });
    ui.game.addEventListener('pointercancel', () => { swipe = null; });
    ui.game.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      this.previousFrame = performance.now();
      if (!this.audio.ctx) return;
      if (document.hidden) this.audio.ctx.suspend().catch(() => {});
      else if (visibleGame.alive && !this.audio.muted) this.audio.unlock();
    });
    const resize = () => this.renderer.resize();
    addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
  }

  burst(x, y, z, color, count) {
    const cap = Math.min(count, 200 - this.particles.length);
    for (let i = 0; i < cap; i++) {
      const life = .21 + Math.random() * .45;
      this.particles.push({ x, y, z, vx: (Math.random() - .5) * 8, vy: Math.random() * 5,
        vz: -2 + Math.random() * 8, life, max: life, color, size: .028 + Math.random() * .077 });
    }
  }

  reward(points, amount, text) {
    this.chain += amount;
    this.combo = Math.min(8, 1 + Math.floor(this.chain / 4));
    this.chainTime = 3.7;
    this.score += points * this.combo;
    if (text) {
      ui.toast.textContent = text + ' +' + points * this.combo;
      this.toastTime = 1.08;
    }
  }

  collect(item) {
    item.done = true;
    const p = this.player;
    const z = this.distance - item.depth;
    this.burst(item.x, item.y, z, item.kind === 'coin' ? '#ffcf78' :
      item.kind === 'shield' ? '#75ffe6' : '#ff93e5', item.kind === 'coin' ? 6 : 22);
    if (item.kind === 'coin') {
      this.reward(30, 1);
      this.audio.effect('coin', this.chain);
    } else {
      p[item.kind] = POWER_DURATION[item.kind];
      this.reward(175, 2, item.kind === 'shield' ? 'SHIELD READY' : 'MAGNET ON');
      this.audio.effect('power');
    }
  }

  hazardX(o) {
    if (o.kind !== 'mover') return o.lane * LANE;
    const since = this.distance - (o.depth - 33);
    return mix(o.from, o.lane, smooth(since / 25)) * LANE;
  }

  tick(dt) {
    const p = this.player, oldDistance = this.distance;
    this.age += dt;
    this.speed = this.speedAt(this.distance);
    this.distance += this.speed * dt;
    this.score += this.speed * dt * this.combo * 1.15;
    this.chainTime = Math.max(0, this.chainTime - dt);
    if (!this.chainTime) { this.chain = 0; this.combo = 1; }
    p.shield = Math.max(0, p.shield - dt);
    p.magnet = Math.max(0, p.magnet - dt);
    p.stride = (p.stride + dt * (11.2 + (this.speed - 13.6) * .37)) % TAU;
    p.slide = Math.max(0, p.slide - dt);
    const delta = p.lane * LANE - p.x;
    p.x += delta * (1 - Math.exp(-dt * 16.8));
    p.lean = mix(p.lean, clamp(delta * .8, -1, 1), 1 - Math.exp(-dt * 13));
    p.crouch = mix(p.crouch, p.slide > 0 && p.y < .25 ? 1 : 0, 1 - Math.exp(-dt * 20));
    if (p.jumpBuffer > 0 && p.y <= 0 && p.slide < .19) {
      p.vy = 8.55; p.slide = 0; p.jumpBuffer = 0;
      this.audio.effect('jump');
      this.burst(p.x, .07, 0, '#72edd5', 7);
    }
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    if (p.y > 0 || p.vy > 0) {
      p.vy -= 22.0 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0; p.vy = 0;
        this.burst(p.x, .06, 0, '#7ee5d3', 6);
      }
    } else { p.y = 0; p.vy = 0; }
    for (const item of this.items) {
      const relative = this.distance - item.depth;
      if (item.done || relative < -11 || relative > 4) continue;
      if (item.kind === 'coin' && p.magnet > 0 && relative > -8.5) {
        item.pulled = Math.min(1, item.pulled + dt * 5);
        item.x = mix(item.x, p.x, 1 - Math.exp(-dt * 12));
        item.y = mix(item.y, p.y + .71, 1 - Math.exp(-dt * 12));
        if (relative > -2.7 && item.pulled > .42) this.collect(item);
      } else {
        const closest = clamp(item.depth - oldDistance, 0, this.distance - oldDistance);
        const heightDelta = item.y - p.y;
        if (Math.abs(oldDistance + closest - item.depth) < .9 && Math.abs(item.x - p.x) < .72 &&
          heightDelta > -.12 && heightDelta < (p.crouch > .6 ? .92 : 1.74)) this.collect(item);
      }
    }
    this.cue = '';
    for (const o of this.obstacles) {
      if (o.done) continue;
      const h = HAZARDS[o.kind], z = this.distance - o.depth;
      if (z < -111) continue;
      const x = this.hazardX(o);
      const proximity = Math.abs(x - p.x);
      if (o.tutorial && z > -23 && z < -1 && (proximity < 1.3 || o.kind === 'mover')) {
        if (o.kind === 'low' && p.y < .1) this.cue ||= z < -5.6 ? '↑  BARRIER AHEAD' : '↑  JUMP NOW';
        else if (o.kind === 'high' && p.crouch < .6) this.cue ||= z < -7.3 ? '↓  LOW SIGN AHEAD' : '↓  SLIDE NOW';
        else if (o.kind !== 'low' && o.kind !== 'high') this.cue ||= h.prompt;
      }
      const action = o.kind === 'low' ? p.y > .72 : o.kind === 'high' && p.crouch > .64 && p.y < .3;
      if (z >= -h.depth - .26 && this.distance - oldDistance + h.depth + .28 >= z) {
        if (proximity < h.half + .27) {
          if (action) o.clean = true;
          else if (p.shield > 0) {
            p.shield = 0;
            o.done = true;
            this.shake = .28; this.flash = .51;
            this.burst(x, .82, z, '#83ffe6', 30);
            this.audio.effect('shield');
            this.reward(60, 1, 'SHIELD BLOCK');
          } else {
            this.end(o.kind);
            return;
          }
        } else if (proximity < 2.83) {
          o.near = true;
        }
      }
      if (z > h.depth + .3) {
        if (o.clean || o.near) {
          this.reward(o.clean ? 110 : 85, 2, o.clean ? (o.kind === 'low' ? 'CLEAN VAULT' : 'LOW CLEARANCE') : 'NEAR MISS');
          this.audio.effect('near');
          this.burst(p.x, .61 + p.y, -.15, '#ffd282', 9);
        }
        o.done = true;
      }
    }
    this.items = this.items.filter((i) => !i.done && this.distance - i.depth < 4);
    this.obstacles = this.obstacles.filter((o) => !o.done || this.distance - o.depth < 14);
    this.generate();
    this.audio.music();
  }

  updateUI() {
    const score = Math.floor(this.score);
    visibleGame.score = score;
    visibleGame.combo = this.combo;
    if (!visibleGame.alive) return;
    if (score !== this.lastScore) {
      ui.score.textContent = String(score).padStart(6, '0');
      this.lastScore = score;
    }
    if (this.combo !== this.lastCombo) {
      ui.combo.textContent = '×' + this.combo;
      this.lastCombo = this.combo;
    }
    ui['combo-fill'].style.width = this.chainTime / 3.7 * 100 + '%';
    const district = districtAt(this.distance);
    if (district !== this.district || !this.age) {
      this.district = district;
      ui.district.lastElementChild.textContent = district.name;
      ui.district.firstElementChild.style.background = district.accent;
    }
    for (const power of ['shield', 'magnet']) {
      const t = this.player[power], el = ui[power];
      el.hidden = t <= 0;
      if (t > 0) {
        el.children[1].textContent = Math.ceil(t) + 's';
        el.children[2].style.width = t / POWER_DURATION[power] * 100 + '%';
      }
    }
    if (ui.cue.textContent !== this.cue) ui.cue.textContent = this.cue;
    ui.cue.classList.toggle('now', this.cue.endsWith('NOW'));
    ui.cue.style.opacity = this.cue ? 1 : 0;
    ui.toast.style.opacity = clamp(this.toastTime * 3.6, 0, 1);
  }

  drawItem(b, item) {
    const d = this.distance - item.depth;
    const z = d + item.pulled * 2.4;
    if (z > 5 || z < -100) return;
    const t = this.time, hover = Math.sin(t * 6.5 + item.depth * .31) * .075;
    const y = item.y + hover, x = item.x;
    const kind = item.kind;
    const color = kind === 'shield' ? '#7bffe5' : kind === 'magnet' ? '#ff82de' : '#ffce73';
    if (kind === 'coin') {
      b.shape('gem', x, y, z, .36, .48, .24, color, .78, .12, t * 4.7 + item.depth * .17);
      b.shape('gem', x, y, z + .025, .155, .251, .11, '#fff4c4', .64, .12, t * 4.7 + item.depth * .17);
      glow(b, x, y, z + .18, .92, .90, color, .26);
    } else {
      b.shape('gem', x, y, z, .70, .87, .58, color, .52, .05, t * 2.4);
      b.shape('gem', x, y + .03, z + .25, .29, .33, .21, '#f2fffb', .78, .08, -t * 3);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + t * 2.5;
        b.shape('gem', x + Math.cos(a) * .59, y + Math.sin(a) * .57, z + .33, .10, .15, .09, color, .79);
      }
      glow(b, x, y, z + .52, 2, 2.2, color, .52);
      reflected(b, x, z + .45, 1.24, 2.68, color, .29);
    }
  }

  drawHazard(b, o) {
    const z = this.distance - o.depth;
    if (z > 11 || z < -120) return;
    const x = this.hazardX(o);
    const angle = o.kind === 'mover' ? Math.sign(o.lane - o.from) *
      Math.sin(Math.PI * clamp((z + 33) / 25, 0, 1)) * .28 : 0;
    emitModel(b, VEHICLES[o.kind], matrix(x, 0, z, 1, 1, 1, 0, angle));
  }

  effects(dt, b) {
    const active = visibleGame.alive;
    const drift = active ? this.speed : 1.7;
    for (const p of this.rain) {
      p.z += dt * (drift + .4); p.y -= dt * 4.3; p.x += dt * .45;
      if (p.z > 6 || p.y < .08 || p.x > 14.5) {
        p.z = -3 - Math.random() * 53;
        p.y = 7 + Math.random() * 6; p.x = (Math.random() - .5) * 28;
      }
      const length = p.length * (active ? mix(1, 2.3, (this.speed - 13.6) / 15.1) : 1);
      box(b, p.x, p.y, p.z, .011, length, .011, '#68819e', .26, -.48, 0, -.27);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= dt * 8;
      if (p.y < .023) { p.y = .023; p.vy *= -.31; }
      const s = p.size * (.4 + p.life / p.max * .6);
      box(b, p.x, p.y, p.z, s, s, s * 2.4, p.color, .65, p.life * 11, p.life * 17);
    }
  }

  movingTrains(b) {
    const current = Math.floor(this.distance / BLOCK);
    for (let i = current; i <= current + 2; i++) {
      if (districtIndex(i) !== 3) continue;
      const z = this.distance - (i * BLOCK + 23.6);
      if (z > -10 || z < -82) continue;
      const side = i % 2 ? -1 : 1;
      emitModel(b, VEHICLES.train, matrix(side * mix(42, -42, (z + 82) / 72), .125, z));
    }
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    const elapsed = now - this.previousFrame;
    this.previousFrame = now;
    const dt = clamp(elapsed / 1000, 0, .075);
    if (document.hidden) return;
    this.time += dt;
    this.frameAverage = mix(this.frameAverage, Math.min(65, elapsed), .024);
    this.qualityCheck += dt;
    if (this.qualityCheck > 2.7) {
      this.qualityCheck = 0;
      const floor = Math.min(1, devicePixelRatio || 1);
      if (this.frameAverage > 21.5 && this.renderer.quality > floor + .01) {
        this.renderer.quality = Math.max(floor, this.renderer.quality * .89);
        this.renderer.resize();
      }
    }
    const active = visibleGame.alive;
    if (active) {
      const steps = Math.max(1, Math.ceil(dt * 100));
      for (let i = 0; i < steps && visibleGame.alive; i++) this.tick(dt / steps);
    }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt * 2.55);
    this.toastTime = Math.max(0, this.toastTime - dt);
    ui.impact.style.opacity = this.flash;
    this.updateUI();
    const inMenu = visibleGame.state === 'menu';
    const display = inMenu ? { ...this.player, x: -.13 + Math.sin(this.time * 1.3) * .09,
      stride: this.time * 5.7, lean: -.12 } : this.player;
    const batch = new Batch();
    this.city.ground(batch);
    this.obstacles.forEach((o) => this.drawHazard(batch, o));
    this.items.forEach((i) => this.drawItem(batch, i));
    this.movingTrains(batch);
    avatarBatches(batch, display, this.time, inMenu);
    this.effects(dt, batch);
    this.cameraX = mix(this.cameraX, display.x * .35, 1 - Math.exp(-dt * 5.5));
    const shakeX = this.shake * Math.sin(this.time * 82);
    const shakeY = this.shake * Math.cos(this.time * 107) * .50;
    const bob = active ? Math.cos(this.player.stride * 2) * .044 : Math.sin(this.time * 1.37) * .07;
    const eye = [this.cameraX + shakeX, (inMenu ? 3.10 : 3.92) + bob + this.player.y * .20 + shakeY, inMenu ? 6.35 : 6.25];
    const target = [this.cameraX * .56, inMenu ? -1.55 : .82 + this.player.y * .19, -15.45];
    const fov = 1.01 + clamp((this.speed - 13.6) / 140, 0, .105);
    const fogTarget = rgb(this.district.fog);
    this.fog = this.fog.map((v, i) => mix(v, fogTarget[i], 1 - Math.exp(-dt * 1.6)));
    this.renderer.draw(batch, this.city.prepare(this.distance), { eye, target, fov }, this.distance, this.fog);
  }
}

try {
  new RunnerGame(byId('world'));
} catch (error) {
  console.error(error);
  ui.menu.hidden = true;
  byId('error').hidden = false;
}
