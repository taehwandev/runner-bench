// Playback state: one clock, no DOM. Time only ever advances by measured
// wall-clock deltas, and every frame is rendered from the absolute time.
import { DUR, clamp } from './common.js';
import { SHOTS, shotIndexAt } from './timeline.js';

export function createPlayer({ render, onState, onSlowFrames }) {
  const st = { time: 0, playing: false, started: false, ended: false, userPaused: false };
  let last = 0, raf = 0, slow = 0;

  const emit = () => onState({ ...st, shot: shotIndexAt(st.time) });
  const draw = () => render(st.time, st.playing);

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!st.playing) { last = now; return; }
    const dt = Math.min(now - last, 100);
    last = now;
    // sustained slow frames ask the renderer to drop resolution
    slow = dt > 21 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 45) { slow = 0; onSlowFrames(); }
    st.time += dt / 1000;
    if (st.time >= DUR) { st.time = DUR; st.playing = false; st.ended = true; draw(); emit(); return; }
    draw(); emit();
  }

  const api = {
    state: st,
    get shot() { return shotIndexAt(st.time); },
    start() {
      st.time = 0; st.started = true; st.ended = false; st.playing = true; st.userPaused = false; slow = 0;
      last = performance.now(); draw(); emit();
    },
    toggle() {
      if (!st.started || st.ended) return;
      st.playing = !st.playing; st.userPaused = !st.playing; last = performance.now(); slow = 0; emit();
    },
    pause() { if (st.playing) { st.playing = false; st.userPaused = true; emit(); } },
    /** Jump to t seconds and render that frame immediately. */
    seek(t) {
      st.time = clamp(Number(t) || 0, 0, DUR);
      st.started = true;
      st.ended = st.time >= DUR;
      if (st.ended) st.playing = false;
      last = performance.now(); slow = 0;
      draw(); emit();
    },
    nextShot() {
      if (!st.started || st.ended) return;
      const next = SHOTS[shotIndexAt(st.time) + 1];
      api.seek(next ? next.t0 : DUR);
    },
    redraw: draw,
    run() { last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { cancelAnimationFrame(raf); },
  };
  return api;
}
