import { describe, expect, it } from "vitest";
import { NO_INPUT, ROSTER, Rollback, createCpu, createMatch, cpuInput, duel, pack, restore, snapshot, step, type Match } from "./index";

describe("snapshot", () => {
  it("restores a match so that it plays on exactly as it would have", () => {
    const run = (rewind: boolean) => {
      const m = createMatch(ROSTER[1], ROSTER[4], { rules: duel(2) });
      const c = [createCpu(2, 11), createCpu(2, 12)];
      const inputs = [];
      for (let t = 0; t < 900; t++) {
        const pair = [cpuInput(m, 0, c[0]), cpuInput(m, 1, c[1])] as const;
        inputs.push(pair);
        step(m, pair[0], pair[1]);
        if (rewind && t === 600) {
          // Go back five seconds and play the same inputs again.
          const saved = snapshot(m);
          for (let k = 0; k < 40; k++) step(m, NO_INPUT, NO_INPUT);
          restore(m, saved);
        }
      }
      return JSON.stringify(m.f.map((f) => [f.x, f.y, f.hp, f.meter, f.state, f.score]));
    };
    expect(run(true)).toBe(run(false));
  });
});

/** Two devices, each with its own copy of the match, joined by a link that delivers inputs late. */
function playOnline(lagTicks: (n: number) => number, seed: number) {
  const make = () => createMatch(ROSTER[seed % 8], ROSTER[(seed * 3 + 2) % 8], { rules: duel(2) });
  const peers = ([0, 1] as const).map((side) => ({ side, m: make() as Match, rb: new Rollback(side, 2), cpu: createCpu(2, seed * 10 + side), checks: new Map<number, string>() }));
  const wire: { at: number; to: 0 | 1; t: number; i: number }[] = [];
  peers.forEach((p) => (p.rb.onCheck = (t, h) => p.checks.set(t, h)));
  let n = 0;
  for (let now = 0; now < 40000 && !(peers.every((p) => p.m.phase === "matchEnd") && wire.length === 0 && n > 200); now++) {
    for (let k = wire.length - 1; k >= 0; k--) {
      if (wire[k].at <= now) {
        peers[wire[k].to].rb.setRemote(wire[k].t, wire[k].i);
        wire.splice(k, 1);
      }
    }
    for (const p of peers) {
      // The second device drops a frame now and then, so the two are never neatly in step.
      if (p.side === 1 && now % 9 === 4) continue;
      const t = p.m.tick;
      if (!p.rb.hasLocal(t + 2)) {
        const i = pack(cpuInput(p.m, p.side, p.cpu));
        p.rb.setLocal(t + 2, i);
        wire.push({ at: now + lagTicks(now + p.side * 7), to: (1 - p.side) as 0 | 1, t: t + 2, i });
      }
      const inputs = p.rb.advance(p.m);
      if (inputs) step(p.m, inputs[0], inputs[1]);
    }
    if (peers.every((p) => p.m.phase === "matchEnd")) n++;
  }
  return peers;
}

describe("rollback", () => {
  it("keeps two devices in agreement over a slow, uneven link", () => {
    for (const seed of [1, 2, 3]) {
      const [a, b] = playOnline((n) => 3 + ((n * 7) % 5), seed);
      expect(a.m.phase).toBe("matchEnd");
      expect(b.m.winner).toBe(a.m.winner);
      // Every checkpoint both devices reached has the same fingerprint.
      const shared = [...a.checks.keys()].filter((t) => b.checks.has(t));
      expect(shared.length).toBeGreaterThan(10);
      for (const t of shared) expect(b.checks.get(t)).toBe(a.checks.get(t));
      // And the link was slow enough that guesses were wrong and had to be corrected.
      expect(a.rb.replayed + b.rb.replayed).toBeGreaterThan(50);
    }
  });

  it("waits rather than running too far ahead of a silent opponent", () => {
    const m = createMatch(ROSTER[0], ROSTER[1], { rules: duel(1) });
    const rb = new Rollback(0, 2, 10);
    let played = 0;
    for (let t = 0; t < 60; t++) {
      rb.setLocal(m.tick + 2, 5);
      const inputs = rb.advance(m);
      if (inputs) {
        step(m, inputs[0], inputs[1]);
        played++;
      }
    }
    expect(played).toBe(13);
  });
});
