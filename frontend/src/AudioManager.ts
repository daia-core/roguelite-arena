// Simple audio manager for game sound effects using Web Audio API

export class AudioManager {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private enabled: boolean = true;

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

  toggle(): void {
    this.enabled = !this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }
}
