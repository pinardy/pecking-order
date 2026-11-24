import type { Run } from "../arcade";
import { ROSTER, fighterById } from "../game";
import type { Stats } from "./stats";
import { useEscape } from "./useEscape";

/** One ending for each fighter on the roster, and one for Old Spur. */
const TOTAL_ENDINGS = ROSTER.length + 1;

interface Props {
  stats: Stats;
  /** A story left part-way through. */
  story: Run | null;
  onContinue: () => void;
  onNew: () => void;
  onChapters: () => void;
  onBossRush: () => void;
  onEnding: (fighter: string) => void;
  onBack: () => void;
}

/** Everything to do with the story: carrying on, starting again, chapters, the boss rush, and the endings earned. */
export function StoryHub({ stats, story, onContinue, onNew, onChapters, onBossRush, onEnding, onBack }: Props) {
  const finished = stats.stories.length > 0;
  useEscape(onBack);
  return (
    <main className="screen story-hub">
      <header className="bar">
        <button type="button" className="link" onClick={onBack}>Back</button>
        <h1>Story</h1>
      </header>
      <div className="hub">
        {story && (
          <button type="button" className="big" onClick={onContinue}>
            Continue story
            <small>
              {fighterById(story.p1).name}, {story.bonus ? "bonus round next" : `fight ${story.rung + 1} of ${story.ladder.length}`}
            </small>
          </button>
        )}
        <button type="button" className={story ? "ghost" : "big"} onClick={onNew}>
          New story
          <small>{story ? "Starts over; the story in progress is lost" : "Choose a bird and climb to the top of the barn"}</small>
        </button>
        <button type="button" className="ghost" onClick={onChapters}>
          Chapters
          <small>Play again any story fight you have won</small>
        </button>
        <button type="button" className="ghost" disabled={!finished} onClick={onBossRush}>
          Boss rush
          <small>
            {!finished ? "Finish a story to unlock it" : stats.bossRush.cleared ? "Cleared. Everyone in a row, then the top" : `Everyone in a row, then the top at Champion level${stats.bossRush.best ? `. Best: ${stats.bossRush.best} beaten` : ""}`}
          </small>
        </button>
        <h2>Endings: {stats.stories.length} of {TOTAL_ENDINGS}</h2>
        {stats.stories.length === 0 ? (
          <p className="fine">Finish a fighter’s story to keep their ending here.</p>
        ) : (
          <div className="chips">
            {stats.stories.map((id) => (
              <button key={id} type="button" className="chip" onClick={() => onEnding(id)}>
                {fighterById(id).name}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
