import { forwardRef, useEffect, useRef, type PointerEvent } from "react";
import { resetTouch, tappedTouch, touch } from "./input";
import type { Offsets, Part } from "./settings";

type ButtonName = "light" | "heavy" | "special" | "sup" | "block";

const BUTTONS: { name: ButtonName; label: string }[] = [
  { name: "sup", label: "Crow" },
  { name: "special", label: "Special" },
  { name: "light", label: "Peck" },
  { name: "heavy", label: "Kick" },
];

/** While arranging the layout: where each part has been dragged to, and how to report a drag. */
export interface EditHooks {
  offsets: Offsets;
  onMove: (part: Part, to: [number, number]) => void;
}

/** Pointer handlers that drag a part around instead of pressing it. Null when not arranging. */
function useDrag(part: Part, edit?: EditHooks) {
  const start = useRef<{ x: number; y: number; ox: number; oy: number; k: number } | null>(null);
  if (!edit) return null;
  const end = () => (start.current = null);
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement;
      el.setPointerCapture?.(e.pointerId);
      const [ox, oy] = edit.offsets[part] ?? [0, 0];
      // Buttons sit inside a scaled cluster, so their offsets are in its units; the stick's are in screen pixels.
      const k = part === "stick" ? 1 : el.offsetWidth / (el.getBoundingClientRect().width || 1);
      start.current = { x: e.clientX, y: e.clientY, ox, oy, k };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      if (s) edit.onMove(part, [Math.round(s.ox + (e.clientX - s.x) * s.k), Math.round(s.oy + (e.clientY - s.y) * s.k)]);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}

function Stick({ player, floating, dead, edit }: { player: 0 | 1; floating: boolean; dead: number; edit?: EditHooks }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const centre = useRef({ x: 0, y: 0, r: 1 });
  const drag = useDrag("stick", edit);
  const state = touch[player];

  const steer = (e: PointerEvent<HTMLDivElement>) => {
    const c = centre.current;
    const dx = (e.clientX - c.x) / c.r;
    const dy = (e.clientY - c.y) / c.r;
    const dist = Math.hypot(dx, dy);
    if (dist < dead) {
      state.x = state.y = 0;
    } else {
      // Eight directions: an axis counts once the thumb is more than a third of the way round to it.
      state.x = Math.abs(dx / dist) > 0.38 ? (dx > 0 ? 1 : -1) : 0;
      state.y = Math.abs(dy / dist) > 0.38 ? (dy < 0 ? 1 : -1) : 0;
    }
    // The knob is drawn in the stick's own unscaled pixels.
    const reach = Math.min(1, dist) * ((base.current?.offsetWidth ?? 0) / 2) * 0.5;
    if (knob.current) knob.current.style.transform = `translate(${(dx / (dist || 1)) * reach}px, ${(dy / (dist || 1)) * reach}px)`;
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const el = base.current;
    if (!el) return;
    active.current = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    if (floating) {
      // The stick comes to the thumb rather than the other way round.
      const zone = el.parentElement!.getBoundingClientRect();
      el.classList.add("held");
      el.style.left = `${e.clientX - zone.left - el.offsetWidth / 2}px`;
      el.style.top = `${e.clientY - zone.top - el.offsetHeight / 2}px`;
    }
    const b = el.getBoundingClientRect();
    centre.current = { x: b.left + b.width / 2, y: b.top + b.height / 2, r: b.width / 2 };
    steer(e);
  };
  const release = (e: PointerEvent<HTMLDivElement>) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    state.x = state.y = 0;
    if (knob.current) knob.current.style.transform = "";
    if (base.current && floating) {
      base.current.classList.remove("held");
      base.current.style.left = base.current.style.top = "";
    }
  };
  const handlers = drag ?? {
    onPointerDown: down,
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => active.current === e.pointerId && steer(e),
    onPointerUp: release,
    onPointerCancel: release,
  };

  return (
    <div className={floating && !edit ? "stick-zone floating" : "stick-zone"} {...handlers} onContextMenu={(e) => e.preventDefault()}>
      <div className="stick" ref={base}>
        <div className="stick-knob" ref={knob} />
      </div>
    </div>
  );
}

function PadButton({ player, name, label, haptic, edit }: { player: 0 | 1; name: ButtonName; label: string; haptic: boolean; edit?: EditHooks }) {
  const drag = useDrag(name, edit);
  const set = (e: PointerEvent<HTMLDivElement>, on: boolean) => {
    touch[player][name] = on;
    if (on && name !== "block") tappedTouch[player][name] = true;
    // A tick under the thumb, so a press can be felt as well as seen.
    if (on && haptic) {
      try {
        navigator.vibrate?.(8);
      } catch {
        /* not supported */
      }
    }
    e.currentTarget.classList.toggle("down", on);
    if (on) e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlers = drag ?? {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => set(e, true),
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => set(e, false),
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => set(e, false),
  };
  return (
    <div className={`pad-button ${name}`} role="button" aria-label={label} {...handlers} onContextMenu={(e) => e.preventDefault()}>
      {label}
    </div>
  );
}

interface Props {
  player?: 0 | 1;
  /** Two sets on one screen: each is a compact cluster in its own bottom corner. */
  duo?: boolean;
  /** The stick appears wherever the thumb lands. */
  floating?: boolean;
  /** Show a Block button. */
  block?: boolean;
  /** Arranging the layout: parts are dragged rather than pressed. */
  edit?: EditHooks;
  /** Vibrate briefly on each button press. */
  haptic?: boolean;
  /** The stick's dead zone, as a fraction of its radius. */
  dead?: number;
}

/**
 * On-screen stick and buttons. They write straight into the shared touch state rather than
 * React state, so holding a direction never re-renders anything.
 */
export const TouchControls = forwardRef<HTMLDivElement, Props>(function TouchControls({ player = 0, duo = false, floating = false, block = false, edit, haptic = false, dead = 0.22 }, ref) {
  useEffect(() => () => resetTouch(player), [player]);
  return (
    <div className={`touch-controls p${player}${duo ? " duo" : ""}${edit ? " editing" : ""}`} ref={ref}>
      <Stick player={player} floating={floating && !duo} dead={dead} edit={edit} />
      <div className="pad">
        {block && !duo && <PadButton player={player} name="block" label="Block" haptic={haptic} edit={edit} />}
        {BUTTONS.map((b) => (
          <PadButton key={b.name} player={player} {...b} haptic={haptic} edit={edit} />
        ))}
      </div>
    </div>
  );
});
