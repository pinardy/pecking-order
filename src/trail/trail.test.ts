import { describe, expect, it } from "vitest";
import { NO_INPUT, ROSTER } from "../game";
import { HEARTS, MAX_LEDGE, MAX_PIT, botInput, createTrail, makeLevel, seedOf, stepTrail, type Level, type Trail } from "./trail";

/** Plays a level with the test player. */
function play(t: Trail, ticks = 60 * 240) {
  for (let i = 0; i < ticks && !t.done; i++) stepTrail(t, botInput(t));
  return t;
}
const flat = (extra: Partial<Level> = {}): Level => ({ length: 1200, ground: [[0, 1200]], ledges: [], critters: [], corn: [], goal: 1000, ...extra });
const hold = (t: Trail, input: Partial<typeof NO_INPUT>, ticks: number) => {
  for (let i = 0; i < ticks; i++) stepTrail(t, { ...NO_INPUT, ...input });
};

describe("the trail", () => {
  it("builds the same level for the same fight every time, and a longer one further up the ladder", () => {
    const seed = seedOf("rusty:dot:0");
    expect(makeLevel(seed, 0)).toEqual(makeLevel(seed, 0));
    expect(makeLevel(seed, 4).length).toBeGreaterThan(makeLevel(seed, 0).length);
    expect(makeLevel(seedOf("rusty:pip:1"), 0)).not.toEqual(makeLevel(seed, 0));
  });

  it("never asks for a jump that cannot be made", () => {
    for (let k = 0; k < 200; k++) {
      const level = makeLevel(seedOf(`level${k}`), k % 5);
      for (let i = 1; i < level.ground.length; i++) {
        const pit = level.ground[i][0] - level.ground[i - 1][1];
        expect(pit).toBeGreaterThan(0);
        expect(pit).toBeLessThanOrEqual(MAX_PIT);
        // Room to land and take a run-up on the far side.
        expect(level.ground[i][1] - level.ground[i][0]).toBeGreaterThanOrEqual(120);
      }
      for (const l of level.ledges) expect(l.y).toBeLessThanOrEqual(MAX_LEDGE);
      // A jump over a thistle comes down on solid ground: there is none within a jump's length of a pit.
      for (const c of level.critters) {
        if (c.kind !== "thistle") continue;
        const under = level.ground.find(([a, b]) => c.x >= a && c.x <= b)!;
        expect(under[1] - c.x).toBeGreaterThanOrEqual(150);
        expect(c.x - under[0]).toBeGreaterThanOrEqual(60);
      }
      expect(level.corn.length).toBeGreaterThan(5);
    }
  });

  it("can be finished by every fighter at every rung, by a player that only runs, jumps and pecks", () => {
    const stuck: string[] = [];
    for (const def of ROSTER) {
      for (let rung = 0; rung < 5; rung++) {
        for (let k = 0; k < 12; k++) {
          const t = play(createTrail(def, makeLevel(seedOf(`${def.id}:${k}:${rung}`), rung)));
          if (t.done !== "won") stuck.push(`${def.id} rung ${rung} #${k}: ${t.done ?? "ran out of time"} at ${Math.round(t.x)} of ${t.level.goal}`);
        }
      }
    }
    expect(stuck).toEqual([]);
  });

  it("ends at the opponent, and not before", () => {
    const t = createTrail(ROSTER[0], flat());
    hold(t, { x: 1 }, 200);
    expect(t.done).toBeNull();
    hold(t, { x: 1 }, 200);
    expect(t.done).toBe("won");
  });

  it("costs a heart to fall in a pit, and puts the hero back on the near side", () => {
    const t = createTrail(ROSTER[1], flat({ ground: [[0, 300], [390, 1200]] }));
    for (let i = 0; i < 200 && t.hearts === HEARTS; i++) stepTrail(t, { ...NO_INPUT, x: 1 });
    expect(t.hearts).toBe(HEARTS - 1);
    expect(t.x).toBeLessThan(300);
    expect(t.y).toBe(0);
    // A running jump clears it.
    const again = createTrail(ROSTER[1], flat({ ground: [[0, 300], [390, 1200]] }));
    for (let i = 0; i < 200; i++) stepTrail(again, { ...NO_INPUT, x: 1, y: again.x > 285 || !again.grounded ? 1 : 0 });
    expect(again.hearts).toBe(HEARTS);
    expect(again.x).toBeGreaterThan(390);
  });

  it("lets a beetle be pecked or landed on, hurts on touch, and is lost when the hearts run out", () => {
    const beetle = () => ({ kind: "beetle" as const, x: 400, y: 0, x0: 380, x1: 420, dir: 1 as const, phase: 0, gone: 0 });
    const walked = createTrail(ROSTER[0], flat({ critters: [beetle()] }));
    hold(walked, { x: 1 }, 110);
    expect(walked.hearts).toBe(HEARTS - 1);
    expect(walked.level.critters[0].gone).toBe(0);
    // Untouchable for a moment afterwards, so one beetle is one heart.
    expect(walked.hurt).toBeGreaterThan(0);

    const pecked = createTrail(ROSTER[0], flat({ critters: [beetle()] }));
    for (let i = 0; i < 200 && pecked.level.critters[0].gone === 0; i++) stepTrail(pecked, { ...NO_INPUT, x: pecked.x < 330 ? 1 : 0, light: i % 2 === 0 });
    expect(pecked.level.critters[0].gone).toBeGreaterThan(0);
    expect(pecked.hearts).toBe(HEARTS);

    const thistles = [300, 420, 540].map((x) => ({ ...beetle(), kind: "thistle" as const, x, x0: x, x1: x }));
    const careless = createTrail(ROSTER[0], flat({ critters: thistles }));
    hold(careless, { x: 1 }, 600);
    expect(careless.done).toBe("lost");
    expect(careless.hearts).toBe(0);
  });

  it("counts the corn picked up on the way", () => {
    const t = createTrail(ROSTER[2], flat({ corn: [200, 230, 260].map((x) => ({ x, y: 26, got: false })) }));
    hold(t, { x: 1 }, 80);
    expect(t.corn).toBe(3);
  });
});
