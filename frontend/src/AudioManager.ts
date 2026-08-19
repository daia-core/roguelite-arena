// Simple audio manager for game sound effects using Web Audio API

export class AudioManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private enabled: boolean = true;

  // ── Background music state ────────────────────────────────────────────────
  private _musicPlaying: boolean = false;
  private _musicLoopTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly MUSIC_LOOP_SECS = 16; // seconds per atmospheric loop

  // ── Sound throttle (prevent audio spam from high-proc-rate builds) ────────
  // Maps a sound key → the last timestamp (ms) it actually played.
  // High-frequency sounds (crit, explosion, lightning, freeze, poison) are
  // rate-limited so they remain legible rather than blurring into noise.
  private _lastPlayed = new Map<string, number>();
  private _throttled(key: string, fn: () => void, cooldownMs: number): void {
    if (!this.enabled) return;
    const now = performance.now();
    if ((this._lastPlayed.get(key) ?? 0) + cooldownMs > now) return;
    this._lastPlayed.set(key, now);
    fn();
  }

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3; // Lower default volume
  }

  /**
   * Resume the AudioContext if it's suspended (required on iOS Safari and
   * Chrome mobile — context starts suspended until a user-gesture unlock).
   * No-op if already running. Called before any audio output.
   */
  private _ensureRunning(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // Play a simple beep sound
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
    if (!this.enabled) return;
    this._ensureRunning();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = type;
    osc.frequency.value = frequency;

    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  // Sound effects
  playShoot(): void {
    this.playTone(400, 0.1, 'square', 0.15);
  }

  playHit(): void {
    this.playTone(200, 0.1, 'sawtooth', 0.2);
  }

  playKill(): void {
    // Quick ascending tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.15);

    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playLevelUp(): void {
    // Ascending arpeggio
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.2, 'sine', 0.2), i * 100);
    });
  }

  playDash(): void {
    this.playTone(600, 0.15, 'triangle', 0.2);
  }

  playDodge(): void {
    // Airy evade blip — kept quiet so frequent dodges never fatigue the ear
    this.playTone(720, 0.08, 'triangle', 0.12);
  }

  playRiposte(): void {
    if (!this.enabled) return;
    this._ensureRunning();

    // Sharp metallic counter-strike: descending zing (reads as "clang!") +
    // a brief low impact body so it has weight without overwhelming the mix.
    // Intentionally louder than dodge (0.12) but much quieter than crit (0.3)
    // — riposte fires on every dodge, so ear-fatigue discipline still applies.
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.1);
    gain.gain.value = 0.18;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.1);

    // Low impact body — gives the counter-strike tactile weight
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    body.type = 'sine';
    body.frequency.value = 210;
    bodyGain.gain.value = 0.10;
    bodyGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);
    body.start(this.ctx.currentTime);
    body.stop(this.ctx.currentTime + 0.06);
  }

  playBlast(): void {
    this.playTone(150, 0.3, 'sawtooth', 0.25);
  }

  playWaveComplete(): void {
    // Victory jingle
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.25, 'sine', 0.2), i * 150);
    });
  }

  // Mid-wave phase escalation stinger — fires when a new enemy sub-phase begins
  // (e.g. "WORMS!", "eggs erupts", "Reinforcements flank you!"). Short two-layer
  // downward sweep so the player knows the combat pattern just shifted, without
  // interrupting the flow. Not throttled — phase transitions are naturally rare.
  playWavePhase(): void {
    if (!this.enabled) return;
    this._ensureRunning();
    const t = this.ctx.currentTime;
    // Layer 1: sharp square sweep — reads as "alert / incoming"
    const osc1 = this.ctx.createOscillator();
    const g1   = this.ctx.createGain();
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(480, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g1.gain.setValueAtTime(0.20, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    osc1.start(t);
    osc1.stop(t + 0.12);
    // Layer 2: heavier sawtooth body delayed 50ms — adds ominous weight
    const osc2 = this.ctx.createOscillator();
    const g2   = this.ctx.createGain();
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(220, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(80, t + 0.23);
    g2.gain.setValueAtTime(0.15, t + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.23);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.23);
  }

  playPurchase(): void {
    this.playTone(800, 0.15, 'sine', 0.2);
  }

  playGameOver(): void {
    // Descending sad tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);

    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.5);
  }

  // NEW: Explosion sound — throttled 250ms so rapid on-hit explosions stay legible
  playExplosion(): void {
    this._throttled('explosion', () => this._playExplosionImpl(), 250);
  }
  private _playExplosionImpl(): void {
    this._ensureRunning();
    // Low boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);

    gain.gain.value = 0.4;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.3);

    // White noise burst
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    const noiseGain = this.ctx.createGain();
    noise.buffer = buffer;
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.start(this.ctx.currentTime);
  }

  // Execute kill — a satisfying 2-layer "blade + thud" cue. Throttled 300ms so execute chains
  // (high-threshold builds that chain-execute several wounded enemies at once) stay legible.
  playExecute(): void {
    this._throttled('execute', () => {
      this._ensureRunning();
      // Layer 1: metallic blade ping — high sine sweeping down (reads as "strike")
      const osc1 = this.ctx.createOscillator();
      const g1 = this.ctx.createGain();
      osc1.connect(g1);
      g1.connect(this.masterGain);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2800, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
      g1.gain.value = 0.35;
      g1.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc1.start(this.ctx.currentTime);
      osc1.stop(this.ctx.currentTime + 0.08);
      // Layer 2: low resonant thud (reads as "impact weight")
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.connect(g2);
      g2.connect(this.masterGain);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(80, this.ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.2);
      g2.gain.value = 0.3;
      g2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc2.start(this.ctx.currentTime);
      osc2.stop(this.ctx.currentTime + 0.2);
    }, 300);
  }

  // NEW: Shield hit/block sound — throttled 300ms (i-frames already space hits, but belt+braces)
  playShieldBlock(): void {
    this._throttled('shield', () => {
      this._ensureRunning();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.08);
      gain.gain.value = 0.25;
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.08);
    }, 300);
  }

  // NEW: Heal sound — throttled 300ms (orbs can spawn in groups on enemy death)
  playHeal(): void {
    this._throttled('heal', () => {
      // Ascending shimmer — playTone already calls _ensureRunning()
      const notes = [523, 659, 784];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.15), i * 50);
      });
    }, 300);
  }

  // NEW: Freeze sound — throttled 400ms (a proc; rare enough without throttle, but builds
  // with very high freeze chance could spray it rapidly — cap to stay musical)
  playFreeze(): void {
    this._throttled('freeze', () => {
      this._ensureRunning();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2000, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + 0.2);
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.2);
    }, 400);
  }

  // NEW: Poison sound — throttled 500ms; Game.ts only calls this on fresh application
  // (enemy.poisonTimer <= 0), so the throttle is a second defence for rapid packs.
  playPoison(): void {
    this._throttled('poison', () => {
      this._ensureRunning();
      this.playTone(180, 0.15, 'square', 0.12);
    }, 500);
  }

  // NEW: Lightning/chain lightning sound — throttled 200ms; chain fires on every hit
  // in an elemental build, which can exceed 10/s with multishot.
  playLightning(): void {
    this._throttled('lightning', () => {
      this._ensureRunning();
      // Crackling high frequency
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.type = 'square';
      osc.frequency.setValueAtTime(1500, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(2000, this.ctx.currentTime + 0.05);
      osc.frequency.linearRampToValueAtTime(1800, this.ctx.currentTime + 0.1);
      gain.gain.value = 0.2;
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.1);
    }, 200);
  }

  // NEW: Critical hit sound — throttled 150ms; crit-heavy builds at 100% crit + multishot
  // can fire 10-20+ crits/s; throttle keeps each individual crit legible in the mix.
  playCrit(): void {
    this._throttled('crit', () => {
      this._ensureRunning();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.12);
      gain.gain.value = 0.3;
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.12);
    }, 150);
  }

  // NEW: Transformation unlock sound
  playTransformation(): void {
    if (!this.enabled) return;

    // Epic ascending fanfare
    const notes = [261, 329, 392, 523, 659];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.3, 'sine', 0.25), i * 80);
    });
  }

  // NEW: Duo combo unlock sound
  playDuoUnlock(): void {
    if (!this.enabled) return;

    // Harmonious chord
    const notes = [440, 554, 659]; // A major chord
    notes.forEach((freq) => {
      this.playTone(freq, 0.4, 'sine', 0.15);
    });
  }

  // NEW: Item pickup sound
  playItemPickup(): void {
    if (!this.enabled) return;

    this.playTone(880, 0.1, 'sine', 0.18);
    setTimeout(() => this.playTone(1047, 0.1, 'sine', 0.15), 60);
  }

  // Doom detonation — throttled 400ms (doom chain detonations can fire in quick succession)
  playDoom(): void {
    this._throttled('doom', () => {
      this._ensureRunning();
      const t = this.ctx.currentTime;
      // Layer 1: deep resonant boom — reads as "stored energy releasing"
      const osc1 = this.ctx.createOscillator();
      const g1 = this.ctx.createGain();
      osc1.connect(g1);
      g1.connect(this.masterGain);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(60, t);
      osc1.frequency.exponentialRampToValueAtTime(20, t + 0.4);
      g1.gain.setValueAtTime(0.4, t);
      g1.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
      osc1.start(t);
      osc1.stop(t + 0.4);
      // Layer 2: sharp mid crack — reads as "burst" / "snap"
      const osc2 = this.ctx.createOscillator();
      const g2 = this.ctx.createGain();
      osc2.connect(g2);
      g2.connect(this.masterGain);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(300, t);
      osc2.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      g2.gain.setValueAtTime(0.25, t);
      g2.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc2.start(t);
      osc2.stop(t + 0.12);
      // Layer 3: high-end shimmer — reads as "arcane energy"
      const osc3 = this.ctx.createOscillator();
      const g3 = this.ctx.createGain();
      osc3.connect(g3);
      g3.connect(this.masterGain);
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(900, t);
      osc3.frequency.exponentialRampToValueAtTime(200, t + 0.18);
      g3.gain.setValueAtTime(0.15, t);
      g3.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc3.start(t);
      osc3.stop(t + 0.18);
    }, 400);
  }

  // Second Wind near-death rescue — fires at most once per wave (naturally gated by the
  // arm/disarm pattern in Game.ts), so no throttle key needed. Three layers to match the
  // visual drama: low impact → rising surge → resolution chime ("you barely made it").
  playSecondWind(): void {
    if (!this.enabled) return;
    this._ensureRunning();
    const t = this.ctx.currentTime;
    // Layer 1: low impact boom (reads as "moment of near-death" — the hit that nearly killed)
    const osc1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    osc1.connect(g1);
    g1.connect(this.masterGain);
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, t);
    osc1.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    g1.gain.setValueAtTime(0.4, t);
    g1.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    osc1.start(t);
    osc1.stop(t + 0.3);
    // Layer 2: rising energy surge (reads as "rescue / life force surging back")
    const osc2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    osc2.connect(g2);
    g2.connect(this.masterGain);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, t);
    osc2.frequency.exponentialRampToValueAtTime(1800, t + 0.38);
    g2.gain.setValueAtTime(0.08, t);
    g2.gain.linearRampToValueAtTime(0.28, t + 0.2);
    g2.gain.exponentialRampToValueAtTime(0.01, t + 0.38);
    osc2.start(t);
    osc2.stop(t + 0.38);
    // Layer 3: bright relief chime delayed 220ms (reads as "still alive — you made it")
    const osc3 = this.ctx.createOscillator();
    const g3 = this.ctx.createGain();
    osc3.connect(g3);
    g3.connect(this.masterGain);
    osc3.type = 'sine';
    osc3.frequency.value = 1320;
    g3.gain.setValueAtTime(0, t + 0.22);
    g3.gain.linearRampToValueAtTime(0.22, t + 0.25);
    g3.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc3.start(t + 0.22);
    osc3.stop(t + 0.5);
  }

  // ── Background music API ─────────────────────────────────────────────────

  /** Start the atmospheric combat loop. No-op if already playing. */
  startMusic(): void {
    if (this._musicPlaying || !this.enabled) return;
    this._ensureRunning();
    this._musicPlaying = true;
    this._scheduleMusicLoop();
  }

  /** Stop the atmospheric loop (on game-over, class-select return, or mute). */
  stopMusic(): void {
    this._musicPlaying = false;
    if (this._musicLoopTimeout !== null) {
      clearTimeout(this._musicLoopTimeout);
      this._musicLoopTimeout = null;
    }
  }

  /** Whether the ambient loop is currently active (for QA / state checks). */
  get musicPlaying(): boolean { return this._musicPlaying; }

  private _scheduleMusicLoop(): void {
    if (!this._musicPlaying || !this.enabled) return;

    const now = this.ctx.currentTime;
    const DUR = this.MUSIC_LOOP_SECS;

    this._playMusicBassLayer(now, DUR);
    this._playMusicPadLayer(now, DUR);
    this._playMusicPulseAccents(now, DUR);

    // Schedule next loop ~100ms before end for seamless crossfade
    this._musicLoopTimeout = setTimeout(() => {
      this._scheduleMusicLoop();
    }, (DUR - 0.1) * 1000);
  }

  /**
   * Layer 1 — sub bass + root bass (A minor root: A1=55Hz, A2=110Hz, sine).
   * Very quiet; provides the low-end gravity of the loop.
   */
  private _playMusicBassLayer(start: number, dur: number): void {
    const bassConfigs: Array<{ freq: number; peak: number }> = [
      { freq: 55,  peak: 0.055 }, // A1 — sub
      { freq: 110, peak: 0.035 }, // A2 — root
    ];
    for (const { freq, peak } of bassConfigs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 1.5);
      gain.gain.setValueAtTime(peak, start + dur - 1.5);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + dur);
    }
  }

  /**
   * Layer 2 — dark filtered pad (A minor chord: A3/C4/E4, sawtooth through a
   * slowly-opening lowpass filter). Creates the harmonic atmosphere.
   */
  private _playMusicPadLayer(start: number, dur: number): void {
    const chordFreqs = [220, 261.63, 329.63]; // A3, C4, E4
    for (const freq of chordFreqs) {
      const osc  = this.ctx.createOscillator();
      const filt = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(100, start);
      filt.frequency.linearRampToValueAtTime(260, start + 5);
      filt.frequency.setValueAtTime(260, start + dur - 4);
      filt.frequency.linearRampToValueAtTime(100, start + dur);
      filt.Q.value = 1.8;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.022, start + 3.5);
      gain.gain.setValueAtTime(0.022, start + dur - 3);
      gain.gain.linearRampToValueAtTime(0, start + dur);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + dur);
    }
  }

  /**
   * Layer 3 — two low pulse accents at 4s and 12s into the 16s loop (E2=82Hz,
   * sine). Gives the loop a subtle heartbeat without a drum.
   */
  private _playMusicPulseAccents(start: number, dur: number): void {
    const beatTimes = [4, 12];
    for (const bt of beatTimes) {
      if (bt >= dur) continue;
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 82.41; // E2 — adds minor-quality tension under A
      gain.gain.setValueAtTime(0.07, start + bt);
      gain.gain.exponentialRampToValueAtTime(0.001, start + bt + 1.8);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start + bt);
      osc.stop(start + bt + 1.8);
    }
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }
}
