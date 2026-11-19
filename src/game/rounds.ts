import { stepItems } from "./items";
import { type Fighter, type FighterDef, type Input, MAX_METER, MAX_SEP, type Match, type MatchOptions, NO_INPUT, STAGE_W, TPS, ROUND_SECONDS, WALL } from "./types";
import { clock } from "./state";
import { endTargetRound } from "./target";
import { landStrike, strikeOf, tryBurst } from "./combat";
import { spawnAssist, stepShots } from "./shots";
import { newFighter, physics, readButtons, separate, updateFighter } from "./fighter";

// The whole fight lives in one Match object that step() advances by one tick.
// People and the CPU drive it through the same Input, so a test can play thousands
// of CPU-vs-CPU rounds through exactly the code a person plays.

export const INTRO_TICKS = 80;

export const FIGHT_CALL_AT = 52;

export function createMatch(p1: FighterDef, p2: FighterDef, options: MatchOptions): Match {
  const m: Match = {
    f: [newFighter(p1, 0), newFighter(p2, 1)],
    ...(options.rules.tag && options.partners ? tagTeams(p1, p2, options.partners) : {}),
    shots: [],
    items: [],
    phase: "intro", phaseT: 0, round: 0, timer: 0,
    hitstop: 0, superFlash: null, shake: 0, banner: null,
    roundWinner: null, winner: null,
    events: [], tick: 0, rules: options.rules, maxSep: options.maxSep ?? MAX_SEP,
  };
  startRound(m, 1);
  return m;
}

export function startRound(m: Match, n: number) {
  // Tag team: each round starts with the leads in and the partners rested and ready.
  if (m.team) {
    m.f = [m.team[0][0], m.team[1][0]];
    m.bench = [m.team[0][1], m.team[1][1]];
    for (const b of m.bench) {
      b.hp = b.hpGhost = b.restTo = b.def.hp;
      if (n === 1) b.meter = 0;
      b.state = "idle";
      b.move = null;
    }
    m.tagReady = [0, 0];
    m.assistReady = [0, 0];
    m.tagIn = null;
  }
  for (const f of m.f) {
    f.x = STAGE_W / 2 + (f.side === 0 ? -105 : 105) * (m.rules.target ? 0.75 : 1);
    f.y = f.vx = f.vy = f.slide = 0;
    f.facing = f.side === 0 ? 1 : -1;
    f.hp = f.hpGhost = f.def.hp;
    f.state = "idle";
    f.stateT = 0;
    f.move = null;
    f.stun = f.comboTaken = f.combo = f.comboT = f.juggle = f.invuln = f.throwProof = f.flash = 0;
    f.calm = 999;
    f.guard = 100;
    f.daze = 0;
    f.dizzyNext = f.guarding = false;
    f.buf = { light: 0, heavy: 0, special: 0, sup: 0 };
    f.burstUsed = f.enraged = false;
    if (n === 1) f.meter = m.rules.meters?.[f.side] ?? m.rules.startMeter ?? 0;
  }
  m.shots = [];
  m.items = [];
  m.phase = "intro";
  m.phaseT = 0;
  m.round = n;
  m.timer = (m.rules.seconds ?? ROUND_SECONDS) * TPS;
  m.roundWinner = null;
  const decider = m.rules.rounds > 1 && m.f.every((f) => f.wins === m.rules.rounds - 1);
  m.banner = { text: m.rules.opening ?? (decider ? "Final round" : `Round ${n}`), sub: m.rules.openingSub, t: 0, life: FIGHT_CALL_AT };
  m.events.push({ type: "round", n });
}

export function endRound(m: Match) {
  const [a, b] = m.f;
  if (m.rules.target) return endTargetRound(m);
  // In a tag match a side's health is the pair's, together.
  const share = (i: 0 | 1) => (m.team ? (m.team[i][0].hp + m.team[i][1].hp) / (m.team[i][0].def.hp + m.team[i][1].def.hp) : m.f[i].hp / m.f[i].def.hp);
  const ra = share(0);
  const rb = share(1);
  void a;
  void b;
  const w: 0 | 1 | null = ra === rb ? null : ra > rb ? 0 : 1;
  m.roundWinner = w;
  m.phase = "roundEnd";
  m.phaseT = 0;
  if (w === null) {
    m.banner = { text: "Draw", sub: "Go again", t: 0, life: 120 };
    m.events.push({ type: "roundWon", side: null, perfect: false });
    return;
  }
  const winner = m.f[w];
  winner.wins++;
  const perfect = winner.hp === winner.def.hp;
  winner.points.time += clock(m) * 50;
  winner.points.perfect += perfect ? 5000 : 0;
  winner.score += clock(m) * 50 + (perfect ? 5000 : 0);
  m.banner = { text: `${winner.def.name} wins`, sub: perfect ? "Not a feather out of place" : undefined, t: 0, life: 130 };
  m.events.push({ type: "roundWon", side: w, perfect });
}

export function nextRound(m: Match) {
  const champ = m.f.find((f) => f.wins >= m.rules.rounds);
  if (champ) {
    m.phase = "matchEnd";
    m.phaseT = 0;
    m.winner = champ.side;
    m.events.push({ type: "matchWon", side: champ.side });
  } else {
    startRound(m, m.round + 1);
  }
}

/** Advances the match by one tick (1/60 s). */
export function step(m: Match, in0: Input, in1: Input): void {
  // The first step keeps the events createMatch queued (the opening round call).
  if (m.tick > 0) m.events.length = 0;
  m.tick++;
  readButtons(m.f[0], in0);
  readButtons(m.f[1], in1);
  if (m.phase === "fight") {
    tryBurst(m, m.f[0], m.f[1]);
    tryBurst(m, m.f[1], m.f[0]);
    // Tag before anything else reads the buttons: Peck and Kick together would otherwise start a kick.
    if (m.team && !m.tagIn) {
      for (const side of [0, 1] as const) {
        tryTag(m, side);
        tryAssist(m, side);
      }
    }
  }
  if (m.banner && ++m.banner.t >= m.banner.life) m.banner = null;
  m.shake = m.shake < 0.4 ? 0 : m.shake * 0.86;
  for (const f of m.f) {
    if (f.flash > 0) f.flash--;
    if (f.comboT > 0 && --f.comboT === 0) f.combo = 0;
    if (f.calm > 50 && f.daze > 0) f.daze = Math.max(0, f.daze - 2);
    if (++f.guardRest > 70 && f.guard < 100) f.guard = Math.min(100, f.guard + 0.8);
    if (f.hpGhost < f.hp) f.hpGhost = f.hp;
    else if (f.hpGhost > f.hp && f.calm > 32) f.hpGhost = Math.max(f.hp, f.hpGhost - Math.max(4, (f.hpGhost - f.hp) * 0.12));
  }
  if (m.superFlash) {
    if (--m.superFlash.t <= 0) m.superFlash = null;
    return;
  }
  if (m.hitstop > 0) {
    m.hitstop--;
    return;
  }

  switch (m.phase) {
    case "intro":
      m.phaseT++;
      if (m.phaseT === FIGHT_CALL_AT) {
        m.banner = { text: "Peck!", t: 0, life: 40 };
        m.events.push({ type: "fight" });
      }
      if (m.phaseT >= INTRO_TICKS) {
        m.phase = "fight";
        m.phaseT = 0;
      }
      break;
    case "fight":
      if (m.rules.seconds !== null && --m.timer <= 0) {
        m.phase = "timeup";
        m.phaseT = 0;
        m.banner = { text: "Time’s up", t: 0, life: 80 };
        m.events.push({ type: "timeup" });
      }
      break;
    case "ko":
      m.phaseT++;
      // Slow motion while the loser is still in the air.
      if (m.phaseT < 54 && m.phaseT % 3 !== 0) return;
      if (m.phaseT >= 125) endRound(m);
      break;
    case "timeup":
      if (++m.phaseT >= 85) endRound(m);
      break;
    case "roundEnd":
      if (++m.phaseT >= 150) nextRound(m);
      break;
    case "matchEnd":
      m.phaseT++;
      break;
  }

  const live = m.phase === "fight";
  const [a, b] = m.f;
  const ax0 = a.x;
  const bx0 = b.x;
  updateFighter(m, a, b, live ? in0 : NO_INPUT);
  updateFighter(m, b, a, live ? in1 : NO_INPUT);
  physics(m, a);
  physics(m, b);
  separate(a, b, ax0, bx0, m.maxSep);

  if (live) {
    // Work out both strikes before applying either, so simultaneous hits trade.
    const s0 = strikeOf(a, b);
    const s1 = strikeOf(b, a);
    if (s0) landStrike(m, s0);
    if (s1) landStrike(m, s1);
    if (m.rules.boss !== undefined) bossPhase(m, m.f[m.rules.boss]);
  }
  if (m.team) stepTag(m);
  stepShots(m);
  if (m.rules.pickups) stepItems(m);

  if (m.rules.refill) {
    for (const f of m.f) {
      if (f.calm > 110 && f.hp < f.def.hp) f.hp = Math.min(f.def.hp, f.hp + 14);
      f.meter = Math.min(MAX_METER, f.meter + 0.5);
    }
  }
}

/** A boss at half health gets serious, once a round: faster, harder-hitting, and with a full meter. */
function bossPhase(m: Match, f: Fighter) {
  if (f.enraged || f.hp <= 0 || f.hp >= f.def.hp / 2) return;
  f.enraged = true;
  f.meter = MAX_METER;
  f.flash = 12;
  m.hitstop = Math.max(m.hitstop, 24);
  m.shake = Math.max(m.shake, 10);
  m.banner = { text: `${f.def.name} gets serious!`, t: 0, life: 70 };
  m.events.push({ type: "phase", side: f.side });
}

/** The two pairs for a tag match, each with its lead in front. */
function tagTeams(p1: FighterDef, p2: FighterDef, partners: [FighterDef, FighterDef]): Pick<Match, "team" | "bench" | "tagReady" | "assistReady" | "tagIn"> {
  const team: [[Fighter, Fighter], [Fighter, Fighter]] = [
    [newFighter(p1, 0), newFighter(partners[0], 0)],
    [newFighter(p2, 1), newFighter(partners[1], 1)],
  ];
  return { team, bench: [team[0][1], team[1][1]], tagReady: [0, 0], assistReady: [0, 0], tagIn: null };
}

/** How long after a tag before that side can tag again. */
const TAG_COOLDOWN = 150;

/**
 * Tag team, once a tick: benched birds rest, Peck and Kick together swaps a free bird for its
 * partner, and a knocked-out bird is replaced once it has landed.
 */
function stepTag(m: Match) {
  const ready = m.tagReady!;
  for (const b of m.bench!) if (b.hp > 0 && b.hp < b.restTo) b.hp = b.hpGhost = Math.min(b.restTo, b.hp + 0.35);
  for (const side of [0, 1] as const) {
    if (ready[side] > 0) ready[side]--;
    if (m.assistReady![side] > 0) m.assistReady![side]--;
  }
  if (m.tagIn && --m.tagIn.t <= 0) {
    swap(m, m.tagIn.side, false);
    m.tagIn = null;
  }
}

/** A voluntary tag: a free bird, Peck and Kick together, the partner fit, and the side not too recently tagged. */
function tryTag(m: Match, side: 0 | 1) {
  const f = m.f[side];
  const free = f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "land";
  if (free && m.tagReady![side] === 0 && m.bench![side].hp > 0 && f.buf.light > 0 && f.buf.heavy > 0) swap(m, side, true);
}

/** Puts the benched bird in and takes the active one out. A voluntary tag lets the one leaving rest. */
function swap(m: Match, side: 0 | 1, rest: boolean) {
  const out = m.f[side];
  const into = m.bench![side];
  const facing = out.facing;
  // The one coming in drops in from behind the one going out.
  into.x = Math.max(WALL + 30, Math.min(STAGE_W - WALL - 30, out.x - facing * 30));
  into.y = 90;
  into.vx = facing * 2;
  into.vy = 0;
  into.facing = facing;
  into.state = "air";
  into.stateT = 0;
  into.move = null;
  into.airUsed = true;
  into.invuln = 30;
  into.stun = into.juggle = into.comboTaken = into.slide = 0;
  into.buf = { light: 0, heavy: 0, special: 0, sup: 0 };
  // Leaving by choice, a bird can win back half of what it had lost while it rests.
  out.restTo = rest ? out.hp + (out.def.hp - out.hp) * 0.5 : 0;
  out.move = null;
  out.state = "idle";
  m.f[side] = into;
  m.bench![side] = out;
  m.tagReady![side] = TAG_COOLDOWN;
  m.events.push({ type: "tag", side });
}

/** How long after an assist before that side can call another. */
const ASSIST_COOLDOWN = 360;

/** Kick and Special together calls the partner in for one charge across the arena, if it is fit and rested. */
function tryAssist(m: Match, side: 0 | 1) {
  const f = m.f[side];
  const partner = m.bench![side];
  const free = f.state === "idle" || f.state === "walk" || f.state === "crouch" || f.state === "land";
  if (!free || m.assistReady![side] > 0 || partner.hp <= 0 || f.buf.heavy <= 0 || f.buf.special <= 0) return;
  f.buf.heavy = f.buf.special = 0;
  spawnAssist(m, f, partner);
  m.assistReady![side] = ASSIST_COOLDOWN;
}
