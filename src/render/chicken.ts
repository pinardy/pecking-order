import type { Breed, FighterDef, Palette } from "../game";
import { CREAM, CREAM_DEEP, INK, STRAW } from "../palette";

// The chickens are drawn the way the Exploding Chickens logo is: flat shapes, no outlines.
// An oval body with a darker belly patch, a round head, a scalloped comb, a wedge of a beak,
// a wattle, a dot of an eye and straw stick legs. Here the same parts hang off a small rig so
// they can peck, kick, block and fall over.

export interface Rig {
  /** Hip height above the ground when standing, and half the gap between the legs. */
  hipY: number;
  hipDX: number;
  leg: number;
  /** Body centre above the hip, and its radii. */
  bodyUp: number;
  rx: number;
  ry: number;
  /** Head centre relative to the body centre. */
  headX: number;
  headUp: number;
  headR: number;
  beak: number;
  wing: number;
  legW: number;
  toe: number;
}

export const RIGS: Record<Breed, Rig> = {
  rooster: { hipY: 30, hipDX: 8, leg: 34, bodyUp: 22, rx: 25, ry: 27, headX: 9, headUp: 36, headR: 14.5, beak: 1, wing: 27, legW: 3.4, toe: 8 },
  hen: { hipY: 20, hipDX: 10, leg: 23, bodyUp: 25, rx: 31, ry: 28, headX: 8, headUp: 31, headR: 15, beak: 1, wing: 29, legW: 3.4, toe: 8 },
  chick: { hipY: 10, hipDX: 6, leg: 12, bodyUp: 15, rx: 18, ry: 16.5, headX: 4, headUp: 19, headR: 13.5, beak: 0.72, wing: 14, legW: 2.6, toe: 5.5 },
};

export type Eye = "open" | "angry" | "hurt" | "ko" | "closed" | "happy";

/** Offsets from the standing pose. x is forward, y is up, angles are radians (positive leans forward). */
export interface Pose {
  bx: number;
  by: number;
  rot: number;
  sx: number;
  sy: number;
  hx: number;
  hy: number;
  hrot: number;
  /** 0 shut, 1 wide open. */
  beak: number;
  /** Wing angle: about -0.4 is tucked, 1.6 points straight up, 3.1 reaches forward. */
  wing: number;
  wingExt: number;
  /** Front and back foot, relative to where they stand. */
  f1x: number;
  f1y: number;
  f2x: number;
  f2y: number;
  tail: number;
  /** Rotation of the whole bird about its middle: tumbling and lying down. */
  spin: number;
  eye: Eye;
}

export const REST: Pose = {
  bx: 0, by: 0, rot: 0, sx: 1, sy: 1, hx: 0, hy: 0, hrot: 0, beak: 0,
  wing: -0.4, wingExt: 1, f1x: 0, f1y: 0, f2x: 0, f2y: 0, tail: 0, spin: 0, eye: "open",
};

const NUMERIC = ["bx", "by", "rot", "sx", "sy", "hx", "hy", "hrot", "beak", "wing", "wingExt", "f1x", "f1y", "f2x", "f2y", "tail", "spin"] as const;

/** Blend two poses. k may run past 0 or 1 to wind up or overshoot. */
export function mixPose(a: Pose, b: Pose, k: number): Pose {
  const out = { ...a };
  for (const key of NUMERIC) out[key] = a[key] + (b[key] - a[key]) * k;
  out.eye = k > 0.3 ? b.eye : a.eye;
  return out;
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) + (((pb >> shift) & 255) - ((pa >> shift) & 255)) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

const flashCache = new Map<string, Palette>();
/** The palette washed towards white, for the frame a hit lands. */
export function flashPalette(def: FighterDef): Palette {
  let p = flashCache.get(def.id);
  if (!p) {
    p = { ...def.colors };
    for (const k of Object.keys(p) as (keyof Palette)[]) p[k] = mixHex(def.colors[k], "#ffffff", 0.7);
    flashCache.set(def.id, p);
  }
  return p;
}

const altCache = new Map<string, Palette>();
/** A second set of feathers, so two of the same fighter can be told apart. Warm birds go cool and cool birds go warm. */
export function altPalette(def: FighterDef): Palette {
  let p = altCache.get(def.id);
  if (!p) {
    const body = parseInt(def.colors.body.slice(1), 16);
    const tint = (body & 255) > ((body >> 16) & 255) ? "#d98a4a" : "#6f8fc0";
    const c = def.colors;
    p = { ...c, body: mixHex(c.body, tint, 0.45), belly: mixHex(c.belly, tint, 0.45), wing: mixHex(c.wing, tint, 0.45), tail: mixHex(c.tail, tint, 0.3) };
    altCache.set(def.id, p);
  }
  return p;
}

// Colours worked out from a palette are kept, so nothing is parsed or mixed while drawing.
const shadeCache = new WeakMap<Palette, { leg: string; tail: string; glint: string }>();
function shadesOf(c: Palette) {
  let s = shadeCache.get(c);
  if (!s) {
    // The glint is white on a dark eye, dark on a pale one.
    s = { leg: mixHex(c.leg, INK, 0.22), tail: mixHex(c.tail, INK, 0.16), glint: parseInt(c.eye.slice(1, 3), 16) > 128 ? INK : "#ffffff" };
    shadeCache.set(c, s);
  }
  return s;
}

const TOES = [-0.6, 0, 0.6];
const FLUFF = [-3.5, 0, 3.5];
const PLUME = [[-16, -42, 4, -28], [-33, -31, -10, -36], [-40, -11, -24, -30]];
const TUFT = [[-13, -13, -3, -13], [-16, -3, -8, -9]];
const SPOTS = [[-0.5, -0.3, 2.4], [-0.2, -0.62, 2], [-0.66, 0.12, 2.2], [0.3, -0.5, 1.8], [-0.34, 0.02, 1.7], [0.62, -0.1, 2]];

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function leg(ctx: Ctx, r: Rig, color: string, hx: number, hy: number, fx: number, fy: number) {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.hypot(dx, dy) || 0.001;
  // Two segments; the joint folds backwards when the foot is closer than the leg is long.
  const fold = Math.sqrt(Math.max(0, (r.leg / 2) ** 2 - (d / 2) ** 2)) * 0.85;
  const kx = (hx + fx) / 2 - (dy / d) * fold;
  const ky = (hy + fy) / 2 + (dx / d) * fold;
  ctx.strokeStyle = color;
  ctx.lineWidth = r.legW;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  if (fy > -1.5) {
    // Planted: toes flat on the ground.
    ctx.moveTo(fx - r.toe * 0.55, fy);
    ctx.lineTo(fx + r.toe, fy);
  } else {
    // In the air: toes fan out along the shin.
    const a = Math.atan2(fy - ky, fx - kx);
    for (const off of TOES) {
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(a + off) * r.toe * 0.8, fy + Math.sin(a + off) * r.toe * 0.8);
    }
  }
  ctx.stroke();
}

function eye(ctx: Ctx, kind: Eye, R: number, c: Palette) {
  const ex = -0.06 * R;
  const ey = 0.04 * R;
  ctx.strokeStyle = c.eye;
  ctx.lineWidth = 0.13 * R;
  if (kind === "open" || kind === "angry") {
    ctx.fillStyle = c.eye;
    ctx.beginPath();
    ctx.arc(ex, ey, 0.17 * R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadesOf(c).glint;
    ctx.beginPath();
    ctx.arc(ex + 0.06 * R, ey - 0.06 * R, 0.065 * R, 0, Math.PI * 2);
    ctx.fill();
    if (kind === "angry") {
      ctx.beginPath();
      ctx.moveTo(ex - 0.32 * R, ey - 0.42 * R);
      ctx.lineTo(ex + 0.3 * R, ey - 0.2 * R);
      ctx.stroke();
    }
    return;
  }
  ctx.beginPath();
  if (kind === "hurt") {
    ctx.moveTo(ex - 0.2 * R, ey - 0.2 * R);
    ctx.lineTo(ex + 0.14 * R, ey);
    ctx.lineTo(ex - 0.2 * R, ey + 0.2 * R);
  } else if (kind === "ko") {
    ctx.moveTo(ex - 0.18 * R, ey - 0.18 * R);
    ctx.lineTo(ex + 0.18 * R, ey + 0.18 * R);
    ctx.moveTo(ex + 0.18 * R, ey - 0.18 * R);
    ctx.lineTo(ex - 0.18 * R, ey + 0.18 * R);
  } else if (kind === "closed") {
    ctx.moveTo(ex - 0.22 * R, ey);
    ctx.quadraticCurveTo(ex, ey + 0.16 * R, ex + 0.22 * R, ey);
  } else {
    ctx.moveTo(ex - 0.22 * R, ey + 0.1 * R);
    ctx.quadraticCurveTo(ex, ey - 0.3 * R, ex + 0.22 * R, ey + 0.1 * R);
  }
  ctx.stroke();
}

function head(ctx: Ctx, def: FighterDef, r: Rig, p: Pose, c: Palette) {
  const R = r.headR;
  const L = def.look;
  if (L.comb === 0 && !L.shell) {
    // Chick fluff.
    ctx.strokeStyle = c.comb;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const dx of FLUFF) {
      ctx.moveTo(dx * 0.3, -R * 0.9);
      ctx.lineTo(dx, -R - 5 + Math.abs(dx) * 0.5);
    }
    ctx.stroke();
  }
  if (L.wattle > 0) {
    const w = L.wattle * R;
    ctx.fillStyle = c.comb;
    ctx.beginPath();
    ctx.moveTo(0.62 * R, 0.74 * R);
    ctx.quadraticCurveTo(0.62 * R + 0.34 * w, 0.74 * R + 0.3 * w, 0.52 * R, 0.74 * R + 0.56 * w);
    ctx.quadraticCurveTo(0.3 * R, 0.74 * R + 0.3 * w, 0.4 * R, 0.7 * R);
    ctx.closePath();
    ctx.fill();
  }
  ellipse(ctx, 0, 0, R, R, c.body);
  if (L.comb > 0) {
    // Three scallops sitting on the crown and leaning out over the beak, like the logo's.
    const top = -0.82 * R - 0.55 * R * L.comb;
    ctx.fillStyle = c.comb;
    ctx.beginPath();
    ctx.moveTo(-0.64 * R, -0.8 * R);
    ctx.quadraticCurveTo(-0.37 * R, top, -0.09 * R, -0.84 * R);
    ctx.quadraticCurveTo(0.18 * R, top, 0.45 * R, -0.82 * R);
    ctx.quadraticCurveTo(0.73 * R, top + 0.1 * R, 0.93 * R, -0.7 * R);
    ctx.closePath();
    ctx.fill();
  }
  if (L.shell) {
    // Half an eggshell worn as a helmet, with the cracked edge showing.
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.1, Math.PI * 1.02, Math.PI * 1.98);
    const teeth = 6;
    for (let i = 0; i <= teeth; i++) {
      const x = R * 1.1 - (i / teeth) * R * 2.2;
      ctx.lineTo(x, i % 2 === 0 ? -R * 0.12 : -R * 0.42);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CREAM_DEEP;
    ctx.beginPath();
    ctx.ellipse(-R * 0.35, -R * 0.72, R * 0.3, R * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (L.crown) {
    // Worn at the back of the comb, a little askew.
    const y0 = -(0.86 + 0.2 * L.comb) * R;
    ctx.save();
    ctx.translate(-0.5 * R, y0);
    ctx.rotate(-0.3);
    ctx.fillStyle = STRAW;
    ctx.beginPath();
    ctx.moveTo(-0.42 * R, 0);
    ctx.lineTo(-0.46 * R, -0.56 * R);
    ctx.lineTo(-0.2 * R, -0.28 * R);
    ctx.lineTo(0, -0.66 * R);
    ctx.lineTo(0.2 * R, -0.28 * R);
    ctx.lineTo(0.46 * R, -0.56 * R);
    ctx.lineTo(0.42 * R, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Beak: two wedges that part when it opens.
  const tip = 0.5 * R + 0.72 * R * r.beak;
  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(0.48 * R, 0.3 * R);
  ctx.lineTo(tip, 0.52 * R - 0.3 * R * p.beak);
  ctx.lineTo(0.48 * R, 0.64 * R);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.48 * R, 0.56 * R);
  ctx.lineTo(tip - 0.08 * R, 0.6 * R + 0.34 * R * p.beak);
  ctx.lineTo(0.48 * R, 0.84 * R);
  ctx.closePath();
  ctx.fill();
  eye(ctx, p.eye, R, c);
}

/**
 * Draws a chicken standing on the origin and facing right.
 * The caller positions, flips and scales it.
 */
export function drawChicken(ctx: Ctx, def: FighterDef, p: Pose, palette?: Palette) {
  const r = RIGS[def.breed];
  const c = palette ?? def.colors;
  const L = def.look;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const hipY = -(r.hipY + p.by);
  if (p.spin) {
    const cy = hipY - r.bodyUp;
    ctx.translate(p.bx, cy);
    ctx.rotate(p.spin);
    ctx.translate(-p.bx, -cy);
  }
  leg(ctx, r, shadesOf(c).leg, p.bx - r.hipDX * 0.8, hipY, -r.hipDX + p.f2x, -p.f2y);
  leg(ctx, r, c.leg, p.bx + r.hipDX * 0.8, hipY, r.hipDX + p.f1x, -p.f1y);

  ctx.translate(p.bx, hipY);
  ctx.rotate(p.rot);
  ctx.scale(p.sx, p.sy);
  const by = -r.bodyUp;

  if (L.tail !== "none") {
    ctx.save();
    ctx.translate(-r.rx * 0.72, by - r.ry * 0.2);
    ctx.rotate(p.tail);
    const plumes = L.tail === "plume" ? PLUME : TUFT;
    ctx.lineWidth = L.tail === "plume" ? 8.5 : 8;
    for (let i = 0; i < plumes.length; i++) {
      ctx.strokeStyle = i === 1 ? shadesOf(c).tail : c.tail;
      ctx.beginPath();
      ctx.moveTo(4, 2);
      ctx.quadraticCurveTo(plumes[i][2], plumes[i][3], plumes[i][0], plumes[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  ellipse(ctx, 0, by, r.rx, r.ry, c.body);
  ellipse(ctx, r.rx * 0.04, by + r.ry * 0.45, r.rx * 0.55, r.ry * 0.39, c.belly);
  if (L.spots) {
    ctx.fillStyle = L.spots;
    for (const [sx, sy, sr] of SPOTS) {
      ctx.beginPath();
      ctx.arc(sx * r.rx, by + sy * r.ry, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Neck: hidden at rest, it stretches when the head lunges so a peck reads as one shape.
  const hx = r.headX + p.hx;
  const hy = by - r.headUp - p.hy;
  ctx.strokeStyle = c.body;
  ctx.lineWidth = r.headR * 1.25;
  ctx.beginPath();
  ctx.moveTo(r.headX * 0.6, by - r.ry * 0.45);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(p.hrot);
  head(ctx, def, r, p, c);
  ctx.restore();

  // Near wing, over the body.
  const len = r.wing * p.wingExt;
  const fat = r.wing * 0.3;
  ctx.save();
  ctx.translate(-r.rx * 0.08, by - r.ry * 0.08);
  ctx.rotate(p.wing);
  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(3, -fat * 0.9);
  ctx.quadraticCurveTo(-len * 0.6, -fat * 1.5, -len, 0);
  ctx.quadraticCurveTo(-len * 0.5, fat * 1.6, 3, fat * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

/** Total standing height of a breed, comb included; used to frame portraits. */
export function standingHeight(def: FighterDef): number {
  const r = RIGS[def.breed];
  return r.hipY + r.bodyUp + r.headUp + r.headR * (1.1 + 0.4 * def.look.comb);
}
