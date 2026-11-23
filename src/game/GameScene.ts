import {visibleViewport} from "./viewport";
import Phaser from "phaser";
import { roadEffectsPlan, type RoadEffectEmission } from "./roadEffects";
import { nativeAppearance, type NativeTheme } from "./appearance";
import { drivingFocus, drivingSpan, smoothZoom } from "./sceneView";
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
  onStars?: (collected: number, total: number) => void;
  onStunt?: (stunt: Stunt) => void;
}

export type Stunt = "jump" | "loop" | "broken-loop";

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
  private exhaust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private brakeSmoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private effectCredit = { dust: 0, exhaust: 0, brakeSmoke: 0 };
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
  private readonly starSprites = new Map<number, Phaser.GameObjects.Image>();
  private starsCollected = 0;
  private feedbackReady = false;
  private airborneSeconds = 0;
  private fallSpeed = 0;
  private squash = 0;
  private activeLoopId?: string;
  private elapsedSeconds = 0;

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
    this.starSprites.clear();
    this.starsCollected = 0;
    this.effectCredit = { dust: 0, exhaust: 0, brakeSmoke: 0 };
    this.feedbackReady = false;
    this.airborneSeconds = 0;
    this.fallSpeed = 0;
    this.squash = 0;
    this.activeLoopId = undefined;
    this.elapsedSeconds = 0;
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
    this.createStars();
    this.createVehicle();
    this.createDust();
    this.feedbackReady = true;
    this.sceneData.onStars?.(0, this.simulation.track.stars?.length ?? 0);

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
      // Pedals drive the wheels; only the optional airborne assist rotates the body.
      let lean = 0;
      if (this.sceneData.assists && !this.lastSnapshot.grounded && !this.lastSnapshot.activeLoopId) {
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
      // Essential jump tracking stays steady; no launch camera shake.
    }

    this.updateFeedback(deltaMs);
    this.syncVehicle(this.lastSnapshot);
    this.updateCameraFocus(deltaMs);
    const camera = this.cameras.main;
    const viewLeft = camera.scrollX + camera.width / 2 - camera.width / (2 * camera.zoom);
    for (const item of this.decorations) item.graphics.visible = item.right >= viewLeft - 180 && item.left <= viewLeft + camera.width / camera.zoom + 180;
    const lerp = !this.motionAllowed() ? 1 : 1 - Math.pow(1 - 0.085, Math.min(deltaMs, 250) / (1000 / 60));
    camera.setLerp(lerp, lerp);

    // Inside a loop the car is as fast going up as going along.
    const speed = (this.lastSnapshot.activeLoopId ? Math.hypot(this.lastSnapshot.velocity.x, this.lastSnapshot.velocity.y) : Math.abs(this.lastSnapshot.velocity.x)) * 9;
    this.sceneData.onSpeed(speed);
    this.sceneData.audio.updateEngine(speed, throttle);
    this.emitDust(deltaMs, throttle, brake);
  }

  diagnostics(): object {
    return JSON.parse(JSON.stringify({ steps: this.simulationSteps, snapshot: this.lastSnapshot,
      decorations: this.decorations.length, visibleDecorations: this.decorations.filter(item => item.graphics.visible).length,
      stars: { collected: this.starsCollected, total: this.simulation?.track.stars?.length ?? 0, sprites: this.starSprites.size },
      zoom: this.cameras.main.zoom, scrollX: this.cameras.main.scrollX,
      cameraShake: this.cameras.main.shakeEffect.isRunning, theme: this.appearance, decorativeMotion: this.motionAllowed(), dustAlive: (this.dust?.getAliveParticleCount() ?? 0), exhaustAlive: this.exhaust?.getAliveParticleCount() ?? 0, brakeSmokeAlive: this.brakeSmoke?.getAliveParticleCount() ?? 0,
      nativeText: this.children.list.filter((item): item is Phaser.GameObjects.Text => item instanceof Phaser.GameObjects.Text).map(item => ({ text: item.text, font: item.style.fontFamily })),
      fragments: this.fragments.size, cameraFocus: this.cameraFocus ? { x: this.cameraFocus.x, y: this.cameraFocus.y } : null,
      view: { x: this.cameras.main.worldView.x, y: this.cameras.main.worldView.y, width: this.cameras.main.worldView.width, height: this.cameras.main.worldView.height } }));
  }

  private motionAllowed(): boolean {
    return nativeAppearance(this.sceneData.reducedMotion).motion;
  }

  private applyAppearance = (): void => {
    this.appearance = nativeAppearance(this.sceneData.reducedMotion).theme;
    paintScenery(this.backdrop, this.simulation.track.theme, this.simulation.track.id, this.appearance, visibleViewport().width);
    if (!this.motionAllowed()) {
      this.dust.killAll(); this.exhaust.killAll(); this.brakeSmoke.killAll();
      this.effectCredit = { dust: 0, exhaust: 0, brakeSmoke: 0 };
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
    const factor = renderScale(visibleViewport().width, visibleViewport().height, this.sceneData.lightMode);
    const verticalSpan = drivingSpan(this.simulation.track, this.lastSnapshot, visibleViewport().height);
    const targetZoom = factor * Math.min(1, visibleViewport().height / verticalSpan);
    // Bound both zoom directions; loop anticipation opens the view ahead of entry.
    const zoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(smoothZoom(zoom, targetZoom, deltaMs));
  }

  private configureCamera(): void {
    const factor = renderScale(visibleViewport().width, visibleViewport().height, this.sceneData.lightMode);
    // A short screen needs a wider world view, not a cropped loop or hidden landing.
    const span = drivingSpan(this.simulation.track, this.lastSnapshot, visibleViewport().height);
    this.cameras.main.setZoom(factor * Math.min(1, visibleViewport().height / span));
    this.cameras.main.startFollow(this.cameraFocus, true, this.motionAllowed() ? 0.085 : 1, this.motionAllowed() ? 0.085 : 1);
    if (this.backdrop.length) paintScenery(this.backdrop, this.simulation.track.theme, this.simulation.track.id, this.appearance, visibleViewport().width);
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
    const groundTop = shade(theme?.ground ?? 0x4f8e52, 1.12);
    const groundDeep = shade(theme?.ground ?? 0x4f8e52, 0.5);
    scenery.fillGradientStyle(groundTop, groundTop, groundDeep, groundDeep, 1).fillRect(sceneryLeft, ORIGIN.y + 10, sceneryRight - sceneryLeft, 520);
    scenery.fillStyle(0xffffff, 0.16).fillRect(sceneryLeft, ORIGIN.y + 10, sceneryRight - sceneryLeft, 4);
    // Cut-earth strata and scattered aggregate give the platform a material,
    // without textures, shaders, particles or per-frame scenery allocation.
    for (let band = 0; band < 3; band++) {
      scenery.fillStyle(0x162c35, 0.08 + band * 0.025).fillRect(sceneryLeft, ORIGIN.y + 60 + band * 74, sceneryRight - sceneryLeft, 18 + band * 7);
    }
    scenery.fillStyle(0xe1cba0, 0.22);
    for (let x = sceneryLeft; x < sceneryRight; x += 105) {
      scenery.fillTriangle(x, ORIGIN.y + 45, x + 17, ORIGIN.y + 40, x + 25, ORIGIN.y + 49);
    }
    this.drawProps(sceneryLeft, sceneryRight);

    const hazards = this.add.graphics().setDepth(-6);
    for (const hazard of this.simulation.track.hazards) {
      const left = physicsToScreen({ x: hazard.startX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
      const right = physicsToScreen({ x: hazard.endX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x;
      const bottom = ORIGIN.y + hazard.depth * PIXELS_PER_METRE;
      hazards.fillStyle(theme?.abyss ?? 0x111522, 0.96).beginPath().moveTo(left, ORIGIN.y - 5);
      hazards.lineTo(left + 28, ORIGIN.y + 70).lineTo((left + right) / 2, bottom);
      hazards.lineTo(right - 28, ORIGIN.y + 70).lineTo(right, ORIGIN.y - 5).closePath().fillPath();
      // A glow from the depths: lava, ice water or neon, in the colour of each circuit.
      hazards.fillStyle(theme?.accent ?? 0xffcf3f, 0.16).fillTriangle((left + right) / 2, bottom, left + (right - left) * 0.22, ORIGIN.y + 150, right - (right - left) * 0.22, ORIGIN.y + 150);
      hazards.fillStyle(theme?.accent ?? 0xffcf3f, 0.3).fillTriangle((left + right) / 2, bottom, left + (right - left) * 0.36, ORIGIN.y + 250, right - (right - left) * 0.36, ORIGIN.y + 250);
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

    const earth = shade(theme?.ground ?? 0x4f8e52, 0.72);
    const earthLight = shade(theme?.ground ?? 0x4f8e52, 0.9);
    for (const [segmentIndex, points] of renderPolylines(this.simulation.track).entries()) {
      const track = this.add.graphics().setDepth(-2);
      const screen = points.map((point) => physicsToScreen(point, PIXELS_PER_METRE, ORIGIN));
      this.decorations.push({ graphics: track, left: Math.min(...screen.map(p => p.x)) - 30, right: Math.max(...screen.map(p => p.x)) + 30 });
      const solid = this.simulation.track.segments[segmentIndex].kind === "line";
      if (solid) {
        // Hills, ramps and plateaus are earthworks: packed soil from the road down to the plain.
        const base = ORIGIN.y + 12;
        for (let index = 0; index < screen.length - 1; index += 1) {
          const current = screen[index];
          const next = screen[index + 1];
          if (current.y >= base - 14 && next.y >= base - 14) continue;
          fillPolygon(track.fillStyle(earth, 1), [current, next, { x: next.x, y: base }, { x: current.x, y: base }]);
          fillPolygon(track.fillStyle(earthLight, 1), [current, next, { x: next.x, y: Math.min(base, next.y + 26) }, { x: current.x, y: Math.min(base, current.y + 26) }]);
        }
      }
      // Cast extrusion and steel understructure stay behind the collision surface.
      for (let index = 0; index < screen.length; index += 6) {
        const point = screen[index];
        if (solid || point.y > ORIGIN.y - 35) continue;
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
    for (const pad of this.simulation.track.boostPads ?? []) {
      for (let x = pad.startX + 0.8; x < pad.endX - 0.6; x += 1.5) {
        const y = trackSurfaceYAt(this.simulation.track.segments, x);
        const ahead = trackSurfaceYAt(this.simulation.track.segments, x + 0.6);
        const point = physicsToScreen({ x, y }, PIXELS_PER_METRE, ORIGIN);
        const tip = physicsToScreen({ x: x + 0.6, y: ahead }, PIXELS_PER_METRE, ORIGIN);
        const angle = Math.atan2(tip.y - point.y, tip.x - point.x);
        const nx = Math.sin(angle) * 8, ny = -Math.cos(angle) * 8;
        track.lineStyle(5, 0xfff36b, 1).beginPath().moveTo(point.x + nx, point.y + ny - 2).lineTo(tip.x, tip.y - 2).lineTo(point.x - nx, point.y - ny - 2).strokePath();
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

  /**
   * Roadside props give each circuit its own world. They are static vector shapes
   * grouped in chunks, so only the ones near the camera are ever submitted.
   */
  private drawProps(left: number, right: number): void {
    const track = this.simulation.track;
    const theme = track.theme;
    const dark = shade(theme?.scenery ?? 0x376b42, 0.82);
    const mid = theme?.scenery ?? 0x376b42;
    const accent = theme?.accent ?? 0xffcf3f;
    const base = ORIGIN.y + 16;
    const gaps = track.hazards.map((hazard) => ({
      left: physicsToScreen({ x: hazard.startX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x - 70,
      right: physicsToScreen({ x: hazard.endX, y: 0 }, PIXELS_PER_METRE, ORIGIN).x + 70,
    }));
    const chunk = 1500;
    for (let start = left; start < right; start += chunk) {
      const g = this.add.graphics().setDepth(-7);
      this.decorations.push({ graphics: g, left: start - 120, right: start + chunk + 120 });
      for (let index = 0, x = start + 90; x < Math.min(right, start + chunk); index += 1, x += 250 + ((Math.floor(x) * 37) % 170)) {
        if (gaps.some((gap) => x > gap.left && x < gap.right)) continue;
        const seed = Math.abs(Math.floor(x * 7.3)) % 100;
        const size = 0.8 + (seed % 40) / 100;
        const variant = seed % 3 === 0;
        switch (track.id) {
          case "canyon":
            if (variant) {
              fillPolygon(g.fillStyle(dark, 1), [{ x: x - 70 * size, y: base }, { x: x - 48 * size, y: base - 95 * size }, { x: x + 50 * size, y: base - 95 * size }, { x: x + 74 * size, y: base }]);
              g.fillStyle(0xffd9a0, 0.22).fillRect(x - 52 * size, base - 78 * size, 106 * size, 7).fillRect(x - 60 * size, base - 46 * size, 122 * size, 6);
            } else {
              g.fillStyle(0x3f7d4a, 1).fillRoundedRect(x - 9 * size, base - 105 * size, 18 * size, 105 * size, 8 * size);
              g.fillRoundedRect(x - 36 * size, base - 74 * size, 13 * size, 40 * size, 6 * size).fillRect(x - 36 * size, base - 44 * size, 30 * size, 11 * size);
              g.fillRoundedRect(x + 23 * size, base - 88 * size, 13 * size, 44 * size, 6 * size).fillRect(x + 6 * size, base - 55 * size, 30 * size, 11 * size);
              g.fillStyle(0x8fd08a, 0.35).fillRect(x - 5 * size, base - 98 * size, 4 * size, 90 * size);
            }
            break;
          case "neon":
            if (variant) {
              g.fillStyle(0x10122e, 1).fillRect(x - 4, base - 150 * size, 8, 150 * size).fillRect(x - 60 * size, base - 190 * size, 120 * size, 62 * size);
              g.lineStyle(4, accent, 0.95).strokeRect(x - 54 * size, base - 184 * size, 108 * size, 50 * size);
              g.lineStyle(5, theme?.roadEdge ?? 0x26f7ff, 0.95).lineBetween(x - 36 * size, base - 148 * size, x - 6 * size, base - 172 * size).lineBetween(x - 6 * size, base - 172 * size, x + 8 * size, base - 150 * size).lineBetween(x + 8 * size, base - 150 * size, x + 36 * size, base - 172 * size);
            } else {
              g.fillStyle(0x10122e, 1).fillRect(x - 3, base - 135 * size, 6, 135 * size).fillRect(x - 3, base - 135 * size, 34 * size, 6);
              g.fillStyle(accent, 0.16).fillCircle(x + 32 * size, base - 126 * size, 30 * size);
              g.fillStyle(0xfff0ff, 0.95).fillCircle(x + 32 * size, base - 126 * size, 8 * size);
            }
            break;
          case "volcano":
            if (variant) {
              g.fillStyle(0xff7a1a, 0.28).fillEllipse(x, base + 6, 150 * size, 26 * size);
              g.fillStyle(0xffc23d, 0.9).fillEllipse(x, base + 6, 96 * size, 12 * size);
            } else {
              fillPolygon(g.fillStyle(0x1c1012, 1), [{ x: x - 52 * size, y: base }, { x: x - 30 * size, y: base - 62 * size }, { x: x + 4 * size, y: base - 96 * size }, { x: x + 36 * size, y: base - 54 * size }, { x: x + 56 * size, y: base }]);
              g.lineStyle(4, 0xff6a1f, 0.9).lineBetween(x + 2 * size, base - 90 * size, x - 8 * size, base - 52 * size).lineBetween(x - 8 * size, base - 52 * size, x + 12 * size, base - 26 * size).lineBetween(x + 12 * size, base - 26 * size, x + 2 * size, base);
            }
            break;
          case "moon":
            if (variant) {
              g.fillStyle(0xd9e6f5, 1).fillRect(x - 3, base - 96 * size, 6, 96 * size);
              g.slice(x, base - 96 * size, 30 * size, Math.PI * 0.15, Math.PI * 1.15, false).fillPath();
              g.fillStyle(accent, 0.9).fillCircle(x + 14 * size, base - 118 * size, 5);
              g.fillStyle(0xaab4d4, 1).slice(x - 70 * size, base, 44 * size, Math.PI, 0, false).fillPath();
              g.fillStyle(0x1a2140, 0.5).fillRect(x - 92 * size, base - 14 * size, 44 * size, 6);
            } else {
              g.fillStyle(0x3c4160, 0.55).fillEllipse(x, base + 8, 150 * size, 26 * size);
              g.fillStyle(0x9da3bd, 0.7).fillEllipse(x, base + 3, 150 * size, 14 * size);
              g.fillStyle(0x3c4160, 0.6).fillEllipse(x, base + 6, 112 * size, 10 * size);
            }
            break;
          case "jungle":
            if (variant) {
              g.fillStyle(0x2f8f52, 1).fillEllipse(x - 26 * size, base - 14 * size, 70 * size, 44 * size).fillEllipse(x + 22 * size, base - 20 * size, 80 * size, 56 * size);
              g.fillStyle(0xff5f8a, 1).fillCircle(x + 20 * size, base - 40 * size, 7).fillCircle(x - 30 * size, base - 24 * size, 6);
              g.fillStyle(0xffe27a, 1).fillCircle(x + 20 * size, base - 40 * size, 3);
            } else {
              const top = { x: x + 26 * size, y: base - 150 * size };
              g.lineStyle(13 * size, 0x6b4a2b, 1).beginPath().moveTo(x, base).lineTo(x + 12 * size, base - 80 * size).lineTo(top.x, top.y).strokePath();
              g.fillStyle(0x1f7a45, 1);
              for (const [dx, dy] of [[-88, 6], [-58, -44], [0, -62], [62, -40], [90, 12]]) {
                g.fillTriangle(top.x, top.y - 9, top.x + dx * size, top.y + dy * size, top.x + dx * 0.5 * size, top.y + (dy + 28) * size);
              }
              g.fillStyle(0x8a5a2b, 1).fillCircle(top.x - 6, top.y + 6, 7 * size).fillCircle(top.x + 8, top.y + 8, 7 * size);
            }
            break;
          case "glacier":
            if (variant) {
              g.fillStyle(0xffffff, 0.95).fillEllipse(x, base, 170 * size, 54 * size);
              g.fillStyle(0xb7e6f5, 0.6).fillEllipse(x + 18 * size, base + 6, 120 * size, 26 * size);
            } else {
              g.fillStyle(0x9fe9ff, 0.95).fillTriangle(x - 44 * size, base, x - 20 * size, base - 96 * size, x + 2 * size, base);
              g.fillTriangle(x - 12 * size, base, x + 16 * size, base - 132 * size, x + 42 * size, base).fillTriangle(x + 26 * size, base, x + 50 * size, base - 70 * size, x + 68 * size, base);
              g.fillStyle(0xffffff, 0.7).fillTriangle(x + 16 * size, base - 132 * size, x + 22 * size, base, x + 4 * size, base).fillTriangle(x - 20 * size, base - 96 * size, x - 14 * size, base, x - 28 * size, base);
            }
            break;
          case "factory":
            if (variant) {
              g.fillStyle(0x4d5661, 1).fillRoundedRect(x - 46 * size, base - 80 * size, 92 * size, 80 * size, 16 * size);
              g.fillStyle(0x2a3038, 1).fillRect(x - 46 * size, base - 52 * size, 92 * size, 7).fillRect(x - 46 * size, base - 26 * size, 92 * size, 7);
              g.fillStyle(accent, 1).fillRect(x - 30 * size, base - 74 * size, 20 * size, 12 * size);
            } else {
              g.fillStyle(0x5a3a32, 1).fillRect(x - 16 * size, base - 170 * size, 32 * size, 170 * size);
              g.fillStyle(0xf2f2ee, 1).fillRect(x - 16 * size, base - 150 * size, 32 * size, 14 * size).fillRect(x - 16 * size, base - 112 * size, 32 * size, 14 * size);
              g.fillStyle(0xdfe4ea, 0.5).fillCircle(x + 6 * size, base - 190 * size, 20 * size).fillCircle(x + 34 * size, base - 216 * size, 27 * size).fillCircle(x + 74 * size, base - 236 * size, 34 * size);
            }
            break;
          default:
            if (variant) {
              g.fillStyle(0x3f8a50, 1).fillEllipse(x - 20 * size, base - 10 * size, 64 * size, 40 * size).fillEllipse(x + 22 * size, base - 16 * size, 76 * size, 52 * size);
              g.fillStyle(0xd94b4b, 1).fillCircle(x + 30 * size, base - 28 * size, 5).fillCircle(x + 8 * size, base - 14 * size, 5).fillCircle(x - 24 * size, base - 18 * size, 5);
            } else {
              g.fillStyle(0x5b3d26, 1).fillRect(x - 7 * size, base - 46 * size, 14 * size, 46 * size);
              g.fillStyle(dark, 1).fillTriangle(x - 52 * size, base - 36 * size, x, base - 112 * size, x + 52 * size, base - 36 * size);
              g.fillStyle(mid, 1).fillTriangle(x - 42 * size, base - 76 * size, x, base - 142 * size, x + 42 * size, base - 76 * size);
              g.fillStyle(shade(mid, 1.18), 1).fillTriangle(x - 30 * size, base - 112 * size, x, base - 168 * size, x + 30 * size, base - 112 * size);
              g.fillStyle(0xffffff, 0.14).fillTriangle(x, base - 168 * size, x - 30 * size, base - 112 * size, x - 12 * size, base - 112 * size);
            }
        }
      }
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

  private createStars(): void {
    const stars = this.simulation.track.stars ?? [];
    if (stars.length === 0) return;
    if (!this.textures.exists("star")) {
      const star = this.make.graphics({}, false);
      const outline: Point[] = [];
      const core: Point[] = [];
      for (let index = 0; index < 10; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const radius = index % 2 === 0 ? 1 : 0.46;
        outline.push({ x: 24 + Math.cos(angle) * 22 * radius, y: 24 + Math.sin(angle) * 22 * radius });
        core.push({ x: 24 + Math.cos(angle) * 16 * radius, y: 24 + Math.sin(angle) * 16 * radius });
      }
      fillPolygon(star.fillStyle(0xb65a00, 1), outline);
      fillPolygon(star.fillStyle(0xffd23d, 1), core);
      star.fillStyle(0xfff6c4, 1).fillCircle(20, 19, 4);
      star.generateTexture("star", 48, 48);
      star.destroy();
    }
    for (const star of stars) {
      const point = physicsToScreen(star.position, PIXELS_PER_METRE, ORIGIN);
      this.starSprites.set(star.id, this.add.image(point.x, point.y, "star").setDepth(3).setScale(0.8));
    }
  }

  /** Stars, landings and stunts: everything the player feels beyond the raw simulation. */
  private updateFeedback(deltaMs: number): void {
    if (!this.feedbackReady) return;
    const snapshot = this.lastSnapshot;
    const seconds = Math.min(deltaMs, 250) / 1000;
    this.elapsedSeconds += seconds;
    const motion = this.motionAllowed();

    if (snapshot.collectedStarIds.length > this.starsCollected) {
      for (const id of snapshot.collectedStarIds) {
        const sprite = this.starSprites.get(id);
        if (!sprite) continue;
        this.starSprites.delete(id);
        if (motion) {
          this.tweens.add({ targets: sprite, y: sprite.y - 70, scale: 1.7, alpha: 0, angle: 180, duration: 380, ease: "Quad.easeOut", onComplete: () => sprite.destroy() });
        } else {
          sprite.destroy();
        }
      }
      this.starsCollected = snapshot.collectedStarIds.length;
      this.sceneData.audio.playStar?.();
      this.sceneData.onStars?.(this.starsCollected, this.simulation.track.stars?.length ?? 0);
    }
    if (motion) {
      const view = this.cameras.main.worldView;
      for (const [id, sprite] of this.starSprites) {
        if (sprite.x < view.x - 60 || sprite.x > view.right + 60) continue;
        const phase = this.elapsedSeconds * 3 + id;
        sprite.setScale(0.8 + Math.sin(phase) * 0.07).setRotation(Math.sin(phase * 0.7) * 0.18);
      }
    }

    if (this.activeLoopId && !snapshot.activeLoopId && snapshot.velocity.x > 3) {
      this.sceneData.onStunt?.(this.activeLoopId === "full-loop" ? "loop" : "broken-loop");
    }
    this.activeLoopId = snapshot.activeLoopId;

    if (!snapshot.grounded) {
      this.airborneSeconds += seconds;
      this.fallSpeed = Math.max(0, -snapshot.velocity.y);
    } else if (this.airborneSeconds > 0) {
      if (this.airborneSeconds > 0.3 && !snapshot.activeLoopId) this.land(this.fallSpeed, this.airborneSeconds);
      this.airborneSeconds = 0;
      this.fallSpeed = 0;
    }
    this.squash = Math.max(0, this.squash - seconds * 1.4);
  }

  private land(fallSpeed: number, airtime: number): void {
    const motion = this.motionAllowed();
    if (airtime > 1.8) this.sceneData.onStunt?.("jump");
    if (fallSpeed < 4) return;
    this.sceneData.audio.playLanding?.(Math.min(1, fallSpeed / 14));
    if (!motion) return;
    this.squash = Math.min(0.2, fallSpeed * 0.014);
    // Landing impact is conveyed by suspension/squash and dust, not screen shake.
    if (this.sceneData.lightMode) return;
    for (const wheel of [this.lastSnapshot.rearWheel, this.lastSnapshot.frontWheel]) {
      const point = physicsToScreen(wheel.position, PIXELS_PER_METRE, ORIGIN);
      this.dust.setPosition(point.x, point.y + 16).emitParticle(Math.min(7, 2 + Math.floor(fallSpeed / 3)));
    }
  }

  private celebrate(): void {
    if (!this.motionAllowed() || this.sceneData.lightMode) return;
    const point = physicsToScreen(this.lastSnapshot.chassis.position, PIXELS_PER_METRE, ORIGIN);
    const colours = [0xffd23d, 0xff5b6e, 0x4fd3ff, 0x7bea7b, 0xffffff, this.sceneData.car.accent];
    for (let index = 0; index < 28; index += 1) {
      const piece = this.add.rectangle(point.x, point.y - 30, 12, 8, colours[index % colours.length]).setDepth(8);
      this.fragments.add(piece);
      const spread = (index / 27 - 0.5) * 2;
      this.tweens.add({
        targets: piece,
        x: point.x + spread * 330 + 80,
        y: { value: point.y + 60, ease: "Quad.easeIn" },
        angle: 360 + index * 47,
        alpha: { value: 0, delay: 650, duration: 350 },
        duration: 1000,
        onStart: () => { piece.y = point.y - 150 - (index % 5) * 28; },
        onComplete: () => { this.fragments.delete(piece); piece.destroy(); },
      });
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
    // Tyre: tread blocks, a lit sidewall and a deep-dish alloy with brake and caliper.
    wheel.fillStyle(0x090b0f).fillCircle(0, 0, radius);
    wheel.lineStyle(2.4, 0x1c2129, 1);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12;
      wheel.lineBetween(Math.cos(a) * radius, Math.sin(a) * radius, Math.cos(a) * (radius - 3), Math.sin(a) * (radius - 3));
    }
    wheel.fillStyle(0x232931).fillCircle(0, 0, radius * 0.88);
    wheel.lineStyle(1.5, 0x3a424d, 0.9).strokeCircle(0, 0, radius * 0.8);
    wheel.fillStyle(0x0d1014).fillCircle(0, 0, radius * 0.66);
    wheel.fillStyle(0x3a424d).fillCircle(0, 0, radius * 0.62);
    wheel.fillStyle(0x20262e).fillCircle(0, 0, radius * 0.58);
    wheel.fillStyle(0x8a949f).fillCircle(0, 0, radius * 0.4);
    wheel.fillStyle(0x5c6570).fillCircle(0, 0, radius * 0.35);
    wheel.fillStyle(this.sceneData.car.accent).slice(0, 0, radius * 0.5, -1.25, -0.35, false).fillPath();
    wheel.fillStyle(0x5c6570).fillCircle(0, 0, radius * 0.3);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      const along = { x: Math.cos(a), y: Math.sin(a) }, across = { x: -Math.sin(a), y: Math.cos(a) };
      const corner = (distance: number, half: number): Point => ({ x: along.x * radius * distance + across.x * radius * half, y: along.y * radius * distance + across.y * radius * half });
      fillPolygon(wheel.fillStyle(0x6c7682), [corner(0.14, -0.11), corner(0.61, -0.17), corner(0.61, 0.17), corner(0.14, 0.11)]);
      fillPolygon(wheel.fillStyle(0xd3dbe3), [corner(0.14, -0.11), corner(0.61, -0.17), corner(0.61, 0.03), corner(0.14, 0.02)]);
    }
    wheel.lineStyle(Math.max(2, radius * 0.08), 0xc6cfd8, 1).strokeCircle(0, 0, radius * 0.62);
    wheel.fillStyle(0xe6edf3).fillCircle(0, 0, radius * 0.17);
    wheel.fillStyle(this.sceneData.car.accent).fillCircle(0, 0, radius * 0.07);
    wheel.lineStyle(1.6, 0xffffff, 0.35).beginPath().arc(0, 0, radius * 0.84, Math.PI * 1.08, Math.PI * 1.42).strokePath();
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
      emitting: false,
      maxParticles: 24, maxAliveParticles: 24,
    }).setDepth(1);
    const smoke = (cap: number) => this.add.particles(0, 0, "dust", {
      lifespan: 350, speed: {min: 6, max: 22}, angle: {min: 205, max: 260},
      scale: {start: .4, end: 1.3}, alpha: {start: .18, end: 0},
      emitting: false, maxParticles: cap, maxAliveParticles: cap,
    }).setDepth(1);
    this.exhaust = smoke(10); this.brakeSmoke = smoke(6);
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
      const flicker = this.motionAllowed() ? 0.82 + Math.random() * 0.36 : 1;
      const length = (30 + Math.min(speed * 2.2, 32)) * flicker;
      this.turboFlame.fillStyle(0xff3bd4, 0.16).fillCircle(anchor.x + backward.x * 10, anchor.y + backward.y * 10, 24);
      this.drawFlame(anchor, backward, normal, length * 1.25, 0x8a2bff, 12, 0.45);
      this.drawFlame(anchor, backward, normal, length, 0xff3bd4, 9);
      this.drawFlame(anchor, backward, normal, length * 0.66, 0x76f7ff, 5.5);
      this.drawFlame(anchor, backward, normal, length * 0.36, 0xffffff, 3);
      if (this.motionAllowed() && !this.sceneData.lightMode) {
        // Speed streaks peel off behind the car while the turbo burns.
        this.turboFlame.lineStyle(2, 0xffffff, 0.35);
        for (let streak = 0; streak < 4; streak++) {
          const offset = (streak - 1.5) * 15 + Math.random() * 6;
          const start = 46 + Math.random() * 50;
          const from = { x: anchor.x + backward.x * start + normal.x * offset, y: anchor.y + backward.y * start + normal.y * offset - 18 };
          this.turboFlame.lineBetween(from.x, from.y, from.x + backward.x * (40 + speed * 3), from.y + backward.y * (40 + speed * 3));
        }
      }
    }
    this.placeObject(this.chassis, snapshot.chassis.position, snapshot.chassis.angle);
    const bodyScale = this.sceneData.car.bodyScale;
    this.chassis.setScale(bodyScale * (1 + this.squash * 0.45), bodyScale * (1 - this.squash));
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
      // Keep the view stable when breaking roadside obstacles.
    }
  }

  private drawFlame(anchor: Point, backward: Point, normal: Point, length: number, color: number, width: number, alpha = 0.95): void {
    this.turboFlame.fillStyle(color, alpha).beginPath();
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
      if (this.feedbackReady) this.celebrate();
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

  private emitDust(deltaMs: number, throttle: boolean, brake: boolean): void {
    const snapshot = this.lastSnapshot;
    const plan = roadEffectsPlan({ speed: snapshot.velocity.x, grounded: snapshot.grounded && !snapshot.activeLoopId,
      throttle: throttle ? 1 : brake && snapshot.velocity.x <= .7 ? -1 : 0, brake: brake && snapshot.velocity.x > .7, turbo: this.sceneData.input.state.turbo,
      lightMode: this.sceneData.lightMode, motion: this.motionAllowed(), trackId: this.simulation.track.id ?? "forest" });
    const wheels = [snapshot.rearWheel, snapshot.frontWheel].filter(wheel => {
      const surface = trackSurfaceYAt(this.simulation.track.segments, wheel.position.x);
      return Math.abs(wheel.position.y - surface - this.sceneData.car.wheelRadius / PIXELS_PER_METRE) < .3;
    });
    const contact = wheels[0]?.position;
    const tailpipe = this.localToWorld(snapshot.chassis.position, snapshot.chassis.angle, this.sceneData.car.exhaustOffset);
    const emit = (key: "dust" | "exhaust" | "brakeSmoke", emitter: Phaser.GameObjects.Particles.ParticleEmitter, effect: RoadEffectEmission, position?: Point) => {
      if (!position || effect.rate === 0) { this.effectCredit[key] = 0; return; }
      this.effectCredit[key] += effect.rate * Math.min(deltaMs, 100) / 1000;
      const count = Math.min(Math.floor(this.effectCredit[key]), Math.max(0, effect.maxParticles - emitter.getAliveParticleCount()));
      this.effectCredit[key] -= Math.floor(this.effectCredit[key]);
      if (count) {
        const screen = physicsToScreen(position, PIXELS_PER_METRE, ORIGIN);
        emitter.setParticleTint(effect.tint).setParticleLifespan(effect.lifespanSeconds * 1000);
        emitter.setParticleAlpha({start: effect.alpha, end: 0});
        emitter.setPosition(screen.x, screen.y).emitParticle(count);
      }
    };
    emit("dust", this.dust, plan.dust, contact);
    emit("exhaust", this.exhaust, plan.exhaust, tailpipe);
    emit("brakeSmoke", this.brakeSmoke, plan.brakeSmoke, contact);
  }
}

function fillPolygon(graphics: Phaser.GameObjects.Graphics, points: readonly Point[]): void {
  graphics.beginPath().moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index].x, points[index].y);
  graphics.closePath().fillPath();
}

function shade(color: number, factor: number): number {
  const red = Math.min(255, Math.round(((color >> 16) & 0xff) * factor));
  const green = Math.min(255, Math.round(((color >> 8) & 0xff) * factor));
  const blue = Math.min(255, Math.round((color & 0xff) * factor));
  return (red << 16) | (green << 8) | blue;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
