import type { Box, Breed, FighterDef, Look, Move, Palette, PoseKey, ShotSpec } from "./types";
import { BARN, BARN_DEEP, CARROT, CREAM, CREAM_DEEP, INK, LEAF, STRAW, STRAW_DEEP } from "../palette";

// Every fighter is data. Normals are generated from the fighter's size, reach and power so
// all six share one set of timings; the three specials and the super are what set them apart.

interface Dims {
  width: number;
  height: number;
  reach: number;
  power: number;
}

const box = (x0: number, x1: number, y0: number, y1: number): Box => ({ x0, x1, y0, y1 });

function buildNormals(d: Dims): FighterDef["normals"] {
  const { width: W, height: H, reach: R, power: P } = d;
  const front = W * 0.5;
  const base = { kind: "normal" as const, level: "mid" as const };
  return {
    sLight: {
      ...base, id: "sLight", name: "Peck", pose: "peck",
      startup: 4, active: 3, recovery: 7, damage: Math.round(40 * P), hitstun: 18, blockstun: 10, push: 5,
      box: box(W * 0.15, front + 34 * R, H * 0.36, H * 0.92), cancel: true,
    },
    sHeavy: {
      ...base, id: "sHeavy", name: "Kick", pose: "kick",
      startup: 9, active: 4, recovery: 17, damage: Math.round(88 * P), hitstun: 21, blockstun: 14, push: 8,
      box: box(W * 0.15, front + 46 * R, H * 0.1, H * 0.6),
    },
    cLight: {
      ...base, id: "cLight", name: "Low peck", pose: "lowpeck", level: "low",
      startup: 5, active: 3, recovery: 8, damage: Math.round(34 * P), hitstun: 14, blockstun: 9, push: 5,
      box: box(W * 0.15, front + 30 * R, 0, Math.max(22, H * 0.4)), cancel: true,
    },
    cHeavy: {
      ...base, id: "cHeavy", name: "Sweep", pose: "sweep", level: "low",
      startup: 8, active: 4, recovery: 22, damage: Math.round(76 * P), hitstun: 20, blockstun: 12, push: 6,
      box: box(W * 0.15, front + 50 * R, 0, Math.max(16, H * 0.24)), knock: { x: 2.4, y: 6.5 },
    },
    jLight: {
      ...base, id: "jLight", name: "Air peck", pose: "airpeck", level: "high", air: true,
      startup: 4, active: 9, recovery: 6, damage: Math.round(46 * P), hitstun: 15, blockstun: 10, push: 4,
      box: box(0, front + 28 * R, -12, H * 0.55),
    },
    jHeavy: {
      ...base, id: "jHeavy", name: "Drop kick", pose: "airkick", level: "high", air: true,
      startup: 6, active: 12, recovery: 6, damage: Math.round(82 * P), hitstun: 22, blockstun: 14, push: 5,
      box: box(0, front + 38 * R, -20, H * 0.42),
    },
    // Down + toward + Kick: an upward peck that pops the opponent up, high enough to jump after and hit again.
    launch: {
      ...base, id: "launch", name: "Launcher", pose: "uppeck",
      startup: 8, active: 4, recovery: 15, damage: Math.round(62 * P), hitstun: 20, blockstun: 11, push: 3,
      box: box(W * 0.1, front + 30 * R, H * 0.3, H * 1.25), knock: { x: 1.4, y: 12.5 },
    },
  };
}

type Extra = Partial<Move>;
const special = (kind: "special" | "super") => ({ kind, level: "mid" as const, chip: kind === "super" ? 0.2 : 0.15 });

/** Stand still and send something flying. */
function projectile(id: string, name: string, shot: ShotSpec, recovery: number, kind: "special" | "super" = "special", extra: Extra = {}): Move {
  const volley = ((shot.count ?? 1) - 1) * (shot.every ?? 0);
  return {
    ...special(kind), id, name, pose: "cast",
    startup: shot.at, active: 2 + volley, recovery,
    damage: shot.damage, hitstun: 18, blockstun: 12, push: 6, box: null, shot, ...extra,
  };
}

/** Charge forward along the ground. */
function dash(id: string, name: string, d: Dims, o: { startup: number; active: number; recovery: number; speed: number; damage: number; pose?: PoseKey }, kind: "special" | "super" = "special", extra: Extra = {}): Move {
  return {
    ...special(kind), id, name, pose: o.pose ?? "dash",
    startup: o.startup, active: o.active, recovery: o.recovery,
    damage: Math.round(o.damage * d.power), hitstun: 20, blockstun: 16, push: 9,
    box: box(0, d.width * 0.5 + 22, d.height * 0.08, d.height * 0.85),
    dash: o.speed, knock: { x: 5, y: 7.5 }, ...extra,
  };
}

/** Shoot upward, comb first. The answer to anything coming from above. */
function rising(id: string, name: string, d: Dims, o: { startup: number; vx: number; vy: number; damage: number; recovery: number }, extra: Extra = {}): Move {
  return {
    ...special("special"), id, name, pose: "rise",
    startup: o.startup, active: 16, recovery: o.recovery,
    damage: Math.round(o.damage * d.power), hitstun: 20, blockstun: 14, push: 7,
    box: box(-6, d.width * 0.5 + 20, d.height * 0.3, d.height * 1.2),
    leap: { vx: o.vx, vy: o.vy }, invuln: o.startup + 5, knock: { x: 3.6, y: 10.5 }, ...extra,
  };
}

/** Hop up and come down on top of them. Has to be blocked standing. */
function pound(id: string, name: string, d: Dims, o: { startup: number; vx: number; vy: number; damage: number; recovery: number }, extra: Extra = {}): Move {
  return {
    ...special("special"), id, name, pose: "pound", level: "high",
    startup: o.startup, active: 1, recovery: o.recovery,
    damage: Math.round(o.damage * d.power), hitstun: 22, blockstun: 15, push: 7,
    box: box(-d.width * 0.5 - 8, d.width * 0.5 + 18, -18, d.height * 0.55),
    leap: { vx: o.vx, vy: o.vy, fallOnly: true }, knock: { x: 3, y: 8 }, ...extra,
  };
}

/** Air special: hang for a beat, then drop on them feet first. */
function dive(id: string, name: string, d: Dims, o: { vx: number; vy: number; damage: number; pose?: PoseKey }): Move {
  return {
    ...special("special"), id, name, pose: o.pose ?? "airkick", level: "high", air: true,
    startup: 6, active: 90, recovery: 14,
    damage: Math.round(o.damage * d.power), hitstun: 20, blockstun: 12, push: 6,
    box: box(-4, d.width * 0.5 + 24, -22, d.height * 0.45), dive: { vx: o.vx, vy: o.vy },
  };
}

/** A command throw: grabs anyone within reach, blocking or not. Whiffing it leaves you wide open. */
function hug(id: string, name: string, d: Dims, o: { startup: number; damage: number; recovery: number; reach: number }): Move {
  return {
    ...special("special"), id, name, pose: "throw", chip: 0,
    startup: o.startup, active: 2, recovery: o.recovery,
    damage: Math.round(o.damage * d.power), hitstun: 0, blockstun: 0, push: 0, box: null, grab: o.reach,
  };
}

/** The charged version of a special, bought with half the meter: quicker, harder-hitting, and briefly untouchable. */
function charged(mv: Move): Move {
  const shot = mv.shot && { ...mv.shot, at: Math.max(4, mv.shot.at - 3), vx: mv.shot.vx * 1.25, damage: Math.round(mv.shot.damage * 1.3), size: mv.shot.size * 1.2, hits: Math.max(2, mv.shot.hits ?? 1) };
  return {
    ...mv, id: `${mv.id}+`, name: `Charged ${mv.name.toLowerCase()}`, charged: true,
    startup: shot ? shot.at : Math.max(2, mv.startup - 3), damage: Math.round(mv.damage * 1.3),
    invuln: Math.max(mv.invuln ?? 0, 8), shot: shot || undefined, knock: mv.knock ?? (mv.grab === undefined ? { x: 4.5, y: 7.5 } : undefined),
  };
}

/** Plant your feet and hit several times. */
function flurry(id: string, name: string, d: Dims, o: { startup: number; hits: number; gap: number; damage: number; recovery: number }, kind: "special" | "super" = "special", extra: Extra = {}): Move {
  return {
    ...special(kind), id, name, pose: "flurry",
    startup: o.startup, active: o.hits * o.gap, recovery: o.recovery,
    damage: Math.round(o.damage * d.power), hitstun: 16, blockstun: 12, push: 3,
    box: box(d.width * 0.1, d.width * 0.5 + 40 * d.reach, d.height * 0.15, d.height * 0.95),
    hits: o.hits, gap: o.gap, knock: { x: 5.5, y: 7 }, ...extra,
  };
}

/** What each breed can do that the others cannot. The engine implements these; this is the wording. */
const TRAIT: Record<Breed, string> = {
  rooster: "Long hop: a rooster’s jump carries further.",
  hen: "Flutter: hold up in the air to fall slowly.",
  chick: "Scurry: can move while crouched, under high shots.",
};

type Normals = FighterDef["normals"];

const BREED: Record<Breed, { width: number; height: number }> = {
  rooster: { width: 44, height: 108 },
  hen: { width: 52, height: 94 },
  chick: { width: 34, height: 58 },
};

interface Sheet {
  id: string;
  name: string;
  breed: Breed;
  tagline: string;
  hp: number;
  speed: number;
  jump: number;
  power: number;
  reach: number;
  colors: Palette;
  look: Look;
  quotes: string[];
  ending: string;
  ender: string;
  style: string;
  ease: 1 | 2 | 3;
  plan: FighterDef["plan"];
  /** This fighter's own versions of some of the shared pecks and kicks. */
  normals?: (n: Normals) => Partial<Normals>;
  kit: (d: Dims) => { specials: [Move, Move, Move]; super: Move; air: Move };
}

function build(s: Sheet): FighterDef {
  const d: Dims = { ...BREED[s.breed], reach: s.reach, power: s.power };
  const { kit, normals: own, ...rest } = s;
  const shared = buildNormals(d);
  const moves = kit(d);
  return {
    ...rest, width: d.width, height: d.height, trait: TRAIT[s.breed],
    normals: { ...shared, ...own?.(shared) }, ...moves,
    ex: [charged(moves.specials[0]), charged(moves.specials[1]), charged(moves.specials[2])],
  };
}


export const ROSTER: FighterDef[] = [
  build({
    id: "henrietta", name: "Henrietta", breed: "hen", tagline: "Head of the henhouse",
    hp: 1040, speed: 2.8, jump: 12.5, power: 1, reach: 1.02,
    colors: { body: CREAM, belly: CREAM_DEEP, wing: "#f0e2c2", comb: BARN, beak: STRAW, leg: STRAW, tail: CREAM_DEEP, eye: INK },
    look: { comb: 1, wattle: 1, tail: "tuft" },
    quotes: ["I have eggs to sit on. That took a minute longer than it should have.", "Sunny side down."],
    ending: "Henrietta went home, counted her eggs twice, and slept like a hen with nothing left to prove.",
    ender: "duster",
    style: "All-rounder. Lobs eggs from range and slaps up close.",
    ease: 1,
    plan: "allround",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Wing slap", hits: 2, gap: 5, active: 8, damage: Math.round(n.sHeavy.damage * 0.52) } }),
    kit: (d) => ({
      air: dive("swoop", "Swoop", d, { vx: 4.5, vy: 7, damage: 78 }),
      specials: [
        projectile("egg", "Egg toss", { kind: "egg", at: 11, vx: 5.8, vy: 5.2, g: 0.3, damage: 76, y: d.height * 0.8, size: 15, level: "mid" }, 18),
        flurry("duster", "Feather duster", d, { startup: 6, hits: 4, gap: 5, damage: 32, recovery: 12 }),
        pound("nest", "Nest drop", d, { startup: 5, vx: 3.2, vy: 12, damage: 112, recovery: 15 }),
      ],
      super: projectile("brunch", "Sunday brunch", { kind: "egg", at: 10, vx: 6.6, vy: 2.6, g: 0.2, damage: 54, y: d.height * 0.52, size: 16, level: "mid", count: 6, spread: 0.5, every: 4 }, 24, "super", { invuln: 14 }),
    }),
  }),
  build({
    id: "rusty", name: "Rusty", breed: "rooster", tagline: "First up, last down",
    hp: 1040, speed: 3, jump: 12.5, power: 1.07, reach: 1.08,
    colors: { body: "#dd8d50", belly: "#bd6d38", wing: "#c47540", comb: BARN, beak: STRAW, leg: STRAW, tail: LEAF, eye: INK },
    look: { comb: 1.7, wattle: 1.5, tail: "plume" },
    quotes: ["Sun’s up. You’re not.", "I crow at dawn and clock out at knockout."],
    ending: "Rusty crowed the sun up next morning from the very top of the barn. Nobody argued.",
    ender: "spur",
    style: "The classic kit: a shot, a rush, and an answer to jump-ins.",
    ease: 1,
    plan: "allround",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Spur kick", recovery: 19, box: { ...n.sHeavy.box!, x1: n.sHeavy.box!.x1 + 12 } } }),
    kit: (d) => ({
      air: dive("talon", "Talon dive", d, { vx: 5.5, vy: 7.5, damage: 80 }),
      specials: [
        projectile("crow", "Dawn crow", { kind: "crow", at: 14, vx: 6, vy: 0, g: 0, damage: 62, y: d.height * 0.62, size: 20, level: "mid" }, 27),
        dash("spur", "Spur rush", d, { startup: 10, active: 12, recovery: 22, speed: 8.2, damage: 94 }),
        rising("rocket", "Comb rocket", d, { startup: 4, vx: 2.2, vy: 12, damage: 100, recovery: 20 }),
      ],
      super: projectile("doom", "Cock-a-doodle-doom", { kind: "crow", at: 12, vx: 7.5, vy: 0, g: 0, damage: 64, y: d.height * 0.55, size: 44, level: "mid", hits: 5, knock: { x: 6, y: 8 } }, 34, "super", { invuln: 14 }),
    }),
  }),
  build({
    id: "pip", name: "Pip", breed: "chick", tagline: "Small, loud, everywhere",
    hp: 1030, speed: 3.9, jump: 13.4, power: 1.05, reach: 0.98,
    colors: { body: "#f8d976", belly: STRAW, wing: "#ecbd48", comb: "#ecbd48", beak: CARROT, leg: CARROT, tail: STRAW, eye: INK },
    look: { comb: 0, wattle: 0, tail: "none" },
    quotes: ["Cheep shot? I prefer efficient.", "Two days old and already undefeated."],
    ending: "Pip is still the smallest bird in the yard. Everyone now pretends not to notice.",
    ender: "zoom",
    style: "Tiny and quick. Darts in, hits, and darts out again.",
    ease: 2,
    plan: "rush",
    normals: (n) => ({ sLight: { ...n.sLight, name: "Quick peck", startup: 3, recovery: 6 } }),
    kit: (d) => ({
      air: dive("divebomb", "Dive bomb", d, { vx: 6.5, vy: 8, damage: 72 }),
      specials: [
        projectile("cheep", "Cheep shot", { kind: "cheep", at: 9, vx: 7.6, vy: 0, g: 0, damage: 54, y: d.height * 0.6, size: 13, level: "mid", life: 34 }, 15),
        dash("zoom", "Zoomies", d, { startup: 5, active: 10, recovery: 14, speed: 11, damage: 100 }, "special", { knock: { x: 4, y: 6.5 } }),
        rising("popfly", "Pop fly", d, { startup: 3, vx: 1.8, vy: 12.6, damage: 110, recovery: 14 }),
      ],
      super: dash("blitz", "Chick blitz", d, { startup: 5, active: 26, recovery: 20, speed: 5.6, damage: 46 }, "super", { hits: 8, gap: 3, invuln: 12, hitstun: 14, push: 2 }),
    }),
  }),
  build({
    id: "dot", name: "Dot", breed: "hen", tagline: "Speckled and unbothered",
    hp: 1090, speed: 2.75, jump: 12.4, power: 1.07, reach: 1.04,
    colors: { body: "#d6d0c8", belly: "#b9b2a9", wing: "#aaa39a", comb: "#cf5d4f", beak: STRAW, leg: STRAW, tail: "#aaa39a", eye: INK },
    look: { comb: 0.8, wattle: 0.8, tail: "tuft", spots: "#8d867e" },
    quotes: ["You’ve been spotted.", "I didn’t even ruffle."],
    ending: "Dot went back to her dust bath. The ladder, she felt, had been a lot of fuss.",
    ender: "bustle",
    style: "Patient. Her low shots have to be blocked crouching.",
    ease: 2,
    plan: "allround",
    normals: (n) => ({ cLight: { ...n.cLight, name: "Low jab", box: { ...n.cLight.box!, x1: n.cLight.box!.x1 + 10 } }, sHeavy: { ...n.sHeavy, name: "Shove", push: 13 } }),
    kit: (d) => ({
      air: dive("plummet", "Plummet", d, { vx: 3, vy: 8.5, damage: 86 }),
      specials: [
        projectile("grit", "Grit spit", { kind: "grit", at: 15, vx: 5, vy: 0, g: 0, damage: 58, y: 12, size: 13, level: "low" }, 21),
        dash("bustle", "Bustle charge", d, { startup: 9, active: 12, recovery: 20, speed: 7.6, damage: 104 }),
        rising("riser", "Hen riser", d, { startup: 5, vx: 2, vy: 11.6, damage: 112, recovery: 18 }),
      ],
      super: flurry("storm", "Speckled storm", d, { startup: 6, hits: 9, gap: 4, damage: 40, recovery: 22 }, "super", { invuln: 12, dash: 2.4 }),
    }),
  }),
  build({
    id: "shelly", name: "Shelly", breed: "chick", tagline: "Half hatched, fully dangerous",
    hp: 1030, speed: 3.5, jump: 13, power: 1.04, reach: 0.98,
    colors: { body: "#fbe9a6", belly: "#f3d67a", wing: "#efcc6c", comb: "#efcc6c", beak: CARROT, leg: CARROT, tail: "#f3d67a", eye: INK },
    look: { comb: 0, wattle: 0, tail: "none", shell: true },
    quotes: ["Imagine what I’ll do once I’ve finished hatching.", "The shell stays on. You stay down."],
    ending: "Shelly finally hatched the rest of the way out. She kept the shell as a trophy.",
    ender: "eggroll",
    style: "Lays shell mines on the floor, then rolls you into them.",
    ease: 2,
    plan: "rush",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Headbutt", armor: true, startup: 9 } }),
    kit: (d) => ({
      air: dive("meteor", "Meteor egg", d, { vx: 5, vy: 8, damage: 76, pose: "roll" }),
      specials: [
        projectile("shard", "Shell mine", { kind: "shard", at: 10, vx: 4.2, vy: 4, g: 0.3, damage: 82, y: d.height * 0.6, size: 12, level: "low", mine: 280 }, 16),
        dash("eggroll", "Egg roll", d, { startup: 7, active: 18, recovery: 16, speed: 6.8, damage: 46, pose: "roll" }, "special", { hits: 3, gap: 6, hitstun: 15, push: 3 }),
        pound("hatch", "Hatch smash", d, { startup: 5, vx: 3.4, vy: 12, damage: 112, recovery: 14 }),
      ],
      super: dash("scramble", "Scramble", d, { startup: 5, active: 36, recovery: 20, speed: 7.4, damage: 52, pose: "roll" }, "super", { hits: 7, gap: 5, invuln: 14, hitstun: 15, push: 2 }),
    }),
  }),
  build({
    id: "duke", name: "Duke", breed: "rooster", tagline: "Heavyweight of the hayloft",
    hp: 1160, speed: 2.45, jump: 11.8, power: 1.15, reach: 1.14,
    colors: { body: "#4b5670", belly: "#374058", wing: "#3a445e", comb: BARN, beak: STRAW, leg: STRAW_DEEP, tail: STRAW, eye: CREAM },
    look: { comb: 2, wattle: 1.8, tail: "plume" },
    quotes: ["The pecking order has been explained to you.", "Back of the queue."],
    ending: "Duke took his place at the top of the pecking order, which is where he had always been.",
    ender: "flap",
    style: "Slow and heavy. Charges through hits to land his own.",
    ease: 2,
    plan: "heavy",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Boot", armor: true, startup: 11 } }),
    kit: (d) => ({
      air: dive("anvil", "Anvil drop", d, { vx: 2.5, vy: 9, damage: 90 }),
      specials: [
        flurry("flap", "Thunder flap", d, { startup: 8, hits: 3, gap: 7, damage: 44, recovery: 18 }),
        dash("bull", "Bull rush", d, { startup: 11, active: 14, recovery: 22, speed: 7.2, damage: 104 }, "special", { armor: true }),
        pound("buster", "Barn buster", d, { startup: 8, vx: 3.6, vy: 11.6, damage: 100, recovery: 20 }),
      ],
      super: dash("stampede", "Midnight stampede", d, { startup: 8, active: 26, recovery: 24, speed: 8.6, damage: 50 }, "super", { hits: 5, gap: 5, invuln: 18, armor: true, hitstun: 16, push: 2, knock: { x: 7, y: 9 } }),
    }),
  }),
  build({
    id: "goldie", name: "Goldie", breed: "hen", tagline: "Big, buff and unhurried",
    hp: 1290, speed: 2.85, jump: 12.2, power: 1.24, reach: 1.12,
    colors: { body: "#e9b65a", belly: "#cf9840", wing: "#d9a44a", comb: BARN, beak: CARROT, leg: STRAW_DEEP, tail: "#cf9840", eye: INK },
    look: { comb: 1.1, wattle: 1.1, tail: "tuft" },
    quotes: ["All that glitters just sat on you.", "Stay down, sweet pea."],
    ending: "Goldie got first pick of the feed for a year. She shared it, mostly.",
    ender: "goldrush",
    style: "Grappler. Lots of health, and a hug you cannot block.",
    ease: 1,
    plan: "heavy",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Hip check", knock: { x: 1.8, y: 10 } } }),
    kit: (d) => ({
      air: dive("cannonball", "Cannonball", d, { vx: 3.5, vy: 8.5, damage: 86 }),
      specials: [
        hug("bearhug", "Bear hug", d, { startup: 6, damage: 165, recovery: 28, reach: 28 }),
        dash("goldrush", "Gold rush", d, { startup: 8, active: 13, recovery: 19, speed: 8, damage: 108 }),
        pound("sitdown", "Sit-down", d, { startup: 6, vx: 3, vy: 12, damage: 112, recovery: 16 }),
      ],
      super: { ...hug("bigsqueeze", "Big squeeze", d, { startup: 5, damage: 300, recovery: 42, reach: 44 }), kind: "super", chip: 0, invuln: 6 },
    }),
  }),
  build({
    id: "ziggy", name: "Ziggy", breed: "rooster", tagline: "Loud comb, louder mouth",
    hp: 940, speed: 3.2, jump: 13, power: 0.96, reach: 1.04,
    colors: { body: "#f4efe6", belly: "#d9d2c5", wing: "#cfc8ba", comb: LEAF, beak: STRAW, leg: STRAW, tail: BARN, eye: INK },
    look: { comb: 2.6, wattle: 1.2, tail: "plume" },
    quotes: ["Too loud? Too bad.", "That one goes out to the losers’ bracket."],
    ending: "Ziggy played an encore on the coop roof until sunrise. The neighbours have complained.",
    ender: "mosh",
    style: "Fast darts from range. Fragile once you are on him.",
    ease: 3,
    plan: "zoner",
    normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Mohawk lance", recovery: 23, box: { ...n.sHeavy.box!, x1: n.sHeavy.box!.x1 + 10 } }, jLight: { ...n.jLight, name: "Air dart", active: 13 } }),
    kit: (d) => ({
      air: dive("crowdsurf", "Crowd surf", d, { vx: 6, vy: 7, damage: 74 }),
      specials: [
        projectile("quill", "Quill dart", { kind: "quill", at: 12, vx: 7, vy: 0, g: 0, damage: 50, y: d.height * 0.6, size: 14, level: "mid" }, 22),
        flurry("mosh", "Mosh pit", d, { startup: 6, hits: 4, gap: 4, damage: 26, recovery: 15 }),
        rising("stagedive", "Stage dive", d, { startup: 5, vx: 2.6, vy: 12.4, damage: 92, recovery: 20 }),
      ],
      super: projectile("encore", "Encore", { kind: "quill", at: 10, vx: 8, vy: 0.5, g: 0, damage: 50, y: d.height * 0.55, size: 16, level: "mid", count: 6, spread: 0.3, every: 4 }, 26, "super", { invuln: 14 }),
    }),
  }),
];

/** The bonus round target. Not selectable; it only stands there. */
export const SCARECROW: FighterDef = {
  ...build({
    id: "scarecrow", name: "Scarecrow", breed: "rooster", tagline: "", hp: 1500, speed: 0, jump: 0, power: 0, reach: 1,
    colors: { body: "#d8b77a", belly: "#c9a25a", wing: "#8f3a2c", comb: "#3f2316", beak: "#c9a25a", leg: "#5a3421", tail: "#c9a25a", eye: INK },
    look: { comb: 0, wattle: 0, tail: "none" }, quotes: [""], ending: "", ender: "egg", style: "", ease: 1, plan: "allround",
    kit: () => ({ air: ROSTER[0].air, specials: ROSTER[0].specials, super: ROSTER[0].super }),
  }),
  prop: true, width: 44, height: 124,
};

/** The last opponent on the arcade ladder. Not selectable. */
export const BOSS: FighterDef = build({
  id: "oldspur", name: "Old Spur", breed: "rooster", tagline: "Top of the pecking order since before you hatched",
  hp: 1040, speed: 2.85, jump: 12.5, power: 1.01, reach: 1.08,
  colors: { body: "#8c90a0", belly: "#6f7384", wing: "#646878", comb: BARN_DEEP, beak: STRAW, leg: STRAW_DEEP, tail: CREAM, eye: CREAM },
  look: { comb: 2.2, wattle: 2, tail: "plume", crown: true },
  quotes: ["Come back when your comb has grown in.", "I was winning these before your egg was laid."],
  ending: "Old Spur kept his crown. He had rather hoped somebody would take it.", ender: "progress", style: "The old king of the yard. Armoured charges and a crow that carries.", ease: 3, plan: "allround",
  normals: (n) => ({ sHeavy: { ...n.sHeavy, name: "Royal boot", armor: true, startup: 10 } }),
  kit: (d) => ({
    air: dive("verdict", "Verdict", d, { vx: 5, vy: 8, damage: 84 }),
    specials: [
      projectile("decree", "Decree", { kind: "crow", at: 12, vx: 6.6, vy: 0, g: 0, damage: 60, y: d.height * 0.6, size: 24, level: "mid" }, 26),
      dash("progress", "Royal progress", d, { startup: 12, active: 13, recovery: 26, speed: 7.8, damage: 100 }, "special", { armor: true }),
      rising("coronation", "Coronation", d, { startup: 4, vx: 2.4, vy: 12.4, damage: 110, recovery: 19 }),
    ],
    super: dash("lastword", "The last word", d, { startup: 7, active: 28, recovery: 24, speed: 8.4, damage: 50 }, "super", { hits: 6, gap: 5, invuln: 18, armor: true, hitstun: 16, push: 2, knock: { x: 7, y: 9 } }),
  }),
});

export function fighterById(id: string): FighterDef {
  return [...ROSTER, BOSS, SCARECROW].find((f) => f.id === id) ?? ROSTER[0];
}

/** What a special is for, so the CPU and the move list can describe it. */
export function moveRole(m: Move): "shot" | "dash" | "rise" | "pound" | "flurry" | "grab" {
  if (m.grab !== undefined) return "grab";
  if (m.shot) return "shot";
  if (m.leap) return m.leap.fallOnly ? "pound" : "rise";
  if (m.dash && m.pose !== "flurry") return "dash";
  return "flurry";
}

/** 1 to 5 pips for the character select screen. */
export function ratings(d: FighterDef) {
  const pip = (v: number, lo: number, hi: number) => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)));
  return {
    power: pip(d.power, 0.9, 1.25),
    speed: pip(d.speed, 2.3, 3.9),
    health: pip(d.hp, 900, 1150),
    reach: pip(d.reach * BREED[d.breed].width, 30, 54),
  };
}
