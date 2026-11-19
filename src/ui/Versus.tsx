import { useEffect } from "react";
import type { FighterDef } from "../game";
import { announceIn } from "../announcer";
import { play } from "../sounds";
import { Portrait } from "./Portrait";

interface Props {
  p1: FighterDef;
  p2: FighterDef;
  labels: [string, string];
  /** A line above the pairing, such as "Fight 2 of 5". */
  caption: string;
  /** The score across rematches, once there is one. */
  series?: string;
  place: string;
  /** Shown to people on a keyboard: which keys do what. */
  hint?: string;
  onGo: () => void;
}

/** The pairing card shown for a moment before each fight. Tap to skip. */
export function Versus({ p1, p2, labels, caption, series, place, hint, onGo }: Props) {
  useEffect(() => {
    play("round");
    // The introductions, as the fighters come out.
    announceIn(`${p1.name}, versus ${p2.name}!`, [p1.name, "versus", p2.name]);
    const t = window.setTimeout(onGo, 2400);
    const key = (e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onGo();
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="screen versus" onClick={onGo}>
      <p className="caption">{caption}</p>
      {series && <p className="fine">Series so far: {series}</p>}
      <div className="versus-row">
        <div className="corner from-left">
          <Portrait fighter={p1} size={150} mood="ready" trueScale />
          <h2>{p1.name}</h2>
          <p>{labels[0]}</p>
        </div>
        <div className="vs" aria-label="versus">vs</div>
        <div className="corner from-right">
          <Portrait fighter={p2} size={150} mood="ready" trueScale flip alt={p1.id === p2.id} />
          <h2>{p2.name}</h2>
          <p>{labels[1]}</p>
        </div>
      </div>
      <p className="fine">{place}</p>
      {hint && <p className="fine key-hint">{hint}</p>}
    </main>
  );
}
