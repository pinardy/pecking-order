import { describe, expect, it } from "vitest";
import { dailyFor, dayKey, isDayBefore } from "./daily";

describe("daily challenge", () => {
  it("is the same all day and never pits a fighter against themselves", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const morning = new Date(2026, 0, 1 + i, 6);
      const night = new Date(2026, 0, 1 + i, 23);
      const a = dailyFor(morning);
      expect(dailyFor(night)).toEqual(a);
      expect(a.them.id).not.toBe(a.you.id);
      seen.add(`${a.you.id}:${a.twist.label}`);
    }
    // Over four months it gets round a good spread of fighters and twists.
    expect(seen.size).toBeGreaterThan(20);
  });

  it("knows yesterday from the day before", () => {
    expect(isDayBefore("2026-02-28", "2026-03-01")).toBe(true);
    expect(isDayBefore("2026-02-27", "2026-03-01")).toBe(false);
    expect(dayKey(new Date(2026, 10, 5))).toBe("2026-11-05");
  });
});
