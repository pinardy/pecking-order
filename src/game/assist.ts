import { threatTo } from "./ai";
import { MAX_METER, type Input, type Match } from "./types";

// Assists for people who want an easier way in. They sit between what the player presses and
// what the engine is told: the engine itself plays by the same rules either way.

export interface Assist {
  /** Guard automatically against anything you could have blocked, when you are not pressing an attack. */
  block: boolean;
  /** Pressing Peck again after a peck lands does the special it leads into, or the super with a full meter. */
  combo: boolean;
}

export function assisted(m: Match, side: 0 | 1, raw: Input, a: Assist): Input {
  const me = m.f[side];
  const op = m.f[1 - side];
  let out = raw;
  if (a.combo && raw.light && me.state === "attack" && me.move?.cancel && me.connected) {
    if (me.meter >= MAX_METER) {
      out = { ...raw, light: false, sup: true, x: 0, y: 0 };
    } else {
      const which = me.def.specials.findIndex((s) => s.id === me.def.ender);
      out = { ...raw, light: false, special: true, x: which === 1 ? me.facing : 0, y: which === 2 ? -1 : 0 };
    }
  }
  const idle = !raw.light && !raw.heavy && !raw.special && !raw.sup && raw.y <= 0;
  const able = me.state === "idle" || me.state === "walk" || me.state === "crouch" || me.state === "block";
  if (a.block && idle && able) {
    const threat = threatTo(m, me, op, Math.abs(op.x - me.x));
    // Throws still get through: an assist that blocked everything would leave nothing to learn.
    if (threat) out = { ...out, x: 0, y: threat.low && op.y === 0 ? -1 : 0, block: true, auto: true };
  }
  return out;
}
