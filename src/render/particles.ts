import { STAGE_W, WALL, type GameEvent, type Match } from "../game";
import { CREAM, CREAM_DEEP, STRAW } from "../palette";
import { text } from "./text";

// Sparks, feathers, dust and splats. The engine only says where something happened
// (an "fx" event); what it looks like, and how it moves afterwards, is decided here.
// Nothing in this file affects the fight, so it is free to use Math.random.

type Ctx = CanvasRenderingContext2D;
type Kind = "spark" | "guard" | "feather" | "dust" | "splat" | "ring" | "star" | "word" | "streak";

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  t: number;
  life: number;
  size: number;
  color: string;
  /** For a "word": what it says. */
  text?: string;
}

const GUARD_ARCS = [0.4, 2.5, 4.6];
const MAX = 180;
const rnd = Math.random;

/** A filled star with `points` points. */
export function burst(ctx: Ctx, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParticle(ctx: Ctx, p: Particle) {
  const u = p.t / p.life;
  ctx.save();
  ctx.translate(p.x, -p.y);
  if (p.kind === "streak") {
    // The wake of a beak or a foot.
    ctx.globalAlpha = 0.45 * (1 - u);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 1.7 * (1 - u * 0.4), p.size * 0.42 * (1 - u), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (p.kind === "word") {
    ctx.globalAlpha = Math.min(1, p.t / 4, (p.life - p.t) / 14);
    text(ctx, p.text ?? "", 0, 0, p.size, p.color, "center", 700, 2);
    ctx.restore();
    return;
  }
  switch (p.kind) {
    case "spark":
      ctx.rotate(p.rot);
      ctx.globalAlpha = 1 - u * u;
      ctx.fillStyle = STRAW;
      burst(ctx, 8, p.size * (0.5 + u * 0.9), p.size * (0.22 + u * 0.3));
      ctx.fillStyle = CREAM;
      burst(ctx, 8, p.size * (0.3 + u * 0.5), p.size * (0.12 + u * 0.16));
      break;
    case "guard":
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = "#cfe6f0";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      for (const a of GUARD_ARCS) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.5 + u), a, a + 1.2);
        ctx.stroke();
      }
      break;
    case "ring":
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (0.4 + u), 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "feather":
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, (p.life - p.t) / 12);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.quadraticCurveTo(0, -p.size * 0.55, p.size, 0);
      ctx.quadraticCurveTo(0, p.size * 0.55, -p.size, 0);
      ctx.fill();
      break;
    case "star":
      ctx.rotate(p.rot);
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = p.color;
      burst(ctx, 4, p.size, p.size * 0.4);
      break;
    case "dust":
      ctx.globalAlpha = 0.5 * (1 - u);
      ctx.fillStyle = CREAM_DEEP;
      ctx.beginPath();
      ctx.arc(0, 0, p.size * (0.6 + u), 0, Math.PI * 2);
      ctx.fill();
      break;
    case "splat": {
      ctx.globalAlpha = Math.min(1, (p.life - p.t) / 14);
      const grow = Math.min(1, p.t / 4);
      const flat = p.y < 4 ? 0.3 : 0.8;
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 1.5 * grow, p.size * 1.5 * flat * grow, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = STRAW;
      ctx.beginPath();
      ctx.ellipse(p.size * 0.2, 0, p.size * 0.6 * grow, p.size * 0.6 * flat * grow, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Keeps a floating word far enough from the arena walls to be read in full. */
const inside = (x: number) => Math.max(WALL + 46, Math.min(STAGE_W - WALL - 46, x));

const onFloor = (p: Particle) => p.kind === "dust" || (p.kind === "splat" && p.y < 4);

export class Particles {
  private list: Particle[] = [];

  private add(kind: Kind, x: number, y: number, o: Partial<Particle>) {
    if (this.list.length > MAX) this.list.shift();
    this.list.push({ kind, x, y, vx: 0, vy: 0, rot: 0, vr: 0, t: 0, life: 12, size: 12, color: CREAM, ...o });
  }

  /** Turns one of the engine's cues into particles. Other events are ignored. */
  /** Call once a tick: leaves a streak where each live attack currently reaches. */
  trail(m: Match) {
    for (const f of m.f) {
      const box = f.move?.box;
      if (f.state !== "attack" || !box || f.phase !== "active") continue;
      this.add("streak", f.x + f.facing * (box.x1 - 8), f.y + (box.y0 + box.y1) / 2, { life: 7, size: Math.max(8, (box.y1 - box.y0) * 0.3), color: f.move?.charged ? STRAW : CREAM });
    }
  }

  cue(e: GameEvent, m: Match) {
    if (e.type === "caught") {
      // A failed block gets a word of explanation, floating up from whoever it happened to.
      const say = e.why === "low" ? "Block low!" : e.why === "high" ? "Block standing!" : "Throw!";
      this.add("word", inside(e.x), e.y + 16, { vy: 0.6, life: 58, size: 15, text: say });
      return;
    }
    if (e.type === "word") {
      this.add("word", inside(e.x), e.y + 16, { vy: 0.6, life: 58, size: 16, text: e.text, color: STRAW });
      return;
    }
    if (e.type !== "fx") return;
    const { x, y } = e;
    switch (e.kind) {
      case "impact": {
        const power = e.power ?? 0;
        this.add("spark", x, y, { size: 18 + power * 9, life: 9 + power * 2, rot: rnd() * Math.PI });
        for (let i = 0; i < 2 + power * 2; i++) {
          const a = rnd() * Math.PI * 2;
          this.add("star", x, y, { vx: Math.cos(a) * (2 + rnd() * 3), vy: Math.sin(a) * 3 + 2, vr: 0.3, life: 16 + rnd() * 8, size: 3 + rnd() * 3, color: STRAW });
        }
        break;
      }
      case "feathers": {
        // Shed in the colours of whoever lost them.
        const c = m.f[e.side ?? 0].def.colors;
        for (let i = 0; i < (e.n ?? 1); i++) {
          const a = rnd() * Math.PI * 2;
          const sp = 1.5 + rnd() * 3.5;
          this.add("feather", x, y, {
            vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 1, rot: a, vr: (rnd() - 0.5) * 0.4,
            life: 38 + rnd() * 26, size: 5 + rnd() * 4, color: rnd() < 0.3 ? c.wing : c.body,
          });
        }
        break;
      }
      case "dust":
        for (let i = 0; i < (e.n ?? 1); i++) {
          this.add("dust", x + (rnd() - 0.5) * 16, 2, { vx: (rnd() - 0.5) * 3.2 * (e.spread ?? 1), vy: 0.4 + rnd() * 0.9, life: 16 + rnd() * 10, size: 5 + rnd() * 5, color: CREAM_DEEP });
        }
        break;
      default:
        this.add(e.kind, x, y, { size: e.size, life: e.life });
    }
  }

  /** Moves everything on by one tick. */
  step() {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (++p.t >= p.life) {
        list.splice(i, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.kind === "feather") {
        p.vx *= 0.95;
        p.vy = Math.max(-0.9, p.vy - 0.13);
        if (p.y < 2) {
          p.y = 2;
          p.vr = 0;
          p.vx = 0;
        }
      } else if (p.kind === "star") {
        p.vy -= 0.28;
      } else if (p.kind === "dust") {
        p.vx *= 0.9;
        p.vy *= 0.92;
      }
    }
  }

  /** Draws what lies on the floor (behind the fighters) or what is in the air (in front). */
  draw(ctx: Ctx, layer: "floor" | "air") {
    for (const p of this.list) if (onFloor(p) === (layer === "floor")) drawParticle(ctx, p);
  }
}
