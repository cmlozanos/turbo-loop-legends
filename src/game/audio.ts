export class GameAudio {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  private musicTimer?: number;
  private noteIndex = 0;

  constructor(private musicEnabled: boolean, private soundEnabled: boolean) {}

  async start(): Promise<void> {
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.engine) {
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain).connect(this.context.destination);
      this.engine.start();
    }
    this.updateMusic();
  }

  updateEngine(speed: number, throttle: boolean): void {
    if (!this.context || !this.engine || !this.engineGain) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(55 + Math.min(speed, 80) * 2.2, now, 0.04);
    this.engineGain.gain.setTargetAtTime(this.soundEnabled ? (throttle ? 0.035 : 0.018) : 0, now, 0.05);
  }

  setEnabled(music: boolean, sound: boolean): void {
    this.musicEnabled = music;
    this.soundEnabled = sound;
    this.updateMusic();
  }

  playSuccess(): void {
    this.playTone(392, 0.1);
    window.setTimeout(() => this.playTone(523, 0.12), 120);
    window.setTimeout(() => this.playTone(659, 0.22), 260);
  }

  playCheckpoint(): void {
    this.playTone(660, 0.08);
  }

  stop(): void {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.engineGain?.gain.setTargetAtTime(0, this.context?.currentTime ?? 0, 0.04);
  }

  private updateMusic(): void {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    if (!this.musicEnabled || !this.context) return;
    const notes = [196, 247, 294, 330, 294, 247];
    this.musicTimer = window.setInterval(() => {
      this.playTone(notes[this.noteIndex++ % notes.length], 0.08, 0.018);
    }, 420);
  }

  private playTone(frequency: number, duration: number, volume = 0.07): void {
    if (!this.context || (!this.soundEnabled && volume > 0.02)) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }
}
