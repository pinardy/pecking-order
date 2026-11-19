import { useEffect, useState } from "react";
import { fighterById } from "../game";
import type { Choice, Mood, Scene } from "../story";
import { readInput } from "./input";
import { Portrait, type Mood as Face } from "./Portrait";
import { TitleScene } from "./TitleScene";

/** The talking head's face for each mood in the script. */
const FACE: Record<Mood, Face> = { angry: "ready", hurt: "lose", happy: "win" };

/**
 * A story scene: the arena of the coming fight, the two birds in it, and the dialogue a line at
 * a time underneath. A tap, Enter, Space or an attack button moves it on; Skip ends it at once.
 */
export function Cutscene({ scene, onDone, last = "Fight" }: { scene: Scene; onDone: (choice?: Choice) => void; /** What the final line leads to. */ last?: string }) {
  const [at, setAt] = useState(0);
  const line = scene.lines[at];
  // The player's answer, where a line is a choice. Until it is made, the scene waits.
  const [chosen, setChosen] = useState<Choice | undefined>(undefined);
  const waiting = !!scene.lines[at]?.choice && !chosen;
  const finish = (c = chosen) => onDone(c);
  const next = (c = chosen) => {
    if (scene.lines[at]?.choice && !c) return;
    if (at + 1 >= scene.lines.length) finish(c);
    else setAt(at + 1);
  };
  const choose = (c: Choice) => {
    setChosen(c);
    next(c);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if ((e.key === "Enter" || e.key === " ") && !waiting) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", key);
    // Gamepads: a fresh press of any attack button moves on.
    let held = true;
    const timer = window.setInterval(() => {
      const i = readInput(0, true);
      const down = i.light || i.heavy || i.special || i.sup;
      if (down && !held && !waiting) next();
      held = down;
    }, 50);
    return () => {
      window.removeEventListener("keydown", key);
      window.clearInterval(timer);
    };
  });

  if (!line) return null;
  const right = fighterById(line.with ?? scene.right);
  const speaker = line.who ? fighterById(line.who) : null;
  const side = !line.who ? null : line.who === scene.left ? 0 : 1;
  // A speaker's mood is their own. While the narrator closes the story, the winner is pleased and the other is not.
  const moods: [Mood | null, Mood | null] = side === null ? (line.mood === "happy" ? ["happy", "hurt"] : [null, null]) : side === 0 ? [line.mood ?? null, null] : [null, line.mood ?? null];
  return (
    <main className="screen cutscene" onClick={() => next()}>
      <header className="bar">
        <span className="cutscene-count" aria-hidden="true">
          {at + 1} / {scene.lines.length}
        </span>
        <button
          type="button"
          className="link"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
        >
          Skip
        </button>
      </header>
      <TitleScene className="cutscene-stage" stage={scene.stage} left={fighterById(scene.left)} right={right} taunt={false} talking={side} moods={moods} />
      <div className={`dialogue${side === null ? " narrator" : side === 0 ? " from-left" : " from-right"}`} aria-live="polite">
        {/* A talking head of whoever is speaking, on their side of the box, facing into it. */}
        {speaker && (
          <div className="talking-head" aria-hidden="true">
            <Portrait key={speaker.id} fighter={speaker} size={84} head talking mood={FACE[line.mood ?? "angry"]} flip={side === 1} />
          </div>
        )}
        <div className="said">
          {speaker && <b>{speaker.name}</b>}
          {line.choice ? (
            // The player picks how to answer: each way changes the fight that follows.
            <div className="choices" role="group" aria-label="How do you answer?">
              <button type="button" onClick={(e) => (e.stopPropagation(), choose("fired"))}>
                “{line.choice.fired}”
                <small>Fired up: start with a full crow meter</small>
              </button>
              <button type="button" className="ghost" onClick={(e) => (e.stopPropagation(), choose("calm"))}>
                “{line.choice.calm}”
                <small>Keep it civil: a fair fight, no twist</small>
              </button>
            </div>
          ) : (
            <p>{line.text}</p>
          )}
        </div>
        {!waiting && <small>{at + 1 < scene.lines.length ? "Next" : last}</small>}
      </div>
    </main>
  );
}
