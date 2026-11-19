import { ROUND_SECONDS, type Rules } from "./types";

/** An ordinary match: first to `rounds` wins, on the clock, to the knockout. */
export const duel = (rounds: number): Rules => ({ rounds, seconds: ROUND_SECONDS, knockouts: true, refill: false, target: false });

/** What each arena does to a fight, by stage number: pickups outdoors, bouncing walls indoors and on the roof. */
const ARENA_RULES: Partial<Rules>[] = [{ pickups: true }, { pickups: true }, { bounce: true }, { bounce: true }];

/** An ordinary match in a particular arena, with or without that arena's effects. */
export const matchRules = (rounds: number, stage: number, effects: boolean): Rules => ({ ...duel(rounds), ...(effects ? ARENA_RULES[stage % ARENA_RULES.length] : {}) });

/** Training: no clock, nobody can be knocked out, and health and meter come back. */
export const TRAINING: Rules = { rounds: 2, seconds: null, knockouts: false, refill: true, target: false, opening: "Training" };

/** The bonus round: twenty seconds to take a scarecrow apart. */
export const BONUS: Rules = { rounds: 1, seconds: 20, knockouts: true, refill: false, target: true, opening: "Bonus round", openingSub: "Peck the scarecrow to pieces" };
