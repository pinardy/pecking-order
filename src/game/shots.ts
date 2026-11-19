import { STAGE_W, type Fighter, type Match, type Move, type Shot, type ShotSpec } from "./types";
import { dust, fx } from "./state";
import { RA, RB, hittable, hurtRect, overlap, shotRect } from "./geometry";
import { applyHit } from "./combat";

// Projectiles: launching them, flying them, and landing them.

export const hasShot = (m: Match, side: 0 | 1) => m.shots.some((s) => s.side === side);

export function fireShots(m: Match, f: Fighter, mv: Move) {
  const spec = mv.shot!;
  if (f.moveT !== spec.at) return;
  const count = spec.count ?? 1;
  for (let i = 0; i < count; i++) {
    const fan = (i - (count - 1) / 2) * (spec.spread ?? 0);
    const shot: Shot = {
      spec, side: f.side, x: 0, y: 0, move: mv.id,
      vx: f.facing * (spec.vx + (count > 1 ? ((i % 3) - 1) * 0.5 : 0)), vy: spec.vy + fan,
      hits: spec.hits ?? 1, life: spec.life ?? 400, age: 0, cool: 0,
      delay: i * (spec.every ?? 0), power: f.def.power, big: mv.kind === "super", planted: false,
    };
    m.shots.push(shot);
    if (shot.delay === 0) release(m, shot, f);
  }
}

export function release(m: Match, s: Shot, f: Fighter) {
  s.x = f.x + f.facing * (f.def.width * 0.5 + 8);
  s.y = f.y + s.spec.y;
  m.events.push({ type: "shot", kind: s.spec.kind });
}

export function stepShots(m: Match) {
  for (let i = m.shots.length - 1; i >= 0; i--) {
    const s = m.shots[i];
    const owner = m.f[s.side];
    const foe = m.f[1 - s.side];
    if (s.delay > 0) {
      // The rest of a barrage is lost if the thrower is knocked out of it.
      if (owner.state !== "attack") m.shots.splice(i, 1);
      else if (--s.delay === 0) release(m, s, owner);
      continue;
    }
    s.age++;
    s.x += s.vx;
    s.y += s.vy;
    if (!s.planted) s.vy -= s.spec.g;
    if (s.cool > 0) s.cool--;
    if (--s.life <= 0 || s.x < -50 || s.x > STAGE_W + 50 || s.y < -30) {
      if (s.life <= 0) fx(m, "ring", s.x, s.y, { size: s.spec.size, life: 10 });
      m.shots.splice(i, 1);
      continue;
    }
    if (s.spec.mine && !s.planted && s.y <= 5) {
      // A mine stays where it lands and waits.
      s.planted = true;
      s.y = 5;
      s.vx = s.vy = 0;
      s.life = s.spec.mine;
      dust(m, s.x, 2);
    }
    if (s.spec.g > 0 && s.y <= 3) {
      if (s.spec.kind === "egg") {
        fx(m, "splat", s.x, 0, { size: s.spec.size, life: 70 });
        m.events.push({ type: "splat" });
      } else dust(m, s.x, 2);
      m.shots.splice(i, 1);
      continue;
    }
    if (m.phase !== "fight" || s.cool > 0 || !hittable(foe) || !overlap(shotRect(s, RA), hurtRect(foe, RB))) continue;
    applyHit(m, owner, foe, {
      damage: Math.round(s.spec.damage * s.power), hitstun: 18, blockstun: 12, push: 6, level: s.spec.level, knock: s.spec.knock,
      chip: s.big ? 0.2 : 0.15, power: s.big ? 2 : 1, dir: s.planted ? (foe.x >= owner.x ? 1 : -1) : s.vx >= 0 ? 1 : -1, melee: false, noMeter: s.big, id: s.move, wind: 99,
    }, s.x, s.y, s.hits === 1);
    s.cool = 7;
    if (--s.hits <= 0) {
      if (s.spec.kind === "egg") {
        fx(m, "splat", s.x, s.y, { size: s.spec.size * 0.8, life: 22 });
        m.events.push({ type: "splat" });
      }
      m.shots.splice(i, 1);
    }
  }
  if (m.shots.length < 2) return;
  // Shots from opposite sides wear each other down.
  for (const a of m.shots) {
    for (const b of m.shots) {
      if (a.side !== 0 || b.side !== 1 || a.delay > 0 || b.delay > 0 || a.hits <= 0 || b.hits <= 0) continue;
      if (!overlap(shotRect(a, RA), shotRect(b, RB))) continue;
      a.hits--;
      b.hits--;
      fx(m, "ring", (a.x + b.x) / 2, (a.y + b.y) / 2, { size: 18, life: 12 });
      m.events.push({ type: "block", side: 0 });
    }
  }
  m.shots = m.shots.filter((s) => s.hits > 0);
}

/**
 * Tag team: the partner on the bench charges in from behind for a single hit and is gone again.
 * It is a projectile in all but looks, so it can be blocked, and it vanishes if its side is hit hard.
 */
export function spawnAssist(m: Match, f: Fighter, partner: Fighter) {
  const spec: ShotSpec = {
    kind: "assist", assist: partner.def.id, at: 0, vx: 8.5, vy: 0, g: 0,
    damage: Math.round(70 * partner.def.power), y: 4, size: 30, level: "mid", hits: 1, life: 120, knock: { x: 3.5, y: 7 },
  };
  m.shots.push({
    spec, side: f.side, x: f.x - f.facing * 90, y: 0, move: "assist",
    vx: f.facing * spec.vx, vy: 0, hits: 1, life: spec.life!, age: 0, cool: 0, delay: 0, power: 2, big: false, planted: false,
  });
  m.events.push({ type: "assist", side: f.side });
}
