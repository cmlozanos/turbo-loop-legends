import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputController } from '../src/game/input';

// The controller only needs event targets, selector lookup and turbo feedback.
// Keep this fake scoped to input rather than adding a browser DOM dependency.
class FakeElement extends EventTarget {
  readonly controls = new Map<string, FakeElement>();
  readonly attributes = new Map<string, string>();
  readonly classes = new Set<string>();
  readonly classList = {
    toggle: (name: string, held: boolean): void => {
      if (held) this.classes.add(name);
      else this.classes.delete(name);
    }
  };
  readonly setPointerCapture = vi.fn();
  editable = false;

  querySelector(selector: string): FakeElement | null {
    return this.controls.get(selector) ?? null;
  }

  closest(): FakeElement | null {
    return this.editable ? this : null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

type Control = 'throttle' | 'brake' | 'turbo' | 'reset';
let root: FakeElement;
let windowTarget: EventTarget;
let controller: InputController;

function button(control: Control): FakeElement {
  return root.controls.get(`[data-control='${control}']`)!;
}

function key(type: 'keydown' | 'keyup', code: string, target: FakeElement = root): Event {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, composedPath: () => [target, root, windowTarget] });
  windowTarget.dispatchEvent(event);
  return event;
}

function pointer(control: Control, type: string, pointerId: number): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { pointerId });
  button(control).dispatchEvent(event);
}

function expectTurbo(held: boolean): void {
  expect(controller.state.turbo).toBe(held);
  expect(button('turbo').classes.has('is-active')).toBe(held);
  expect(button('turbo').attributes.get('aria-pressed')).toBe(String(held));
}

beforeEach(() => {
  root = new FakeElement();
  for (const control of ['throttle', 'brake', 'turbo', 'reset']) {
    root.controls.set(`[data-control='${control}']`, new FakeElement());
  }
  windowTarget = new EventTarget();
  vi.stubGlobal('window', windowTarget);
  vi.stubGlobal('Element', FakeElement);
  vi.stubGlobal('HTMLElement', FakeElement);
  controller = new InputController(root as unknown as HTMLElement);
});

afterEach(() => {
  controller.destroy();
  vi.unstubAllGlobals();
});

describe('held input aggregation', () => {
  it.each([
    ['throttle', 'KeyD', 'ArrowRight'],
    ['brake', 'KeyA', 'ArrowLeft'],
    ['turbo', 'ShiftLeft', 'ShiftRight'],
    ['turbo', 'Space', 'ShiftLeft']
  ] as const)('keeps %s held until both %s and %s release', (control, first, second) => {
    key('keydown', first);
    key('keydown', second);
    key('keyup', first);
    expect(controller.state[control]).toBe(true);
    key('keyup', second);
    expect(controller.state[control]).toBe(false);
  });

  it.each([
    ['throttle', 'ArrowRight'], ['brake', 'KeyA'], ['turbo', 'ShiftLeft']
  ] as const)('keeps %s held when the keyboard releases before the pointer', (control, code) => {
    key('keydown', code);
    pointer(control, 'pointerdown', 1);
    key('keyup', code);
    expect(controller.state[control]).toBe(true);
    pointer(control, 'pointerup', 1);
    expect(controller.state[control]).toBe(false);
  });

  it.each([
    ['throttle', 'KeyD'], ['brake', 'ArrowLeft'], ['turbo', 'Space']
  ] as const)('keeps %s held when the pointer releases before the keyboard', (control, code) => {
    pointer(control, 'pointerdown', 1);
    key('keydown', code);
    pointer(control, 'pointerup', 1);
    expect(controller.state[control]).toBe(true);
    key('keyup', code);
    expect(controller.state[control]).toBe(false);
  });

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('handles %s per contact and idempotently', release => {
    pointer('turbo', 'pointerdown', 10);
    pointer('turbo', 'pointerdown', 11);
    expectTurbo(true);
    pointer('turbo', release, 10);
    pointer('turbo', release, 10);
    pointer('turbo', 'lostpointercapture', 10);
    pointer('turbo', release, 99);
    expectTurbo(true);
    pointer('turbo', release, 11);
    expectTurbo(false);
  });

  it('does not mix contacts between buttons', () => {
    pointer('throttle', 'pointerdown', 1);
    pointer('brake', 'pointerdown', 2);
    pointer('throttle', 'pointercancel', 2);
    expect(controller.state.throttle).toBe(true);
    expect(controller.state.brake).toBe(true);
    pointer('brake', 'pointerup', 2);
    expect(controller.state.throttle).toBe(true);
    expect(controller.state.brake).toBe(false);
  });

  it('treats repeated keydown as one physical key', () => {
    key('keydown', 'ShiftLeft');
    key('keydown', 'ShiftLeft');
    key('keyup', 'ShiftLeft');
    expectTurbo(false);
  });

  it('does not let an unheld alias keyup cancel an active key', () => {
    key('keydown', 'KeyD');
    key('keyup', 'ArrowRight');
    expect(controller.state.throttle).toBe(true);
  });
});

describe('release and lifecycle', () => {
  it.each(['releaseAll', 'blur', 'pagehide'])('clears every held source on %s and permits fresh input', release => {
    key('keydown', 'ArrowRight');
    key('keydown', 'KeyA');
    key('keydown', 'ShiftLeft');
    key('keydown', 'KeyR');
    pointer('turbo', 'pointerdown', 1);
    pointer('turbo', 'pointerdown', 2);
    if (release === 'releaseAll') controller.releaseAll();
    else windowTarget.dispatchEvent(new Event(release));
    expect(controller.state).toEqual({ throttle: false, brake: false, turbo: false, resetRequested: false });
    expectTurbo(false);
    key('keydown', 'Space');
    pointer('turbo', 'pointerup', 1);
    pointer('turbo', 'lostpointercapture', 2);
    expectTurbo(true);
    key('keyup', 'Space');
    expectTurbo(false);
  });

  it('detaches window and control listeners on destroy', () => {
    pointer('turbo', 'pointerdown', 1);
    controller.destroy();
    expectTurbo(false);
    key('keydown', 'ArrowRight');
    pointer('brake', 'pointerdown', 2);
    button('reset').dispatchEvent(new Event('click'));
    expect(controller.state).toEqual({ throttle: false, brake: false, turbo: false, resetRequested: false });
    controller.destroy();
  });

  it('consumes keyboard and pointer reset requests once', () => {
    key('keydown', 'KeyR');
    expect(controller.consumeReset()).toBe(true);
    expect(controller.consumeReset()).toBe(false);
    button('reset').dispatchEvent(new Event('click'));
    expect(controller.consumeReset()).toBe(true);
    expect(controller.consumeReset()).toBe(false);
  });
});

describe('editing and existing guards', () => {
  it.each(['ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyR'])(
    'ignores %s from an editable composed-path target (including shadow DOM)', code => {
      const editor = new FakeElement();
      editor.editable = true;
      const event = key('keydown', code, editor);
      expect(event.defaultPrevented).toBe(false);
      expect(controller.state).toEqual({ throttle: false, brake: false, turbo: false, resetRequested: false });
    }
  );

  it('still releases an existing key when keyup originates in an editor', () => {
    key('keydown', 'ShiftLeft');
    const editor = new FakeElement();
    editor.editable = true;
    key('keyup', 'ShiftLeft', editor);
    expectTurbo(false);
  });

  it.each(['ArrowRight', 'ArrowLeft', 'Space', 'ShiftLeft', 'ShiftRight'])(
    'still prevents browser defaults for driving key %s', code => {
      expect(key('keydown', code).defaultPrevented).toBe(true);
    }
  );

  it('does not reserve unrelated keys or create audio resources', () => {
    const createContext = vi.fn();
    vi.stubGlobal('AudioContext', createContext);
    expect(key('keydown', 'KeyZ').defaultPrevented).toBe(false);
    key('keydown', 'ShiftLeft');
    pointer('throttle', 'pointerdown', 1);
    expect(createContext).not.toHaveBeenCalled();
  });
});
