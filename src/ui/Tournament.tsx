import { useEffect, useState } from "react";
import { ROSTER, fighterById } from "../game";
import { STAGES } from "../render/stage";
import { play } from "../sounds";
import { Fight } from "./Fight";
import { Portrait } from "./Portrait";
import { Result } from "./Result";

// A knockout tournament for four or eight people sharing one device. Everyone picks a name
// and a fighter, the draw is shuffled, and the device is passed round match by match.

interface Player {
  name: string;
  fighter: string;
}
/** A match between two players, by their place in the list. `winner` is set once it has been played. */
interface Tie {
  a: number;
  b: number;
  winner: number | null;
}

const ROUND_NAMES: Record<number, string> = { 1: "Final", 2: "Semi-finals", 4: "Quarter-finals" };

function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Pairs a list of players off into ties. */
const pair = (ids: number[]): Tie[] => Array.from({ length: ids.length / 2 }, (_, i) => ({ a: ids[i * 2], b: ids[i * 2 + 1], winner: null }));

export function Tournament({ onExit }: { onExit: () => void }) {
  const [players, setPlayers] = useState<Player[]>(() => Array.from({ length: 4 }, (_, i) => ({ name: `Player ${i + 1}`, fighter: ROSTER[i % ROSTER.length].id })));
  // Every round so far; the last one is being played.
  const [rounds, setRounds] = useState<Tie[][]>([]);
  const [playing, setPlaying] = useState<{ tie: number; stage: number; n: number } | null>(null);
  const round = rounds[rounds.length - 1];
  const next = round?.findIndex((t) => t.winner === null) ?? -1;
  const champion = round?.length === 1 && round[0].winner !== null ? players[round[0].winner] : null;

  useEffect(() => {
    if (playing) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [playing, onExit]);

  const resize = (n: number) => setPlayers((ps) => Array.from({ length: n }, (_, i) => ps[i] ?? { name: `Player ${i + 1}`, fighter: ROSTER[i % ROSTER.length].id }));
  const edit = (i: number, patch: Partial<Player>) => setPlayers((ps) => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const cycle = (i: number) => edit(i, { fighter: ROSTER[(ROSTER.findIndex((f) => f.id === players[i].fighter) + 1) % ROSTER.length].id });
  const draw = () => {
    play("pick");
    setRounds([pair(shuffled(players.length))]);
  };
  const settle = (winner: 0 | 1) => {
    if (!playing || !round) return;
    const done = round.map((t, i) => (i === playing.tie ? { ...t, winner: winner === 0 ? t.a : t.b } : t));
    // When a round is complete, its winners are paired off for the next.
    const through = done.every((t) => t.winner !== null) && done.length > 1 ? [pair(done.map((t) => t.winner!))] : [];
    setRounds([...rounds.slice(0, -1), done, ...through]);
    setPlaying(null);
  };

  if (playing && round) {
    const tie = round[playing.tie];
    const [a, b] = [players[tie.a], players[tie.b]];
    return <Fight key={playing.n} p1={fighterById(a.fighter)} p2={fighterById(b.fighter)} cpu={null} stage={playing.stage} labels={[a.name, b.name]} onEnd={(r) => settle(r.winner)} onQuit={() => setPlaying(null)} />;
  }

  if (champion) {
    return (
      <Result onBack={onExit} winner={fighterById(champion.fighter)} headline={`${champion.name} wins the tournament`} cheer>
        <button type="button" onClick={() => setRounds([])}>Play again</button>
      </Result>
    );
  }

  return (
    <main className="screen tournament">
      <header className="bar">
        <button type="button" className="link" onClick={onExit}>Back</button>
        <h1>Tournament</h1>
      </header>

      {!round ? (
        <>
          <div className="row">
            <span>Players</span>
            <div className="chips" role="radiogroup" aria-label="Number of players">
              {[4, 8].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={players.length === n} className={players.length === n ? "chip on" : "chip"} onClick={() => resize(n)}>{n}</button>
              ))}
            </div>
          </div>
          <ul className="entrants">
            {players.map((p, i) => (
              <li key={i}>
                <input aria-label={`Name of player ${i + 1}`} value={p.name} maxLength={14} onChange={(e) => edit(i, { name: e.target.value })} />
                <button type="button" className="ghost" aria-label={`Fighter for ${p.name}: ${fighterById(p.fighter).name}. Press to change.`} onClick={() => cycle(i)}>
                  <Portrait fighter={fighterById(p.fighter)} size={36} animate={false} />
                  {fighterById(p.fighter).name}
                </button>
              </li>
            ))}
          </ul>
          <p className="fine">Press a fighter to change it. Two players share the device for each match: on a keyboard, two gamepads, or the touch controls in each corner.</p>
          <button type="button" onClick={draw}>Make the draw</button>
        </>
      ) : (
        <>
          {rounds.map((ties, r) => (
            <section key={r} className="ties">
              <h2>{ROUND_NAMES[ties.length] ?? `Round ${r + 1}`}</h2>
              <ul>
                {ties.map((t, i) => (
                  <li key={i} className={r === rounds.length - 1 && i === next ? "up" : ""}>
                    <span className={t.winner === t.a ? "won" : t.winner !== null ? "lost" : ""}>{players[t.a].name}</span>
                    <small>against</small>
                    <span className={t.winner === t.b ? "won" : t.winner !== null ? "lost" : ""}>{players[t.b].name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {next >= 0 && (
            <button type="button" onClick={() => setPlaying({ tie: next, stage: Math.floor(Math.random() * STAGES.length), n: Date.now() })}>
              Play: {players[round[next].a].name} against {players[round[next].b].name}
            </button>
          )}
        </>
      )}
    </main>
  );
}
