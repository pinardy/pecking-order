import { Toggle } from "../Toggle";
import { inputFor, type FighterDef, type Trial } from "../../game";
import type { KeyMap } from "../input";
import type { LessonStep } from "../lesson";

/** The current combo trial, with the steps landed so far struck through. */
export function TrialPanel({ fighter, trials, index, at }: { fighter: FighterDef; trials: Trial[]; index: number; at: number }) {
  return (
    <div className="note trial" aria-live="polite">
      <b>Trial {index + 1} of {trials.length}</b>
      <ol>
        {trials[index].steps.map((id, k) => {
          const { input, move } = inputFor(fighter, id);
          return (
            <li key={k} className={k < at ? "done" : ""}>
              {input}
              {id !== "sLight" && id !== "jHeavy" && <small> ({move.name})</small>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The tutorial's current step. `keys` is null on a touch screen, where the wording talks about the stick. */
export function LessonPanel({ steps, at, keys, onFinish }: { steps: LessonStep[]; at: number; keys: KeyMap | null; onFinish: () => void }) {
  const step = steps[at];
  return (
    <div className="note trial lesson" aria-live="polite">
      {step ? (
        <>
          <b>{at + 1} of {steps.length}: {step.title}</b>
          <p>{step.how(keys)}</p>
        </>
      ) : (
        <>
          <b>That is everything</b>
          <p>You know enough to climb the ladder. Your fighter’s full move list is in the pause menu.</p>
          <button type="button" onClick={onFinish}>Finish</button>
        </>
      )}
    </div>
  );
}

export interface MenuItem {
  label: string;
  onClick: () => void;
  /** Present for a setting that is switched on or off: shown as a checkbox, as in Settings. */
  on?: boolean;
}

/** The pause sheet. The first button is the safe way back; the rest are whatever suits this fight. */
/** The pause menu and its sub-menus. A sub-menu has Back at the top left of its title; the top level leads with its main action. */
export function PauseMenu({ title, note, primary, back, items, onClose }: { title: string; note?: string; primary?: MenuItem; back?: () => void; items: MenuItem[]; onClose: () => void }) {
  return (
    <div className="backdrop">
      <div className="sheet pause" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          {back && <button type="button" className="link" autoFocus onClick={back}>Back</button>}
          <h2>{title}</h2>
          <button type="button" className="link" onClick={onClose}>Close</button>
        </div>
        {note && <p className="fine">{note}</p>}
        {primary && <button key={primary.label} type="button" autoFocus onClick={primary.onClick}>{primary.label}</button>}
        {items.map((item) =>
          item.on === undefined ? (
            <button key={item.label} type="button" className="ghost" onClick={item.onClick}>{item.label}</button>
          ) : (
            <Toggle key={item.label} label={item.label} checked={item.on} onChange={item.onClick} />
          ),
        )}
      </div>
    </div>
  );
}

/** A fighter's specials at a glance, for the spare room under the arena when a phone is held upright. */
export function MoveStrip({ fighter }: { fighter: FighterDef }) {
  const rows: [string, string][] = [
    ["Special", fighter.specials[0].name], ["Toward + Special", fighter.specials[1].name], ["Down + Special", fighter.specials[2].name],
    ["Jump, Special", fighter.air.name], ["Crow", fighter.super.name],
  ];
  return (
    <ul className="move-strip" aria-label={`${fighter.name}’s moves`}>
      {rows.map(([how, name]) => (
        <li key={how}>
          <b>{how}</b> {name}
        </li>
      ))}
    </ul>
  );
}
