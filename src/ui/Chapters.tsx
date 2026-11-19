import { useState } from "react";
import { BOSS, ROSTER, fighterById } from "../game";
import { RIVALS } from "../arcade";
import { STAGES } from "../render/stage";
import { Portrait } from "./Portrait";
import type { Stats } from "./stats";
import { useEscape } from "./useEscape";

/** The arena each chapter is fought in: the same as in a story, by its place on the ladder. */
const FINAL_STAGE = 2;
const stageOf = (rung: number) => (rung === 4 ? FINAL_STAGE : rung % STAGES.length);

/**
 * Chapter select: every story fight won can be played again, scenes and all, without touching
 * the story in progress. First a fighter, then that fighter's five chapters.
 */
export function Chapters({ stats, onPlay, onBack }: { stats: Stats; onPlay: (fighter: string, rung: number, ladder: string[]) => void; onBack: () => void }) {
  const played = [...ROSTER, BOSS].filter((f) => (stats.chapters[f.id]?.length ?? 0) > 0);
  const [who, setWho] = useState<string | null>(played.length === 1 ? played[0].id : null);
  useEscape(who && played.length > 1 ? () => setWho(null) : onBack);

  if (!who) {
    return (
      <main className="screen chapters">
        <header className="bar">
          <button type="button" className="link" onClick={onBack}>Back</button>
          <h1>Chapters</h1>
        </header>
        {played.length === 0 ? (
          <p className="lede">Win a fight in Story mode, and that chapter can be played again from here.</p>
        ) : (
          <ul className="chapter-list">
            {played.map((f) => (
              <li key={f.id}>
                <button type="button" className="ghost chapter" onClick={() => setWho(f.id)}>
                  <Portrait fighter={f} size={44} animate={false} />
                  <span>
                    <b>{f.name}</b>
                    <small>{stats.chapters[f.id].length} of 5 chapters{stats.stories.includes(f.id) ? ", story finished" : ""}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  const fighter = fighterById(who);
  const won = stats.chapters[who] ?? [];
  // The opponents of a story: the three won so far (or not yet met), then the rival and the top of the barn.
  const top = who === BOSS.id ? "duke" : BOSS.id;
  const ladder = [0, 1, 2, 3, 4].map((k) => won[k] ?? (k === 3 && who !== BOSS.id ? RIVALS[who] : k === 4 ? top : ""));
  return (
    <main className="screen chapters">
      <header className="bar">
        <button type="button" className="link" onClick={() => (played.length > 1 ? setWho(null) : onBack())}>Back</button>
        <h1>{fighter.name}’s story</h1>
      </header>
      <ol className="chapter-list">
        {ladder.map((opponent, k) => {
          const open = k < won.length;
          const them = opponent ? fighterById(opponent) : null;
          const title = !open && !them ? "Not reached yet" : k === 3 && who !== BOSS.id ? `${them!.name}, your rival` : k === 4 ? (who === BOSS.id ? "Duke, at the foot of the ladder" : "Old Spur, at the top") : them!.name;
          return (
            <li key={k}>
              <button type="button" className="ghost chapter" disabled={!open} onClick={() => onPlay(who, k, ladder)}>
                <span className="chapter-number">{k + 1}</span>
                <span>
                  <b>{open ? title : `Chapter ${k + 1}`}</b>
                  <small>{open ? STAGES[stageOf(k)].name : "Win it in Story mode to play it again here"}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
