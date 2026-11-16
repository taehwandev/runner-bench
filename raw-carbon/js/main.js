import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SoundEngine } from './audio.js';
import { createTextureLibrary } from './textures.js';
import { ModelFactory } from './models.js';
import { CityWorld, LANES } from './world.js';

const BEST_SCORE_KEY = 'neon_rush_best_score_v1';

const POWERUP_META = {
  shield: { label: 'SHIELD', duration: 12.0, color: '#00f0ff' },
  magnet: { label: 'MAGNET', duration: 9.5, color: '#ffc400' },
  dash: { label: 'NITRO DASH', duration: 4.6, color: '#39ff14' },
  chrono: { label: 'SLOW-TIME', duration: 6.5, color: '#b65cff' }
};

class NeonRunnerGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.fxCanvas = document.getElementById('fx-canvas');
    this.fxCtx = this.fxCanvas.getContext('2d');

    // UI Elements
    this.ui = {
      hud: document.getElementById('hud'),
      score: document.getElementById('hud-score'),
      distance: document.getElementById('hud-distance'),
      speed: document.getElementById('hud-speed'),
      best: document.getElementById('hud-best'),
      comboCard: document.getElementById('combo-card'),
      combo: document.getElementById('hud-combo'),
      comboFill: document.getElementById('hud-combo-fill'),
      districtBanner: document.getElementById('district-banner'),
      districtName: document.getElementById('district-name'),
      powerupRack: document.getElementById('powerup-rack'),
      calloutLayer: document.getElementById('callout-layer'),
      damageFlash: document.getElementById('damage-flash'),
      startScreen: document.getElementById('start-screen'),
      startBest: document.getElementById('start-best-score'),
      btnStart: document.getElementById('btn-start'),
      gameoverScreen: document.getElementById('gameover-screen'),
      newBestBadge: document.getElementById('new-best-badge'),
      finalScore: document.getElementById('final-score'),
      finalBest: document.getElementById('final-best'),
      statDistance: document.getElementById('stat-distance'),
      statCombo: document.getElementById('stat-combo'),
      statNearMiss: document.getElementById('stat-nearmiss'),
      statShards: document.getElementById('stat-shards'),
      btnRestart: document.getElementById('btn-restart'),
      btnMute: document.getElementById('btn-mute'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off')
    };

    // Core State
    this.state = 'start'; // 'start' | 'playing' | 'gameover'
    this.alive = false;
    this.score = 0;
    this.bestScore = this._loadBestScore();
    this.distance = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboHeat = 0;
    this.comboGraceTimer = 0;
    this.nearMissCount = 0;
    this.shardCount = 0;

    // Speed & Timers
    this.baseSpeed = 21.5;
    this.worldSpeed = 12;
    this.elapsed = 0;
    this.invulnTimer = 0;
    this.hitStopTimer = 0;
    this.districtBannerTimer = 0;

    // Active Power-Up Timers (seconds remaining)
    this.activePowerups = {
      shield: 0,
      magnet: 0,
      dash: 0,
      chrono: 0
    };

    // Runner Physics State
    this.runnerState = {
      lane: 0, // -1, 0, +1
      prevLane: 0,
      lastLaneSwitchAt: -10,
      x: 0,
      y: 0,
      vy: 0,
      jumping: false,
      sliding: false,
      slideTimer: 0,
      slamming: false,
      runPhase: 0,
      bankAngle: 0,
      squashY: 1,
      slideSparkAccum: 0
    };

    // Input Queue Buffer for ultra-snappy response
    this.inputQueue = [];

    // Camera & Screen Shake
    this.camShake = 0;
    this.camPos = new THREE.Vector3(0, 4.2, 8.2);
    this.camLook = new THREE.Vector3(0, 1.4, -14);
    this.baseFov = 72;
    this.baseCamZ = 8.2;
    this.baseCamY = 4.25;

    // 2D Speed lines seeds
    this.speedLines = Array.from({ length: 34 }, (_, i) => ({
      angle: (i / 34) * Math.PI * 2 + Math.random() * 0.15,
      len: 0.14 + Math.random() * 0.22,
      phase: Math.random()
    }));

    // Adaptive GPU Performance Monitor
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.currentDpr = Math.min(window.devicePixelRatio || 1, 1.85);
    this.useBloom = true;
    this.fpsSampleAccum = 0;
    this.fpsSampleFrames = 0;

    this._initAudioAndScene();
    this._bindEvents();
    this._handleResize();
    this._updateBestUI();
    this._syncGlobalGameObj();

    this.lastFrameTime = performance.now();
    requestAnimationFrame((now) => this._loop(now));
  }

  _loadBestScore() {
    try {
      const raw = window.localStorage.getItem(BEST_SCORE_KEY);
      const parsed = parseInt(raw || '0', 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (_) {
      return 0;
    }
  }

  _saveBestScore(val) {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(val)));
    } catch (_) {
      // Ignore storage quota / sandboxed iframe errors
    }
  }

  _syncGlobalGameObj() {
    if (!window.__game) {
      window.__game = { state: 'start', score: 0, combo: 1, alive: false };
    }
    window.__game.state = this.state;
    window.__game.score = Math.floor(this.score);
    window.__game.combo = this.combo;
    window.__game.alive = this.alive;
  }

  _initAudioAndScene() {
    this.sound = new SoundEngine();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // Post-processing + high-DPR gives clean edges at much lower mobile fillrate cost
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.currentDpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.25, 225);

    this.textures = createTextureLibrary(this.renderer);
    this.scene.environment = this.textures.envMap;

    this.factory = new ModelFactory(this.textures);
    this.world = new CityWorld(this.scene, this.factory, this.textures, this.sound);

    this.runner = this.factory.createRunner();
    this.scene.add(this.runner.group);

    // Setup Post-Processing (UnrealBloomPass at half internal mip chain)
    try {
      const w = window.innerWidth || 412;
      const h = window.innerHeight || 915;
      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(this.currentDpr);
      this.composer.setSize(w, h);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5))),
        0.62, // strength
        0.42, // radius
        0.74  // threshold — blooms neon signs, headlights, sparks & shards cleanly
      );
      const outputPass = new OutputPass();

      this.composer.addPass(renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(outputPass);
    } catch (_) {
      this.composer = null;
      this.useBloom = false;
    }

    this.world.reset();
  }

  // ================= INPUT & PORTRAIT VIEWPORT HANDLING =================
  _bindEvents() {
    window.addEventListener('resize', () => this._handleResize());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this._handleResize());
    }

    // Prevent context menu & pinch/pull-to-refresh gestures
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

    // Start & Restart Buttons + Full-Overlay Tap Support
    this.ui.btnStart.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === 'start') this.startGame();
    });

    this.ui.startScreen.addEventListener('click', () => {
      if (this.state === 'start') this.startGame();
    });

    this.ui.btnRestart.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.state === 'gameover') this.startGame();
    });

    this.ui.gameoverScreen.addEventListener('click', () => {
      if (this.state === 'gameover') this.startGame();
    });

    // Mute Toggle
    this.ui.btnMute.addEventListener('click', (e) => {
      e.stopPropagation();
      this.sound.init();
      const muted = this.sound.toggleMute();
      this.ui.iconSoundOn.classList.toggle('hidden', muted);
      this.ui.iconSoundOff.classList.toggle('hidden', !muted);
    });

    // Responsive Touch Swipe Gesture Engine (triggers mid-move for zero input lag!)
    let touchActive = false;
    let startX = 0;
    let startY = 0;
    let startState = 'start';
    let gestureConsumed = false;

    const SWIPE_THRESHOLD = 24;

    window.addEventListener(
      'touchstart',
      (e) => {
        this.sound.init();
        if (!e.touches || e.touches.length === 0) return;

        const target = e.target;
        if (target && target.closest && target.closest('#btn-mute')) return;

        startState = this.state;
        if (this.state === 'playing') {
          e.preventDefault();
        }

        const t = e.touches[0];
        touchActive = true;
        startX = t.clientX;
        startY = t.clientY;
        gestureConsumed = false;
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.state === 'playing') {
          e.preventDefault();
        }
        if (!touchActive || gestureConsumed || this.state !== 'playing') return;
        if (!e.touches || e.touches.length === 0) return;

        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;

        if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
          this._dispatchSwipe(dx, dy);
          gestureConsumed = true;
          // Re-anchor so player can reverse swipe direction in one continuous thumb motion if desired
          startX = t.clientX;
          startY = t.clientY;
        }
      },
      { passive: false }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        if (!touchActive) return;
        touchActive = false;

        // Instant tap start / restart when touch began on Start or Game Over overlay
        if (this.state === 'start' && startState === 'start') {
          this.startGame();
          return;
        }
        if (this.state === 'gameover' && startState === 'gameover') {
          this.startGame();
          return;
        }

        if (!gestureConsumed && this.state === 'playing' && e.changedTouches && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          const dx = t.clientX - startX;
          const dy = t.clientY - startY;
          if (Math.hypot(dx, dy) >= 16) {
            this._dispatchSwipe(dx, dy);
          }
        }
      },
      { passive: true }
    );

    // Mouse Drag Swipe Support (for desktop / automated pointer testing)
    let mouseDown = false;
    let mStartX = 0;
    let mStartY = 0;
    let mConsumed = false;

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.sound.init();
      mouseDown = true;
      mStartX = e.clientX;
      mStartY = e.clientY;
      mConsumed = false;
    });

    window.addEventListener('pointermove', (e) => {
      if (!mouseDown || mConsumed || e.pointerType !== 'mouse' || this.state !== 'playing') return;
      const dx = e.clientX - mStartX;
      const dy = e.clientY - mStartY;
      if (Math.hypot(dx, dy) >= 28) {
        this._dispatchSwipe(dx, dy);
        mConsumed = true;
      }
    });

    window.addEventListener('pointerup', () => {
      mouseDown = false;
    });

    // Secondary Keyboard Input (Arrows + WASD + Space/Enter + M)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.sound.init();

      if (e.code === 'KeyM') {
        this.ui.btnMute.click();
        return;
      }

      if (this.state === 'start' || this.state === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          this.startGame();
        }
        return;
      }

      if (this.state !== 'playing') return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          this._queueAction('left');
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          this._queueAction('right');
          break;
        case 'ArrowUp':
        case 'KeyW':
        case 'Space':
          e.preventDefault();
          this._queueAction('up');
          break;
        case 'ArrowDown':
        case 'KeyS':
          e.preventDefault();
          this._queueAction('down');
          break;
      }
    });
  }

  _dispatchSwipe(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 1.05) {
      this._queueAction(dx < 0 ? 'left' : 'right');
    } else {
      this._queueAction(dy < 0 ? 'up' : 'down');
    }
  }

  _queueAction(action) {
    this.inputQueue.push({ action, expires: this.elapsed + 0.18 });
    this._processInputQueue();
  }

  _processInputQueue() {
    if (this.state !== 'playing' || !this.alive) {
      this.inputQueue.length = 0;
      return;
    }

    const r = this.runnerState;
    for (let i = 0; i < this.inputQueue.length; i++) {
      const item = this.inputQueue[i];
      if (item.expires < this.elapsed) {
        this.inputQueue.splice(i, 1);
        i--;
        continue;
      }

      const act = item.action;
      if (act === 'left' || act === 'right') {
        const delta = act === 'left' ? -1 : 1;
        const target = Math.max(-1, Math.min(1, r.lane + delta));
        if (target !== r.lane) {
          r.prevLane = r.lane;
          r.lastLaneSwitchAt = this.elapsed;
          r.lane = target;
          r.bankAngle = -delta * 0.36;
          this.sound.playLaneSwitch(delta);
        }
        this.inputQueue.splice(i, 1);
        i--;
      } else if (act === 'up') {
        // Can jump from ground OR cancel a slide immediately into a jump!
        if (!r.jumping) {
          r.jumping = true;
          r.sliding = false;
          r.slideTimer = 0;
          r.slamming = false;
          r.vy = 13.8;
          r.squashY = 1.24;
          this.sound.playJump();
          this.world.particles.emit(r.x, 0.12, 0, 10, {
            color: 0x00f0ff,
            speed: 3.8,
            upBias: 2.2,
            life: 0.35
          });
          this.inputQueue.splice(i, 1);
          i--;
        }
      } else if (act === 'down') {
        if (r.jumping) {
          // Airborne Fast-Fall Slam -> transitions straight into Slide on landing!
          if (!r.slamming) {
            r.slamming = true;
            r.vy = Math.min(r.vy, -27);
            this.sound.playSlam();
          }
          this.inputQueue.splice(i, 1);
          i--;
        } else {
          r.sliding = true;
          r.slideTimer = 0.82;
          r.squashY = 0.68;
          this.sound.playSlide();
          this.inputQueue.splice(i, 1);
          i--;
        }
      }
    }
  }

  _handleResize() {
    const vv = window.visualViewport;
    const w = Math.max(240, Math.round(vv ? vv.width : window.innerWidth));
    const h = Math.max(320, Math.round(vv ? vv.height : window.innerHeight));
    const aspect = w / h;

    this.camera.aspect = aspect;

    // Portrait-optimized framing (e.g. Pixel 10 Pro XL: 412x915, aspect ~0.45)
    if (aspect < 0.75) {
      this.baseFov = THREE.MathUtils.clamp(74 + (0.52 - aspect) * 26, 68, 80);
      this.baseCamZ = 8.4;
      this.baseCamY = 4.35;
    } else if (aspect < 1.1) {
      this.baseFov = 66;
      this.baseCamZ = 7.6;
      this.baseCamY = 4.0;
    } else {
      this.baseFov = 58;
      this.baseCamZ = 6.8;
      this.baseCamY = 3.75;
    }
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(this.currentDpr);
    this.renderer.setSize(w, h, false);

    if (this.composer) {
      this.composer.setPixelRatio(this.currentDpr);
      this.composer.setSize(w, h);
      if (this.bloomPass) {
        this.bloomPass.resolution.set(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
      }
    }

    this.fxCanvas.width = w;
    this.fxCanvas.height = h;
  }

  // ================= GAME LIFECYCLE =================
  startGame() {
    this.sound.init();
    this.sound.startMusic();

    this.state = 'playing';
    this.alive = true;
    this.score = 0;
    this.distance = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboHeat = 0;
    this.comboGraceTimer = 0;
    this.nearMissCount = 0;
    this.shardCount = 0;

    this.baseSpeed = 21.5;
    this.worldSpeed = 21.5;
    this.invulnTimer = 0.6;
    this.hitStopTimer = 0;
    this.camShake = 0;

    this.activePowerups.shield = 0;
    this.activePowerups.magnet = 0;
    this.activePowerups.dash = 0;
    this.activePowerups.chrono = 0;
    this.inputQueue.length = 0;

    Object.assign(this.runnerState, {
      lane: 0,
      prevLane: 0,
      lastLaneSwitchAt: -10,
      x: 0,
      y: 0,
      vy: 0,
      jumping: false,
      sliding: false,
      slideTimer: 0,
      slamming: false,
      runPhase: 0,
      bankAngle: 0,
      squashY: 1,
      slideSparkAccum: 0
    });
    this.runner.group.visible = true;
    this.runner.group.position.set(0, 0, 0);
    this.runner.group.rotation.set(0, 0, 0);

    this.world.reset();

    this.ui.startScreen.classList.add('hidden');
    this.ui.gameoverScreen.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.calloutLayer.innerHTML = '';
    this.ui.powerupRack.innerHTML = '';

    this._showDistrictBanner('SHIBUYA NEON CORE');
    this._updateHUD();
    this._syncGlobalGameObj();
  }

  triggerGameOver() {
    if (!this.alive) return;

    this.alive = false;
    this.state = 'gameover';
    this.sound.stopMusic();
    this.sound.playCrash();

    this.camShake = 1.0;
    this._flashDamage(0.85);

    this.world.particles.emit(this.runnerState.x, this.runnerState.y + 0.8, 0, 42, {
      color: 0xff1e8a,
      altColor: 0x00f0ff,
      speed: 9.5,
      upBias: 5.2,
      life: 0.85
    });

    const finalScoreInt = Math.floor(this.score);
    const isNewBest = finalScoreInt > this.bestScore;
    if (isNewBest) {
      this.bestScore = finalScoreInt;
      this._saveBestScore(this.bestScore);
    }

    this._updateBestUI();
    this.ui.finalScore.textContent = finalScoreInt.toLocaleString();
    this.ui.finalBest.textContent = this.bestScore.toLocaleString();
    this.ui.statDistance.textContent = `${Math.floor(this.distance)}m`;
    this.ui.statCombo.textContent = `x${this.maxCombo}`;
    this.ui.statNearMiss.textContent = String(this.nearMissCount);
    this.ui.statShards.textContent = String(this.shardCount);
    this.ui.newBestBadge.classList.toggle('hidden', !isNewBest);

    this.ui.hud.classList.add('hidden');
    this.ui.gameoverScreen.classList.remove('hidden');

    this._syncGlobalGameObj();
  }

  // ================= MAIN UPDATE LOOP =================
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));

    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastFrameTime) / 1000));
    this.lastFrameTime = now;
    this.elapsed += rawDt;

    // Adaptive GPU Quality Guard (ensures 60fps on phone GPUs)
    this.fpsSampleAccum += rawDt;
    this.fpsSampleFrames++;
    if (this.fpsSampleAccum >= 2.5) {
      const avgFps = this.fpsSampleFrames / this.fpsSampleAccum;
      if (avgFps < 46 && this.currentDpr > 1.2) {
        this.currentDpr = Math.max(1.15, this.currentDpr - 0.35);
        this._handleResize();
      } else if (avgFps < 40 && this.useBloom) {
        this.useBloom = false;
      }
      this.fpsSampleAccum = 0;
      this.fpsSampleFrames = 0;
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= rawDt;
      this._renderScene();
      return;
    }

    if (this.state === 'playing' && this.alive) {
      this._updatePlaying(rawDt);
    } else {
      this._updateAttractOrGameover(rawDt);
    }

    this.sound.update(rawDt, {
      inTunnel: this.world.inTunnel,
      slowTime: this.activePowerups.chrono > 0,
      speedRatio: Math.min(1, (this.baseSpeed - 21.5) / 22),
      combo: this.combo
    });

    this._syncGlobalGameObj();
    this._renderScene();
    this._render2DFX(rawDt);
  }

  _updateAttractOrGameover(dt) {
    // Live animated night-city showcase behind Start / Game Over overlays
    const cruiseSpeed = this.state === 'start' ? 13.5 : Math.max(0, this.worldSpeed * 0.92);
    if (this.state === 'gameover') {
      this.worldSpeed = cruiseSpeed;
    }

    this.world.update(dt, cruiseSpeed, this.distance, this.elapsed, { x: 0, y: 0 }, false);

    if (this.state === 'start') {
      // Hero idle / light jog pose framed dramatically against neon street
      this._animateRunner(dt, 11, true);
      const swayX = Math.sin(this.elapsed * 0.65) * 1.15;
      this.camPos.set(swayX, this.baseCamY - 0.55, this.baseCamZ - 1.1);
      this.camLook.set(0, 1.45, -16);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    } else {
      // Crashed recoil camera settle
      this.camShake = Math.max(0, this.camShake - dt * 2.4);
      const sx = (Math.random() - 0.5) * this.camShake * 0.45;
      const sy = (Math.random() - 0.5) * this.camShake * 0.45;
      this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
      this.camera.lookAt(this.camLook);
      this.runner.bodyPivot.rotation.x = THREE.MathUtils.lerp(this.runner.bodyPivot.rotation.x, -0.85, dt * 8);
      this.runner.bodyPivot.position.y = THREE.MathUtils.lerp(this.runner.bodyPivot.position.y, -0.35, dt * 8);
    }
  }

  _updatePlaying(dt) {
    this._processInputQueue();

    // 1. Update Active Power-Up Timers
    for (const key of Object.keys(this.activePowerups)) {
      if (this.activePowerups[key] > 0) {
        const prev = this.activePowerups[key];
        this.activePowerups[key] = Math.max(0, prev - dt);
        // Brief safety grace when Nitro Dash ends!
        if (key === 'dash' && prev > 0 && this.activePowerups.dash === 0) {
          this.invulnTimer = Math.max(this.invulnTimer, 1.15);
          this._clearImmediateHazards(9.0);
        }
      }
    }
    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }

    const dashActive = this.activePowerups.dash > 0;
    const chronoActive = this.activePowerups.chrono > 0;
    const magnetActive = this.activePowerups.magnet > 0;
    const shieldActive = this.activePowerups.shield > 0;

    // 2. Smooth Speed Ramp + Power-Up Modifiers
    this.baseSpeed = 21.5 + 22.5 * (1 - Math.exp(-this.distance / 1350));
    const speedMult = dashActive ? 1.62 : chronoActive ? 0.58 : 1.0;
    const targetSpeed = this.baseSpeed * speedMult;
    this.worldSpeed = THREE.MathUtils.lerp(this.worldSpeed, targetSpeed, Math.min(1, dt * 6.5));

    const worldDt = dt;
    const distStep = this.worldSpeed * worldDt;
    this.distance += distStep * 0.48; // Calibrated meters
    this.score += distStep * 1.45 * this.combo;

    // District progression every 360m (~20s of running so player sees new districts early!)
    const targetDistrict = Math.floor(this.distance / 360) % 4;
    if (targetDistrict !== this.world.currentDistrictIdx) {
      const dName = this.world.setDistrict(targetDistrict, false);
      this._showDistrictBanner(dName);
    }

    // 3. Runner Lateral & Vertical Physics (unaffected by Chrono slow-down so agility feels godlike!)
    const r = this.runnerState;
    const targetX = LANES[r.lane + 1];
    r.x = THREE.MathUtils.lerp(r.x, targetX, 1 - Math.exp(-21 * dt));
    r.bankAngle = THREE.MathUtils.lerp(r.bankAngle, (r.x - targetX) * 0.16, 1 - Math.exp(-16 * dt));
    r.squashY = THREE.MathUtils.lerp(r.squashY, 1.0, 1 - Math.exp(-14 * dt));

    if (r.jumping) {
      r.y += r.vy * dt;
      r.vy -= 36.5 * dt;
      if (r.y <= 0) {
        r.y = 0;
        r.vy = 0;
        r.jumping = false;
        if (r.slamming) {
          r.slamming = false;
          r.sliding = true;
          r.slideTimer = 0.62;
          r.squashY = 0.62;
          this.camShake = Math.max(this.camShake, 0.35);
          this.world.particles.emit(r.x, 0.1, 0, 22, {
            color: 0x00f0ff,
            altColor: 0xff1e8a,
            speed: 7.5,
            upBias: 2.0,
            life: 0.45
          });
        } else {
          r.squashY = 0.82;
        }
        // Immediately execute buffered jump/slide on exact touchdown frame!
        this._processInputQueue();
      }
    }

    if (r.sliding) {
      r.slideTimer -= dt;
      r.slideSparkAccum += dt;
      if (r.slideSparkAccum >= 0.04) {
        r.slideSparkAccum = 0;
        this.world.particles.emit(r.x, 0.12, 0.25, 3, {
          color: 0xffaa00,
          altColor: 0x00f0ff,
          speed: 3.6,
          upBias: 2.2,
          life: 0.26
        });
      }
      if (r.slideTimer <= 0) {
        r.sliding = false;
      }
    }

    // 4. Advance World, Traffic, Collectibles & Particles
    this.world.update(worldDt, this.worldSpeed, this.distance, this.elapsed, r, magnetActive || dashActive);

    // 5. Evaluate Collisions, Near-Misses, Collectibles & Power-Ups
    this._evaluateInteractions(dashActive, shieldActive, chronoActive);

    // 6. Combo Decay Logic
    if (this.comboGraceTimer > 0) {
      this.comboGraceTimer -= dt;
    } else if (this.comboHeat > 0 || this.combo > 1) {
      this.comboHeat -= dt * 0.22;
      if (this.comboHeat <= 0) {
        if (this.combo > 1) {
          this.combo--;
          this.comboHeat = 0.55;
        } else {
          this.comboHeat = 0;
        }
      }
    }

    // 7. Animate Runner Rig & Dynamic 3rd-Person Camera
    this._animateRunner(dt, this.worldSpeed, false);
    this._updateCamera(dt, dashActive, chronoActive);
    this._updateHUD();
  }

  _evaluateInteractions(dashActive, shieldActive, chronoActive) {
    const r = this.runnerState;
    const runnerBottom = r.y;
    const isTucked = r.sliding || r.slamming;
    const runnerTop = r.y + (isTucked ? 0.72 : 1.68);
    const runnerHalfW = 0.34;
    const runnerHalfZ = 0.34;

    // ---- Shards & Risk Cores ----
    for (const s of this.world.shards) {
      if (s.collected) continue;
      const dx = Math.abs(s.x - r.x);
      const dy = Math.abs(s.y - (r.y + 0.85));
      const dz = Math.abs(s.z);
      if (dx < 0.92 && dy < 1.15 && dz < 1.15) {
        s.collected = true;
        this.shardCount++;

        const basePts = s.isRisk ? 100 : 25;
        const pts = basePts * this.combo;
        this.score += pts;

        this._addComboHeat(s.isRisk ? 0.65 : 0.22);
        this.sound.playShard(this.combo, s.isRisk);

        this.world.particles.emit(s.x, s.y, s.z, s.isRisk ? 16 : 8, {
          color: s.isRisk ? 0xffc400 : 0x00f0ff,
          altColor: s.isRisk ? 0xff1e8a : null,
          speed: s.isRisk ? 5.8 : 4.0,
          upBias: 3.2,
          life: 0.38
        });

        if (s.isRisk) {
          this._spawnCallout(`RISK CORE +${pts}`, '#ffc400');
        }
      }
    }

    // ---- Power-Ups ----
    for (const p of this.world.powerups) {
      if (p.collected) continue;
      if (Math.abs(p.x - r.x) < 1.05 && Math.abs(p.y - (r.y + 0.9)) < 1.35 && Math.abs(p.z) < 1.25) {
        p.collected = true;
        const meta = POWERUP_META[p.type];
        this.activePowerups[p.type] = meta.duration;
        this.score += 150 * this.combo;
        this._addComboHeat(0.5);
        this.sound.playPowerup(p.type);
        this.camShake = Math.max(this.camShake, 0.25);

        this.world.particles.emit(p.x, p.y, p.z, 24, {
          color: p.color,
          altColor: 0xffffff,
          speed: 6.8,
          upBias: 4.0,
          life: 0.52
        });
        this._spawnCallout(`${meta.label} ONLINE!`, meta.color);
      }
    }

    // ---- Obstacles & Near-Misses ----
    for (const o of this.world.obstacles) {
      if (o.smashed) continue;

      const halfZ = o.length * 0.5 + runnerHalfZ;
      const zOverlap = Math.abs(o.z) < halfZ;

      if (zOverlap) {
        const xOverlap = Math.abs(o.x - r.x) < o.width * 0.5 + runnerHalfW;
        let yOverlap = false;

        if (o.kind === 'low') {
          yOverlap = runnerBottom < o.height;
        } else if (o.kind === 'high') {
          yOverlap = runnerTop > o.bottomY;
        } else {
          yOverlap = runnerBottom < o.height;
        }

        if (xOverlap && yOverlap) {
          // Smash through with Nitro Dash!
          if (dashActive) {
            this._smashObstacle(o, 'NITRO SMASH', 300, 0x39ff14);
            continue;
          }
          // Absorb & Shatter with Aegis Shield!
          if (shieldActive) {
            this.activePowerups.shield = 0;
            this.invulnTimer = 1.15;
            this._smashObstacle(o, 'SHIELD SMASH!', 500, 0x00f0ff);
            this._clearImmediateHazards(7.5);
            this.hitStopTimer = 0.045;
            continue;
          }
          // Post-smash / post-dash grace invulnerability
          if (this.invulnTimer > 0) {
            this._smashObstacle(o, 'OVERDRIVE!', 150, 0x00f0ff);
            continue;
          }

          // Fatal Crash!
          this.triggerGameOver();
          return;
        }
      }

      // ---- Near-Miss / Close-Call Evaluation as obstacle clears the runner ----
      if (!o.nearMissed && o.z > 0.35 && o.z < 5.5) {
        const latDist = Math.abs(o.x - r.x);
        const dodgedLateFromThisLane =
          o.lane === r.prevLane && this.elapsed - r.lastLaneSwitchAt < 0.44 && latDist < 2.85;
        const closeTrafficGraze =
          o.kind === 'full' && latDist < o.nearWidth * 0.5 + 0.95 && latDist >= o.width * 0.5;
        const cleanVerticalStunt =
          (o.kind === 'low' || o.kind === 'high') && latDist < 0.85;

        if (dodgedLateFromThisLane || closeTrafficGraze || cleanVerticalStunt) {
          o.nearMissed = true;
          this.nearMissCount++;

          const focusMult = chronoActive ? 1.5 : 1.0;
          const baseBonus = dodgedLateFromThisLane ? 150 : 85;
          const pts = Math.round(baseBonus * this.combo * focusMult);
          this.score += pts;

          // Instant combo boost on Close Call, strong heat boost on Graze/Stunt
          this._addComboHeat(dodgedLateFromThisLane ? 1.02 : 0.62);
          this.sound.playNearMiss(this.combo);
          this.camShake = Math.max(this.camShake, dodgedLateFromThisLane ? 0.22 : 0.12);

          const sparkX = (r.x + o.x) * 0.5;
          this.world.particles.emit(sparkX, r.y + 0.9, 0.2, 14, {
            color: 0xff1e8a,
            altColor: 0x00f0ff,
            speed: 5.5,
            upBias: 3.0,
            life: 0.36
          });

          const label = dodgedLateFromThisLane
            ? `CLOSE CALL +${pts}`
            : cleanVerticalStunt
              ? (o.kind === 'high' ? `LASER SLIDE +${pts}` : `CLEAN VAULT +${pts}`)
              : `NEAR MISS +${pts}`;
          this._spawnCallout(label, dodgedLateFromThisLane ? '#ff1e8a' : '#00f0ff');
        } else {
          o.nearMissed = true;
        }
      }
    }
  }

  _smashObstacle(obs, title, basePts, colorHex) {
    obs.smashed = true;
    const pts = basePts * this.combo;
    this.score += pts;
    this._addComboHeat(0.85);
    this.sound.playSmash();
    this.camShake = Math.max(this.camShake, 0.58);

    this.world.particles.emit(obs.x, 1.1, obs.z, 40, {
      color: colorHex,
      altColor: 0xff1e8a,
      speed: 10.5,
      upBias: 5.8,
      scale: 1.45,
      life: 0.72
    });
    this._spawnCallout(`${title} +${pts}`, `#${colorHex.toString(16).padStart(6, '0')}`);
  }

  _clearImmediateHazards(radiusZ) {
    for (const o of this.world.obstacles) {
      if (!o.smashed && o.z > -radiusZ && o.z < 3.5) {
        o.smashed = true;
        this.world.particles.emit(o.x, 1.0, o.z, 18, {
          color: 0x00f0ff,
          speed: 7.0,
          upBias: 4.0,
          life: 0.5
        });
      }
    }
  }

  _addComboHeat(amount) {
    this.comboGraceTimer = 2.3;
    this.comboHeat += amount;
    if (this.comboHeat >= 1.0) {
      if (this.combo < 12) {
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboHeat = 0.72;
        this.ui.comboCard.classList.remove('combo-pop');
        void this.ui.comboCard.offsetWidth;
        this.ui.comboCard.classList.add('combo-pop');
      } else {
        this.comboHeat = 1.0;
      }
    }
  }

  // ================= CHARACTER ANIMATION & CAMERA FEEL =================
  _animateRunner(dt, speed, isIdle) {
    const r = this.runnerState;
    const rig = this.runner;

    rig.group.position.set(r.x, r.y, 0);

    // Blink softly during post-dash/post-shield invulnerability
    if (this.invulnTimer > 0 && this.state === 'playing') {
      rig.bodyPivot.visible = Math.floor(this.elapsed * 18) % 2 === 0;
    } else {
      rig.bodyPivot.visible = true;
    }

    // Shadow stays pinned to wet asphalt y = 0.025, scaling down with jump height!
    rig.shadow.position.y = -r.y + 0.025;
    const shadowScale = Math.max(0.42, 1.25 - r.y * 0.28);
    rig.shadow.scale.set(shadowScale, shadowScale, 1);

    // Power-Up Rigs on Runner
    rig.shieldGroup.visible = this.activePowerups.shield > 0;
    if (rig.shieldGroup.visible) {
      rig.shieldGroup.rotation.y += dt * 1.9;
      rig.shieldGroup.rotation.x += dt * 1.1;
    }

    rig.magnetGroup.visible = this.activePowerups.magnet > 0;
    if (rig.magnetGroup.visible) {
      rig.magRing1.rotation.z += dt * 4.5;
      rig.magRing2.rotation.y -= dt * 3.8;
      const pulse = 1 + Math.sin(this.elapsed * 9) * 0.08;
      rig.magnetGroup.scale.setScalar(pulse);
    }

    rig.dashGroup.visible = this.activePowerups.dash > 0;
    if (rig.dashGroup.visible) {
      rig.dashGroup.scale.z = 0.85 + Math.random() * 0.45;
    }

    rig.chronoRing.visible = this.activePowerups.chrono > 0;
    if (rig.chronoRing.visible) {
      rig.chronoRing.rotation.z -= dt * 2.2;
    }

    // Articulated Limb Poses
    r.runPhase += dt * speed * 0.62;
    const s = Math.sin(r.runPhase);
    const c = Math.cos(r.runPhase);

    rig.bodyPivot.rotation.z = r.bankAngle;
    rig.bodyPivot.scale.set(1 / Math.sqrt(r.squashY), r.squashY, 1 / Math.sqrt(r.squashY));

    if (r.sliding) {
      // Low aerodynamic knee-slide pose!
      rig.bodyPivot.position.y = THREE.MathUtils.lerp(rig.bodyPivot.position.y, -0.44, 1 - Math.exp(-22 * dt));
      rig.torsoPivot.rotation.x = THREE.MathUtils.lerp(rig.torsoPivot.rotation.x, 0.95, 1 - Math.exp(-22 * dt));
      rig.leftLeg.hip.rotation.x = 1.18;
      rig.leftLeg.knee.rotation.x = -0.15;
      rig.rightLeg.hip.rotation.x = -0.45;
      rig.rightLeg.knee.rotation.x = -1.35;
      rig.leftArm.shoulder.rotation.x = -0.7;
      rig.rightArm.shoulder.rotation.x = 0.65;
    } else if (r.jumping) {
      rig.bodyPivot.position.y = 0;
      rig.torsoPivot.rotation.x = r.slamming ? -0.65 : -0.26;
      rig.leftLeg.hip.rotation.x = 0.65;
      rig.leftLeg.knee.rotation.x = -1.1;
      rig.rightLeg.hip.rotation.x = -0.35;
      rig.rightLeg.knee.rotation.x = -0.65;
      rig.leftArm.shoulder.rotation.x = -0.85;
      rig.leftArm.elbow.rotation.x = 0.7;
      rig.rightArm.shoulder.rotation.x = -0.65;
      rig.rightArm.elbow.rotation.x = 0.7;
    } else {
      // Energetic Sprint Stride
      const bob = Math.abs(c) * (isIdle ? 0.05 : 0.095);
      rig.bodyPivot.position.y = bob;
      rig.torsoPivot.rotation.x = isIdle ? -0.16 : -0.28 - Math.min(0.16, (speed - 20) * 0.006);
      rig.torsoPivot.rotation.y = s * 0.12;

      rig.leftLeg.hip.rotation.x = s * 0.92;
      rig.leftLeg.knee.rotation.x = Math.min(0, -0.15 - Math.max(0, -s) * 1.15);
      rig.rightLeg.hip.rotation.x = -s * 0.92;
      rig.rightLeg.knee.rotation.x = Math.min(0, -0.15 - Math.max(0, s) * 1.15);

      rig.leftArm.shoulder.rotation.x = -s * 0.85;
      rig.leftArm.elbow.rotation.x = 0.68 + s * 0.22;
      rig.rightArm.shoulder.rotation.x = s * 0.85;
      rig.rightArm.elbow.rotation.x = 0.68 - s * 0.22;
    }

    // Flowing Holographic Scarf Ribbons
    rig.scarfSegments.forEach((segs, sideIdx) => {
      segs.forEach((seg, j) => {
        seg.rotation.y = Math.sin(this.elapsed * 13 - j * 0.85 + sideIdx) * 0.24 - r.bankAngle * 0.4;
        seg.rotation.x = Math.cos(this.elapsed * 11 - j * 0.7) * 0.14 - Math.max(-0.35, Math.min(0.35, r.vy * 0.025));
      });
    });
  }

  _updateCamera(dt, dashActive, chronoActive) {
    const r = this.runnerState;

    // Speed + Dash FOV punch
    const speedRatio = Math.min(1, (this.worldSpeed - 21) / 28);
    const targetFov =
      this.baseFov +
      speedRatio * 6.5 +
      (dashActive ? 9.5 : 0) -
      (chronoActive ? 3.5 : 0);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-8 * dt));
      this.camera.updateProjectionMatrix();
    }

    // Dynamic camera follow: tucks lower on slide, lifts gently on jump, banks subtly into turns
    const targetCamX = r.x * 0.52;
    const slideDrop = r.sliding ? -0.58 : 0;
    const jumpLift = r.y * 0.36;
    const strideBob = (!r.jumping && !r.sliding) ? Math.sin(r.runPhase * 2) * 0.045 : 0;
    const targetCamY = this.baseCamY + slideDrop + jumpLift + strideBob;
    const targetCamZ = this.baseCamZ + (dashActive ? 0.65 : 0) - (r.sliding ? 0.45 : 0);

    this.camPos.x = THREE.MathUtils.lerp(this.camPos.x, targetCamX, 1 - Math.exp(-10 * dt));
    this.camPos.y = THREE.MathUtils.lerp(this.camPos.y, targetCamY, 1 - Math.exp(-10 * dt));
    this.camPos.z = THREE.MathUtils.lerp(this.camPos.z, targetCamZ, 1 - Math.exp(-8 * dt));

    this.camLook.x = THREE.MathUtils.lerp(this.camLook.x, r.x * 0.34, 1 - Math.exp(-12 * dt));
    this.camLook.y = THREE.MathUtils.lerp(this.camLook.y, 1.38 + r.y * 0.22 + (r.sliding ? -0.32 : 0), 1 - Math.exp(-10 * dt));
    this.camLook.z = -15;

    // Trauma Screen Shake
    this.camShake = Math.max(0, this.camShake - dt * 2.8);
    const shakeAmt = this.camShake * this.camShake * 0.48;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;

    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.camera.rotation.z += r.bankAngle * 0.14;
  }

  // ================= RENDER & 2D SPEED LINES / HUD =================
  _renderScene() {
    if (this.composer && this.useBloom) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _render2DFX(dt) {
    const ctx = this.fxCtx;
    const w = this.fxCanvas.width;
    const h = this.fxCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.state !== 'playing' || !this.alive) return;

    const dashActive = this.activePowerups.dash > 0;
    const chronoActive = this.activePowerups.chrono > 0;
    const shieldActive = this.activePowerups.shield > 0;
    const speedFactor = Math.max(0, (this.worldSpeed - 24) / 22);
    const lineAlpha = dashActive ? 0.58 : speedFactor * 0.32;

    // Radial Neon Speed Lines around viewport perimeter
    if (lineAlpha > 0.02) {
      const cx = w * 0.5;
      const cy = h * 0.44;
      const maxR = Math.hypot(w, h) * 0.62;

      ctx.save();
      ctx.lineWidth = dashActive ? 2.4 : 1.5;
      for (const sl of this.speedLines) {
        sl.phase = (sl.phase + dt * (dashActive ? 3.8 : 2.1)) % 1;
        const rInner = maxR * (0.48 + sl.phase * 0.38);
        const rOuter = rInner + maxR * sl.len * (dashActive ? 1.35 : 0.85);

        const cos = Math.cos(sl.angle);
        const sin = Math.sin(sl.angle);
        ctx.strokeStyle = dashActive
          ? `rgba(57, 255, 20, ${(lineAlpha * (1 - sl.phase)).toFixed(3)})`
          : `rgba(0, 240, 255, ${(lineAlpha * (1 - sl.phase)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx + cos * rInner, cy + sin * rInner);
        ctx.lineTo(cx + cos * rOuter, cy + sin * rOuter);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Chrono Slow-Time Ultraviolet Edge Vignette
    if (chronoActive) {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
      g.addColorStop(0, 'rgba(182, 92, 255, 0)');
      g.addColorStop(1, 'rgba(140, 42, 255, 0.26)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (shieldActive) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }
  }

  _updateHUD() {
    this.ui.score.textContent = Math.floor(this.score).toLocaleString();
    this.ui.distance.textContent = `${Math.floor(this.distance)}m`;
    const kmh = Math.round(this.worldSpeed * 3.6);
    this.ui.speed.textContent = `${kmh} km/h`;

    if (this.score > this.bestScore) {
      this.ui.best.textContent = Math.floor(this.score).toLocaleString();
    }

    this.ui.combo.textContent = `x${this.combo}`;
    this.ui.comboFill.style.width = `${Math.round(Math.max(0, Math.min(1, this.comboHeat)) * 100)}%`;
    this.ui.comboCard.classList.toggle('combo-hot', this.combo >= 3);

    // Render Active Power-Up Timer Pills cleanly without unnecessary DOM churn
    const activeKeys = Object.keys(this.activePowerups).filter((k) => this.activePowerups[k] > 0.05);
    const existingPills = this.ui.powerupRack.querySelectorAll('.powerup-pill');
    if (existingPills.length !== activeKeys.length) {
      this.ui.powerupRack.innerHTML = activeKeys
        .map((k) => {
          const m = POWERUP_META[k];
          return `
            <div class="powerup-pill" data-pu="${k}" style="--pu-color: ${m.color}">
              <div class="powerup-pill-head">
                <span>${m.label}</span>
                <span class="powerup-pill-time">0.0s</span>
              </div>
              <div class="powerup-pill-bar">
                <div class="powerup-pill-fill"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }

    for (const k of activeKeys) {
      const pill = this.ui.powerupRack.querySelector(`[data-pu="${k}"]`);
      if (!pill) continue;
      const rem = this.activePowerups[k];
      const pct = Math.max(0, Math.min(100, (rem / POWERUP_META[k].duration) * 100));
      pill.querySelector('.powerup-pill-time').textContent = `${rem.toFixed(1)}s`;
      pill.querySelector('.powerup-pill-fill').style.width = `${pct}%`;
    }
  }

  _updateBestUI() {
    const formatted = this.bestScore.toLocaleString();
    this.ui.best.textContent = formatted;
    this.ui.startBest.textContent = formatted;
  }

  _showDistrictBanner(name) {
    this.ui.districtName.textContent = name;
    this.ui.districtBanner.classList.remove('hidden');
    // Restart CSS keyframe animation cleanly
    this.ui.districtBanner.style.animation = 'none';
    void this.ui.districtBanner.offsetWidth;
    this.ui.districtBanner.style.animation = '';

    clearTimeout(this.districtBannerTimeout);
    this.districtBannerTimeout = setTimeout(() => {
      this.ui.districtBanner.classList.add('hidden');
    }, 2800);
  }

  _spawnCallout(text, color = '#00f0ff') {
    const el = document.createElement('div');
    el.className = 'callout-pop';
    el.style.color = color;
    el.textContent = text;
    // Keep max 3 callouts on screen so portrait HUD stays super clean
    while (this.ui.calloutLayer.children.length >= 3) {
      this.ui.calloutLayer.removeChild(this.ui.calloutLayer.firstChild);
    }
    this.ui.calloutLayer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 920);
  }

  _flashDamage(opacity = 0.8) {
    this.ui.damageFlash.style.opacity = String(opacity);
    setTimeout(() => {
      this.ui.damageFlash.style.opacity = '0';
    }, 180);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new NeonRunnerGame();
});
