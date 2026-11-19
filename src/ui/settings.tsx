import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CpuLevel } from "../game";
import { setAnnouncer } from "../announcer";
import { setMusicOn, setMusicVolume } from "../music";
import { setMuted, setSfxVolume } from "../sounds";
import { DEFAULT_KEYS, setKeys, type KeyMap } from "./input";
import { read, write } from "./store";

export type TouchPref = "auto" | "on" | "off";
/** The things on screen that can be dragged somewhere else. */
export const PARTS = ["stick", "light", "heavy", "special", "sup", "block"] as const;
export type Part = (typeof PARTS)[number];
/** How far each part has been dragged from its usual place, in pixels. */
export type Offsets = Partial<Record<Part, [number, number]>>;

export interface Settings {
  sound: boolean;
  sfxVolume: number;
  music: boolean;
  musicVolume: number;
  announcer: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  /** Less flashing: no white hit flash or knockout flash, and nothing blinks. */
  calm: boolean;
  /** Names and counters in the fight: sized automatically, or larger still. */
  hudSize: "auto" | "large";
  /** CPU level for arcade and quick fights: 0 Chick, 1 Hen, 2 Rooster. */
  level: CpuLevel;
  /** Rounds needed to win a match. */
  rounds: 1 | 2 | 3;
  /** Assists for an easier way in: guard automatically, and finish a landed peck with the right special. */
  assistBlock: boolean;
  assistCombo: boolean;
  /** Arenas change the fight: pickups outdoors, walls that bounce indoors and on the roof. */
  arenaEffects: boolean;
  /** On-screen buttons: shown on touch screens by default. */
  touch: TouchPref;
  /** Swaps the stick and the buttons. */
  leftHanded: boolean;
  /** Size and opacity of the on-screen controls. */
  padScale: number;
  padAlpha: number;
  /** A floating stick appears wherever the thumb lands. */
  stick: "fixed" | "floating";
  /** How far the thumb must move before the stick registers (a fraction of its radius). */
  stickDead: number;
  /** Adds a Block button, for those who would rather not hold away. */
  blockButton: boolean;
  /** Dragged positions, kept separately for each way of holding the phone. */
  layout: { portrait: Offsets; landscape: Offsets };
  keys: [KeyMap, KeyMap];
  /** Canvas sharpness: auto lowers it if frames run long. */
  resolution: "auto" | "high" | "low";
  showPerf: boolean;
  lockLandscape: boolean;
  tutorialDone: boolean;
}

const DEFAULTS: Settings = {
  sound: true, sfxVolume: 1, music: true, musicVolume: 1, announcer: true, haptics: true, reducedMotion: false, calm: false, hudSize: "auto", level: 1, rounds: 2, arenaEffects: true, assistBlock: false, assistCombo: false,
  touch: "auto", leftHanded: false, padScale: 1, padAlpha: 0.84, stick: "fixed", stickDead: 0.22, blockButton: false, layout: { portrait: {}, landscape: {} },
  keys: DEFAULT_KEYS, resolution: "auto", showPerf: false, lockLandscape: false, tutorialDone: false,
};
const VERSION = 2;

function load(): Settings {
  let fresh = false;
  try {
    fresh = !localStorage.getItem("po-settings");
  } catch {
    /* no storage: defaults */
  }
  const saved = read("settings", VERSION, DEFAULTS);
  if (!Array.isArray(saved.keys) || saved.keys.length !== 2) saved.keys = DEFAULT_KEYS;
  if (!saved.layout?.portrait || !saved.layout.landscape) saved.layout = DEFAULTS.layout;
  // First visit: follow the device's own reduced-motion setting.
  return fresh && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? { ...saved, reducedMotion: true } : saved;
}

/** Dragged positions as CSS variables, for whatever element the controls sit under. */
export function offsetVars(o: Offsets): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const part of PARTS) {
    vars[`--${part}-x`] = `${o[part]?.[0] ?? 0}px`;
    vars[`--${part}-y`] = `${o[part]?.[1] ?? 0}px`;
  }
  return vars;
}

const SettingsContext = createContext<[Settings, (patch: Partial<Settings>) => void]>([DEFAULTS, () => {}]);

/** Holds the player's preferences, persists them, and passes them on to sound, input and CSS. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  useEffect(() => {
    write("settings", VERSION, settings);
    setMuted(!settings.sound);
    setSfxVolume(settings.sfxVolume);
    setMusicOn(settings.music);
    setMusicVolume(settings.musicVolume);
    setAnnouncer(settings.announcer);
    setKeys(settings.keys);
    const root = document.documentElement;
    root.dataset.motion = settings.reducedMotion ? "reduced" : "full";
    root.dataset.hand = settings.leftHanded ? "left" : "right";
    root.style.setProperty("--pad-scale", String(settings.padScale));
    root.style.setProperty("--pad-alpha", String(settings.padAlpha));
    // The dragged layout follows the way the phone is being held.
    const mq = window.matchMedia?.("(orientation: portrait)");
    const apply = () => {
      const vars = offsetVars(settings.layout[mq?.matches ? "portrait" : "landscape"]);
      for (const name in vars) root.style.setProperty(name, vars[name]);
    };
    apply();
    mq?.addEventListener("change", apply);
    return () => mq?.removeEventListener("change", apply);
  }, [settings]);

  return <SettingsContext.Provider value={[settings, update]}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** Short vibration for the moments that deserve one. No-op where unsupported or turned off. */
export function vibrate(pattern: number | number[], settings: Settings) {
  if (!settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export const LEVEL_NAMES = ["Chick", "Hen", "Rooster", "Champion"] as const;
