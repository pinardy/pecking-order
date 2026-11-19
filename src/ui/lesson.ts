import type { DummyMode } from "../game";
import { keyLabel, type KeyMap } from "./input";

// The tutorial: nine things to do, each checked off by the fight screen when it sees it happen.

export type LessonId = "walk" | "jump" | "peck" | "kick" | "block" | "throw" | "special" | "dash" | "crow" | "flutter" | "charged" | "counter" | "perfect" | "roll";

export interface LessonStep {
  id: LessonId;
  title: string;
  /** What to do, worded for touch or for keys. */
  how: (keys: KeyMap | null) => string;
  /** What the sparring partner does meanwhile. */
  dummy: DummyMode;
}

const key = (keys: KeyMap | null, action: keyof KeyMap) => (keys ? ` (${keyLabel(keys[action])})` : "");

export const LESSON: LessonStep[] = [
  { id: "walk", title: "Walk up to them", dummy: "stand", how: (k) => (k ? `Hold ${keyLabel(k.right)} or ${keyLabel(k.left)} to walk.` : "Push the stick toward them.") },
  { id: "jump", title: "Jump", dummy: "stand", how: (k) => (k ? `Press ${keyLabel(k.up)}.` : "Push the stick up.") },
  { id: "peck", title: "Land a peck", dummy: "stand", how: (k) => `Get close and press Peck${key(k, "light")}. It is quick.` },
  { id: "kick", title: "Land a kick", dummy: "stand", how: (k) => `Press Kick${key(k, "heavy")}. It is slower and hits harder.` },
  { id: "block", title: "Block an attack", dummy: "fight", how: (k) => (k ? "They are coming for you. Hold the direction away from them." : "They are coming for you. Hold the stick away from them.") },
  { id: "throw", title: "Throw them", dummy: "block", how: (k) => `They are blocking now. Stand right next to them, hold toward, and press Kick${key(k, "heavy")}.` },
  { id: "special", title: "Land a special", dummy: "stand", how: (k) => `Press Special${key(k, "special")}. It changes if you hold toward or down.` },
  { id: "dash", title: "Dash", dummy: "stand", how: (k) => (k ? "Tap toward them twice, quickly." : "Flick the stick toward them twice, quickly.") },
  { id: "crow", title: "Crow", dummy: "stand", how: (k) => `Your meter is full. Let go of the stick and press Crow${key(k, "sup")}.` },
];

/** The second lesson: the finer points, for once the basics are comfortable. */
export const ADVANCED: LessonStep[] = [
  { id: "flutter", title: "Flutter", dummy: "stand", how: (k) => (k ? `Jump, then hold ${keyLabel(k.up)} on the way down. Hens fall slowly; every breed has a trick of its own.` : "Jump, then keep the stick held up on the way down. Hens fall slowly; every breed has a trick of its own.") },
  { id: "charged", title: "Charged special", dummy: "stand", how: (k) => `Half a meter buys a stronger special. Hold toward and press Crow${key(k, "sup")}.` },
  { id: "counter", title: "Land a counter", dummy: "swing", how: () => "They kick on a steady beat. Hit them just as a kick is starting, before it lands." },
  { id: "perfect", title: "Perfect block", dummy: "swing", how: (k) => (k ? "Now block a kick at the last moment: tap away from them just before it lands." : "Now block a kick at the last moment: flick the stick away from them just before it lands.") },
  { id: "roll", title: "Roll as you get up", dummy: "sweep", how: () => "Let a sweep knock you down. As you lie there, hold toward or away to roll that way on getting up." },
];
