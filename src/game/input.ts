export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  turbo: boolean;
  resetRequested: boolean;
}

export class InputController {
  readonly state: DriveInput = { throttle: false, brake: false, turbo: false, resetRequested: false };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (["ArrowRight", "KeyD"].includes(event.code)) this.state.throttle = true;
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.state.brake = true;
    if (["ShiftLeft", "ShiftRight", "Space"].includes(event.code)) this.setHeld("turbo", true);
    if (event.code === "KeyR") this.state.resetRequested = true;
    if (["ArrowRight", "ArrowLeft", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (["ArrowRight", "KeyD"].includes(event.code)) this.state.throttle = false;
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.state.brake = false;
    if (["ShiftLeft", "ShiftRight", "Space"].includes(event.code)) this.setHeld("turbo", false);
  };

  constructor(private readonly root: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.bindHold(root.querySelector("[data-control='throttle']"), "throttle");
    this.bindHold(root.querySelector("[data-control='brake']"), "brake");
    this.bindHold(root.querySelector("[data-control='turbo']"), "turbo");
    root.querySelector("[data-control='reset']")?.addEventListener("click", () => {
      this.state.resetRequested = true;
    });
  }

  consumeReset(): boolean {
    const requested = this.state.resetRequested;
    this.state.resetRequested = false;
    return requested;
  }

  releaseAll(): void {
    this.state.throttle = false;
    this.state.brake = false;
    this.state.resetRequested = false;
    this.setHeld("turbo", false);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private bindHold(element: Element | null, key: "throttle" | "brake" | "turbo"): void {
    if (!(element instanceof HTMLElement)) return;
    const press = (event: PointerEvent): void => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.setHeld(key, true);
    };
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      this.setHeld(key, false);
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", () => { this.setHeld(key, false); });
  }

  private setHeld(key: "throttle" | "brake" | "turbo", held: boolean): void {
    this.state[key] = held;
    if (key !== "turbo") return;
    const button = this.root.querySelector<HTMLElement>("[data-control='turbo']");
    button?.classList.toggle("is-active", held);
    button?.setAttribute("aria-pressed", String(held));
  }
}
