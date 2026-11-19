import type { Fighter, Match } from "./types";

// Saving a match's state and putting it back, for rollback.
//
// A fresh snapshot is made every tick. Reusing old ones was tried and measured: it halved the
// (already rare) garbage collections but the in-place copying cost several times what they did. A match is plain data apart from
// its references to fighter definitions and moves, which never change and are kept as they are.

export type Snapshot = Omit<Match, "events" | "rules" | "maxSep">;

const copyFighter = (f: Fighter): Fighter => ({ ...f, buf: { ...f.buf }, points: { ...f.points } });

export function snapshot(m: Match): Snapshot {
  return {
    f: [copyFighter(m.f[0]), copyFighter(m.f[1])],
    shots: m.shots.map((s) => ({ ...s })),
    items: m.items.map((i) => ({ ...i })),
    phase: m.phase, phaseT: m.phaseT, round: m.round, timer: m.timer, hitstop: m.hitstop,
    superFlash: m.superFlash && { ...m.superFlash }, shake: m.shake, banner: m.banner && { ...m.banner },
    roundWinner: m.roundWinner, winner: m.winner, tick: m.tick,
  };
}

/** Puts a match back as it was. The fighter objects themselves are kept, so anything holding on to them stays valid. */
export function restore(m: Match, s: Snapshot): void {
  Object.assign(m.f[0], copyFighter(s.f[0]));
  Object.assign(m.f[1], copyFighter(s.f[1]));
  m.shots = s.shots.map((x) => ({ ...x }));
  m.items = s.items.map((x) => ({ ...x }));
  m.phase = s.phase;
  m.phaseT = s.phaseT;
  m.round = s.round;
  m.timer = s.timer;
  m.hitstop = s.hitstop;
  m.superFlash = s.superFlash && { ...s.superFlash };
  m.shake = s.shake;
  m.banner = s.banner && { ...s.banner };
  m.roundWinner = s.roundWinner;
  m.winner = s.winner;
  m.tick = s.tick;
}
