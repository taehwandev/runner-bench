// DOM overlay: start/end screens, HUD, in-film titles, keyboard and touch.
// Owns every listener it adds and removes them in dispose().

import { DURATION, SHOTS, TITLES } from '../config.js';

const $ = (id) => document.getElementById(id);
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function createControls(actions) {
  const els = {
    frame: $('frame'), tap: $('tapLayer'), hud: $('hud'), pauseBtn: $('pauseBtn'), nextBtn: $('nextBtn'),
    muteBtn: $('muteBtn'), fill: $('progressFill'), ticks: $('ticks'), clock: $('clock'), progress: $('progress'),
    start: $('startScreen'), end: $('endScreen'), startBtn: $('startBtn'), replayBtn: $('replayBtn'),
    badge: $('pauseBadge'), badgeShot: $('pauseShot'), titleCard: $('titleCard'), endCard: $('endCard'),
  };
  document.querySelectorAll('[data-text]').forEach((n) => { n.textContent = TITLES[n.dataset.text]; });
  els.ticks.innerHTML = SHOTS.slice(1).map((s) => `<i style="left:${(s.start / DURATION) * 100}%"></i>`).join('');

  const off = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };

  let hudTimer = 0;
  let armTimer = 0;
  function wakeHud() {
    // a tap that reveals the HUD must not also land on a control via the follow-up click
    if (els.hud.classList.contains('dim')) {
      els.hud.classList.add('arming');
      clearTimeout(armTimer);
      armTimer = setTimeout(() => els.hud.classList.remove('arming'), 400);
    }
    els.hud.classList.remove('dim');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => actions.isPlaying() && els.hud.classList.add('dim'), 2600);
  }

  on(els.startBtn, 'click', () => { actions.start(); wakeHud(); });
  on(els.replayBtn, 'click', () => { actions.replay(); wakeHud(); });
  on(els.pauseBtn, 'click', () => { actions.toggle(); wakeHud(); });
  on(els.nextBtn, 'click', () => { actions.next(); wakeHud(); });
  on(els.muteBtn, 'click', () => { actions.toggleMute(); wakeHud(); });
  on(els.progress, 'click', (e) => {
    const r = els.progress.getBoundingClientRect();
    actions.seek(((e.clientX - r.left) / r.width) * DURATION);
    wakeHud();
  });

  // Touch / pointer on the picture: tap toggles pause, horizontal swipe changes shot.
  let down = null;
  on(els.tap, 'pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  on(els.tap, 'pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    const swipe = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3;
    if (swipe) (dx < 0 ? actions.next : actions.prev)();
    else if (Math.hypot(dx, dy) < 12) actions.toggle();
    down = null;
    wakeHud();
  });
  on(els.tap, 'pointercancel', () => { down = null; });
  on(els.frame, 'pointermove', (e) => { if (e.pointerType === 'mouse') wakeHud(); });

  on(window, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target instanceof HTMLButtonElement;
    const k = e.key;
    if ((k === ' ' || k === 'Enter') && onButton) return;   // let the focused button act
    if (!actions.isStarted()) {
      if (k === ' ' || k === 'Enter') { e.preventDefault(); actions.start(); wakeHud(); }
      return;
    }
    if (e.repeat) return;   // holding a key must not machine-gun through shots
    if (k === ' ' || k === 'k' || k === 'K') { e.preventDefault(); actions.toggle(); }
    else if (k === 'ArrowRight' || k === 'n' || k === 'N') { e.preventDefault(); actions.next(); }
    else if (k === 'ArrowLeft' || k === 'p' || k === 'P') { e.preventDefault(); actions.prev(); }
    else if (k === 'm' || k === 'M') actions.toggleMute();
    else if (k === 'r' || k === 'R') actions.replay();
    else return;
    wakeHud();
  });

  function update(state, shotName, muted) {
    const t = state.time;
    els.fill.style.width = `${(t / DURATION) * 100}%`;
    els.progress.setAttribute('aria-valuenow', t.toFixed(1));
    els.clock.textContent = fmt(t);
    els.pauseBtn.classList.toggle('paused', !state.playing);
    els.pauseBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    els.muteBtn.classList.toggle('muted', muted);
    els.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    els.start.hidden = state.started;
    els.end.hidden = !state.ended;
    els.hud.hidden = !state.started || state.ended;
    if (!state.playing) els.hud.classList.remove('dim');
    els.badge.hidden = !state.started || state.playing || state.ended;
    els.badgeShot.textContent = shotName;
    els.titleCard.style.opacity = smooth(1.2, 2.6, t) * (1 - smooth(4.8, 6.2, t));
    els.endCard.style.opacity = smooth(56.8, 58.4, t);
  }

  return {
    update,
    wakeHud,
    focusReplay: () => els.replayBtn.focus(),
    dispose() { off.forEach((f) => f()); clearTimeout(hudTimer); clearTimeout(armTimer); },
  };
}
