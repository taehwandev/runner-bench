// Playback clock and state machine. No DOM, no renderer: the bootstrap feeds it
// wall-clock timestamps and reacts to its events.

export function createPlayer(duration) {
  const state = { time: 0, playing: false, started: false, ended: false };
  const listeners = new Set();
  let last = null;
  const emit = (type) => listeners.forEach((fn) => fn(type, state));
  const clamp = (t) => Math.min(duration, Math.max(0, Number(t) || 0));

  const api = {
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    play() {
      if (state.ended) { state.time = 0; state.ended = false; emit('seek'); }
      state.playing = true;
      state.started = true;
      last = null;
      emit('play');
    },
    pause() {
      if (!state.playing) return;
      state.playing = false;
      emit('pause');
    },
    toggle() { (state.playing ? api.pause : api.play)(); },
    seek(t) {
      const wasPlaying = state.playing;
      state.time = clamp(t);
      state.ended = state.time >= duration;
      if (state.ended) state.playing = false;
      last = null;
      emit('seek');
      if (state.ended && wasPlaying) emit('end');
    },
    // Advance by real elapsed time; long stalls are clamped so motion never jumps.
    tick(nowMs) {
      if (!state.playing) { last = null; return false; }
      if (last === null) { last = nowMs; return true; }
      const dt = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
      last = nowMs;
      state.time = Math.min(duration, state.time + dt);
      if (state.time >= duration) {
        state.playing = false;
        state.ended = true;
        emit('end');
      }
      return true;
    },
  };
  return api;
}
