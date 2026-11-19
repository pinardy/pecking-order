import { describe, expect, it } from "vitest";
import { fighterById, type GameEvent } from "../../game";
import { statsListener, tipFor } from "./stats";

/** Feeds a list of events through the listener and returns what it counted. */
function count(events: GameEvent[]) {
  const { listener, stats } = statsListener();
  for (const e of events) listener.event?.(e, undefined as never);
  return stats;
}
const hit = (side: 0 | 1, move: string, damage: number, combo = 1): GameEvent => ({ type: "hit", power: 1, side, move, combo, damage });

describe("match stats", () => {
  it("credits damage and combos to whoever landed the hit", () => {
    const s = count([hit(1, "sLight", 40, 1), hit(1, "spur", 90, 2), hit(0, "sHeavy", 80), { type: "block", side: 0 }, { type: "throw", side: 1, damage: 120 }]);
    expect(s.sides[0]).toMatchObject({ damage: 130, hits: 2, bestCombo: 2, blocks: 1 });
    expect(s.sides[1]).toMatchObject({ damage: 200, hits: 1, throws: 1 });
    expect(s.sides[0].takenFrom).toEqual({ sHeavy: 80, throw: 120 });
  });
});

describe("advice after a loss", () => {
  const dot = fighterById("dot");
  const caught = (why: "low" | "high" | "throw"): GameEvent => ({ type: "caught", side: 0, why, x: 0, y: 0 });

  it("explains low attacks to someone who kept blocking them standing", () => {
    expect(tipFor(count([caught("low"), caught("low"), caught("low"), hit(0, "cHeavy", 76)]), 0, dot)).toMatch(/Crouch/);
  });
  it("explains throw escapes to someone who kept being thrown", () => {
    expect(tipFor(count([caught("throw"), caught("throw")]), 0, dot)).toMatch(/Press Kick/);
  });
  it("names the projectile that did the damage", () => {
    expect(tipFor(count([hit(0, "grit", 60), hit(0, "grit", 60), hit(0, "sLight", 30)]), 0, dot)).toMatch(/^Grit spit did most of the damage\. Jump over it/);
  });
  it("suggests blocking to someone who never did", () => {
    const events = Array.from({ length: 12 }, (_, i) => hit(0, ["sLight", "sHeavy", "cLight", "jHeavy"][i % 4], 30));
    expect(tipFor(count(events), 0, dot)).toMatch(/You blocked 0 of 12 attacks/);
  });
});
