import { NO_INPUT, Rollback, assisted, cpuInput, type Assist, type Cpu, type Input, type Match, type Snapshot, type Rules } from "../../game";
import type { NetLink } from "../../net";
import { pack, readInput, unpack } from "../input";

// Where a match's inputs come from. The fight screen does not care whether it is two people,
// a person and the CPU, a recording, or someone on the other end of a network link: each is
// an InputSource, and the loop asks it for the next tick's inputs.

/** Everything needed to play a match back: how it was set up, and every input. */
export interface Replay {
  p1: string;
  p2: string;
  stage: number;
  rounds: number;
  maxSep: number;
  /** Whether arena effects (pickups, bouncing walls) were on. */
  effects: boolean;
  /** Any rules beyond the arena's own (a story twist, a boss), and tag partners. */
  extra?: Partial<Rules>;
  partners?: [string, string];
  /** Which sides wore their alternate feathers, and player 1's starting health where it was not a full bar. */
  alts?: [boolean, boolean];
  startHp?: number;
  /** Two numbers per tick: player 1, player 2. */
  inputs: number[];
}

export interface InputSource {
  /** Both players' inputs for the tick about to be played, or null if they are not in yet. */
  next(m: Match): readonly [Input, Input] | null;
  /** Called once the tick has been played. */
  after?(m: Match): void;
  /** True when a null from next() means "over" rather than "wait". */
  finished?(): boolean;
  dispose?(): void;
}

/** People at this device. `brain` plays the second side if there is one; `auto` (development only) plays the first. */
/**
 * Training: what the player does, recorded for the dummy to do back. Directions are kept relative
 * to the way the bird faces (toward and away), so the dummy's copy comes at the player, not away.
 */
export interface DummyTape {
  mode: "off" | "recording" | "playing";
  frames: number[];
  at: number;
}

/** The longest a recording can run: ten seconds. */
const TAPE_MAX = 600;

const relative = (i: Input, facing: number): Input => ({ ...i, x: (i.x * facing) as -1 | 0 | 1 });

export function localSource(o: { solo: boolean; brain: () => Cpu | null; secondPlayer: boolean; auto: Cpu | null; assist: Assist | null; tape?: DummyTape }): InputSource {
  return {
    next(m) {
      const cpu = o.brain();
      const mine = o.auto ? cpuInput(m, 0, o.auto) : readInput(0, o.solo);
      const tape = o.tape;
      if (tape?.mode === "recording" && m.phase === "fight") {
        tape.frames.push(pack(relative(mine, m.f[0].facing)));
        if (tape.frames.length >= TAPE_MAX) tape.mode = "off";
      }
      // Playing back: the dummy does what was recorded, over and over.
      const theirs = tape?.mode === "playing" && tape.frames.length > 0 ? relative(unpack(tape.frames[tape.at++ % tape.frames.length]), m.f[1].facing) : null;
      return [o.assist ? assisted(m, 0, mine, o.assist) : mine, theirs ?? (cpu ? cpuInput(m, 1, cpu) : o.secondPlayer ? readInput(1, false) : NO_INPUT)];
    },
  };
}

export function replaySource(replay: Replay): InputSource {
  let over = false;
  return {
    next(m) {
      const i = m.tick * 2;
      if (i + 1 >= replay.inputs.length) {
        over = true;
        return null;
      }
      return [unpack(replay.inputs[i]), unpack(replay.inputs[i + 1])];
    },
    finished: () => over,
  };
}

/**
 * Online play with rollback. This device plays on straight away, guessing that the other player
 * is still holding what they held last, and replays the last few ticks whenever a guess turns
 * out wrong. Inputs still take effect `delay` ticks after they are pressed, which makes wrong
 * guesses rarer. `onDrift` fires if the two devices ever disagree about a confirmed state.
 */
/** A confirmed checkpoint: a state both devices are known to share. */
export interface Mark {
  tick: number;
  state: Snapshot;
}

interface NetOptions {
  link: NetLink;
  side: 0 | 1;
  delay: number;
  auto: Cpu | null;
  onDrift: () => void;
  /** Picking a match up after a drop: the tick it restarts from. */
  start?: number;
  /** Called with the latest checkpoints whenever a new one is confirmed. */
  onMark?: (marks: Mark[]) => void;
}

export function netSource(o: NetOptions): InputSource & { confirmed(): number[] } {
  const rb = new Rollback(o.side, o.delay, 10, o.start ?? 0);
  let marked = -1;
  const checks = new Map<number, string>();
  const check = (t: number, h: string) => {
    const other = checks.get(t);
    if (other === undefined) checks.set(t, h);
    else if (other !== h) o.onDrift();
  };
  // Development only: ?lag=120 holds every input back that many milliseconds, to see rollback at work.
  const lag = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get("lag")) || 0 : 0;
  rb.onCheck = (t, h) => {
    check(t, h);
    o.link.send({ k: "h", t, h });
  };
  const stop = o.link.subscribe((msg) => {
    if (msg.k === "i") rb.setRemote(msg.t, msg.i);
    else if (msg.k === "h") check(msg.t, msg.h);
  });
  return {
    next(m) {
      const t = m.tick + o.delay;
      if (!rb.hasLocal(t)) {
        const i = pack(o.auto ? cpuInput(m, o.side, o.auto) : readInput(0, true));
        rb.setLocal(t, i);
        if (lag) setTimeout(() => o.link.send({ k: "i", t, i }), lag);
        else o.link.send({ k: "i", t, i });
      }
      const inputs = rb.advance(m);
      const latest = rb.marks[rb.marks.length - 1];
      if (latest && latest.tick !== marked) {
        marked = latest.tick;
        o.onMark?.(rb.marks);
      }
      return inputs;
    },
    confirmed: () => rb.confirmed,
    dispose: stop,
  };
}
