import { read, write } from "./store";

// One-time hints: each is shown once per device, the first time it would be useful.

export type HintId = "charged" | "roll" | "perfect" | "rotate";

export const HINTS: Record<HintId, string> = {
  charged: "Half a meter: hold toward your opponent and press Crow for a charged special.",
  roll: "Knocked down? Hold left or right to roll as you get up.",
  perfect: "Block at the very last moment for a perfect block: no damage, and you move first.",
  rotate: "Turn your phone sideways for a bigger arena.",
};

export const seenHints = (): Set<string> => new Set(read("hints", 1, { seen: [] as string[] }).seen);

export const markHint = (id: HintId) => void write("hints", 1, { seen: [...seenHints(), id] });
