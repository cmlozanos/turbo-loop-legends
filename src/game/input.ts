export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  resetRequested: boolean;
}

export class InputController {
  readonly state: DriveInput = { throttle: false, brake: false, resetRequested: false };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (["ArrowRight", "KeyD"].includes(event.code)) this.state.throttle = true;
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.state.brake = true;
    if (event.code === "KeyR") this.state.resetRequested = true;
    if (["ArrowRight", "ArrowLeft", "Space"].includes(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (["ArrowRight", "KeyD"].includes(event.code)) this.state.throttle = false;
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.state.brake = false;
  };

  constructor(private readonly root: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.bindHold(root.querySelector("[data-control='throttle']"), "throttle");
    this.bindHold(root.querySelector("[data-control='brake']"), "brake");
    root.querySelector("[data-control='reset']")?.addEventListener("click", () => {
      this.state.resetRequested = true;
    });
  }

  consumeReset(): boolean {
    const requested = this.state.resetRequested;
    this.state.resetRequested = false;
    return requested;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private bindHold(element: Element | null, key: "throttle" | "brake"): void {
    if (!(element instanceof HTMLElement)) return;
    const press = (event: PointerEvent): void => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.state[key] = true;
    };
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      this.state[key] = false;
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", () => { this.state[key] = false; });
  }
}
