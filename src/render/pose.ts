import type { Fighter, FighterDef, Match, Move } from "../game";
import { REST, RIGS, mixPose, type Pose, type Rig } from "./chicken";

// There are no sprite sheets. Every frame, the fighter's state is turned into a pose:
// a handful of offsets for the body, head, wing and feet. Attacks aim the beak or the
// foot at the far edge of the move's hit box, so what you see is what can hit you.

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Moves the head so the beak tip lands on (tx, ty), measured from the feet. */
function headTo(r: Rig, p: Pose, tx: number, ty: number) {
  const dx = tx - p.bx;
  const dy = -ty + (r.hipY + p.by);
  const cos = Math.cos(-p.rot);
  const sin = Math.sin(-p.rot);
  const ux = dx * cos - dy * sin;
  const uy = dx * sin + dy * cos;
  const tipX = (0.5 + 0.72 * r.beak) * r.headR;
  const tipY = 0.55 * r.headR;
  p.hx = ux - tipX - r.headX;
  p.hy = -(uy - tipY) - (r.bodyUp + r.headUp);
}

function footTo(r: Rig, p: Pose, front: boolean, tx: number, ty: number) {
  if (front) {
    p.f1x = tx - r.hipDX;
    p.f1y = ty;
  } else {
    p.f2x = tx + r.hipDX;
    p.f2y = ty;
  }
}

function stand(f: Fighter, t: number): Pose {
  const b = Math.sin(t * 0.11 + f.side * 2);
  return { ...REST, by: b * 1.2, hy: -b * 0.7, rot: 0.05, hx: 2, wing: -0.4 + b * 0.06, tail: b * 0.05 };
}

function crouch(r: Rig): Pose {
  return { ...REST, by: -r.hipY * 0.6, sy: 0.93, sx: 1.05, rot: 0.14, hy: -r.headUp * 0.2, hx: 3, wing: -0.5 };
}

function air(f: Fighter, r: Rig, t: number): Pose {
  // A hen holding up is fluttering: the wings go twice as fast.
  const flap = Math.sin(t * (f.def.breed === "hen" && f.inp.y > 0 && f.vy < 0 ? 1.7 : 0.8));
  return {
    ...REST, rot: f.vy > 0 ? -0.08 : 0.1, wing: 1 + flap * 0.55, wingExt: 1.3,
    f1x: 3, f1y: r.leg * 0.38, f2x: -2, f2y: r.leg * 0.5, tail: 0.2,
  };
}

function walk(f: Fighter, r: Rig, t: number): Pose {
  const p = stand(f, t);
  const dir = Math.sign(f.vx) === f.facing ? 1 : -1;
  const ph = f.stateT * 0.3 * dir * (0.6 + f.def.speed * 0.2);
  const stride = r.leg * 0.34;
  p.f1x = Math.sin(ph) * stride;
  p.f1y = Math.max(0, Math.cos(ph)) * r.leg * 0.2;
  p.f2x = -Math.sin(ph) * stride;
  p.f2y = Math.max(0, -Math.cos(ph)) * r.leg * 0.2;
  p.by = Math.abs(Math.sin(ph)) * 1.6;
  // The head leads each step, as a walking chicken's does.
  p.hx = 2 + Math.sin(ph * 2) * 2.6;
  p.rot = 0.08 * dir;
  return p;
}

/** The fully extended frame of a move. */
function strike(f: Fighter, r: Rig, mv: Move, base: Pose, t: number): Pose {
  const p: Pose = { ...base, eye: "angry" };
  const H = f.def.height;
  const b = mv.box ?? { x0: 0, x1: f.def.width, y0: H * 0.4, y1: H * 0.8 };
  const span = b.y1 - b.y0;
  switch (mv.pose) {
    case "uppeck":
      // The launcher: rearing back, then the beak driven up and forward.
      p.rot = -0.25;
      p.by = 6;
      p.f1y = 4;
      p.wing = 1.4;
      p.wingExt = 1.2;
      p.beak = 0.6;
      headTo(r, p, b.x1 - 6, b.y1 - 6);
      break;
    case "peck":
      p.rot = 0.3;
      p.bx = 4;
      p.wing = -0.95;
      p.wingExt = 1.15;
      p.beak = 0.5;
      p.f2x = -5;
      headTo(r, p, b.x1 - 3, b.y0 + span * 0.6);
      break;
    case "kick":
      p.rot = -0.38;
      p.bx = -3;
      p.hx = -2;
      p.wing = 1.3;
      p.wingExt = 1.25;
      p.beak = 0.3;
      footTo(r, p, true, b.x1 - 2, b.y0 + span * 0.55);
      break;
    case "lowpeck":
      p.rot = 0.5;
      p.bx = 3;
      p.beak = 0.5;
      p.wing = -0.9;
      headTo(r, p, b.x1 - 3, Math.max(10, b.y0 + span * 0.5));
      break;
    case "sweep":
      p.rot = -0.42;
      p.bx = -4;
      p.wing = 0.9;
      p.wingExt = 1.2;
      footTo(r, p, true, b.x1 - 3, 3);
      break;
    case "airpeck":
      p.rot = 0.7;
      p.beak = 0.5;
      p.wing = 0.2;
      p.wingExt = 1.3;
      headTo(r, p, b.x1 - 4, b.y0 + span * 0.35);
      break;
    case "airkick":
      p.rot = -0.5;
      p.wing = 1.7;
      p.wingExt = 1.35;
      p.beak = 0.3;
      footTo(r, p, true, b.x1 - 3, b.y0 + span * 0.3);
      footTo(r, p, false, b.x1 - 14, b.y0 + span * 0.12);
      break;
    case "cast": {
      const voice = mv.shot?.kind === "crow" || mv.shot?.kind === "cheep" || mv.shot?.kind === "grit";
      if (voice) {
        // Chest out, beak wide.
        p.rot = mv.shot?.kind === "grit" ? 0.5 : 0.2;
        p.hx = 9;
        p.hy = mv.shot?.kind === "grit" ? -r.headUp * 0.5 : 3;
        p.beak = 1;
        p.wing = -1;
        p.wingExt = 1.25;
        p.sy = 1.04;
      } else {
        // Overarm throw.
        p.rot = 0.22;
        p.wing = 2.8;
        p.wingExt = 1.4;
        p.beak = 0.3;
        p.hx = 3;
      }
      break;
    }
    case "dash": {
      const ph = f.moveT * 0.9;
      p.rot = 0.72;
      p.bx = 6;
      p.hx = 5;
      p.hy = -5;
      p.wing = -0.15;
      p.wingExt = 1.45;
      p.beak = 0.25;
      p.f1x = Math.sin(ph) * r.leg * 0.45;
      p.f1y = Math.max(0, Math.cos(ph)) * r.leg * 0.3;
      p.f2x = -Math.sin(ph) * r.leg * 0.45;
      p.f2y = Math.max(0, -Math.cos(ph)) * r.leg * 0.3;
      break;
    }
    case "rise":
      p.sy = 1.14;
      p.sx = 0.92;
      p.rot = -0.14;
      p.hy = 7;
      p.hx = -2;
      p.wing = -1;
      p.wingExt = 1.5;
      p.beak = 0.35;
      p.f1y = -3;
      p.f2y = -7;
      p.f2x = -3;
      break;
    case "pound":
      if (f.y > 0 && f.vy > 0) {
        p.wing = 1.5 + Math.sin(t * 1.3) * 0.7;
        p.wingExt = 1.45;
        p.f1y = r.leg * 0.4;
        p.f2y = r.leg * 0.5;
        p.rot = -0.1;
      } else {
        p.rot = -0.38;
        p.sy = 0.9;
        p.sx = 1.1;
        p.wing = 2.1;
        p.wingExt = 1.35;
        p.beak = 0.4;
        p.f1x = 10;
        p.f1y = 4;
        p.f2x = 14;
        p.f2y = 2;
      }
      break;
    case "flurry": {
      // Wing slaps and pecks in alternation.
      const beat = (Math.sin(f.moveT * 1.5) + 1) / 2;
      p.rot = 0.16;
      p.bx = 3;
      p.wing = 1.8 + Math.sin(f.moveT * 1.5 + 2) * 1.1;
      p.wingExt = 1.5;
      p.beak = 0.5;
      headTo(r, p, f.def.width * 0.5 + (b.x1 - f.def.width * 0.5 - 3) * beat, b.y0 + span * 0.6);
      break;
    }
    case "roll":
      p.spin = f.moveT * 0.52;
      p.f1y = r.leg * 0.5;
      p.f2y = r.leg * 0.5;
      p.hy = -4;
      p.wing = -0.3;
      p.eye = "closed";
      break;
    case "throw":
      if (f.moveT < 9) {
        p.rot = 0.36;
        p.beak = 0.8;
        headTo(r, p, f.def.width * 0.5 + 14, H * 0.5);
      } else {
        p.rot = -0.4;
        p.hx = -6;
        p.hy = 5;
        p.beak = 0.3;
        p.wing = 1.4;
      }
      break;
  }
  return p;
}

function attack(f: Fighter, r: Rig, t: number): Pose {
  const mv = f.move!;
  const low = mv.pose === "lowpeck" || mv.pose === "sweep";
  const base = low ? crouch(r) : f.y > 0 ? air(f, r, t) : stand(f, t);
  const full = strike(f, r, mv, base, t);
  if (mv.pose === "throw" || mv.pose === "roll" || mv.pose === "pound") {
    if (f.phase !== "recovery") return full;
    const v = clamp01(f.phaseT / Math.max(1, mv.recovery));
    if (mv.pose === "pound") return mixPose({ ...base, sy: 0.8, sx: 1.16, by: -4 }, base, ease(v));
    if (mv.pose === "roll") return mixPose({ ...full, spin: (full.spin % (Math.PI * 2)) }, { ...base, spin: Math.PI * 2 }, ease(v));
    return mixPose(full, base, ease(clamp01((f.phaseT - 14) / 12)));
  }
  let k: number;
  if (f.phase === "startup") {
    // Wind up the other way for the first part of startup, then snap towards the target.
    const u = clamp01(f.phaseT / Math.max(1, mv.startup));
    k = u < 0.55 ? -0.32 * (u / 0.55) : -0.32 + ((u - 0.55) / 0.45) * 0.9;
  } else if (f.phase === "active") {
    k = 1;
  } else {
    k = 1 - ease(clamp01((f.phaseT / Math.max(1, mv.recovery) - 0.12) / 0.88));
  }
  return mixPose(base, full, k);
}

function lying(f: Fighter, r: Rig, t: number): Pose {
  // Flat on its back, feet in the air.
  const twitch = f.state === "ko" ? Math.sin(t * 0.35) * 2 : 0;
  const hip = r.hipY + (r.rx * 0.85 - (r.hipY + r.bodyUp));
  return {
    ...REST, spin: -Math.PI / 2, by: r.rx * 0.85 - (r.hipY + r.bodyUp),
    f1x: r.leg * 0.85 + twitch, f1y: hip + 3, f2x: r.leg * 0.7 - twitch + r.hipDX, f2y: hip - 3,
    wing: -1.2, wingExt: 1.2, beak: 0.5, eye: f.hp <= 0 ? "ko" : "hurt",
  };
}

/** While the round is called, each fighter has a moment of their own. `u` runs from 0 to 1 across it. */
function intro(id: string, p: Pose, u: number): Pose {
  const arc = Math.sin(u * Math.PI);
  p.eye = "angry";
  switch (id) {
    case "rusty":
    case "oldspur":
      // Throws the head back and crows.
      return { ...p, hrot: -0.5 * arc, hy: p.hy + 6 * arc, rot: p.rot - 0.15 * arc, beak: u > 0.15 && u < 0.85 ? 0.9 : 0 };
    case "duke": {
      // Stamps a foot. Twice.
      const stamp = Math.max(0, Math.sin(u * Math.PI * 4));
      return { ...p, f1y: stamp * 9, by: p.by - (1 - stamp) * arc * 2, wing: p.wing + arc * 0.8, wingExt: 1 + arc * 0.3 };
    }
    case "pip": {
      const hop = Math.abs(Math.sin(u * Math.PI * 3)) * 11 * (1 - u * 0.5);
      return { ...p, by: p.by + hop, f1y: hop, f2y: hop, wing: 1.2 + arc, wingExt: 1.3, beak: 0.6 };
    }
    case "shelly":
      // Comes up out of the shell.
      return { ...p, hy: p.hy - 11 * (1 - ease(clamp01(u * 1.6))), eye: u < 0.5 ? "closed" : "angry" };
    case "dot":
      // Finishes preening first.
      return { ...p, hx: p.hx - 8 * arc, hy: p.hy - 8 * arc, hrot: 0.45 * arc, eye: u < 0.8 ? "closed" : "angry" };
    case "goldie": {
      // Lands, heavily.
      const fall = 1 - ease(clamp01(u * 3));
      const squash = Math.sin(clamp01((u - 0.33) * 3) * Math.PI);
      return { ...p, by: p.by + fall * 26 - squash * 5, f1y: fall * 26, f2y: fall * 26, sy: 1 - squash * 0.14, sx: 1 + squash * 0.12, wing: p.wing + fall * 2, wingExt: 1 + fall * 0.4 };
    }
    case "ziggy":
      return { ...p, hrot: Math.sin(u * Math.PI * 5) * 0.45 * arc, wing: p.wing + arc * 2.8, wingExt: 1 + arc * 0.35, beak: 0.7 * arc };
    default:
      // One flap of the wings.
      return { ...p, wing: p.wing + arc * 2.3, wingExt: 1 + arc * 0.35, beak: u > 0.2 && u < 0.8 ? 0.6 : 0 };
  }
}

/** Wing up in front of the face, feet planted. */
function guard(base: Pose): Pose {
  return { ...base, rot: base.rot - 0.12, bx: -1, hx: -2, wing: 2.4, wingExt: 1.2, eye: "angry" };
}

/** Everyone celebrates in their own way. `t` counts ticks since the win. */
export function winPose(def: FighterDef, t: number): Pose {
  const r = RIGS[def.breed];
  const beat = Math.sin(t * 0.5);
  switch (def.id) {
    case "rusty":
      // Head back, chest out, crowing at the sky.
      return { ...REST, rot: -0.28, hy: 8, hx: -3, hrot: -0.55, beak: 0.7 + beat * 0.3, wing: -0.95, wingExt: 1.3, tail: 0.3, eye: "happy" };
    case "duke":
      // A slow flex. No hopping about.
      return { ...REST, rot: -0.1, wing: 1.35 + Math.sin(t * 0.08) * 0.15, wingExt: 1.55, hy: 2, eye: "angry", tail: 0.15 };
    case "dot":
      // Back to preening, as if nothing happened.
      return { ...REST, by: Math.sin(t * 0.1), hx: -9, hy: -9, hrot: 0.45, wing: 0.5 + beat * 0.08, wingExt: 1.1, eye: "closed" };
    case "pip": {
      const hop = Math.abs(Math.sin(t * 0.3)) * 14;
      return { ...REST, by: hop, f1y: hop, f2y: hop, wing: 1.6 + beat * 0.9, wingExt: 1.4, beak: 0.9, eye: "happy" };
    }
    case "shelly":
      // Ducks down into the shell and pops back out.
      return { ...REST, hy: -9 + Math.abs(Math.sin(t * 0.12)) * 14, wing: 1.2 + beat * 0.4, wingExt: 1.2, beak: 0.5, eye: "happy" };
    case "goldie":
      // Sits down, satisfied.
      return { ...REST, by: -r.hipY * 0.7, sy: 0.95, sx: 1.08, rot: Math.sin(t * 0.08) * 0.05, wing: -0.3, eye: "happy" };
    case "ziggy":
      // Head-banging, one wing in the air.
      return { ...REST, hrot: beat * 0.5, hy: -Math.abs(beat) * 4, hx: 3, wing: 2.5, wingExt: 1.35, beak: 0.7, eye: "angry", tail: 0.2 };
    default: {
      const hop = Math.abs(Math.sin(t * 0.15)) * 9;
      return { ...REST, by: hop, f1y: hop, f2y: hop, rot: -0.14, hy: 4, beak: 0.9, wing: 2 + beat * 0.5, wingExt: 1.4, eye: "happy", tail: 0.2 };
    }
  }
}

/** The pose to draw for a fighter on this tick. */
export function poseOf(f: Fighter, m: Match): Pose {
  const r = RIGS[f.def.breed];
  const t = m.tick;
  switch (f.state) {
    case "idle": {
      if (f.guarding) return guard(stand(f, t));
      const p = stand(f, t);
      if (m.phase === "intro") return intro(f.def.id, p, clamp01((m.phaseT - 8) / 34));
      return p;
    }
    case "walk":
      return walk(f, r, t);
    case "crouch":
      if (f.guarding) return guard(crouch(r));
      return mixPose(stand(f, t), crouch(r), ease(clamp01(f.stateT / 4)));
    case "prejump":
      return mixPose(stand(f, t), crouch(r), 0.7);
    case "air":
      return air(f, r, t);
    case "land":
      return { ...stand(f, t), by: -4, sy: 0.86, sx: 1.1 };
    case "attack":
      return attack(f, r, t);
    case "hit": {
      const base = f.crouchBlock ? crouch(r) : stand(f, t);
      const snap = 1 - ease(clamp01((f.stateT - 4) / 12)) * 0.5;
      return mixPose(base, { ...base, rot: -0.34, bx: -3, hx: -7, hy: -1, beak: 0.8, wing: 0.7, wingExt: 1.15, eye: "hurt", f1x: -3 }, snap);
    }
    case "block": {
      const base = f.crouchBlock ? crouch(r) : stand(f, t);
      return { ...base, rot: base.rot - 0.16, bx: -2, hx: -3, wing: 2.65, wingExt: 1.3, eye: "closed" };
    }
    case "launched":
      return {
        ...REST, spin: -f.stateT * 0.17, f1x: 6, f1y: r.leg * 0.3, f2x: -5, f2y: r.leg * 0.2,
        wing: 1.5, wingExt: 1.3, beak: 0.8, eye: f.hp <= 0 ? "ko" : "hurt",
      };
    case "down":
    case "ko":
      return lying(f, r, t);
    case "getup":
      if (f.rollDir !== 0) {
        // Tucked up and rolling.
        return { ...REST, by: -r.hipY * 0.5, spin: f.stateT * 0.36 * f.rollDir * f.facing, f1y: r.leg * 0.4, f2y: r.leg * 0.4, hy: -4, eye: "closed" };
      }
      return mixPose(lying(f, r, t), stand(f, t), ease(clamp01(f.stateT / 16)));
    case "win":
      return winPose(f.def, f.stateT);
    case "dash": {
      const p = stand(f, t);
      return f.dashDir === f.facing
        ? { ...p, rot: 0.5, bx: 5, hx: 4, wing: -0.2, wingExt: 1.4, f1x: 9, f1y: 3, f2x: -10, f2y: 5, eye: "angry" }
        : { ...p, rot: -0.3, bx: -4, by: 3, wing: 1.2, wingExt: 1.3, f1x: 6, f1y: 5, f2x: -4, f2y: 4 };
    }
    case "grabbed":
      return { ...stand(f, t), rot: 0.2, bx: Math.sin(f.stateT * 2) * 1.5, hx: 6, hy: -4, beak: 0.8, wing: 1.2, wingExt: 1.2, eye: "hurt" };
    case "dizzy": {
      const sway = Math.sin(f.stateT * 0.14);
      return { ...stand(f, t), rot: sway * 0.16, hx: sway * 5, hy: -3, hrot: sway * 0.25, wing: -0.6, beak: 0.4, eye: "ko" };
    }
    case "lose":
      return mixPose(stand(f, t), { ...REST, rot: 0.26, by: -3, hy: -8, hx: 4, wing: -0.7, eye: "closed" }, ease(clamp01(f.stateT / 20)));
  }
}
