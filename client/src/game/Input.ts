/**
 * Unified input: keyboard (WASD/arrows), mouse (steer toward pointer), touch
 * (floating virtual joystick) and gamepad (left stick + buttons).
 * Produces a direction vector in world space (x right, z down-screen) + action edges.
 */
export interface InputActions {
  dash: () => void;
  vortex: () => void;
  upgrade: (i: number) => void;
}

/** Shared action interface so HUD buttons trigger the same paths as keys. */
export const gameActions: InputActions = { dash: () => {}, vortex: () => {}, upgrade: () => {} };
/** Visual state of the floating touch joystick (read by the HUD). */
export const joystickState = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };

export class Input {
  x = 0;
  z = 0;
  private keys = new Set<string>();
  private mouse: { x: number; y: number } | null = null;
  private mouseActive = false;
  private touchId: number | null = null;
  private touchOrigin = { x: 0, y: 0 };
  private touchVec = { x: 0, y: 0 };
  private set joystick(v: typeof joystickState) {
    Object.assign(joystickState, v);
  }
  private el: HTMLElement;
  private actions: InputActions;
  private padPrev: boolean[] = [];
  /** screen position of own hole, for mouse steering */
  holeScreen = { x: 0, y: 0 };
  private disposers: (() => void)[] = [];

  constructor(el: HTMLElement, actions: InputActions) {
    this.el = el;
    this.actions = actions;
    Object.assign(gameActions, actions);
    const on = <K extends keyof WindowEventMap>(target: Window | HTMLElement, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.disposers.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) {
        if (k === ' ') this.actions.dash();
        if (k === 'e' || k === 'shift') this.actions.vortex();
        if (k === '1' || k === '2' || k === '3') this.actions.upgrade(Number(k) - 1);
      }
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    on(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    on(window, 'blur', () => this.keys.clear());
    on(el, 'mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY };
      this.mouseActive = true;
    });
    on(el, 'mouseleave', () => (this.mouseActive = false));
    on(el, 'mousedown', (e) => {
      if (e.button === 2) this.actions.dash();
    });
    on(el, 'contextmenu', (e) => e.preventDefault());
    on(
      el,
      'touchstart',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (this.touchId !== null) break;
          this.touchId = t.identifier;
          this.touchOrigin = { x: t.clientX, y: t.clientY };
          this.touchVec = { x: 0, y: 0 };
          this.joystick = { active: true, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
        }
        e.preventDefault();
      },
      { passive: false },
    );
    on(
      el,
      'touchmove',
      (e) => {
        for (const t of Array.from(e.changedTouches)) {
          if (t.identifier !== this.touchId) continue;
          let dx = t.clientX - this.touchOrigin.x;
          let dy = t.clientY - this.touchOrigin.y;
          const max = 60;
          const len = Math.hypot(dx, dy);
          if (len > max) {
            // floating joystick: drag the origin along
            this.touchOrigin.x += (dx / len) * (len - max);
            this.touchOrigin.y += (dy / len) * (len - max);
            dx = t.clientX - this.touchOrigin.x;
            dy = t.clientY - this.touchOrigin.y;
          }
          this.touchVec = { x: dx / max, y: dy / max };
          this.joystick = { active: true, ox: this.touchOrigin.x, oy: this.touchOrigin.y, dx, dy };
        }
        e.preventDefault();
      },
      { passive: false },
    );
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches))
        if (t.identifier === this.touchId) {
          this.touchId = null;
          this.touchVec = { x: 0, y: 0 };
          this.joystick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
        }
    };
    on(el, 'touchend', end);
    on(el, 'touchcancel', end);
  }

  update() {
    let x = 0;
    let z = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) z -= 1;
    if (k.has('s') || k.has('arrowdown')) z += 1;
    if (x || z) {
      const l = Math.hypot(x, z);
      x /= l;
      z /= l;
    } else if (this.touchId !== null) {
      x = this.touchVec.x;
      z = this.touchVec.y;
    } else if (this.mouseActive && this.mouse) {
      const dx = this.mouse.x - this.holeScreen.x;
      const dy = this.mouse.y - this.holeScreen.y;
      const len = Math.hypot(dx, dy);
      const dead = 18;
      if (len > dead) {
        const m = Math.min(1, (len - dead) / 140);
        x = (dx / len) * m;
        z = (dy / len) * m;
      }
    }
    // gamepad
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.18) {
        x = ax;
        z = ay;
      }
      const b = p.buttons.map((bt) => bt.pressed);
      if (b[0] && !this.padPrev[0]) this.actions.dash();
      if ((b[1] || b[2]) && !(this.padPrev[1] || this.padPrev[2])) this.actions.vortex();
      if (b[14] && !this.padPrev[14]) this.actions.upgrade(0);
      if (b[12] && !this.padPrev[12]) this.actions.upgrade(1);
      if (b[15] && !this.padPrev[15]) this.actions.upgrade(2);
      this.padPrev = b;
      break;
    }
    const l = Math.hypot(x, z);
    if (l > 1) {
      x /= l;
      z /= l;
    }
    this.x = x;
    this.z = z;
  }

  dispose() {
    Object.assign(gameActions, { dash: () => {}, vortex: () => {}, upgrade: () => {} });
    joystickState.active = false;
    for (const d of this.disposers) d();
  }
}
