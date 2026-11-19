// Gamepad control of the menus. The D-pad or stick moves focus to the nearest button in
// that direction, A presses it, and B goes back (it sends Escape, which every screen and
// sheet already understands). During a fight this stands down, except while a sheet is open.

const FOCUSABLE = "button:not(:disabled), [role='option'], input:not(:disabled), textarea, select";
const FIRST_REPEAT = 380;
const REPEAT = 140;

type Dir = "left" | "right" | "up" | "down";
const VEC: Record<Dir, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

function candidates(): HTMLElement[] {
  // With a sheet open, only what is on the sheet can be reached.
  const sheets = document.querySelectorAll<HTMLElement>(".backdrop");
  const scope: ParentNode = sheets.length ? sheets[sheets.length - 1] : document;
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function move(dir: Dir) {
  const all = candidates();
  if (!all.length) return;
  const from = document.activeElement as HTMLElement | null;
  if (!from || !all.includes(from)) return all[0].focus();
  // A slider takes left and right for itself.
  if (from instanceof HTMLInputElement && from.type === "range" && (dir === "left" || dir === "right")) {
    const step = Number(from.step) || 1;
    const next = Math.min(Number(from.max), Math.max(Number(from.min), Number(from.value) + (dir === "right" ? step : -step)));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(from, String(next));
    from.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const [vx, vy] = VEC[dir];
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const along = dx * vx + dy * vy;
    if (along < 4) continue;
    // Prefer what is straight ahead: sideways distance costs double.
    const across = Math.abs(dx * vy) + Math.abs(dy * vx);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  best?.focus();
  best?.scrollIntoView({ block: "nearest" });
}

/** Starts watching gamepads for menu input. Returns a function that stops. */
export function startPadNav(): () => void {
  let raf = 0;
  let held: Dir | null = null;
  let nextAt = 0;
  let aDown = false;
  let bDown = false;
  const poll = (now: number) => {
    raf = requestAnimationFrame(poll);
    let pad: Gamepad | undefined;
    try {
      pad = Array.from(navigator.getGamepads?.() ?? []).find((p): p is Gamepad => !!p && p.connected);
    } catch {
      return;
    }
    if (!pad) return;
    const inMenu = !document.querySelector(".fight") || !!document.querySelector(".backdrop");
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const dir: Dir | null = b(14) || ax < -0.55 ? "left" : b(15) || ax > 0.55 ? "right" : b(12) || ay < -0.55 ? "up" : b(13) || ay > 0.55 ? "down" : null;
    const a = b(0);
    const back = b(1);
    if (inMenu) {
      if (dir && (dir !== held || now >= nextAt)) {
        // Show the focus ring from here on: this person is steering with a pad.
        document.documentElement.dataset.pad = "on";
        nextAt = now + (dir !== held ? FIRST_REPEAT : REPEAT);
        move(dir);
      }
      // A acts on release, so the press that closes the pause menu is not also read as a kick.
      if (!a && aDown) (document.activeElement as HTMLElement | null)?.click?.();
      if (back && !bDown) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    }
    held = dir;
    aDown = a;
    bDown = back;
  };
  raf = requestAnimationFrame(poll);
  return () => cancelAnimationFrame(raf);
}
