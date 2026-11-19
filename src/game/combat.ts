import { type Fighter, type Level, MAX_METER, type Match, type Move, WALL } from "./types";
import { DAZE_LIMIT, HITSTOP, MAX_X, THROW, begin, feathers, fx, impact, setState, takeDamage, PERFECT_WINDOW } from "./state";
import { RA, RB, attackRect, hittable, hurtRect, isCrouched, overlap } from "./geometry";
import { hitTarget } from "./target";

// What happens when an attack connects: blocking, damage, knockdowns, throws and knockouts.

export function canThrow(f: Fighter, o: Fighter): boolean {
  if (o.def.prop) return false;
  if (o.y !== 0 || o.invuln > 0 || o.throwProof > 0) return false;
  if (o.state === "attack") {
    if (!o.move || o.move.armor || o.move.leap || o.move.kind !== "normal") return false;
  } else if (o.state !== "idle" && o.state !== "walk" && o.state !== "crouch" && o.state !== "prejump" && o.state !== "land" && o.state !== "dizzy" && o.state !== "dash") {
    return false;
  }
  return Math.abs(o.x - f.x) <= (f.def.width + o.def.width) / 2 + 12;
}

/** Fills a fighter's crow meter. Below a quarter of their health it fills half as fast again: a way back into a losing fight. */
export function gain(f: Fighter, n: number) {
  f.meter = Math.min(MAX_METER, f.meter + n * (f.hp < f.def.hp * 0.25 ? 1.5 : 1));
}

/**
 * Bursting out of a combo: with a full meter, once a round, Crow while being hit spends it all to
 * break free. The attacker is shoved away and stunned; the one bursting is briefly untouchable.
 */
export function tryBurst(m: Match, f: Fighter, o: Fighter): boolean {
  if (m.phase !== "fight" || f.burstUsed || f.meter < MAX_METER || f.buf.sup <= 0 || f.hp <= 0) return false;
  if (f.state !== "hit" && f.state !== "launched") return false;
  f.burstUsed = true;
  f.meter = 0;
  f.buf.sup = 0;
  f.stun = f.juggle = f.comboTaken = 0;
  f.move = null;
  f.slide = 0;
  f.invuln = 26;
  if (f.y > 0) {
    setState(f, "air");
    f.vx = 0;
    f.vy = Math.max(f.vy, 3);
    f.airUsed = true;
  } else setState(f, "idle");
  const dir = o.x >= f.x ? 1 : -1;
  if (Math.abs(o.x - f.x) < 150 && !o.def.prop && o.state !== "ko") {
    o.move = null;
    setState(o, "hit");
    o.stun = 24;
    o.slide = dir * 10;
  }
  fx(m, "ring", f.x, f.y + f.def.height * 0.5, { size: 70, life: 18 });
  m.shake = Math.max(m.shake, 8);
  m.hitstop = Math.max(m.hitstop, 10);
  m.events.push({ type: "burst", side: f.side }, { type: "word", text: "Burst!", x: f.x, y: f.y + f.def.height + 10 });
  return true;
}

export function knockOut(m: Match, f: Fighter, dir: number, kx: number, ky: number) {
  f.move = null;
  setState(f, "launched");
  f.juggle = 99;
  f.slide = 0;
  f.vx = dir * Math.max(4.6, kx);
  f.vy = Math.max(9.5, ky);
  const partner = m.bench?.[f.side];
  if (m.phase === "fight" && partner && partner.hp > 0) {
    // Tag team: the partner comes in once the fallen bird lands.
    m.tagIn = { side: f.side, t: 70 };
    m.banner = { text: `${f.def.name} is out!`, t: 0, life: 70 };
  } else if (m.phase === "fight") {
    m.phase = "ko";
    m.phaseT = 0;
    m.banner = { text: "Knockout!", t: 0, life: 110 };
  }
  m.hitstop = 16;
  m.shake = 12;
  m.events.push({ type: "ko", side: f.side });
  feathers(m, f.x, f.y + f.def.height * 0.5, f, 14);
}

/** Grabs the opponent. They have a moment to shake it off before the toss. */
export function grab(m: Match, f: Fighter, o: Fighter, held: -1 | 1) {
  begin(m, f, THROW);
  const forward = held === f.facing;
  f.throwDir = (forward ? f.facing : -f.facing) as 1 | -1;
  o.move = null;
  setState(o, "grabbed");
  o.vx = o.slide = 0;
  if (o.inp.x === -o.facing || o.inp.block) m.events.push({ type: "caught", side: o.side, why: "throw", x: o.x, y: o.y + o.def.height });
}

/** The grabbed fighter pressed Kick in time: both are shoved apart, no damage. */
export function techThrow(m: Match, f: Fighter, o: Fighter) {
  const away = f.x >= o.x ? 1 : -1;
  for (const [p, dir, stun] of [[f, away, 10], [o, -away, 13]] as const) {
    p.move = null;
    setState(p, "hit");
    p.stun = stun;
    p.crouchBlock = false;
    p.slide = dir * 6;
  }
  f.throwProof = 20;
  fx(m, "guard", (f.x + o.x) / 2, f.def.height * 0.6, { size: 22, life: 12 });
  m.hitstop = 5;
  m.events.push({ type: "tech" });
}

export function finishThrow(m: Match, f: Fighter, o: Fighter) {
  if (o.state !== "grabbed") return;
  const dir = f.throwDir;
  if (dir !== f.facing) o.x = f.x - f.facing * 8;
  const dmg = Math.round(THROW.damage * f.def.power);
  takeDamage(m, o, dmg);
  o.comboTaken = 1;
  f.combo = 1;
  f.comboT = 60;
  f.score += dmg * 10;
  f.points.hits += dmg * 10;
  gain(f, 9);
  gain(o, 6);
  impact(m, o.x, o.y + o.def.height * 0.5, 1);
  feathers(m, o.x, o.y + o.def.height * 0.5, o, 6);
  m.events.push({ type: "throw", side: f.side, damage: dmg });
  if (o.hp <= 0) return knockOut(m, o, dir, 5.4, 9.5);
  o.move = null;
  setState(o, "launched");
  o.juggle = 99;
  o.slide = 0;
  o.vx = dir * 5.2;
  o.vy = 8.8;
  m.hitstop = 8;
  m.shake = 6;
}

export interface HitSource {
  damage: number;
  hitstun: number;
  blockstun: number;
  push: number;
  level: Level;
  knock?: { x: number; y: number };
  chip?: number;
  power: 0 | 1 | 2;
  /** Shots push the way they travel; everything else pushes away from the attacker. */
  dir: 1 | -1;
  melee: boolean;
  noMeter?: boolean;
  /** Id of the move responsible, for combo trials. */
  id: string;
  /** How long the attack took to come out, in ticks. Shots count as slow. */
  wind: number;
}

export function applyHit(m: Match, att: Fighter, def: Fighter, src: HitSource, x: number, y: number, last: boolean) {
  const { dir } = src;
  const cornered = dir > 0 ? def.x >= MAX_X - 1 : def.x <= WALL + 1;
  const guarding = def.y === 0 && (def.state === "idle" || def.state === "walk" || def.state === "crouch" || def.state === "block");
  const low = def.inp.y < 0;
  const blocked = !def.def.prop && guarding && (def.inp.x === dir || !!def.inp.block) && (src.level === "mid" || (src.level === "low" ? low : !low));
  // Tried to block and got the height wrong: say so, which is how people learn the difference.
  if (!blocked && !def.def.prop && guarding && (def.inp.x === dir || !!def.inp.block)) {
    m.events.push({ type: "caught", side: def.side, why: src.level === "low" ? "low" : "high", x: def.x, y: def.y + def.def.height });
  }

  if (blocked) {
    // A block made just as the guard goes up is perfect: no chip, no wear on the guard, and the blocker recovers first.
    // Pecks and the like are too quick for it: there has to have been something to see coming.
    const perfect = src.wind >= 6 && !def.inp.auto && def.state !== "block" && def.guardHeld > 0 && def.guardHeld <= PERFECT_WINDOW;
    setState(def, "block");
    def.stun = perfect ? Math.max(2, src.blockstun - 5) : src.blockstun;
    def.crouchBlock = low;
    def.slide = dir * src.push * 0.75;
    const chip = perfect ? 0 : Math.round(src.damage * (src.chip ?? 0));
    if (chip > 0) {
      def.hp = Math.max(1, def.hp - chip);
      def.calm = 0;
    }
    gain(att, src.noMeter ? 0 : 1);
    gain(def, perfect ? 6 : 1.5);
    m.hitstop = Math.max(m.hitstop, 3);
    fx(m, "guard", x, y, { size: 16, life: 10 });
    m.events.push({ type: "block", side: def.side });
    if (cornered && src.melee) att.slide = -dir * src.push * 0.6;
    // Blocking wears the guard down. When it gives out, the defender is left wide open.
    def.guardRest = 0;
    if (perfect) {
      m.events.push({ type: "word", text: "Perfect!", x: def.x, y: def.y + def.def.height });
      return;
    }
    def.guard -= src.damage * 0.28;
    if (def.guard <= 0) {
      def.guard = 100;
      setState(def, "hit");
      def.stun = 46;
      def.slide = dir * 2;
      impact(m, x, y, 2);
      m.hitstop = 10;
      m.shake = 6;
      m.banner = { text: "Guard broken", t: 0, life: 44 };
      m.events.push({ type: "guardBreak", side: def.side });
    }
    return;
  }

  // Hit out of their own attack: a counter, which hurts more and stuns for longer.
  const attacking = def.state === "attack" && !!def.move && def.phase !== "recovery";
  const armored = attacking && !!def.move?.armor;
  const counter = attacking && !armored && !def.def.prop;
  const scale = Math.max(0.35, Math.pow(0.88, def.comboTaken));
  const dmg = Math.max(1, Math.round(src.damage * scale * (counter ? 1.2 : 1) * (att.enraged ? 1.1 : 1) * (m.rules.tag ? 1.25 : 1)));
  if (armored && def.hp - dmg > 0) {
    takeDamage(m, def, Math.round(dmg * 0.7));
    impact(m, x, y, 0);
    m.hitstop = Math.max(m.hitstop, 4);
    m.events.push({ type: "hit", power: 0, side: def.side, move: src.id, combo: 0, damage: Math.round(dmg * 0.7) });
    return;
  }

  const wasCrouched = isCrouched(def);
  takeDamage(m, def, dmg);
  const earned = Math.round(dmg * 10 * (1 + def.comboTaken * 0.1));
  att.score += earned;
  att.points.hits += earned;
  if (def.def.prop) return hitTarget(m, def, src.power, src.id, x, y);
  def.comboTaken++;
  att.combo = def.comboTaken;
  att.comboT = 75;
  def.daze += dmg;
  if (!src.noMeter) gain(att, dmg * 0.075);
  gain(def, dmg * 0.05);
  impact(m, x, y, src.power);
  feathers(m, x, y, def, 2 + src.power * 2);
  m.events.push({ type: "hit", power: src.power, side: def.side, move: src.id, combo: def.comboTaken, damage: dmg, counter });
  if (counter) m.events.push({ type: "word", text: "Counter!", x: def.x, y: def.y + def.def.height });
  if (cornered && src.melee) att.slide = -dir * src.push * 0.6;

  if (def.hp <= 0) return knockOut(m, def, dir, src.knock?.x ?? 0, src.knock?.y ?? 0);

  const airborne = def.y > 0 || def.state === "launched";
  def.move = null;
  // Too much punishment too quickly: knocked flat, and dizzy on getting up.
  const dazed = def.daze >= DAZE_LIMIT;
  if (dazed) {
    def.daze = 0;
    def.dizzyNext = true;
  }
  if ((src.knock && last) || airborne || dazed) {
    setState(def, "launched");
    def.juggle = dazed ? 99 : def.juggle + 1;
    def.slide = 0;
    def.vx = dir * (src.knock && last ? src.knock.x : 3);
    def.vy = src.knock && last ? src.knock.y : dazed ? 8 : 6.5;
  } else {
    setState(def, "hit");
    def.stun = src.hitstun + (counter ? 6 : 0);
    def.crouchBlock = wasCrouched;
    def.slide = dir * src.push;
  }
  m.hitstop = Math.max(m.hitstop, HITSTOP[src.power]);
  m.shake = Math.max(m.shake, 2 + src.power * 3);
}

export interface Strike { att: Fighter; def: Fighter; mv: Move; x: number; y: number }

export function strikeOf(f: Fighter, o: Fighter): Strike | null {
  const mv = f.move;
  if (f.state !== "attack" || !mv || !mv.box || f.phase !== "active") return null;
  if (mv.leap && (mv.leap.fallOnly ? f.vy >= 0 : f.phaseT > mv.active)) return null;
  if (f.hitsDone >= (mv.hits ?? 1) || f.moveT - f.lastHitT < (mv.gap ?? 0) || !hittable(o)) return null;
  const a = attackRect(f, mv.box, RA);
  const h = hurtRect(o, RB);
  if (!overlap(a, h)) return null;
  return { att: f, def: o, mv, x: (Math.max(a.l, h.l) + Math.min(a.r, h.r)) / 2, y: (Math.max(a.b, h.b) + Math.min(a.t, h.t)) / 2 };
}

export function landStrike(m: Match, s: Strike) {
  const { att, def, mv } = s;
  att.hitsDone++;
  att.lastHitT = att.moveT;
  att.connected = true;
  const last = att.hitsDone >= (mv.hits ?? 1);
  applyHit(m, att, def, {
    damage: mv.damage, hitstun: mv.hitstun, blockstun: mv.blockstun, push: mv.push, level: mv.level, knock: mv.knock, chip: mv.chip,
    power: mv.kind === "super" ? 2 : mv.kind === "special" || mv.damage >= 70 ? 1 : 0,
    dir: def.x === att.x ? att.facing : def.x > att.x ? 1 : -1, melee: true, noMeter: mv.kind === "super", id: mv.id, wind: mv.startup,
  }, s.x, s.y, last);
}

/** A command throw: at the end of its startup it grabs whoever is standing in reach. It cannot be blocked or shaken off, but it whiffs badly. */
export function commandGrab(m: Match, f: Fighter, o: Fighter, mv: Move) {
  const reach = (f.def.width + o.def.width) / 2 + (mv.grab ?? 0);
  const ahead = (o.x - f.x) * f.facing;
  const standing = o.y === 0 && (o.state === "idle" || o.state === "walk" || o.state === "crouch" || o.state === "block" || o.state === "dizzy" || o.state === "attack" || o.state === "dash");
  if (o.def.prop || !standing || o.invuln > 0 || o.throwProof > 0 || ahead < 0 || ahead > reach) return;
  f.connected = true;
  if (o.inp.x === -o.facing || o.inp.block || o.state === "block") m.events.push({ type: "caught", side: o.side, why: "throw", x: o.x, y: o.y + o.def.height });
  takeDamage(m, o, mv.damage);
  o.comboTaken = 1;
  f.combo = 1;
  f.comboT = 60;
  f.score += mv.damage * 10;
  f.points.hits += mv.damage * 10;
  gain(o, 8);
  impact(m, o.x, o.y + o.def.height * 0.5, 2);
  feathers(m, o.x, o.y + o.def.height * 0.5, o, 8);
  m.events.push({ type: "throw", side: f.side, damage: mv.damage, move: mv.id });
  if (o.hp <= 0) return knockOut(m, o, f.facing, 3, 11);
  o.move = null;
  setState(o, "launched");
  o.juggle = 99;
  o.slide = 0;
  o.vx = f.facing * 2;
  o.vy = 10.5;
  m.hitstop = 10;
  m.shake = 7;
}

/** Close enough, both off the ground, and the other bird not already tumbling: an air throw is on. */
export function canAirThrow(f: Fighter, o: Fighter): boolean {
  const close = Math.abs(o.x - f.x) < (f.def.width + o.def.width) / 2 + 14 && Math.abs(o.y - f.y) < 40;
  return close && f.y > 20 && o.y > 20 && (o.state === "air" || (o.state === "attack" && o.y > 0)) && o.invuln <= 0 && !o.def.prop;
}

/** Caught in mid-air and slammed to the ground. No tech in the air: it is a punish for a careless jump. */
export function airThrow(m: Match, f: Fighter, o: Fighter) {
  const dmg = Math.round(95 * f.def.power);
  f.airUsed = true;
  f.buf.heavy = 0;
  f.vy = Math.max(f.vy, 3);
  takeDamage(m, o, dmg);
  o.comboTaken = 1;
  f.score += dmg * 10;
  f.points.hits += dmg * 10;
  gain(f, 9);
  gain(o, 6);
  impact(m, o.x, o.y + o.def.height * 0.5, 2);
  feathers(m, o.x, o.y + o.def.height * 0.5, o, 8);
  m.events.push({ type: "throw", side: f.side, damage: dmg }, { type: "word", text: "Air throw!", x: o.x, y: o.y + o.def.height });
  m.hitstop = 10;
  m.shake = 7;
  if (o.hp <= 0) return knockOut(m, o, f.facing, 3, -2);
  o.move = null;
  setState(o, "launched");
  o.juggle = 99;
  o.slide = 0;
  o.vx = f.facing * 3;
  o.vy = -5;
}
