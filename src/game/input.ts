export interface DriveInput {
  throttle: boolean;
  brake: boolean;
  turbo: boolean;
  resetRequested: boolean;
}

type HeldControl = "throttle" | "brake" | "turbo";

export class InputController {
  readonly state: DriveInput = { throttle: false, brake: false, turbo: false, resetRequested: false };

  private readonly heldSources: Record<HeldControl, Set<string>> = {
    throttle: new Set(), brake: new Set(), turbo: new Set()
  };
  private readonly unbindControls: Array<() => void> = [];
  private readonly onDeactivate = (): void => { this.releaseAll(); };
  private readonly onReset = (): void => { this.state.resetRequested = true; };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.composedPath()[0];
    if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (["ArrowRight", "KeyD"].includes(event.code)) this.setHeld("throttle", `key:${event.code}`, true);
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.setHeld("brake", `key:${event.code}`, true);
    if (["ShiftLeft", "ShiftRight", "Space"].includes(event.code)) this.setHeld("turbo", `key:${event.code}`, true);
    if (event.code === "KeyR") this.state.resetRequested = true;
    if (["ArrowRight", "ArrowLeft", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (["ArrowRight", "KeyD"].includes(event.code)) this.setHeld("throttle", `key:${event.code}`, false);
    if (["ArrowLeft", "KeyA"].includes(event.code)) this.setHeld("brake", `key:${event.code}`, false);
    if (["ShiftLeft", "ShiftRight", "Space"].includes(event.code)) this.setHeld("turbo", `key:${event.code}`, false);
  };

  constructor(private readonly root: HTMLElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onDeactivate);
    window.addEventListener("pagehide", this.onDeactivate);
    this.bindHold(root.querySelector("[data-control='throttle']"), "throttle");
    this.bindHold(root.querySelector("[data-control='brake']"), "brake");
    this.bindHold(root.querySelector("[data-control='turbo']"), "turbo");
    const reset = root.querySelector("[data-control='reset']");
    reset?.addEventListener("click", this.onReset);
    this.unbindControls.push(() => reset?.removeEventListener("click", this.onReset));
  }

  consumeReset(): boolean {
    const requested = this.state.resetRequested;
    this.state.resetRequested = false;
    return requested;
  }

  releaseAll(): void {
    for (const key of ["throttle", "brake", "turbo"] as const) {
      this.heldSources[key].clear();
      this.updateHeld(key);
    }
    this.state.resetRequested = false;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onDeactivate);
    window.removeEventListener("pagehide", this.onDeactivate);
    for (const unbind of this.unbindControls) unbind();
    this.unbindControls.length = 0;
    this.releaseAll();
  }

  private bindHold(element: Element | null, key: HeldControl): void {
    if (!(element instanceof HTMLElement)) return;
    const press = (event: PointerEvent): void => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      this.setHeld(key, `pointer:${event.pointerId}`, true);
    };
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      this.setHeld(key, `pointer:${event.pointerId}`, false);
    };
    element.addEventListener("pointerdown", press);
    element.addEventListener("pointerup", release);
    element.addEventListener("pointercancel", release);
    element.addEventListener("lostpointercapture", release);
    this.unbindControls.push(() => {
      element.removeEventListener("pointerdown", press);
      element.removeEventListener("pointerup", release);
      element.removeEventListener("pointercancel", release);
      element.removeEventListener("lostpointercapture", release);
    });
  }

  private setHeld(key: HeldControl, source: string, held: boolean): void {
    if (held) this.heldSources[key].add(source);
    else this.heldSources[key].delete(source);
    this.updateHeld(key);
  }

  private updateHeld(key: HeldControl): void {
    const held = this.heldSources[key].size > 0;
    this.state[key] = held;
    if (key !== "turbo") return;
    const button = this.root.querySelector<HTMLElement>("[data-control='turbo']");
    button?.classList.toggle("is-active", held);
    button?.setAttribute("aria-pressed", String(held));
  }
}
