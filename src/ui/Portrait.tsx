import { useEffect, useRef } from "react";
import type { FighterDef } from "../game";
import { REST, altPalette, drawChicken, standingHeight, type Pose } from "../render/chicken";
import { winPose } from "../render/pose";
import { useSettings } from "./settings";

export type Mood = "idle" | "ready" | "win" | "lose";

function moodPose(fighter: FighterDef, mood: Mood, t: number): Pose {
  const b = Math.sin(t * 0.11);
  switch (mood) {
    case "win":
      return winPose(fighter, t);
    case "lose":
      return { ...REST, rot: 0.26, by: -3, hy: -8, hx: 4, wing: -0.7, eye: "closed" };
    case "ready":
      return { ...REST, by: b * 1.2, hy: -b * 0.7, rot: 0.1, hx: 3, wing: -0.4 + b * 0.06, tail: b * 0.05, eye: "angry" };
    default:
      return { ...REST, by: b * 1.2, hy: -b * 0.7, rot: 0.05, hx: 2, wing: -0.4 + b * 0.06, tail: b * 0.05 };
  }
}

/** For a head close-up: how far to zoom (relative to the bird's height), and where the head sits from the feet. */
const HEAD_ZOOM = 1.55;
const HEAD_X = 0.2;
const HEAD_Y = 0.74;

interface Props {
  /** Just the head, filling the frame: a talking head for dialogue. */
  head?: boolean;
  /** Working the beak, as if speaking. */
  talking?: boolean;
  fighter: FighterDef;
  /** Width and height in CSS pixels. */
  size: number;
  mood?: Mood;
  /** Face left instead of right. */
  flip?: boolean;
  /** Draw every fighter at one scale, so a chick looks small next to a rooster. */
  trueScale?: boolean;
  animate?: boolean;
  /** Second-player feathers, for a mirror match. */
  alt?: boolean;
}

/** A chicken on its own little canvas, for menus. */
export function Portrait({ fighter, size, mood = "idle", flip, trueScale, animate = true, alt, head, talking }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [settings] = useSettings();
  const moving = animate && !settings.reducedMotion;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = canvas.height = Math.round(size * dpr);
    // Small birds are drawn a little larger than life so they still read in a thumbnail.
    const tall = trueScale ? 128 : Math.max(standingHeight(fighter), 84);
    // A head close-up fills the frame with the head alone, whatever the size of the bird.
    const s = head ? (size * HEAD_ZOOM) / standingHeight(fighter) : (size * 0.84) / tall;
    const began = performance.now();
    const paint = (now: number) => {
      // Timed by the clock, in sixtieths of a second, so it moves at the same speed on any screen.
      const t = (now - began) / (1000 / 60);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const dir = flip ? -1 : 1;
      if (head) ctx.translate(size / 2 - dir * fighter.width * HEAD_X * s, size * 0.5 + standingHeight(fighter) * HEAD_Y * s);
      else ctx.translate(size / 2 + dir * (fighter.breed === "rooster" ? 7 : 2) * s, size * 0.93);
      ctx.scale(dir * s, s);
      const pose = moodPose(fighter, mood, t);
      // Talking: the beak works and the head nods a little.
      const said = talking ? { ...pose, beak: Math.abs(Math.sin(t * 0.45)) * 0.75, hy: pose.hy + Math.abs(Math.sin(t * 0.225)) * 2 } : pose;
      drawChicken(ctx, fighter, said, alt ? altPalette(fighter) : undefined);
    };
    paint(began);
    if (!moving) return;
    let raf = 0;
    let last = began;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // A gentle bob does not need more than thirty frames a second.
      if (now - last < 30) return;
      last = now;
      paint(now);
    };
    // Only while it can be seen: scrolled out of view, it stops.
    const watch = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) raf = requestAnimationFrame(loop);
    });
    watch.observe(canvas);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [fighter, size, mood, flip, trueScale, moving, alt, head, talking]);

  return <canvas ref={ref} className="portrait" style={{ width: size, height: size }} aria-hidden="true" />;
}
