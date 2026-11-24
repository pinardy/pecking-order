import { ROSTER, TPS } from "./game";
import type { Stats } from "./ui/stats";

// Achievements as plain data and pure functions, like the arcade ladder: no React and no storage.
// Most are read off the lifetime tally (so they are earned by whatever has already been done on a
// device); the rest are things that happen in a single match, which the app describes as a Feat.

/** One finished match, as far as achievements care. Player 1 is always the person at this device. */
export interface Feat {
  mode: string;
  won: boolean;
  fighter: string;
  opponent: string;
  /** The CPU's level, or null when the other side was a person. */
  cpu: number | null;
  online?: boolean;
  /** Player 1's health at the end, as a share of a full bar. */
  health: number;
  /** Player 1 won a round without taking damage. */
  perfect: boolean;
  /** The bonus round's scarecrow was smashed before the clock ran out. */
  smashed: boolean;
  bestCombo: number;
  throws: number;
  counters: number;
}

export interface Achievement {
  id: string;
  name: string;
  /** What has to be done, in a sentence. */
  how: string;
  earned: (stats: Stats, feat: Feat | null) => boolean;
  /** How far along, for the ones that count up: [so far, needed]. */
  progress?: (stats: Stats) => [number, number];
}

const EVERYONE = ROSTER.map((f) => f.id);
const all = (of: (id: string) => boolean) => EVERYONE.filter(of).length;
/** Time attack has to be finished inside this to count as quick. */
export const QUICK_TIME_ATTACK = 210 * TPS;

/** An achievement for getting a running count up to a number. */
const count = (id: string, name: string, how: string, need: number, of: (s: Stats) => number): Achievement => ({
  id, name, how, earned: (s) => of(s) >= need, progress: (s) => [Math.min(need, of(s)), need],
});
/** One for something done in a match against the CPU. */
const feat = (id: string, name: string, how: string, did: (f: Feat) => boolean): Achievement => ({
  id, name, how, earned: (_, f) => !!f && f.cpu !== null && did(f),
});

/** In the order they are listed: getting started, the ladder, the other modes, then feats in a fight. */
export const ACHIEVEMENTS: Achievement[] = [
  count("first-win", "First peck", "Win a fight against the CPU.", 1, (s) => s.wins),
  count("streak-5", "On a roll", "Win five fights in a row against the CPU.", 5, (s) => s.bestStreak),
  count("streak-10", "Cock of the walk", "Win ten fights in a row against the CPU.", 10, (s) => s.bestStreak),
  count("fights-50", "Regular at the coop", "Play fifty fights against the CPU.", 50, (s) => s.fights),
  count("all-wins", "Flock leader", "Win a fight with every fighter.", EVERYONE.length, (s) => all((id) => (s.fighters[id]?.wins ?? 0) > 0)),

  count("arcade", "Top of the pecking order", "Clear arcade.", 1, (s) => s.cleared.length),
  count("arcade-hard", "Hard-boiled", "Clear arcade on Rooster or Champion.", 1, (s) => s.clears[2] + s.clears[3]),
  count("arcade-all", "Every bird has its day", "Clear arcade with every fighter.", EVERYONE.length, (s) => all((id) => s.cleared.includes(id))),
  count("story", "Tall tale", "Finish a story.", 1, (s) => s.stories.length),
  count("story-all", "The whole yard", "Finish every fighter’s story.", EVERYONE.length, (s) => all((id) => s.stories.includes(id))),
  { id: "boss-rush", name: "Ruffled every feather", how: "Clear the boss rush.", earned: (s) => s.bossRush.cleared },

  count("survival-5", "Tough old bird", "Win five fights in one survival run.", 5, (s) => s.survival),
  count("survival-10", "Last bird standing", "Win ten fights in one survival run.", 10, (s) => s.survival),
  { id: "time-attack", name: "Five down", how: "Finish a time attack.", earned: (s) => s.timeAttack > 0 },
  { id: "time-attack-quick", name: "Fast food", how: "Finish a time attack in under three and a half minutes.", earned: (s) => s.timeAttack > 0 && s.timeAttack < QUICK_TIME_ATTACK },
  // (No running count for these: the saved streak only finds out it has lapsed at the next win.)
  { id: "daily", name: "Early bird", how: "Win a daily challenge.", earned: (s) => s.daily.streak >= 1 },
  { id: "daily-3", name: "Creature of habit", how: "Win the daily challenge three days running.", earned: (s) => s.daily.streak >= 3 },
  { id: "daily-7", name: "Up with the lark", how: "Win the daily challenge seven days running.", earned: (s) => s.daily.streak >= 7 },

  feat("perfect", "Not a feather out of place", "Win a round against the CPU without taking any damage.", (f) => f.perfect),
  feat("combo-8", "Poultry in motion", "Land a combo of eight hits or more.", (f) => f.bestCombo >= 8),
  feat("close", "By a feather", "Win a match with a tenth of your health or less.", (f) => f.won && f.health > 0 && f.health <= 0.1),
  feat("throws-3", "Smother hen", "Throw the CPU three times in one match.", (f) => f.throws >= 3),
  feat("counters-5", "Counter-cluckwise", "Land five counter hits in one match.", (f) => f.counters >= 5),
  feat("champion", "Rule the roost", "Beat a Champion-level CPU.", (f) => f.won && f.cpu === 3),
  feat("mirror", "Birds of a feather", "Beat the CPU when it is playing your own fighter.", (f) => f.won && f.fighter === f.opponent),
  feat("pepper", "Some like it hot", "Win a fight as Pepper.", (f) => f.won && f.fighter === "pepper"),
  { id: "scarecrow", name: "Make hay", how: "Smash the scarecrow in the bonus round.", earned: (_, f) => !!f?.smashed },
  { id: "versus", name: "Pecking rights", how: "Finish a match against a second player on this device.", earned: (_, f) => !!f && f.cpu === null && !f.online && f.mode === "versus" },
  { id: "online", name: "Long-distance cluck", how: "Finish a match against a friend online.", earned: (_, f) => !!f?.online },
];

/** The achievements these stats (and this match, if there was one) earn that are not already held. */
export function newlyEarned(held: Record<string, unknown>, stats: Stats, feat: Feat | null): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !(a.id in held) && a.earned(stats, feat));
}
