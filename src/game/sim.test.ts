import { describe, expect, it } from "vitest";
import { BONUS, ROSTER, TRAINING, duel, createCpu, createMatch, cpuInput, step, MAX_METER, MAX_SEP, STAGE_W, WALL, type CpuLevel, type Match } from "./index";

/** Plays a whole CPU-vs-CPU match, checking the engine's invariants on every tick. */
function playMatch(a: number, b: number, la: CpuLevel, lb: CpuLevel, seed: number): { m: Match; ticks: number } {
  const m = createMatch(ROSTER[a], ROSTER[b], { rules: duel(2) });
  const cpus = [createCpu(la, seed * 7 + 1), createCpu(lb, seed * 13 + 5)] as const;
  let ticks = 0;
  while (m.phase !== "matchEnd") {
    step(m, cpuInput(m, 0, cpus[0]), cpuInput(m, 1, cpus[1]));
    ticks++;
    if (ticks > 60 * 60 * 20) throw new Error(`match never ended: ${ROSTER[a].id} v ${ROSTER[b].id} seed ${seed}`);
    for (const f of m.f) {
      if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error(`bad position at tick ${ticks}`);
      if (f.x < WALL - 0.01 || f.x > STAGE_W - WALL + 0.01) throw new Error(`${f.def.id} left the arena: x=${f.x}`);
      if (f.y < 0) throw new Error(`${f.def.id} sank below the floor`);
      if (f.hp < 0 || f.hp > f.def.hp) throw new Error(`${f.def.id} hp out of range: ${f.hp}`);
      if (f.meter < 0 || f.meter > MAX_METER) throw new Error(`${f.def.id} meter out of range: ${f.meter}`);
      if (f.state === "attack" && !f.move) throw new Error(`${f.def.id} attacking with no move`);
    }
    if (Math.abs(m.f[0].x - m.f[1].x) > MAX_SEP + 0.01) throw new Error("fighters further apart than one screen");
  }
  return { m, ticks };
}

describe("engine", () => {
  it("plays every pairing to a finish without breaking an invariant", () => {
    let seed = 1;
    for (let a = 0; a < ROSTER.length; a++) {
      for (let b = 0; b < ROSTER.length; b++) {
        for (const level of [0, 1, 2] as const) {
          const { m } = playMatch(a, b, level, level, seed++);
          expect(m.winner).not.toBeNull();
          expect(m.f[m.winner!].wins).toBe(2);
        }
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const x = playMatch(0, 5, 2, 2, 42);
    const y = playMatch(0, 5, 2, 2, 42);
    expect(x.ticks).toBe(y.ticks);
    expect(x.m.f.map((f) => [f.hp, f.x])).toEqual(y.m.f.map((f) => [f.hp, f.x]));
  });

  it("gives the Rooster CPU the edge over the Chick CPU", () => {
    let wins = 0;
    const games = 60;
    for (let i = 0; i < games; i++) {
      const a = i % ROSTER.length;
      const b = (i * 5 + 2) % ROSTER.length;
      // Alternate sides so neither corner is favoured.
      const strongFirst = i % 2 === 0;
      const { m } = strongFirst ? playMatch(a, b, 2, 0, 500 + i) : playMatch(b, a, 0, 2, 500 + i);
      if ((m.winner === 0) === strongFirst) wins++;
    }
    expect(wins / games).toBeGreaterThan(0.75);
  });

  it("never knocks anyone out in training", () => {
    const m = createMatch(ROSTER[1], ROSTER[2], { rules: TRAINING });
    const cpu = createCpu(2, 3);
    for (let i = 0; i < 60 * 90; i++) {
      step(m, cpuInput(m, 0, cpu), { x: 0, y: 0, light: false, heavy: false, special: false, sup: false });
      expect(m.f[1].hp).toBeGreaterThan(0);
    }
    expect(m.phase).toBe("fight");
  });
});

describe("bonus round", () => {
  it("ends on its own, awards points, and never moves the scarecrow", async () => {
    const { SCARECROW } = await import("./index");
    for (const [i, def] of ROSTER.entries()) {
      const m = createMatch(def, SCARECROW, { rules: BONUS });
      const cpu = createCpu(2, 5 + i);
      const x0 = m.f[1].x;
      for (let t = 0; m.phase !== "matchEnd"; t++) {
        step(m, cpuInput(m, 0, cpu), { x: 0, y: 0, light: false, heavy: false, special: false, sup: false });
        if (t > 60 * 40) throw new Error(`bonus round never ended for ${def.id}`);
      }
      expect(m.winner).toBe(0);
      expect(m.f[0].score).toBeGreaterThan(0);
      expect(Math.abs(m.f[1].x - x0)).toBeLessThan(30);
    }
  });
});
