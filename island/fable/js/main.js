// Bootstrap: wires scene, player, audio and UI, and exposes window.__scene.
import { DUR } from './common.js';
import { SHOTS } from './timeline.js';
import { createScene } from './scene.js';
import { createPlayer } from './player.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';

const PREVIEW_T = 1.5; // still shown behind the Start card

const audio = createAudio();
let scene = null, player = null;

const ui = createUI({
  onStart() { audio.init(); audio.resume(); audio.resync(0); player.start(); },
  onToggle() { player.toggle(); },
  onNext() { player.nextShot(); },
  onResize(w, h) { if (scene) { scene.resize(w, h); if (player) player.redraw(); } },
});

try {
  scene = createScene(document.getElementById('view'));
} catch (err) {
  console.error(err);
  ui.fail('WebGL 2 is required to play this scene.');
}

if (scene) {
  player = createPlayer({
    render(t, playing) {
      const shown = player && player.state.started ? t : PREVIEW_T;
      scene.renderAt(shown);
      ui.frame(shown);
      if (playing) audio.update(t, player.shot);
    },
    onState(s) {
      ui.sync(s);
      if (s.playing) audio.resume(); else audio.suspend();
    },
    onSlowFrames() { scene.lowerResolution(); },
  });
  ui.layout();
  player.redraw();
  player.run();
  ui.ready();

  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });

  window.__scene = {
    get shot() { return player.shot; },
    get shotName() { return SHOTS[player.shot].name; },
    get time() { return player.state.time; },
    get playing() { return player.state.playing; },
    seek(t) { player.seek(t); audio.resync(player.state.time); return player.state.time; },
    shots: SHOTS.map((s, index) => ({ index, name: s.name, start: s.t0, end: s.t1 })),
    duration: DUR,
  };
}
