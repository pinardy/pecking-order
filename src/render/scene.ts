import { MAX_METER, STAGE_W, clock, debugBoxes, type Fighter, type Match, type Shot, fighterById } from "../game";
import { burst, type Particles } from "./particles";
import { text } from "./text";
import { altPalette, drawChicken, flashPalette, REST } from "./chicken";
import { poseOf } from "./pose";
import { GROUND_Y, VIEW_H, drawStage, type StageLayers } from "./stage";
import { BARN, CARROT, CREAM, CREAM_DEEP, INK, LEAF, STRAW, STRAW_DEEP } from "../palette";

type Ctx = CanvasRenderingContext2D;


export interface View {
  /** Logical width of the view; the height is always VIEW_H. */
  w: number;
  /** Device pixels per logical unit. */
  scale: number;
  camX: number;
  /** Tags shown beside each fighter's name, such as "You" and "CPU". */
  labels: [string, string];
  reducedMotion: boolean;
  /** Draw hurt and hit boxes (training). */
  debug?: boolean;
  /** Show player 1's running score under the clock. */
  score?: boolean;
  /** The score as last formatted, so it is not formatted again every frame. */
  scoreSeen?: number;
  scoreText?: string;
  /** A word under the clock, such as "Replay". */
  tag?: string;
  /** Which sides wear their alternate feathers. */
  alts?: [boolean, boolean];
  /** Scale for the names, tags and counters, so they stay readable on a small screen. */
  hud?: number;
  /** Tone down flashing: no white hit flash, no knockout flash, nothing blinking. */
  calm?: boolean;
  /** Frame timing, shown in a corner when asked for. */
  perf?: string;
  /** Recent inputs, newest first (training). */
  inputs?: string[];
}

export function cameraTarget(m: Match, w: number): number {
  return Math.max(0, Math.min(STAGE_W - w, (m.f[0].x + m.f[1].x) / 2 - w / 2));
}


const GRIT = [[0, 0, 0.4], [-0.7, 0.25, 0.3], [-0.4, -0.45, 0.28], [-1.2, -0.1, 0.24], [-1.6, 0.3, 0.2]];
/** The puffs of a sneeze cloud (x, y, radius, as shares of the shot's size), and the peppercorns in it. */
const PUFF = [[0, 0, 0.75], [-0.55, 0.3, 0.55], [0.5, -0.25, 0.55], [-0.35, -0.45, 0.5], [0.4, 0.4, 0.45]];
const CORNS = [[0.1, 0.05], [-0.5, 0.3], [0.45, -0.3], [-0.3, -0.4], [0.35, 0.42], [-0.1, 0.55]];
/** The training overlay: each kind of box, its fill and outline, and what the key calls it. Drawn in this order. */
const BOX_COLOURS = [
  ["hurt", "rgba(80,150,255,0.22)", "rgba(120,180,255,0.9)", "Can be hit"],
  ["safe", "rgba(200,200,210,0.08)", "rgba(215,215,225,0.6)", "Cannot be hit"],
  ["attack", "rgba(255,70,50,0.35)", "rgba(255,110,90,0.95)", "Attack"],
  ["grab", "rgba(190,90,255,0.3)", "rgba(215,150,255,0.95)", "Throw reach"],
  ["shots", "rgba(255,210,60,0.35)", "rgba(255,225,120,0.95)", "Shot"],
] as const;
const FRONT_FIRST = [1, 0];
const BACK_FIRST = [0, 1];


function pill(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  if (w <= 0) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(h / 2, w / 2));
  ctx.fill();
}

// ---------------------------------------------------------------- world

export function drawShot(ctx: Ctx, s: Shot, tick: number) {
  if (s.delay > 0) return;
  const dir = s.vx >= 0 ? 1 : -1;
  const z = s.spec.size;
  ctx.save();
  ctx.translate(s.x, -s.y);
  ctx.scale(dir, 1);
  switch (s.spec.kind) {
    case "assist": {
      // A tag partner charging across: the bird itself, low and fast, with a puff of dust behind.
      const def = fighterById(s.spec.assist ?? "henrietta");
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = CREAM;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(-k * 16 - (tick % 4), -6, 7 - k, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.translate(0, s.y);
      drawChicken(ctx, def, { ...REST, rot: 0.35, bx: 4, wing: 1.6 + Math.sin(tick * 0.9) * 0.6, wingExt: 1.3, f1y: Math.abs(Math.sin(tick * 0.6)) * 9, f2y: Math.abs(Math.cos(tick * 0.6)) * 9, beak: 0.5, eye: "angry" });
      break;
    }
    case "crow":
    case "cheep": {
      // Sound, drawn as a stack of arcs opening forwards.
      const arcs = s.spec.kind === "cheep" ? 2 : s.big ? 4 : 3;
      const fade = s.spec.life ? Math.min(1, s.life / 8) : 1;
      ctx.lineCap = "round";
      for (let i = 0; i < arcs; i++) {
        const r = z * (0.45 + i * 0.32) * (1 + Math.sin(tick * 0.6 + i) * 0.06);
        ctx.globalAlpha = fade * (1 - i * 0.16);
        ctx.strokeStyle = i % 2 === 0 ? STRAW : CREAM;
        ctx.lineWidth = Math.max(2.5, z * 0.2);
        ctx.beginPath();
        ctx.arc(-z * 0.6 + i * z * 0.22, 0, r, -0.95, 0.95);
        ctx.stroke();
      }
      break;
    }
    case "egg":
      ctx.rotate(s.age * 0.3);
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.ellipse(0, 0, z * 0.62, z * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREAM_DEEP;
      ctx.beginPath();
      ctx.ellipse(z * 0.1, z * 0.3, z * 0.4, z * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "grit":
      for (const [gx, gy, gr] of GRIT) {
        ctx.fillStyle = gr > 0.28 ? STRAW_DEEP : "#96701f";
        ctx.beginPath();
        ctx.arc(gx * z + Math.sin(tick * 0.8 + gx * 9) * 1.5, gy * z, gr * z, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "pepper": {
      // A sneeze: a drifting puff with peppercorns tumbling in it, thinning out as it goes.
      const fade = Math.min(1, s.life / 12);
      for (const [px, py, pr] of PUFF) {
        ctx.globalAlpha = fade * 0.5;
        ctx.fillStyle = s.big ? CARROT : CREAM_DEEP;
        ctx.beginPath();
        ctx.arc(px * z + Math.sin(tick * 0.25 + px * 7) * 1.5, py * z + Math.cos(tick * 0.2 + py * 5) * 1.5, pr * z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = fade;
      ctx.fillStyle = INK;
      for (const [gx, gy] of CORNS) {
        const a = tick * 0.3 + gx * 9;
        ctx.beginPath();
        ctx.arc(gx * z + Math.cos(a) * 2, gy * z + Math.sin(a) * 2, Math.max(1.5, z * 0.07), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "quill":
      // A feather dart, point first.
      ctx.fillStyle = BARN;
      ctx.beginPath();
      ctx.moveTo(z * 1.1, 0);
      ctx.quadraticCurveTo(0, -z * 0.45, -z * 1.1, 0);
      ctx.quadraticCurveTo(0, z * 0.45, z * 1.1, 0);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.fillRect(-z * 1.5, -1, z * 2.4, 2);
      break;
    case "shard":
      // A planted mine lies still and glints.
      if (!s.planted) ctx.rotate(s.age * 0.45);
      else if (tick % 50 < 8) {
        ctx.strokeStyle = STRAW;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, z * (0.9 + (tick % 50) * 0.12), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.moveTo(z, 0);
      ctx.lineTo(-z * 0.6, -z * 0.7);
      ctx.lineTo(-z * 0.2, 0);
      ctx.lineTo(-z * 0.7, z * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** The bonus round target. It loses its hat, an arm and its head as it is pecked apart. */
function drawScarecrow(ctx: Ctx, f: Fighter, m: Match, calm: boolean) {
  const left = f.hp / f.def.hp;
  ctx.save();
  ctx.translate(f.x, 0);
  if (left <= 0) {
    ctx.fillStyle = "#5a3421";
    ctx.fillRect(-3, -30, 6, 30);
    ctx.fillStyle = "#8f3a2c";
    ctx.beginPath();
    ctx.ellipse(8, -6, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c9a25a";
    ctx.beginPath();
    ctx.ellipse(-16, -4, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(f.state === "hit" ? Math.sin(m.tick * 1.3) * 0.012 * f.stun : 0);
  ctx.fillStyle = "#5a3421";
  ctx.fillRect(-3, -118, 6, 118);
  ctx.fillRect(left < 0.5 ? -6 : -36, -90, left < 0.5 ? 42 : 72, 5);
  ctx.fillStyle = !calm && f.flash > 3 ? "#d98a7a" : "#8f3a2c";
  ctx.beginPath();
  ctx.moveTo(left < 0.5 ? -14 : -32, -92);
  ctx.lineTo(32, -92);
  ctx.lineTo(17, -38);
  ctx.lineTo(-17, -38);
  ctx.closePath();
  ctx.fill();
  // Straw cuffs.
  ctx.fillStyle = "#c9a25a";
  ctx.fillRect(30, -94, 8, 12);
  if (left >= 0.5) ctx.fillRect(-38, -94, 8, 12);
  if (left >= 0.25) {
    ctx.fillStyle = "#d8b77a";
    ctx.beginPath();
    ctx.arc(0, -106, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(-6, -110, 3, 3);
    ctx.fillRect(3, -110, 3, 3);
    ctx.fillRect(-5, -102, 10, 1.5);
    if (left >= 0.75) {
      ctx.fillStyle = "#3f2316";
      ctx.beginPath();
      ctx.moveTo(-21, -115);
      ctx.lineTo(21, -115);
      ctx.lineTo(9, -117);
      ctx.lineTo(6, -133);
      ctx.lineTo(-6, -133);
      ctx.lineTo(-9, -117);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawFighter(ctx: Ctx, f: Fighter, m: Match, calm: boolean, alt: boolean) {
  if (f.def.prop) return drawScarecrow(ctx, f, m, calm);
  ctx.save();
  // A struck fighter rattles in place while the hit freezes the action.
  const rattle = m.hitstop > 0 && (f.state === "hit" || f.state === "launched") ? Math.sin(m.tick * 2.4) * 1.6 : 0;
  ctx.translate(f.x + rattle, -f.y);
  ctx.scale(f.facing, 1);
  if (f.state === "attack" && f.move?.charged) {
    // A charged special glows.
    ctx.fillStyle = "rgba(240,194,79,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, -f.def.height * 0.5, f.def.width * 0.95 + Math.sin(m.tick * 0.7) * 3, f.def.height * 0.64, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawChicken(ctx, f.def, poseOf(f, m), !calm && f.flash > 3 ? flashPalette(f.def) : alt ? altPalette(f.def) : undefined);
  ctx.restore();
  if (f.state === "dizzy") {
    // Stars going round the head.
    ctx.fillStyle = STRAW;
    for (let i = 0; i < 3; i++) {
      const a = m.tick * 0.16 + i * 2.09;
      ctx.save();
      ctx.translate(f.x + Math.cos(a) * 15, -f.def.height - 8 + Math.sin(a) * 4);
      ctx.rotate(a);
      burst(ctx, 4, 5, 2);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- HUD

function drawHud(ctx: Ctx, m: Match, v: View) {
  const k = v.hud ?? 1;
  const pad = 12;
  const mid = v.w / 2;
  const barW = mid - pad - 26;
  const barY = 14;
  const barH = 13;
  const nameY = barY + barH + 5 + 13 * k;
  const meterY = nameY + 9;
  // With flashing turned down, things that would blink hold their alert colour instead.
  const blink = (period: number) => !!v.calm || m.tick % period < period / 2;
  m.f.forEach((f, i) => {
    const left = i === 0;
    const x0 = left ? pad : mid + 26;
    pill(ctx, x0 - 2, barY - 2, barW + 4, barH + 4, "rgba(43,26,18,0.82)");
    // Health hugs the middle of the screen and empties towards the outside.
    const ghost = (f.hpGhost / f.def.hp) * barW;
    const hp = (f.hp / f.def.hp) * barW;
    const lowHp = f.hp / f.def.hp < 0.25;
    const fillX = left ? x0 + barW - hp : x0;
    pill(ctx, left ? x0 + barW - ghost : x0, barY, ghost, barH, BARN);
    pill(ctx, fillX, barY, hp, barH, lowHp && blink(20) ? "#e8713a" : STRAW);
    if (lowHp && hp > 0) {
      // Low health is not left to colour alone: the bar is striped and says so.
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(fillX, barY, hp, barH, Math.min(barH / 2, hp / 2));
      ctx.clip();
      ctx.strokeStyle = "rgba(43,26,18,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = fillX - barH; x < fillX + hp; x += 6) {
        ctx.moveTo(x, barY + barH);
        ctx.lineTo(x + barH, barY);
      }
      ctx.stroke();
      ctx.restore();
      text(ctx, "Low", left ? x0 + 6 : x0 + barW - 6, barY + barH - 3, 10, CREAM, left ? "left" : "right", 700, 0);
    }
    // Guard, shown only while it is worn down.
    if (f.guard < 100) {
      const g = (f.guard / 100) * barW;
      pill(ctx, left ? x0 + barW - g : x0, barY + barH + 3, g, 2.5, f.guard < 35 ? "#e8713a" : "#cfe6f0");
    }

    const outer = left ? pad : v.w - pad;
    const align: CanvasTextAlign = left ? "left" : "right";
    // A boss that has got serious has its name in red.
    text(ctx, f.def.name, outer, nameY, 15 * k, f.enraged ? "#ff8a6a" : CREAM, align, 600, 1.5);
    const nameW = ctx.measureText(f.def.name).width;
    const tag = v.labels[i];
    if (tag) text(ctx, tag, outer + (left ? nameW + 7 : -nameW - 7), nameY, 11 * k, STRAW, align, 600, 1);

    // Rounds won, as eggs.
    for (let r = 0; r < m.rules.rounds && !m.rules.refill; r++) {
      const ex = left ? x0 + barW - 7 - r * 15 : x0 + 7 + r * 15;
      ctx.fillStyle = r < f.wins ? CREAM : "rgba(43,26,18,0.6)";
      ctx.beginPath();
      ctx.ellipse(ex, barY + barH + 12, 4.6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crow meter.
    const mw = Math.min(110, barW * 0.6);
    const mx = left ? pad : v.w - pad - mw;
    const full = f.meter >= MAX_METER;
    pill(ctx, mx - 1.5, meterY - 1.5, mw + 3, 9, "rgba(43,26,18,0.82)");
    const fill = (f.meter / MAX_METER) * mw;
    pill(ctx, left ? mx : mx + mw - fill, meterY, fill, 6, full ? (blink(16) ? STRAW : CREAM) : f.meter >= MAX_METER / 2 ? "#58b98f" : LEAF);
    // Tag team: the partner on the bench, with a little health bar of their own, dimmed while they cannot come in yet.
    const benched = m.bench?.[i];
    if (benched) {
      const by = meterY + 13;
      const bw = Math.min(70, barW * 0.4);
      const bx = left ? pad : v.w - pad - bw;
      const share = Math.max(0, benched.hp / benched.def.hp);
      const ready = (m.tagReady?.[i] ?? 0) === 0 && benched.hp > 0;
      ctx.globalAlpha = ready ? 1 : 0.5;
      pill(ctx, bx - 1, by - 1, bw + 2, 6, "rgba(43,26,18,0.82)");
      pill(ctx, left ? bx : bx + bw - bw * share, by, bw * share, 4, benched.hp > 0 ? CREAM : BARN);
      text(ctx, benched.hp > 0 ? `Tag: ${benched.def.name}` : `${benched.def.name} is out`, left ? bx + bw + 6 : bx - 6, by + 5, 10 * k, ready ? STRAW : CREAM, left ? "left" : "right", 600, 1);
      ctx.globalAlpha = 1;
    }
    // Half a meter buys a charged special: a notch marks the spot.
    ctx.fillStyle = "rgba(43,26,18,0.7)";
    ctx.fillRect(mx + mw / 2 - 0.75, meterY, 1.5, 6);
    if (full) text(ctx, "Crow ready", left ? mx + mw + 7 : mx - 7, meterY + 7, 11 * k, blink(16) ? STRAW : CREAM, align, 600, 1);

    if (f.combo >= 2) {
      const pop = 1 + Math.max(0, f.comboT - 68) * 0.05;
      ctx.save();
      ctx.translate(left ? pad + 6 : v.w - pad - 6, meterY + 50);
      ctx.scale(pop, pop);
      text(ctx, `${f.combo} hits`, 0, 0, 20 * k, STRAW, align, 700, 2);
      ctx.restore();
    }
  });

  // Round clock.
  ctx.fillStyle = "rgba(43,26,18,0.9)";
  ctx.beginPath();
  ctx.arc(mid, barY + 8, 21, 0, Math.PI * 2);
  ctx.fill();
  const secs = clock(m);
  text(ctx, m.rules.seconds === null ? "∞" : String(secs), mid, barY + 16, 21, m.rules.seconds !== null && secs <= 10 ? "#e8713a" : CREAM, "center", 700, 0);
  if (v.score && m.f[0].score !== v.scoreSeen) {
    v.scoreSeen = m.f[0].score;
    v.scoreText = v.scoreSeen.toLocaleString("en");
  }
  if (v.score) text(ctx, v.scoreText ?? "", mid, barY + 46, 12 * k, CREAM, "center", 600, 1);
  if (v.tag) text(ctx, v.tag, mid, barY + (v.score ? 46 + 15 * k : 46), 12 * k, STRAW, "center", 600, 1);
}

function drawBanner(ctx: Ctx, m: Match, v: View) {
  const b = m.banner;
  if (!b) return;
  const pop = v.reducedMotion ? 1 : 1 + (1 - Math.min(1, b.t / 7)) ** 2 * 0.9;
  const alpha = Math.min(1, b.t / 4, (b.life - b.t) / 10);
  const size = Math.min(52, (v.w * 1.5) / Math.max(6, b.text.length));
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(v.w / 2, 158);
  ctx.scale(pop, pop);
  text(ctx, b.text, 0, 0, size, STRAW, "center", 700, 4);
  if (b.sub) text(ctx, b.sub, 0, 26, 16, CREAM, "center", 600, 2);
  ctx.restore();
}

/** Draws one frame of the match. */
export function drawMatch(ctx: Ctx, m: Match, stage: StageLayers, v: View, particles: Particles) {
  ctx.setTransform(v.scale, 0, 0, v.scale, 0, 0);
  const target = cameraTarget(m, v.w);
  v.camX += (target - v.camX) * 0.18;
  if (Math.abs(target - v.camX) < 0.05) v.camX = target;
  const shake = v.reducedMotion ? 0 : m.shake * 0.55;
  const shakeX = Math.sin(m.tick * 1.9) * shake;
  const shakeY = Math.cos(m.tick * 2.7) * shake;

  ctx.save();
  ctx.translate(0, shakeY);
  const excite = v.reducedMotion ? 0 : m.phase === "roundEnd" || m.phase === "matchEnd" ? 0.6 : Math.min(1, m.shake / 5);
  drawStage(ctx, stage, v.camX + shakeX, v.w, m.tick, excite);
  ctx.restore();

  const flash = m.superFlash;
  if (flash) {
    // The world dims and rays fan out behind whoever called the super.
    ctx.fillStyle = "rgba(30,14,6,0.62)";
    ctx.fillRect(0, 0, v.w, VIEW_H);
    const f = m.f[flash.side];
    ctx.save();
    ctx.translate(f.x - v.camX, GROUND_Y - f.y - f.def.height * 0.5);
    ctx.rotate(m.tick * 0.04);
    ctx.fillStyle = v.calm ? "rgba(240,194,79,0.12)" : "rgba(240,194,79,0.3)";
    for (let i = 0; i < 10; i++) {
      ctx.rotate((Math.PI * 2) / 10);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(420, -34);
      ctx.lineTo(420, 34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-v.camX + shakeX, GROUND_Y + shakeY);
  for (const f of m.f) {
    const lift = Math.min(1, f.y / 220);
    ctx.fillStyle = "rgba(30,14,6,0.3)";
    ctx.beginPath();
    ctx.ellipse(f.x, 2, f.def.width * 0.55 * (1 - lift * 0.5), 5 * (1 - lift * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  particles.draw(ctx, "floor");
  for (const it of m.items) {
    ctx.save();
    ctx.translate(it.x, -it.y - 8);
    if (it.kind === "corn") {
      ctx.rotate(0.5);
      ctx.fillStyle = LEAF;
      ctx.beginPath();
      ctx.ellipse(-3, 3, 5, 10, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = STRAW;
      ctx.beginPath();
      ctx.ellipse(0, 0, 5.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#e59a9a";
      ctx.lineWidth = 4.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9, 4);
      ctx.quadraticCurveTo(-4, -6 + Math.sin(m.tick * 0.3) * 3, 1, 3);
      ctx.quadraticCurveTo(5, 8, 10, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Whoever is attacking is drawn in front.
  const order = m.f[0].state === "attack" && m.f[1].state !== "attack" ? FRONT_FIRST : BACK_FIRST;
  // Alternate feathers where they were chosen; in a mirror match the two never look the same.
  const alt = [!!v.alts?.[0], !!v.alts?.[1]];
  if (m.f[0].def.id === m.f[1].def.id && alt[0] === alt[1]) alt[1] = !alt[1];
  for (const i of order) drawFighter(ctx, m.f[i], m, !!v.calm, alt[i]);
  for (const s of m.shots) drawShot(ctx, s, m.tick);
  particles.draw(ctx, "air");
  if (v.debug) {
    const boxes = debugBoxes(m);
    const draw = (list: typeof boxes.hurt, fill: string, stroke: string) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      for (const b of list) {
        ctx.fillRect(b.l, -b.t, b.r - b.l, b.t - b.b);
        ctx.strokeRect(b.l, -b.t, b.r - b.l, b.t - b.b);
      }
    };
    for (const [kind, fill, stroke] of BOX_COLOURS) draw(boxes[kind], fill, stroke);
  }
  ctx.restore();

  if (m.phase === "ko" && m.phaseT < 5 && !v.calm) {
    ctx.fillStyle = `rgba(255,246,227,${0.5 - m.phaseT * 0.1})`;
    ctx.fillRect(0, 0, v.w, VIEW_H);
  }

  drawHud(ctx, m, v);
  drawBanner(ctx, m, v);
  if (flash) {
    const inT = Math.min(1, (44 - flash.t) / 6);
    const size = Math.min(34, (v.w * 1.5) / flash.name.length);
    ctx.save();
    ctx.globalAlpha = inT;
    text(ctx, flash.name, v.w / 2 + (1 - inT) * (flash.side === 0 ? -60 : 60), 236, size, STRAW, "center", 700, 3);
    ctx.restore();
  }
  if (v.inputs) {
    for (let i = 0; i < v.inputs.length; i++) text(ctx, v.inputs[i], 14, 126 + i * 14, 12, i === 0 ? CREAM : "rgba(255,246,227,0.6)", "left", 600, 1);
  }
  if (v.debug) {
    // What the colours mean, down the right-hand edge (the input display has the left).
    BOX_COLOURS.forEach(([, fill, stroke, label], i) => {
      const y = 126 + i * 15;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(v.w - 24, y - 9, 10, 10);
      ctx.strokeRect(v.w - 24, y - 9, 10, 10);
      text(ctx, label, v.w - 30, y, 10, CREAM, "right", 600, 1);
    });
  }
  if (v.perf) text(ctx, v.perf, 8, VIEW_H - 8, 10, CREAM, "left", 600, 1);
}
