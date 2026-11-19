import type { Input } from "./types";

/** An Input squeezed into nine bits, for replays and online play. */
export function pack(i: Input): number {
  return (i.x + 1) | ((i.y + 1) << 2) | (i.light ? 16 : 0) | (i.heavy ? 32 : 0) | (i.special ? 64 : 0) | (i.sup ? 128 : 0) | (i.block ? 256 : 0) | (i.auto ? 512 : 0);
}

export function unpack(b: number): Input {
  return {
    x: ((b & 3) - 1) as -1 | 0 | 1, y: (((b >> 2) & 3) - 1) as -1 | 0 | 1,
    light: !!(b & 16), heavy: !!(b & 32), special: !!(b & 64), sup: !!(b & 128), block: !!(b & 256), auto: !!(b & 512),
  };
}

/** Nothing held. */
export const NEUTRAL = 5;
