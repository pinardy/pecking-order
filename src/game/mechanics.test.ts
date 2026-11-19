import { describe, expect, it } from "vitest";
import { BOSS, MAX_METER, NO_INPUT, ROSTER, createCpu, createMatch, cpuInput, duel, fighterById, gain, step, type Input, type Match } from "./index";

const fight = (m: Match) => {
  while (m.phase !== "fight") step(m, NO_INPUT, NO_INPUT);
};
const press = (i: Partial<Input>): Input => ({ ...NO_INPUT, ...i });

describe("burst", () => {
  it("breaks out of a combo once a round, for a full meter", () => {
    const m = createMatch(ROSTER[0], ROSTER[1], { rules: duel(2) });
    fight(m);
    const [a, b] = m.f;
    b.x = a.x + 50;
    b.meter = MAX_METER;
    // Player 1 pecks; player 2 bursts out while reeling.
    let burst = false;
    for (let t = 0; t < 40 && !burst; t++) {
      step(m, press({ light: t % 2 === 0 }), press({ sup: b.state === "hit" }));
      burst = m.events.some((e) => e.type === "burst");
    }
    expect(burst).toBe(true);
    expect(b.meter).toBe(0);
    expect(b.burstUsed).toBe(true);
    expect(a.state).toBe("hit");
    // Not twice in one round.
    b.meter = MAX_METER;
    let again = false;
    for (let t = 0; t < 120; t++) {
      step(m, press({ light: t % 2 === 0, x: a.x < b.x ? 1 : -1 }), press({ sup: b.state === "hit" }));
      again ||= m.events.some((e) => e.type === "burst");
    }
    expect(again).toBe(false);
  });
});

describe("comeback", () => {
  it("fills the meter half as fast again below a quarter of health", () => {
    const m = createMatch(ROSTER[0], ROSTER[1], { rules: duel(1) });
    const f = m.f[0];
    gain(f, 10);
    const healthy = f.meter;
    f.meter = 0;
    f.hp = f.def.hp * 0.2;
    gain(f, 10);
    expect(f.meter).toBeCloseTo(healthy * 1.5);
  });
});

describe("rule twists", () => {
  it("can start with a full meter, and can forbid throws", () => {
    const m = createMatch(ROSTER[0], ROSTER[1], { rules: { ...duel(1), startMeter: 100, noThrows: true } });
    expect(m.f.map((f) => f.meter)).toEqual([100, 100]);
    fight(m);
    m.f[1].x = m.f[0].x + 40;
    for (let t = 0; t < 30; t++) step(m, press({ heavy: t === 2, x: 1 }), NO_INPUT);
    expect(m.f[1].state).not.toBe("grabbed");
  });
});

describe("boss phase", () => {
  it("gets serious at half health, once a round", () => {
    const m = createMatch(ROSTER[0], BOSS, { rules: { ...duel(2), boss: 1 } });
    fight(m);
    const boss = m.f[1];
    boss.hp = boss.def.hp * 0.45;
    step(m, NO_INPUT, NO_INPUT);
    expect(boss.enraged).toBe(true);
    expect(boss.meter).toBe(MAX_METER);
    expect(m.banner?.text).toBe("Old Spur gets serious!");
  });
});

describe("tag team", () => {
  const tagMatch = () => createMatch(fighterById("rusty"), fighterById("duke"), { rules: { ...duel(1), tag: true }, partners: [fighterById("pip"), fighterById("goldie")] });

  it("swaps a free bird for its partner on Peck and Kick together", () => {
    const m = tagMatch();
    fight(m);
    expect(m.f[0].def.id).toBe("rusty");
    step(m, press({ light: true, heavy: true }), NO_INPUT);
    expect(m.f[0].def.id).toBe("pip");
    expect(m.bench![0].def.id).toBe("rusty");
    // Not again straight away.
    for (let t = 0; t < 30; t++) step(m, NO_INPUT, NO_INPUT);
    step(m, press({ light: true, heavy: true }), NO_INPUT);
    expect(m.f[0].def.id).toBe("pip");
  });

  it("brings the partner in when a bird is knocked out, and ends the round only when both are", () => {
    const m = tagMatch();
    fight(m);
    m.f[1].hp = 1;
    m.f[1].x = m.f[0].x + 50;
    for (let t = 0; t < 40 && m.f[1].hp > 0; t++) step(m, press({ light: t % 2 === 0 }), NO_INPUT);
    expect(m.f[1].hp).toBeLessThanOrEqual(0);
    expect(m.phase).toBe("fight");
    for (let t = 0; t < 200 && m.f[1].def.id !== "goldie"; t++) step(m, NO_INPUT, NO_INPUT);
    expect(m.f[1].def.id).toBe("goldie");
    // A whole match between two CPU pairs finishes properly.
    const n = tagMatch();
    const c = [createCpu(2, 1), createCpu(2, 2)];
    let tags = 0;
    for (let t = 0; t < 60000 && n.phase !== "matchEnd"; t++) {
      step(n, cpuInput(n, 0, c[0]), cpuInput(n, 1, c[1]));
      tags += n.events.filter((e) => e.type === "tag").length;
    }
    expect(n.phase).toBe("matchEnd");
    expect(tags).toBeGreaterThan(0);
  });
});

describe("tag assist", () => {
  it("sends the benched partner charging across on Kick and Special, then cools down", () => {
    const m = createMatch(fighterById("rusty"), fighterById("duke"), { rules: { ...duel(1), tag: true }, partners: [fighterById("pip"), fighterById("goldie")] });
    fight(m);
    m.f[1].x = m.f[0].x + 160;
    const hp = m.f[1].hp;
    step(m, press({ heavy: true, special: true }), NO_INPUT);
    expect(m.shots.some((s) => s.spec.kind === "assist" && s.spec.assist === "pip")).toBe(true);
    expect(m.f[0].def.id).toBe("rusty");
    for (let t = 0; t < 60; t++) step(m, NO_INPUT, NO_INPUT);
    expect(m.f[1].hp).toBeLessThan(hp);
    // Not again straight away.
    step(m, press({ heavy: true, special: true }), NO_INPUT);
    expect(m.shots.filter((s) => s.spec.kind === "assist")).toHaveLength(0);
  });
});

describe("air throw", () => {
  it("catches a bird in mid-air and slams it down", () => {
    const m = createMatch(ROSTER[0], ROSTER[1], { rules: duel(1) });
    fight(m);
    const [a, b] = m.f;
    b.x = a.x + 40;
    // Both jump straight up; at the top, player 1 presses Kick towards player 2.
    step(m, press({ y: 1 }), press({ y: 1 }));
    let thrown = false;
    for (let t = 0; t < 40 && !thrown; t++) {
      step(m, press({ heavy: a.y > 40, x: 1 }), NO_INPUT);
      thrown = m.events.some((e) => e.type === "word" && e.text === "Air throw!");
    }
    expect(thrown).toBe(true);
    expect(b.hp).toBeLessThan(b.def.hp);
    expect(b.state).toBe("launched");
  });
});
