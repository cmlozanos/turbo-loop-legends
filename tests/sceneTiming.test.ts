import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { GameScene } from "../src/game/GameScene";
import { createPhysicsWorld } from "../src/game/physics";
import { getCar } from "../src/game/cars";
import { createDefaultTrack } from "../src/game/track";

it("the actual scene update keeps trajectories and recovery identical at 10–120 FPS", () => {
  function run(fps: number) {
    const scene = new GameScene() as any;
    const input = { state: { throttle: true, brake: false, turbo: true }, consumeReset: () => false };
    scene.init({ car: getCar("comet"), assists: false, reducedMotion: true, lightMode: true, input,
      onSpeed() {}, onCheckpoint() {}, onRespawn() {}, onFinish() {}, onChallengeFailure() {}, audio: { updateEngine() {} } });
    scene.simulation = createPhysicsWorld({ track: createDefaultTrack(), car: getCar("comet") });
    scene.lastSnapshot = scene.simulation.getSnapshot(); scene.finishX = Infinity;
    scene.scene = { isActive: () => true };
    scene.cameras = { main: { width: 1024, zoom: 1, scrollX: 0, setLerp() {} } };
    scene.syncVehicle = () => {}; scene.emitDust = () => {};
    for (let frame = 0; frame < fps * 12; frame++) {
      input.state.throttle = frame < fps * 5 || frame >= fps * 8;
      input.state.brake = frame >= fps * 5 && frame < fps * 8;
      scene.update(frame * 1000 / fps, 1000 / fps);
    }
    return { snapshot: scene.lastSnapshot, steps: scene.simulationSteps, stuck: scene.stuckSeconds };
  }
  const expected = run(60);
  for (const fps of [10, 15, 20, 30, 120]) expect(run(fps)).toEqual(expected);
});

it("keeps track pieces at both visible edges when light mode zooms the camera", () => {
  const scene = new GameScene() as any;
  scene.init({ car: getCar("comet"), reducedMotion: true,
    input: { state: {}, consumeReset: () => false }, onSpeed() {}, audio: { updateEngine() {} } });
  scene.lastSnapshot = { velocity: { x: 0 }, springboardActivations: 0 };
  scene.cameras = { main: { width: 900, zoom: 0.46875, scrollX: 1000, setLerp() {} } };
  scene.syncVehicle = () => {}; scene.emitDust = () => {};
  // Visible world range is 490..2410, not scrollX..scrollX+width/zoom.
  scene.decorations = [500, 2380, 100, 2700].map(left => ({ left, right: left + 30, graphics: {} }));
  scene.update(0, 0);
  expect(scene.decorations.map((item: any) => item.graphics.visible)).toEqual([true, true, false, false]);
});
