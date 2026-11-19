// Tiny synthesized sound effects. Everything is generated with the Web Audio API,
// so the game stays self-contained with nothing to download.

export type SfxName =
  | "peck" | "thump" | "wallop" | "guard" | "swing" | "swingHeavy" | "jump" | "land" | "down" | "throw"
  | "crow" | "egg" | "splat" | "super" | "round" | "fight" | "ko" | "timeup" | "win" | "lose" | "tap" | "pick" | "dizzy" | "crack" | "bell" | "bell3" | "crowd" | "gasp";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

/** The shared audio context, once a tap has unlocked it. */
export function audio(): AudioContext | null {
  return ctx && ctx.state === "running" ? ctx : null;
}

/** Call from a user gesture (a tap or key press) so the browser lets audio start. */
export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

let out: GainNode | null = null;
let volume = 1;

/** Every effect plays through one gain node, so there is a single volume to turn. */
function sfxOut(c: AudioContext): AudioNode {
  if (!out || out.context !== c) {
    out = c.createGain();
    out.connect(c.destination);
  }
  out.gain.value = volume;
  return out;
}

export function setSfxVolume(v: number) {
  volume = v;
  if (out) out.gain.value = v;
}

interface Tone { wave?: OscillatorType; from: number; to?: number; at?: number; dur?: number; gain?: number }

function tone(c: AudioContext, { wave = "sine", from, to = from, at = 0, dur = 0.1, gain = 0.2 }: Tone) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(sfxOut(c));
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

/** One second of white noise, built once; each effect plays a random slice of it. */
function sharedNoise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return (noiseBuffer = buf);
}

interface Noise { at?: number; dur?: number; gain?: number; filter?: number; type?: BiquadFilterType; sweepTo?: number }

function noise(c: AudioContext, { at = 0, dur = 0.2, gain = 0.25, filter = 1200, type = "lowpass", sweepTo }: Noise) {
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = sharedNoise(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(sfxOut(c));
  src.start(t0, Math.random() * (1 - dur), dur);
}

/** A chicken-ish "bok": a square blip that bends down fast. */
function bok(c: AudioContext, at: number, pitch: number, gain = 0.1) {
  tone(c, { wave: "square", from: pitch, to: pitch * 0.55, at, dur: 0.07, gain });
  tone(c, { from: pitch * 0.5, to: pitch * 0.3, at, dur: 0.09, gain: gain * 0.8 });
}

/** Cock-a-doodle-doo, more or less: five rising and falling saw notes. */
function crow(c: AudioContext, at: number, base: number, gain: number) {
  const notes: [number, number, number][] = [[1, 0, 0.1], [1.5, 0.11, 0.1], [1.33, 0.22, 0.09], [1.5, 0.32, 0.09], [2, 0.42, 0.34]];
  for (const [mult, t, dur] of notes) tone(c, { wave: "sawtooth", from: base * mult, to: base * mult * (dur > 0.2 ? 0.7 : 1.04), at: at + t, dur, gain });
}

const SFX: Record<SfxName, (c: AudioContext) => void> = {
  bell: (c) => bell(c, 0),
  bell3: (c) => [0, 0.22, 0.44].forEach((at) => bell(c, at, 0.17)),
  crowd: (c) => crowd(c, true),
  gasp: (c) => crowd(c, false),
  peck: (c) => {
    noise(c, { dur: 0.06, gain: 0.3, filter: 2600, type: "bandpass" });
    tone(c, { from: 240, to: 120, dur: 0.07, gain: 0.25 });
  },
  thump: (c) => {
    noise(c, { dur: 0.12, gain: 0.4, filter: 1400, sweepTo: 300 });
    tone(c, { from: 170, to: 60, dur: 0.14, gain: 0.4 });
  },
  wallop: (c) => {
    noise(c, { dur: 0.22, gain: 0.5, filter: 2000, sweepTo: 200 });
    tone(c, { from: 150, to: 40, dur: 0.26, gain: 0.5 });
    bok(c, 0.03, 700, 0.07);
  },
  guard: (c) => {
    noise(c, { dur: 0.05, gain: 0.2, filter: 3500, type: "highpass" });
    tone(c, { wave: "triangle", from: 520, to: 420, dur: 0.06, gain: 0.12 });
  },
  swing: (c) => noise(c, { dur: 0.08, gain: 0.07, filter: 900, sweepTo: 2600, type: "bandpass" }),
  swingHeavy: (c) => noise(c, { dur: 0.14, gain: 0.11, filter: 500, sweepTo: 2000, type: "bandpass" }),
  jump: (c) => {
    tone(c, { wave: "triangle", from: 300, to: 560, dur: 0.1, gain: 0.07 });
    noise(c, { dur: 0.09, gain: 0.05, filter: 1500, type: "bandpass" });
  },
  land: (c) => noise(c, { dur: 0.07, gain: 0.12, filter: 500 }),
  down: (c) => {
    noise(c, { dur: 0.16, gain: 0.3, filter: 700, sweepTo: 150 });
    tone(c, { from: 110, to: 50, dur: 0.16, gain: 0.3 });
  },
  throw: (c) => {
    noise(c, { dur: 0.2, gain: 0.12, filter: 400, sweepTo: 2400, type: "bandpass" });
    bok(c, 0.02, 900);
  },
  crow: (c) => crow(c, 0, 520, 0.05),
  egg: (c) => {
    tone(c, { wave: "triangle", from: 700, to: 380, dur: 0.1, gain: 0.1 });
    noise(c, { dur: 0.06, gain: 0.06, filter: 2000, type: "bandpass" });
  },
  splat: (c) => {
    noise(c, { dur: 0.12, gain: 0.2, filter: 1800, sweepTo: 400 });
    tone(c, { from: 260, to: 90, dur: 0.1, gain: 0.12 });
  },
  super: (c) => {
    crow(c, 0, 392, 0.09);
    noise(c, { dur: 0.6, gain: 0.1, filter: 300, sweepTo: 5000, type: "bandpass" });
  },
  round: (c) => {
    tone(c, { wave: "square", from: 392, dur: 0.12, gain: 0.06 });
    tone(c, { wave: "square", from: 523, at: 0.13, dur: 0.2, gain: 0.06 });
  },
  fight: (c) => {
    bok(c, 0, 900, 0.14);
    bok(c, 0.09, 1200, 0.14);
    tone(c, { wave: "square", from: 784, at: 0.02, dur: 0.22, gain: 0.06 });
  },
  ko: (c) => {
    noise(c, { dur: 0.5, gain: 0.45, filter: 2200, sweepTo: 90 });
    tone(c, { from: 180, to: 36, dur: 0.5, gain: 0.5 });
    tone(c, { wave: "sawtooth", from: 880, to: 240, at: 0.06, dur: 0.4, gain: 0.07 });
  },
  timeup: (c) => {
    for (let i = 0; i < 3; i++) tone(c, { wave: "square", from: 660, at: i * 0.16, dur: 0.1, gain: 0.07 });
  },
  win: (c) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, { wave: "square", from: f, at: i * 0.12, dur: 0.16, gain: 0.07 }));
    crow(c, 0.5, 587, 0.06);
  },
  lose: (c) => {
    [392, 349, 311, 262].forEach((f, i) => tone(c, { wave: "triangle", from: f, at: i * 0.16, dur: 0.2, gain: 0.1 }));
    bok(c, 0.7, 420);
  },
  dizzy: (c) => {
    for (let i = 0; i < 4; i++) tone(c, { wave: "triangle", from: 900 - i * 90, to: 700 - i * 90, at: i * 0.09, dur: 0.09, gain: 0.08 });
  },
  crack: (c) => {
    noise(c, { dur: 0.18, gain: 0.4, filter: 3000, type: "highpass" });
    tone(c, { wave: "square", from: 300, to: 80, dur: 0.2, gain: 0.2 });
  },
  tap: (c) => tone(c, { from: 520, to: 300, dur: 0.07, gain: 0.14 }),
  pick: (c) => {
    bok(c, 0, 820);
    bok(c, 0.1, 1040);
  },
};

/** A ring bell: a struck, slightly sour set of partials that rings on. */
function bell(c: AudioContext, at: number, gain = 0.2) {
  const partials: [number, number, number][] = [[1, 1, 1.3], [2.76, 0.45, 0.9], [5.4, 0.25, 0.5], [8.93, 0.12, 0.3]];
  for (const [ratio, level, dur] of partials) tone(c, { from: 830 * ratio, at, dur, gain: gain * level });
  noise(c, { at, dur: 0.03, gain: gain * 0.6, filter: 4000, type: "highpass" });
}

/** A crowd, from layers of filtered noise that overlap and die away. `long` is a roar; otherwise a gasp. */
function crowd(c: AudioContext, long: boolean) {
  const layers = long ? [[0, 0.16, 900], [0.25, 0.14, 1400], [0.6, 0.12, 700], [1.0, 0.09, 1100], [1.4, 0.06, 900]] : [[0, 0.1, 1000], [0.12, 0.07, 1500]];
  for (const [at, gain, filter] of layers) noise(c, { at, dur: 0.9, gain, filter, type: "bandpass", sweepTo: filter * 1.25 });
}

export function play(name: SfxName) {
  if (muted || !ctx || ctx.state !== "running") return;
  try {
    SFX[name](ctx);
  } catch {
    /* an audio hiccup must never interrupt the fight */
  }
}
