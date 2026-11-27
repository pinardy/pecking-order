import { step, type Input, type Match } from "../../game";
import type { InputSource } from "./sources";

// The game loop. It knows nothing about React, canvases or sound: it asks the input source
// for inputs, plays fixed 60 Hz ticks however fast the screen refreshes, and reports back.

const TICK_MS = 1000 / 60;
/** Frames without inputs before the wait is worth mentioning. */
const STALL_FRAMES = 90;
/** Ticks to linger on the winner before calling the match over. */
const LINGER = 110;

export interface RunnerHooks {
  paused(): boolean;
  /** True while the player has asked to skip ahead: time then runs four times as fast. The match itself plays out identically. */
  hurry?(m: Match): boolean;
  /** Both inputs, just before the tick they belong to is played. */
  inputs?(a: Input, b: Input, m: Match): void;
  /** After each tick. `m.events` holds what happened in it. */
  tick(m: Match): void;
  /**
   * Once per screen refresh, after any ticks. `gap` is the time since the last frame, `began` is when this one
   * started, and `ticks` is how many ticks were played in it: none while paused or waiting, and none on every
   * other refresh of a 120 Hz screen, so there is nothing new to draw.
   */
  frame(gap: number, began: number, ticks: number): void;
  /** The source has kept us waiting (true), or has caught up again (false). */
  stall?(waiting: boolean): void;
  /** The match is over, or the source has nothing more to play. Called once. */
  end(): void;
}

/**
 * Development only: ?speed=8 runs the game clock eight times as fast, so that tests which play
 * whole matches between CPUs finish in seconds. The match itself plays out exactly the same.
 */
const SPEED = import.meta.env.DEV ? Math.max(1, Math.min(20, Number(new URLSearchParams(location.search).get("speed")) || 1)) : 1;

/** Starts the loop. Returns a function that stops it. */
export function runMatch(m: Match, source: InputSource, hooks: RunnerHooks): () => void {
  let raf = 0;
  let last = performance.now();
  let owed = 0;
  let stalled = 0;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    hooks.end();
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const gap = now - last;
    last = now;
    const began = performance.now();
    let played = 0;
    if (!hooks.paused()) {
      owed += Math.min(100, gap) * SPEED + (hooks.hurry?.(m) ? TICK_MS * 3 : 0);
      for (let n = 0; owed >= TICK_MS && n < 5 * SPEED; n++) {
        const inputs = source.next(m);
        if (!inputs) {
          owed = 0;
          if (source.finished?.()) end();
          else if (++stalled === STALL_FRAMES) hooks.stall?.(true);
          break;
        }
        hooks.inputs?.(inputs[0], inputs[1], m);
        step(m, inputs[0], inputs[1]);
        source.after?.(m);
        hooks.tick(m);
        played++;
        owed -= TICK_MS;
        if (stalled) {
          if (stalled >= STALL_FRAMES) hooks.stall?.(false);
          stalled = 0;
        }
      }
      if (m.phase === "matchEnd" && m.phaseT > LINGER) end();
    }
    hooks.frame(gap, began, played);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
