import Phaser from "phaser";
import type { GameAudio } from "./audio";
import type { CarSpec } from "./cars";
import type { InputController } from "./input";
import { createPhysicsWorld, type PhysicsWorld, type VehicleSnapshot } from "./physics";
import { physicsToScreen, renderPolylines, type Point, type TrackDefinition } from "./track";

const PIXELS_PER_METRE = 45;
const ORIGIN: Point = { x: 850, y: 590 };

export interface GameSceneData {
  car: CarSpec;
  track: TrackDefinition;
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
  private suspension!: Phaser.GameObjects.Graphics;
  private vehicleShadow!: Phaser.GameObjects.Graphics;
  private turboFlame!: Phaser.GameObjects.Graphics;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastSnapshot!: VehicleSnapshot;
  private accumulator = 0;
  private checkpointIndex = 0;
  private stuckSeconds = 0;
  private finished = false;
  private finishX = 0;
  private springboardActivations = 0;

  constructor() {
    super({ key: "GameScene", active: false });
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
    this.accumulator = 0;
    this.checkpointIndex = 0;
    this.stuckSeconds = 0;
    this.finished = false;
    this.springboardActivations = 0;
  }

  preload(): void {
    this.load.image(`car-${this.sceneData.car.id}`, `${import.meta.env.BASE_URL}${this.sceneData.car.gameAsset}`);
  }

  create(): void {
    this.simulation = createPhysicsWorld({ track: this.sceneData.track });
    this.lastSnapshot = this.simulation.getSnapshot();
    this.finishX = Math.max(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x))) - 2;
    this.drawSky();
    this.drawTrack();
    this.drawCheckpoints();
    this.drawFinish();
    this.createVehicle();
    this.createDust();

    const minimumX = Math.min(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x)));
    const leftBound = physicsToScreen({ x: minimumX - 15, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const rightBound = physicsToScreen({ x: this.finishX + 28, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    this.cameras.main.setBounds(leftBound, 0, rightBound - leftBound, 900);
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
      throttle: throttle ? this.sceneData.car.motor : brake && this.lastSnapshot.velocity.x <= 0.7 ? -1 : 0,
      brake: brake && this.lastSnapshot.velocity.x > 0.7,
      lean,
      turbo: this.sceneData.input.state.turbo
    });

    while (this.accumulator >= this.simulation.fixedTimeStep) {
      this.lastSnapshot = this.simulation.step();
      this.accumulator -= this.simulation.fixedTimeStep;
    }
    if (this.lastSnapshot.springboardActivations > this.springboardActivations) {
      this.springboardActivations = this.lastSnapshot.springboardActivations;
      if (!this.sceneData.reducedMotion) this.cameras.main.shake(130, 0.007);
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
    const theme = this.simulation.track.theme;
    const sky = this.add.graphics().setScrollFactor(0.08).setDepth(-20);
    sky.fillGradientStyle(theme?.skyTop ?? 0x79ccec, theme?.skyTop ?? 0x79ccec, theme?.skyBottom ?? 0xeaf8f2, theme?.skyBottom ?? 0xeaf8f2, 1);
    sky.fillRect(-7000, -100, 36000, 1000);
    sky.fillStyle(0xffe4a3, 0.85).fillCircle(this.scale.width * 0.78, 130, 72);

    const far = this.add.graphics().setScrollFactor(0.28).setDepth(-18);
    far.fillStyle(theme?.scenery ?? 0x8cb8b1, 1);
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
    const theme = this.simulation.track.theme;
    const minimumX = Math.min(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x)));
    const sceneryLeft = physicsToScreen({ x: minimumX - 20, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const sceneryRight = physicsToScreen({ x: this.finishX + 35, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const scenery = this.add.graphics().setDepth(-7);
    scenery.fillStyle(theme?.ground ?? 0x4f8e52, 1).fillRect(sceneryLeft, ORIGIN.y + 10, sceneryRight - sceneryLeft, 350);
    scenery.fillStyle(theme?.scenery ?? 0x376b42, 1);
    for (let x = sceneryLeft; x < sceneryRight; x += 140) {
      scenery.fillTriangle(x, ORIGIN.y + 28, x + 65, ORIGIN.y - 70 - (x % 3) * 15, x + 130, ORIGIN.y + 28);
    }

    const hazards = this.add.graphics().setDepth(-6);
    for (const hazard of this.simulation.track.hazards) {
      const left = physicsToScreen({ x: hazard.startX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
      const right = physicsToScreen({ x: hazard.endX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
      const bottom = ORIGIN.y + hazard.depth * PIXELS_PER_METRE;
      hazards.fillStyle(theme?.abyss ?? 0x111522, 0.96).beginPath().moveTo(left, ORIGIN.y - 5);
      hazards.lineTo(left + 28, ORIGIN.y + 70).lineTo((left + right) / 2, bottom);
      hazards.lineTo(right - 28, ORIGIN.y + 70).lineTo(right, ORIGIN.y - 5).closePath().fillPath();
      hazards.lineStyle(7, 0x6b301f, 0.9).lineBetween(left, ORIGIN.y, left + 24, ORIGIN.y + 65);
      hazards.lineBetween(right, ORIGIN.y, right - 24, ORIGIN.y + 65);
    }

    const track = this.add.graphics().setDepth(-2);
    for (const points of renderPolylines(this.simulation.track)) {
      const screen = points.map((point) => physicsToScreen(point, PIXELS_PER_METRE, ORIGIN));
      track.lineStyle(30, 0x4a2817, 0.48).beginPath().moveTo(screen[0].x, screen[0].y + 8);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y + 8);
      track.strokePath();
      track.lineStyle(22, theme?.road ?? 0x9b5a2f, 1).beginPath().moveTo(screen[0].x, screen[0].y);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y);
      track.strokePath();
      track.lineStyle(5, theme?.roadEdge ?? 0xe6ad62, 0.9).beginPath().moveTo(screen[0].x, screen[0].y - 4);
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

    for (const board of this.simulation.track.springboards) {
      const point = physicsToScreen(board.position, PIXELS_PER_METRE, ORIGIN);
      const width = board.width * PIXELS_PER_METRE;
      track.fillStyle(0x17233c, 0.7).fillRoundedRect(point.x - width / 2, point.y - 4, width, 17, 7);
      track.lineStyle(7, theme?.accent ?? 0xffcf3f, 1).lineBetween(point.x - width / 2 + 8, point.y - 7, point.x + width / 2 - 8, point.y - 7);
      track.lineStyle(4, 0xf05252, 1);
      for (let x = point.x - width / 2 + 18; x < point.x + width / 2 - 12; x += 25) {
        track.beginPath().moveTo(x, point.y + 12).lineTo(x + 7, point.y + 23).lineTo(x + 14, point.y + 12).strokePath();
      }
      track.fillStyle(0xffffff, 0.95).fillTriangle(point.x - 8, point.y - 28, point.x + 9, point.y - 28, point.x, point.y - 45);
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
    this.vehicleShadow = this.add.graphics().setDepth(2);
    this.suspension = this.add.graphics().setDepth(4);
    this.turboFlame = this.add.graphics().setDepth(4);
    this.chassis = this.add.image(0, 0, `car-${this.sceneData.car.id}`).setDepth(5).setScale(this.sceneData.car.bodyScale);
    this.rearWheel = this.makeWheel();
    this.frontWheel = this.makeWheel();
  }

  private makeWheel(): Phaser.GameObjects.Graphics {
    const wheel = this.add.graphics().setDepth(6);
    const radius = this.sceneData.car.id === "lynx" ? 24 : 21;
    wheel.fillStyle(0x060910).fillCircle(0, 0, radius);
    wheel.lineStyle(4, 0x273243).strokeCircle(0, 0, radius - 3);
    wheel.fillStyle(0x253247).fillCircle(0, 0, radius - 9);
    wheel.lineStyle(3, this.sceneData.car.accent, 0.9).strokeCircle(0, 0, radius - 11);
    wheel.lineStyle(3, 0xdcecff, 0.8);
    const spoke = radius - 12;
    wheel.lineBetween(-spoke, 0, spoke, 0).lineBetween(0, -spoke, 0, spoke);
    wheel.lineBetween(-spoke * 0.7, -spoke * 0.7, spoke * 0.7, spoke * 0.7);
    wheel.lineBetween(spoke * 0.7, -spoke * 0.7, -spoke * 0.7, spoke * 0.7);
    wheel.fillStyle(0xe8f3fb).fillCircle(0, 0, 4);
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
    const chassisPoint = physicsToScreen(snapshot.chassis.position, PIXELS_PER_METRE, ORIGIN);
    const rearPoint = physicsToScreen(snapshot.rearWheel.position, PIXELS_PER_METRE, ORIGIN);
    const frontPoint = physicsToScreen(snapshot.frontWheel.position, PIXELS_PER_METRE, ORIGIN);
    const rearMount = physicsToScreen(this.localToWorld(snapshot.chassis.position, snapshot.chassis.angle, { x: -0.72, y: -0.12 }), PIXELS_PER_METRE, ORIGIN);
    const frontMount = physicsToScreen(this.localToWorld(snapshot.chassis.position, snapshot.chassis.angle, { x: 0.72, y: -0.12 }), PIXELS_PER_METRE, ORIGIN);
    const speed = Math.abs(snapshot.velocity.x);
    const height = Math.max(0, snapshot.chassis.position.y - 1.1);
    this.vehicleShadow.clear().fillStyle(0x07101c, Math.max(0.08, 0.3 - height * 0.018));
    this.vehicleShadow.fillEllipse(chassisPoint.x, chassisPoint.y + 42 + Math.min(height * 8, 80), Math.max(34, 115 - height * 5), 18);
    this.suspension.clear().lineStyle(7, 0x152033, 0.92).lineBetween(rearMount.x, rearMount.y, rearPoint.x, rearPoint.y);
    this.suspension.lineBetween(frontMount.x, frontMount.y, frontPoint.x, frontPoint.y);
    this.suspension.lineStyle(3, this.sceneData.car.accent, 1).lineBetween(rearMount.x, rearMount.y, rearPoint.x, rearPoint.y);
    this.suspension.lineBetween(frontMount.x, frontMount.y, frontPoint.x, frontPoint.y);
    this.turboFlame.clear();
    if (this.sceneData.input.state.turbo && speed > 1) {
      const anchorWorld = this.localToWorld(snapshot.chassis.position, snapshot.chassis.angle, this.sceneData.car.exhaustOffset);
      const anchor = physicsToScreen(anchorWorld, PIXELS_PER_METRE, ORIGIN);
      const backward = { x: -Math.cos(snapshot.chassis.angle), y: Math.sin(snapshot.chassis.angle) };
      const normal = { x: -backward.y, y: backward.x };
      const length = 30 + Math.min(speed * 2.2, 32);
      this.drawFlame(anchor, backward, normal, length, 0xff3bd4, 10);
      this.drawFlame(anchor, backward, normal, length * 0.62, 0x76f7ff, 5);
    }
    this.placeObject(this.chassis, snapshot.chassis.position, snapshot.chassis.angle);
    this.placeObject(this.rearWheel, snapshot.rearWheel.position, snapshot.rearWheel.angle);
    this.placeObject(this.frontWheel, snapshot.frontWheel.position, snapshot.frontWheel.angle);
  }

  private drawFlame(anchor: Point, backward: Point, normal: Point, length: number, color: number, width: number): void {
    this.turboFlame.fillStyle(color, 0.95).beginPath();
    this.turboFlame.moveTo(anchor.x + normal.x * width, anchor.y + normal.y * width);
    this.turboFlame.lineTo(anchor.x + backward.x * length, anchor.y + backward.y * length);
    this.turboFlame.lineTo(anchor.x - normal.x * width, anchor.y - normal.y * width);
    this.turboFlame.closePath().fillPath();
  }

  private localToWorld(origin: Point, angle: number, offset: Point): Point {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: origin.x + offset.x * cosine - offset.y * sine,
      y: origin.y + offset.x * sine + offset.y * cosine,
    };
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
