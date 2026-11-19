// Shared types for the fighting engine. Plain TypeScript: no React, no DOM, no timers.

/** Engine ticks per second. Every duration in the engine is counted in ticks. */
export const TPS = 60;
/** Width of the arena in world units. The renderer shows a window onto it. */
export const STAGE_W = 900;
/** How close a fighter's centre may get to either end of the arena. */
export const WALL = 32;
/** Fighters can never be further apart than this, so both always fit on screen. */
export const MAX_SEP = 400;
export const GRAVITY = 0.62;
export const MAX_METER = 100;
export const ROUND_SECONDS = 99;

/** What a player (or the CPU) is holding this tick. `x` and `y` are stick directions; y = 1 is up. */
export interface Input {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  light: boolean;
  heavy: boolean;
  special: boolean;
  sup: boolean;
  /** A dedicated Block button: guards without having to hold away. */
  block?: boolean;
  /** This guard was raised by the auto-block assist, which never earns a perfect block. */
  auto?: boolean;
}

export const NO_INPUT: Input = Object.freeze({ x: 0, y: 0, light: false, heavy: false, special: false, sup: false });

export type Button = "light" | "heavy" | "special" | "sup";
export const BUTTONS: readonly Button[] = ["sup", "special", "heavy", "light"];

export type Breed = "rooster" | "hen" | "chick";

/** mid: block standing or crouching. low: must crouch-block. high: must stand-block (jump-ins). */
export type Level = "mid" | "low" | "high";

export type PoseKey =
  | "peck"
  | "uppeck"
  | "kick"
  | "lowpeck"
  | "sweep"
  | "airpeck"
  | "airkick"
  | "cast"
  | "dash"
  | "rise"
  | "pound"
  | "flurry"
  | "roll"
  | "throw";

export type ShotKind = "crow" | "egg" | "grit" | "cheep" | "shard" | "quill" | "assist";

/** A box relative to the fighter's feet, with x measured in the direction the fighter faces and y upward. */
export interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface ShotSpec {
  kind: ShotKind;
  /** Tick of the move on which the shot leaves. */
  at: number;
  vx: number;
  vy: number;
  /** Downward pull per tick. 0 flies straight. */
  g: number;
  damage: number;
  /** Launch height above the feet. */
  y: number;
  size: number;
  level: Level;
  /** How many times it can connect before it is spent. */
  hits?: number;
  /** Ticks it lives; short-lived shots fizzle out mid-air. */
  life?: number;
  /** Fire this many, fanned out by `spread` in vy and staggered by `every` ticks. */
  count?: number;
  spread?: number;
  every?: number;
  knock?: { x: number; y: number };
  /** Lands and lies in wait for this many ticks instead of vanishing. */
  mine?: number;
  /** A tag partner charging across: the fighter it is, for drawing. */
  assist?: string;
}

export interface Move {
  id: string;
  name: string;
  kind: "normal" | "special" | "super" | "throw";
  pose: PoseKey;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  /** How far the defender is shoved (initial slide speed). */
  push: number;
  level: Level;
  box: Box | null;
  /** Launches the defender into a knockdown. */
  knock?: { x: number; y: number };
  /** Multi-hit moves connect `hits` times, at most once every `gap` ticks. */
  hits?: number;
  gap?: number;
  /** A normal that can be cancelled into a special once it has touched the opponent. */
  cancel?: boolean;
  /** Only usable in the air; ends on landing. */
  air?: boolean;
  /** Forward speed while the move is active. */
  dash?: number;
  /** Leaves the ground when startup ends. `fallOnly` moves only hit on the way down. */
  leap?: { vx: number; vy: number; fallOnly?: boolean };
  /** Air special: hangs for the startup, then drops at this velocity until it lands. */
  dive?: { vx: number; vy: number };
  shot?: ShotSpec;
  /** Ticks from the start during which the fighter cannot be hit. */
  invuln?: number;
  /** Takes hits without flinching until recovery. */
  armor?: boolean;
  /** Share of damage that gets through a block. */
  chip?: number;
  /** A charged special: costs half the meter. */
  charged?: boolean;
  /** A command throw: grabs anyone standing within this distance beyond touching. Cannot be blocked. */
  grab?: number;
}

export interface Palette {
  body: string;
  belly: string;
  wing: string;
  comb: string;
  beak: string;
  leg: string;
  tail: string;
  eye: string;
}

export interface Look {
  /** Comb height multiplier. 0 draws a tuft of fluff instead. */
  comb: number;
  wattle: number;
  tail: "plume" | "tuft" | "none";
  spots?: string;
  shell?: boolean;
  crown?: boolean;
}

export interface FighterDef {
  id: string;
  name: string;
  breed: Breed;
  tagline: string;
  hp: number;
  /** Walk speed in units per tick. */
  speed: number;
  /** Take-off speed of a jump. */
  jump: number;
  power: number;
  reach: number;
  /** Size of the body box used for pushing and for being hit. */
  width: number;
  height: number;
  colors: Palette;
  look: Look;
  normals: { sLight: Move; sHeavy: Move; cLight: Move; cHeavy: Move; jLight: Move; jHeavy: Move; launch: Move };
  /** Special button alone, with toward, with down. */
  specials: [Move, Move, Move];
  /** The same three, charged: Crow with a direction, for half the meter. */
  ex: [Move, Move, Move];
  /** What this breed can do that the others cannot, in a sentence. */
  trait: string;
  /** How the CPU plays this fighter. */
  plan: "allround" | "zoner" | "rush" | "heavy";
  /** Special pressed in the air. */
  air: Move;
  super: Move;
  /** Said after winning a match. */
  quotes: string[];
  /** Shown after clearing arcade. */
  ending: string;
  /** Id of the special a landed peck cancels into; the combo trials are built around it. */
  ender: string;
  /** One line on how this fighter plays, and how hard they are to pick up (1 easy, 3 hard). */
  style: string;
  ease: 1 | 2 | 3;
  /** A target that stands there and takes it (the bonus round scarecrow). */
  prop?: boolean;
}

export type FighterState =
  | "idle"
  | "walk"
  | "crouch"
  | "prejump"
  | "air"
  | "land"
  | "dash"
  | "attack"
  | "grabbed"
  | "dizzy"
  | "hit"
  | "block"
  | "launched"
  | "down"
  | "getup"
  | "ko"
  | "win"
  | "lose";

export type Phase = "startup" | "active" | "recovery";

export interface Fighter {
  def: FighterDef;
  side: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Shove from being hit or from hitting a cornered opponent; decays every tick. */
  slide: number;
  facing: 1 | -1;
  hp: number;
  /** Trails behind `hp` so the bar can show the chunk just lost. */
  hpGhost: number;
  meter: number;
  state: FighterState;
  stateT: number;
  move: Move | null;
  phase: Phase;
  phaseT: number;
  moveT: number;
  /** Goes up with every move started, so the CPU can react once per move. */
  moveSerial: number;
  /** The current move has touched the opponent (hit or blocked). */
  connected: boolean;
  hitsDone: number;
  lastHitT: number;
  stun: number;
  /** Hits taken in the current combo; drives damage scaling. */
  comboTaken: number;
  /** Hits landed in the current combo and how long the counter stays up. */
  combo: number;
  comboT: number;
  juggle: number;
  invuln: number;
  throwProof: number;
  /** Empties as attacks are blocked; at zero the guard breaks. */
  guard: number;
  guardRest: number;
  /** Holding back with an attack on the way: stands its ground instead of walking off. */
  guarding: boolean;
  /** Builds with damage taken in quick succession; past the limit the fighter is knocked dizzy. */
  daze: number;
  dizzyNext: boolean;
  dashDir: -1 | 1;
  /** Last stick tap, for double-tap dashes. */
  tapDir: -1 | 0 | 1;
  tapT: number;
  lastX: -1 | 0 | 1;
  throwDir: -1 | 1;
  score: number;
  /** Where the score came from, for the breakdown after an arcade fight. */
  points: { hits: number; time: number; perfect: number; bonus: number };
  /** Ticks the guard has been held; a block in its first few ticks is a perfect one. */
  guardHeld: number;
  /** Has burst out of a combo this round. */
  burstUsed: boolean;
  /** A boss in its second phase (see Rules.boss). */
  enraged: boolean;
  /** Tag team, on the bench: health it can still win back by resting. */
  restTo: number;
  /** Getting up: rolling this way, and whether the late rise has been used. */
  rollDir: -1 | 0 | 1;
  lateRise: boolean;
  /** Has already bounced off a wall during this knockdown. */
  bounced: boolean;
  airUsed: boolean;
  jumpDir: -1 | 0 | 1;
  crouchBlock: boolean;
  /** Ticks left of the white hit flash. */
  flash: number;
  /** Ticks since last taking damage; training mode heals after a while. */
  calm: number;
  buf: Record<Button, number>;
  prev: Input;
  inp: Input;
  wins: number;
}

export interface Shot {
  spec: ShotSpec;
  side: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hits: number;
  life: number;
  age: number;
  /** Ticks until it can connect again. */
  cool: number;
  /** Ticks until it leaves the fighter's wing (for staggered barrages). */
  delay: number;
  power: number;
  big: boolean;
  /** Id of the move that fired it. */
  move: string;
  /** A mine that has landed and is lying in wait. */
  planted: boolean;
}

/** Something lying in the arena to be picked up: corn fills the meter, a worm restores health. */
export interface Item {
  kind: "corn" | "worm";
  x: number;
  y: number;
  t: number;
}

export type MatchPhase = "intro" | "fight" | "ko" | "timeup" | "roundEnd" | "matchEnd";

export type GameEvent =
  /** `side` is whoever was hit. */
  | { type: "hit"; power: 0 | 1 | 2; side: 0 | 1; move: string; combo: number; damage: number; counter?: boolean }
  /** A burst out of a combo, a boss getting serious, a tag partner coming in. */
  | { type: "burst"; side: 0 | 1 }
  | { type: "phase"; side: 0 | 1 }
  | { type: "tag"; side: 0 | 1 }
  | { type: "assist"; side: 0 | 1 }
  /** `side` tried to block and it did not work: the attack was low, came from above, or was a throw. */
  | { type: "caught"; side: 0 | 1; why: "low" | "high" | "throw"; x: number; y: number }
  | { type: "guardBreak"; side: 0 | 1 }
  | { type: "dizzy"; side: 0 | 1 }
  | { type: "tech" }
  /** Something to show, not something that happened to the fight: the renderer turns these into particles. */
  | { type: "fx"; kind: "impact" | "feathers" | "dust" | "guard" | "ring" | "splat"; x: number; y: number; n?: number; power?: 0 | 1 | 2; side?: 0 | 1; size?: number; life?: number; spread?: number }
  | { type: "dash" }
  /** A word to float over the action: "Counter!", "Perfect!". */
  | { type: "word"; text: string; x: number; y: number }
  | { type: "pickup"; side: 0 | 1; kind: Item["kind"] }
  | { type: "block"; side: 0 | 1 }
  | { type: "swing"; heavy: boolean }
  | { type: "jump" }
  | { type: "land" }
  | { type: "down" }
  | { type: "shot"; kind: ShotKind }
  | { type: "splat" }
  | { type: "throw"; side: 0 | 1; damage: number; /** A command throw, by its move id (an ordinary throw has none). */ move?: string }
  | { type: "super"; side: 0 | 1 }
  | { type: "round"; n: number }
  | { type: "fight" }
  | { type: "ko"; side: 0 | 1 }
  | { type: "timeup" }
  | { type: "roundWon"; side: 0 | 1 | null; perfect: boolean }
  | { type: "matchWon"; side: 0 | 1 };

/** How a match is run. The engine has no modes of its own: an arcade fight, training and the bonus round differ only in these. */
export interface Rules {
  /** Rounds needed to win the match. */
  rounds: number;
  /** Seconds on the round clock, or null for no clock. */
  seconds: number | null;
  /** Whether health can reach zero. */
  knockouts: boolean;
  /** Health and the crow meter refill when left alone. */
  refill: boolean;
  /** Player 2 is a target to smash for points rather than an opponent. */
  target: boolean;
  /** Corn and worms drop into the arena now and then. */
  pickups?: boolean;
  /** A fighter knocked into a wall bounces off it. */
  bounce?: boolean;
  /** This side is a boss: at half health, once a round, it gets serious (faster, harder-hitting, a full meter). */
  boss?: 0 | 1;
  /** Both crow meters start at this much in the first round. */
  startMeter?: number;
  /** Each side's crow meter in the first round, where they differ (overrides startMeter). */
  meters?: [number, number];
  /** Throws are not allowed. */
  noThrows?: boolean;
  /** Tag team: each side has a partner on the bench, swapped in with Peck and Kick together. */
  tag?: boolean;
  /** Called out at the start in place of "Round 1". */
  opening?: string;
  openingSub?: string;
}

export interface MatchOptions {
  rules: Rules;
  /** Furthest apart the fighters may get; narrower screens use a smaller value. */
  maxSep?: number;
  /** Tag team: each side's partner. */
  partners?: [FighterDef, FighterDef];
}

export interface Banner {
  text: string;
  sub?: string;
  t: number;
  life: number;
}

export interface Match {
  f: [Fighter, Fighter];
  shots: Shot[];
  items: Item[];
  /** Tag team: each side's pair (the lead first), whoever is on the bench, and when each side may next tag. */
  team?: [[Fighter, Fighter], [Fighter, Fighter]];
  bench?: [Fighter, Fighter];
  tagReady?: [number, number];
  /** Tag team: when each side may next call its partner in for an assist. */
  assistReady?: [number, number];
  /** A knocked-out bird being replaced by its partner: which side, and how long until they come in. */
  tagIn?: { side: 0 | 1; t: number } | null;
  phase: MatchPhase;
  phaseT: number;
  round: number;
  /** Ticks left on the round clock. */
  timer: number;
  hitstop: number;
  /** The freeze-frame when a super starts. */
  superFlash: { t: number; side: 0 | 1; name: string } | null;
  shake: number;
  banner: Banner | null;
  roundWinner: 0 | 1 | null;
  winner: 0 | 1 | null;
  /** What happened this tick, for sound and vibration. Replaced on every step. */
  events: GameEvent[];
  tick: number;
  rules: Rules;
  /** Furthest apart the fighters may get. */
  maxSep: number;
}
