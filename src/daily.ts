import { ROSTER, type CpuLevel, type FighterDef, type Rules } from "./game";

// The daily challenge: one fight, the same for everyone on a given day, with a twist.
// It is worked out from the date alone, so there is nothing to download.

export interface Twist {
  label: string;
  rounds: number;
  /** Start with this share of your health. */
  health: number;
  cpu: CpuLevel;
  /** Rules beyond the ordinary, and a narrower space, for the twists that need them. */
  rules?: Partial<Rules>;
  maxSep?: number;
}

const TWISTS: Twist[] = [
  { label: "Half health: you start on half a bar, one round", rounds: 1, health: 0.5, cpu: 1 },
  { label: "Sudden death: one round decides it", rounds: 1, health: 1, cpu: 1 },
  { label: "Long haul: first to three rounds", rounds: 3, health: 1, cpu: 1 },
  { label: "Underdog: the CPU plays at Rooster level", rounds: 2, health: 1, cpu: 2 },
  { label: "By the book: no throws", rounds: 2, health: 1, cpu: 1, rules: { noThrows: true } },
  { label: "Warm start: both crow meters begin full", rounds: 2, health: 1, cpu: 1, rules: { startMeter: 100 } },
  { label: "Tight squeeze: nowhere to back away to", rounds: 2, health: 1, cpu: 1, maxSep: 250 },
  { label: "Sprint: 30-second rounds", rounds: 2, health: 1, cpu: 1, rules: { seconds: 30 } },
];

export interface Daily {
  /** The day it belongs to, as YYYY-MM-DD in local time. */
  date: string;
  you: FighterDef;
  them: FighterDef;
  stage: number;
  twist: Twist;
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function dailyFor(day: Date): Daily {
  const date = dayKey(day);
  let h = 2166136261;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619) >>> 0;
  const you = h % ROSTER.length;
  // Never yourself: step on by at least one place, and by fewer than the whole roster.
  const them = (you + 1 + ((h >>> 5) % (ROSTER.length - 1))) % ROSTER.length;
  return { date, you: ROSTER[you], them: ROSTER[them], stage: (h >>> 9) % 4, twist: TWISTS[(h >>> 12) % TWISTS.length] };
}

/** Whether `earlier` is the day before `later` (both YYYY-MM-DD). */
export function isDayBefore(earlier: string, later: string): boolean {
  const d = new Date(`${later}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dayKey(d) === earlier;
}
