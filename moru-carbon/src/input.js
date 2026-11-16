const SWIPE_THRESHOLD_PX = 22;

export class InputController {
  constructor({ targetElement, onAction, onTapStartOrRestart, onFirstGesture, onToggleMute }) {
    this.el = targetElement;
    this.onAction = onAction;
    this.onTapStartOrRestart = onTapStartOrRestart;
    this.onFirstGesture = onFirstGesture;
    this.onToggleMute = onToggleMute;

    this.gestureActive = false;
    this.startX = 0;
    this.startY = 0;
    this.swiped = false;
    this.lastSwipeAt = -999;
    this.lastTapAt = -999;

    this.bindEvents();
  }

  isControlButton(target) {
    return Boolean(target && target.closest && target.closest('[data-ignore-game-tap="true"]'));
  }

  classifySwipe(dx, dy) {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD_PX) return null;
    if (absX > absY * 1.05) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'slide' : 'jump';
  }

  beginGesture(x, y) {
    this.gestureActive = true;
    this.swiped = false;
    this.startX = x;
    this.startY = y;
  }

  moveGesture(x, y) {
    if (!this.gestureActive || this.swiped) return;
    const action = this.classifySwipe(x - this.startX, y - this.startY);
    if (!action) return;
    this.swiped = true;
    const now = performance.now();
    if (now - this.lastSwipeAt > 45) {
      this.lastSwipeAt = now;
      this.onAction(action);
    }
  }

  endGesture() {
    if (!this.gestureActive) return;
    const wasSwipe = this.swiped;
    this.gestureActive = false;
    this.swiped = false;
    if (!wasSwipe) {
      const now = performance.now();
      if (now - this.lastTapAt > 120 && now - this.lastSwipeAt > 80) {
        this.lastTapAt = now;
        this.onTapStartOrRestart?.();
      }
    }
  }

  bindEvents() {
    window.addEventListener(
      'touchstart',
      (e) => {
        this.onFirstGesture?.();
        if (this.isControlButton(e.target)) return;
        if (e.touches.length > 1) {
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        this.beginGesture(t.clientX, t.clientY);
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (!this.isControlButton(e.target)) {
          e.preventDefault();
        }
        if (e.touches.length === 1) {
          this.moveGesture(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        if (this.isControlButton(e.target)) {
          this.gestureActive = false;
          return;
        }
        this.endGesture();
      },
      { passive: true }
    );

    window.addEventListener('pointerdown', (e) => {
      this.onFirstGesture?.();
      if (this.isControlButton(e.target)) return;
      if (!this.gestureActive) {
        this.beginGesture(e.clientX, e.clientY);
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      this.moveGesture(e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isControlButton(e.target)) {
        this.gestureActive = false;
        return;
      }
      this.endGesture();
    });

    // Support programmatic .click() for automated harnesses and accessibility
    window.addEventListener('click', (e) => {
      this.onFirstGesture?.();
      if (this.isControlButton(e.target)) return;
      const now = performance.now();
      if (now - this.lastTapAt > 180 && now - this.lastSwipeAt > 180) {
        this.lastTapAt = now;
        this.onTapStartOrRestart?.();
      }
    });

    window.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.onFirstGesture?.();
      const code = e.code;

      if (code === 'KeyM') {
        this.onToggleMute?.();
        return;
      }
      if (code === 'ArrowLeft' || code === 'KeyA') {
        e.preventDefault();
        this.onAction('left');
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        e.preventDefault();
        this.onAction('right');
      } else if (code === 'ArrowUp' || code === 'KeyW' || code === 'Space') {
        e.preventDefault();
        if (!this.onTapStartOrRestart?.()) {
          this.onAction('jump');
        }
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        e.preventDefault();
        this.onAction('slide');
      } else if (code === 'Enter') {
        e.preventDefault();
        this.onTapStartOrRestart?.();
      }
    });
  }
}
