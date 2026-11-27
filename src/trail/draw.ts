import type { Fighter, Match } from "../game";
import { BARN, BARN_DEEP, CREAM, INK, LEAF, STRAW, STRAW_DEEP } from "../palette";
import { altPalette, drawChicken } from "../render/chicken";
import { poseOf } from "../render/pose";
import { GROUND_Y, VIEW_H, drawStage, type StageLayers } from "../render/stage";
import { text } from "../render/text";
import { CRITTER_SIZE, HEARTS, waspY, type Critter, type Trail } from "./trail";

type Ctx = CanvasRenderingContext2D;

export interface TrailView {
  /** Logical width of the view; the height is always VIEW_H. */
  w: number;
  scale: number;
  camX: number;
  /** Less flashing: a knocked hero fades instead of blinking. */
  calm?: boolean;
  alt?: boolean;
}

const EARTH = "#4a2b1b";
const PIT = "#1d0f08";
const WOOD = "#8a5a34";

/**
 * The hero and the opponent are drawn by the fight's own animation, which wants fighters in a match.
 * So the trail keeps a pair of them as puppets and poses the first to suit what the hero is doing.
 */
function pose(t: Trail, f: Fighter, m: Match) {
  m.tick = t.tick;
  m.phase = "fight";
  f.x = t.x;
  f.y = t.y;
  f.vx = t.vx * t.facing;
  f.vy = t.vy;
  f.facing = t.facing;
  f.inp = { ...f.inp, y: t.jumpHeld ? 1 : 0 };
  f.stateT = t.tick;
  f.move = null;
  if (t.done === "won") f.state = "win";
  else if (t.hurt > 62) {
    f.state = "hit";
    f.stateT = 80 - t.hurt;
  } else if (t.peck >= 0) {
    const mv = t.grounded ? f.def.normals.sLight : f.def.normals.jLight;
    f.state = "attack";
    f.move = mv;
    f.phase = t.peck < 4 ? "startup" : t.peck < 9 ? "active" : "recovery";
    f.phaseT = t.peck < 4 ? t.peck : t.peck < 9 ? t.peck - 4 : t.peck - 9;
  } else f.state = !t.grounded ? "air" : t.vx !== 0 ? "walk" : "idle";
  return poseOf(f, m);
}

function critter(ctx: Ctx, c: Critter, tick: number) {
  const size = CRITTER_SIZE[c.kind];
  const y = c.kind === "wasp" ? waspY(c, tick) : c.y;
  ctx.save();
  ctx.translate(c.x, -y);
  if (c.gone > 0) {
    // Squashed flat, then gone.
    ctx.globalAlpha = Math.max(0, 1 - c.gone / 18);
    ctx.scale(1.3, 0.35);
  }
  if (c.kind === "thistle") {
    ctx.strokeStyle = LEAF;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const lean of [-0.5, 0, 0.5]) {
      ctx.moveTo(0, 0);
      ctx.lineTo(lean * 14, -size.height + Math.abs(lean) * 8);
    }
    ctx.stroke();
    // Spiky heads.
    for (const lean of [-0.5, 0, 0.5]) {
      const hx = lean * 14;
      const hy = -size.height + Math.abs(lean) * 8;
      ctx.fillStyle = "#8d5aa8";
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rad = i % 2 === 0 ? 6.5 : 3;
        ctx.lineTo(hx + Math.cos(a) * rad, hy + Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (c.kind === "beetle") {
    ctx.scale(c.dir, 1);
    const step = Math.sin(tick * 0.5) * 2;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const lx of [-7, 0, 7]) {
      ctx.moveTo(lx, -5);
      ctx.lineTo(lx + (lx === 0 ? -step : step), 0);
    }
    ctx.stroke();
    ctx.fillStyle = BARN_DEEP;
    ctx.beginPath();
    ctx.ellipse(0, -10, size.half, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(size.half - 3, -9, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(size.half - 1, -11, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -18);
    ctx.lineTo(-2, -3);
    ctx.stroke();
  } else {
    // A wasp: striped, with wings that blur.
    const flap = Math.sin(tick * 1.4) * 0.5;
    ctx.fillStyle = "rgba(255,246,227,0.7)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 3, -size.height - 3, 4, 8, side * (0.5 + flap), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = STRAW;
    ctx.beginPath();
    ctx.ellipse(0, -size.height / 2, size.half, size.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    for (const sx of [-5, 1]) ctx.fillRect(sx, -size.height + 1.5, 3, size.height - 3);
    ctx.beginPath();
    ctx.arc(-size.half + 2, -size.height / 2 - 1, 2, 0, Math.PI * 2);
    ctx.fill();
    // The sting.
    ctx.beginPath();
    ctx.moveTo(size.half - 1, -size.height / 2 - 2);
    ctx.lineTo(size.half + 6, -size.height / 2);
    ctx.lineTo(size.half - 1, -size.height / 2 + 2);
    ctx.fill();
  }
  ctx.restore();
}

function heart(ctx: Ctx, x: number, y: number, full: boolean) {
  ctx.fillStyle = full ? BARN : "rgba(43,26,18,0.55)";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.bezierCurveTo(x - 12, y - 3, x - 5, y - 11, x, y - 4);
  ctx.bezierCurveTo(x + 5, y - 11, x + 12, y - 3, x, y + 6);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function cob(ctx: Ctx, x: number, y: number, size: number) {
  ctx.fillStyle = LEAF;
  ctx.beginPath();
  ctx.ellipse(x - size * 0.3, y + size * 0.35, size * 0.5, size * 0.28, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STRAW;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.42, size * 0.7, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Where the view should sit: the hero a little left of centre, so there is more to see ahead. */
export const trailCamera = (t: Trail, viewW: number) => Math.max(0, Math.min(t.level.length - viewW, t.x - viewW * 0.38));

/** Draws one frame of the trail. `puppets` is a training match between the hero and the opponent, used only for posing them. */
export function drawTrail(ctx: Ctx, t: Trail, stage: StageLayers, v: TrailView, puppets: Match) {
  ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
  const target = trailCamera(t, v.w);
  v.camX += (target - v.camX) * 0.2;
  if (Math.abs(target - v.camX) < 0.05) v.camX = target;
  const { level } = t;
  // The arena drifts by slowly behind, as far-off things do.
  drawStage(ctx, stage, (v.camX / Math.max(1, level.length - v.w)) * 260, v.w, t.tick, 0);

  ctx.save();
  ctx.translate(-v.camX, GROUND_Y);
  const left = v.camX - 40;
  const right = v.camX + v.w + 40;
  const deep = VIEW_H - GROUND_Y;
  ctx.fillStyle = PIT;
  ctx.fillRect(left, 0, right - left, deep);
  for (const [a, b] of level.ground) {
    if (b < left || a > right) continue;
    ctx.fillStyle = EARTH;
    ctx.fillRect(a, 0, b - a, deep);
    ctx.fillStyle = STRAW_DEEP;
    ctx.fillRect(a, 0, b - a, 6);
    ctx.fillStyle = "rgba(29,15,8,0.35)";
    ctx.fillRect(a, 6, b - a, 3);
  }
  for (const l of level.ledges) {
    if (l.x1 < left || l.x0 > right) continue;
    ctx.fillStyle = "rgba(29,15,8,0.3)";
    ctx.fillRect(l.x0 + 4, -l.y + 9, l.x1 - l.x0 - 8, 4);
    ctx.fillStyle = WOOD;
    ctx.fillRect(l.x0, -l.y, l.x1 - l.x0, 9);
    ctx.fillStyle = STRAW;
    ctx.fillRect(l.x0, -l.y, l.x1 - l.x0, 3);
  }
  for (const c of level.corn) {
    if (c.got || c.x < left || c.x > right) continue;
    cob(ctx, c.x, -c.y - Math.sin(t.tick * 0.08 + c.x * 0.05) * 2.5, 13);
  }
  for (const c of level.critters) if (c.gone < 18 && c.x > left && c.x < right) critter(ctx, c, t.tick);

  // The opponent, waiting at the far end.
  const [hero, rival] = puppets.f;
  if (level.goal > left && level.goal < right) {
    rival.x = level.goal;
    ctx.save();
    ctx.translate(level.goal, 0);
    ctx.scale(-1, 1);
    drawChicken(ctx, rival.def, poseOf(rival, puppets));
    ctx.restore();
  }

  // A knocked hero blinks (or, with less flashing, fades) while they cannot be hurt again.
  const blink = t.hurt > 0 && t.hurt <= 62;
  if (!(blink && !v.calm && t.tick % 6 < 3)) {
    const p = pose(t, hero, puppets);
    ctx.save();
    ctx.translate(t.x, -t.y);
    ctx.scale(t.facing, 1);
    if (blink && v.calm) ctx.globalAlpha = 0.55;
    drawChicken(ctx, t.def, p, v.alt ? altPalette(t.def) : undefined);
    ctx.restore();
  }
  ctx.restore();

  // Hearts, corn, and how far there is to go.
  for (let i = 0; i < HEARTS; i++) heart(ctx, 24 + i * 26, 26, i < t.hearts);
  cob(ctx, 22, 52, 12);
  text(ctx, `${t.corn} of ${level.corn.length}`, 36, 57, 13, CREAM, "left", 600, 1);
  const barW = Math.min(220, v.w * 0.34);
  const bx = v.w - barW - 22;
  ctx.fillStyle = "rgba(43,26,18,0.6)";
  ctx.beginPath();
  ctx.roundRect(bx, 22, barW, 8, 4);
  ctx.fill();
  const along = Math.max(0, Math.min(1, t.x / level.goal));
  ctx.fillStyle = STRAW;
  ctx.beginPath();
  ctx.roundRect(bx, 22, Math.max(8, barW * along), 8, 4);
  ctx.fill();
  text(ctx, rival.def.name, v.w - 22, 48, 13, CREAM, "right", 600, 1);
}
