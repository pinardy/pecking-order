import { describe, expect, it } from "vitest";
import { NO_INPUT, ROSTER, TRAINING, advanceTrial, trialHit, createCpu, cpuInput, createMatch, fighterById, inputFor, isCounterStep, step, trialsFor, type FighterDef, type Input, type Match } from "./index";

/** Performs a trial with scripted inputs against a standing dummy. True if every step landed in one combo. */
function perform(def: FighterDef, dummy: FighterDef, steps: string[], gap: number, counterWith: "light" | "heavy" | "walk" = "light"): boolean {
  const m: Match = createMatch(def, dummy, { rules: TRAINING });
  for (let i = 0; i < 90; i++) step(m, NO_INPUT, NO_INPUT);
  const [me, op] = m.f;
  me.x = 400;
  op.x = 400 + gap;
  me.meter = 100;
  let at = 0;
  // For a counter, the dummy has to be attacking: it kicks on a beat.
  const swing = steps.some(isCounterStep) ? Object.assign(createCpu(1, 3), { mode: "swing" as const }) : null;
  let launched = false;
  for (let t = 0; t < 420 && at < steps.length; t++) {
    const free = me.state === "idle" || me.state === "walk";
    const pulse = t % 2 === 0;
    const input: Input = { ...NO_INPUT };
    const want = inputFor(def, steps[at]).input;
    if (op.state === "launched") launched = true;
    if (want.endsWith("as a counter")) {
      // Kick just as their kick starts, so it lands while theirs is still coming.
      // (A short bird steps in first, with a Kick for the reach.)
      if (counterWith === "walk") {
        // Walk in under their reach, and peck as their kick starts.
        input.x = me.facing;
        if (free && op.state === "attack" && op.phase === "startup") input.light = pulse;
      } else if (free && op.state === "attack" && op.phase === "startup" && op.phaseT <= 2) input[counterWith] = true;
    } else if (want === "Down + Toward + Kick") {
      if (me.y === 0) Object.assign(input, { x: me.facing, y: -1, heavy: pulse });
    } else if (want === "Jump, Kick" && launched) {
      // After a launcher: jump at them, and kick on the way up.
      if (free && me.y === 0) Object.assign(input, { x: me.facing, y: 1 });
      else if (me.state === "air") input.heavy = pulse;
    } else if (want === "Jump, Kick") {
      if (free && me.y === 0) Object.assign(input, { x: 1, y: 1 });
      else if (me.state === "air" && me.vy < 0 && me.y < 112) input.heavy = pulse;
    } else if (want.endsWith("Crow") && me.y === 0) {
      input.sup = pulse;
      if (want.startsWith("Toward")) input.x = me.facing;
      if (want.startsWith("Away")) input.x = -me.facing as -1 | 1;
      if (want.startsWith("Down")) input.y = -1;
    } else if (me.y === 0) {
      if (want === "Peck") input.light = pulse;
      else if (want === "Crow") input.sup = pulse;
      else {
        input.special = pulse;
        if (want.startsWith("Toward")) input.x = me.facing;
        if (want.startsWith("Down")) input.y = -1;
      }
    }
    step(m, input, swing ? cpuInput(m, 1, swing) : NO_INPUT);
    for (const e of m.events) {
      const hit = trialHit(e);
      if (hit) at = advanceTrial(steps, at, hit);
    }
  }
  return at >= steps.length;
}

describe("combo trials", () => {
  it("can all be performed, against a hen and against a chick", () => {
    const failures: string[] = [];
    for (const def of ROSTER) {
      for (const dummy of [fighterById(def.id === "dot" ? "henrietta" : "dot"), fighterById(def.id === "pip" ? "shelly" : "pip")]) {
        for (const trial of trialsFor(def)) {
          // A person would walk to a workable distance; the script tries a spread of them.
          const gaps = trial.steps[0] === "jHeavy" ? Array.from({ length: 16 }, (_, i) => 80 + i * 8) : isCounterStep(trial.steps[0]) ? [140] : def.super.grab !== undefined && trial.steps[0] === def.super.id ? [30, 40, 50] : [32, 38, 46, 52];
          const ways = isCounterStep(trial.steps[0]) ? (["light", "heavy", "walk"] as const) : (["light"] as const);
          if (!gaps.some((gap) => ways.some((w) => perform(def, dummy, trial.steps, gap, w)))) failures.push(`${def.id} vs ${dummy.id}: ${trial.name}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
