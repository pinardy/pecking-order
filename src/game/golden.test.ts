import { expect, it } from "vitest";
import { BONUS, NO_INPUT, ROSTER, SCARECROW, TRAINING, createCpu, createMatch, cpuInput, duel, step, type Match } from "./index";

// A fingerprint of how the engine plays: eight CPU matches, two bonus rounds and a training
// session, with every fighter's position, health, meter, state and score folded into one
// number per run, tick by tick. Any change in behaviour, however small, changes them.
// They were last re-recorded when every CPU level was made easier (the engine's own rules were not touched).
// (Replays are tied to the engine's code by a fingerprint worked out at build time; see vite.config.ts.)
//
// If you change the rules on purpose (a move's timing, a damage value), this will fail.
// Run it, check that nothing else changed, and paste the new numbers in.

const str = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

function fold(h: number, m: Match): number {
  for (const f of m.f) {
    for (const v of [Math.round(f.x * 100), Math.round(f.y * 100), f.hp, Math.round(f.meter * 10), str(f.state), f.score, f.wins, Math.round(f.guard * 10), f.move ? str(f.move.id) : 7]) h = (Math.imul(h, 31) + v) | 0;
  }
  for (const s of m.shots) h = (Math.imul(h, 31) + Math.round(s.x * 10) + Math.round(s.y * 10)) | 0;
  return (Math.imul(h, 31) + str(m.phase) + m.timer) | 0;
}

const EXPECTED = [-407805669, 4220, -1479373883, 5637, -1073401887, 3488, 685598382, 5865, -350755678, 5138, -102724799, 3512, -986015781, 5104, 1461881689, 6084, 1877962813, 1512, -1249510044, 1344, -821817893];

it("plays exactly as it did before", () => {
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    const m = createMatch(ROSTER[k], ROSTER[(k * 3 + 1) % 8], { rules: duel(2) });
    const c = [createCpu((k % 3) as 0 | 1 | 2, 100 + k), createCpu(((k + 1) % 3) as 0 | 1 | 2, 200 + k)];
    let h = 0;
    let t = 0;
    while (m.phase !== "matchEnd" && t++ < 100000) {
      step(m, cpuInput(m, 0, c[0]), cpuInput(m, 1, c[1]));
      h = fold(h, m);
    }
    out.push(h, t);
  }
  for (let k = 0; k < 2; k++) {
    const m = createMatch(ROSTER[k + 2], SCARECROW, { rules: BONUS });
    const c = createCpu(2, 300 + k);
    let h = 0;
    let t = 0;
    while (m.phase !== "matchEnd" && t++ < 100000) {
      step(m, cpuInput(m, 0, c), NO_INPUT);
      h = fold(h, m);
    }
    out.push(h, t);
  }
  const m = createMatch(ROSTER[5], ROSTER[6], { rules: TRAINING });
  const c = [createCpu(2, 400), createCpu(1, 401, "block")];
  let h = 0;
  for (let t = 0; t < 4000; t++) {
    step(m, cpuInput(m, 0, c[0]), cpuInput(m, 1, c[1]));
    h = fold(h, m);
  }
  out.push(h);
  expect(out).toEqual(EXPECTED);
});
