import { GRAVITY, type FighterDef, type Input } from "../game";

// The trail: the stretch of yard a story's hero has to cross to reach whoever is next. A side-on run
// and jump over pits and thistles, past beetles and wasps, with the opponent waiting at the far end.
//
// Like the fighting engine it is plain, deterministic TypeScript at 60 ticks a second: no DOM, no
// timers, nothing random once a level is made. It is its own small game and shares none of the
// fighting rules, only the fighters' sizes and the way the stick and buttons are read.

/** A stretch of solid ground, from x0 to x1. Between two of them is a pit. */
export type Ground = [x0: number, x1: number];

/** A ledge to stand on, `y` above the ground. It can be jumped up through from below. */
export interface Ledge {
  x0: number;
  x1: number;
  y: number;
}

export type CritterKind = "beetle" | "wasp" | "thistle";

/** Something that hurts to touch. Beetles walk up and down, wasps bob in the air, thistles just stand there. */
export interface Critter {
  kind: CritterKind;
  x: number;
  y: number;
  /** A beetle's beat: it turns round at either end. */
  x0: number;
  x1: number;
  dir: 1 | -1;
  /** A wasp's place in its bob, so they do not all move together. */
  phase: number;
  /** Squashed or pecked: ticks since, while it is still shown. Thistles cannot be beaten. */
  gone: number;
}

export interface Corn {
  x: number;
  y: number;
  got: boolean;
}

export interface Level {
  length: number;
  ground: Ground[];
  ledges: Ledge[];
  critters: Critter[];
  corn: Corn[];
  /** Where the opponent is waiting. */
  goal: number;
}

export type TrailEvent =
  | { type: "jump" }
  | { type: "land" }
  | { type: "peck" }
  | { type: "stomp"; x: number; y: number }
  | { type: "hurt" }
  | { type: "fall" }
  | { type: "corn" }
  | { type: "won" }
  | { type: "lost" };

export interface Trail {
  level: Level;
  def: FighterDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  /** Ticks since last on something solid (a jump still counts for a moment after walking off an edge). */
  air: number;
  /** Ticks since jump was pressed (a press just before landing still counts). */
  wantJump: number;
  jumpHeld: boolean;
  /** Ticks into a peck, or -1. */
  peck: number;
  peckHeld: boolean;
  hearts: number;
  /** Ticks left of being untouchable after a knock. */
  hurt: number;
  /** The last safe footing, to be put back on after falling in a pit. */
  safeX: number;
  corn: number;
  tick: number;
  done: "won" | "lost" | null;
  /** What happened this tick, for sound and effects. Replaced on every step. */
  events: TrailEvent[];
}

export const HEARTS = 3;
const SPEED = 3.3;
const JUMP = 12.4;
const COYOTE = 6;
const BUFFER = 6;
const PECK_TICKS = 16;
/** The widest pit a level may have. A plain running jump clears about 130. */
export const MAX_PIT = 100;
/** The highest a ledge may be. A plain jump rises about 120. */
export const MAX_LEDGE = 74;

/** How big each kind of critter is: half its width, and its height. */
export const CRITTER_SIZE: Record<CritterKind, { half: number; height: number }> = {
  beetle: { half: 13, height: 18 },
  wasp: { half: 11, height: 16 },
  thistle: { half: 10, height: 24 },
};

/** The hero's box is a little smaller than the bird looks, so a near miss is a miss. */
export const bodyOf = (def: FighterDef) => ({ half: def.width * 0.34, height: def.height * 0.78 });

function mulberry(seed: number) {
  let a = seed | 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number from a string, so that each fight in a story has a trail of its own, the same every time. */
export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * Builds a level out of short stretches, each with one thing to deal with. `rung` (0 to 4) is how far
 * up the ladder the fight is: later trails are longer and busier. Every pit can be cleared with a plain
 * running jump and every ledge reached with a plain jump, so no fighter's trail is harder than another's.
 */
export function makeLevel(seed: number, rung: number): Level {
  const r = mulberry(seed);
  const between = (lo: number, hi: number) => Math.round(lo + r() * (hi - lo));
  const ground: Ground[] = [];
  const ledges: Ledge[] = [];
  const critters: Critter[] = [];
  const corn: Corn[] = [];
  const critter = (kind: CritterKind, x: number, y: number, x0 = x, x1 = x): Critter => ({ kind, x, y, x0, x1, dir: r() < 0.5 ? 1 : -1, phase: r() * Math.PI * 2, gone: 0 });
  const cobs = (x: number, y: number, n: number, gap = 26) => {
    for (let i = 0; i < n; i++) corn.push({ x: x + i * gap, y, got: false });
  };

  // A quiet start, to find the controls.
  let from = 0;
  let x = 300;
  cobs(180, 26, 3);
  const pit = (width: number) => {
    ground.push([from, x]);
    // An arc of corn shows the jump.
    cobs(x + width / 2 - 26, 78, 3);
    x += width;
    from = x;
  };
  const busy = 0.35 + rung * 0.1;
  const stretches = 8 + rung * 2;
  let last = "";
  for (let i = 0; i < stretches; i++) {
    const pick = r();
    const kind = pick < 0.24 ? "pit" : pick < 0.44 ? "beetle" : pick < 0.6 ? "thistle" : pick < 0.76 ? "ledge" : pick < 0.9 ? "wasp" : "pair";
    // Never the same thing twice running, and the first stretch is never a pit.
    const what = kind === last || (i === 0 && kind === "pit") ? "beetle" : kind;
    last = what;
    if (what === "pit") {
      pit(between(64, MAX_PIT));
      x += between(120, 170);
    } else if (what === "beetle") {
      const w = between(190, 260);
      critters.push(critter("beetle", x + w * 0.6, 0, x + 50, x + w - 20));
      if (r() < busy) cobs(x + 60, 26, 2);
      x += w;
    } else if (what === "thistle") {
      // Near the start of its stretch, so that the jump over it comes down on clear ground, never in a pit.
      const w = between(250, 300);
      critters.push(critter("thistle", x + 70, 0));
      // Later on, some thistles come in twos, still one jump wide.
      if (r() < busy - 0.2) critters.push(critter("thistle", x + 94, 0));
      cobs(x + 56, 70, 2);
      x += w;
    } else if (what === "ledge") {
      // A ledge with corn on it, and a beetle underneath for anyone who stays down.
      const w = between(230, 280);
      const y = between(52, MAX_LEDGE);
      ledges.push({ x0: x + 70, x1: x + w - 60, y });
      cobs(x + 90, y + 26, Math.max(2, Math.floor((w - 170) / 26)));
      if (r() < busy + 0.2) critters.push(critter("beetle", x + w * 0.5, 0, x + 80, x + w - 50));
      x += w;
    } else if (what === "wasp") {
      const w = between(170, 220);
      critters.push(critter("wasp", x + w * 0.5, 62));
      x += w;
    } else {
      // A pit with something waiting on the far side.
      pit(between(60, 86));
      const w = between(200, 240);
      if (r() < 0.5) critters.push(critter("beetle", x + w * 0.6, 0, x + 70, x + w - 20));
      else critters.push(critter("thistle", x + 110, 0));
      x += w + 60;
    }
  }
  // The home straight: clear ground, and the opponent waiting on it.
  const goal = x + 260;
  cobs(x + 60, 26, 3);
  ground.push([from, goal + 240]);
  return { length: goal + 240, ground, ledges, critters, corn, goal };
}

export function createTrail(def: FighterDef, level: Level): Trail {
  return {
    level, def, x: 80, y: 0, vx: 0, vy: 0, facing: 1, grounded: true, air: 0, wantJump: 99, jumpHeld: false,
    peck: -1, peckHeld: false, hearts: HEARTS, hurt: 0, safeX: 80, corn: 0, tick: 0, done: null, events: [],
  };
}

const groundAt = (level: Level, x: number) => level.ground.some(([a, b]) => x >= a && x <= b);

/** Where a wasp is on a given tick: it bobs up and down on the spot. */
export const waspY = (c: Critter, tick: number) => c.y + Math.sin(tick * 0.045 + c.phase) * 30;

/** The box a peck reaches: from the hero's front, a beak's length ahead, as tall as the hero. */
export function peckBox(t: Trail) {
  const b = bodyOf(t.def);
  const near = t.x + t.facing * b.half;
  const far = near + t.facing * 40;
  return { l: Math.min(near, far), r: Math.max(near, far), b: t.y, t: t.y + b.height + 14 };
}

/** Plays one tick. `input` is read as in a fight: the stick to move, up (or Kick) to jump, Peck to peck. */
export function stepTrail(t: Trail, input: Input) {
  t.events = [];
  if (t.done) return;
  t.tick++;
  const { level } = t;
  const body = bodyOf(t.def);
  const jumpDown = input.y > 0 || input.heavy;

  // Walking. A knock carries the hero back for a moment before the stick takes over again.
  const stunned = t.hurt > 62;
  if (!stunned) {
    t.vx = input.x * SPEED * (t.def.breed === "rooster" && !t.grounded ? 1.12 : 1);
    if (input.x !== 0) t.facing = input.x;
  }

  // Jumping: a press is remembered for a moment, and so is the ground just left.
  t.wantJump = jumpDown && !t.jumpHeld ? 0 : t.wantJump + 1;
  t.air = t.grounded ? 0 : t.air + 1;
  if (t.wantJump <= BUFFER && t.air <= COYOTE && !stunned) {
    t.vy = JUMP;
    t.grounded = false;
    t.air = COYOTE + 1;
    t.wantJump = 99;
    t.events.push({ type: "jump" });
  }
  // Letting go early makes a shorter hop.
  if (!jumpDown && t.jumpHeld && t.vy > 4) t.vy *= 0.5;
  t.jumpHeld = jumpDown;

  if (input.light && !t.peckHeld && t.peck < 0 && !stunned) {
    t.peck = 0;
    t.events.push({ type: "peck" });
  }
  t.peckHeld = input.light;
  if (t.peck >= 0 && ++t.peck > PECK_TICKS) t.peck = -1;

  // Falling. A hen holding up flutters down slowly, as she does in a fight.
  const before = t.y;
  if (!t.grounded) {
    t.vy -= GRAVITY;
    if (t.def.breed === "hen" && input.y > 0 && t.vy < -2.4) t.vy = -2.4;
    t.y += t.vy;
  }
  let x = Math.max(body.half, Math.min(level.length - body.half, t.x + t.vx));
  // Down in a pit, its walls are solid.
  if (t.y < 0 && !groundAt(level, t.x)) {
    if (groundAt(level, x + Math.sign(t.vx) * body.half)) x = t.x;
  }
  t.x = x;

  // Landing: on the ground, or on a ledge when coming down onto it.
  let floor: number | null = null;
  if (groundAt(level, t.x) && before >= 0 && t.y <= 0) floor = 0;
  for (const l of level.ledges) if (t.x >= l.x0 && t.x <= l.x1 && before >= l.y && t.y <= l.y && t.vy <= 0) floor = l.y;
  if (floor !== null && t.vy <= 0) {
    if (!t.grounded) t.events.push({ type: "land" });
    t.y = floor;
    t.vy = 0;
    t.grounded = true;
  } else if (t.grounded) {
    // Walked off an edge.
    const onLedge = level.ledges.some((l) => t.y === l.y && t.x >= l.x0 && t.x <= l.x1);
    if (!onLedge && !(t.y === 0 && groundAt(level, t.x))) t.grounded = false;
  }
  if (t.grounded && t.y === 0 && groundAt(level, t.x - 24) && groundAt(level, t.x + 24)) t.safeX = t.x;

  if (t.hurt > 0) t.hurt--;
  const knock = (fell: boolean) => {
    t.hearts--;
    t.hurt = 80;
    t.events.push({ type: fell ? "fall" : "hurt" });
    if (t.hearts <= 0) {
      t.done = "lost";
      t.events.push({ type: "lost" });
    }
  };

  // Down a pit: a heart gone, and back to the last safe footing.
  if (t.y < -140) {
    knock(true);
    t.x = t.safeX;
    t.y = 0;
    t.vx = t.vy = 0;
    t.grounded = true;
    return;
  }

  for (const c of level.corn) {
    if (c.got || Math.abs(c.x - t.x) > body.half + 10 || c.y < t.y - 12 || c.y > t.y + body.height + 10) continue;
    c.got = true;
    t.corn++;
    t.events.push({ type: "corn" });
  }

  const reach = t.peck >= 3 && t.peck <= 9 ? peckBox(t) : null;
  for (const c of level.critters) {
    if (c.gone > 0) {
      c.gone++;
      continue;
    }
    const size = CRITTER_SIZE[c.kind];
    if (c.kind === "beetle") {
      c.x += c.dir * 0.9;
      if (c.x <= c.x0 || c.x >= c.x1) c.dir = c.dir === 1 ? -1 : 1;
    }
    const cy = c.kind === "wasp" ? waspY(c, t.tick) : c.y;
    const beatable = c.kind !== "thistle";
    // Pecked.
    if (beatable && reach && c.x + size.half > reach.l && c.x - size.half < reach.r && cy < reach.t && cy + size.height > reach.b) {
      c.gone = 1;
      t.events.push({ type: "stomp", x: c.x, y: cy + size.height / 2 });
      continue;
    }
    const touching = Math.abs(c.x - t.x) < size.half + body.half && t.y < cy + size.height && t.y + body.height > cy;
    if (!touching) continue;
    // Landed on from above: squashed, and a bounce off it.
    if (beatable && t.vy < 0 && before >= cy + size.height * 0.5) {
      c.gone = 1;
      t.vy = input.y > 0 || input.heavy ? JUMP : 8;
      t.grounded = false;
      t.events.push({ type: "stomp", x: c.x, y: cy + size.height / 2 });
    } else if (t.hurt === 0) {
      knock(false);
      t.vx = (t.x < c.x ? -1 : 1) * 3.4;
      t.vy = 7;
      t.grounded = false;
    }
  }

  if (!t.done && t.x >= level.goal - 70) {
    t.done = "won";
    t.events.push({ type: "won" });
  }
}

/**
 * A simple player for testing that a level can be finished: it runs right, jumps what is in the way
 * and pecks what it can. It is not clever, so a level it finishes is one a person can.
 */
export function botInput(t: Trail): Input {
  const input: Input = { x: 1, y: 0, light: false, heavy: false, special: false, sup: false };
  const body = bodyOf(t.def);
  const front = t.x + body.half;
  // Hold the jump while rising, for the full height and distance.
  if (!t.grounded) {
    input.y = t.vy > 0 ? 1 : 0;
    return input;
  }
  const pitAhead = !groundAt(t.level, front + 10) && t.y === 0;
  let jump = pitAhead;
  for (const c of t.level.critters) {
    if (c.gone > 0) continue;
    const size = CRITTER_SIZE[c.kind];
    const ahead = c.x - size.half - front;
    const cy = c.kind === "wasp" ? waspY(c, t.tick) : c.y;
    // Not in the way: behind, a long way off, or down below a ledge.
    if (ahead < -30 || ahead > 80 || cy + size.height < t.y) continue;
    if (c.kind === "thistle") jump ||= ahead < 34;
    else if (ahead < 36) {
      // Stand and peck until it is gone: a beetle walks into it, a wasp bobs down into it.
      input.x = 0;
      input.light = t.tick % 2 === 0;
    }
  }
  if (jump) input.y = 1;
  return input;
}
