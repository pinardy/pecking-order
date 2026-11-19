import { BOSS, ROSTER, fighterById, type CpuLevel, type FighterDef } from "./game";

// The arcade ladder as plain data and pure functions: no React, no storage, nothing random
// unless you hand it a random source. The app saves a Run as it stands and asks what comes next.

export const LADDER_FIGHTS = 5;
/** The bonus round comes after this many wins. */
const BONUS_AFTER = 2;
/** Arenas for the fights before the last; the final opponent is met in the henhouse. */
const STAGES = [0, 1, 3];
const FINAL_STAGE = 2;

/** A run in progress: who is climbing, who is in the way, and how it is going. */
export interface Run {
  p1: string;
  /** Opponents in the order they are fought. */
  ladder: string[];
  /** The fight to play next. */
  rung: number;
  level: CpuLevel;
  /** Points banked from the fights already won. */
  score: number;
  /** The bonus round comes before the next fight. */
  bonus: boolean;
  /** Times the next fight has been lost. After every second loss the CPU drops a level for that fight. */
  tries?: number;
  /** Climbing in alternate feathers. */
  alt?: boolean;
  /** A story mode climb, told in scenes between the fights, rather than an arcade run. */
  story?: boolean;
  /** Replaying one chapter of a story already played: it leaves the story in progress alone. */
  chapter?: boolean;
}

export type Step =
  | { kind: "bonus" }
  | { kind: "fight"; opponent: FighterDef; cpu: CpuLevel; stage: number; final: boolean };

/** A new run: four of the others in a random order, then Old Spur. */
/**
 * Everyone has a rival: the one bird in the yard they cannot leave alone. The rival is always the
 * fourth fight, the last before the top. (Old Spur's is Duke, who is waiting for him at the end instead.)
 */
export const RIVALS: Record<string, string> = {
  henrietta: "dot", dot: "henrietta",
  rusty: "ziggy", ziggy: "rusty",
  pip: "duke", duke: "pip",
  shelly: "goldie", goldie: "shelly",
};

/** The run's rival, if the fight at this rung is against them. */
export const rivalAt = (run: Run, rung = run.rung): string | null => (rung === LADDER_FIGHTS - 2 && run.ladder[rung] === RIVALS[run.p1] ? run.ladder[rung] : null);

export function startRun(player: FighterDef, level: CpuLevel, random: () => number = Math.random): Run {
  // Old Spur, playing arcade himself, finds Duke waiting at the top instead.
  const boss = player.id === BOSS.id ? "duke" : BOSS.id;
  const rival = RIVALS[player.id];
  const rest = ROSTER.filter((f) => f.id !== player.id && f.id !== boss && f.id !== rival).map((f) => f.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  // Three (or, with no rival, four) of the others in a random order, then the rival, then the top.
  const early = rest.slice(0, LADDER_FIGHTS - (rival ? 2 : 1));
  return { p1: player.id, ladder: [...early, ...(rival ? [rival] : []), boss], rung: 0, level, score: 0, bonus: false };
}

export const isFinal = (run: Run) => run.rung === run.ladder.length - 1;

/** What the run calls for now. */
export function nextStep(run: Run): Step {
  if (run.bonus) return { kind: "bonus" };
  const final = isFinal(run);
  return {
    kind: "fight",
    opponent: fighterById(run.ladder[run.rung]),
    // The final opponent plays one level above the rest of the run. Losing twice to anyone brings them down a level.
    cpu: Math.max(0, (final ? Math.min(3, run.level + 1) : run.level) - Math.floor((run.tries ?? 0) / 2)) as CpuLevel,
    stage: final ? FINAL_STAGE : STAGES[run.rung % STAGES.length],
    final,
  };
}

/**
 * The run after a fight. Winning moves up a rung and banks the score; winning the last fight
 * clears the ladder (null). Losing leaves the run on the same rung, with the loss noted.
 */
export function afterFight(run: Run, won: boolean, score: number): Run | null {
  if (!won) return { ...run, tries: (run.tries ?? 0) + 1 };
  if (isFinal(run)) return null;
  const rung = run.rung + 1;
  return { ...run, rung, score, bonus: rung === BONUS_AFTER, tries: 0 };
}

/** The bonus round only adds to the score. */
export const afterBonus = (run: Run, score: number): Run => ({ ...run, score, bonus: false });
