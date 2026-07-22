// Simple audio manager for game sound effects using Web Audio API

export class AudioManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private enabled: boolean = true;

  // ── Background music state ────────────────────────────────────────────────
  private _musicPlaying: boolean = false;
  private _musicLoopTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly MUSIC_LOOP_SECS = 16; // seconds per atmospheric loop

  constructor() {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3; // Lower default volume
  }

  // Play a simple beep sound
  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3): void {
    if (!this.enabled) return;

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

  // NEW: Explosion sound
  playExplosion(): void {
    if (!this.enabled) return;

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

  // NEW: Shield hit/block sound
  playShieldBlock(): void {
    if (!this.enabled) return;

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
  }

  // NEW: Heal sound
  playHeal(): void {
    if (!this.enabled) return;

    // Ascending shimmer
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.15, 'sine', 0.15), i * 50);
    });
  }

  // NEW: Freeze sound
  playFreeze(): void {
    if (!this.enabled) return;

    // High pitched crystalline sound
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
  }

  // NEW: Poison sound
  playPoison(): void {
    if (!this.enabled) return;

    // Bubbling low tone
    this.playTone(180, 0.15, 'square', 0.12);
  }

  // NEW: Lightning/chain lightning sound
  playLightning(): void {
    if (!this.enabled) return;

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
  }

  // NEW: Critical hit sound
  playCrit(): void {
    if (!this.enabled) return;

    // Sharp impactful tone
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

  // ── Background music API ─────────────────────────────────────────────────

  /** Start the atmospheric combat loop. No-op if already playing. */
  startMusic(): void {
    if (this._musicPlaying || !this.enabled) return;
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
