import type { FighterDef, GameEvent, Move } from "./types";

// Combo trials for training: short sequences that have to land as one combo.

export interface Trial {
  name: string;
  /** Move ids, in the order they must connect. An id starting with "!" has to land as a counter hit. */
  steps: string[];
}

/** A step that has to be a counter hit names its move after a "!". */
export const isCounterStep = (step: string) => step.startsWith("!");
const moveOf = (step: string) => step.replace(/^!/, "");
/** "!any": any attack at all, as long as it lands as a counter. */
const ANY = "any";

/** A trial step's progress from a game event: hits, and command throws (which land without a hit). */
export function trialHit(e: GameEvent): { move: string; combo: number; counter?: boolean } | null {
  if (e.type === "hit" && e.side === 1) return e;
  if (e.type === "throw" && e.side === 0 && e.move) return { move: e.move, combo: 1 };
  return null;
}

export function trialsFor(def: FighterDef): Trial[] {
  const ender = def.specials.find((s) => s.id === def.ender) ?? def.specials[1];
  return [
    { name: "Two pecks", steps: ["sLight", "sLight"] },
    { name: `Peck into ${ender.name}`, steps: ["sLight", ender.id] },
    { name: "Jump in", steps: ["jHeavy", "sLight", ender.id] },
    // A super that throws cannot follow a peck (throws only catch a bird standing), so it is done on its own, up close.
    def.super.grab !== undefined ? { name: `${def.super.name}, up close`, steps: [def.super.id] } : { name: `Peck into ${def.super.name}`, steps: ["sLight", def.super.id] },
    { name: "Launch, then follow up", steps: ["launch", "jHeavy"] },
    { name: `Peck into a charged ${ender.name.toLowerCase()}`, steps: ["sLight", `${ender.id}+`] },
    { name: "Counter: hit them as they kick", steps: [`!${ANY}`] },
  ];
}

/** How to perform a move, as shown in the trial list. */
export function inputFor(def: FighterDef, id: string): { move: Move; input: string } {
  const n = def.normals;
  const table: [Move, string][] = [
    [n.sLight, "Peck"], [n.sHeavy, "Kick"], [n.cLight, "Down + Peck"], [n.cHeavy, "Down + Kick"],
    [n.jLight, "Jump, Peck"], [n.jHeavy, "Jump, Kick"],
    [def.specials[0], "Special"], [def.specials[1], "Toward + Special"], [def.specials[2], "Down + Special"],
    [def.air, "Jump, Special"], [def.super, "Crow"], [n.launch, "Down + Toward + Kick"],
    [def.ex[0], "Away + Crow"], [def.ex[1], "Toward + Crow"], [def.ex[2], "Down + Crow"],
  ];
  if (moveOf(id) === ANY) return { move: n.sLight, input: "Any attack, as a counter" };
  const hit = table.find(([m]) => m.id === moveOf(id)) ?? table[0];
  return { move: hit[0], input: isCounterStep(id) ? `${hit[1]}, as a counter` : hit[1] };
}

/**
 * Moves the trial pointer for one landed hit and returns the new position.
 * `combo` is the hit's place in the current combo, so 1 means a fresh start.
 */
export function advanceTrial(steps: string[], at: number, hit: { move: string; combo: number; counter?: boolean }): number {
  const matches = (step: string) => (moveOf(step) === ANY || hit.move === moveOf(step)) && (!isCounterStep(step) || !!hit.counter);
  const i = hit.combo === 1 ? 0 : at;
  if (i >= steps.length) return i;
  // Further hits of a multi-hit move do not count against you.
  if (i > 0 && hit.move === moveOf(steps[i - 1]) && moveOf(steps[i]) !== hit.move) return i;
  if (matches(steps[i])) return i + 1;
  return hit.combo === 1 && matches(steps[0]) ? 1 : 0;
}
