import Phaser from "phaser";
import type { GameAudio } from "./audio";
import type { CarSpec } from "./cars";
import type { InputController } from "./input";
import { createPhysicsWorld, type PhysicsWorld, type VehicleSnapshot } from "./physics";
import { physicsToScreen, renderPolylines, type Point } from "./track";

const PIXELS_PER_METRE = 45;
const ORIGIN: Point = { x: 850, y: 590 };

export interface GameSceneData {
  car: CarSpec;
  assists: boolean;
  reducedMotion: boolean;
  input: InputController;
  audio: GameAudio;
  onSpeed: (speed: number) => void;
  onCheckpoint: (id: string) => void;
  onFinish: () => void;
  onRespawn: () => void;
}

export class GameScene extends Phaser.Scene {
  private sceneData!: GameSceneData;
  private simulation!: PhysicsWorld;
  private chassis!: Phaser.GameObjects.Image;
  private rearWheel!: Phaser.GameObjects.Graphics;
  private frontWheel!: Phaser.GameObjects.Graphics;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastSnapshot!: VehicleSnapshot;
  private accumulator = 0;
  private checkpointIndex = 0;
  private stuckSeconds = 0;
  private finished = false;
  private finishX = 0;

  constructor() {
    super({ key: "GameScene", active: false });
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
    this.accumulator = 0;
    this.checkpointIndex = 0;
    this.stuckSeconds = 0;
    this.finished = false;
  }

  preload(): void {
    this.load.image(`car-${this.sceneData.car.id}`, `${import.meta.env.BASE_URL}${this.sceneData.car.gameAsset}`);
  }

  create(): void {
    this.simulation = createPhysicsWorld();
    this.lastSnapshot = this.simulation.getSnapshot();
    this.finishX = Math.max(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x))) - 2;
    this.drawSky();
    this.drawTrack();
    this.drawCheckpoints();
    this.drawFinish();
    this.createVehicle();
    this.createDust();

    const worldWidth = (this.finishX + 28) * PIXELS_PER_METRE + ORIGIN.x;
    this.cameras.main.setBounds(0, 0, worldWidth, 900);
    this.cameras.main.startFollow(this.chassis, true, this.sceneData.reducedMotion ? 1 : 0.085, this.sceneData.reducedMotion ? 1 : 0.085, -this.scale.width * 0.15, 70);
    this.cameras.main.setBackgroundColor("#8ed8ef");
    this.syncVehicle(this.lastSnapshot);
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const delta = Math.min(deltaMs / 1000, 0.05);
    this.accumulator += delta;

    const throttle = this.sceneData.input.state.throttle;
    const brake = this.sceneData.input.state.brake;
    let lean = throttle ? this.sceneData.car.airControl : brake ? -this.sceneData.car.airControl : 0;
    if (!throttle && !brake && this.sceneData.assists) {
      lean = -normalizeAngle(this.lastSnapshot.chassis.angle) * 0.7;
    }
    this.simulation.setInput({
      throttle: throttle ? this.sceneData.car.motor : brake && Math.abs(this.lastSnapshot.velocity.x) < 0.7 ? -1 : 0,
      brake: brake && Math.abs(this.lastSnapshot.velocity.x) >= 0.7,
      lean,
      turbo: this.sceneData.input.state.turbo
    });

    while (this.accumulator >= this.simulation.fixedTimeStep) {
      this.lastSnapshot = this.simulation.step();
      this.accumulator -= this.simulation.fixedTimeStep;
    }

    if (this.sceneData.input.consumeReset()) this.respawn();
    this.checkProgress();
    this.checkRecovery(delta, throttle);
    this.syncVehicle(this.lastSnapshot);

    const speed = Math.abs(this.lastSnapshot.velocity.x) * 9;
    this.sceneData.onSpeed(speed);
    this.sceneData.audio.updateEngine(speed, throttle);
    this.emitDust(speed, throttle);
  }

  private drawSky(): void {
    const sky = this.add.graphics().setScrollFactor(0.08).setDepth(-20);
    sky.fillGradientStyle(0x79ccec, 0x79ccec, 0xeaf8f2, 0xeaf8f2, 1);
    sky.fillRect(-400, -100, 3200, 900);
    sky.fillStyle(0xffe4a3, 0.85).fillCircle(this.scale.width * 0.78, 130, 72);

    const far = this.add.graphics().setScrollFactor(0.28).setDepth(-18);
    far.fillStyle(0x8cb8b1, 1);
    far.fillTriangle(-300, 630, 80, 230, 450, 630);
    far.fillTriangle(180, 630, 620, 180, 1100, 630);
    far.fillTriangle(850, 630, 1280, 270, 1760, 630);
    far.fillStyle(0x6b9b83, 1);
    far.fillTriangle(-180, 650, 250, 370, 700, 650);
    far.fillTriangle(520, 650, 980, 310, 1450, 650);

    const clouds = this.add.graphics().setScrollFactor(0.16).setDepth(-17);
    clouds.fillStyle(0xffffff, 0.74);
    for (const [x, y, scale] of [[120, 120, 1], [720, 190, 0.7], [1380, 105, 1.2]] as const) {
      clouds.fillCircle(x, y, 33 * scale).fillCircle(x + 42 * scale, y - 8, 46 * scale).fillCircle(x + 86 * scale, y, 30 * scale);
      clouds.fillRoundedRect(x - 10, y, 116 * scale, 34 * scale, 17 * scale);
    }
  }

  private drawTrack(): void {
    const scenery = this.add.graphics().setDepth(-7);
    scenery.fillStyle(0x4f8e52, 1).fillRect(0, ORIGIN.y + 10, (this.finishX + 35) * PIXELS_PER_METRE + ORIGIN.x, 350);
    scenery.fillStyle(0x376b42, 1);
    for (let x = 0; x < (this.finishX + 35) * PIXELS_PER_METRE + ORIGIN.x; x += 140) {
      scenery.fillTriangle(x, ORIGIN.y + 28, x + 65, ORIGIN.y - 70 - (x % 3) * 15, x + 130, ORIGIN.y + 28);
    }

    const track = this.add.graphics().setDepth(-2);
    for (const points of renderPolylines(this.simulation.track)) {
      const screen = points.map((point) => physicsToScreen(point, PIXELS_PER_METRE, ORIGIN));
      track.lineStyle(30, 0x4a2817, 0.48).beginPath().moveTo(screen[0].x, screen[0].y + 8);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y + 8);
      track.strokePath();
      track.lineStyle(22, 0x9b5a2f, 1).beginPath().moveTo(screen[0].x, screen[0].y);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y);
      track.strokePath();
      track.lineStyle(5, 0xe6ad62, 0.9).beginPath().moveTo(screen[0].x, screen[0].y - 4);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y - 4);
      track.strokePath();

      for (let index = 0; index < screen.length - 1; index += 2) {
        const current = screen[index];
        const next = screen[index + 1];
        const angle = Math.atan2(next.y - current.y, next.x - current.x) + Math.PI / 2;
        const dx = Math.cos(angle) * 15;
        const dy = Math.sin(angle) * 15;
        track.lineStyle(4, 0x5e321d, 0.9).lineBetween(current.x - dx, current.y - dy, current.x + dx, current.y + dy);
      }
    }
  }

  private drawCheckpoints(): void {
    for (const [index, checkpoint] of this.simulation.track.checkpoints.entries()) {
      if (index === 0) continue;
      const point = physicsToScreen(checkpoint.position, PIXELS_PER_METRE, ORIGIN);
      const marker = this.add.graphics().setDepth(-1);
      marker.fillStyle(0x28c28a, 0.22).fillCircle(point.x, point.y, 32);
      marker.lineStyle(5, 0xd9fff1, 0.78).strokeCircle(point.x, point.y, 27);
      marker.fillStyle(0xffffff, 0.9).fillTriangle(point.x - 6, point.y - 12, point.x + 12, point.y, point.x - 6, point.y + 12);
    }
  }

  private drawFinish(): void {
    const point = physicsToScreen({ x: this.finishX, y: 0 }, PIXELS_PER_METRE, ORIGIN);
    const finish = this.add.graphics().setDepth(-1);
    finish.fillStyle(0xf2ca64).fillRect(point.x - 12, point.y - 170, 18, 175).fillRect(point.x + 150, point.y - 170, 18, 175);
    const size = 22;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        finish.fillStyle((row + column) % 2 === 0 ? 0x101a29 : 0xf7f3e9).fillRect(point.x, point.y - 170 + row * size, size, size);
      }
    }
  }

  private createVehicle(): void {
    this.chassis = this.add.image(0, 0, `car-${this.sceneData.car.id}`).setDepth(5).setScale(this.sceneData.car.bodyScale);
    this.rearWheel = this.makeWheel();
    this.frontWheel = this.makeWheel();
  }

  private makeWheel(): Phaser.GameObjects.Graphics {
    const wheel = this.add.graphics().setDepth(6);
    wheel.fillStyle(0x101723).fillCircle(0, 0, 21);
    wheel.lineStyle(5, 0xeff6fb).strokeCircle(0, 0, 14);
    wheel.lineStyle(3, this.sceneData.car.accent).lineBetween(-12, 0, 12, 0).lineBetween(0, -12, 0, 12);
    return wheel;
  }

  private createDust(): void {
    const texture = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0xd8c28f).fillCircle(4, 4, 4).generateTexture("dust", 8, 8);
    texture.destroy();
    this.dust = this.add.particles(0, 0, "dust", {
      lifespan: 450,
      speed: { min: 12, max: 48 },
      angle: { min: 160, max: 205 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.65, end: 0 },
      emitting: false
    }).setDepth(1);
  }

  private syncVehicle(snapshot: VehicleSnapshot): void {
    this.placeObject(this.chassis, snapshot.chassis.position, snapshot.chassis.angle);
    this.placeObject(this.rearWheel, snapshot.rearWheel.position, snapshot.rearWheel.angle);
    this.placeObject(this.frontWheel, snapshot.frontWheel.position, snapshot.frontWheel.angle);
  }

  private placeObject(object: Phaser.GameObjects.Components.Transform, position: Point, angle: number): void {
    const point = physicsToScreen(position, PIXELS_PER_METRE, ORIGIN);
    object.setPosition(point.x, point.y).setRotation(-angle);
  }

  private checkProgress(): void {
    if (this.lastSnapshot.checkpointIndex > this.checkpointIndex) {
      this.checkpointIndex = this.lastSnapshot.checkpointIndex;
      this.sceneData.onCheckpoint(this.simulation.track.checkpoints[this.checkpointIndex].id);
    }
    if (this.lastSnapshot.chassis.position.x >= this.finishX && !this.finished) {
      this.finished = true;
      this.sceneData.onFinish();
    }
  }

  private checkRecovery(delta: number, throttle: boolean): void {
    if (!this.sceneData.assists) return;
    const angle = Math.abs(normalizeAngle(this.lastSnapshot.chassis.angle));
    const slow = Math.abs(this.lastSnapshot.velocity.x) < 0.25;
    if (angle > 1.9 || (slow && throttle)) this.stuckSeconds += delta;
    else this.stuckSeconds = 0;
    if (this.stuckSeconds > 2.3) this.respawn();
  }

  private respawn(): void {
    this.lastSnapshot = this.simulation.respawn();
    this.stuckSeconds = 0;
    this.sceneData.onRespawn();
    if (!this.sceneData.reducedMotion) this.cameras.main.flash(160, 255, 244, 190, false);
  }

  private emitDust(speed: number, throttle: boolean): void {
    if (!throttle || speed < 4 || this.sceneData.reducedMotion) return;
    const point = physicsToScreen(this.lastSnapshot.rearWheel.position, PIXELS_PER_METRE, ORIGIN);
    this.dust.setPosition(point.x, point.y + 18).emitParticle(1);
  }
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
