export {};

declare global {
  interface Window {
    FamilyV2?: {
      version: string;
      fontFamily: string;
      fontReady: Promise<unknown>;
      register(callbacks: { pause(): void; resume(): void; home(): void }): void;
      award(uniqueId: string, points?: number): number;
      touch(): void;
      read(): { id: string; points: number; lastActive: number; ids: string[] };
    };
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
