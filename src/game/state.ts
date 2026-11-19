import { type Fighter, type FighterState, MAX_METER, type Match, type Move, type Phase, STAGE_W, TPS, WALL } from "./types";

// Small building blocks shared by the rest of the engine: constants, state changes, starting a move, and cues for the renderer.

/** A button press is remembered this long, so pressing a hair early still counts. */
export const BUFFER = 7;

export const HITSTOP = [5, 8, 11] as const;

/** Damage taken in quick succession before a fighter is knocked dizzy. */
export const DAZE_LIMIT = 380;

export const DIZZY_TICKS = 110;
/** A block made within this many ticks of raising the guard is perfect. */
export const PERFECT_WINDOW = 7;
/** What a charged special costs. */
export const EX_COST = 50;

export const THROW: Move = {
  id: "throw", name: "Throw", kind: "throw", pose: "throw",
  startup: 10, active: 0, recovery: 22, damage: 120, hitstun: 0, blockstun: 0, push: 0, level: "mid", box: null,
};

export const MAX_X = STAGE_W - WALL;

export const clampX = (f: Fighter) => (f.x = Math.max(WALL, Math.min(MAX_X, f.x)));

export function setStateOnce(f: Fighter, s: FighterState) {
  if (f.state !== s) setState(f, s);
}

export function setState(f: Fighter, s: FighterState) {
  f.state = s;
  f.stateT = 0;
}

/** Back on your feet and in control: the combo against you is over. */
export function recover(f: Fighter) {
  setState(f, "idle");
  f.rollDir = 0;
  f.comboTaken = 0;
  f.juggle = 0;
}

export function toPhase(f: Fighter, phase: Phase) {
  f.phase = phase;
  f.phaseT = 0;
}

export function finish(f: Fighter) {
  f.move = null;
  recover(f);
}

export function begin(m: Match, f: Fighter, mv: Move) {
  if (mv.kind === "super") {
    f.meter = 0;
    m.superFlash = { t: 44, side: f.side, name: mv.name };
    m.events.push({ type: "super", side: f.side });
  } else {
    if (mv.charged) {
      f.meter -= EX_COST;
      fx(m, "ring", f.x, f.y + f.def.height * 0.5, { size: 30, life: 14 });
    } else if (mv.kind === "special") f.meter = Math.min(MAX_METER, f.meter + (f.hp < f.def.hp * 0.25 ? 3 : 2));
    m.events.push({ type: "swing", heavy: mv.id !== "sLight" && mv.id !== "cLight" && mv.id !== "jLight" });
  }
  f.buf = { light: 0, heavy: 0, special: 0, sup: 0 };
  setState(f, "attack");
  if (mv.air) f.airUsed = true;
  else if (f.y === 0) f.vx = 0;
  f.move = mv;
  f.phase = "startup";
  f.phaseT = 0;
  f.moveT = 0;
  f.moveSerial++;
  f.connected = false;
  f.hitsDone = 0;
  f.lastHitT = -999;
  if (mv.invuln) f.invuln = Math.max(f.invuln, mv.invuln);
}

export function takeDamage(m: Match, f: Fighter, amount: number) {
  f.hp = Math.max(m.rules.knockouts ? 0 : 1, f.hp - amount);
  f.calm = 0;
  f.flash = 6;
}

/** Seconds left on the round clock, as shown on screen. */
export function clock(m: Match): number {
  return Math.max(0, Math.ceil(m.timer / TPS));
}

// The engine does not draw anything. When something worth showing happens it says so, and the renderer decides what that looks like.

/** A flash where something was blocked, fizzled or burst. */
export function fx(m: Match, kind: "guard" | "ring" | "splat", x: number, y: number, o: { size: number; life: number }) {
  m.events.push({ type: "fx", kind, x, y, size: o.size, life: o.life });
}

/** Feathers knocked loose from `f`. */
export function feathers(m: Match, x: number, y: number, f: Fighter, n: number) {
  m.events.push({ type: "fx", kind: "feathers", x, y, side: f.side, n });
}

/** Dust kicked up off the floor. */
export function dust(m: Match, x: number, n: number, spread = 1) {
  m.events.push({ type: "fx", kind: "dust", x, y: 0, n, spread });
}

/** The burst where a hit lands. */
export function impact(m: Match, x: number, y: number, power: 0 | 1 | 2) {
  m.events.push({ type: "fx", kind: "impact", x, y, power });
}
