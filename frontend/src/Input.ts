// Input manager for keyboard, mouse, and touch controls

export interface TouchJoystick {
  active: boolean;
  startX: number;
  startY: number;
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

  // Touch joystick
  joystick: TouchJoystick = {
    active: false,
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
    this.setupTouchButtons();
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

    // Mouse
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', () => {
      this.mouseDown = true;
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });

    // Touch for joystick
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Left side of screen = joystick
        if (x < this.canvas.width / 2 && !this.joystick.active) {
          this.joystick.active = true;
          this.joystick.identifier = touch.identifier;
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
        if (touch.identifier === this.joystick.identifier) {
          const rect = this.canvas.getBoundingClientRect();
          this.joystick.currentX = touch.clientX - rect.left;
          this.joystick.currentY = touch.clientY - rect.top;

          // Calculate delta
          const dx = this.joystick.currentX - this.joystick.startX;
          const dy = this.joystick.currentY - this.joystick.startY;
          const maxRadius = 70;
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

    // Touch joystick
    if (this.joystick.active) {
      const maxRadius = 70;
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

    // Draw base outer ring
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.joystick.startX, this.joystick.startY, 70, 0, Math.PI * 2);
    ctx.stroke();

    // Draw base
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.joystick.startX, this.joystick.startY, 65, 0, Math.PI * 2);
    ctx.fill();

    // Draw stick with glow
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(
      this.joystick.startX + this.joystick.deltaX,
      this.joystick.startY + this.joystick.deltaY,
      30,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }
}
