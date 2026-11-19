import { squeeze, unsqueeze } from "../codec";
import { fighterById } from "../game";
import type { Replay } from "./fight/sources";

// A replay as a code to send to a friend. A replay is only a match's setup and its inputs,
// so the code is small, and it only plays back on the version of the rules it was made with.

/** The engine's fingerprint (see vite.config.ts): it changes by itself whenever the engine's code does. */
export const RULES_VERSION = __ENGINE__;
const PREFIX = "PO-REPLAY-";

/** Inputs as runs: how many ticks, then what each player held for them. */
function pack(inputs: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < inputs.length; i += 2) {
    const n = out.length;
    if (n >= 3 && out[n - 2] === inputs[i] && out[n - 1] === inputs[i + 1]) out[n - 3]++;
    else out.push(1, inputs[i], inputs[i + 1]);
  }
  return out;
}

function unpack(runs: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i + 2 < runs.length; i += 3) for (let k = 0; k < runs[i]; k++) out.push(runs[i + 1], runs[i + 2]);
  return out;
}

export async function encodeReplay(r: Replay): Promise<string> {
  return PREFIX + (await squeeze(JSON.stringify({ ...r, inputs: pack(r.inputs), rules: RULES_VERSION })));
}

/** Reads a replay code. Throws an Error whose message can be shown to the player. */
export async function decodeReplay(code: string): Promise<Replay> {
  const at = code.indexOf(PREFIX);
  if (at < 0) throw new Error("That is not a replay code.");
  let data: (Replay & { rules?: string }) | null = null;
  try {
    data = JSON.parse(await unsqueeze(code.slice(at + PREFIX.length).trim()));
  } catch {
    throw new Error("That replay code is damaged. Check that all of it was copied.");
  }
  if (!data || !Array.isArray(data.inputs) || typeof data.p1 !== "string" || typeof data.p2 !== "string") throw new Error("That replay code is damaged. Check that all of it was copied.");
  if (data.rules !== RULES_VERSION) throw new Error("That replay was recorded with a different version of the game, so it would not play back correctly.");
  if (fighterById(data.p1).id !== data.p1 || fighterById(data.p2).id !== data.p2) throw new Error("That replay uses a fighter this version does not have.");
  const { rules: _rules, ...replay } = data;
  return { ...replay, inputs: unpack(data.inputs) };
}
