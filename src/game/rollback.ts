import { NEUTRAL, unpack } from "./pack";
import { step } from "./rounds";
import { restore, snapshot, type Snapshot } from "./snapshot";
import type { Input, Match } from "./types";

// Rollback for online play. Each device plays on at once using a guess for what the other
// player is holding (whatever they held last). When the real input arrives and the guess was
// wrong, the match is wound back to that tick and replayed with the truth, all within one frame.
// The result is local-feeling controls at the price of an occasional visible correction.
//
// Nothing here touches the network or the screen: inputs go in as packed numbers, by tick.

/** A fingerprint of a confirmed state, compared between the two devices to catch them drifting apart. */
const hashOf = (s: Snapshot) => `${s.f[0].hp}:${s.f[1].hp}:${Math.round(s.f[0].x)}:${Math.round(s.f[1].x)}`;
const CHECK_EVERY = 120;

export class Rollback {
  private local = new Map<number, number>();
  private remote = new Map<number, number>();
  /** The remote input each simulated tick was actually played with: the real one, or a guess. */
  private used = new Map<number, number>();
  /** The state before each tick that may still need replaying. */
  private snaps = new Map<number, Snapshot>();
  /** Every remote input before this tick is known. */
  private confirmedTo: number;
  /** The earliest tick that was played with a wrong guess, if any. */
  private dirty = Infinity;
  private checkAt: number;
  /** How many ticks have had to be replayed, in all. */
  replayed = 0;
  /** Every input pair that can no longer change, in order from the starting tick: player 1, player 2, player 1, ... */
  confirmed: number[] = [];
  private logged: number;
  /** The last two confirmed checkpoints, to pick a match up from if the connection drops. */
  marks: { tick: number; state: Snapshot }[] = [];
  /** Called with the fingerprint of each confirmed checkpoint. */
  onCheck: (tick: number, hash: string) => void = () => {};

  /**
   * @param side which fighter this device plays
   * @param delay ticks between pressing and taking effect (the same on both devices)
   * @param window how many ticks ahead of the last confirmed remote input this device may run
   */
  constructor(private side: 0 | 1, private delay: number, private window = 10, private start = 0) {
    // Nobody can have pressed anything for the first `delay` ticks (counted from `start`, when picking a match up part-way).
    this.confirmedTo = start + delay;
    this.logged = start;
    this.checkAt = (Math.floor(start / CHECK_EVERY) + 1) * CHECK_EVERY;
  }

  hasLocal(tick: number) {
    return this.local.has(tick);
  }

  setLocal(tick: number, input: number) {
    this.local.set(tick, input);
  }

  setRemote(tick: number, input: number) {
    this.remote.set(tick, input);
    if (this.used.has(tick) && this.used.get(tick) !== input) this.dirty = Math.min(this.dirty, tick);
    while (this.remote.has(this.confirmedTo)) this.confirmedTo++;
  }

  private remoteFor(tick: number): number {
    if (tick < this.start + this.delay) return NEUTRAL;
    // Not in yet: assume they are still holding what they held last.
    return this.remote.get(tick) ?? this.remote.get(this.confirmedTo - 1) ?? NEUTRAL;
  }

  private inputs(tick: number, theirs: number): [Input, Input] {
    const mine = unpack(tick < this.start + this.delay ? NEUTRAL : this.local.get(tick) ?? NEUTRAL);
    return this.side === 0 ? [mine, unpack(theirs)] : [unpack(theirs), mine];
  }

  /**
   * Brings the match up to date with everything now known, then returns the inputs to play
   * the next tick with. Null means this device is too far ahead and should wait a frame.
   */
  advance(m: Match): [Input, Input] | null {
    if (this.dirty < m.tick) {
      const now = m.tick;
      restore(m, this.snaps.get(this.dirty)!);
      while (m.tick < now) {
        const t = m.tick;
        this.snaps.set(t, snapshot(m));
        const theirs = this.remoteFor(t);
        this.used.set(t, theirs);
        const [a, b] = this.inputs(t, theirs);
        step(m, a, b);
        this.replayed++;
      }
    }
    this.dirty = Infinity;

    const t = m.tick;
    if (t - this.confirmedTo > this.window) return null;
    this.snaps.set(t, snapshot(m));
    const theirs = this.remoteFor(t);
    this.used.set(t, theirs);

    // Checkpoints are reported once nothing before them can change any more.
    // Ticks that have been played and can no longer change go on the record.
    for (const end = Math.min(this.confirmedTo, t); this.logged < end; this.logged++) {
      const quiet = this.logged < this.start + this.delay;
      const mine = quiet ? NEUTRAL : this.local.get(this.logged) ?? NEUTRAL;
      const other = quiet ? NEUTRAL : this.remote.get(this.logged) ?? NEUTRAL;
      this.confirmed.push(this.side === 0 ? mine : other, this.side === 0 ? other : mine);
    }
    while (this.checkAt <= this.confirmedTo && this.snaps.has(this.checkAt)) {
      this.marks = [...this.marks.slice(-1), { tick: this.checkAt, state: this.snaps.get(this.checkAt)! }];
      this.onCheck(this.checkAt, hashOf(this.snaps.get(this.checkAt)!));
      this.checkAt += CHECK_EVERY;
    }
    const inputs = this.inputs(t, theirs);
    // Anything before the confirmed point can never be needed again (the tick in hand always is).
    const keep = Math.min(this.confirmedTo, this.checkAt, t) - 1;
    for (const k of this.snaps.keys()) {
      if (k >= keep) break;
      this.snaps.delete(k);
      this.used.delete(k);
      this.local.delete(k);
      this.remote.delete(k);
    }
    return inputs;
  }
}
