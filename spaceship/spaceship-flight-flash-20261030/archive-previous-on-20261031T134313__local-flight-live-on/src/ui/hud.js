import { CameraMode } from '../camera/cameraManager.js';
import { FlightPhase } from '../flight/circuit.js';

export class Hud {
  constructor({ flightController, cameraManager, synthAudio }) {
    this.flight = flightController;
    this.camera = cameraManager;
    this.audio = synthAudio;

    this.container = document.getElementById('hud-overlay');
    this.radarCanvas = null;
    this.radarCtx = null;

    this.initElements();
    this.attachEvents();
  }

  initElements() {
    this.container.innerHTML = `
      <!-- Top Status & Utility Bar -->
      <header class="hud-top-bar">
        <div class="hud-brand">
          <div class="hud-logo-icon">▲</div>
          <div class="hud-title-group">
            <span class="hud-brand-title">AERO-VTOL // FLIGHT-V1</span>
            <span class="hud-brand-sub">PLATFORM ALPHA • LOCAL TEST RANGE</span>
          </div>
        </div>

        <div class="hud-center-status">
          <span class="status-indicator-dot pulse"></span>
          <span id="flight-status-badge" class="flight-badge badge-landed">READY ON PAD 01</span>
          <span id="flight-timer" class="flight-timer">T+ 00:00</span>
        </div>

        <div class="hud-top-actions">
          <button id="btn-sound" class="btn-icon" title="Toggle Engine Audio (M)" aria-label="Toggle Sound">
            <span class="icon">🔇</span>
            <span class="btn-text">SOUND OFF</span>
          </button>
          <button id="btn-help" class="btn-icon" title="Flight Guide & Shortcuts" aria-label="Help">
            <span class="icon">ℹ️</span>
            <span class="btn-text">GUIDE</span>
          </button>
        </div>
      </header>

      <!-- Main Central HUD Workspace -->
      <div class="hud-body">
        <!-- Left: Real-time Flight Telemetry -->
        <aside class="hud-telemetry-panel">
          <div class="telemetry-header">
            <span>TELEMETRY LINK</span>
            <span class="badge-online">ONLINE</span>
          </div>

          <div class="telemetry-grid">
            <div class="metric-card">
              <span class="metric-label">ALTITUDE</span>
              <div class="metric-value-row">
                <span id="tel-alt" class="metric-val">0.0</span>
                <span class="metric-unit">m</span>
              </div>
              <div class="metric-bar-bg">
                <div id="bar-alt" class="metric-bar-fill" style="width: 0%"></div>
              </div>
            </div>

            <div class="metric-card">
              <span class="metric-label">AIRSPEED</span>
              <div class="metric-value-row">
                <span id="tel-speed" class="metric-val">0</span>
                <span class="metric-unit">km/h</span>
              </div>
              <div class="metric-bar-bg">
                <div id="bar-speed" class="metric-bar-fill" style="width: 0%"></div>
              </div>
            </div>

            <div class="metric-card">
              <span class="metric-label">V. SPEED</span>
              <div class="metric-value-row">
                <span id="tel-vspeed" class="metric-val">0.0</span>
                <span class="metric-unit">m/s</span>
              </div>
            </div>

            <div class="metric-card">
              <span class="metric-label">HEADING</span>
              <div class="metric-value-row">
                <span id="tel-heading" class="metric-val">000</span>
                <span class="metric-unit">°</span>
              </div>
            </div>

            <div class="metric-card metric-span-2">
              <div class="metric-split-row">
                <span>MAIN THRUST</span>
                <span id="tel-throttle">0%</span>
              </div>
              <div class="metric-bar-bg">
                <div id="bar-throttle" class="metric-bar-fill cyan-bar" style="width: 0%"></div>
              </div>

              <div class="metric-split-row" style="margin-top: 8px;">
                <span>VTOL LIFT THRUST</span>
                <span id="tel-vtol">0%</span>
              </div>
              <div class="metric-bar-bg">
                <div id="bar-vtol" class="metric-bar-fill orange-bar" style="width: 0%"></div>
              </div>
            </div>

            <div class="metric-card metric-span-2">
              <div class="gear-status-row">
                <span class="metric-label">LANDING GEAR</span>
                <span id="tel-gear" class="gear-badge gear-down">DOWN & LOCKED</span>
              </div>
              <div class="circuit-progress-row">
                <span class="metric-label">CIRCUIT PROGRESS</span>
                <span id="tel-progress">0%</span>
              </div>
              <div class="metric-bar-bg">
                <div id="bar-progress" class="metric-bar-fill" style="width: 0%"></div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right Side: Flight Radar & Camera Controls -->
        <aside class="hud-right-panel">
          <!-- Tactical Minimap Radar -->
          <div class="radar-card">
            <div class="radar-header">
              <span>LOCAL RANGE RADAR</span>
              <span class="radar-range">RADIUS 80m</span>
            </div>
            <div class="radar-screen-wrap">
              <canvas id="radar-canvas" width="160" height="160"></canvas>
            </div>
            <div class="radar-legend">
              <span><span class="legend-dot dot-pad"></span> PAD</span>
              <span><span class="legend-dot dot-ship"></span> SHIP</span>
              <span><span class="legend-dot dot-wp"></span> WAYPOINTS</span>
            </div>
          </div>

          <!-- Camera Views & Controls -->
          <div class="camera-card">
            <div class="camera-header">
              <span>CAMERA VIEW</span>
            </div>
            <div class="cam-buttons-grid">
              <button class="btn-cam active" data-mode="${CameraMode.ORBIT_PAD}" title="Orbit around Pad (1)">
                <span class="cam-icon">🎥</span> Pad Overview
              </button>
              <button class="btn-cam" data-mode="${CameraMode.CHASE}" title="Follow behind ship (2)">
                <span class="cam-icon">🚀</span> Chase Cam
              </button>
              <button class="btn-cam" data-mode="${CameraMode.INSPECT}" title="Orbit ship directly (3)">
                <span class="cam-icon">🔍</span> Inspect Ship
              </button>
              <button class="btn-cam" data-mode="${CameraMode.TOWER}" title="Control Tower View (4)">
                <span class="cam-icon">🗼</span> Control Tower
              </button>
              <button class="btn-cam" data-mode="${CameraMode.COCKPIT}" title="Cockpit FPV (5)">
                <span class="cam-icon">💺</span> Cockpit
              </button>
            </div>

            <!-- Manual Orbit/Zoom/Reset Controls for Mobile & Desktop -->
            <div class="camera-util-row">
              <button id="btn-zoom-in" class="btn-util" title="Zoom In (+)">
                <span>+</span> Zoom
              </button>
              <button id="btn-zoom-out" class="btn-util" title="Zoom Out (-)">
                <span>-</span> Zoom
              </button>
              <button id="btn-cam-reset" class="btn-util btn-highlight" title="Reset Camera View (R)">
                <span>↺</span> Reset View
              </button>
            </div>
          </div>
        </aside>
      </div>

      <!-- Bottom Flight Command Dock -->
      <footer class="hud-bottom-dock">
        <div class="dock-container">
          <!-- Playback Speed Controls -->
          <div class="speed-control-group">
            <span class="control-label">SIM SPEED</span>
            <div class="speed-btn-row">
              <button class="btn-speed" data-speed="0.5">0.5x</button>
              <button class="btn-speed active" data-speed="1.0">1.0x</button>
              <button class="btn-speed" data-speed="1.5">1.5x</button>
              <button class="btn-speed" data-speed="2.0">2.0x</button>
            </div>
          </div>

          <!-- Main Primary Action -->
          <div class="primary-action-wrap">
            <button id="btn-primary-action" class="btn-primary-flight">
              <span class="btn-pulse-ring"></span>
              <span class="primary-btn-icon">🚀</span>
              <span id="primary-action-text" class="primary-btn-text">INITIATE TAKEOFF</span>
            </button>
          </div>

          <!-- Secondary Quick Actions -->
          <div class="secondary-actions-group">
            <button id="btn-pause-hover" class="btn-action" title="Pause flight and hover in place (Space)">
              <span class="icon">⏸</span>
              <span class="label">HOVER HOLD</span>
            </button>
            <button id="btn-return-land" class="btn-action" title="Early return to landing pad (L)">
              <span class="icon">🛬</span>
              <span class="label">RETURN & LAND</span>
            </button>
            <button id="btn-reset-pad" class="btn-action" title="Safely reset spaceship to pad">
              <span class="icon">🔄</span>
              <span class="label">RESET PAD</span>
            </button>
          </div>
        </div>
      </footer>

      <!-- Help / Guide Modal -->
      <div id="guide-modal" class="modal-overlay hidden">
        <div class="modal-box">
          <div class="modal-header">
            <h3>SPACESHIP LOCAL CIRCUIT GUIDE</h3>
            <button id="btn-close-modal" class="btn-close">&times;</button>
          </div>
          <div class="modal-content">
            <p><strong>Mission Profile:</strong> Take off vertically from Landing Pad 01, conduct a local perimeter flight circuit past the control tower and surrounding hills, then return for a soft touchdown on the same pad.</p>
            
            <h4>Controls & Interactions:</h4>
            <ul class="guide-list">
              <li><strong>Mouse:</strong> Left-drag to Orbit, Scroll Wheel to Zoom, Right-drag to Pan.</li>
              <li><strong>Touch / Mobile:</strong> 1-finger swipe to Orbit, Pinch to Zoom, 2-finger drag to Pan.</li>
              <li><strong>Hover / Pause:</strong> You can pause the flight at any time to freeze the ship in place and orbit 360° around it!</li>
              <li><strong>Camera Views:</strong> Switch between Pad Director, Chase Cam, Ship Inspection, Tower Spotter, and Cockpit.</li>
            </ul>

            <h4>Keyboard Shortcuts:</h4>
            <div class="shortcuts-grid">
              <div><kbd>Space</kbd> Takeoff / Hover Pause</div>
              <div><kbd>R</kbd> Reset Camera</div>
              <div><kbd>1 - 5</kbd> Camera Modes</div>
              <div><kbd>L</kbd> Return & Land</div>
              <div><kbd>M</kbd> Toggle Sound</div>
            </div>
          </div>
          <div class="modal-footer">
            <button id="btn-modal-gotit" class="btn-primary-flight small">READY FOR TAKEOFF</button>
          </div>
        </div>
      </div>
    `;

    this.radarCanvas = document.getElementById('radar-canvas');
    if (this.radarCanvas && typeof this.radarCanvas.getContext === 'function') {
      try {
        this.radarCtx = this.radarCanvas.getContext('2d');
      } catch (e) {
        this.radarCtx = null;
      }
    }
  }

  attachEvents() {
    // Primary Action Button (Takeoff / Pause / Resume / Re-launch)
    const btnPrimary = document.getElementById('btn-primary-action');
    btnPrimary.addEventListener('click', () => {
      this.handlePrimaryClick();
    });

    // Secondary Actions
    document.getElementById('btn-pause-hover').addEventListener('click', () => {
      if (this.flight.phase !== FlightPhase.LANDED && this.flight.phase !== FlightPhase.TOUCHDOWN) {
        this.flight.togglePause();
      }
    });

    document.getElementById('btn-return-land').addEventListener('click', () => {
      this.flight.abortAndLand();
    });

    document.getElementById('btn-reset-pad').addEventListener('click', () => {
      this.flight.resetToPad();
    });

    // Speed controls
    const speedBtns = document.querySelectorAll('.btn-speed');
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        speedBtns.forEach((b) => b.classList.remove('active'));
        e.target.classList.add('active');
        const speed = parseFloat(e.target.getAttribute('data-speed'));
        this.flight.setSpeedMultiplier(speed);
      });
    });

    // Camera Mode buttons
    const camBtns = document.querySelectorAll('.btn-cam');
    camBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = btn.getAttribute('data-mode');
        this.camera.setMode(mode);
      });
    });

    this.camera.onModeChange = (mode) => {
      camBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
      });
    };

    // Camera Zoom & Reset buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.camera.zoom(0.2);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.camera.zoom(-0.2);
    });
    document.getElementById('btn-cam-reset').addEventListener('click', () => {
      this.camera.resetCamera(true);
    });

    // Sound toggle
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      const isMuted = this.audio.toggleMute();
      btnSound.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
      btnSound.querySelector('.btn-text').textContent = isMuted ? 'SOUND OFF' : 'SOUND ON';
      btnSound.classList.toggle('sound-active', !isMuted);
    });

    // Help Modal
    const modal = document.getElementById('guide-modal');
    document.getElementById('btn-help').addEventListener('click', () => {
      modal.classList.remove('hidden');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    document.getElementById('btn-modal-gotit').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't capture when typing in inputs (none here, but good practice)
      if (e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.handlePrimaryClick();
          break;
        case 'KeyR':
          this.camera.resetCamera(true);
          break;
        case 'KeyL':
          this.flight.abortAndLand();
          break;
        case 'KeyM':
          btnSound.click();
          break;
        case 'Digit1':
          this.camera.setMode(CameraMode.ORBIT_PAD);
          break;
        case 'Digit2':
          this.camera.setMode(CameraMode.CHASE);
          break;
        case 'Digit3':
          this.camera.setMode(CameraMode.INSPECT);
          break;
        case 'Digit4':
          this.camera.setMode(CameraMode.TOWER);
          break;
        case 'Digit5':
          this.camera.setMode(CameraMode.COCKPIT);
          break;
      }
    });

    // Flight Controller callbacks
    this.flight.onPhaseChange = (phase) => {
      this.updatePhaseBadge(phase);
      if (phase === FlightPhase.TOUCHDOWN) {
        this.audio.playTouchdown();
      }
    };

    this.flight.onTelemetryUpdate = (data) => {
      this.updateTelemetry(data);
    };
  }

  handlePrimaryClick() {
    if (this.flight.phase === FlightPhase.LANDED) {
      this.audio.init(); // Initialize audio context on first user gesture
      this.flight.startCircuit();
    } else if (this.flight.phase === FlightPhase.TOUCHDOWN) {
      this.flight.startCircuit();
    } else {
      // Mid flight: toggle hover pause
      const paused = this.flight.togglePause();
      const actionText = document.getElementById('primary-action-text');
      if (actionText) {
        actionText.textContent = paused ? 'RESUME FLIGHT' : 'HOLD HOVER';
      }
    }
  }

  updatePhaseBadge(phase) {
    const badge = document.getElementById('flight-status-badge');
    const primaryText = document.getElementById('primary-action-text');
    const btnPrimary = document.getElementById('btn-primary-action');
    const hoverBtn = document.getElementById('btn-pause-hover');

    badge.className = 'flight-badge';

    switch (phase) {
      case FlightPhase.LANDED:
        badge.classList.add('badge-landed');
        badge.textContent = 'READY ON PAD 01';
        primaryText.textContent = 'INITIATE TAKEOFF';
        btnPrimary.classList.remove('btn-flying');
        hoverBtn.disabled = true;
        break;
      case FlightPhase.SPOOLING:
        badge.classList.add('badge-caution');
        badge.textContent = 'SPOOLING ENGINES...';
        primaryText.textContent = 'TAKEOFF IN PROGRESS';
        btnPrimary.classList.add('btn-flying');
        hoverBtn.disabled = false;
        break;
      case FlightPhase.TAKEOFF_VERTICAL:
        badge.classList.add('badge-climbing');
        badge.textContent = 'VERTICAL LIFTOFF (VTOL)';
        primaryText.textContent = 'HOLD HOVER';
        hoverBtn.disabled = false;
        break;
      case FlightPhase.CIRCUIT:
        badge.classList.add('badge-flying');
        badge.textContent = 'CIRCUIT FLIGHT CRUISE';
        primaryText.textContent = 'HOLD HOVER';
        hoverBtn.disabled = false;
        break;
      case FlightPhase.APPROACH_HOVER:
        badge.classList.add('badge-caution');
        badge.textContent = 'APPROACH HOVER ALIGNED';
        primaryText.textContent = 'HOLD HOVER';
        hoverBtn.disabled = false;
        break;
      case FlightPhase.LANDING_VERTICAL:
        badge.classList.add('badge-landing');
        badge.textContent = 'VERTICAL DESCENT';
        primaryText.textContent = 'DESCENT IN PROGRESS';
        hoverBtn.disabled = false;
        break;
      case FlightPhase.TOUCHDOWN:
        badge.classList.add('badge-landed');
        badge.textContent = 'TOUCHDOWN • COMPLETE';
        primaryText.textContent = 'FLY CIRCUIT AGAIN';
        btnPrimary.classList.remove('btn-flying');
        hoverBtn.disabled = true;
        break;
    }
  }

  updateTelemetry(data) {
    // Digits
    const elAlt = document.getElementById('tel-alt');
    const elSpeed = document.getElementById('tel-speed');
    const elVSpeed = document.getElementById('tel-vspeed');
    const elHeading = document.getElementById('tel-heading');
    const elThrottle = document.getElementById('tel-throttle');
    const elVtol = document.getElementById('tel-vtol');
    const elGear = document.getElementById('tel-gear');
    const elProgress = document.getElementById('tel-progress');

    if (elAlt) elAlt.textContent = data.altitude.toFixed(1);
    if (elSpeed) elSpeed.textContent = Math.round(data.airspeed);
    if (elVSpeed) elVSpeed.textContent = (data.verticalSpeed >= 0 ? '+' : '') + data.verticalSpeed.toFixed(1);
    if (elHeading) elHeading.textContent = String(data.heading).padStart(3, '0');
    if (elThrottle) elThrottle.textContent = `${data.throttle}%`;
    if (elVtol) elVtol.textContent = `${data.vtolThrottle}%`;
    if (elProgress) elProgress.textContent = `${data.circuitProgress}%`;

    // Progress Bars
    const barAlt = document.getElementById('bar-alt');
    const barSpeed = document.getElementById('bar-speed');
    const barThrottle = document.getElementById('bar-throttle');
    const barVtol = document.getElementById('bar-vtol');
    const barProgress = document.getElementById('bar-progress');

    if (barAlt) barAlt.style.width = `${Math.min(100, (data.altitude / 30) * 100)}%`;
    if (barSpeed) barSpeed.style.width = `${Math.min(100, (data.airspeed / 90) * 100)}%`;
    if (barThrottle) barThrottle.style.width = `${data.throttle}%`;
    if (barVtol) barVtol.style.width = `${data.vtolThrottle}%`;
    if (barProgress) barProgress.style.width = `${data.circuitProgress}%`;

    // Gear Badge
    if (elGear) {
      if (data.gearExtension > 0.8) {
        elGear.className = 'gear-badge gear-down';
        elGear.textContent = 'DOWN & LOCKED';
      } else if (data.gearExtension < 0.2) {
        elGear.className = 'gear-badge gear-up';
        elGear.textContent = 'RETRACTED';
      } else {
        elGear.className = 'gear-badge gear-transit';
        elGear.textContent = 'IN TRANSIT...';
      }
    }

    // Hover button text
    const hoverBtn = document.getElementById('btn-pause-hover');
    if (hoverBtn) {
      hoverBtn.querySelector('.label').textContent = data.isPaused ? 'RESUME FLIGHT' : 'HOVER HOLD';
      hoverBtn.classList.toggle('active', data.isPaused);
    }

    // Render Minimap Radar
    this.renderRadar(data);
  }

  renderRadar(data) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = 160;
    const h = 160;
    const cx = w / 2;
    const cy = h / 2;
    const radarScale = 0.95; // 80m maps to ~76px radius

    ctx.clearRect(0, 0, w, h);

    // Radar circular grid rings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 76 * r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, h - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(w - 4, cy);
    ctx.stroke();

    // Landing Pad in center
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.stroke();

    // Circuit path (simplified dotted ellipse / ring)
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy - 2, 42, 50, -0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spaceship position on radar
    const shipPos = this.flight.position;
    // Map world X, Z to radar coords (North is -Z, East is +X)
    const rx = cx + (shipPos.x / 80) * 76;
    const ry = cy + (shipPos.z / 80) * 76;

    // Ship blip
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(rx, ry, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Ship heading arrow
    const headingRad = (this.flight.heading * Math.PI) / 180;
    const arrowLen = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(
      rx + Math.sin(headingRad) * arrowLen,
      ry - Math.cos(headingRad) * arrowLen
    );
    ctx.stroke();
  }
}
