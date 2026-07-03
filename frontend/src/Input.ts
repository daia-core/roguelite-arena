// Input manager for keyboard, mouse, and touch controls

export interface TouchJoystick {
  active: boolean;
  fixedX: number;  // Fixed visual position
  fixedY: number;  // Fixed visual position
  startX: number;  // Where touch began
  startY: number;  // Where touch began
  currentX: number;
  currentY: number;
  deltaX: number;
  deltaY: number;
  identifier: number;
}

export class Input {
  // Keyboard state
  private keys: Map<string, boolean> = new Map();

  // Mouse state
  mouseX: number = 0;
  mouseY: number = 0;
  mouseDown: boolean = false;

  // When true, the press currently held is ignored until it is released once.
  // Set on a screen transition so a finger/button that was ALREADY down (e.g.
  // holding to move when a wave ends and the shop opens) can't register as a
  // click — a fresh touchdown is required. Cleared on the next release.
  private pressDisarmed: boolean = false;

  // Touch joystick
  joystick: TouchJoystick = {
    active: false,
    fixedX: 120,  // Fixed position bottom-left (bigger margin for mobile)
    fixedY: 0,    // Will be set to canvas.height - 120 dynamically
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    identifier: -1
  };

  // Ability buttons
  dashPressed: boolean = false;
  blastPressed: boolean = false;

  private canvas: HTMLCanvasElement;
  private dashButton: HTMLButtonElement | null = null;
  private blastButton: HTMLButtonElement | null = null;
  private gameStateGetter: (() => string) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
    this.setupTouchButtons();
  }

  setGameStateGetter(getter: () => string): void {
    this.gameStateGetter = getter;
  }

  private setupEventListeners(): void {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.key.toLowerCase(), true);

      // Abilities
      if (e.key === ' ' || e.key === 'Shift') {
        this.dashPressed = true;
        e.preventDefault();
      }
      if (e.key === 'e' || e.key === 'q') {
        this.blastPressed = true;
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.key.toLowerCase(), false);
    });

    // Mouse — scale from CSS pixels to canvas pixels, exactly like the touch
    // path below (the canvas renders larger than the viewport and is
    // CSS-scaled down, so unscaled coordinates land short of the target)
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    });

    this.canvas.addEventListener('mousedown', () => {
      if (this.pressDisarmed) return; // held-over press: wait for a release first
      this.mouseDown = true;
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.pressDisarmed = false; // release seen → next press is a fresh click
    });

    // Touch for joystick and UI
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = this.canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

        // Update mouse position for shop/UI interactions
        this.mouseX = x;
        this.mouseY = y;
        if (!this.pressDisarmed) this.mouseDown = true; // ignore a held-over touch

        // Anywhere on screen activates joystick (ONLY during gameplay, not in shop/menu/gameover)
        const gameState = this.gameStateGetter ? this.gameStateGetter() : 'menu';
        const canActivateJoystick = gameState === 'playing' || gameState === 'village';

        if (canActivateJoystick && !this.joystick.active) {
          this.joystick.active = true;
          this.joystick.identifier = touch.identifier;
          // Anchor the joystick's visual origin to where the finger actually
          // landed, so the base appears under the touch and only the knob moves
          // as you drag (was pinned to a fixed bottom-left corner, which made
          // the base teleport away from the finger).
          this.joystick.fixedX = x;
          this.joystick.fixedY = y;
          // Track where touch started
          this.joystick.startX = x;
          this.joystick.startY = y;
          this.joystick.currentX = x;
          this.joystick.currentY = y;
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = this.canvas.getBoundingClientRect();
        const x = (touch.clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (touch.clientY - rect.top) * (this.canvas.height / rect.height);

        // Update mouse position
        this.mouseX = x;
        this.mouseY = y;

        if (touch.identifier === this.joystick.identifier) {
          this.joystick.currentX = x;
          this.joystick.currentY = y;

          // Calculate delta (bigger radius for mobile comfort)
          const dx = this.joystick.currentX - this.joystick.startX;
          const dy = this.joystick.currentY - this.joystick.startY;
          const maxRadius = 100; // Increased from 70 for better mobile control
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > maxRadius) {
            this.joystick.deltaX = (dx / dist) * maxRadius;
            this.joystick.deltaY = (dy / dist) * maxRadius;
          } else {
            this.joystick.deltaX = dx;
            this.joystick.deltaY = dy;
          }
        }
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.mouseDown = false;
      this.pressDisarmed = false; // release seen → next touch is a fresh tap
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystick.identifier) {
          this.joystick.active = false;
          this.joystick.deltaX = 0;
          this.joystick.deltaY = 0;
        }
      }
    }, { passive: false });
  }

  private setupTouchButtons(): void {
    // Create ability buttons for mobile
    this.dashButton = document.getElementById('dashBtn') as HTMLButtonElement;
    this.blastButton = document.getElementById('blastBtn') as HTMLButtonElement;

    if (this.dashButton) {
      this.dashButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.dashPressed = true;
      });
    }

    if (this.blastButton) {
      this.blastButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.blastPressed = true;
      });
    }
  }

  // Drop the currently-held press and require a fresh touchdown before the next
  // click registers. Called on screen transitions so a held finger can't carry a
  // click into the new screen (e.g. holding to move → wave ends → shop insta-buy).
  disarmUntilRelease(): void {
    this.mouseDown = false;
    this.pressDisarmed = true;
  }

  isKeyDown(key: string): boolean {
    return this.keys.get(key.toLowerCase()) ?? false;
  }

  getMovementVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    // Keyboard (WASD)
    if (this.isKeyDown('w') || this.isKeyDown('arrowup')) y -= 1;
    if (this.isKeyDown('s') || this.isKeyDown('arrowdown')) y += 1;
    if (this.isKeyDown('a') || this.isKeyDown('arrowleft')) x -= 1;
    if (this.isKeyDown('d') || this.isKeyDown('arrowright')) x += 1;

    // Touch joystick — divisor MUST match the clamp radius used in touchmove
    // (100) so a full-tilt drag reads as full-speed movement, not ~70%.
    if (this.joystick.active) {
      const maxRadius = 100;
      x = this.joystick.deltaX / maxRadius;
      y = this.joystick.deltaY / maxRadius;
    }

    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  consumeDash(): boolean {
    const pressed = this.dashPressed;
    this.dashPressed = false;
    if (pressed) {
      this.triggerHaptic(20);
    }
    return pressed;
  }

  consumeBlast(): boolean {
    const pressed = this.blastPressed;
    this.blastPressed = false;
    if (pressed) {
      this.triggerHaptic(40);
    }
    return pressed;
  }

  private triggerHaptic(duration: number): void {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }

  drawJoystick(ctx: CanvasRenderingContext2D): void {
    if (!this.joystick.active) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // PURE PIXEL ART: Draw joystick with dithered transparency, no smooth alpha/shadow
    const ditherSize = 3;

    // Draw base outer ring at FIXED position - dithered 30%
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.15) {
      // Sparse dither: only draw some segments
      if (Math.floor(angle * 10) % 3 === 0) {
        const x = this.joystick.fixedX + Math.cos(angle) * 100;
        const y = this.joystick.fixedY + Math.sin(angle) * 100;
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw base circle - dithered 40%
    ctx.fillStyle = '#ffffff';
    const baseRadius = 95;
    for (let dx = -baseRadius; dx <= baseRadius; dx += ditherSize) {
      for (let dy = -baseRadius; dy <= baseRadius; dy += ditherSize) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= baseRadius) {
          // 40% dither pattern
          if (((dx + dy) / ditherSize) % 5 <= 1) {
            ctx.fillRect(
              this.joystick.fixedX + dx,
              this.joystick.fixedY + dy,
              ditherSize,
              ditherSize
            );
          }
        }
      }
    }

    // Draw stick (solid, no glow) - offset from FIXED position based on delta
    ctx.fillStyle = '#ffffff';
    const stickRadius = 42;
    const stickX = this.joystick.fixedX + this.joystick.deltaX;
    const stickY = this.joystick.fixedY + this.joystick.deltaY;

    for (let dx = -stickRadius; dx <= stickRadius; dx += ditherSize) {
      for (let dy = -stickRadius; dy <= stickRadius; dy += ditherSize) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= stickRadius) {
          ctx.fillRect(stickX + dx, stickY + dy, ditherSize, ditherSize);
        }
      }
    }

    ctx.restore();
  }
}
