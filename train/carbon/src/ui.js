// Manages Start / Active HUD / Replay UI overlays, 9:16 stage sizing,
// and keyboard + touch controls for pause/resume and skip-to-next-shot.

export function createHudController(timeline, handlers) {
  const stageFrame = document.getElementById("stage-frame");
  const canvas = document.getElementById("scene-canvas");
  const startOverlay = document.getElementById("start-overlay");
  const replayOverlay = document.getElementById("replay-overlay");
  const hudBottom = document.getElementById("hud-bottom");

  const startBtn = document.getElementById("start-btn");
  const replayBtn = document.getElementById("replay-btn");
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playPauseLabel = document.getElementById("play-pause-label");
  const nextShotBtn = document.getElementById("next-shot-btn");

  const shotBadge = document.getElementById("shot-badge");
  const shotTitle = document.getElementById("shot-title");
  const timeReadout = document.getElementById("time-readout");
  const phaseStatus = document.getElementById("phase-status");
  const shotRail = document.getElementById("shot-rail");
  const segFills = Array.from(shotRail.querySelectorAll(".seg-fill"));

  let mode = "idle"; // "idle" | "active" | "ended"

  function setMode(nextMode) {
    mode = nextMode;
    startOverlay.classList.toggle("is-hidden", mode !== "idle");
    replayOverlay.classList.toggle("is-hidden", mode !== "ended");
    hudBottom.classList.toggle("is-hidden", mode !== "active");
  }

  function updateHud(state, playing) {
    const shotNum = String(state.shot).padStart(2, "0");
    const totalNum = String(timeline.shots.length).padStart(2, "0");
    shotBadge.textContent = `SHOT ${shotNum} / ${totalNum}`;
    shotTitle.textContent = state.shotInfo.title;
    timeReadout.textContent = `${state.time.toFixed(1).padStart(4, "0")}s / 60.0s`;

    const speedText = `${state.train.speed.toFixed(1)} m/s`;
    phaseStatus.textContent = `${state.phaseLabel} · ${speedText}`;

    playPauseLabel.textContent = playing ? "Pause" : "Resume";
    playPauseBtn.setAttribute(
      "aria-label",
      playing ? "Pause playback" : "Resume playback"
    );

    shotRail.setAttribute("aria-valuenow", state.time.toFixed(1));
    timeline.shots.forEach((s, idx) => {
      const fill = segFills[idx];
      if (!fill) return;
      if (state.time <= s.start) {
        fill.style.width = "0%";
      } else if (state.time >= s.end) {
        fill.style.width = "100%";
      } else {
        const pct = ((state.time - s.start) / (s.end - s.start)) * 100;
        fill.style.width = `${pct.toFixed(1)}%`;
      }
    });
  }

  startBtn.addEventListener("click", () => {
    setMode("active");
    handlers.onStart();
  });

  replayBtn.addEventListener("click", () => {
    setMode("active");
    handlers.onReplay();
  });

  playPauseBtn.addEventListener("click", () => {
    handlers.onTogglePause();
  });

  nextShotBtn.addEventListener("click", () => {
    if (mode !== "active") setMode("active");
    handlers.onNextShot();
  });

  // Keyboard controls: Space/K to start or pause/resume; Right/N to skip shot
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (
      (e.code === "Space" || e.code === "Enter") &&
      (tag === "BUTTON" || tag === "INPUT")
    ) {
      return;
    }

    if (e.code === "Space" || e.code === "KeyK") {
      e.preventDefault();
      if (mode === "idle") {
        setMode("active");
        handlers.onStart();
      } else if (mode === "ended") {
        setMode("active");
        handlers.onReplay();
      } else {
        handlers.onTogglePause();
      }
    } else if (e.code === "ArrowRight" || e.code === "KeyN" || e.code === "Period") {
      e.preventDefault();
      if (mode !== "active") setMode("active");
      handlers.onNextShot();
    } else if (e.code === "ArrowLeft" || e.code === "KeyP" || e.code === "Comma") {
      e.preventDefault();
      if (mode !== "active") setMode("active");
      handlers.onPrevShot();
    }
  });

  // Touch & pointer gestures directly on the canvas:
  // Horizontal swipe skips shot; quick tap during active mode toggles pause/resume.
  let pointerDown = null;
  canvas.addEventListener("pointerdown", (e) => {
    pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!pointerDown) return;
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    const elapsed = performance.now() - pointerDown.t;
    pointerDown = null;

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4 && elapsed < 700) {
      if (mode !== "active") setMode("active");
      if (dx < 0) handlers.onNextShot();
      else handlers.onPrevShot();
      return;
    }

    if (Math.hypot(dx, dy) < 12 && elapsed < 350 && mode === "active") {
      handlers.onTogglePause();
    }
  });

  return {
    stageFrame,
    canvas,
    setMode,
    updateHud,
    getMode() {
      return mode;
    },
  };
}
