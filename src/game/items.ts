import { MAX_METER, STAGE_W, WALL, type Match } from "./types";

// Pickups: in arenas that have them, corn and the odd worm drop in. Corn fills a third of
// the meter; a worm gives back a tenth of your health. First to walk over it gets it.

const EVERY = 540;
const FALL = 3.2;
const LIFE = 600;

export function stepItems(m: Match) {
  const [a, b] = m.f;
  if (m.phase === "fight" && m.tick % EVERY === 300 && m.items.length < 2) {
    // Where it lands depends on the clock and on where the fighters are, so it is the same on every device.
    const span = STAGE_W - 2 * WALL - 120;
    const x = WALL + 60 + (((Math.imul(m.tick, 40503) >>> 4) + Math.round(a.x * 7 + b.x * 13)) % span);
    m.items.push({ kind: Math.floor(m.tick / EVERY) % 3 === 2 ? "worm" : "corn", x, y: 330, t: 0 });
  }
  for (let i = m.items.length - 1; i >= 0; i--) {
    const it = m.items[i];
    it.y = Math.max(0, it.y - FALL);
    if (it.y === 0 && ++it.t > LIFE) {
      m.items.splice(i, 1);
      continue;
    }
    for (const f of m.f) {
      const up = f.state !== "launched" && f.state !== "down" && f.state !== "ko" && !f.def.prop;
      if (!up || Math.abs(f.x - it.x) > f.def.width / 2 + 12 || it.y > f.y + f.def.height || it.y < f.y - 10) continue;
      if (it.kind === "corn") f.meter = Math.min(MAX_METER, f.meter + 34);
      else f.hp = Math.min(f.def.hp, f.hp + Math.round(f.def.hp * 0.1));
      m.events.push({ type: "pickup", side: f.side, kind: it.kind });
      m.items.splice(i, 1);
      break;
    }
  }
}
