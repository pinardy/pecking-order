import { read, write } from "./store";

// What was picked last time, so the select screen opens where you left it.

export interface Picks {
  fighter: string;
  opponent: string;
  /** Arena index, or -1 for random. */
  arena: number;
  /** Versus: against the CPU rather than a second player. Null until a choice has been made. */
  vsCpu: boolean | null;
}

const DEFAULTS: Picks = { fighter: "henrietta", opponent: "rusty", arena: -1, vsCpu: null };

export const loadPicks = (): Picks => read("picks", 1, DEFAULTS);

export const savePicks = (patch: Partial<Picks>) => void write("picks", 1, { ...loadPicks(), ...patch });
