import Phaser from "phaser";
import { nativeAppearance, type NativeTheme } from "./appearance";
import { drivingFocus, drivingSpan } from "./sceneView";
import { paintScenery } from "./scenery";
import { assetUrl } from "../assets";
import { FrameClock, renderScale } from "./frameClock";
import type { GameAudio } from "./audio";
import type { CarSpec } from "./cars";
import type { InputController } from "./input";
import { createPhysicsWorld, type PhysicsWorld, type VehicleSnapshot } from "./physics";
import { physicsToScreen, renderPolylines, trackSurfaceYAt, type Point, type TrackDefinition, type TrackObstacle } from "./track";

const PIXELS_PER_METRE = 45;
const ORIGIN: Point = { x: 850, y: 590 };

export interface GameSceneData {
  car: CarSpec;
  track: TrackDefinition;
  assists: boolean;
  reducedMotion: boolean;
  lightMode: boolean;
  input: InputController;
  audio: GameAudio;
  onSpeed: (speed: number) => void;
  onCheckpoint: (id: string) => void;
  onFinish: () => void;
  onObstacleBreak: () => void;
  onRespawn: () => void;
  onChallengeFailure: (obstacle: TrackObstacle, attempts: number) => void;
}

export class GameScene extends Phaser.Scene {
  private sceneData!: GameSceneData;
  private simulation!: PhysicsWorld;
  private backdrop: Phaser.GameObjects.Graphics[] = [];
  private appearance: NativeTheme = "light";
  private cameraFocus!: Phaser.GameObjects.Zone;
  private vehicleLights!: Phaser.GameObjects.Graphics;
  private readonly fragments = new Set<Phaser.GameObjects.Rectangle>();
  private chassis!: Phaser.GameObjects.Image;
  private rearWheel!: Phaser.GameObjects.Image;
  private frontWheel!: Phaser.GameObjects.Image;
  private suspension!: Phaser.GameObjects.Graphics;
  private vehicleShadow!: Phaser.GameObjects.Graphics;
  private turboFlame!: Phaser.GameObjects.Graphics;
  private readonly obstacleVisuals = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly shatteredObstacles = new Set<string>();
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastSnapshot!: VehicleSnapshot;
  private readonly clock = new FrameClock();
  private simulationSteps = 0;
  private readonly decorations: { graphics: Phaser.GameObjects.Graphics; left: number; right: number }[] = [];
  private checkpointIndex = 0;
  private stuckSeconds = 0;
  private finished = false;
  private finishX = 0;
  private springboardActivations = 0;
  private readonly challengeAttempts = new Map<string, number>();

  constructor() {
    super({ key: "GameScene", active: false });
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
    this.clock.reset();
    this.simulationSteps = 0;
    this.decorations.length = 0;
    this.backdrop = [];
    this.fragments.clear();
    this.checkpointIndex = 0;
    this.stuckSeconds = 0;
    this.finished = false;
    this.springboardActivations = 0;
    this.obstacleVisuals.clear();
    this.shatteredObstacles.clear();
    this.challengeAttempts.clear();
  }

  preload(): void {
    this.load.image(`car-${this.sceneData.car.id}`, assetUrl(this.sceneData.car.gameAsset));
  }

  create(): void {
    this.simulation = createPhysicsWorld({ track: this.sceneData.track, car: this.sceneData.car });
    this.lastSnapshot = this.simulation.getSnapshot();
    this.finishX = Math.max(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x))) - 2;
    this.drawSky();
    this.drawTrack();
    this.drawObstacles();
    this.drawCheckpoints();
    this.drawFinish();
    this.createVehicle();
    this.createDust();

    const minimumX = Math.min(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x)));
    const leftBound = physicsToScreen({ x: minimumX - 15, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const rightBound = physicsToScreen({ x: this.finishX + 28, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    this.cameras.main.setBounds(leftBound, -1200, rightBound - leftBound, 2100);
    this.cameraFocus = this.add.zone(0, 0, 1, 1);
    this.updateCameraFocus();
    this.configureCamera();
    this.applyAppearance();
    window.addEventListener("familyv2:appearance", this.applyAppearance);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.clock.reset, this.clock);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.configureCamera, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.clock.reset, this.clock);
      window.removeEventListener("familyv2:appearance", this.applyAppearance);
      this.decorations.length = 0;
    });

    this.syncVehicle(this.lastSnapshot);
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const throttle = this.sceneData.input.state.throttle;
    const brake = this.sceneData.input.state.brake;
    if (this.sceneData.input.consumeReset()) this.respawn();
    this.clock.advance(deltaMs / 1000, (delta) => {
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
      const previousRespawns = this.lastSnapshot.respawnCount;
      this.lastSnapshot = this.simulation.step(delta);
      if (this.lastSnapshot.respawnCount > previousRespawns) {
        this.stuckSeconds = 0;
        this.sceneData.onRespawn();
      }
      this.simulationSteps++;
      this.checkProgress();
      this.checkRecovery(delta, throttle);
      return !this.finished && this.scene.isActive();
    });
    if (this.lastSnapshot.springboardActivations > this.springboardActivations) {
      this.springboardActivations = this.lastSnapshot.springboardActivations;
      if (this.motionAllowed()) this.cameras.main.shake(130, 0.007);
    }

    this.syncVehicle(this.lastSnapshot);
    this.updateCameraFocus(deltaMs);
    const camera = this.cameras.main;
    const viewLeft = camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom);
    for (const item of this.decorations) item.graphics.visible = item.right >= viewLeft - 180 && item.left <= viewLeft + camera.width / camera.zoom + 180;
    const lerp = !this.motionAllowed() ? 1 : 1 - Math.pow(1 - 0.085, Math.min(deltaMs, 250) / (1000 / 60));
    camera.setLerp(lerp, lerp);

    const speed = Math.abs(this.lastSnapshot.velocity.x) * 9;
    this.sceneData.onSpeed(speed);
    this.sceneData.audio.updateEngine(speed, throttle);
    this.emitDust(speed, throttle);
  }

  diagnostics(): object {
    return JSON.parse(JSON.stringify({ steps: this.simulationSteps, snapshot: this.lastSnapshot,
      decorations: this.decorations.length, visibleDecorations: this.decorations.filter(item => item.graphics.visible).length,
      zoom: this.cameras.main.zoom, scrollX: this.cameras.main.scrollX,
      theme: this.appearance, decorativeMotion: this.motionAllowed(), dustAlive: (this.dust?.getAliveParticleCount() ?? 0),
      nativeText: this.children.list.filter((item): item is Phaser.GameObjects.Text => item instanceof Phaser.GameObjects.Text).map(item => ({ text: item.text, font: item.style.fontFamily })),
      fragments: this.fragments.size, cameraFocus: this.cameraFocus ? { x: this.cameraFocus.x, y: this.cameraFocus.y } : null,
      view: { x: this.cameras.main.worldView.x, y: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height } }));
  }

  private motionAllowed(): boolean {
    return nativeAppearance(this.sceneData.reducedMotion).motion;
  }

  private applyAppearance = (): void => {
    this.appearance = nativeAppearance(this.sceneData.reducedMotion).theme;
    paintScenery(this.backdrop, this.simulation.track.theme, this.simulation.track.id, this.appearance, window.innerWidth);
    if (!this.motionAllowed()) {
      this.dust.killAll();
      for (const fragment of this.fragments) {
        this.tweens.killTweensOf(fragment);
        fragment.destroy();
      }
      this.fragments.clear();
      this.cameras.main.resetFX();
    }
    this.syncVehicle(this.lastSnapshot);
  };

  private updateCameraFocus(deltaMs = 0): void {
    if (!this.cameraFocus) return;
    const point = physicsToScreen(drivingFocus(this.simulation.track, this.lastSnapshot), PIXELS_PER_METRE, ORIGIN);
    this.cameraFocus.setPosition(point.x, point.y);
    const factor = renderScale(window.innerWidth, window.innerHeight, this.sceneData.lightMode);
    const verticalSpan = drivingSpan(this.simulation.track, this.lastSnapshot, window.innerHeight);
    const targetZoom = factor * Math.min(1, window.innerHeight / verticalSpan);
    // Widen immediately on takeoff; restore gradually on descent, so the landing
    // cannot outrun a still-high following camera when zoom snaps back in.
    const zoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(targetZoom < zoom || !this.motionAllowed() ? targetZoom : Math.min(targetZoom, zoom + deltaMs * 0.00008));
  }

  private configureCamera(): void {
    const factor = renderScale(window.innerWidth, window.innerHeight, this.sceneData.lightMode);
    // A short screen needs a wider world view, not a cropped loop or hidden landing.
    this.cameras.main.setZoom(factor * Math.min(1, window.innerHeight / 540));
    this.cameras.main.startFollow(this.cameraFocus, true, this.motionAllowed() ? 0.085 : 1, this.motionAllowed() ? 0.085 : 1);
    if (this.backdrop.length) paintScenery(this.backdrop, this.simulation.track.theme, this.simulation.track.id, this.appearance, window.innerWidth);
  }

  private drawSky(): void {
    this.backdrop = [
      this.add.graphics().setScrollFactor(0.08).setDepth(-20),
      this.add.graphics().setScrollFactor(0.28).setDepth(-18),
      this.add.graphics().setScrollFactor(0.48).setDepth(-17),
    ];
  }

  private drawTrack(): void {
    const theme = this.simulation.track.theme;
    const minimumX = Math.min(...this.simulation.track.segments.flatMap((segment) => segment.points.map((point) => point.x)));
    const sceneryLeft = physicsToScreen({ x: minimumX - 20, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const sceneryRight = physicsToScreen({ x: this.finishX + 35, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
    const scenery = this.add.graphics().setDepth(-7);
    scenery.fillStyle(theme?.ground ?? 0x4f8e52, 1).fillRect(sceneryLeft, ORIGIN.y + 10, sceneryRight - sceneryLeft, 350);
    // Cut-earth strata and scattered aggregate give the platform a material,
    // without textures, shaders, particles or per-frame scenery allocation.
    for (let band = 0; band < 3; band++) {
      scenery.fillStyle(0x162c35, 0.08 + band * 0.025).fillRect(sceneryLeft, ORIGIN.y + 60 + band * 74, sceneryRight - sceneryLeft, 18 + band * 7);
    }
    scenery.fillStyle(0xe1cba0, 0.22);
    for (let x = sceneryLeft; x < sceneryRight; x += 105) {
      scenery.fillTriangle(x, ORIGIN.y + 45, x + 17, ORIGIN.y + 40, x + 25, ORIGIN.y + 49);
    }
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
      if (hazard.requiresTurbo) {
        hazards.lineStyle(6, 0xffd33d, 1).lineBetween(left - 32, ORIGIN.y - 8, left, ORIGIN.y - 8);
        hazards.lineBetween(left, ORIGIN.y - 22, left, ORIGIN.y + 8);
        const signPosition = physicsToScreen({
          x: hazard.startX - 4,
          y: trackSurfaceYAt(this.simulation.track.segments, hazard.startX - 4) + 2.2,
        }, PIXELS_PER_METRE, ORIGIN);
        this.add.text(signPosition.x, signPosition.y, "⚡ Turbo", {
          color: "#251300",
          backgroundColor: "#ffd33d",
          fontFamily: window.FamilyV2?.fontFamily ?? "Family School, cursive",
          fontSize: "18px",
          fontStyle: "normal",
          padding: { x: 10, y: 6 },
        }).setOrigin(0.5).setDepth(1);
      }
    }

    for (const points of renderPolylines(this.simulation.track)) {
      const track = this.add.graphics().setDepth(-2);
      const screen = points.map((point) => physicsToScreen(point, PIXELS_PER_METRE, ORIGIN));
      this.decorations.push({ graphics: track, left: Math.min(...screen.map(p => p.x)) - 30, right: Math.max(...screen.map(p => p.x)) + 30 });
      // Cast extrusion and steel understructure stay behind the collision surface.
      for (let index = 0; index < screen.length; index += 6) {
        const point = screen[index];
        if (point.y > ORIGIN.y - 35) continue;
        track.lineStyle(9, 0x253441, 0.65).lineBetween(point.x + 6, point.y + 18, point.x + 6, ORIGIN.y + 30);
        track.lineStyle(3, 0xd3c2a1, 0.65).lineBetween(point.x + 3, point.y + 18, point.x + 3, ORIGIN.y + 30);
      }
      track.lineStyle(36, 0x122333, 0.6).beginPath().moveTo(screen[0].x + 5, screen[0].y + 14);
      for (const point of screen.slice(1)) track.lineTo(point.x + 5, point.y + 14);
      track.strokePath();
      track.lineStyle(30, 0x4a2817, 0.48).beginPath().moveTo(screen[0].x, screen[0].y + 8);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y + 8);
      track.strokePath();
      track.lineStyle(22, theme?.road ?? 0x9b5a2f, 1).beginPath().moveTo(screen[0].x, screen[0].y);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y);
      track.strokePath();
      track.lineStyle(5, theme?.roadEdge ?? 0xe6ad62, 0.9).beginPath().moveTo(screen[0].x, screen[0].y - 4);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y - 4);
      track.strokePath();

      track.lineStyle(2, 0xfff1d6, 0.8).beginPath().moveTo(screen[0].x, screen[0].y - 9);
      for (const point of screen.slice(1)) track.lineTo(point.x, point.y - 9);
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

    const track = this.add.graphics().setDepth(-2);
    for (const gap of this.simulation.track.hazards) {
      for (let i = 0; i < 5; i++) {
        const x = gap.endX + 0.5 + i * 0.7;
        const point = physicsToScreen({ x, y: trackSurfaceYAt(this.simulation.track.segments, x) }, PIXELS_PER_METRE, ORIGIN);
        track.lineStyle(4, i % 2 ? 0x223644 : 0xe7fff0, 0.95).lineBetween(point.x, point.y - 7, point.x + 17, point.y - 7);
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
      this.decorations.push({ graphics: marker, left: point.x - 35, right: point.x + 35 });
      marker.fillStyle(0x28c28a, 0.22).fillCircle(point.x, point.y, 32);
      marker.lineStyle(5, 0xd9fff1, 0.78).strokeCircle(point.x, point.y, 27);
      marker.fillStyle(0xffffff, 0.9).fillTriangle(point.x - 6, point.y - 12, point.x + 12, point.y, point.x - 6, point.y + 12);
    }
  }

  private drawObstacles(): void {
    for (const obstacle of this.simulation.track.obstacles ?? []) {
      const point = physicsToScreen(obstacle.position, PIXELS_PER_METRE, ORIGIN);
      const visual = this.add.graphics().setPosition(point.x, point.y).setDepth(3);
      if (obstacle.style === "rock") {
        const width = obstacle.width * PIXELS_PER_METRE;
        const height = obstacle.height * PIXELS_PER_METRE;
        visual.fillStyle(0x596273).beginPath().moveTo(-width / 2, 0).lineTo(-width * 0.35, -height * 0.68);
        visual.lineTo(0, -height).lineTo(width * 0.42, -height * 0.62).lineTo(width / 2, 0).closePath().fillPath();
        visual.lineStyle(4, 0x99a6b5, 0.7).lineBetween(-width * 0.22, -height * 0.55, 0, -height * 0.78);
      } else if (obstacle.style === "tires") {
        visual.fillStyle(0x080b12).fillCircle(-17, -17, 18).fillCircle(17, -17, 18).fillCircle(0, -43, 18);
        visual.lineStyle(5, 0x394558).strokeCircle(-17, -17, 12).strokeCircle(17, -17, 12).strokeCircle(0, -43, 12);
      } else if (obstacle.style === "crates") {
        this.drawCrate(visual, -23, -44, 44);
        this.drawCrate(visual, 23, -44, 44);
        this.drawCrate(visual, 0, -86, 44);
      } else if (obstacle.style === "roadblock") {
        visual.fillStyle(0xe8eef4).fillRect(-30, -62, 7, 62).fillRect(23, -62, 7, 62);
        visual.fillStyle(0xf5c44d).fillRoundedRect(-38, -66, 76, 26, 5);
        visual.lineStyle(8, 0xd83d36);
        for (let x = -28; x <= 22; x += 25) visual.lineBetween(x, -64, x + 16, -42);
        visual.fillStyle(0xfff3a2).fillCircle(-27, -73, 5).fillCircle(27, -73, 5);
      } else if (obstacle.style === "tunnel") {
        visual.fillStyle(0x243246).fillRoundedRect(-60, -90, 120, 22, 8).fillRect(-60, -90, 16, 90).fillRect(44, -90, 16, 90);
        visual.lineStyle(5, 0xffcf4d).lineBetween(-38, -70, 38, -70);
      } else if (obstacle.style === "iceGate") {
        visual.fillStyle(0x8ef4ff, 0.72).fillTriangle(-58, 0, -34, -58, -10, 0).fillTriangle(-16, 0, 10, -72, 36, 0).fillTriangle(20, 0, 48, -50, 64, 0);
        visual.lineStyle(4, 0xe9ffff, 0.9).lineBetween(-48, -4, 52, -4);
      } else if (obstacle.style === "brakeGate") {
        visual.fillStyle(0xe83c3c).fillRoundedRect(-44, -72, 88, 72, 10);
        visual.fillStyle(0xffffff).fillCircle(0, -38, 25);
        visual.fillStyle(0xe83c3c).fillRect(-20, -43, 40, 10);
      } else if (obstacle.style === "heavyGate") {
        visual.fillStyle(0x3d4652).fillRoundedRect(-42, -86, 84, 86, 7);
        visual.lineStyle(8, 0xffa52f).lineBetween(-35, -72, 35, -12).lineBetween(35, -72, -35, -12);
        visual.fillStyle(0xf7d45b).fillCircle(0, -43, 12);
      } else {
        visual.fillStyle(0x4a5360).fillRoundedRect(-48, -68, 96, 68, 8);
        visual.lineStyle(6, 0xffc943).lineBetween(-38, -55, 38, -55);
        visual.fillStyle(0xffffff).fillTriangle(-13, -30, 13, -30, 0, -51);
      }
      if (obstacle.requirement) {
        this.add.text(point.x, point.y - obstacle.height * PIXELS_PER_METRE - 42, `${obstacle.requirement.hint}\n${obstacle.requirement.label}`, {
          color: "#10233f",
          backgroundColor: "#fff2a8",
          fontFamily: window.FamilyV2?.fontFamily ?? "Family School, cursive",
          fontSize: "15px",
          fontStyle: "normal",
          align: "center",
          padding: { x: 8, y: 5 },
        }).setOrigin(0.5).setDepth(4);
      }
      this.obstacleVisuals.set(obstacle.id, visual);
    }
  }

  private drawCrate(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    graphics.fillStyle(0xb8682b).fillRect(x - size / 2, y, size, size);
    graphics.lineStyle(4, 0x6d371b).strokeRect(x - size / 2, y, size, size);
    graphics.lineBetween(x - size / 2 + 5, y + 5, x + size / 2 - 5, y + size - 5);
    graphics.lineBetween(x + size / 2 - 5, y + 5, x - size / 2 + 5, y + size - 5);
  }

  private drawFinish(): void {
    const point = physicsToScreen({ x: this.finishX, y: 0 }, PIXELS_PER_METRE, ORIGIN);
    const finish = this.add.graphics().setDepth(-1);
    this.decorations.push({ graphics: finish, left: point.x - 20, right: point.x + 170 });
    finish.fillStyle(0xf2ca64).fillRect(point.x - 12, point.y - 170, 18, 175).fillRect(point.x + 150, point.y - 170, 18, 175);
    const size = 22;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        finish.fillStyle((row + column) % 2 === 0 ? 0x101a29 : 0xf7f3e9).fillRect(point.x + column * size, point.y - 170 + row * size, size, size);
      }
    }
  }

  private createVehicle(): void {
    this.vehicleLights = this.add.graphics().setDepth(4);
    this.vehicleShadow = this.add.graphics().setDepth(2);
    this.suspension = this.add.graphics().setDepth(4);
    this.turboFlame = this.add.graphics().setDepth(4);
    this.chassis = this.add.image(0, 0, `car-${this.sceneData.car.id}`).setDepth(5).setScale(this.sceneData.car.bodyScale);
    this.rearWheel = this.makeWheel();
    this.frontWheel = this.makeWheel();
  }

  private makeWheel(): Phaser.GameObjects.Image {
    const radius = this.sceneData.car.wheelRadius;
    const key = `wheel-${this.sceneData.car.id}`;
    if (this.textures.exists(key)) return this.add.image(0, 0, key).setDepth(6);
    const wheel = this.make.graphics({}, false);
    wheel.translateCanvas(radius + 3, radius + 3);
    wheel.fillStyle(0x060910).fillCircle(0, 0, radius);
    wheel.lineStyle(4, 0x273243).strokeCircle(0, 0, radius - 3);
    wheel.fillStyle(0x253247).fillCircle(0, 0, radius - 9);
    wheel.lineStyle(3, this.sceneData.car.accent, 0.9).strokeCircle(0, 0, radius - 11);
    wheel.lineStyle(3, 0xdcecff, 0.8);
    const spoke = radius - 12;
    wheel.lineBetween(-spoke, 0, spoke, 0).lineBetween(0, -spoke, 0, spoke);
    wheel.lineBetween(-spoke * 0.7, -spoke * 0.7, spoke * 0.7, spoke * 0.7);
    wheel.lineBetween(spoke * 0.7, -spoke * 0.7, -spoke * 0.7, spoke * 0.7);
    wheel.lineStyle(2, 0x647486, 0.8);
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      wheel.lineBetween(Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2), Math.cos(a + 0.09) * (radius - 6), Math.sin(a + 0.09) * (radius - 6));
    }
    wheel.lineStyle(1, 0xe9f4ff, 0.8).strokeCircle(0, 0, radius - 8);
    wheel.fillStyle(0xe8f3fb).fillCircle(0, 0, 4);
    wheel.generateTexture(key, (radius + 3) * 2, (radius + 3) * 2);
    wheel.destroy();
    return this.add.image(0, 0, key).setDepth(6);
  }

  private createDust(): void {
    if (!this.textures.exists("dust")) {
      const texture = this.make.graphics({ x: 0, y: 0 }, false).fillStyle(0xd8c28f).fillCircle(4, 4, 4).generateTexture("dust", 8, 8);
      texture.destroy();
    }
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
    const surface = trackSurfaceYAt(this.simulation.track.segments, snapshot.chassis.position.x);
    const height = Math.max(0, snapshot.chassis.position.y - surface - 1.1);
    this.vehicleShadow.clear().fillStyle(0x07101c, Math.max(0.08, 0.3 - height * 0.018));
    if (!snapshot.activeLoopId) this.vehicleShadow.fillEllipse(chassisPoint.x + 9, ORIGIN.y - surface * PIXELS_PER_METRE + 7, Math.max(34, 115 - height * 5), 15);
    this.vehicleLights.clear().setPosition(chassisPoint.x, chassisPoint.y).setRotation(-snapshot.chassis.angle);
    if (this.appearance === "dark") {
      this.vehicleLights.fillStyle(0xffedb5, 0.1).fillTriangle(48, 0, 210, -24, 210, 34);
      this.vehicleLights.fillStyle(0xffedb5, 0.85).fillEllipse(52, 1, 9, 7);
      this.vehicleLights.fillStyle(0xff5147, 0.8).fillEllipse(-54, 0, 6, 7);
    }
    this.suspension.clear().lineStyle(7, 0x152033, 0.92).lineBetween(rearMount.x, rearMount.y, rearPoint.x, rearPoint.y);
    this.suspension.lineBetween(frontMount.x, frontMount.y, frontPoint.x, frontPoint.y);
    this.suspension.lineStyle(2, 0xddeafa, 0.9);
    for (const [mount, wheel] of [[rearMount, rearPoint], [frontMount, frontPoint]]) {
      for (let i = 1; i < 5; i++) {
        const t = i / 5, x = mount.x + (wheel.x - mount.x) * t, y = mount.y + (wheel.y - mount.y) * t;
        this.suspension.lineBetween(x - 4, y - 2, x + 4, y + 2);
      }
    }
    this.suspension.lineStyle(3, this.sceneData.car.accent, 1).lineBetween(rearMount.x, rearMount.y, rearPoint.x, rearPoint.y);
    this.suspension.lineBetween(frontMount.x, frontMount.y, frontPoint.x, frontPoint.y);
    this.turboFlame.clear();
    this.syncObstacles(snapshot);
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

  private syncObstacles(snapshot: VehicleSnapshot): void {
    for (const id of snapshot.brokenObstacleIds) {
      if (this.shatteredObstacles.has(id)) continue;
      this.shatteredObstacles.add(id);
      this.sceneData.onObstacleBreak();
      const visual = this.obstacleVisuals.get(id);
      if (!visual) continue;
      visual.setVisible(false);
      for (let index = 0; this.motionAllowed() && !this.sceneData.lightMode && index < 8; index += 1) {
        const fragment = this.add.rectangle(visual.x, visual.y - 35, 13, 9, index % 2 ? 0xf5c44d : 0xa95727).setDepth(7);
        this.fragments.add(fragment);
        this.tweens.add({
          targets: fragment,
          x: visual.x + (index - 3.5) * 22,
          y: visual.y - 65 - (index % 3) * 22,
          angle: 180 + index * 35,
          alpha: 0,
          duration: 520,
          ease: "Quad.easeOut",
          onComplete: () => { this.fragments.delete(fragment); fragment.destroy(); },
        });
      }
      if (this.motionAllowed()) this.cameras.main.shake(120, 0.005);
    }
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
    const angle = Math.abs(normalizeAngle(this.lastSnapshot.chassis.angle));
    const slow = Math.abs(this.lastSnapshot.velocity.x) < 0.25;
    const blocked = this.lastSnapshot.blockedObstacleId;
    if (blocked || (this.sceneData.assists && !this.lastSnapshot.activeLoopId && (angle > 1.9 || (slow && throttle)))) this.stuckSeconds += delta;
    else this.stuckSeconds = 0;
    if (this.stuckSeconds > 2.3) {
      if (blocked) {
        const attempts = (this.challengeAttempts.get(blocked) ?? 0) + 1;
        this.challengeAttempts.set(blocked, attempts);
        const obstacle = this.simulation.track.obstacles?.find((candidate) => candidate.id === blocked);
        if (obstacle) this.sceneData.onChallengeFailure(obstacle, attempts);
      }
      this.respawn();
    }
  }

  private respawn(): void {
    this.lastSnapshot = this.simulation.respawn();
    this.stuckSeconds = 0;
    this.sceneData.onRespawn();
    if (this.motionAllowed()) this.cameras.main.flash(160, 255, 244, 190, false);
  }

  private emitDust(speed: number, throttle: boolean): void {
    if (!throttle || speed < 4 || !this.motionAllowed() || this.sceneData.lightMode) return;
    const point = physicsToScreen(this.lastSnapshot.rearWheel.position, PIXELS_PER_METRE, ORIGIN);
    this.dust.setPosition(point.x, point.y + 18).emitParticle(1);
  }
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
