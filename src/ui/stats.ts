import type { Run } from "../arcade";
import { isDayBefore } from "../daily";
import { fighterById } from "../game";
import { read, remove, write } from "./store";

// Lifetime tally on this device: shown on the title screen, and what unlocks things.

export interface Stats {
  /** Matches against the CPU, and how many of them were won. */
  fights: number;
  wins: number;
  /** Arcade ladders cleared, by CPU level (Chick, Hen, Rooster). */
  clears: [number, number, number, number];
  /** Wins in a row against the CPU, now and at best. */
  streak: number;
  bestStreak: number;
  /** Highest arcade score. */
  best: number;
  /** Most fights won in a row in survival, and the quickest time attack in ticks (0 if none yet). */
  survival: number;
  timeAttack: number;
  /** The same, fighter by fighter. */
  fighters: Record<string, { fights: number; wins: number }>;
  /** Fighters who have cleared arcade. Clearing it unlocks their alternate feathers; the first clear unlocks Old Spur. */
  cleared: string[];
  /** Fighters whose story has been finished: each leaves an ending to watch again. */
  stories: string[];
  /** Boss rush: the most fights won in one go, and whether it has been cleared. */
  bossRush: { best: number; cleared: boolean };
  /** Story chapters won, fighter by fighter: who was beaten in each, in order. Each one can be played again. */
  chapters: Record<string, string[]>;
  /** The last daily challenge won, and how many days running. */
  daily: { last: string; streak: number };
}

const VERSION = 2;
const empty = (): Stats => ({ fights: 0, wins: 0, clears: [0, 0, 0, 0], streak: 0, bestStreak: 0, best: 0, survival: 0, timeAttack: 0, fighters: {}, cleared: [], stories: [], chapters: {}, bossRush: { best: 0, cleared: false }, daily: { last: "", streak: 0 } });

export const loadStats = (): Stats => read("stats", VERSION, empty());
const save = (s: Stats) => void write("stats", VERSION, s);

function change(edit: (s: Stats) => void): Stats {
  const s = loadStats();
  edit(s);
  save(s);
  return s;
}

export const recordFight = (won: boolean, fighter: string) =>
  change((s) => {
    const mine = (s.fighters[fighter] ??= { fights: 0, wins: 0 });
    s.fights++;
    mine.fights++;
    if (won) {
      s.wins++;
      mine.wins++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
    } else s.streak = 0;
  });

export const recordClear = (level: 0 | 1 | 2 | 3, fighter: string) =>
  change((s) => {
    s.clears[level]++;
    if (!s.cleared.includes(fighter)) s.cleared.push(fighter);
  });

export const recordScore = (score: number) => change((s) => (s.best = Math.max(s.best, score)));
export const recordSurvival = (wins: number) => change((s) => (s.survival = Math.max(s.survival, wins)));
export const recordTimeAttack = (ticks: number) => change((s) => (s.timeAttack = s.timeAttack ? Math.min(s.timeAttack, ticks) : ticks));

/** A daily challenge won. Winning on consecutive days builds a streak; winning twice in a day counts once. */
export const recordDaily = (date: string) =>
  change((s) => {
    if (s.daily.last === date) return;
    s.daily = { last: date, streak: isDayBefore(s.daily.last, date) ? s.daily.streak + 1 : 1 };
  });

/** A story fight won, at a rung of the ladder: that chapter can now be played again. */
export const recordChapter = (fighter: string, rung: number, opponent: string) =>
  change((s) => {
    const done = (s.chapters[fighter] ??= []);
    // Only the next chapter in order: a story picked back up part-way keeps its earlier chapters.
    if (rung <= done.length) done[rung] = done[rung] ?? opponent;
  });

export const recordBossRush = (wins: number, cleared: boolean) =>
  change((s) => {
    s.bossRush = { best: Math.max(s.bossRush.best, wins), cleared: s.bossRush.cleared || cleared };
  });

export const recordStory = (fighter: string) =>
  change((s) => {
    if (!s.stories.includes(fighter)) s.stories.push(fighter);
  });

// A climb in progress (arcade or story, each in a slot of its own) is saved after every fight,
// so closing the app does not lose it.
const NO_RUN = { p1: "", ladder: [] as string[], rung: 0, level: 1 as 0 | 1 | 2 | 3, score: 0, bonus: false, tries: 0, alt: false, story: false };
const slot = (story: boolean) => (story ? "story" : "run");

export function loadRun(story = false): Run | null {
  const run = { ...read(slot(story), 1, NO_RUN), story };
  // A run is only worth resuming if everyone in it still exists.
  const known = (id: string) => fighterById(id).id === id;
  return run.p1 && run.ladder.length > 0 && run.rung < run.ladder.length && known(run.p1) && run.ladder.every(known) ? run : null;
}

/** Saves a climb in its slot, or (with null) clears the slot. */
export function saveRun(run: Run | null, story = !!run?.story) {
  if (run) write(slot(story), 1, run);
  else remove(slot(story));
}
