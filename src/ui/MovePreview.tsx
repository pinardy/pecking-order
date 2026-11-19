import { useEffect, useRef } from "react";
import { NO_INPUT, TRAINING, createMatch, inputFor, step, type FighterDef, type Input, type Match } from "../game";
import { drawChicken } from "../render/chicken";
import { poseOf } from "../render/pose";
import { drawShot } from "../render/scene";

/** World units from the left edge of the picture to the fighter, and from top to bottom. */
const LEAD = 90;
const TALL = 230;

/**
 * Shows one move on a loop. Nothing here is animated by hand: a real match is set up with
 * the fighter in it, the move's input is pressed, and the engine and renderer do the rest.
 */
export function MovePreview({ fighter, move, height }: { fighter: FighterDef; move: string; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = Math.round(height * 1.45);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const how = inputFor(fighter, move).input;
    const unit = (height * dpr) / TALL;

    let m: Match;
    let t = 0;
    let rested = 0;
    let cam = 0;
    const restart = () => {
      m = createMatch(fighter, fighter, { rules: TRAINING });
      // Skip the opening call, then stand the sparring partner well out of the way.
      for (let i = 0; i < 82; i++) step(m, NO_INPUT, NO_INPUT);
      m.f[0].x = 300;
      m.f[1].x = 680;
      m.f[0].meter = 100;
      m.banner = null;
      t = rested = 0;
      cam = m.f[0].x - LEAD;
    };
    const input = (): Input => {
      const f = m.f[0];
      if (how.startsWith("Jump")) {
        if (t >= 12 && t < 15) return { ...NO_INPUT, y: 1 };
        const falling = f.state === "air" && f.vy < 2 && t % 2 === 0;
        return { ...NO_INPUT, special: falling && how.endsWith("Special"), heavy: falling && how.endsWith("Kick"), light: falling && how.endsWith("Peck") };
      }
      if (t < 12 || t >= 14) return NO_INPUT;
      return {
        ...NO_INPUT, x: how.startsWith("Toward") ? 1 : 0, y: how.startsWith("Down") ? -1 : 0,
        special: how.endsWith("Special"), sup: how === "Crow", light: how.endsWith("Peck"), heavy: how.endsWith("Kick"),
      };
    };

    restart();
    let raf = 0;
    let last = performance.now();
    let owed = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // The engine runs at sixty ticks a second whatever the screen does, exactly as in a fight.
      owed += Math.min(100, now - last);
      last = now;
      if (owed < 1000 / 60) return;
      for (let n = 0; owed >= 1000 / 60 && n < 4; n++, owed -= 1000 / 60) {
        step(m!, input(), NO_INPUT);
        t++;
        const at = m!.f[0];
        // Once the move is over and its shots have gone, wait a beat and go again.
        rested = t > 30 && at.state === "idle" && m!.shots.length === 0 ? rested + 1 : 0;
        if (rested > 40 || t > 480) restart();
        cam += (m!.f[0].x - LEAD - cam) * 0.1;
      }
      const f = m!.f[0];

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(unit, 0, 0, unit, -cam * unit, canvas.height - 14 * unit);
      ctx.fillStyle = "rgba(20,8,2,0.28)";
      ctx.beginPath();
      ctx.ellipse(f.x, 2, fighter.width * 0.55, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(f.x, -f.y);
      ctx.scale(f.facing, 1);
      drawChicken(ctx, fighter, poseOf(f, m!));
      ctx.restore();
      for (const shot of m!.shots) if (shot.side === 0) drawShot(ctx, shot, m!.tick);
    };
    // Only while it can be seen.
    const watch = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (!entry.isIntersecting) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });
    watch.observe(canvas);
    return () => {
      watch.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [fighter, move, height, width]);

  return <canvas ref={ref} className="move-preview" style={{ width, height }} aria-hidden="true" />;
}
