// npm run balance: how the fighters fare against each other, CPU against CPU, at Hen and Rooster level,
// and how often the newer mechanics come up. It is a guide for tuning, not a verdict: people play differently.
import { BOSS, ROSTER, createCpu, createMatch, cpuInput, duel, step, type CpuLevel, type FighterDef } from "../src/game";

const GAMES = Number(process.env.GAMES) || 8;

function play(a: FighterDef, b: FighterDef, la: CpuLevel, lb: CpuLevel, seed: number, seen?: Record<string, number>, boss = false) {
  const m = createMatch(a, b, { rules: { ...duel(2), ...(boss ? { boss: 1 as const } : {}) } });
  const cpu = [createCpu(la, seed + 1), createCpu(lb, seed + 2)];
  for (let t = 0; m.phase !== "matchEnd" && t < 200_000; t++) {
    step(m, cpuInput(m, 0, cpu[0]), cpuInput(m, 1, cpu[1]));
    if (seen) for (const e of m.events) {
      const k = e.type === "word" ? e.text : e.type === "hit" && e.move === "launch" ? "Launcher" : e.type;
      seen[k] = (seen[k] ?? 0) + 1;
    }
  }
  return m.winner;
}

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`.padStart(4);
const N = ROSTER.length;
for (const level of [1, 2] as const) {
  const wins = ROSTER.map(() => 0);
  const games = ROSTER.map(() => 0);
  const seen: Record<string, number> = {};
  let n = 0;
  for (let a = 0; a < N; a++)
    for (let b = 0; b < N; b++) {
      if (a === b) continue;
      for (let k = 0; k < GAMES; k++) {
        const w = play(ROSTER[a], ROSTER[b], level, level, 5000 + a * 100 + b * 10 + k + level * 7919, seen);
        n++;
        games[a]++;
        games[b]++;
        wins[w === 0 ? a : b]++;
      }
    }
  console.log(`\n${level === 1 ? "Hen" : "Rooster"} level, ${n} matches`);
  for (let i = 0; i < N; i++) console.log(`  ${ROSTER[i].name.padEnd(10)} wins ${pct(wins[i], games[i])}`);
  const per = (k: string) => ((seen[k] ?? 0) / n).toFixed(1);
  console.log(`  per match: ${per("Counter!")} counters, ${per("Perfect!")} perfect blocks, ${per("burst")} bursts, ${per("Launcher")} launchers, ${per("throw")} throws`);
}
let bw = 0;
let bg = 0;
for (let a = 0; a < N; a++) for (let k = 0; k < GAMES; k++, bg++) if (play(ROSTER[a], BOSS, 2, 2, 700 + a * 10 + k, undefined, true) === 1) bw++;
console.log(`\nOld Spur (second phase on), Rooster against Rooster: wins ${pct(bw, bg)}`);
