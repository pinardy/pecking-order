import { describe, expect, it } from "vitest";
import { ONE_WAY_RIVALS, RIVALS, afterBonus, afterFight, isFinal, nextStep, rivalAt, startRun, type Run } from "./arcade";
import { ROSTER, fighterById } from "./game";

/** Wins every fight, noting each step on the way up. */
function climb(run: Run): string[] {
  const seen: string[] = [];
  let at: Run | null = run;
  let score = 0;
  while (at) {
    const step = nextStep(at);
    if (step.kind === "bonus") {
      seen.push("bonus");
      at = afterBonus(at, (score += 5000));
    } else {
      seen.push(step.opponent.id);
      at = afterFight(at, true, (score += 10000));
    }
  }
  return seen;
}

describe("arcade ladder", () => {
  it("is five different opponents, never yourself, with Old Spur last", () => {
    for (const player of ROSTER) {
      const run = startRun(player, 1);
      expect(run.ladder).toHaveLength(5);
      expect(new Set(run.ladder).size).toBe(5);
      expect(run.ladder).not.toContain(player.id);
      expect(run.ladder[4]).toBe("oldspur");
    }
  });

  it("puts each fighter's rival fourth, just before the top", () => {
    for (const player of ROSTER) {
      for (let seed = 0; seed < 5; seed++) {
        const run = startRun(player, 1, () => (seed * 0.19 + 0.07) % 1);
        expect(run.ladder[3]).toBe(RIVALS[player.id]);
        expect(rivalAt(run, 3)).toBe(RIVALS[player.id]);
        expect(rivalAt(run, 2)).toBeNull();
        // And rivalry runs both ways, except for the newcomer, who picked hers without being asked.
        if (!ONE_WAY_RIVALS.includes(player.id)) expect(RIVALS[RIVALS[player.id]]).toBe(player.id);
      }
    }
  });

  it("puts the bonus round after the second win, and nowhere else", () => {
    const run = startRun(fighterById("pip"), 1, () => 0);
    expect(climb(run)).toEqual([run.ladder[0], run.ladder[1], "bonus", run.ladder[2], run.ladder[3], run.ladder[4]]);
  });

  it("raises the CPU a level for the final fight, in the henhouse", () => {
    let run: Run | null = startRun(fighterById("dot"), 1);
    const levels: number[] = [];
    while (run) {
      const step = nextStep(run);
      if (step.kind === "fight") {
        levels.push(step.cpu);
        expect(step.final).toBe(isFinal(run));
        if (step.final) expect(step.stage).toBe(2);
        run = afterFight(run, true, 0);
      } else run = afterBonus(run, 0);
    }
    expect(levels).toEqual([1, 1, 1, 1, 2]);
    // At Rooster level the final fight is a Champion; at Champion level it stays there.
    expect(nextStep({ ...startRun(fighterById("dot"), 2), rung: 4 })).toMatchObject({ cpu: 3 });
    expect(nextStep({ ...startRun(fighterById("dot"), 3), rung: 4 })).toMatchObject({ cpu: 3 });
  });

  it("banks the score on a win and leaves the run untouched on a loss", () => {
    const run = startRun(fighterById("rusty"), 0);
    expect(afterFight(run, false, 999)).toMatchObject({ rung: 0, score: 0, tries: 1 });
    expect(afterFight(run, true, 12345)).toMatchObject({ rung: 1, score: 12345, bonus: false });
    expect(afterBonus({ ...run, rung: 2, bonus: true }, 20000)).toMatchObject({ rung: 2, score: 20000, bonus: false });
  });

  it("eases the CPU off a level after every second loss on the same fight", () => {
    let run = startRun(fighterById("pip"), 2);
    const level = () => (nextStep(run) as { cpu: number }).cpu;
    expect(level()).toBe(2);
    run = afterFight(run, false, 0)!;
    expect(level()).toBe(2);
    run = afterFight(run, false, 0)!;
    expect(level()).toBe(1);
    run = afterFight(afterFight(run, false, 0)!, false, 0)!;
    expect(level()).toBe(0);
    // Winning resets it for the next opponent.
    run = afterFight(run, true, 100)!;
    expect(level()).toBe(2);
  });

  it("is cleared by winning the last fight", () => {
    expect(afterFight({ ...startRun(fighterById("ziggy"), 1), rung: 4 }, true, 1)).toBeNull();
  });
});
