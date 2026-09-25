export {};

declare global {
  interface Window {
    LearningGate?: {
      mount(options: { gameId: string; onLock(): void; onUnlock(): void }): {
        isLocked(): boolean;
        check(): void;
        destroy(): void;
      };
      createTimers(): {
        set(callback: () => void, delay: number): number;
        clear(id: number): void;
        pause(): void;
        resume(): void;
      };
      Core: { glyphs: Record<string, [number, number][][]>; interval: number };
    };
  }
}
