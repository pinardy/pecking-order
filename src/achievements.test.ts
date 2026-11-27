import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, QUICK_TIME_ATTACK, newlyEarned, plainFeat, type Feat } from "./achievements";
import { ROSTER } from "./game";
import { emptyStats, type Stats } from "./ui/stats";

const stats = (over: Partial<Stats> = {}): Stats => ({ ...emptyStats(), ...over });
/** An unremarkable loss to a Hen-level CPU. */
const feat = (over: Partial<Feat> = {}): Feat => plainFeat({ mode: "versus", won: false, fighter: "rusty", opponent: "dot", cpu: 1, bestCombo: 2, ...over });
const ids = (s: Stats, f: Feat | null = null, held: Record<string, string> = {}) => newlyEarned(held, s, f).map((a) => a.id);

describe("achievements", () => {
  it("have ids and names of their own, and say how they are earned", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.name)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(a.how).toMatch(/^[A-Z].+\.$/);
  });

  it("give nothing to a device nothing has been played on, or for an unremarkable loss", () => {
    expect(ids(stats())).toEqual([]);
    expect(ids(stats({ fights: 1 }), feat())).toEqual([]);
  });

  it("are read off the record, so what was done before they existed still counts", () => {
    const veteran = stats({ fights: 60, wins: 40, bestStreak: 6, cleared: ["rusty"], clears: [0, 1, 0, 0], stories: ["dot"], survival: 7, timeAttack: QUICK_TIME_ATTACK + 1, daily: { last: "2026-11-24", streak: 3 } });
    expect(ids(veteran)).toEqual(["first-win", "streak-5", "fights-50", "arcade", "story", "survival-5", "time-attack", "daily", "daily-3"]);
    expect(ids(stats({ timeAttack: QUICK_TIME_ATTACK - 1 }))).toEqual(["time-attack", "time-attack-quick"]);
    expect(ids(stats({ clears: [0, 0, 0, 1], cleared: ["pip"] }))).toEqual(["arcade", "arcade-hard"]);
    expect(ids(stats({ bossRush: { best: 8, cleared: true } }))).toEqual(["boss-rush"]);
  });

  it("are only earned once", () => {
    const s = stats({ wins: 1, fights: 1 });
    expect(ids(s)).toEqual(["first-win"]);
    expect(ids(s, null, { "first-win": "2026-11-24" })).toEqual([]);
  });

  it("want every fighter for the ones that say so, the newest included", () => {
    const all = ROSTER.map((f) => f.id);
    const most = all.filter((id) => id !== "pepper");
    const wins = (list: string[]) => Object.fromEntries(list.map((id) => [id, { fights: 1, wins: 1 }]));
    expect(ids(stats({ fighters: wins(most) }))).not.toContain("all-wins");
    expect(ids(stats({ fighters: wins(all) }))).toContain("all-wins");
    expect(ids(stats({ cleared: most, stories: most }))).toEqual(["arcade", "story"]);
    expect(ids(stats({ cleared: all, stories: all }))).toEqual(["arcade", "arcade-all", "story", "story-all"]);
    const flock = ACHIEVEMENTS.find((a) => a.id === "all-wins")!;
    expect(flock.progress!(stats({ fighters: wins(most) }))).toEqual([ROSTER.length - 1, ROSTER.length]);
  });

  it("count the feats in a fight only against the CPU", () => {
    const flawless = feat({ won: true, perfect: true, bestCombo: 9, throws: 3, counters: 5, health: 0.08 });
    expect(ids(stats(), flawless)).toEqual(["perfect", "combo-8", "close", "throws-3", "counters-5"]);
    expect(ids(stats(), { ...flawless, cpu: null })).toEqual(["versus"]);
    expect(ids(stats(), feat({ won: true, cpu: 3, health: 0.6 }))).toEqual(["champion"]);
    expect(ids(stats(), feat({ won: true, fighter: "pepper", opponent: "pepper", health: 0.6 }))).toEqual(["mirror", "pepper"]);
    // Losing with a sliver of health left is not a close win, and a knockout leaves none.
    expect(ids(stats(), feat({ won: false, health: 0.05 }))).toEqual([]);
  });

  it("know the bonus round, a second player and a friend online apart", () => {
    expect(ids(stats(), feat({ mode: "bonus", cpu: null, won: true, smashed: true }))).toEqual(["scarecrow"]);
    expect(ids(stats(), feat({ mode: "bonus", cpu: null, won: true }))).toEqual([]);
    expect(ids(stats(), feat({ mode: "versus", cpu: null }))).toEqual(["versus"]);
    expect(ids(stats(), feat({ mode: "online", cpu: null, online: true }))).toEqual(["online"]);
  });
});
