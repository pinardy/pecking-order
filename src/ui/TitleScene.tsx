import { useEffect, useRef } from "react";
import { STAGE_W, type FighterDef } from "../game";
import { REST, drawChicken, type Pose } from "../render/chicken";
import { GROUND_Y, VIEW_H, buildStage, drawStage, type StageLayers } from "../render/stage";
import type { Mood } from "../story";
import { useSettings } from "./settings";

/**
 * How a fighter stands on the title screen, `t` ticks in. A fighting stance that bounces on the
 * beat, with a blink now and then, and every few seconds a taunt: the one on the left flaps her
 * wings at the other, and a couple of seconds later the one on the right scrapes the ground and
 * leans in. Moves are small, so the scene stays a backdrop.
 */
function titlePose(t: number, side: 0 | 1, taunt = true, talking = false, mood: Mood | null = null): Pose {
  const phase = side * 1.7;
  const beat = Math.sin(t * 0.15 + phase);
  const p: Pose = {
    ...REST,
    by: 1.5 + beat * 1.6,
    sy: 1 - beat * 0.025,
    sx: 1 + beat * 0.02,
    rot: 0.1,
    hx: 3 + Math.sin(t * 0.15 + phase + 0.9) * 2.2,
    hy: -beat * 1.2,
    wing: -0.35 + beat * 0.12,
    tail: Math.sin(t * 0.07 + phase) * 0.14,
    eye: (t + side * 90) % 200 < 7 ? "closed" : "angry",
  };
  if (mood === "hurt") {
    // Beaten: slumped, feathers down, no bounce left in them.
    const sag = Math.sin(t * 0.06) * 0.6;
    return { ...REST, rot: 0.3, by: -3 + sag, hx: 5, hy: -9 + sag, wing: -0.75, tail: -0.25, eye: "hurt", beak: talking ? Math.abs(Math.sin(t * 0.3)) * 0.5 : 0 };
  }
  if (mood === "happy") {
    // Won: a little hop, wings out, and a smile.
    const hop = Math.abs(Math.sin(t * 0.13 + phase)) * 5;
    return { ...p, by: p.by + hop, f1y: hop * 0.8, f2y: hop * 0.8, wing: 0.5 + Math.sin(t * 0.26) * 0.5, wingExt: 1.15, eye: "happy", beak: 0.3 };
  }
  // Whoever is speaking (in a story scene) works their beak and nods along.
  if (talking) return { ...p, beak: Math.abs(Math.sin(t * 0.45)) * 0.75, hy: p.hy + Math.abs(Math.sin(t * 0.225)) * 2, hx: p.hx + 1.5 };
  // The taunts take turns: left at the start of each five-second cycle, right halfway through.
  const u = ((t + side * 150) % 300) / 50;
  if (!taunt || u >= 1) return p;
  const arc = Math.sin(u * Math.PI);
  if (side === 0) {
    return { ...p, wing: p.wing + arc * 2.1 + Math.sin(u * Math.PI * 6) * 0.3 * arc, wingExt: 1 + arc * 0.3, beak: arc * 0.7, hy: p.hy + arc * 3 };
  }
  const scrape = Math.max(0, Math.sin(u * Math.PI * 3));
  return { ...p, f1y: scrape * 7, f1x: -scrape * 5, hx: p.hx + arc * 6, hy: p.hy - arc * 2, hrot: -0.2 * arc, beak: arc * 0.8 };
}

/** How much taller than its box the picture is drawn; the excess sky is cut off at the top. */
const ZOOM = 1.3;

/**
 * The top of the title screen: an arena, drawn by the game's own stage renderer, with two
 * fighters squared off on its floor. The crowd, clouds and lanterns move as they do in a fight,
 * at half the frame rate, and only while the scene is on screen.
 */
interface SceneProps {
  stage: number;
  left: FighterDef;
  right: FighterDef;
  /** The taunts between the two (on by default; off in story scenes, where they would talk over the dialogue). */
  taunt?: boolean;
  /** Which of the two is speaking, if either. */
  talking?: 0 | 1 | null;
  /** How each of the two is feeling, where it is not their usual fighting stance. */
  moods?: [Mood | null, Mood | null];
  className?: string;
}

const NO_MOODS: [null, null] = [null, null];

export function TitleScene({ stage, left, right, taunt = true, talking = null, moods = NO_MOODS, className = "title-scene" }: SceneProps) {
  // Who is on stage and who is talking can change line by line without the arena being rebuilt.
  const cast = useRef({ left, right, taunt, talking, moods });
  cast.current = { left, right, taunt, talking, moods };
  const box = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const [settings] = useSettings();
  const still = settings.reducedMotion;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const holder = box.current;
    if (!canvas || !ctx || !holder) return;
    let layers: StageLayers | null = null;
    let scale = 1;
    let viewW = 640;

    const fit = () => {
      const r = holder.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // The top of the sky is cropped off (the canvas is taller than its box), so the fighters stand larger.
      const tall = r.height * ZOOM;
      scale = (tall * dpr) / VIEW_H;
      // However wide the screen, never show more than the arena has.
      viewW = Math.min(STAGE_W - 120, (r.width / tall) * VIEW_H);
      canvas.width = Math.round(viewW * scale);
      canvas.height = Math.round(VIEW_H * scale);
      if (!layers || Math.abs(layers.scale - scale) > 0.01) layers = buildStage(stage, scale);
      return true;
    };

    const paint = (tick: number) => {
      if (!layers) return;
      const camX = (STAGE_W - viewW) / 2;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawStage(ctx, layers, camX, viewW, tick, 0);
      ctx.translate(-camX, GROUND_Y);
      // Each stands far enough in from the middle that the gap between them is the same on any screen.
      const gap = Math.min(82, viewW * 0.23);
      const now = cast.current;
      for (const [f, x, facing, side] of [[now.left, STAGE_W / 2 - gap, 1, 0], [now.right, STAGE_W / 2 + gap, -1, 1]] as const) {
        ctx.fillStyle = "rgba(20,8,2,0.28)";
        ctx.beginPath();
        ctx.ellipse(x, 2, f.width * 0.55, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(x, 0);
        ctx.scale(facing, 1);
        drawChicken(ctx, f, titlePose(tick, side, now.taunt, now.talking === side, now.moods[side]));
        ctx.restore();
      }
    };

    let raf = 0;
    let last = 0;
    const began = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 32) return;
      last = now;
      paint((now - began) / (1000 / 60));
    };
    const resize = new ResizeObserver(() => fit() && paint(still ? 0 : (performance.now() - began) / (1000 / 60)));
    resize.observe(holder);
    const watch = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting && !still) raf = requestAnimationFrame(loop);
    });
    if (fit()) paint(0);
    watch.observe(holder);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      watch.disconnect();
    };
  }, [stage, still]);

  return (
    <div className={className} ref={box} aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
