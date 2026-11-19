import { type Fighter, type Match } from "./types";
import { HITSTOP, clock, feathers, impact, setState } from "./state";

// The bonus round's scarecrow. It stands in player 2's place but is not a fighter:
// it never acts, cannot be thrown, blocked against or knocked about, and is worth points, not a round.

/** A target only wobbles when struck. */
export function updateTarget(f: Fighter) {
  f.vx = 0;
  if (f.state === "hit" && --f.stun <= 0) setState(f, "idle");
}

/** Soaks up a hit (the damage is already taken), sheds straw, and falls apart when its health runs out. */
export function hitTarget(m: Match, target: Fighter, power: 0 | 1 | 2, move: string, x: number, y: number) {
  impact(m, x, y, power);
  feathers(m, x, y, target, 3 + power * 2);
  m.events.push({ type: "hit", power, side: target.side, move, combo: 1, damage: 0 });
  setState(target, target.hp <= 0 ? "ko" : "hit");
  target.stun = 10;
  m.hitstop = Math.max(m.hitstop, HITSTOP[power]);
  m.shake = Math.max(m.shake, 2 + power * 2);
  if (target.hp <= 0 && m.phase === "fight") {
    m.phase = "ko";
    m.phaseT = 0;
    m.banner = { text: "Smashed!", t: 0, life: 110 };
    m.shake = 10;
    feathers(m, target.x, target.def.height * 0.5, target, 16);
    m.events.push({ type: "ko", side: target.side });
  }
}

/** A round against a target has no loser: it is all points. */
export function endTargetRound(m: Match) {
  const [player, target] = m.f;
  const smashed = target.hp <= 0;
  const points = smashed ? 5000 + clock(m) * 200 : 0;
  player.score += points;
  player.points.bonus += points;
  player.wins = m.rules.rounds;
  m.roundWinner = 0;
  m.phase = "roundEnd";
  m.phaseT = 0;
  m.banner = { text: smashed ? "Scarecrow down" : "Time’s up", sub: smashed ? `${points.toLocaleString("en")} bonus points` : "No bonus this time", t: 0, life: 130 };
  m.events.push({ type: "roundWon", side: 0, perfect: false });
}
