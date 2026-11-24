import { type Box, type Fighter, type Match, type Move, type Shot, type ShotSpec } from "./types";

// Boxes: where a fighter can be hit, where an attack reaches, and whether the two meet.

export interface Rect { l: number; r: number; b: number; t: number }

// Hit tests run every tick, so they write into two scratch rectangles instead of making new ones.
export const newRect = (): Rect => ({ l: 0, r: 0, b: 0, t: 0 });

export const RA = newRect();

export const RB = newRect();

export function attackRect(f: Fighter, box: Box, out: Rect): Rect {
  const a = f.x + f.facing * box.x0;
  const b = f.x + f.facing * box.x1;
  out.l = Math.min(a, b);
  out.r = Math.max(a, b);
  out.b = f.y + box.y0;
  out.t = f.y + box.y1;
  return out;
}

export function isCrouched(f: Fighter): boolean {
  if (f.state === "crouch") return true;
  if ((f.state === "block" || f.state === "hit") && f.crouchBlock) return true;
  return f.state === "attack" && (f.move?.pose === "lowpeck" || f.move?.pose === "sweep");
}

export function hurtRect(f: Fighter, out: Rect): Rect {
  const half = f.def.width / 2;
  const h = isCrouched(f) ? f.def.height * 0.62 : f.state === "launched" ? f.def.height * 0.7 : f.def.height;
  out.l = f.x - half;
  out.r = f.x + half;
  out.b = f.y;
  out.t = f.y + h;
  return out;
}

export function shotRect(s: Shot, out: Rect): Rect {
  const half = s.spec.size * 0.75;
  out.l = s.x - half;
  out.r = s.x + half;
  out.b = s.y - half;
  out.t = s.y + half;
  return out;
}

export const overlap = (a: Rect, b: Rect) => a.l < b.r && a.r > b.l && a.b < b.t && a.t > b.b;

export function hittable(f: Fighter): boolean {
  if (f.invuln > 0) return false;
  if (f.state === "down" || f.state === "getup" || f.state === "ko" || f.state === "win" || f.state === "lose" || f.state === "grabbed") return false;
  return f.state !== "launched" || f.juggle < 2;
}

/** How far in front of its feet a move can reach, counting any travel. */
export function reachOf(mv: Move): number {
  const travel = mv.dash ? mv.dash * mv.active : mv.leap ? mv.leap.vx * 30 : 0;
  return (mv.box?.x1 ?? 0) + travel;
}

/** Roughly how far a shot flies before it lands or fizzles. */
export function shotRange(spec: ShotSpec): number {
  if (spec.g > 0) {
    // Time to fall back to the floor from the launch height.
    const t = (spec.vy + Math.sqrt(spec.vy * spec.vy + 2 * spec.g * spec.y)) / spec.g;
    return spec.vx * t;
  }
  return spec.vx * (spec.life ?? 400);
}

/**
 * Every box in play, for the training overlay. `hurt` can be hit this tick; `safe` cannot (getting up,
 * mid-roll, the untouchable start of a move). `grab` is how far a command throw reaches: it catches
 * a standing opponent whose own box touches it when the wind-up ends.
 */
export function debugBoxes(m: Match): { hurt: Rect[]; safe: Rect[]; attack: Rect[]; grab: Rect[]; shots: Rect[] } {
  const hurt: Rect[] = [];
  const safe: Rect[] = [];
  const attack: Rect[] = [];
  const grab: Rect[] = [];
  for (const f of m.f) {
    (hittable(f) ? hurt : safe).push(hurtRect(f, newRect()));
    const mv = f.state === "attack" ? f.move : null;
    if (!mv) continue;
    if (mv.box && f.phase === "active") attack.push(attackRect(f, mv.box, newRect()));
    if (mv.grab !== undefined && f.phase !== "recovery") {
      const front = f.def.width / 2;
      grab.push(attackRect(f, { x0: front, x1: front + mv.grab, y0: 0, y1: f.def.height * 0.6 }, newRect()));
    }
  }
  return { hurt, safe, attack, grab, shots: m.shots.filter((s) => s.delay === 0).map((s) => shotRect(s, newRect())) };
}
