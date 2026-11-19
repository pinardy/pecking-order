// Background music: a short loop per arena and one for the menus, played live with oscillators.
// Each arena has its own band (instrument, bass, drums and swing), so they sound like different places.

import { audio } from "./sounds";

/** How the melody is played. */
type Lead = "fiddle" | "flute" | "musicbox" | "chip";
/** How the bass line moves. */
type Bass = "boomchick" | "walk" | "pizzicato" | "drive";
/** What the drums do. */
type Drums = "country" | "shaker" | "heartbeat" | "four" | "brush";

interface Tune {
  /** Frequency of the key note. */
  root: number;
  bpm: number;
  minor: boolean;
  /** One chord root per bar, in semitones above the key note. */
  chords: [number, number, number, number];
  /** Melody: one row per bar, eight steps each, as degrees of the pentatonic scale (-1 rests). */
  lead: number[][];
  /** Each arena has its own band: the instrument on the tune, the bass, the drums, and how much the rhythm swings. */
  voice: Lead;
  bass: Bass;
  drums: Drums;
  /** 0 is straight eighths; 0.3 is a lazy shuffle. */
  swing: number;
}

const R = -1;
const TUNES: Record<string, Tune> = {
  // A barn dance: fiddle, boom-chick bass, a snare on the backbeat.
  barnyard: { root: 196, bpm: 132, minor: false, chords: [0, 0, 5, 7], voice: "fiddle", bass: "boomchick", drums: "country", swing: 0, lead: [[3, R, 4, 5, 4, R, 3, R], [5, R, 6, 5, 4, R, 3, R], [3, R, 4, 5, 6, R, 5, R], [5, 4, 5, 6, 5, R, R, R]] },
  // Evening in the corn: a breathy flute over a walking bass, a shaker, and a lazy swing.
  cornfield: { root: 174.6, bpm: 104, minor: false, chords: [0, 7, 5, 0], voice: "flute", bass: "walk", drums: "shaker", swing: 0.28, lead: [[5, R, R, 4, 3, R, 4, R], [4, R, R, 3, 4, R, 5, R], [3, R, 4, R, 5, R, 6, R], [5, R, 4, R, 3, R, R, R]] },
  // The henhouse at night: a music box in a minor key, plucked bass, and a heartbeat for drums.
  henhouse: { root: 164.8, bpm: 96, minor: true, chords: [0, 0, 5, 7], voice: "musicbox", bass: "pizzicato", drums: "heartbeat", swing: 0, lead: [[3, R, 5, R, 4, R, 3, R], [6, R, 5, R, 4, R, R, R], [3, 4, 5, R, 4, R, 3, R], [4, R, 5, R, 6, R, R, R]] },
  // On the roof at dawn: chiptune lead, a driving bass, four on the floor.
  rooftop: { root: 220, bpm: 128, minor: false, chords: [0, 5, 7, 5], voice: "chip", bass: "drive", drums: "four", swing: 0, lead: [[3, 4, 5, R, 6, R, 5, R], [5, R, 4, R, 3, R, 4, R], [6, R, 5, 4, 5, R, 6, R], [5, R, 4, R, 3, R, R, R]] },
  // The menus: unhurried, a music box over a walking bass and brushes, out of the way of the buttons.
  menu: { root: 196, bpm: 92, minor: false, chords: [0, 5, 7, 0], voice: "musicbox", bass: "walk", drums: "brush", swing: 0.2, lead: [[5, R, R, R, 4, R, 3, R], [4, R, R, R, 5, R, R, R], [6, R, 5, R, 4, R, 5, R], [3, R, R, R, R, R, R, R]] },
};
const MAJOR = [0, 2, 4, 7, 9, 12, 14, 16];
const MINOR = [0, 3, 5, 7, 10, 12, 15, 17];
const VOLUME = 0.15;

let tune: Tune | null = null;
let gain: GainNode | null = null;
let timer = 0;
let stepAt = 0;
let nextTime = 0;
let on = true;
let held = false;
let level = 1;
const loudness = () => (on ? VOLUME * level : 0);

function note(c: AudioContext, out: GainNode, freq: number, t: number, dur: number, wave: OscillatorType, vol: number, bendTo?: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (bendTo) osc.frequency.exponentialRampToValueAtTime(bendTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;
/** A burst of filtered noise: shakers, brushes, hats and snares. */
function hiss(c: AudioContext, out: GainNode, t: number, dur: number, vol: number, filter: number, type: BiquadFilterType = "highpass") {
  if (!noiseBuffer || noiseBuffer.sampleRate !== c.sampleRate) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = filter;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.8, dur + 0.02);
}

/** One note of the melody, in the arena's own instrument. */
function lead(c: AudioContext, out: GainNode, kind: Lead, f: number, t: number, len: number, vol: number) {
  switch (kind) {
    case "fiddle": {
      // A bowed saw, softened, with a little slide up into the note.
      note(c, out, f * 0.985, t, len * 0.95, "sawtooth", vol * 0.45, f);
      note(c, out, f * 2, t, len * 0.5, "triangle", vol * 0.15);
      break;
    }
    case "flute": {
      // A sine with a slow vibrato and a puff of breath at the start.
      const osc = c.createOscillator();
      const lfo = c.createOscillator();
      const depth = c.createGain();
      const g = c.createGain();
      osc.frequency.value = f;
      lfo.frequency.value = 5.2;
      depth.gain.value = f * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.06);
      g.gain.setValueAtTime(vol * 0.9, t + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len * 1.4);
      osc.connect(g).connect(out);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + len * 1.5);
      lfo.stop(t + len * 1.5);
      hiss(c, out, t, 0.05, vol * 0.08, 3000, "bandpass");
      break;
    }
    case "musicbox":
      // A struck tine: the note and a bright, quickly fading overtone, ringing past its step.
      note(c, out, f * 2, t, len * 2.6, "sine", vol * 0.7);
      note(c, out, f * 2 * 4.2, t, len * 0.5, "sine", vol * 0.12);
      break;
    case "chip":
      note(c, out, f, t, len * 0.8, "square", vol * 0.6);
      break;
  }
}

function schedule(c: AudioContext, out: GainNode, tn: Tune, i: number, t: number, step: number) {
  // Sixteen bars: the tune once through plainly, then again with its phrases shuffled and a harmony on top.
  const second = i >= 32;
  const bar = (i >> 3) & 3;
  const s = i & 7;
  const chord = tn.chords[bar];
  const scale = tn.minor ? MINOR : MAJOR;
  const semi = (n: number) => Math.pow(2, n / 12);
  // Swing: every off-beat eighth arrives a little late.
  if (s % 2 === 1) t += tn.swing * step;
  const low = (tn.root / 2) * semi(chord);
  const third = tn.minor ? 3 : 4;

  switch (tn.bass) {
    case "boomchick":
      // Root on the beat, the fifth on the off, and a strummed chord stab ("chick") between.
      if (s % 2 === 0) note(c, out, s % 4 === 0 ? low : low * semi(7), t, step * 0.7, "triangle", 0.5);
      else note(c, out, low * 2 * semi(third), t, step * 0.3, "square", 0.05);
      break;
    case "walk":
      if (s % 2 === 0) note(c, out, low * semi([0, third, 7, 9][s / 2]), t, step * 1.6, "triangle", 0.42);
      break;
    case "pizzicato":
      if (s === 0 || s === 3 || s === 6) note(c, out, low * (s === 3 ? semi(7) : 1), t, step * 0.5, "triangle", 0.5);
      break;
    case "drive":
      note(c, out, low, t, step * 0.6, "sawtooth", 0.13);
      break;
  }

  switch (tn.drums) {
    case "country":
      if (s % 4 === 0) note(c, out, 120, t, 0.1, "sine", 0.55, 45);
      if (s % 4 === 2) hiss(c, out, t, 0.09, 0.16, 1800, "bandpass");
      hiss(c, out, t, 0.025, 0.035, 7000);
      break;
    case "shaker":
      if (s === 0) note(c, out, 110, t, 0.12, "sine", 0.4, 45);
      hiss(c, out, t, 0.05, s % 2 ? 0.07 : 0.035, 6000);
      break;
    case "heartbeat":
      if (s === 0 || s === 1) note(c, out, 70, t, 0.14, "sine", s === 0 ? 0.5 : 0.32, 40);
      if (s === 5) hiss(c, out, t, 0.02, 0.03, 8000);
      break;
    case "four":
      if (s % 2 === 0) note(c, out, 130, t, 0.1, "sine", 0.55, 45);
      if (s % 2 === 1) hiss(c, out, t, 0.03, 0.06, 8000);
      if (s === 4) hiss(c, out, t, 0.12, 0.14, 1500, "bandpass");
      break;
    case "brush":
      if (s === 0) note(c, out, 100, t, 0.1, "sine", 0.25, 45);
      if (s % 4 === 2) hiss(c, out, t, 0.18, 0.05, 2500, "bandpass");
      break;
  }

  // A quiet arpeggio fills in the chord, except in the henhouse, which keeps it sparse.
  if (tn.drums !== "heartbeat") note(c, out, tn.root * semi(chord + [0, 7, 12, 7][s % 4]), t, step * 0.45, "triangle", 0.05);

  const degree = tn.lead[second ? (bar + 1) % 4 : bar][s];
  if (degree >= 0) {
    lead(c, out, tn.voice, tn.root * 2 * semi(scale[degree]), t, step * 0.9, 0.22);
    if (second) note(c, out, tn.root * 2 * semi(scale[Math.min(scale.length - 1, degree + 2)]), t, step * 0.8, "triangle", 0.08);
  }
}

function pump() {
  const c = audio();
  if (!c || !tune || held) return;
  if (!gain || gain.context !== c) {
    gain = c.createGain();
    gain.connect(c.destination);
    nextTime = 0;
  }
  gain.gain.value = loudness();
  if (!on) return;
  const step = 60 / tune.bpm / 2;
  if (nextTime < c.currentTime) nextTime = c.currentTime + 0.08;
  while (nextTime < c.currentTime + 0.3) {
    schedule(c, gain, tune, stepAt, nextTime, step);
    nextTime += step;
    stepAt = (stepAt + 1) % 64;
  }
}

/** Starts the loop for an arena, or "menu" for the menus. Safe to call before audio is unlocked; it begins once it can. */
export function startMusic(stageId: string) {
  const next = TUNES[stageId] ?? TUNES.barnyard;
  // Already playing: carry on rather than start again from the top.
  if (tune === next && !held) return;
  stopMusic();
  tune = next;
  stepAt = 0;
  nextTime = 0;
  held = false;
  timer = window.setInterval(pump, 60);
}

export function stopMusic() {
  window.clearInterval(timer);
  tune = null;
}

/** Silences the loop while the game is paused. */
export function holdMusic(hold: boolean) {
  held = hold;
}

export function setMusicOn(value: boolean) {
  on = value;
  if (gain) gain.gain.value = loudness();
}

export function setMusicVolume(value: number) {
  level = value;
  if (gain) gain.gain.value = loudness();
}
