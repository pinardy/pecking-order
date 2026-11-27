import qrcode from "qrcode-generator";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { plainFeat, type Feat } from "../achievements";
import { ROSTER, fighterById } from "../game";
import { NetLink, delayFor } from "../net";
import { STAGES } from "../render/stage";
import { play } from "../sounds";
import { Fight, type FightResult, type Mark } from "./Fight";
import { Portrait } from "./Portrait";
import { ReplaySheet } from "./ReplaySheet";
import { Result } from "./Result";
import { CREAM, INK } from "../palette";

/** How a match is set up. The host decides and tells the guest. `n` counts matches on this link, so each gets a fresh fight screen. */
interface Setup {
  /** Names the match, so both sides can tell an interrupted one apart from a new one. */
  id: number;
  /** Picking up after a drop: the checkpoint to carry on from. */
  resume?: Mark;
  stage: number;
  host: string;
  guest: string;
  delay: number;
  n: number;
}

// Where the two players have got to. Each phase carries only what it needs, so there is no
// such thing as a fight without a setup, or a pick while still exchanging codes.
type Phase =
  | { at: "menu" }
  | { at: "host"; code: string }
  | { at: "join"; code: string | null }
  | { at: "pick"; mine: string | null; theirs: string | null }
  | { at: "fight"; setup: Setup }
  | { at: "done"; setup: Setup; winner: 0 | 1 }
  | { at: "gone" };

type Action =
  | { do: "host"; code: string }
  | { do: "join" }
  | { do: "reply"; code: string }
  | { do: "connected" }
  | { do: "pick"; who: "mine" | "theirs"; id: string }
  | { do: "start"; setup: Setup }
  | { do: "won"; winner: 0 | 1 }
  | { do: "again" }
  | { do: "left" }
  | { do: "reset" };

const PICKING: Phase = { at: "pick", mine: null, theirs: null };

function reduce(p: Phase, a: Action): Phase {
  switch (a.do) {
    case "host": return { at: "host", code: a.code };
    case "join": return { at: "join", code: null };
    case "reply": return p.at === "join" ? { at: "join", code: a.code } : p;
    case "connected": return p.at === "host" || p.at === "join" ? PICKING : p;
    case "pick": return p.at === "pick" ? { ...p, [a.who]: a.id } : p;
    case "start": return p.at === "pick" ? { at: "fight", setup: a.setup } : p;
    case "won": return p.at === "fight" ? { at: "done", setup: p.setup, winner: a.winner } : p;
    case "again": return p.at === "done" || p.at === "fight" ? PICKING : p;
    case "left": return p.at === "menu" ? p : { at: "gone" };
    case "reset": return { at: "menu" };
  }
}

/** An invite link only makes sense when this page has an address of its own that someone else can open. */
function inviteLink(code: string): string | null {
  try {
    if (!location.protocol.startsWith("http") || window.top !== window.self) return null;
  } catch {
    return null;
  }
  return `${location.origin}${location.pathname}#join=${code}`;
}

function Qr({ text }: { text: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "L");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { d, size: n + 4 };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label="Invite link as a QR code">
      <rect width={path.size} height={path.size} fill={CREAM} />
      <path d={path.d} fill={INK} />
    </svg>
  );
}

/** A code to send to the other player, with buttons to copy or share it. */
function CodeBox({ label, code, share }: { label: string; code: string; share: string }) {
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const copy = () => {
    box.current?.select();
    // Where the clipboard is off limits, the code is left selected for a manual copy.
    navigator.clipboard?.writeText(share).then(() => setCopied(true), () => {});
  };
  return (
    <label className="code">
      {label}
      <textarea ref={box} readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} />
      <span className="code-actions">
        <button type="button" className="ghost" onClick={copy}>{copied ? "Copied" : share === code ? "Copy code" : "Copy link"}</button>
        {typeof navigator.share === "function" && <button type="button" className="ghost" onClick={() => void navigator.share({ text: share }).catch(() => {})}>Share</button>}
      </span>
    </label>
  );
}

/**
 * Online play by invite code. One player hosts and sends a code; the other pastes it and
 * sends a reply code back. After that the two browsers are connected directly.
 * `invite` is a code that arrived in the page address: the join step starts filled in.
 */
/** `onMatch` is told about each match played to the end, as achievements see it (from this device's side). */
export function Online({ invite, onExit, onMatch }: { invite?: string; onExit: () => void; onMatch?: (feat: Feat) => void }) {
  const link = useRef<NetLink | null>(null);
  const games = useRef(0);
  const [phase, dispatch] = useReducer(reduce, { at: "menu" });
  const [side, setSide] = useState<0 | 1>(0);
  const [rtt, setRtt] = useState<number | null>(null);
  const [shaky, setShaky] = useState(false);
  // The match in progress and the checkpoints held for it, in case the connection drops; and what the other side holds.
  const pending = useRef<{ setup: Setup; marks: Mark[] } | null>(null);
  const [theirs, setTheirs] = useState<{ id: number | null; ticks: number[] } | null>(null);
  // How the last match went, for the numbers and the replay.
  const [last, setLast] = useState<FightResult | null>(null);
  const [watching, setWatching] = useState(false);
  const [sheet, setSheet] = useState(false);
  // Matches won on this device and on the other, across rematches and reconnections.
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const series = wins[0] + wins[1] > 0 ? `${wins[0]} – ${wins[1]}` : undefined;
  // What is in the paste box, and how the last attempt to use it went.
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = (role: 0 | 1) => {
    const l = new NetLink();
    link.current = l;
    setSide(role);
    l.onOpen = () => {
      play("pick");
      dispatch({ do: "connected" });
    };
    l.onClose = () => dispatch({ do: "left" });
    l.onShaky = setShaky;
    l.subscribe((m) => {
      if (m.k === "pick") dispatch({ do: "pick", who: "theirs", id: m.id });
      else if (m.k === "start") {
        const resume = m.resumeAt === undefined ? undefined : pending.current?.marks.find((x) => x.tick === m.resumeAt);
        if (import.meta.env.DEV && resume) console.info(`resumed at tick ${resume.tick}`);
        dispatch({ do: "start", setup: { id: m.id, resume, stage: m.stage, host: m.host, guest: m.guest, delay: m.delay, n: ++games.current } });
      } else if (m.k === "resume") setTheirs({ id: m.id, ticks: m.ticks });
      else if (m.k === "again") dispatch({ do: "again" });
    });
    return l;
  };
  const attempt = async (work: () => Promise<void>, problem: string) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch {
      setError(problem);
    }
    setBusy(false);
  };
  const leave = () => {
    link.current?.close();
    onExit();
  };
  const host = () => attempt(async () => dispatch({ do: "host", code: await open(0).host() }), "Could not start hosting. This browser may not allow direct connections.");
  const join = () => {
    open(1);
    dispatch({ do: "join" });
  };
  const makeReply = (from: string) => attempt(async () => dispatch({ do: "reply", code: await link.current!.join(from) }), "That does not look like an invite. Check that all of it was copied.");
  const connect = () => attempt(() => link.current!.accept(pasted), "That does not look like a reply code. Check that all of it was copied.");
  const pick = (id: string) => {
    dispatch({ do: "pick", who: "mine", id });
    link.current?.send({ k: "pick", id });
  };
  const rematch = () => {
    link.current?.send({ k: "again" });
    dispatch({ do: "again" });
  };
  /** After a drop: back to swapping codes, with the series so far kept. */
  const reconnect = () => {
    link.current?.close();
    link.current = null;
    setPasted("");
    setError("");
    setShaky(false);
    setTheirs(null);
    dispatch({ do: "reset" });
  };

  useEffect(() => {
    if (invite) {
      join();
      void makeReply(invite);
    }
    return () => link.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape (a gamepad's B, the device's Back button) leaves, except mid-fight, where it opens the fight's own menu.
  const fighting = phase.at === "fight";
  useEffect(() => {
    if (fighting) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && leave();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fighting]);

  // A shaky connection often steadies by itself. Give it twelve seconds, then call it dropped.
  useEffect(() => {
    if (!shaky) return;
    const timer = setTimeout(() => {
      link.current?.close();
      dispatch({ do: "left" });
    }, 12_000);
    return () => clearTimeout(timer);
  }, [shaky]);

  // Keep an eye on the connection during the fight.
  useEffect(() => {
    if (!fighting) return;
    const timer = setInterval(() => void link.current?.ping().then(setRtt), 2500);
    return () => clearInterval(timer);
  }, [fighting]);

  // On connecting, say which match (if any) was interrupted and which checkpoints are still held for it.
  const picking = phase.at === "pick";
  useEffect(() => {
    if (picking) link.current?.send({ k: "resume", id: pending.current?.setup.id ?? null, ticks: pending.current?.marks.map((x) => x.tick) ?? [] });
  }, [picking]);
  // If both sides hold a checkpoint of the same match, the host restarts it from the latest one they share.
  const shared = pending.current && theirs?.id === pending.current.setup.id ? pending.current.marks.filter((x) => theirs.ticks.includes(x.tick)).pop() : undefined;
  useEffect(() => {
    if (!picking || side !== 0 || !shared || !pending.current) return;
    const setup: Setup = { ...pending.current.setup, resume: shared, delay: delayFor(rtt ?? 60), n: ++games.current };
    link.current?.send({ k: "start", id: setup.id, stage: setup.stage, host: setup.host, guest: setup.guest, delay: setup.delay, resumeAt: shared.tick });
    if (import.meta.env.DEV) console.info(`resumed at tick ${shared.tick}`);
    dispatch({ do: "start", setup });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picking, side, shared]);
  // Development only: window.__poDrop() cuts the link without leaving, to try out reconnecting.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __poDrop?: () => void }).__poDrop = () => {
      link.current?.close();
      dispatch({ do: "left" });
    };
  }, []);

  // Time the connection while the fighters are being picked: the median of five round trips.
  useEffect(() => {
    if (!picking || !link.current) return;
    let alive = true;
    void (async () => {
      const samples: number[] = [];
      for (let i = 0; i < 5 && alive; i++) {
        samples.push(await link.current!.ping());
        await new Promise((r) => setTimeout(r, 100));
      }
      if (alive) setRtt(samples.sort((a, b) => a - b)[2]);
    })();
    return () => {
      alive = false;
    };
  }, [picking]);

  // The host starts the match once both have picked, and tells the guest how it is set up.
  const mine = phase.at === "pick" ? phase.mine : null;
  const theirPick = phase.at === "pick" ? phase.theirs : null;
  useEffect(() => {
    if (side !== 0 || !mine || !theirPick) return;
    const setup = { id: (Date.now() & 0x7fffffff) || 1, stage: Math.floor(Math.random() * STAGES.length), host: mine, guest: theirPick, delay: delayFor(rtt ?? 60) };
    link.current?.send({ k: "start", ...setup });
    dispatch({ do: "start", setup: { ...setup, n: ++games.current } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, mine, theirPick]);

  if (phase.at === "gone") {
    return (
      <main className="screen online">
        <header className="bar">
          <button type="button" className="link" onClick={leave}>Back</button>
          <h1>The connection dropped</h1>
        </header>
        <p className="lede">
          Either the other player left or the link between you was lost. If it was the link, swap a new pair of codes
          {pending.current?.marks.length ? " and the match picks up from just before it dropped." : series ? ` and carry on from ${series}.` : " and carry on."}
        </p>
        <div className="result-actions">
          <button type="button" onClick={reconnect}>Reconnect</button>
        </div>
      </main>
    );
  }

  if (phase.at === "fight" && link.current) {
    const { setup } = phase;
    return (
      <>
      <Fight
        key={setup.n}
        p1={fighterById(setup.host)}
        p2={fighterById(setup.guest)}
        cpu={null}
        stage={setup.stage}
        labels={side === 0 ? ["You", "Them"] : ["Them", "You"]}
        net={{ link: link.current, side, delay: setup.delay, resume: setup.resume, onMark: (marks) => (pending.current = { setup, marks }) }}
        onEnd={(r) => {
          pending.current = null;
          setLast(r);
          setWins(([mine, theirs]) => (r.winner === side ? [mine + 1, theirs] : [mine, theirs + 1]));
          // Only the match itself counts towards achievements online: the feats in a fight are for beating the CPU.
          onMatch?.(plainFeat({ mode: "online", online: true, won: r.winner === side, fighter: side === 0 ? setup.host : setup.guest, opponent: side === 0 ? setup.guest : setup.host, cpu: null }));
          dispatch({ do: "won", winner: r.winner });
        }}
        onQuit={leave}
      />
      {shaky ? <div className="ping shaky">Connection interrupted. Trying to get it back…</div> : rtt !== null && Number.isFinite(rtt) && <div className="ping">{Math.round(rtt)} ms</div>}
      </>
    );
  }

  if (phase.at === "done" && watching && last?.replay) {
    const { setup } = phase;
    const back = () => setWatching(false);
    return <Fight key="replay" p1={fighterById(setup.host)} p2={fighterById(setup.guest)} cpu={null} stage={setup.stage} labels={side === 0 ? ["You", "Them"] : ["Them", "You"]} replay={last.replay} onEnd={back} onQuit={back} />;
  }

  if (phase.at === "done") {
    const { setup, winner } = phase;
    const champ = fighterById(winner === 0 ? setup.host : setup.guest);
    return (
      <>
        <Result onBack={leave} winner={champ} headline={winner === side ? "You win" : `${champ.name} wins`} cheer={winner === side} alt={winner === 1 && setup.host === setup.guest} note={series && `Series: ${series} to ${wins[0] >= wins[1] ? "you" : "them"}`} stats={last?.stats} sides={side === 0 ? ["You", "Them"] : ["Them", "You"]}>
          <button type="button" onClick={rematch}>Rematch</button>
          {last?.replay && <button type="button" className="ghost" onClick={() => setSheet(true)}>Replay</button>}
        </Result>
        {sheet && last?.replay && (
          <ReplaySheet
            replay={last.replay}
            onClose={() => setSheet(false)}
            onWatch={() => {
              setSheet(false);
              setWatching(true);
            }}
          />
        )}
      </>
    );
  }

  const linkOut = phase.at === "host" ? inviteLink(phase.code) : null;
  return (
    <main className="screen online">
      <header className="bar">
        <button type="button" className="link" onClick={leave}>Back</button>
        <h1>{phase.at === "pick" ? "Choose your fighter" : "Play online"}</h1>
      </header>

      {phase.at === "menu" && (
        <>
          <p className="lede">Play a friend over the internet. There is no lobby: one of you hosts and sends an invite, the other sends a reply code back.</p>
          <div className="title-menu">
            <button type="button" className="big" disabled={busy} onClick={host}>
              Host a match
              <small>Make an invite</small>
            </button>
            <button type="button" className="big ghost" onClick={join}>
              Join a match
              <small>You have an invite code</small>
            </button>
          </div>
          <p className="fine">Direct connections work on most home networks. Some mobile and office networks block them.</p>
        </>
      )}

      {phase.at === "host" && (
        <div className="steps">
          <CodeBox label={linkOut ? "1. Send this invite to your opponent, or let them scan it" : "1. Send this invite code to your opponent"} code={phase.code} share={linkOut ?? phase.code} />
          {linkOut && <Qr text={linkOut} />}
          <label className="code">
            2. Paste the reply code they send back
            <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Reply code" />
            <button type="button" disabled={busy || !pasted.trim()} onClick={connect}>Connect</button>
          </label>
        </div>
      )}

      {phase.at === "join" && (
        <div className="steps">
          {phase.code === null ? (
            <label className="code">
              1. Paste the invite from the host
              <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Invite code or link" />
              <button type="button" disabled={busy || !pasted.trim()} onClick={() => makeReply(pasted)}>Make reply code</button>
            </label>
          ) : (
            <>
              <CodeBox label="2. Send this reply code back to the host" code={phase.code} share={phase.code} />
              <p className="fine">Waiting for the host to connect…</p>
            </>
          )}
        </div>
      )}

      {phase.at === "pick" && (
        <>
          <div className="roster" role="listbox" aria-label="Fighters">
            {ROSTER.map((f) => (
              <button key={f.id} type="button" role="option" aria-selected={phase.mine === f.id} className={phase.mine === f.id ? "fighter-card on" : "fighter-card"} onClick={() => pick(f.id)}>
                <Portrait fighter={f} size={56} animate={false} />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          <p className="fine">
            {shared ? "Connected. Picking the match up where it dropped…" : !phase.mine ? "Connected. Choose who to fight as." : phase.theirs ? "Starting…" : "Waiting for the other player to pick…"}
            {rtt !== null && Number.isFinite(rtt) && ` Round trip: ${Math.round(rtt)} ms.`}
            {series && ` Series: ${series}.`}
          </p>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </main>
  );
}
