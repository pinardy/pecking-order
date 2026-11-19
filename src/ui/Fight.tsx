import { useEffect, useRef, useState } from "react";
import { BONUS, MAX_METER, TRAINING, createCpu, createMatch, matchRules, restore, trialsFor, type Cpu, type CpuLevel, type DummyMode, type FighterDef, fighterById, type Rules, isCounterStep } from "../game";
import { holdMusic, startMusic } from "../music";
import type { NetLink } from "../net";
import { Particles } from "../render/particles";
import { STAGES } from "../render/stage";
import { unlockAudio } from "../sounds";
import { createArena } from "./fight/arena";
import { inputHistory, lessonTracker, recorder, soundListener, trialTracker, type Listener, hintWatcher } from "./fight/listeners";
import { LessonPanel, MoveStrip, PauseMenu, TrialPanel, type MenuItem } from "./fight/Panels";
import { runMatch } from "./fight/runner";
import { localSource, netSource, replaySource, type DummyTape, type Mark, type Replay } from "./fight/sources";
import { frameInfo, type FrameInfo } from "./fight/frames";
import { statsInSlices, statsListener, type MatchStats } from "./fight/stats";
import { HowTo } from "./HowTo";
import { endTick, listenKeys, padStartPressed, readInput } from "./input";
import { HINTS, markHint, seenHints, type HintId } from "./hints";
import { ADVANCED, LESSON } from "./lesson";
import { canFullscreen, keepAwake, lockLandscape, toggleFullscreen, useFullscreen } from "./screen";
import { useSettings } from "./settings";
import { TouchControls } from "./TouchControls";

export type { Mark, MatchStats, Replay };

const DUMMY_LABEL: Record<DummyMode, string> = { stand: "stands still", block: "blocks", fight: "fights back", swing: "kicks on a beat", sweep: "sweeps on a beat" };
const DUMMY_NEXT: Record<DummyMode, DummyMode> = { stand: "block", block: "fight", fight: "swing", swing: "sweep", sweep: "stand" };

export interface FightResult {
  winner: 0 | 1;
  /** Player 1's score, including whatever they started with. */
  score: number;
  replay: Replay | null;
  /** What each side did, counted as it happened. Null for replays and training. */
  stats: MatchStats | null;
  /** Where player 1's points in this fight came from. */
  points: { hits: number; time: number; perfect: number; bonus: number };
  /** Player 1's health at the end, and how long the match took, in ticks. */
  hp: number;
  ticks: number;
}

interface Props {
  p1: FighterDef;
  p2: FighterDef;
  /** CPU level for player 2, or null when a person (or nobody) is on that side. */
  cpu: CpuLevel | null;
  kind?: "match" | "training" | "bonus";
  stage: number;
  labels: [string, string];
  /** Arcade: show the score, carried over from earlier fights. */
  startScore?: number;
  /** Survival: start with this much health rather than a full bar. */
  startHp?: number;
  /** Rounds to win, where the mode decides rather than the settings. */
  rounds?: number;
  /** Play this recording back instead of taking input. */
  replay?: Replay;
  /** Online: the link, which side this device plays, and how many ticks ahead inputs are sent. `resume` picks an interrupted match up from a checkpoint; `onMark` reports new ones. */
  net?: { link: NetLink; side: 0 | 1; delay: number; resume?: Mark; onMark?: (marks: Mark[]) => void };
  /** Which sides wear their alternate feathers. */
  alts?: [boolean, boolean];
  /** Rules beyond the arena's own: a story twist, or a boss with a second phase. */
  extraRules?: Partial<Rules>;
  /** A narrower space than the screen would allow, for a twist that calls for one. */
  maxSep?: number;
  /** Tag team: each side's partner. */
  partners?: [FighterDef, FighterDef];
  /** Training as a guided lesson: the basics, or the finer points. `onLessonDone` is called when the last step is passed. */
  lesson?: "basic" | "advanced";
  onLessonDone?: () => void;
  onEnd: (result: FightResult) => void;
  onQuit: () => void;
}

/**
 * The fight screen. It puts the pieces together: a match, somewhere for its inputs to come
 * from, the loop that plays it, the canvas that shows it, and whoever is listening in.
 */
export function Fight({ p1, p2, cpu, kind = "match", stage, labels, startScore, startHp, rounds: fixedRounds, replay, net, alts, extraRules, maxSep: narrowTo, partners, lesson, onLessonDone, onEnd, onQuit }: Props) {
  const [settings, update] = useSettings();
  const training = kind === "training";
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const brain = useRef<Cpu | null>(null);
  // Which sheet is up, if any. Any of them pauses the fight.
  const [menu, setMenu] = useState<null | "main" | "tools" | "confirm">(null);
  const paused = menu !== null;
  /** Escape, the device's Back button and a gamepad's Start all do this: open the menu, step back within it, or close it. */
  const togglePause = () => setMenu((v) => (v === null ? "main" : v === "main" ? null : "main"));
  const [moves, setMoves] = useState(false);
  const [dummy, setDummy] = useState<DummyMode>("stand");
  const [boxes, setBoxes] = useState(false);
  const [inputsOn, setInputsOn] = useState(false);
  // Training: frame data for the last move, and a recording for the dummy to copy.
  const [frameOn, setFrameOn] = useState(false);
  // A replay taken over, and what is said to a screen reader as the fight goes (the round, a knockout, who won).
  const takeOver = useRef<() => void>(() => {});
  const [taken, setTaken] = useState(false);
  const [said, setSaid] = useState("");
  const [frames, setFrames] = useState<FrameInfo | null>(null);
  const dummyTape = useRef<DummyTape>({ mode: "off", frames: [], at: 0 });
  const [taping, setTaping] = useState<DummyTape["mode"]>("off");
  const [trialOn, setTrialOn] = useState(false);
  const [trial, setTrial] = useState({ index: 0, at: 0 });
  const [lessonAt, setLessonAt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [drift, setDrift] = useState(false);
  const [touchSeen, setTouchSeen] = useState(() => window.matchMedia?.("(pointer: coarse)").matches ?? false);
  const fullscreen = useFullscreen();
  const trials = trialsFor(p1);
  // A one-time hint on screen, and a tap on the arena waiting to be acted on.
  const [hint, setHint] = useState<string | null>(null);
  const tapped = useRef(false);
  const lessonSteps = lesson === "advanced" ? ADVANCED : LESSON;

  // The loop reads these through a ref so it never has to restart.
  const live = useRef({ paused, settings, onEnd, onLessonDone, boxes, trialOn, inputsOn });
  live.current = { paused: (paused || moves) && !net, settings, onEnd, onLessonDone, boxes, trialOn, inputsOn };

  const showTouch = !replay && (settings.touch === "on" || (settings.touch === "auto" && touchSeen));
  const duo = showTouch && cpu === null && !net && kind === "match";
  const me = net?.side === 1 ? p2 : p1;

  useEffect(() => {
    // During trials the dummy stands still, except for a counter trial, where it has to be attacking.
    const counter = trialOn && trials[trial.index]?.steps.some(isCounterStep);
    if (brain.current && training && !lesson) brain.current.mode = counter ? "swing" : trialOn ? "stand" : dummy;
  }, [dummy, training, trialOn, lesson, trial.index, trials]);
  useEffect(() => holdMusic(paused || moves), [paused, moves]);

  useEffect(() => {
    const first = box.current!.getBoundingClientRect();
    // A tall, narrow arena keeps the fighters closer together so they can be drawn larger.
    const narrow = !net && !replay && first.width / Math.max(1, first.height) < 1.2;
    const maxSep = replay?.maxSep ?? Math.min(narrowTo ?? 999, narrow ? 330 : 400);
    const rounds = replay?.rounds ?? fixedRounds ?? (net ? 2 : live.current.settings.rounds);
    // Online, both devices must agree, so arena effects are always on there. Replays keep whatever they were recorded with.
    const effects = replay ? replay.effects : !!net || live.current.settings.arenaEffects;
    const extra = replay ? replay.extra : extraRules;
    const rules = training ? TRAINING : kind === "bonus" ? BONUS : { ...matchRules(rounds, stage, effects), ...extra };
    const pair = replay?.partners ? ([fighterById(replay.partners[0]), fighterById(replay.partners[1])] as [FighterDef, FighterDef]) : partners;
    const m = createMatch(p1, p2, { rules, maxSep, partners: pair });
    m.f[0].score = startScore ?? 0;
    const hp0 = replay ? replay.startHp : startHp;
    if (hp0 !== undefined) m.f[0].hp = m.f[0].hpGhost = Math.min(p1.hp, hp0);
    // Online, after a drop: carry on from the last state both devices agreed on.
    if (net?.resume) restore(m, net.resume.state);

    const seed = Date.now() & 0x7fffffff;
    brain.current = cpu === null || replay ? null : createCpu(cpu, seed, training ? "stand" : "fight");
    // Development only: add ?auto to the address and a Rooster-level CPU plays this device's side.
    const auto = import.meta.env.DEV && new URLSearchParams(location.search).has("auto") ? createCpu(2, seed + 7) : null;
    const solo = cpu !== null || kind !== "match" || !!net;
    const mine = net?.side ?? 0;

    // The assists are for playing the CPU: not for two players, online, the bonus round or a lesson.
    const st = live.current.settings;
    const assist = solo && !net && kind !== "bonus" && !lesson && (st.assistBlock || st.assistCombo) ? { block: st.assistBlock, combo: st.assistCombo } : null;
    const online = net ? netSource({ link: net.link, side: net.side, delay: net.delay, auto, onDrift: () => setDrift(true), start: net.resume?.tick, onMark: net.onMark }) : null;
    const source = replay ? replaySource(replay) : online ?? localSource({ solo, brain: () => brain.current, secondPlayer: kind === "match", auto, assist, tape: training ? dummyTape.current : undefined });

    const particles = new Particles();
    const history = inputHistory(() => live.current.inputsOn);
    const tape = replay || training || net ? null : recorder({ p1: p1.id, p2: p2.id, stage, rounds, maxSep, effects, alts, startHp, extra, partners: pair && [pair[0].id, pair[1].id] });
    // Online, rollback can replay ticks, so anything that counts or records them is left out.
    const tally = replay || training || net ? null : statsListener();
    const listeners: Listener[] = [soundListener(() => live.current.settings, { solo, mine, quiet: training }), history.listener];
    // The big calls on screen ("Round 1", "Knockout!", who won) are said to screen readers too.
    let lastBanner: unknown = null;
    listeners.push({
      tick(m) {
        if (m.banner && m.banner !== lastBanner) {
          lastBanner = m.banner;
          setSaid([m.banner.text, m.banner.sub].filter(Boolean).join(". "));
        }
      },
    });
    if (training) {
      // Frame data: whenever player 1 starts a move, how it is built and how it stands when blocked.
      let serial = -1;
      // (A recording that has filled up stops itself; the menu needs to know.)
      let shown = dummyTape.current.mode;
      listeners.push({
        tick(m) {
          const f = m.f[0];
          if (dummyTape.current.mode !== shown) setTaping((shown = dummyTape.current.mode));
          if (f.state === "attack" && f.move && f.moveSerial !== serial) {
            serial = f.moveSerial;
            setFrames(frameInfo(f.move));
          }
        },
      });
    }
    if (tally) listeners.push(tally.listener);
    if (tape) listeners.push(tape.listener);
    if (lesson) {
      listeners.push(lessonTracker(lessonSteps, p1, () => brain.current, (at) => {
        setLessonAt(at);
        if (at >= lessonSteps.length) live.current.onLessonDone?.();
      }));
    } else if (training) {
      listeners.push(trialTracker(trials, () => live.current.trialOn, (index, at) => setTrial((t) => (t.index === index && t.at === at ? t : { index, at }))));
    }

    const arena = createArena({
      canvas: canvas.current!, box: box.current!, match: m, stage, quality: live.current.settings.resolution,
      view: { labels, score: startScore !== undefined, tag: replay ? "Replay" : assist ? "Assist on" : undefined, alts: replay ? replay.alts : alts },
      showPerf: () => live.current.settings.showPerf,
      largeHud: live.current.settings.hudSize === "large",
      // Two sets of controls share the width; shrink them to fit half each.
      resized(width) {
        root.current?.style.setProperty("--duo", String(Math.min(1, (width / 2 - 14) / 316)));
        // Held upright, the two sets are stacked instead, so each can have the full width.
        root.current?.style.setProperty("--duo-tall", String(Math.min(1, (width - 20) / 316)));
      },
    });

    const crowReady = [0, 0];
    // False once this screen has gone, so that nothing finishing late reports to it.
    let alive = true;

    // One-time hints, for whoever is playing on this device against the CPU or online.
    const seen = seenHints();
    let hintTimer = 0;
    const offer = (id: HintId) => {
      if (seen.has(id) || hintTimer) return;
      seen.add(id);
      markHint(id);
      setHint(HINTS[id]);
      hintTimer = window.setTimeout(() => {
        hintTimer = 0;
        if (alive) setHint(null);
      }, 6000);
    };
    const hinting = !replay && !lesson && kind === "match" && (solo || !!net);
    if (hinting) listeners.push(hintWatcher(mine, offer));
    if (hinting && showTouch && window.innerHeight > window.innerWidth) offer("rotate");

    // Skipping: between rounds, a tap on the arena or a fresh press of an attack hurries things along
    // until the fighting starts again. Not online, where both devices have to keep the same time.
    let skipping = false;
    let wasDown = true;
    // When an attack button was last held. Someone still mashing from the fight does not skip:
    // the buttons have to have been let go for a moment first, and the round's end on screen for a second.
    let lastDown = performance.now();
    let canSkip = false;
    // Taking over a replay: from this moment on, player 1 is whoever is holding the controls, against the CPU.
    let active = source;
    takeOver.current = () => {
      brain.current = createCpu(live.current.settings.level, seed + 1, "fight");
      active = localSource({ solo: true, brain: () => brain.current, secondPlayer: false, auto: null, assist: null });
      setTaken(true);
    };
    const stop = runMatch(m, { next: (x) => active.next(x), after: (x) => active.after?.(x), finished: () => active.finished?.() ?? false }, {
      paused: () => live.current.paused,
      hurry: () => skipping,
      inputs: (a, b) => listeners.forEach((l) => l.inputs?.(a, b, m)),
      tick() {
        endTick();
        particles.step();
        particles.trail(m);
        for (const e of m.events) {
          particles.cue(e, m);
          for (const l of listeners) l.event?.(e, m);
        }
        for (const l of listeners) l.tick?.(m);
      },
      frame(gap, began, ticks) {
        const now = performance.now();
        const between = !net && m.phase !== "fight" && m.phaseT > 60;
        const i = readInput(0, true);
        const down = i.light || i.heavy || i.special || i.sup;
        const settled = now - lastDown > 350;
        if (between && settled && ((down && !wasDown) || tapped.current)) skipping = true;
        if (m.phase === "fight") skipping = false;
        if (down) lastDown = now;
        wasDown = down;
        tapped.current = false;
        const ready = between && now - lastDown > 350;
        if ((ready && !skipping) !== canSkip) {
          canSkip = ready && !skipping;
          root.current?.classList.toggle("can-skip", canSkip);
        }
        if (padStartPressed()) togglePause();
        m.f.forEach((f, i) => {
          // The Crow button lights up at half a meter (a charged special) and glows at a full one (the super).
          const ready = f.meter >= MAX_METER ? 2 : f.meter >= MAX_METER / 2 ? 1 : 0;
          if (ready === crowReady[i]) return;
          crowReady[i] = ready;
          // With one set of controls on screen, it belongs to whichever side this device plays.
          const pad = duo ? controls[i].current : i === mine ? controls[0].current : null;
          pad?.classList.toggle("crow-ready", ready === 2);
          pad?.classList.toggle("crow-half", ready === 1);
        });
        arena.view.reducedMotion = live.current.settings.reducedMotion;
        arena.view.calm = live.current.settings.calm;
        arena.view.debug = live.current.boxes;
        arena.view.inputs = live.current.inputsOn ? history.list : undefined;
        arena.draw(m, particles, ticks > 0);
        if (import.meta.env.DEV) (window as unknown as { __poFrames?: number }).__poFrames = ((window as unknown as { __poFrames?: number }).__poFrames ?? 0) + 1;
        if (!live.current.paused) arena.timing(gap, performance.now() - began);
      },
      stall: setWaiting,
      end() {
        // Online, the record is whatever both devices have confirmed, and the stats come from playing that back.
        // (Not after a resume: the first part of the match is no longer to hand.)
        const record: Replay | null = online && !net?.resume ? { p1: p1.id, p2: p2.id, stage, rounds, maxSep, effects, alts, inputs: online.confirmed().slice() } : tape?.replay ?? null;
        const done = (stats: MatchStats | null) => alive && live.current.onEnd({ winner: m.winner ?? 0, score: m.f[0].score, replay: record, stats, points: m.f[0].points, hp: m.f[0].hp, ticks: m.tick });
        if (online && record) void statsInSlices(record).then(done);
        else done(online ? null : tally?.stats ?? null);
      },
    });

    const stopKeys = listenKeys(togglePause);
    const hidden = () => document.hidden && setMenu((v) => v ?? "main");
    const firstTouch = (e: PointerEvent) => {
      unlockAudio();
      if (e.pointerType === "touch") setTouchSeen(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pointerdown", firstTouch);
    window.addEventListener("keydown", unlockAudio);
    startMusic(STAGES[stage % STAGES.length].id);
    void keepAwake(true);
    if (live.current.settings.lockLandscape) lockLandscape(true);

    return () => {
      alive = false;
      stop();
      window.clearTimeout(hintTimer);
      source.dispose?.();
      arena.dispose();
      stopKeys();
      startMusic("menu");
      void keepAwake(false);
      lockLandscape(false);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pointerdown", firstTouch);
      window.removeEventListener("keydown", unlockAudio);
    };
    // One match per mount; the parent remounts this component for the next fight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const what = lesson ? "lesson" : training ? "training" : replay ? "replay" : net ? "match" : "fight";
  const leave = `Leave ${what}`;
  // Leaving training or a replay loses nothing, so it does not ask first.
  const asks = !replay && (!training || !!lesson);
  let sheet: { title: string; note?: string; primary?: MenuItem; back?: () => void; items: MenuItem[] } | null = null;
  if (menu === "main") {
    const items: MenuItem[] = [];
    if (!replay) items.push({ label: `${me.name}’s moves`, onClick: () => setMoves(true) });
    // Practising a moment from a replay: play it out yourself from here, against the CPU.
    if (replay && !taken) items.push({ label: "Take over from here", onClick: () => {
      takeOver.current();
      setMenu(null);
    } });
    if (training && !lesson) items.push({ label: "Training tools", onClick: () => setMenu("tools") });
    items.push({ label: "Sound effects", on: settings.sound, onClick: () => update({ sound: !settings.sound }) }, { label: "Music", on: settings.music, onClick: () => update({ music: !settings.music }) });
    if (canFullscreen()) items.push({ label: "Fullscreen", on: fullscreen, onClick: () => void toggleFullscreen() });
    items.push({ label: leave, onClick: asks ? () => setMenu("confirm") : onQuit });
    sheet = { title: net ? "Menu" : "Paused", primary: { label: net ? "Back to the fight" : "Resume", onClick: () => setMenu(null) }, items };
  } else if (menu === "tools") {
    const items: MenuItem[] = [{ label: "Combo trials", on: trialOn, onClick: () => setTrialOn(!trialOn) }];
    if (!trialOn) items.push({ label: `Opponent ${DUMMY_LABEL[dummy]}`, onClick: () => setDummy(DUMMY_NEXT[dummy]) });
    items.push({ label: "Hit boxes", on: boxes, onClick: () => setBoxes(!boxes) }, { label: "Input display", on: inputsOn, onClick: () => setInputsOn(!inputsOn) }, { label: "Frame data", on: frameOn, onClick: () => setFrameOn(!frameOn) });
    // Record what you do, and the dummy does it back: for practising against one particular attack.
    const t = dummyTape.current;
    items.push({
      label: t.mode === "recording" ? "Stop recording" : "Record a sequence for the dummy",
      onClick: () => {
        if (t.mode === "recording") t.mode = "off";
        else Object.assign(t, { mode: "recording", frames: [], at: 0 });
        setTaping(t.mode);
        setMenu(null);
      },
    });
    if (t.frames.length > 0 && t.mode !== "recording") items.push({ label: "Dummy copies the recording", on: t.mode === "playing", onClick: () => {
      Object.assign(t, { mode: t.mode === "playing" ? "off" : "playing", at: 0 });
      setTaping(t.mode);
    } });
    sheet = { title: "Training tools", back: () => setMenu("main"), items };
  } else if (menu === "confirm") {
    const note = lesson ? "You can come back to the lesson from the title screen."
      : net ? "This ends the match for both of you."
      : startScore !== undefined ? "Your arcade run is saved. You will start this fight again."
      : "The match will be abandoned.";
    sheet = { title: `Leave the ${what}?`, note, primary: { label: lesson ? "Keep going" : "Keep fighting", onClick: () => setMenu("main") }, items: [{ label: leave, onClick: onQuit }] };
  }

  return (
    <div className={`fight${showTouch ? " with-touch" : ""}${duo ? " duo" : ""}`} ref={root}>
      <div className="arena" ref={box} onPointerDown={() => (tapped.current = true)}>
        <canvas ref={canvas} aria-label={`${p1.name} against ${p2.name}`} />
        {/* Messages over the arena: instructions near the top, notices near the bottom, all in one style. */}
        <div className="notes top">
          {training && trialOn && !lesson && <TrialPanel fighter={p1} trials={trials} index={trial.index} at={trial.at} />}
          {lesson && <LessonPanel steps={lessonSteps} at={lessonAt} keys={showTouch ? null : settings.keys[0]} onFinish={onQuit} />}
          {training && taping === "recording" && <p className="note">Recording for the dummy (up to ten seconds). Pause and choose Stop recording when done.</p>}
          {training && frameOn && frames && (
            <p className="note frames">
              <b>{frames.name}</b> starts in {frames.startup}, hits for {frames.active}, recovers in {frames.recovery}. {frames.onBlock}
            </p>
          )}
          {hint && (
            <p className="note hint" role="status" onClick={() => setHint(null)}>
              {hint}
            </p>
          )}
        </div>
        <p className="sr-only" aria-live="assertive">{said}</p>
        {taken && <p className="note taken">Your turn: you have taken over from the replay.</p>}
        <div className="notes bottom">
          {waiting && <p className="note net-note">Waiting for the other player…</p>}
          {drift && <p className="note net-note">The two devices have drifted out of step. Leave and start a new match.</p>}
          {!net && <span className="note skip-note" aria-hidden="true">{showTouch ? "Tap to skip" : "Press an attack to skip"}</span>}
        </div>
      </div>
      {showTouch && !duo && !lesson && <MoveStrip fighter={me} />}
      <button type="button" className="pause-button" aria-label={net ? "Menu" : "Pause"} onClick={() => setMenu("main")}>
        <span aria-hidden="true">II</span>
      </button>
      {showTouch && <TouchControls player={0} duo={duo} floating={settings.stick === "floating"} block={settings.blockButton} haptic={settings.haptics} dead={settings.stickDead} ref={controls[0]} />}
      {duo && <TouchControls player={1} duo haptic={settings.haptics} dead={settings.stickDead} ref={controls[1]} />}
      {sheet && !moves && <PauseMenu {...sheet} onClose={() => setMenu(null)} />}
      {moves && <HowTo fighter={me} onClose={() => setMoves(false)} />}
    </div>
  );
}

