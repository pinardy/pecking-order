import { BUTTONS, type Fighter, type FighterDef, GRAVITY, type Input, MAX_METER, type Match, type Move, NO_INPUT, WALL } from "./types";
import { BUFFER, DIZZY_TICKS, MAX_X, THROW, begin, clampX, dust, finish, recover, setState, setStateOnce, toPhase, EX_COST } from "./state";
import { reachOf } from "./geometry";
import { updateTarget } from "./target";
import { airThrow, canAirThrow, canThrow, commandGrab, finishThrow, grab, techThrow } from "./combat";
import { fireShots, hasShot } from "./shots";

// One fighter for one tick: reading the stick and buttons, the state machine, moves in progress, and movement.

export function newFighter(def: FighterDef, side: 0 | 1): Fighter {
  return {
    def, side,
    x: 0, y: 0, vx: 0, vy: 0, slide: 0, facing: side === 0 ? 1 : -1,
    hp: def.hp, hpGhost: def.hp, meter: 0,
    state: "idle", stateT: 0,
    move: null, phase: "startup", phaseT: 0, moveT: 0, moveSerial: 0,
    connected: false, hitsDone: 0, lastHitT: -999,
    stun: 0, comboTaken: 0, combo: 0, comboT: 0, juggle: 0, invuln: 0, throwProof: 0,
    points: { hits: 0, time: 0, perfect: 0, bonus: 0 },
    guardHeld: 0, rollDir: 0, lateRise: false, bounced: false, burstUsed: false, enraged: false, restTo: 0,
    guard: 100, guardRest: 0, guarding: false, daze: 0, dizzyNext: false, dashDir: 1, tapDir: 0, tapT: -99, lastX: 0, throwDir: 1, score: 0,
    airUsed: false, jumpDir: 0, crouchBlock: false, flash: 0, calm: 999,
    buf: { light: 0, heavy: 0, special: 0, sup: 0 },
    prev: NO_INPUT, inp: NO_INPUT, wins: 0,
  };
}

export function pickSpecial(m: Match, f: Fighter, input: Input): Move | null {
  if (f.buf.sup) {
    // Crow alone spends the whole meter on the super. With a direction it spends half on a charged special.
    const which = input.y < 0 ? 2 : input.x === f.facing ? 1 : input.x === -f.facing ? 0 : -1;
    if (which < 0) {
      if (f.meter >= MAX_METER) return f.def.super;
    } else if (f.meter >= EX_COST) {
      const mv = f.def.ex[which as 0 | 1 | 2];
      if (!(mv.shot && hasShot(m, f.side))) return mv;
    }
  }
  if (!f.buf.special) return null;
  const mv = input.y < 0 ? f.def.specials[2] : input.x === f.facing ? f.def.specials[1] : f.def.specials[0];
  // One shot in the air per fighter.
  return mv.shot && hasShot(m, f.side) ? null : mv;
}

export function startAttack(m: Match, f: Fighter, o: Fighter, input: Input): boolean {
  const sp = pickSpecial(m, f, input);
  if (sp) {
    begin(m, f, sp);
    return true;
  }
  const n = f.def.normals;
  const crouch = input.y < 0;
  if (f.buf.heavy) {
    // Down and toward with Kick: the launcher, which pops the opponent up for a follow-up in the air.
    if (crouch && input.x === f.facing) begin(m, f, n.launch);
    else if (!crouch && input.x !== 0 && !m.rules.noThrows && canThrow(f, o)) grab(m, f, o, input.x);
    else begin(m, f, crouch ? n.cHeavy : n.sHeavy);
    return true;
  }
  if (f.buf.light) {
    begin(m, f, crouch ? n.cLight : n.sLight);
    return true;
  }
  return false;
}

export function updateMove(m: Match, f: Fighter, o: Fighter, input: Input) {
  const mv = f.move!;
  f.phaseT++;
  f.moveT++;
  if (mv === THROW && f.phase === "startup" && f.phaseT >= mv.startup) finishThrow(m, f, o);
  if (mv.dive) {
    if (f.phase === "startup") {
      // Hang in the air for a beat, then drop.
      f.vx = f.vy = 0;
      if (f.phaseT >= mv.startup) {
        toPhase(f, "active");
        f.vx = f.facing * mv.dive.vx;
      }
    } else if (f.phase === "active") {
      f.vy = -mv.dive.vy;
    } else {
      f.vx = 0;
      if (f.phaseT >= mv.recovery) finish(f);
    }
  } else if (mv.leap) {
    if (f.phase === "startup") {
      f.vx = 0;
      if (f.phaseT >= mv.startup) {
        toPhase(f, "active");
        f.vy = mv.leap.vy;
        f.vx = f.facing * mv.leap.vx;
        m.events.push({ type: "jump" });
      }
    } else if (f.phase === "recovery") {
      f.vx = 0;
      if (f.phaseT >= mv.recovery) finish(f);
    }
  } else if (mv.air) {
    if (f.phase === "startup" && f.phaseT >= mv.startup) toPhase(f, "active");
    else if (f.phase === "active" && f.phaseT >= mv.active) toPhase(f, "recovery");
    else if (f.phase === "recovery" && f.phaseT >= mv.recovery) {
      f.move = null;
      setState(f, "air");
    }
  } else if (f.phase === "startup") {
    f.vx = 0;
    if (f.phaseT >= mv.startup) {
      toPhase(f, "active");
      if (mv.grab !== undefined) commandGrab(m, f, o, mv);
    }
  } else if (f.phase === "active") {
    f.vx = mv.dash ? f.facing * mv.dash : 0;
    if (mv.dash && f.moveT % 4 === 0) dust(m, f.x - f.facing * 14, 1);
    if (f.phaseT >= mv.active) toPhase(f, "recovery");
  } else {
    f.vx = mv.dash ? f.vx * 0.7 : 0;
    if (f.phaseT >= mv.recovery) finish(f);
  }
  if (f.move === mv && mv.shot) fireShots(m, f, mv);
  // A normal that touched the opponent can be cut short into a special.
  if (f.move === mv && mv.cancel && f.connected && m.phase === "fight") {
    const sp = pickSpecial(m, f, input);
    if (sp) begin(m, f, sp);
  } else if (f.move === mv && mv.kind === "special" && f.connected && f.y === 0 && f.buf.sup && f.meter >= MAX_METER && m.phase === "fight") {
    // A special that touched the opponent can itself be cut short into the super.
    begin(m, f, f.def.super);
  }
}

export function updateFighter(m: Match, f: Fighter, o: Fighter, input: Input) {
  for (const b of BUTTONS) if (f.buf[b] > 0) f.buf[b]--;
  f.inp = input;
  f.guardHeld = input.block || input.x === -f.facing ? f.guardHeld + 1 : 0;
  f.stateT++;
  f.calm++;
  if (f.invuln > 0) f.invuln--;
  if (f.throwProof > 0) f.throwProof--;
  const live = m.phase === "fight";
  f.guarding = false;
  if (f.def.prop) return updateTarget(f);
  // Two taps the same way in quick succession is a dash.
  let dash: -1 | 0 | 1 = 0;
  if (input.x !== 0 && input.x !== f.lastX) {
    if (f.tapDir === input.x && m.tick - f.tapT <= 12) {
      dash = input.x;
      f.tapDir = 0;
    } else {
      f.tapDir = input.x;
      f.tapT = m.tick;
    }
  }
  f.lastX = input.x;

  switch (f.state) {
    case "idle":
    case "walk":
    case "crouch": {
      if (o.x !== f.x) f.facing = o.x > f.x ? 1 : -1;
      if (!live) {
        f.vx = 0;
        if (m.phase === "roundEnd" || m.phase === "matchEnd") setState(f, m.roundWinner === f.side ? "win" : "lose");
        else if (f.state !== "idle") setState(f, "idle");
        break;
      }
      if (startAttack(m, f, o, input)) break;
      if (dash !== 0 && input.y === 0) {
        setState(f, "dash");
        f.dashDir = dash;
        // Hopping back slips through attacks for a moment.
        if (dash !== f.facing) f.invuln = Math.max(f.invuln, 7);
        dust(m, f.x, 2);
        m.events.push({ type: "dash" });
        break;
      }
      // Holding back with an attack on the way: stand and guard rather than walk off.
      const incoming = o.state === "attack" && o.move && o.phase !== "recovery" && o.move.kind !== "throw" && Math.abs(o.x - f.x) < reachOf(o.move) + f.def.width / 2 + 30;
      if (input.block || (incoming && input.x === -f.facing)) {
        f.guarding = true;
        f.vx = 0;
        setStateOnce(f, input.y < 0 ? "crouch" : "idle");
        break;
      }
      if (input.y > 0) {
        setState(f, "prejump");
        f.jumpDir = input.x;
        f.vx = 0;
      } else if (input.y < 0) {
        if (f.state !== "crouch") setState(f, "crouch");
        // Chicks can scurry along while crouched, under anything aimed at a grown bird's head.
        f.vx = f.def.breed === "chick" ? input.x * f.def.speed * 0.55 : 0;
      } else if (input.x !== 0) {
        if (f.state !== "walk") setState(f, "walk");
        f.vx = input.x * f.def.speed * (input.x === f.facing ? 1 : 0.8) * (f.enraged ? 1.1 : 1);
      } else {
        if (f.state !== "idle") setState(f, "idle");
        f.vx = 0;
      }
      break;
    }
    case "prejump":
      if (f.stateT >= 3) {
        setState(f, "air");
        f.vy = f.def.jump;
        // A rooster's hop carries further.
        f.vx = f.jumpDir * f.def.speed * (f.def.breed === "rooster" ? 1.4 : 1.15);
        f.airUsed = false;
        m.events.push({ type: "jump" });
      }
      break;
    case "air":
      // Hens flutter: holding up slows the fall.
      if (f.def.breed === "hen" && input.y > 0 && f.vy < -2.2) f.vy = -2.2;
      if (live && !f.airUsed) {
        if (f.buf.heavy && input.x === f.facing && !m.rules.noThrows && canAirThrow(f, o)) airThrow(m, f, o);
        else if (f.buf.special && f.y > 34) begin(m, f, f.def.air);
        else if (f.buf.heavy) begin(m, f, f.def.normals.jHeavy);
        else if (f.buf.light) begin(m, f, f.def.normals.jLight);
      }
      break;
    case "land":
      f.vx = 0;
      if (f.stateT >= 3) setState(f, "idle");
      break;
    case "attack":
      updateMove(m, f, o, input);
      break;
    case "dash": {
      const forward = f.dashDir === f.facing;
      f.vx = f.dashDir * (3.2 + f.def.speed) * (forward ? 1.25 : 1.1);
      // A forward dash can be cut short into an attack.
      if (forward && live && f.stateT >= 5 && startAttack(m, f, o, input)) break;
      if (f.stateT >= (forward ? 13 : 15)) {
        f.vx = 0;
        setState(f, "idle");
      }
      break;
    }
    case "grabbed":
      f.vx = 0;
      if (o.move !== THROW || o.state !== "attack") recover(f);
      else if (f.buf.heavy > 0) techThrow(m, f, o);
      break;
    case "hit":
    case "block":
    case "dizzy":
      f.vx = 0;
      if (--f.stun <= 0) recover(f);
      break;
    case "down":
      f.vx = 0;
      // Getting up is a choice: hold down to stay on the floor a little longer (once), or a direction to roll that way.
      if (f.stateT === 30 && input.y < 0) f.lateRise = true;
      if (f.stateT >= (f.lateRise ? 46 : 30)) {
        setState(f, "getup");
        f.invuln = 24;
        f.rollDir = input.x;
        f.lateRise = false;
      }
      break;
    case "getup":
      f.vx = f.rollDir * 3.6;
      if (f.stateT >= 18) {
        f.vx = 0;
        recover(f);
        if (f.dizzyNext && live) {
          f.dizzyNext = false;
          setState(f, "dizzy");
          f.stun = DIZZY_TICKS;
          m.events.push({ type: "dizzy", side: f.side });
        } else f.throwProof = 14;
      }
      break;
    case "launched":
      break;
    default:
      f.vx = 0;
  }
}

export function land(m: Match, f: Fighter) {
  if (f.state === "air") {
    setState(f, "land");
    f.vx = 0;
    dust(m, f.x, 2);
    m.events.push({ type: "land" });
  } else if (f.state === "attack") {
    f.vx = 0;
    if (f.move?.leap || f.move?.dive) {
      toPhase(f, "recovery");
      if (f.move.leap?.fallOnly) {
        dust(m, f.x, 7, 2);
        m.shake = Math.max(m.shake, 5);
      }
      m.events.push({ type: "land" });
    } else {
      f.move = null;
      setState(f, "land");
    }
  } else if (f.state === "launched") {
    f.vx = 0;
    setState(f, f.hp <= 0 ? "ko" : "down");
    dust(m, f.x, 6, 1.6);
    m.shake = Math.max(m.shake, 4);
    m.events.push({ type: "down" });
  }
}

export function physics(m: Match, f: Fighter) {
  f.x += f.vx + f.slide;
  if (f.state !== "launched") f.bounced = false;
  else if (m.rules.bounce && !f.bounced && f.y > 16 && Math.abs(f.vx) > 2 && (f.x < WALL || f.x > MAX_X)) {
    // Knocked into the wall: once per knockdown they come back off it, and can be hit again on the way.
    f.bounced = true;
    f.vx = -f.vx * 0.6;
    f.vy = Math.max(f.vy, 5.5);
    f.juggle = Math.max(0, f.juggle - 1);
    m.shake = Math.max(m.shake, 6);
    dust(m, f.x, 5, 1.5);
    m.events.push({ type: "word", text: "Wall!", x: f.x + (f.x < WALL ? 30 : -30), y: f.y + f.def.height });
  }
  f.slide *= 0.8;
  if (Math.abs(f.slide) < 0.05) f.slide = 0;
  if (f.y > 0 || f.vy > 0) {
    f.y += f.vy;
    f.vy -= GRAVITY;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      land(m, f);
    }
  }
}

/** Keeps the two bodies from overlapping, inside the arena, and within one screen of each other. */
export function separate(a: Fighter, b: Fighter, ax0: number, bx0: number, maxSep: number) {
  clampX(a);
  clampX(b);
  // Nobody blocks the way of someone in the air from a knockdown, or rolling as they get up.
  const ghost = (f: Fighter) => f.state === "launched" || (f.state === "getup" && f.rollDir !== 0);
  const solid = !ghost(a) && !ghost(b);
  if (solid && a.y < b.def.height * 0.75 && b.y < a.def.height * 0.75) {
    const min = (a.def.width + b.def.width) * 0.45;
    const dx = b.x - a.x;
    if (Math.abs(dx) < min) {
      const dir = dx > 0 ? 1 : dx < 0 ? -1 : a.side === 0 ? 1 : -1;
      const push = (min - Math.abs(dx)) / 2;
      // A prop stays put: the fighter gives all the ground.
      const share = b.def.prop ? 2 : a.def.prop ? 0 : 1;
      a.x -= dir * push * share;
      b.x += dir * push * (2 - share);
      for (const [p, q] of [[a, b], [b, a]] as const) {
        if (p.x < WALL) {
          q.x += WALL - p.x;
          p.x = WALL;
        } else if (p.x > MAX_X) {
          q.x -= p.x - MAX_X;
          p.x = MAX_X;
        }
      }
    }
  }
  // Too far apart: whoever moved away this tick gives the distance back.
  let excess = Math.abs(b.x - a.x) - maxSep;
  if (excess <= 0) return;
  const sign = b.x > a.x ? 1 : -1;
  const giveA = Math.min(excess, Math.max(0, (ax0 - a.x) * sign));
  a.x += giveA * sign;
  excess -= giveA;
  const giveB = Math.min(excess, Math.max(0, (b.x - bx0) * sign));
  b.x -= giveB * sign;
  excess -= giveB;
  a.x += (excess / 2) * sign;
  b.x -= (excess / 2) * sign;
}

/** Notes fresh button presses. Runs every tick, freeze-frames included, so no press is lost. */
export function readButtons(f: Fighter, input: Input) {
  for (const b of BUTTONS) if (input[b] && !f.prev[b]) f.buf[b] = BUFFER + 1;
  f.prev = input;
}
