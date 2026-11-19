import { reachOf, shotRange } from "./geometry";
import { moveRole } from "./roster";
import { MAX_METER, NO_INPUT, type Fighter, type Input, type Match, type Move } from "./types";

// The CPU looks at the match and returns an Input, exactly like a player holding a controller.
// It never touches the engine's state, so it cannot cheat beyond reacting faster on higher levels.

/** 0 = Chick (learning), 1 = Hen, 2 = Rooster. */
export type CpuLevel = 0 | 1 | 2 | 3;
/** What a sparring partner does. "swing" and "sweep" walk up and repeat one attack on a steady beat, for the lessons. */
export type DummyMode = "stand" | "block" | "fight" | "swing" | "sweep";

interface Tuning {
  /** Chance of blocking an attack it could have seen coming. */
  guard: number;
  /** Ticks between decisions, before jitter. */
  think: number;
  /** Chance of answering a jump-in. */
  antiAir: number;
  /** Chance of following a landed peck with a special. */
  combo: number;
  /** How much it presses forward rather than waiting. */
  push: number;
  /** Chance per decision of spending a full meter when in range. */
  sup: number;
  /** Chance of getting the guard up in time against something as quick as a peck. Nobody reacts to those every time. */
  quick: number;
}

/** Chance of shaking off a throw. */
const TECH: Record<CpuLevel, number> = { 0: 0.05, 1: 0.25, 2: 0.55, 3: 0.7 };

/** Two quick taps the same way: a dash. Fresh objects each time, since beats count themselves down. */
const dashBeats = (toward: 1 | -1): Beat[] => [{ toward, ticks: 2 }, { ticks: 2 }, { toward, ticks: 2 }, { ticks: 10 }];

const TUNING: Record<CpuLevel, Tuning> = {
  0: { guard: 0.18, think: 26, antiAir: 0.05, combo: 0.05, push: 0.45, sup: 0.15, quick: 0.25 },
  1: { guard: 0.5, think: 15, antiAir: 0.35, combo: 0.4, push: 0.62, sup: 0.45, quick: 0.45 },
  2: { guard: 0.82, think: 8, antiAir: 0.75, combo: 0.8, push: 0.75, sup: 0.8, quick: 0.6 },
  // Champion: thinks almost every frame, punishes jumps, rarely drops a combo, and reacts to more of your pecks.
  3: { guard: 0.9, think: 5, antiAir: 0.9, combo: 0.95, push: 0.82, sup: 0.92, quick: 0.72 },
};

/** How a CPU bird plays. (A boss in its second phase is faster and hits harder, but thinks no better.) */
const levelOf = (c: Cpu, _me: Fighter): CpuLevel => c.level;

/** A queued bit of intent. `toward` is relative to the opponent: 1 walks at them, -1 backs off. */
interface Beat {
  toward?: -1 | 0 | 1;
  y?: -1 | 0 | 1;
  light?: boolean;
  heavy?: boolean;
  special?: boolean;
  sup?: boolean;
  ticks: number;
}

/** How each kind of fighter leans: how keen on shots, on closing in, and on keeping away once close. */
const PLAN: Record<Fighter["def"]["plan"], { shots: number; close: number; keep: number }> = {
  allround: { shots: 1, close: 1, keep: 0 },
  zoner: { shots: 1.5, close: 0.75, keep: 0.45 },
  rush: { shots: 0.6, close: 1.3, keep: 0 },
  heavy: { shots: 0.7, close: 1.15, keep: 0 },
};

export interface Cpu {
  level: CpuLevel;
  /** The opponent's last few moves, to notice a habit. */
  seen: string[];
  lastSerial: number;
  /** How to get up from this knockdown: 0 plainly, 1 roll in, 2 roll away, 3 late. */
  rise: number;
  mode: DummyMode;
  queue: Beat[];
  wait: number;
  /** The threat it last made up its mind about, and what it decided. */
  threat: string;
  guarding: boolean;
  seed: number;
}

export function createCpu(level: CpuLevel, seed = 1, mode: DummyMode = "fight"): Cpu {
  return { level, mode, queue: [], wait: 20, threat: "", guarding: false, seed: seed | 0 || 1, seen: [], lastSerial: -1, rise: 0 };
}

function roll(c: Cpu): number {
  c.seed = (c.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(c.seed ^ (c.seed >>> 15), 1 | c.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const free = (f: Fighter) => f.state === "idle" || f.state === "walk" || f.state === "crouch";

function toInput(b: Beat, toward: 1 | -1): Input {
  return {
    x: ((b.toward ?? 0) * toward) as -1 | 0 | 1,
    y: b.y ?? 0,
    light: !!b.light, heavy: !!b.heavy, special: !!b.special, sup: !!b.sup,
  };
}

/** Is something about to hit me, and how does it need blocking? */
export function threatTo(m: Match, me: Fighter, op: Fighter, dist: number): { id: string; low: boolean } | null {
  const mv = op.move;
  // Someone jumping in is a threat from the moment they leave the ground, not from the moment they kick.
  if (op.state === "air" && op.y > 20 && dist < 170 && Math.sign(op.vx) === Math.sign(me.x - op.x)) return { id: `j${op.side}:${m.tick - op.stateT}`, low: false };
  if (op.state === "attack" && mv && op.phase !== "recovery" && mv.kind !== "throw" && (mv.box || mv.shot)) {
    const range = mv.shot ? 0 : reachOf(mv) + me.def.width / 2 + 26;
    if (dist < range) return { id: `m${op.side}:${op.moveSerial}`, low: mv.level === "low" };
  }
  for (const s of m.shots) {
    if (s.side === me.side || s.delay > 0) continue;
    // A mine on the floor is only a threat to someone about to step on it.
    if (s.planted) {
      if (Math.abs(me.x - s.x) < 46) return { id: `p${s.side}:${Math.round(s.x)}`, low: true };
      continue;
    }
    const gap = (me.x - s.x) * Math.sign(s.vx);
    if (gap > -10 && gap < 30 + Math.abs(s.vx) * 16) return { id: `s${s.side}:${Math.round(s.age / 40)}:${s.spec.kind}`, low: s.spec.level === "low" };
  }
  return null;
}

function decide(c: Cpu, me: Fighter, op: Fighter, dist: number): Beat[] {
  const t = TUNING[levelOf(c, me)];
  const plan = PLAN[me.def.plan];
  const r = () => roll(c);
  const [s1, s2, s3] = me.def.specials;
  const find = (role: ReturnType<typeof moveRole>): Beat | null => {
    if (moveRole(s1) === role) return { special: true, ticks: 2 };
    if (moveRole(s2) === role) return { toward: 1, special: true, ticks: 2 };
    if (moveRole(s3) === role) return { y: -1, special: true, ticks: 2 };
    return null;
  };
  // Only throw things that can actually get there: lobbed eggs land, cheeps fizzle out.
  const shotMove = me.def.specials.find((s) => s.shot);
  const range = shotMove?.shot ? shotRange(shotMove.shot) : 0;
  const lobbed = (shotMove?.shot?.g ?? 0) > 0.2;
  const shotFits = dist < range * 1.08 && (!lobbed || dist > range * 0.55);
  const n = me.def.normals;
  const body = op.def.width / 2;
  const peckRange = reachOf(n.sLight) + body - 4;
  const kickRange = reachOf(n.sHeavy) + body - 4;
  const sweepRange = reachOf(n.cHeavy) + body - 4;
  const throwRange = (me.def.width + op.def.width) / 2 + 10;

  // They are seeing stars: walk up and take the biggest free hit available.
  if (op.state === "dizzy") {
    if (dist > peckRange) return [{ toward: 1, ticks: 6 }];
    if (me.meter >= MAX_METER && !me.def.super.shot) return [{ sup: true, ticks: 2 }];
    const ender = find("dash") ?? find("flurry") ?? find("rise") ?? find("shot");
    return ender ? [{ light: true, ticks: 2 }, { ticks: 5 }, ender] : [{ heavy: true, ticks: 2 }];
  }

  // They are in the air and coming my way.
  if (op.y > 24 && dist < 150 && Math.sign(op.vx) === Math.sign(me.x - op.x) && r() < t.antiAir) {
    const up = find("rise");
    if (up && dist < 110) return [up];
    if (dist < kickRange) return [{ heavy: true, ticks: 2 }];
    return [{ toward: -1, ticks: 12 }];
  }

  // They are on the floor: close in and wait for them to stand.
  if (op.state === "down" || op.state === "getup" || op.state === "launched") {
    if (dist > kickRange + 20) return [{ toward: 1, ticks: 10 }];
    if (op.state === "getup" && op.stateT > 6 && r() < t.push * 0.7) return [{ y: -1, heavy: true, ticks: 2 }];
    return [{ ticks: 6 }];
  }

  const superReach = me.def.super.shot ? shotRange(me.def.super.shot) * 0.85 : reachOf(me.def.super) + body;
  if (me.meter >= MAX_METER && dist < superReach && r() < t.sup) return [{ sup: true, ticks: 2 }];

  // Whiff punish: they are stuck recovering right in front of me.
  const stuck = op.state === "attack" && op.phase === "recovery";
  if (stuck && dist < kickRange && r() < t.guard) return [{ heavy: true, ticks: 2 }];

  if (dist > 250) {
    const shot = shotFits ? find("shot") : null;
    const x = r();
    if (shot && x < 0.4 * plan.shots) return [shot, { ticks: 8 }];
    if (c.level > 0 && plan.close >= 1 && x > 0.4 && x < 0.5) return dashBeats(1);
    if (x < 0.4 + t.push * 0.5 * plan.close) return [{ toward: 1, ticks: 14 + Math.floor(r() * 16) }];
    if (x < 0.92) return [{ ticks: 8 }];
    return [{ toward: 1, y: 1, ticks: 3 }];
  }

  if (dist > kickRange + 6) {
    const x = r();
    const shot = shotFits ? find("shot") : null;
    const rush = find("dash");
    const drop = find("pound");
    if (rush && dist < reachOf(rushMove(me)) + body && x < 0.16 * (0.5 + t.push)) return [rush];
    if (drop && dist > 70 && dist < 170 && x < 0.26 * (0.5 + t.push)) return [drop];
    if (shot && x < 0.4 * plan.shots) return [shot, { ticks: 6 }];
    if (x < 0.4 + t.push * 0.42 * plan.close) return [{ toward: 1, ticks: 8 + Math.floor(r() * 10) }];
    if (x < 0.9) return dist < 190 && r() < 0.5 ? [{ toward: 1, y: 1, ticks: 3 }, { ticks: 22 }, { heavy: true, ticks: 2 }] : [{ toward: -1, ticks: 8 }];
    return [{ ticks: 6 }];
  }

  // Close range. A fighter that would rather be far away sometimes just leaves.
  if (plan.keep && r() < plan.keep * 0.4) return c.level > 0 ? dashBeats(-1) : [{ toward: -1, ticks: 14 }];
  const x = r();
  const opGuarding = op.state === "block" || (free(op) && op.inp.x === -op.facing);
  // Now and then (from Hen level up), a launcher, then a jump after the bird it sent up.
  if (c.level > 0 && x > 0.88 && dist < reachOf(me.def.normals.launch) + op.def.width / 2) return [{ toward: 1, y: -1, heavy: true, ticks: 2 }, { ticks: 14 }, { toward: 1, y: 1, ticks: 3 }, { heavy: true, ticks: 4 }];
  const hug = find("grab");
  if (hug && dist < throwRange + 14 && (opGuarding ? x < 0.6 : x < 0.12)) return [hug];
  // At the top level, half a meter sometimes goes on a charged rush.
  if (c.level === 2 && me.meter >= 50 && me.meter < MAX_METER && x > 0.9) return [{ toward: 1, sup: true, ticks: 2 }];
  if (dist < throwRange && (opGuarding ? x < 0.35 + c.level * 0.15 : x < 0.06)) return [{ toward: 1, heavy: true, ticks: 2 }];
  if (x < 0.34 && dist < peckRange) {
    const beats: Beat[] = [{ light: true, ticks: 2 }, { ticks: 9 }];
    if (r() < t.combo) {
      // Peck, then cancel into whatever special fits at this range.
      const ender = find("dash") ?? find("flurry") ?? find("rise") ?? find("shot");
      if (ender) return [{ light: true, ticks: 2 }, { ticks: 5 }, ender];
    }
    if (r() < 0.5) beats.push({ light: true, ticks: 2 });
    return beats;
  }
  if (x < 0.52) return [{ heavy: true, ticks: 2 }];
  if (x < 0.66 && dist < sweepRange) return [{ y: -1, ticks: 2 }, { y: -1, heavy: true, ticks: 2 }];
  if (x < 0.74 && dist < peckRange) return [{ y: -1, light: true, ticks: 2 }, { y: -1, ticks: 8 }];
  if (x < 0.82) {
    const close = find("flurry") ?? find("rise");
    if (close) return [close];
  }
  if (x < 0.9) return [{ toward: -1, ticks: 10 + Math.floor(r() * 10) }];
  if (c.level > 0 && x < 0.95) return dashBeats(-1);
  return [{ toward: -1, y: 1, ticks: 3 }];
}

function rushMove(f: Fighter): Move {
  return f.def.specials.find((s) => moveRole(s) === "dash") ?? f.def.specials[1];
}

/** What the CPU holds this tick. */
export function cpuInput(m: Match, side: 0 | 1, c: Cpu): Input {
  const me = m.f[side];
  const op = m.f[1 - side];
  if (m.phase !== "fight" || c.mode === "stand") return NO_INPUT;
  const toward: 1 | -1 = op.x >= me.x ? 1 : -1;
  const dist = Math.abs(op.x - me.x);
  const t = TUNING[levelOf(c, me)];

  // Caught in a combo with a full meter and a burst to spend: from Hen level up, sometimes break out.
  if (c.mode === "fight" && c.level > 0 && !me.burstUsed && me.meter >= MAX_METER && (me.state === "hit" || me.state === "launched") && me.comboTaken >= 3 && roll(c) < 0.06 * c.level) {
    return { ...NO_INPUT, sup: true };
  }
  // Tag team: a bird in trouble swaps out for a healthier partner now and then.
  const partner = m.bench?.[side];
  if (c.mode === "fight" && partner && partner.hp > me.hp * 1.4 && me.hp < me.def.hp * 0.35 && free(me) && (m.tagReady?.[side] ?? 1) === 0 && roll(c) < 0.03) {
    return { ...NO_INPUT, light: true, heavy: true };
  }

  // Tag team: from a distance, now and then, call the partner in to charge across.
  if (c.mode === "fight" && partner && partner.hp > 0 && (m.assistReady?.[side] ?? 1) === 0 && dist > 140 && free(me) && roll(c) < 0.015) {
    return { ...NO_INPUT, heavy: true, special: true };
  }
  if (op.state === "attack" && op.move && op.moveSerial !== c.lastSerial) {
    c.lastSerial = op.moveSerial;
    c.seen.push(op.move.id);
    if (c.seen.length > 6) c.seen.shift();
  }
  if (c.mode === "swing" || c.mode === "sweep") {
    if (!free(me)) return NO_INPUT;
    if (dist > reachOf(me.def.normals.sHeavy) + op.def.width / 2 - 12) return { ...NO_INPUT, x: toward };
    const now = m.tick % 80 < 2;
    // An armoured kick cannot be countered, so a bird with one sweeps on the beat instead.
    const sweep = c.mode === "sweep" || !!me.def.normals.sHeavy.armor;
    return sweep ? { ...NO_INPUT, y: -1, heavy: now } : { ...NO_INPUT, heavy: now };
  }
  // On the floor: pick a way of getting up, so it cannot be timed the same way twice.
  if (me.state === "down" && c.mode === "fight") {
    if (me.stateT <= 1) c.rise = c.level === 0 ? 0 : Math.floor(roll(c) * 4);
    return c.rise === 1 ? { ...NO_INPUT, x: toward } : c.rise === 2 ? { ...NO_INPUT, x: -toward as 1 | -1 } : c.rise === 3 ? { ...NO_INPUT, y: -1 } : NO_INPUT;
  }
  const threat = threatTo(m, me, op, dist);
  if (c.mode === "block") {
    // A training dummy that blocks everything it can.
    const high = op.y > 0 || op.move?.level === "high";
    return { ...NO_INPUT, block: true, y: threat?.low && !high ? -1 : 0 };
  }

  // In blockstun: keep guarding the way it started.
  if (me.state === "block") return { ...NO_INPUT, x: -toward as 1 | -1, y: me.crouchBlock ? -1 : 0 };

  // Guard goes up as soon as it can do any good, which includes the tail end of the CPU's own attack:
  // a guard raised early is an ordinary block, where one raised at the last moment would be a perfect one.
  const recovering = me.state === "land" || (me.state === "attack" && me.phase === "recovery" && me.y === 0);
  if (threat && (free(me) || recovering)) {
    // A decision made about a jump holds for whatever comes out of it.
    const sameJump = c.threat.startsWith("j") && threat.id.startsWith("m") && op.y > 0;
    if (c.threat !== threat.id && sameJump) c.threat = threat.id;
    if (c.threat !== threat.id) {
      c.threat = threat.id;
      // A move seen again and again gets blocked more and more reliably (not at the easiest level).
      const habit = c.level > 0 && op.move ? c.seen.filter((id) => id === op.move!.id).length : 0;
      const quick = !!op.move && !op.move.shot && op.move.startup < 8 && op.state === "attack";
      c.guarding = roll(c) < Math.min(0.97, t.guard + Math.max(0, habit - 1) * 0.15) && (!quick || roll(c) < t.quick);
    }
    if (c.guarding) {
      c.queue = [];
      // The lower levels guess high/low; the top level reads it.
      const readsLow = c.level === 2 || roll(c) < 0.5;
      return { ...NO_INPUT, x: -toward as 1 | -1, y: threat.low && readsLow ? -1 : 0 };
    }
  }

  // Grabbed: decide once whether to shake it off.
  if (me.state === "grabbed") {
    const id = `g${op.moveSerial}`;
    if (c.threat !== id) {
      c.threat = id;
      c.guarding = roll(c) < TECH[c.level];
    }
    return c.guarding && me.stateT >= 3 && me.stateT <= 4 ? { ...NO_INPUT, heavy: true } : NO_INPUT;
  }

  const beat = c.queue[0];
  if (beat) {
    if (--beat.ticks <= 0) c.queue.shift();
    // A queued jump-in kick only comes out while actually airborne.
    if (beat.heavy && c.queue.length === 0 && me.state === "air" && dist > 110) return NO_INPUT;
    return toInput(beat, toward);
  }

  if (me.state === "air") {
    if (me.airUsed) return NO_INPUT;
    if (me.y > 50 && me.vy < 3 && dist > 50 && dist < 150 && roll(c) < 0.03 * (c.level + 1)) return { ...NO_INPUT, special: true };
    return me.vy < 1 && dist < 90 && roll(c) < 0.25 ? { ...NO_INPUT, heavy: true } : NO_INPUT;
  }
  if (!free(me)) return NO_INPUT;
  if (c.wait > 0) {
    c.wait--;
    return NO_INPUT;
  }
  c.queue = decide(c, me, op, dist);
  c.wait = Math.round(t.think * (0.4 + roll(c) * 0.9));
  return cpuInput(m, side, c);
}
