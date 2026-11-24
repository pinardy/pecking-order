import { useEffect } from "react";
import { ACHIEVEMENTS, type Achievement } from "../achievements";
import { Modal } from "./Modal";
import type { Stats } from "./stats";

/** "2026-11-24" as "24 Nov 2026". */
const dayText = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Everything there is to earn, in order, with what has been earned marked and the rest showing how far along it is. */
export function AchievementsSheet({ earned, stats, onClose }: { earned: Record<string, string>; stats: Stats; onClose: () => void }) {
  const have = ACHIEVEMENTS.filter((a) => a.id in earned).length;
  return (
    <Modal title="Achievements" onClose={onClose}>
      <p className="fine">{have} of {ACHIEVEMENTS.length} earned on this device.</p>
      <ul className="achievements">
        {ACHIEVEMENTS.map((a) => {
          const done = a.id in earned;
          const [at, of] = a.progress?.(stats) ?? [0, 1];
          return (
            <li key={a.id} className={done ? "done" : ""}>
              <span className="mark" aria-hidden="true">{done ? "★" : "☆"}</span>
              <span>
                <b>{a.name}</b>
                <small>{a.how}</small>
              </span>
              <em>{done ? `Earned ${dayText(earned[a.id])}` : of > 1 ? `${at} of ${of}` : "Not yet"}</em>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/** One achievement just earned, shown for a few seconds. `onDone` moves on to the next, if several came at once. */
export function EarnedToast({ achievement, onDone }: { achievement: Achievement; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 5000);
    return () => window.clearTimeout(timer);
    // One timer per achievement shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement.id]);
  return (
    <div className="toast earned" role="status">
      <span className="mark" aria-hidden="true">★</span>
      <span>
        <b>Achievement: {achievement.name}</b>
        <small>{achievement.how}</small>
      </span>
      <button type="button" className="link" onClick={onDone}>OK</button>
    </div>
  );
}
