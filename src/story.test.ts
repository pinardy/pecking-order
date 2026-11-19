import { describe, expect, it } from "vitest";
import { RIVALS, afterBonus, afterFight, nextStep, startRun } from "./arcade";
import { ROSTER, BOSS, fighterById } from "./game";
import { between, ending, finale, opening } from "./story";

describe("story", () => {
  it("gives each fighter a scene with their rival before the fourth fight, and a different last word from them", () => {
    for (const p1 of ROSTER) {
      let run = startRun(p1, 1, () => 0.3);
      // Win three fights (and the bonus round) to reach the rival.
      for (let k = 0; k < 3; k++) {
        run = afterFight(run, true, 0)!;
        if (run.bonus) run = afterBonus(run, 0);
      }
      const rival = RIVALS[p1.id];
      const scene = between(run, 0, run.ladder[2]);
      expect(scene.right).toBe(rival);
      // After the narrator sets it up, the rival speaks first and the two trade eight lines.
      const start = scene.lines.findIndex((l) => l.who === "" && l.text.startsWith("One rung from the top"));
      const exchange = scene.lines.slice(start + 1);
      expect(start).toBeGreaterThan(0);
      expect(exchange.length).toBe(8);
      expect(exchange[0].who).toBe(rival);
      expect(new Set(exchange.map((l) => l.who))).toEqual(new Set([rival, p1.id]));
      // Beaten as a rival, they say something they would not say to anyone else.
      run = afterFight(run, true, 0)!;
      const after = between(run, 0, rival);
      expect(after.lines[0]).toMatchObject({ who: rival, mood: "hurt" });
      const toAnyone = between({ ...run, p1: "nobody" }, 0, rival).lines[0].text;
      expect(after.lines[0].text).not.toBe(toAnyone);
    }
  });

  it("tells a longer story: no scene between fights is shorter than five lines", () => {
    for (const p1 of ROSTER) {
      let run = startRun(p1, 1, () => 0.6);
      expect(opening(run, 0).lines.length).toBeGreaterThanOrEqual(12);
      for (let k = 0; k < 4; k++) {
        const beaten = run.ladder[run.rung];
        run = afterFight(run, true, 0)!;
        expect(between(run, 0, beaten).lines.length).toBeGreaterThanOrEqual(5);
        if (run.bonus) run = afterBonus(run, 0);
      }
    }
  });

  it("has an ending for everyone, told by the narrator", () => {
    for (const f of [...ROSTER, BOSS]) {
      const scene = ending(f.id, 3);
      expect(scene.left).toBe(f.id);
      expect(scene.lines.filter((l) => l.who === "").length).toBe(3);
      // And the hero has the last word, pleased with themselves.
      expect(scene.lines[scene.lines.length - 1]).toMatchObject({ who: f.id, mood: "happy" });
    }
  });

  it("has something for every fighter to say at every step of a run, and names them correctly", () => {
    for (const p1 of [...ROSTER, BOSS]) {
      let run = startRun(p1, 1, () => 0.3);
      const scenes = [opening(run, 0)];
      for (let k = 0; k < 12; k++) {
        const step = nextStep(run);
        if (!step) break;
        const beaten = run.ladder[run.rung];
        const was = run.bonus;
        run = was ? afterBonus(run, 0) : afterFight(run, true, 0)!;
        if (!run) break;
        if (!was) scenes.push(between(run, 0, beaten));
      }
      scenes.push(finale(startRun(p1, 1), 0));
      for (const s of scenes) {
        expect(s.lines.length).toBeGreaterThan(0);
        for (const line of s.lines) {
          expect(line.text.trim().length).toBeGreaterThan(3);
          if (line.who) expect(fighterById(line.who).id).toBe(line.who);
          // Each line belongs to someone on stage, or to the narrator.
          if (line.who) expect([s.left, line.with ?? s.right]).toContain(line.who);
        }
      }
    }
  });
});
