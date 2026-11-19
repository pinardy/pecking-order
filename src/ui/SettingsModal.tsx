import { useEffect, useState, type ReactNode } from "react";
import { play, unlockAudio } from "../sounds";
import { ACTIONS, DEFAULT_KEYS, keyLabel, type Action, type KeyMap } from "./input";
import { Modal } from "./Modal";
import { Toggle } from "./Toggle";
import { canFullscreen, toggleFullscreen, useFullscreen } from "./screen";
import { LEVEL_NAMES, useSettings, type Settings, type TouchPref } from "./settings";
import { clearAll } from "./store";
import { hasClips } from "../announcer";


function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="row">
      <span>{label}</span>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "chip on" : "chip"} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Two columns of keys. Tap one, then press the key it should become. */
function KeyEditor({ keys, onChange }: { keys: [KeyMap, KeyMap]; onChange: (k: [KeyMap, KeyMap]) => void }) {
  const [waiting, setWaiting] = useState<{ player: 0 | 1; action: Action } | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const key = (e: KeyboardEvent) => {
      if (e.code === "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      const next: [KeyMap, KeyMap] = [{ ...keys[0] }, { ...keys[1] }];
      // A key can only do one thing: whoever had it before swaps with the old key.
      const old = next[waiting.player][waiting.action];
      for (const map of next) for (const a of ACTIONS) if (map[a.action] === e.code) map[a.action] = old;
      next[waiting.player][waiting.action] = e.code;
      onChange(next);
      setWaiting(null);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [waiting, keys, onChange]);

  return (
    <div className="key-editor">
      <span />
      <b>Player 1</b>
      <b>Player 2</b>
      {ACTIONS.map(({ action, label }) => (
        <div className="key-row" key={action}>
          <span>{label}</span>
          {([0, 1] as const).map((player) => {
            const on = waiting?.player === player && waiting.action === action;
            return (
              <button key={player} type="button" className={on ? "chip on" : "chip"} aria-label={`${label}, player ${player + 1}`} onClick={() => setWaiting(on ? null : { player, action })}>
                {on ? "Press a key" : keyLabel(keys[player][action])}
              </button>
            );
          })}
        </div>
      ))}
      <button type="button" className="link" onClick={() => onChange(DEFAULT_KEYS)}>Reset keys</button>
    </div>
  );
}

type Tab = "Game" | "Sound" | "Display" | "Controls" | "Advanced";
const TABS: Tab[] = ["Game", "Sound", "Display", "Controls", "Advanced"];

interface Props {
  onClose: () => void;
  onArrange: () => void;
  /** Present when the browser has offered to install the app. */
  onInstall?: () => void;
  /** On an iPhone or iPad outside the installed app, where installing is done by hand. */
  iosHint: boolean;
}

export function SettingsModal({ onClose, onArrange, onInstall, iosHint }: Props) {
  const [s, update] = useSettings();
  const [tab, setTab] = useState<Tab>("Game");
  const [sure, setSure] = useState(false);
  const fullscreen = useFullscreen();

  const pages: Record<Tab, ReactNode> = {
    Game: (
      <>
        <Choice<Settings["level"]> label="CPU level" value={s.level} options={LEVEL_NAMES.map((label, i) => ({ value: i as Settings["level"], label }))} onChange={(level) => update({ level })} />
        <Choice<Settings["rounds"]> label="Rounds to win" value={s.rounds} options={[1, 2, 3].map((n) => ({ value: n as Settings["rounds"], label: String(n) }))} onChange={(rounds) => update({ rounds })} />
        <Toggle label="Arena effects" hint="Pickups outdoors, bouncing walls indoors" checked={s.arenaEffects} onChange={(arenaEffects) => update({ arenaEffects })} />
        <Toggle label="Auto-block" hint="Against the CPU: guards whenever you are not attacking" checked={s.assistBlock} onChange={(assistBlock) => update({ assistBlock })} />
        <Toggle label="Easy combos" hint="Against the CPU: Peck again after a peck lands finishes with a special" checked={s.assistCombo} onChange={(assistCombo) => update({ assistCombo })} />
      </>
    ),
    Sound: (
      <>
        <Toggle
          label="Sound effects"
          checked={s.sound}
          onChange={(sound) => {
            update({ sound });
            unlockAudio();
            if (sound) setTimeout(() => play("pick"), 30);
          }}
        />
        {s.sound && <Slider label="Effects volume" value={s.sfxVolume} min={0.1} max={1} onChange={(sfxVolume) => update({ sfxVolume })} />}
        <Toggle label="Music" checked={s.music} onChange={(music) => update({ music })} />
        {s.music && <Slider label="Music volume" value={s.musicVolume} min={0.1} max={1} onChange={(musicVolume) => update({ musicVolume })} />}
        {hasClips() && <Toggle label="Ring announcer" hint="Calls the rounds and the winner, from the recorded clips" checked={s.announcer} onChange={(announcer) => update({ announcer })} />}
      </>
    ),
    Display: (
      <>
        <Choice<Settings["hudSize"]> label="Names and counters" value={s.hudSize} options={[{ value: "auto", label: "Auto" }, { value: "large", label: "Large" }]} onChange={(hudSize) => update({ hudSize })} />
        <Toggle label="Less flashing" hint="No white flash on hits or knockouts, and nothing blinks" checked={s.calm} onChange={(calm) => update({ calm })} />
        <Toggle label="Reduced motion" hint="No screen shake, zooming text or screen transitions" checked={s.reducedMotion} onChange={(reducedMotion) => update({ reducedMotion })} />
        {canFullscreen() && (
          <div className="row">
            <span>Fullscreen</span>
            <button type="button" className="chip" onClick={() => void toggleFullscreen()}>{fullscreen ? "Leave fullscreen" : "Go fullscreen"}</button>
          </div>
        )}
      </>
    ),
    Controls: (
      <>
        <Choice<TouchPref> label="On-screen controls" value={s.touch} options={[{ value: "auto", label: "Auto" }, { value: "on", label: "Always" }, { value: "off", label: "Never" }]} onChange={(touch) => update({ touch })} />
        <Choice<Settings["stick"]> label="Stick" value={s.stick} options={[{ value: "fixed", label: "Fixed" }, { value: "floating", label: "Floating" }]} onChange={(stick) => update({ stick })} />
        <p className="fine">A floating stick appears wherever your thumb lands on its side of the screen.</p>
        <Toggle label="Block button" hint="Guards without holding away from your opponent" checked={s.blockButton} onChange={(blockButton) => update({ blockButton })} />
        <Toggle label="Vibration" hint="A tick on each button press, a thump when you are hit" checked={s.haptics} onChange={(haptics) => update({ haptics })} />
        <Toggle label="Left-handed layout" hint="Buttons on the left, stick on the right" checked={s.leftHanded} onChange={(leftHanded) => update({ leftHanded })} />
        <div className="row">
          <span>
            Positions
            <small>Drag the stick and each button where you like</small>
          </span>
          <button type="button" className="chip" onClick={onArrange}>Arrange controls</button>
        </div>
      </>
    ),
    // The things most people never need to touch.
    Advanced: (
      <>
        {onInstall && (
          <div className="row">
            <span>
              Install
              <small>Adds the game to your home screen and lets it run offline</small>
            </span>
            <button type="button" className="chip" onClick={onInstall}>Install app</button>
          </div>
        )}
        {iosHint && <p className="fine">To install on this device: tap Share, then Add to Home Screen.</p>}
        <Slider label="Control size" value={s.padScale} min={0.75} max={1.35} onChange={(padScale) => update({ padScale })} />
        <Slider label="Control opacity" value={s.padAlpha} min={0.35} max={1} onChange={(padAlpha) => update({ padAlpha })} />
        <Slider label="Stick sensitivity" value={0.45 - s.stickDead} min={0.1} max={0.35} onChange={(v) => update({ stickDead: Math.round((0.45 - v) * 100) / 100 })} />
        <Choice<Settings["resolution"]> label="Sharpness" value={s.resolution} options={[{ value: "auto", label: "Auto" }, { value: "high", label: "Full" }, { value: "low", label: "Low" }]} onChange={(resolution) => update({ resolution })} />
        <p className="fine">Auto starts sharp and eases off if the fight stops running smoothly.</p>
        <Toggle label="Show frame time" hint="Frames per second and work per frame, in a corner of the fight" checked={s.showPerf} onChange={(showPerf) => update({ showPerf })} />
        <Toggle label="Hold landscape during fights" hint="Works in fullscreen or in the installed app" checked={s.lockLandscape} onChange={(lockLandscape) => update({ lockLandscape })} />
        <h3>Keyboard</h3>
        <KeyEditor keys={s.keys} onChange={(keys) => update({ keys })} />
        <h3>Saved data</h3>
        <div className="row">
          <span>
            Start over
            <small>Forgets settings, records, unlocks and any arcade run on this device</small>
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => {
              if (!sure) return setSure(true);
              clearAll();
              location.reload();
            }}
          >
            {sure ? "Yes, erase everything" : "Erase saved data"}
          </button>
        </div>
      </>
    ),
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      {/* A tab bar across the top on a phone; a list down the side where there is room for one. */}
      <div className="settings">
        <div
          className="tabs"
          role="tablist"
          aria-label="Settings sections"
          onKeyDown={(e) => {
            // Arrow keys move along the tabs, as they do in any tab bar.
            const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!move) return;
            e.preventDefault();
            const next = TABS[(TABS.indexOf(tab) + move + TABS.length) % TABS.length];
            setTab(next);
            e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
          }}
        >
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" data-tab={t} aria-selected={t === tab} tabIndex={t === tab ? 0 : -1} className="tab" onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {/* Keyed by tab, so each one opens scrolled to its top. */}
        <div key={tab} className="tab-page" role="tabpanel" aria-label={tab} tabIndex={0}>{pages[tab]}</div>
      </div>
    </Modal>
  );
}
