import { createMatch, fighterById, matchRules, step, unpack, type FighterDef, type Move } from "../../game";
import type { Listener } from "./listeners";
import type { Replay } from "./sources";

// What happened in a match, counted as it goes: for the numbers on the result screen,
// and for a word of advice to whoever lost.

export interface SideStats {
  /** Damage dealt, and how many hits it took. */
  damage: number;
  hits: number;
  bestCombo: number;
  /** Hits that caught the other side in the middle of an attack of their own. */
  counters: number;
  blocks: number;
  throws: number;
  /** Times a block failed, by reason. */
  caught: { low: number; high: number; throw: number };
  /** Damage taken, by the move that did it ("throw" for throws). */
  takenFrom: Record<string, number>;
}

export interface MatchStats {
  sides: [SideStats, SideStats];
  ticks: number;
}

const side = (): SideStats => ({ damage: 0, hits: 0, bestCombo: 0, counters: 0, blocks: 0, throws: 0, caught: { low: 0, high: 0, throw: 0 }, takenFrom: {} });

export function statsListener(): { listener: Listener; stats: MatchStats } {
  const stats: MatchStats = { sides: [side(), side()], ticks: 0 };
  const took = (who: 0 | 1, move: string, damage: number) => {
    const t = stats.sides[who].takenFrom;
    t[move] = (t[move] ?? 0) + damage;
  };
  return {
    stats,
    listener: {
      event(e) {
        if (e.type === "hit") {
          const by = stats.sides[1 - e.side];
          by.damage += e.damage;
          by.hits++;
          by.bestCombo = Math.max(by.bestCombo, e.combo);
          if (e.counter) by.counters++;
          took(e.side, e.move, e.damage);
        } else if (e.type === "throw") {
          stats.sides[e.side].throws++;
          stats.sides[e.side].damage += e.damage;
          took((1 - e.side) as 0 | 1, "throw", e.damage);
        } else if (e.type === "block") stats.sides[e.side].blocks++;
        else if (e.type === "caught") stats.sides[e.side].caught[e.why]++;
      },
      tick: () => void stats.ticks++,
    },
  };
}

function findMove(def: FighterDef, id: string): Move | undefined {
  return [...Object.values(def.normals), ...def.specials, ...def.ex, def.air, def.super].find((m) => m.id === id);
}

/** One piece of advice for the loser, drawn from what actually beat them. `winner` is who they lost to. */
export function tipFor(stats: MatchStats, loser: 0 | 1, winner: FighterDef): string {
  const me = stats.sides[loser];
  const them = stats.sides[1 - loser];
  const name = winner.name;
  if (me.caught.throw >= 2) return `You were thrown ${me.caught.throw} times while blocking. Press Kick the moment you are grabbed to shake it off.`;
  if (me.caught.low >= 3) return `${name} kept going low. Crouch while holding away to block sweeps and low pecks.`;
  if (me.caught.high >= 3) return `${name}’s attacks from the air got through. Stand up to block anything coming from above.`;
  const [worst, dealt] = Object.entries(me.takenFrom).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (worst && dealt > them.damage * 0.4) {
    if (worst === "throw") return `Most of the damage was throws. Do not stand still next to ${name}: peck first, or hop back with two taps away.`;
    const move = findMove(winner, worst);
    if (move?.shot) return `${move.name} did most of the damage. Jump over it, or block it and walk in.`;
    if (move) return `${move.name} did most of the damage. Block it, then hit back while ${name} recovers.`;
  }
  const faced = me.blocks + them.hits;
  if (faced > 8 && me.blocks / faced < 0.2) return `You blocked ${me.blocks} of ${faced} attacks. Hold away from ${name} to block.`;
  if (me.bestCombo < 2) return "Try following a landed peck with a special. It is the easiest combo, and it adds up.";
  return "That was close. Watch what they do after you block, and hit them while they recover.";
}

/** Plays a recorded match through, feeding the stats listener. Yields every `slice` ticks so the caller can pause. */
function* tallying(r: Replay, slice: number): Generator<void, MatchStats> {
  const m = createMatch(fighterById(r.p1), fighterById(r.p2), { rules: { ...matchRules(r.rounds, r.stage, r.effects), ...r.extra }, maxSep: r.maxSep, partners: r.partners && [fighterById(r.partners[0]), fighterById(r.partners[1])] });
  const { listener, stats } = statsListener();
  for (let i = 0; i + 1 < r.inputs.length; i += 2) {
    step(m, unpack(r.inputs[i]), unpack(r.inputs[i + 1]));
    for (const e of m.events) listener.event?.(e, m);
    listener.tick?.(m);
    if ((i / 2) % slice === slice - 1) yield;
  }
  return stats;
}

/**
 * The stats for a recorded match, by playing it through a few milliseconds at a time with the screen free to repaint in between. Used at the end
 * of an online match, where the live count cannot be trusted and a pause on a slow phone would show.
 */
export async function statsInSlices(r: Replay, slice = 1200): Promise<MatchStats> {
  const run = tallying(r, slice);
  for (;;) {
    const step = run.next();
    if (step.done) return step.value;
    await new Promise((go) => setTimeout(go));
  }
}
