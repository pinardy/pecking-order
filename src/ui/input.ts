import { NO_INPUT, type Input } from "../game";

// One place that turns keyboards, gamepads and the on-screen controls into engine Inputs.

export type Action = "left" | "right" | "up" | "down" | "light" | "heavy" | "special" | "sup";
export const ACTIONS: { action: Action; label: string }[] = [
  { action: "left", label: "Left" }, { action: "right", label: "Right" }, { action: "up", label: "Jump" }, { action: "down", label: "Crouch" },
  { action: "light", label: "Peck" }, { action: "heavy", label: "Kick" }, { action: "special", label: "Special" }, { action: "sup", label: "Crow" },
];
/** One key per action. */
export type KeyMap = Record<Action, string>;

/** Two keyboard layouts. With one player, both drive player 1. */
export const DEFAULT_KEYS: [KeyMap, KeyMap] = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", light: "KeyF", heavy: "KeyG", special: "KeyH", sup: "KeyT" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", light: "KeyJ", heavy: "KeyK", special: "KeyL", sup: "KeyI" },
];

let keys: [KeyMap, KeyMap] = DEFAULT_KEYS;
let gameKeys = new Set<string>();

export function setKeys(next: [KeyMap, KeyMap]) {
  keys = next;
  gameKeys = new Set(next.flatMap((k) => Object.values(k)));
}
setKeys(DEFAULT_KEYS);

const ARROWS: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };
/** A short name for a key, for menus: "KeyA" becomes "A". */
export function keyLabel(code: string): string {
  return ARROWS[code] ?? code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ").replace(/(Left|Right)$/, " $1");
}

/** The current keys, laid out for the help table. */
export function keyHelp() {
  return keys.map((k) => ({
    move: [k.up, k.left, k.down, k.right].map(keyLabel).join(" "),
    light: keyLabel(k.light), heavy: keyLabel(k.heavy), special: keyLabel(k.special), sup: keyLabel(k.sup),
  }));
}

const held = new Set<string>();
/** Keys and on-screen buttons that went down since the last tick, so a tap shorter than one tick still registers. */
const tappedKeys = new Set<string>();

const pad = () => ({ x: 0 as -1 | 0 | 1, y: 0 as -1 | 0 | 1, light: false, heavy: false, special: false, sup: false, block: false });
const taps = () => ({ light: false, heavy: false, special: false, sup: false });
/** Written by the on-screen controls: one set per player. */
export const touch = [pad(), pad()];
export const tappedTouch = [taps(), taps()];

export function resetTouch(player: 0 | 1) {
  Object.assign(touch[player], pad());
  Object.assign(tappedTouch[player], taps());
}

/** Call after each engine step: quick taps have now been seen. */
export function endTick() {
  tappedKeys.clear();
  for (const t of tappedTouch) Object.assign(t, taps());
}

/** Starts listening for keys. Returns a function that stops. */
export function listenKeys(onPause: () => void): () => void {
  const down = (e: KeyboardEvent) => {
    if (e.code === "Escape" || (e.code === "KeyP" && !gameKeys.has("KeyP"))) {
      if (!e.repeat) onPause();
      return;
    }
    if (gameKeys.has(e.code) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      held.add(e.code);
      tappedKeys.add(e.code);
      // Keep the arrow keys from scrolling the page.
      e.preventDefault();
    }
  };
  const up = (e: KeyboardEvent) => held.delete(e.code);
  const clear = () => held.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    held.clear();
    endTick();
  };
}

const keyDown = (layout: number, a: Action) => held.has(keys[layout][a]) || tappedKeys.has(keys[layout][a]);

function fromKeys(layout: number): Input {
  const x = (keyDown(layout, "right") ? 1 : 0) - (keyDown(layout, "left") ? 1 : 0);
  const y = (keyDown(layout, "up") ? 1 : 0) - (keyDown(layout, "down") ? 1 : 0);
  return {
    x: x as -1 | 0 | 1, y: y as -1 | 0 | 1,
    light: keyDown(layout, "light"), heavy: keyDown(layout, "heavy"), special: keyDown(layout, "special"), sup: keyDown(layout, "sup"),
  };
}

function pads(): Gamepad[] {
  try {
    return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected);
  } catch {
    return [];
  }
}

function fromPad(p: Gamepad | undefined): Input {
  if (!p) return NO_INPUT;
  const b = (i: number) => !!p.buttons[i]?.pressed;
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  const x = (b(15) || ax > 0.45 ? 1 : 0) - (b(14) || ax < -0.45 ? 1 : 0);
  const y = (b(12) || ay < -0.55 ? 1 : 0) - (b(13) || ay > 0.45 ? 1 : 0);
  // Standard layout: left face button pecks, bottom kicks, top is special, right or a shoulder crows.
  return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1, light: b(2), heavy: b(0), special: b(3), sup: b(1) || b(5) || b(4), block: b(6) || b(7) };
}

/** True on the tick a gamepad's Start button goes down. */
let startWasDown = false;
export function padStartPressed(): boolean {
  const isDown = pads().some((p) => p.buttons[9]?.pressed);
  const pressed = isDown && !startWasDown;
  startWasDown = isDown;
  return pressed;
}

function fromTouch(player: 0 | 1): Input {
  const t = touch[player];
  const tap = tappedTouch[player];
  return { x: t.x, y: t.y, light: t.light || tap.light, heavy: t.heavy || tap.heavy, special: t.special || tap.special, sup: t.sup || tap.sup, block: t.block };
}

function merge(...inputs: Input[]): Input {
  let x = 0;
  let y = 0;
  const out = { ...NO_INPUT, block: false };
  for (const i of inputs) {
    out.block ||= !!i.block;
    x += i.x;
    y += i.y;
    out.light ||= i.light;
    out.heavy ||= i.heavy;
    out.special ||= i.special;
    out.sup ||= i.sup;
  }
  out.x = Math.sign(x) as -1 | 0 | 1;
  out.y = Math.sign(y) as -1 | 0 | 1;
  return out;
}

/**
 * What a player is holding right now.
 * Solo: both keyboard layouts, every gamepad and the touch controls all drive player 1.
 * Two players: each gets one keyboard layout, one gamepad and one set of touch controls.
 */
export function readInput(player: 0 | 1, solo: boolean): Input {
  const p = pads();
  if (solo) return player === 0 ? merge(fromKeys(0), fromKeys(1), fromTouch(0), ...p.map(fromPad)) : NO_INPUT;
  return merge(fromKeys(player), fromTouch(player), fromPad(p[player]));
}

const ARROW = ["↙", "↓", "↘", "←", "", "→", "↖", "↑", "↗"];
/** An input as a few symbols for the training display: a direction, then P K S C B for the buttons. */
export function inputGlyphs(i: Input): string {
  const buttons = (i.light ? "P" : "") + (i.heavy ? "K" : "") + (i.special ? "S" : "") + (i.sup ? "C" : "") + (i.block ? "B" : "");
  return `${ARROW[(i.y + 1) * 3 + i.x + 1]} ${buttons}`.trim();
}

export { pack, unpack } from "../game";
