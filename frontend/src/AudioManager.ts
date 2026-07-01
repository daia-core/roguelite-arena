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

  toggle(): void {
    this.enabled = !this.enabled;
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }
}
