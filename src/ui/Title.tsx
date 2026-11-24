import { useState } from "react";
import type { Run } from "../arcade";
import type { Daily } from "../daily";
import { fighterById } from "../game";
import { Modal } from "./Modal";
import { TitleScene } from "./TitleScene";
import type { Stats } from "./stats";

export type Mode = "story" | "arcade" | "versus" | "training" | "survival" | "timeattack" | "tag" | "bossrush";

interface Props {
  stats: Stats;
  /** An arcade run, and a story, that were left unfinished. */
  run: Run | null;
  story: Run | null;
  onContinueStory: () => void;
  /** Nobody has fought on this device yet: put the tutorial up front. */
  nudge: boolean;
  /** Today's challenge, and whether it has been won yet. */
  daily: Daily;
  dailyDone: boolean;
  /** The basics are done: offer the second lesson. */
  advanced: boolean;
  onMode: (mode: Mode) => void;
  onDaily: () => void;
  onAdvanced: () => void;
  onReplays: () => void;
  onContinue: () => void;
  onTutorial: () => void;
  onOnline: () => void;
  onTournament: () => void;
  onHowTo: () => void;
  onSettings: () => void;
  /** How many achievements are held, as "7 of 29". */
  achievements: string;
  onAchievements: () => void;
}

/** The record on this device: the headline figure for the title screen, and the rest for the More sheet. */
function tally(s: Stats): { headline: string; rest: string[] } {
  if (s.fights === 0) return { headline: "No fights yet on this device.", rest: [] };
  const clears = s.clears[0] + s.clears[1] + s.clears[2];
  const rest: string[] = [];
  if (s.bestStreak > 1) rest.push(`Best winning streak: ${s.bestStreak}.`);
  if (clears > 0) rest.push(`Arcade cleared ${clears === 1 ? "once" : `${clears} times`}.`);
  if (s.best > 0) rest.push(`Best arcade score: ${s.best.toLocaleString("en")}.`);
  if (s.survival > 0) rest.push(`Survival best: ${s.survival} ${s.survival === 1 ? "fight" : "fights"}.`);
  if (s.daily.streak > 1) rest.push(`Daily challenges won in a row: ${s.daily.streak}.`);
  return { headline: `${s.wins} of ${s.fights} fights won against the CPU.`, rest };
}

/**
 * The title screen keeps to the things most visits start with: arcade, the three everyday
 * modes and today's challenge. Everything else is one tap away under More.
 */
export function Title({ stats, run, story, onContinueStory, nudge, daily, dailyDone, advanced, onMode, onDaily, onAdvanced, onReplays, onContinue, onTutorial, onOnline, onTournament, onHowTo, onSettings, achievements, onAchievements }: Props) {
  const [more, setMore] = useState(false);
  const record = tally(stats);
  /** Closes the More sheet, then goes wherever was chosen. */
  const go = (to: () => void) => () => {
    setMore(false);
    to();
  };
  return (
    <main className="screen title">
      {/* Today's arena, with the sign hung over its lower edge. */}
      <div className="title-head">
        <TitleScene stage={daily.stage} left={fighterById("henrietta")} right={fighterById("duke")} />
        <div className="sign">
          <h1>Pecking Order</h1>
        </div>
      </div>
      <div className="title-menu">
        {nudge && (
          <button type="button" className="big" onClick={onTutorial}>
            Learn to fight
            <small>A two-minute lesson</small>
          </button>
        )}
        {/* The two ways up the barn, side by side: the story, and the arcade ladder for points. */}
        <div className="big-row">
          <button type="button" className={nudge ? "big ghost" : "big"} onClick={onContinueStory}>
            Story
            <small>{story ? `Continue: ${fighterById(story.p1).name}, fight ${story.rung + 1}` : "Climb to the top of the barn"}</small>
          </button>
          {run ? (
            <button type="button" className={nudge ? "big ghost" : "big"} onClick={onContinue}>
              Continue arcade
              <small>
                {fighterById(run.p1).name}, {run.bonus ? "bonus next" : `fight ${run.rung + 1} of ${run.ladder.length}`}
              </small>
            </button>
          ) : (
            <button type="button" className={nudge ? "big ghost" : "big"} onClick={() => onMode("arcade")}>
              Arcade
              <small>Five fights for points</small>
            </button>
          )}
        </div>
        <div className="mode-row">
          <button type="button" className="ghost" onClick={() => onMode("versus")}>
            Versus
            <small>Two players or CPU</small>
          </button>
          <button type="button" className="ghost" onClick={onOnline}>
            Online
            <small>Invite a friend</small>
          </button>
          <button type="button" className="ghost" onClick={() => onMode("training")}>
            Training
            <small>Practise freely</small>
          </button>
        </div>
        <button type="button" className="daily" onClick={onDaily}>
          <b>Daily challenge</b>
          <small>
            {daily.you.name} against {daily.them.name}
            {dailyDone ? ", won" : ""}
          </small>
        </button>
        <div className="title-links">
          {run && <button type="button" className="link" onClick={() => onMode("arcade")}>New arcade run</button>}
          <button type="button" className="link" onClick={() => setMore(true)}>More</button>
          <button type="button" className="link" onClick={onSettings}>Settings</button>
        </div>
        <p className="fine">{record.headline}</p>
      </div>

      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <h3>More ways to play</h3>
          <div className="mode-row">
            <button type="button" className="ghost" onClick={go(() => onMode("survival"))}>
              Survival
              <small>One health bar</small>
            </button>
            <button type="button" className="ghost" onClick={go(() => onMode("timeattack"))}>
              Time attack
              <small>Five, fast</small>
            </button>
            <button type="button" className="ghost" onClick={go(onTournament)}>
              Tournament
              <small>4 or 8 players</small>
            </button>
            <button type="button" className="ghost" onClick={go(() => onMode("tag"))}>
              Tag team
              <small>Two birds a side</small>
            </button>
          </div>
          <h3>Learn</h3>
          <div className="more-list">
            <button type="button" className="ghost" onClick={go(onTutorial)}>Tutorial</button>
            {advanced && <button type="button" className="ghost" onClick={go(onAdvanced)}>Advanced lesson</button>}
            <button type="button" className="ghost" onClick={go(onHowTo)}>How to play</button>
          </div>
          <h3>Replays</h3>
          <div className="more-list">
            <button type="button" className="ghost" onClick={go(onReplays)}>Watch a replay from a code</button>
          </div>
          <h3>Records</h3>
          <div className="more-list">
            <button type="button" className="ghost" onClick={go(onAchievements)}>Achievements: {achievements} earned</button>
          </div>
          {record.rest.length > 0 && (
            <>
              <h3>On this device</h3>
              <p className="fine">{[record.headline, ...record.rest].join(" ")}</p>
            </>
          )}
        </Modal>
      )}
    </main>
  );
}
