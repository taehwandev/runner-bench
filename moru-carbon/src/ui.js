import { DISTRICTS, POWERUPS, POWERUP_KEYS, SCORING, STORAGE_KEYS } from './config.js';

export function loadBestScore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bestScore);
    const parsed = Number.parseInt(raw || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score) {
  try {
    localStorage.setItem(STORAGE_KEYS.bestScore, String(Math.floor(score)));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function syncWindowGameHandle(targetWindow, state) {
  if (!targetWindow) return;
  if (!targetWindow.__game) {
    targetWindow.__game = {
      state: state.mode,
      score: Math.floor(state.score),
      combo: state.combo,
      alive: Boolean(state.alive),
    };
    return;
  }
  targetWindow.__game.state = state.mode;
  targetWindow.__game.score = Math.floor(state.score);
  targetWindow.__game.combo = state.combo;
  targetWindow.__game.alive = Boolean(state.alive);
}

export class GameUI {
  constructor(doc, audio) {
    this.doc = doc;
    this.audio = audio;
    this.bestScore = loadBestScore();

    this.els = {
      hud: doc.getElementById('hud'),
      scoreVal: doc.getElementById('hud-score'),
      distVal: doc.getElementById('hud-dist'),
      shardsVal: doc.getElementById('hud-shards'),
      comboBadge: doc.getElementById('combo-badge'),
      comboVal: doc.getElementById('hud-combo'),
      comboFill: doc.getElementById('combo-bar-fill'),
      powerupStack: doc.getElementById('powerup-stack'),
      districtBanner: doc.getElementById('district-banner'),
      districtTitle: doc.getElementById('district-title'),
      districtSub: doc.getElementById('district-sub'),
      calloutLayer: doc.getElementById('callout-layer'),
      hitFlash: doc.getElementById('hit-flash'),
      startScreen: doc.getElementById('start-screen'),
      startBest: doc.getElementById('start-best'),
      gameoverScreen: doc.getElementById('gameover-screen'),
      finalScore: doc.getElementById('final-score'),
      finalBest: doc.getElementById('final-best'),
      newBestTag: doc.getElementById('new-best-tag'),
      finalDist: doc.getElementById('final-dist'),
      finalCombo: doc.getElementById('final-combo'),
      finalShards: doc.getElementById('final-shards'),
      muteBtn: doc.getElementById('mute-btn'),
    };

    this.powerupRows = {};
    for (const key of POWERUP_KEYS) {
      const cfg = POWERUPS[key];
      const row = doc.createElement('div');
      row.className = `powerup-pill powerup-${key}`;
      row.hidden = true;
      row.innerHTML = `
        <div class="powerup-head">
          <span class="powerup-name">${cfg.shortLabel}</span>
          <span class="powerup-time">0.0s</span>
        </div>
        <div class="powerup-track"><div class="powerup-fill"></div></div>
      `;
      this.els.powerupStack.appendChild(row);
      this.powerupRows[key] = {
        root: row,
        time: row.querySelector('.powerup-time'),
        fill: row.querySelector('.powerup-fill'),
      };
    }

    this.bannerTimer = 0;
    this.updateMuteButton();
    this.renderStartScreen();
  }

  updateMuteButton() {
    if (!this.els.muteBtn) return;
    const muted = this.audio.muted;
    this.els.muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    this.els.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  renderStartScreen() {
    this.els.startBest.textContent = this.bestScore.toLocaleString('en-US');
    this.els.startScreen.hidden = false;
    this.els.gameoverScreen.hidden = true;
    this.els.hud.classList.add('hud-dimmed');
  }

  onRunStart() {
    this.els.startScreen.hidden = true;
    this.els.gameoverScreen.hidden = true;
    this.els.hud.classList.remove('hud-dimmed');
    this.showDistrictBanner(DISTRICTS[0]);
  }

  onGameOver(state) {
    const finalPts = Math.floor(state.score);
    const isNewBest = finalPts > this.bestScore && finalPts > 0;
    if (isNewBest) {
      this.bestScore = finalPts;
      saveBestScore(finalPts);
    }

    this.els.finalScore.textContent = finalPts.toLocaleString('en-US');
    this.els.finalBest.textContent = this.bestScore.toLocaleString('en-US');
    this.els.newBestTag.hidden = !isNewBest;
    this.els.finalDist.textContent = `${Math.floor(state.distance * 0.65)} m`;
    this.els.finalCombo.textContent = `x${state.maxCombo}`;
    this.els.finalShards.textContent = String(state.shards);

    this.els.gameoverScreen.hidden = false;
    this.els.startBest.textContent = this.bestScore.toLocaleString('en-US');
    this.triggerFlash('crash');
  }

  showDistrictBanner(district) {
    this.els.districtTitle.textContent = district.name;
    this.els.districtSub.textContent = district.subtitle;
    this.els.districtBanner.classList.add('visible');
    this.bannerTimer = 2.6;
  }

  spawnCallout(text, tone = 'cyan') {
    const item = this.doc.createElement('div');
    item.className = `callout-chip tone-${tone}`;
    item.textContent = text;
    this.els.calloutLayer.appendChild(item);
    while (this.els.calloutLayer.children.length > 3) {
      this.els.calloutLayer.firstElementChild.remove();
    }
    setTimeout(() => {
      item.remove();
    }, 950);
  }

  triggerFlash(kind) {
    const el = this.els.hitFlash;
    el.className = `hit-flash flash-${kind}`;
    void el.offsetWidth;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 280);
  }

  update(state, dt) {
    syncWindowGameHandle(window, state);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.els.districtBanner.classList.remove('visible');
      }
    }

    this.els.scoreVal.textContent = Math.floor(state.score).toLocaleString('en-US');
    this.els.distVal.textContent = `${Math.floor(state.distance * 0.65)} m`;
    this.els.shardsVal.textContent = String(state.shards);

    this.els.comboVal.textContent = `x${state.combo}`;
    if (state.combo > 1) {
      this.els.comboBadge.classList.add('combo-hot');
      const pct = Math.max(0, Math.min(100, (state.comboTimer / SCORING.comboDecaySeconds) * 100));
      this.els.comboFill.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
    } else {
      this.els.comboBadge.classList.remove('combo-hot');
      this.els.comboFill.style.transform = 'scaleX(0)';
    }

    for (const key of POWERUP_KEYS) {
      const rem = state.powerups[key];
      const uiRow = this.powerupRows[key];
      if (rem > 0.02) {
        uiRow.root.hidden = false;
        uiRow.time.textContent = `${rem.toFixed(1)}s`;
        const ratio = Math.max(0, Math.min(1, rem / POWERUPS[key].duration));
        uiRow.fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
      } else {
        uiRow.root.hidden = true;
      }
    }
  }
}
