// Preserve the 60 Hz simulation at low render rates without unbounded catch-up.
export class FrameClock {
  private remainder = 0;
  reset(): void { this.remainder = 0; }
  advance(seconds: number, step: (seconds: number) => boolean | void): number {
    this.remainder += Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 0.25)) : 0;
    let count = 0;
    while (this.remainder + 1e-9 >= 1 / 60 && count < 15) {
      this.remainder = Math.max(0, this.remainder - 1 / 60);
      count++;
      if (step(1 / 60) === false) { this.reset(); break; }
    }
    return count;
  }
}

export function renderScale(width: number, height: number, light: boolean): number {
  return light ? Math.min(0.7, 900 / Math.max(width, height)) : 1;
}
