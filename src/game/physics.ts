import {
  Chain,
  Circle,
  Polygon,
  Vec2,
  WheelJoint,
  World,
  type Body,
} from "planck";

import { createDefaultTrack, type Point, type TrackDefinition } from "./track";

export interface VehicleInput {
  throttle?: number;
  brake?: boolean;
  lean?: number;
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
}

export interface PhysicsOptions {
  track?: TrackDefinition;
  gravity?: Point;
  fixedTimeStep?: number;
}

interface GuidedLoop {
  kind: "full" | "incomplete";
  center: Point;
  pathRadius: number;
  angle: number;
  endAngle: number;
  angularSpeed: number;
}

const WHEEL_OFFSETS = [
  { x: -1, y: -0.55 },
  { x: 1, y: -0.55 },
] as const;

const MAX_WHEEL_SPEED = 20;
const DRIVE_TORQUE = 90;

export class PhysicsWorld {
  readonly world: World;
  readonly track: TrackDefinition;
  readonly fixedTimeStep: number;

  private readonly chassis: Body;
  private readonly rearWheel: Body;
  private readonly frontWheel: Body;
  private readonly rearJoint: WheelJoint;
  private readonly frontJoint: WheelJoint;
  private input: Required<VehicleInput> = { throttle: 0, brake: false, lean: 0 };
  private checkpointIndex = 0;
  private respawnCount = 0;
  private guidedLoop?: GuidedLoop;
  private fullLoopComplete = false;
  private incompleteLoopComplete = false;

  constructor(options: PhysicsOptions = {}) {
    this.track = options.track ?? createDefaultTrack();
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.world = new World({ gravity: options.gravity ?? { x: 0, y: -10 } });

    const ground = this.world.createBody({ type: "static" });
    for (const segment of this.track.segments) {
      if (segment.kind !== "line") continue;
      ground.createFixture({
        shape: new Chain([...segment.points], false),
        friction: 0.9,
      });
    }

    const spawn = this.track.checkpoints[0];
    if (!spawn) {
      throw new Error("The track needs at least one checkpoint");
    }

    this.chassis = this.world.createBody({
      type: "dynamic",
      position: spawn.position,
      angle: spawn.angle,
      bullet: true,
      angularDamping: 0.7,
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
      friction: 0.4,
    });

    this.rearWheel = this.createWheel(this.worldPoint(spawn.position, spawn.angle, WHEEL_OFFSETS[0]));
    this.frontWheel = this.createWheel(this.worldPoint(spawn.position, spawn.angle, WHEEL_OFFSETS[1]));
    this.rearJoint = this.createSuspension(this.rearWheel, true);
    this.frontJoint = this.createSuspension(this.frontWheel, false);
  }

  setInput(input: VehicleInput): void {
    this.input = {
      throttle: Math.max(-1, Math.min(1, input.throttle ?? 0)),
      brake: input.brake ?? false,
      lean: Math.max(-1, Math.min(1, input.lean ?? 0)),
    };
  }

  step(deltaSeconds = this.fixedTimeStep): VehicleSnapshot {
    const step = Math.min(Math.max(deltaSeconds, 0), 1 / 15);
    this.startGuidedLoop();
    if (this.guidedLoop && step > 0) {
      this.advanceGuidedLoop(step);
      this.updateCheckpoint();
      return this.getSnapshot();
    }
    const motorSpeed = this.input.brake ? 0 : -this.input.throttle * MAX_WHEEL_SPEED;
    const motorTorque = DRIVE_TORQUE;

    this.rearJoint.enableMotor(this.input.brake || Math.abs(this.input.throttle) > 0.001);
    this.rearJoint.setMotorSpeed(motorSpeed);
    this.rearJoint.setMaxMotorTorque(motorTorque);
    this.frontJoint.enableMotor(this.input.brake);
    this.frontJoint.setMotorSpeed(0);
    this.frontJoint.setMaxMotorTorque(motorTorque);
    if (this.input.lean !== 0) {
      this.chassis.applyTorque(this.input.lean * 18, true);
    }
    const x = this.chassis.getPosition().x;
    const insideLoop = (x > 175 && x < 185) || (x > 375 && x < 385);
    if (!insideLoop) {
      const angle = Math.atan2(Math.sin(this.chassis.getAngle()), Math.cos(this.chassis.getAngle()));
      this.chassis.applyTorque(-angle * 90 - this.chassis.getAngularVelocity() * 14, true);
    }

    if (step > 0) {
      this.world.step(step, 8, 3);
    }
    this.updateCheckpoint();

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
    this.fullLoopComplete = this.checkpointIndex >= 2;
    this.incompleteLoopComplete = this.checkpointIndex >= 3;
    this.placeBody(this.chassis, checkpoint.position, checkpoint.angle);
    this.placeBody(
      this.rearWheel,
      this.worldPoint(checkpoint.position, checkpoint.angle, WHEEL_OFFSETS[0]),
      checkpoint.angle,
    );
    this.placeBody(
      this.frontWheel,
      this.worldPoint(checkpoint.position, checkpoint.angle, WHEEL_OFFSETS[1]),
      checkpoint.angle,
    );
    this.respawnCount += 1;
    return this.getSnapshot();
  }

  private createWheel(position: Point): Body {
    const wheel = this.world.createBody({ type: "dynamic", position, bullet: true });
    wheel.createFixture({ shape: new Circle(0.42), density: 1, friction: 1.2 });
    return wheel;
  }

  private createSuspension(wheel: Body, powered: boolean): WheelJoint {
    const joint = new WheelJoint(
      {
        enableMotor: powered,
        motorSpeed: 0,
        maxMotorTorque: powered ? 60 : 0,
        frequencyHz: 5,
        dampingRatio: 0.75,
      },
      this.chassis,
      wheel,
      wheel.getPosition(),
      { x: 0, y: 1 },
    );
    this.world.createJoint(joint);
    return joint;
  }

  private updateCheckpoint(): void {
    const nextIndex = this.checkpointIndex + 1;
    const next = this.track.checkpoints[nextIndex];
    if (!next) return;

    const position = this.chassis.getPosition();
    const dx = position.x - next.position.x;
    const dy = position.y - next.position.y;
    if (dx * dx + dy * dy <= next.radius * next.radius) {
      this.checkpointIndex = nextIndex;
    }
  }

  private startGuidedLoop(): void {
    if (this.guidedLoop) return;
    const position = this.chassis.getPosition();
    const speed = Math.abs(this.chassis.getLinearVelocity().x);
    if (!this.fullLoopComplete && position.x >= 178.2 && speed >= 2.5) {
      this.guidedLoop = {
        kind: "full",
        center: { x: 180, y: 7 },
        pathRadius: 3.2,
        angle: -Math.PI / 2,
        endAngle: (3 * Math.PI) / 2,
        angularSpeed: Math.max(2.1, Math.min(3.6, speed / 3.2)),
      };
    } else if (this.fullLoopComplete && !this.incompleteLoopComplete && position.x >= 378.2 && speed >= 2.5) {
      this.guidedLoop = {
        kind: "incomplete",
        center: { x: 380, y: 7 },
        pathRadius: 3.2,
        angle: -Math.PI / 2,
        endAngle: (5 * Math.PI) / 4,
        angularSpeed: Math.max(2.1, Math.min(3.6, speed / 3.2)),
      };
    }
  }

  private advanceGuidedLoop(step: number): void {
    const ride = this.guidedLoop;
    if (!ride) return;
    ride.angle = Math.min(ride.angle + ride.angularSpeed * step, ride.endAngle);
    const chassisPosition = {
      x: ride.center.x + Math.cos(ride.angle) * ride.pathRadius,
      y: ride.center.y + Math.sin(ride.angle) * ride.pathRadius,
    };
    const chassisAngle = ride.angle + Math.PI / 2;
    const speed = ride.angularSpeed * ride.pathRadius;
    const velocity = {
      x: -Math.sin(ride.angle) * speed,
      y: Math.cos(ride.angle) * speed,
    };
    this.placeGuidedBody(this.chassis, chassisPosition, chassisAngle, velocity);
    this.placeGuidedBody(
      this.rearWheel,
      this.worldPoint(chassisPosition, chassisAngle, WHEEL_OFFSETS[0]),
      chassisAngle,
      velocity,
    );
    this.placeGuidedBody(
      this.frontWheel,
      this.worldPoint(chassisPosition, chassisAngle, WHEEL_OFFSETS[1]),
      chassisAngle,
      velocity,
    );
    if (ride.angle >= ride.endAngle) {
      if (ride.kind === "full") this.fullLoopComplete = true;
      else this.incompleteLoopComplete = true;
      this.guidedLoop = undefined;
    }
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
