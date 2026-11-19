import { useEffect, useRef, useState } from "react";
import { BOSS, ROSTER, inputFor, ratings, type FighterDef } from "../game";
import { STAGES, VIEW_H, buildStage, drawStage } from "../render/stage";
import { play } from "../sounds";
import { MovePreview } from "./MovePreview";
import { loadPicks, savePicks } from "./picks";
import { Portrait } from "./Portrait";
import { Toggle } from "./Toggle";
import { LEVEL_NAMES, useSettings } from "./settings";
import type { Stats } from "./stats";
import type { Mode } from "./Title";

interface Props {
  mode: Mode;
  onBack: () => void;
  /**
   * `p2` is null in arcade, where the ladder decides. `vsCpu` only matters in versus.
   * `stage` is the chosen arena, or null to leave it to chance.
   */
  onStart: (p1: FighterDef, p2: FighterDef | null, vsCpu: boolean, stage: number | null, alts: [boolean, boolean], partners?: [FighterDef, FighterDef]) => void;
  /** Records on this device: who has been played, and what has been unlocked. */
  stats: Stats;
}

const EASE = ["", "Easy to pick up", "Takes some practice", "For experienced players"];
/** What each arena does to a fight, when arena effects are on. */
const ARENA_NOTE = ["corn and worms drop in", "corn and worms drop in", "the walls bounce", "the railings bounce"];

function Pips({ label, n }: { label: string; n: number }) {
  return (
    <div className="pips" aria-label={`${label}: ${n} out of 5`}>
      <span>{label}</span>
      <span className="pip-row" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <i key={i} className={i <= n ? "on" : ""} />
        ))}
      </span>
    </div>
  );
}

/** A small picture of an arena, drawn from the same layers the fight uses. */
function ArenaThumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 72 * dpr;
    canvas.height = 54 * dpr;
    const scale = canvas.height / VIEW_H;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawStage(ctx, buildStage(index, scale), 150, 480, 0, 0);
  }, [index]);
  return <canvas ref={ref} aria-hidden="true" />;
}

/** Pick a fighter; in versus and training, then pick who they face, and where. */
export function Select({ mode, onBack, onStart, stats }: Props) {
  const [settings, update] = useSettings();
  // Start where the player left off last time.
  const [picks] = useState(loadPicks);
  // Clearing arcade with anyone lets Old Spur be picked.
  const list = stats.cleared.length ? [...ROSTER, BOSS] : ROSTER;
  const indexOf = (id: string) => Math.max(0, list.findIndex((f) => f.id === id));
  const [alts, setAlts] = useState<[boolean, boolean]>([false, false]);
  // On a phone the details are folded away until asked for, so that the whole screen fits.
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState<FighterDef | null>(null);
  // Tag team: four picks, in order: your lead, your partner, their lead, their partner.
  const [team, setTeam] = useState<FighterDef[]>([]);
  const tag = mode === "tag";
  const [cursor, setCursor] = useState(() => indexOf(picks.fighter));
  const [vsCpu, setVsCpu] = useState(() => picks.vsCpu ?? window.matchMedia?.("(pointer: coarse)").matches ?? false);
  const [arena, setArena] = useState(picks.arena);
  const [preview, setPreview] = useState<string | null>(null);
  const fighter = list[cursor];
  const second = tag ? team.length >= 2 : first !== null;
  const which = second ? 1 : 0;
  // Alternate feathers are earned by clearing arcade with that fighter.
  const earned = stats.cleared.includes(fighter.id);
  const record = stats.fighters[fighter.id];
  // Arcade, survival and time attack choose your opponents for you.
  const solo = mode === "arcade" || mode === "story" || mode === "survival" || mode === "timeattack" || mode === "bossrush";

  const TAG_HEADINGS = vsCpu ? ["Choose your lead", "Choose your partner", "Choose their lead", "Choose their partner"] : ["Player 1, choose your lead", "Player 1, choose your partner", "Player 2, choose your lead", "Player 2, choose your partner"];
  const heading = tag ? TAG_HEADINGS[team.length]
    : !second ? (mode === "versus" && !vsCpu ? "Player 1, choose your fighter" : "Choose your fighter")
    : mode === "training" ? "Choose a sparring partner"
    : vsCpu ? "Choose your opponent" : "Player 2, choose your fighter";

  const look = (i: number) => {
    setCursor(i);
    setPreview(null);
    setAlts((a) => (which === 0 ? [false, a[1]] : [a[0], false]));
  };
  const confirm = () => {
    play("pick");
    if (tag) {
      const picked = [...team, fighter];
      if (picked.length < 4) return setTeam(picked);
      setTeam([]);
      return onStart(picked[0], picked[2], vsCpu, arena < 0 ? null : arena, alts, [picked[1], picked[3]]);
    }
    if (solo) {
      savePicks({ fighter: fighter.id });
      onStart(fighter, null, true, null, alts);
    } else if (!first) {
      setFirst(fighter);
      look(indexOf(picks.opponent));
    } else {
      savePicks({ fighter: first.id, opponent: fighter.id, arena, vsCpu });
      onStart(first, fighter, mode === "training" || vsCpu, arena < 0 ? null : arena, alts);
    }
  };
  const back = () => (tag ? (team.length ? setTeam(team.slice(0, -1)) : onBack()) : second ? setFirst(null) : onBack());

  useEffect(() => {
    const cols = 4;
    const key = (e: KeyboardEvent) => {
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (move !== undefined) {
        e.preventDefault();
        look((cursor + move + list.length) % list.length);
      } else if (e.key === "Escape") back();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  const r = ratings(fighter);
  const levels = (
    <div className="chips" role="radiogroup" aria-label="CPU level">
      <span className="chips-label">CPU level</span>
      {LEVEL_NAMES.map((name, i) => (
        <button key={name} type="button" role="radio" aria-checked={settings.level === i} className={settings.level === i ? "chip on" : "chip"} onClick={() => update({ level: i as 0 | 1 | 2 })}>
          {name}
        </button>
      ))}
    </div>
  );
  return (
    <main className="screen select">
      <header className="bar">
        <button type="button" className="link" onClick={back}>Back</button>
        <h1>{heading}</h1>
        <button type="button" className="link" onClick={() => look(Math.floor(Math.random() * list.length))}>Random</button>
      </header>
      <div className="select-body">
        <div className="roster" role="listbox" aria-label="Fighters">
          {list.map((f, i) => (
            <button key={f.id} type="button" role="option" aria-selected={i === cursor} className={i === cursor ? "fighter-card on" : "fighter-card"} onClick={() => look(i)} onDoubleClick={confirm}>
              <Portrait fighter={f} size={56} animate={false} />
              <span>{f.name}</span>
              {tag ? team.map((t, k) => t.id === f.id && <em key={k}>{k < 2 ? (vsCpu ? "You" : "P1") : vsCpu ? "CPU" : "P2"}</em>) : first?.id === f.id && <em>{mode === "versus" && !vsCpu ? "P1" : "You"}</em>}
            </button>
          ))}
        </div>
        <section className={open ? "detail open" : "detail"}>
          {preview ? <MovePreview fighter={fighter} move={preview} height={124} /> : <Portrait fighter={fighter} size={124} mood="ready" trueScale flip={second} alt={alts[which]} />}
          <div className="detail-text">
            <h2>{fighter.name}</h2>
            <p className="tagline">{fighter.tagline}</p>
            <button type="button" className="link detail-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? "Hide details" : "Moves and details"}
            </button>
            <p className="style detail-more">
              {fighter.style} <b>{EASE[fighter.ease]}.</b> {fighter.trait}
            </p>
            {/* The preview is wider than the portrait, so the ratings step aside while a move is showing. */}
            {!preview && (
              <div className="pip-grid detail-more">
                <Pips label="Power" n={r.power} />
                <Pips label="Speed" n={r.speed} />
                <Pips label="Health" n={r.health} />
                <Pips label="Reach" n={r.reach} />
              </div>
            )}
          </div>
          {earned && (
            <div className="detail-more feathers">
              <Toggle label="Alternate feathers" checked={alts[which]} onChange={(on) => setAlts((a) => (which === 0 ? [on, a[1]] : [a[0], on]))} />
            </div>
          )}
          <p className="record detail-more">
            {record ? `Your record: ${record.wins} ${record.wins === 1 ? "win" : "wins"} from ${record.fights} ${record.fights === 1 ? "fight" : "fights"}. ` : ""}
            {!earned && fighter.id !== BOSS.id && `Clear arcade with ${fighter.name} to earn alternate feathers.`}
          </p>
          <div className="kit detail-more" role="group" aria-label={`${fighter.name}’s moves. Choose one to see it.`}>
            {[...fighter.specials, fighter.air, fighter.super].map((m) => (
              <button key={m.id} type="button" className={preview === m.id ? "chip on" : "chip"} aria-pressed={preview === m.id} title={inputFor(fighter, m.id).input} onClick={() => setPreview(preview === m.id ? null : m.id)}>
                {m.name}
              </button>
            ))}
            <small aria-live="polite">{preview ? `${inputFor(fighter, preview).input}.` : "Choose a move to see it."}</small>
          </div>
        </section>
      </div>
      <footer className="select-foot">
        {(mode === "arcade" || mode === "story") && levels}
        {(mode === "versus" || mode === "tag") && (
          <div className="chips" role="radiogroup" aria-label="Opponent">
            <button type="button" role="radio" aria-checked={!vsCpu} className={!vsCpu ? "chip on" : "chip"} onClick={() => setVsCpu(false)}>2 players</button>
            <button type="button" role="radio" aria-checked={vsCpu} className={vsCpu ? "chip on" : "chip"} onClick={() => setVsCpu(true)}>Against the CPU</button>
          </div>
        )}
        {(mode === "versus" || mode === "tag") && vsCpu && levels}
        {!solo && (
          <div className="arenas" role="radiogroup" aria-label="Arena">
            <span className="chips-label">{arena < 0 ? "Arena: surprise me" : `${STAGES[arena].name}${settings.arenaEffects ? `: ${ARENA_NOTE[arena]}` : ""}`}</span>
            <div>
              <button type="button" role="radio" aria-checked={arena < 0} aria-label="Random arena" className={arena < 0 ? "arena-pick on" : "arena-pick"} onClick={() => setArena(-1)}>?</button>
              {STAGES.map((s, i) => (
                <button key={s.id} type="button" role="radio" aria-checked={arena === i} aria-label={s.name} className={arena === i ? "arena-pick on" : "arena-pick"} onClick={() => setArena(i)}>
                  <ArenaThumb index={i} />
                </button>
              ))}
            </div>
          </div>
        )}
        <button type="button" onClick={confirm}>Choose {fighter.name}</button>
      </footer>
    </main>
  );
}
