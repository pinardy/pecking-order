import { useEffect, type ReactNode } from "react";
import type { FighterDef } from "../game";
import { play } from "../sounds";
import type { MatchStats } from "./fight/stats";
import { Portrait } from "./Portrait";

interface Props {
  winner: FighterDef;
  headline: string;
  /** A line under the quote, such as ladder progress or the score. */
  note?: string;
  /** Replaces the quote: the fighter's ending, after clearing arcade. */
  ending?: string;
  /** Whether the person at the device won (decides the jingle). */
  cheer: boolean;
  /** Draw the winner in second-player feathers (they won a mirror match as player 2). */
  alt?: boolean;
  /** What each side did, with a heading for each column. */
  stats?: MatchStats | null;
  sides?: [string, string];
  /** Advice for whoever lost. */
  tip?: string;
  /** Leaves for the menu. Shown as Back at the top left, where every screen has it. */
  onBack: () => void;
  children: ReactNode;
}

const num = (n: number) => n.toLocaleString("en");

/** After a match: the winner, something smug from them, the numbers, and where to go next. */
export function Result({ winner, headline, note, ending, cheer, alt, stats, sides, tip, onBack, children }: Props) {
  useEffect(() => {
    play(cheer ? "win" : "lose");
  }, [cheer]);
  // The same fighter always says the same thing after the same headline, so a rematch can vary it.
  const quote = winner.quotes[headline.length % winner.quotes.length];
  const [a, b] = stats?.sides ?? [];
  return (
    <main className="screen result">
      <header className="bar">
        <button type="button" className="link" onClick={onBack}>Back</button>
      </header>
      <div className="result-body">
      <Portrait fighter={winner} size={132} mood="win" trueScale alt={alt} />
      <h1>{headline}</h1>
      {ending ? <p className="ending">{ending}</p> : <blockquote>“{quote}”</blockquote>}
      {note && <p className="fine">{note}</p>}
      {a && b && sides && (
        <table className="stats">
          <thead>
            <tr><th></th><th>{sides[0]}</th><th>{sides[1]}</th></tr>
          </thead>
          <tbody>
            <tr><th>Damage dealt</th><td>{num(a.damage)}</td><td>{num(b.damage)}</td></tr>
            <tr><th>Longest combo</th><td>{a.bestCombo}</td><td>{b.bestCombo}</td></tr>
            <tr><th>Attacks blocked</th><td>{a.blocks}</td><td>{b.blocks}</td></tr>
            <tr><th>Throws</th><td>{a.throws}</td><td>{b.throws}</td></tr>
          </tbody>
        </table>
      )}
      {tip && (
        <p className="tip">
          <b>For next time.</b> {tip}
        </p>
      )}
      <div className="result-actions">{children}</div>
      </div>
    </main>
  );
}
