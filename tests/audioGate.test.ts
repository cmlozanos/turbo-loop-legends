import { afterEach, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/game/audio';

afterEach(() => vi.unstubAllGlobals());

it('does not initialize audio while the educational gate is locked', async () => {
  const createContext = vi.fn();
  vi.stubGlobal('AudioContext', createContext);
  const audio = new GameAudio(true, true);
  audio.setPaused(true);
  await audio.start();
  expect(createContext).not.toHaveBeenCalled();
});

it('keeps an in-flight audio start suspended if the gate locks meanwhile', async () => {
  let resume!: () => void;
  const context = {
    resume: () => new Promise<void>(resolve => { resume = resolve; }),
    suspend: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn()
  };
  vi.stubGlobal('AudioContext', vi.fn(function () { return context; }));
  const audio = new GameAudio(true, true);
  const starting = audio.start();
  audio.setPaused(true);
  resume();
  await starting;
  expect(context.suspend).toHaveBeenCalled();
  expect(context.createOscillator).not.toHaveBeenCalled();
});
