import {
  Chain,
  Circle,
  Polygon,
  Vec2,
  WheelJoint,
  World,
  type Body,
} from "planck";

import type { CarSpec } from "./cars";
import { carCanPassObstacle, createDefaultTrack, surfaceAt, type LoopGuide, type Point, type TrackDefinition } from "./track";

export interface VehicleInput {
  throttle?: number;
  brake?: boolean;
  lean?: number;
  turbo?: boolean;
}

export interface BodyPose {
  position: Point;
  angle: number;
}

export interface VehicleSnapshot {
  chassis: BodyPose;
  rearWheel: BodyPose;
  frontWheel: BodyPose;
  velocity: Point;
  checkpointIndex: number;
  respawnCount: number;
  springboardActivations: number;
  brokenObstacleIds: readonly string[];
  blockedObstacleId?: string;
  activeLoopId?: string;
  /** At least one wheel touches the road (always true while a loop guides the car). */
  grounded: boolean;
  collectedStarIds: readonly number[];
}

export interface PhysicsOptions {
  track?: TrackDefinition;
  gravity?: Point;
  fixedTimeStep?: number;
  car?: CarSpec;
}

interface GuidedLoop {
  id: string;
  center: Point;
  pathRadius: number;
  angle: number;
  startAngle: number;
  endAngle: number;
  tangentialSpeed: number;
  /** Entry pose error that fades out, so joining the guide never teleports the car. */
  blend: { x: number; y: number; angle: number; remaining: number };
}

const WHEEL_OFFSETS = [
  { x: -1, y: -0.55 },
  { x: 1, y: -0.55 },
] as const;

/** The reference wheel every jump and loop was calibrated with. */
export const BASE_WHEEL_RADIUS = 0.42;
const PIXELS_PER_METRE = 45;
const LOOP_BLEND_SECONDS = 0.18;
const LOOP_TRACK_CLEARANCE = 0.8;
const STAR_REACH = 1.7;
const BOOST_PAD_ACCELERATION = 26;
const WHEELIE_LIMIT = 0.26;
const REAR_DRIVE_SHARE = 0.65;

/** Physical wheel radius: the same wheel the player sees, so big wheels really ride higher. */
export function wheelRadiusOf(car?: CarSpec): number {
  return car ? Math.max(BASE_WHEEL_RADIUS, car.wheelRadius / PIXELS_PER_METRE) : BASE_WHEEL_RADIUS;
}

const MAX_WHEEL_SPEED = 26;
const TURBO_WHEEL_SPEED = 38;
const DRIVE_TORQUE = 110;
const TURBO_TORQUE = 155;
const LOOP_ENTRY_SPEED = 3;
const LOOP_DRIVE_ACCELERATION = 8;
const LOOP_TURBO_ACCELERATION = 12;
const LOOP_BRAKE_DECELERATION = 18;
const LOOP_ROLLING_DRAG = 0.08;
const LOOP_REENTRY_COOLDOWN = 1.5;

export class PhysicsWorld {
  readonly world: World;
  readonly track: TrackDefinition;
  readonly fixedTimeStep: number;

  private readonly chassis: Body;
  private readonly rearWheel: Body;
  private readonly frontWheel: Body;
  private readonly rearJoint: WheelJoint;
  private readonly frontJoint: WheelJoint;
  private input: Required<VehicleInput> = { throttle: 0, brake: false, lean: 0, turbo: false };
  private checkpointIndex = 0;
  private respawnCount = 0;
  private guidedLoop?: GuidedLoop;
  private readonly loopCooldowns = new Map<string, number>();
  private activeSpringboardId?: string;
  private springboardActivations = 0;
  private readonly obstacleBodies = new Map<string, Body>();
  private readonly brokenObstacleIds = new Set<string>();
  private readonly car?: CarSpec;
  private blockedObstacleId?: string;
  private readonly wheelRadius: number;
  private brokenSnapshot: readonly string[] = [];
  private readonly collectedStars = new Set<number>();
  private starSnapshot: readonly number[] = [];
  private previousX: number;
  private tumblingLoopId?: string;

  constructor(options: PhysicsOptions = {}) {
    this.track = options.track ?? createDefaultTrack();
    this.car = options.car;
    this.wheelRadius = wheelRadiusOf(options.car);
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.world = new World({ gravity: options.gravity ?? { x: 0, y: this.track.physics?.gravity ?? -10 } });

    const ground = this.world.createBody({ type: "static" });
    for (const segment of this.track.segments) {
      if (segment.kind !== "line") continue;
      ground.createFixture({
        shape: new Chain([...segment.points], false),
        friction: this.track.physics?.grip ?? 0.9,
      });
    }
    for (const obstacle of this.track.obstacles ?? []) {
      if (obstacle.behavior === "challenge" && (!this.car || carCanPassObstacle(this.car, obstacle))) continue;
      const body = this.world.createBody({
        type: "static",
        position: { x: obstacle.position.x, y: obstacle.position.y + obstacle.height / 2 },
      });
      body.createFixture({
        shape: new Polygon([
          { x: -obstacle.width / 2, y: -obstacle.height / 2 },
          { x: obstacle.width / 2, y: -obstacle.height / 2 },
          { x: obstacle.width / 2, y: obstacle.height / 2 },
          { x: -obstacle.width / 2, y: obstacle.height / 2 },
        ]),
        friction: 0.9,
        restitution: obstacle.behavior === "avoid" ? 0.12 : 0.02,
      });
      this.obstacleBodies.set(obstacle.id, body);
    }

    const spawn = this.track.checkpoints[0];
    if (!spawn) {
      throw new Error("The track needs at least one checkpoint");
    }

    const spawnPosition = this.lifted(spawn.position);
    this.previousX = spawnPosition.x;
    this.chassis = this.world.createBody({
      type: "dynamic",
      position: spawnPosition,
      angle: spawn.angle,
      bullet: true,
      angularDamping: 0.85,
      linearDamping: 0.04,
    });
    this.chassis.createFixture({
      shape: new Polygon([
        { x: -1.25, y: -0.05 },
        { x: 1.25, y: -0.05 },
        { x: 1.15, y: 0.35 },
        { x: 0.4, y: 0.55 },
        { x: -1.05, y: 0.45 },
      ]),
      density: 3,
      friction: 0.55,
      restitution: 0.04,
    });

    this.rearWheel = this.createWheel(this.worldPoint(spawnPosition, spawn.angle, WHEEL_OFFSETS[0]));
    this.frontWheel = this.createWheel(this.worldPoint(spawnPosition, spawn.angle, WHEEL_OFFSETS[1]));
    this.rearJoint = this.createSuspension(this.rearWheel, true);
    this.frontJoint = this.createSuspension(this.frontWheel, false);
  }

  setInput(input: VehicleInput): void {
    this.input = {
      throttle: Math.max(-1, Math.min(1, input.throttle ?? 0)),
      brake: input.brake ?? false,
      lean: Math.max(-1, Math.min(1, input.lean ?? 0)),
      turbo: input.turbo ?? false,
    };
  }

  step(deltaSeconds = this.fixedTimeStep): VehicleSnapshot {
    const step = Math.min(Math.max(deltaSeconds, 0), 1 / 15);
    this.updateLoopCooldowns(step);
    this.startGuidedLoop();
    if (this.guidedLoop && step > 0) {
      this.advanceGuidedLoop(step);
      this.updateCheckpoint();
      this.collectStars();
      this.previousX = this.chassis.getPosition().x;
      return this.getSnapshot();
    }
    const accelerationFactor = this.car ? 0.82 + this.car.capabilities.acceleration * 0.06 : 1;
    const brakingFactor = this.car ? 0.75 + this.car.capabilities.braking * 0.08 : 1;
    // Larger wheels turn slower and push harder, so road speed and thrust stay as calibrated.
    const gearing = BASE_WHEEL_RADIUS / this.wheelRadius;
    const wheelSpeed = gearing * (this.input.turbo
      ? TURBO_WHEEL_SPEED * Math.max(1, accelerationFactor)
      : MAX_WHEEL_SPEED * accelerationFactor);
    // Turbo must reach its designed launch speed even on high-torque cars.
    // Their normal motor speed, acceleration, grip and braking remain distinct.
    const throttle = this.input.turbo ? Math.sign(this.input.throttle) : this.input.throttle;
    const motorSpeed = this.input.brake ? 0 : -throttle * wheelSpeed;
    const motorTorque = (this.input.turbo ? TURBO_TORQUE : DRIVE_TORQUE) * (this.input.brake ? brakingFactor : accelerationFactor) / gearing;

    // All-wheel drive: the rear axle does most of the work, and the front one pulls the
    // car off a ledge or crest where the rear wheel hangs in the air.
    const driving = Math.abs(this.input.throttle) > 0.001;
    this.rearJoint.enableMotor(this.input.brake || driving);
    this.rearJoint.setMotorSpeed(motorSpeed);
    this.rearJoint.setMaxMotorTorque(this.input.brake ? motorTorque : motorTorque * REAR_DRIVE_SHARE);
    this.frontJoint.enableMotor(this.input.brake || driving);
    this.frontJoint.setMotorSpeed(motorSpeed);
    this.frontJoint.setMaxMotorTorque(this.input.brake ? motorTorque : motorTorque * (1 - REAR_DRIVE_SHARE));
    if (this.input.lean !== 0) {
      const airControl = Math.min(1, Math.abs(this.chassis.getLinearVelocity().y) / 3 + 0.35);
      this.chassis.applyTorque(this.input.lean * 24 * airControl, true);
    }
    const x = this.chassis.getPosition().x;
    // Only a car that has just dropped out of a loop tumbles freely inside it.
    const insideLoop = (this.track.loopGuides ?? []).some((guide) => this.tumblingLoopId === guide.id && this.loopCooldowns.has(guide.id) && Math.abs(x - guide.center.x) < guide.pathRadius + 1.2);
    if (!insideLoop) {
      const angle = Math.atan2(Math.sin(this.chassis.getAngle()), Math.cos(this.chassis.getAngle()));
      const error = Math.atan2(Math.sin(angle - this.targetAttitude(x)), Math.cos(angle - this.targetAttitude(x)));
      // A playful wheelie is welcome; beyond it the stabiliser firmly holds the car down.
      const excess = Math.sign(error) * Math.max(0, Math.abs(error) - WHEELIE_LIMIT);
      this.chassis.applyTorque(-error * 90 - excess * 420 - this.chassis.getAngularVelocity() * 14, true);
    }

    if (step > 0) {
      this.applyBoostPads(step);
      this.breakObstacles();
      this.world.step(step, 10, 6);
    }
    this.updateBlockedObstacle();
    this.activateSpringboard();
    this.updateCheckpoint();
    this.collectStars();
    this.previousX = this.chassis.getPosition().x;

    const position = this.chassis.getPosition();
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || position.y < this.track.killY) {
      this.respawn();
    }

    return this.getSnapshot();
  }

  getSnapshot(): VehicleSnapshot {
    const velocity = this.chassis.getLinearVelocity();
    return {
      chassis: this.pose(this.chassis),
      rearWheel: this.pose(this.rearWheel),
      frontWheel: this.pose(this.frontWheel),
      velocity: { x: velocity.x, y: velocity.y },
      checkpointIndex: this.checkpointIndex,
      respawnCount: this.respawnCount,
      springboardActivations: this.springboardActivations,
      brokenObstacleIds: this.brokenSnapshot,
      blockedObstacleId: this.blockedObstacleId,
      activeLoopId: this.guidedLoop?.id,
      grounded: this.guidedLoop !== undefined || this.isGrounded(),
      collectedStarIds: this.starSnapshot,
    };
  }

  setCheckpoint(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.track.checkpoints.length) {
      throw new RangeError(`Invalid checkpoint index: ${index}`);
    }
    this.checkpointIndex = index;
  }

  respawn(): VehicleSnapshot {
    const checkpoint = this.track.checkpoints[this.checkpointIndex];
    this.guidedLoop = undefined;
    this.tumblingLoopId = undefined;
    this.loopCooldowns.clear();
    this.activeSpringboardId = undefined;
    this.blockedObstacleId = undefined;
    const position = this.lifted(checkpoint.position);
    this.placeBody(this.chassis, position, checkpoint.angle);
    this.placeBody(
      this.rearWheel,
      this.worldPoint(position, checkpoint.angle, WHEEL_OFFSETS[0]),
      checkpoint.angle,
    );
    this.placeBody(
      this.frontWheel,
      this.worldPoint(position, checkpoint.angle, WHEEL_OFFSETS[1]),
      checkpoint.angle,
    );
    this.previousX = position.x;
    this.respawnCount += 1;
    return this.getSnapshot();
  }

  private createWheel(position: Point): Body {
    const wheel = this.world.createBody({ type: "dynamic", position, bullet: true });
    wheel.createFixture({
      shape: new Circle(this.wheelRadius),
      density: 1.05,
      friction: (this.track.physics?.grip ?? 1.45) * (this.car?.grip ?? 1),
      restitution: 0.02,
    });
    return wheel;
  }

  private createSuspension(wheel: Body, powered: boolean): WheelJoint {
    const joint = new WheelJoint(
      {
        enableMotor: powered,
        motorSpeed: 0,
        maxMotorTorque: powered ? 60 : 0,
        frequencyHz: this.track.physics?.suspensionFrequency ?? 4.4,
        dampingRatio: this.track.physics?.suspensionDamping ?? 0.88,
      },
      this.chassis,
      wheel,
      wheel.getPosition(),
      { x: 0, y: 1 },
    );
    this.world.createJoint(joint);
    return joint;
  }

  private activateSpringboard(): void {
    const chassisPosition = this.chassis.getPosition();
    const board = this.track.springboards.find((candidate) => {
      const withinWidth = Math.abs(chassisPosition.x - candidate.position.x) <= candidate.width / 2;
      const wheelsNearSurface = [this.rearWheel, this.frontWheel].some((wheel) => {
        const position = wheel.getPosition();
        return Math.abs(position.x - candidate.position.x) <= candidate.width / 2
          && position.y >= candidate.position.y
          && position.y <= candidate.position.y + 0.8;
      });
      return withinWidth && wheelsNearSurface;
    });

    if (!board) {
      this.activeSpringboardId = undefined;
      return;
    }
    if (this.activeSpringboardId === board.id) return;

    const velocity = this.chassis.getLinearVelocity();
    const direction = velocity.x < -0.2 ? -1 : 1;
    const airtime = (2 * board.verticalBoost) / Math.abs(this.world.getGravity().y || 10);
    const launchVelocity = {
      x: board.range ? (direction * board.range) / airtime : velocity.x + direction * board.forwardBoost,
      y: Math.max(velocity.y, 0) + board.verticalBoost,
    };
    for (const body of [this.chassis, this.rearWheel, this.frontWheel]) {
      body.setLinearVelocity(launchVelocity);
      body.setAwake(true);
    }
    this.chassis.setAngularVelocity(this.chassis.getAngularVelocity() * 0.35);
    this.activeSpringboardId = board.id;
    this.springboardActivations += 1;
  }

  private breakObstacles(): void {
    const position = this.chassis.getPosition();
    const velocity = this.chassis.getLinearVelocity();
    for (const obstacle of this.track.obstacles ?? []) {
      if (obstacle.behavior !== "breakable" || this.brokenObstacleIds.has(obstacle.id)) continue;
      const impactReach = obstacle.width / 2 + 1.55 + Math.abs(velocity.x) * this.fixedTimeStep;
      const closeEnough = Math.abs(position.x - obstacle.position.x) <= impactReach;
      const atObstacleHeight = position.y <= obstacle.position.y + obstacle.height + 1;
      if (!closeEnough || !atObstacleHeight || Math.abs(velocity.x) < (obstacle.breakSpeed ?? 8)) continue;
      const body = this.obstacleBodies.get(obstacle.id);
      if (body) this.world.destroyBody(body);
      this.obstacleBodies.delete(obstacle.id);
      this.brokenObstacleIds.add(obstacle.id);
      this.brokenSnapshot = [...this.brokenObstacleIds];
    }
  }

  private updateBlockedObstacle(): void {
    if (!this.car || Math.abs(this.input.throttle) < 0.2) {
      this.blockedObstacleId = undefined;
      return;
    }
    const position = this.chassis.getPosition();
    const velocity = this.chassis.getLinearVelocity();
    this.blockedObstacleId = (this.track.obstacles ?? []).find((obstacle) => {
      if (obstacle.behavior !== "challenge" || carCanPassObstacle(this.car!, obstacle)) return false;
      const movingToward = Math.sign(this.input.throttle) === Math.sign(obstacle.position.x - position.x);
      return movingToward
        && Math.abs(position.x - obstacle.position.x) <= obstacle.width / 2 + 2.2
        && Math.abs(velocity.x) < 0.75;
    })?.id;
  }

  private updateCheckpoint(): void {
    const position = this.chassis.getPosition();
    while (this.checkpointIndex + 1 < this.track.checkpoints.length) {
      const nextIndex = this.checkpointIndex + 1;
      const next = this.track.checkpoints[nextIndex];
      const dx = position.x - next.position.x;
      const dy = position.y - next.position.y;
      const insideMarker = dx * dx + dy * dy <= next.radius * next.radius;
      const passedSafely = position.x >= next.position.x && position.y >= next.position.y - 1.5;
      if (!insideMarker && !passedSafely) break;
      this.checkpointIndex = nextIndex;
    }
  }

  private startGuidedLoop(): void {
    if (this.guidedLoop) return;
    const position = this.chassis.getPosition();
    const velocity = this.chassis.getLinearVelocity();
    let entry: { guide: LoopGuide; angle: number; speed: number } | undefined;
    for (const guide of this.track.loopGuides ?? []) {
      if ((this.loopCooldowns.get(guide.id) ?? 0) > 0) continue;
      const endpoints = [
        { angle: guide.startAngle, direction: 1 },
        { angle: guide.endAngle, direction: -1 },
      ] as const;
      for (const endpoint of endpoints) {
        const point = this.loopPoint(guide.center, guide.pathRadius, endpoint.angle);
        const distance = Math.hypot(position.x - point.x, position.y - point.y);
        const tangent = { x: -Math.sin(endpoint.angle), y: Math.cos(endpoint.angle) };
        const tangentialSpeed = velocity.x * tangent.x + velocity.y * tangent.y;
        const approachingHorizontally = endpoint.direction > 0
          ? velocity.x >= LOOP_ENTRY_SPEED
          : velocity.x <= -LOOP_ENTRY_SPEED;
        // Join where the car really meets the guide: close to its end, or while driving across it.
        const crossing = Math.abs(position.y - point.y) <= 2.4
          && (endpoint.direction > 0 ? this.previousX < point.x && position.x >= point.x : this.previousX > point.x && position.x <= point.x);
        if ((distance <= 1.1 || crossing) && approachingHorizontally && tangentialSpeed * endpoint.direction >= LOOP_ENTRY_SPEED) {
          entry = { guide, angle: endpoint.angle, speed: tangentialSpeed };
          break;
        }
      }
      if (entry) break;
    }
    if (!entry) return;
    const { guide } = entry;
    this.guidedLoop = {
      id: guide.id,
      center: guide.center,
      pathRadius: guide.pathRadius,
      angle: entry.angle,
      endAngle: guide.endAngle,
      startAngle: guide.startAngle,
      tangentialSpeed: entry.speed,
      blend: {
        x: position.x - (guide.center.x + Math.cos(entry.angle) * guide.pathRadius),
        y: position.y - (guide.center.y + Math.sin(entry.angle) * guide.pathRadius),
        angle: Math.atan2(Math.sin(this.chassis.getAngle() - entry.angle - Math.PI / 2), Math.cos(this.chassis.getAngle() - entry.angle - Math.PI / 2)),
        remaining: LOOP_BLEND_SECONDS,
      },
    };
  }

  private advanceGuidedLoop(step: number): void {
    const ride = this.guidedLoop;
    if (!ride) return;
    const gravity = Math.abs(this.track.physics?.gravity ?? -10);
    const driveAcceleration = this.input.turbo ? LOOP_TURBO_ACCELERATION : LOOP_DRIVE_ACCELERATION;
    const brakeAcceleration = this.input.brake ? -Math.sign(ride.tangentialSpeed) * LOOP_BRAKE_DECELERATION : 0;
    const gravityAcceleration = -gravity * Math.cos(ride.angle);
    const dragAcceleration = -ride.tangentialSpeed * LOOP_ROLLING_DRAG;
    ride.tangentialSpeed += (this.input.throttle * driveAcceleration + brakeAcceleration + gravityAcceleration + dragAcceleration) * step;
    const maximumLoopSpeed = this.input.turbo ? 24 : 14;
    ride.tangentialSpeed = Math.max(-maximumLoopSpeed, Math.min(maximumLoopSpeed, ride.tangentialSpeed));
    ride.angle += (ride.tangentialSpeed / ride.pathRadius) * step;
    ride.angle = Math.max(ride.startAngle, Math.min(ride.endAngle, ride.angle));
    ride.blend.remaining = Math.max(0, ride.blend.remaining - step);
    const fade = ride.blend.remaining / LOOP_BLEND_SECONDS;
    const guidePosition = this.loopPoint(ride.center, ride.pathRadius, ride.angle);
    const chassisPosition = { x: guidePosition.x + ride.blend.x * fade, y: guidePosition.y + ride.blend.y * fade };
    const chassisAngle = ride.angle + Math.PI / 2 + ride.blend.angle * fade;
    // Wheels rest on the loop surface instead of sinking into it.
    const wheelDrop = Math.min(-WHEEL_OFFSETS[0].y, Math.max(0.1, LOOP_TRACK_CLEARANCE - this.wheelRadius));
    const wheelOffsets = [{ x: WHEEL_OFFSETS[0].x, y: -wheelDrop }, { x: WHEEL_OFFSETS[1].x, y: -wheelDrop }];
    const velocity = {
      x: -Math.sin(ride.angle) * ride.tangentialSpeed,
      y: Math.cos(ride.angle) * ride.tangentialSpeed,
    };
    this.placeGuidedBody(this.chassis, chassisPosition, chassisAngle, velocity);
    this.placeGuidedBody(
      this.rearWheel,
      this.worldPoint(chassisPosition, chassisAngle, wheelOffsets[0]),
      chassisAngle,
      velocity,
    );
    this.placeGuidedBody(
      this.frontWheel,
      this.worldPoint(chassisPosition, chassisAngle, wheelOffsets[1]),
      chassisAngle,
      velocity,
    );
    const contactAcceleration = (ride.tangentialSpeed * ride.tangentialSpeed) / ride.pathRadius - gravity * Math.sin(ride.angle);
    const lostContact = Math.sin(ride.angle) >= 0 && contactAcceleration <= 0;
    const leftAtStart = ride.angle <= ride.startAngle && ride.tangentialSpeed < 0;
    const leftAtEnd = ride.angle >= ride.endAngle && ride.tangentialSpeed > 0;
    if (lostContact || leftAtStart || leftAtEnd) {
      this.releaseGuidedLoop(ride.id);
      this.tumblingLoopId = lostContact && !leftAtEnd ? ride.id : undefined;
    }
  }

  /** Checkpoints sit at the reference ride height; taller wheels start proportionally higher. */
  private lifted(position: Point): Point {
    return { x: position.x, y: position.y + this.wheelRadius - BASE_WHEEL_RADIUS };
  }

  private isGrounded(): boolean {
    for (const wheel of [this.rearWheel, this.frontWheel]) {
      for (let edge = wheel.getContactList(); edge; edge = edge.next ?? null) {
        if (edge.contact.isTouching()) return true;
      }
    }
    return false;
  }

  /**
   * The attitude the stabiliser steers towards: the slope of the road while a wheel
   * touches it, and the flight path while airborne, so the car follows hills and noses
   * into its landings instead of being forced level.
   */
  private targetAttitude(x: number): number {
    const segments = this.track.segments;
    if (this.isGrounded()) {
      const behind = surfaceAt(segments, x - 1);
      const ahead = surfaceAt(segments, x + 1);
      if (behind === undefined || ahead === undefined) return 0;
      return Math.max(-0.6, Math.min(0.6, Math.atan2(ahead - behind, 2)));
    }
    const velocity = this.chassis.getLinearVelocity();
    if (Math.abs(velocity.x) < 2) return 0;
    const pitch = Math.atan2(velocity.y, Math.abs(velocity.x)) * Math.sign(velocity.x);
    return Math.max(-0.42, Math.min(0.42, pitch * 0.55 + this.input.lean * 0.12));
  }

  /** Dash arrows lift a slow car to the launch speed of the ramp it is climbing. */
  private applyBoostPads(step: number): void {
    if (this.input.throttle <= 0 || this.input.brake) return;
    const position = this.chassis.getPosition();
    const pad = this.track.boostPads?.find((candidate) => position.x >= candidate.startX && position.x <= candidate.endX);
    if (!pad) return;
    // Bouncing just above the arrows still counts: low gravity must not cancel the help.
    const surface = surfaceAt(this.track.segments, position.x);
    if (surface === undefined || position.y - surface > 2.4) return;
    const velocity = this.chassis.getLinearVelocity();
    const speed = Math.hypot(velocity.x, velocity.y);
    if (velocity.x < 1 || speed >= pad.minSpeed) return;
    const scale = Math.min(pad.minSpeed, speed + BOOST_PAD_ACCELERATION * step) / speed;
    for (const body of [this.chassis, this.rearWheel, this.frontWheel]) {
      const current = body.getLinearVelocity();
      body.setLinearVelocity({ x: current.x * scale, y: current.y * scale });
    }
  }

  private collectStars(): void {
    const stars = this.track.stars;
    if (!stars || this.collectedStars.size === stars.length) return;
    const position = this.chassis.getPosition();
    for (const star of stars) {
      if (this.collectedStars.has(star.id)) continue;
      const dx = position.x - star.position.x;
      if (dx < -STAR_REACH) break;
      const dy = position.y - star.position.y;
      if (dx > STAR_REACH || dx * dx + dy * dy > STAR_REACH * STAR_REACH) continue;
      this.collectedStars.add(star.id);
      this.starSnapshot = [...this.collectedStars];
    }
  }

  private releaseGuidedLoop(id: string): void {
    this.loopCooldowns.set(id, LOOP_REENTRY_COOLDOWN);
    this.guidedLoop = undefined;
  }

  private updateLoopCooldowns(step: number): void {
    if (step <= 0) return;
    for (const [id, remaining] of this.loopCooldowns) {
      const next = remaining - step;
      if (next <= 0) this.loopCooldowns.delete(id);
      else this.loopCooldowns.set(id, next);
    }
  }

  private loopPoint(center: Point, radius: number, angle: number): Point {
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  }

  private placeGuidedBody(body: Body, position: Point, angle: number, velocity: Point): void {
    body.setTransform(position, angle);
    body.setLinearVelocity(velocity);
    body.setAngularVelocity(0);
    body.setAwake(true);
  }

  private pose(body: Body): BodyPose {
    const position = body.getPosition();
    return { position: { x: position.x, y: position.y }, angle: body.getAngle() };
  }

  private placeBody(body: Body, position: Point, angle: number): void {
    body.setTransform(position, angle);
    body.setLinearVelocity(Vec2.zero());
    body.setAngularVelocity(0);
    body.setAwake(true);
  }

  private worldPoint(origin: Point, angle: number, offset: Point): Point {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: origin.x + offset.x * cosine - offset.y * sine,
      y: origin.y + offset.x * sine + offset.y * cosine,
    };
  }
}

export function createPhysicsWorld(options?: PhysicsOptions): PhysicsWorld {
  return new PhysicsWorld(options);
}
