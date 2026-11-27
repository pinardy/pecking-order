import { useEffect, useRef, useState } from "react";
import { TRAINING, createMatch, type FighterDef } from "../game";
import { holdMusic, startMusic } from "../music";
import { buildStage, STAGES, VIEW_H, type StageLayers } from "../render/stage";
import { play, unlockAudio } from "../sounds";
import { drawTrail, trailCamera, type TrailView } from "../trail/draw";
import { botInput, createTrail, makeLevel, seedOf, stepTrail } from "../trail/trail";
import { PauseMenu, type MenuItem } from "./fight/Panels";
import { endTick, listenKeys, padStartPressed, readInput } from "./input";
import { keepAwake } from "./screen";
import { useSettings, vibrate } from "./settings";
import { TouchControls } from "./TouchControls";

interface Props {
  p1: FighterDef;
  /** Whoever is waiting at the far end. */
  p2: FighterDef;
  stage: number;
  /** How far up the ladder this fight is (0 to 4): later trails are longer and busier. */
  rung: number;
  alt?: boolean;
  /** Reached the opponent, or skipped ahead. `corn` is the share of the trail's corn picked up, 0 to 1. */
  onDone: (corn: number) => void;
  onQuit: () => void;
}

const TICK_MS = 1000 / 60;
// Development only, as in a fight: ?auto has the test player run the trail, and ?speed=8 runs the clock faster.
const QUERY = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
const AUTO = !!QUERY?.has("auto");
const SPEED = Math.max(1, Math.min(20, Number(QUERY?.get("speed")) || 1));

/**
 * The stretch of yard between a story scene and its fight: run and jump to the opponent waiting at the far end.
 * It borrows the fight screen's layout, controls and pause sheet, and plays its own small game inside them.
 */
export function Trail({ p1, p2, stage, rung, alt, onDone, onQuit }: Props) {
  const [settings, update] = useSettings();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [menu, setMenu] = useState(false);
  // Out of hearts: the trail waits for a decision, and `attempt` starts it again from the beginning.
  const [lost, setLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState(true);
  const [touchSeen, setTouchSeen] = useState(() => window.matchMedia?.("(pointer: coarse)").matches ?? false);
  const showTouch = settings.touch === "on" || (settings.touch === "auto" && touchSeen);
  const live = useRef({ paused: false, settings, onDone });
  live.current = { paused: menu || lost, settings, onDone };
  useEffect(() => holdMusic(menu || lost), [menu, lost]);

  useEffect(() => {
    const t = createTrail(p1, makeLevel(seedOf(`${p1.id}:${p2.id}:${rung}`), rung));
    const puppets = createMatch(p1, p2, { rules: TRAINING });
    const ctx = canvas.current!.getContext("2d")!;
    const view: TrailView = { w: 640, scale: 1, camX: 0, alt };
    let layers: StageLayers | null = null;
    let stale = true;
    const resize = () => {
      const size = box.current!.getBoundingClientRect();
      if (size.width < 10 || size.height < 10) return;
      const aspect = Math.max(1.2, Math.min(16 / 9, size.width / size.height));
      const cssH = Math.min(size.height, size.width / aspect);
      const cap = live.current.settings.resolution === "low" ? 1 : 2;
      const scale = Math.min(3, (cssH * Math.min(window.devicePixelRatio || 1, cap)) / VIEW_H);
      view.w = VIEW_H * aspect;
      view.scale = scale;
      canvas.current!.width = Math.round(view.w * scale);
      canvas.current!.height = Math.round(VIEW_H * scale);
      canvas.current!.style.width = `${cssH * aspect}px`;
      canvas.current!.style.height = `${cssH}px`;
      if (!layers || Math.abs(layers.scale - scale) > 0.01) layers = buildStage(stage, scale);
      view.camX = trailCamera(t, view.w);
      stale = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box.current!);
    resize();

    let raf = 0;
    let last = performance.now();
    let owed = 0;
    // A moment with the opponent in view before the fight is called.
    let linger = 0;
    let over = false;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const gap = now - last;
      last = now;
      if (padStartPressed()) setMenu((v) => !v);
      let played = 0;
      if (!live.current.paused && !over) {
        owed += Math.min(100, gap) * SPEED;
        for (let n = 0; owed >= TICK_MS && n < 5 * SPEED && !over; n++, owed -= TICK_MS) {
          stepTrail(t, AUTO ? botInput(t) : readInput(0, true));
          endTick();
          played++;
          for (const e of t.events) {
            if (e.type === "jump") play("jump");
            else if (e.type === "land") play("land");
            else if (e.type === "peck") play("swing");
            else if (e.type === "stomp") play("thump");
            else if (e.type === "corn") play("pick");
            else if (e.type === "won") play("bell");
            else if (e.type === "lost") play("lose");
            else {
              play(e.type === "fall" ? "down" : "wallop");
              vibrate(40, live.current.settings);
            }
          }
          if (t.done === "lost") {
            over = true;
            setLost(true);
          } else if (t.done === "won" && ++linger > 70) {
            over = true;
            live.current.onDone(t.level.corn.length ? t.corn / t.level.corn.length : 0);
          }
          // The winner's pose is animated by the clock, so it keeps running after the trail stops.
          if (t.done === "won") t.tick++;
        }
      }
      view.calm = live.current.settings.calm;
      if (layers && (played > 0 || stale)) {
        stale = false;
        drawTrail(ctx, t, layers, view, puppets);
      }
    };
    raf = requestAnimationFrame(frame);

    const stopKeys = listenKeys(() => setMenu((v) => !v));
    const hidden = () => document.hidden && setMenu(true);
    const firstTouch = (e: PointerEvent) => {
      unlockAudio();
      if (e.pointerType === "touch") setTouchSeen(true);
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pointerdown", firstTouch);
    window.addEventListener("keydown", unlockAudio);
    startMusic(STAGES[stage % STAGES.length].id);
    void keepAwake(true);
    const hideHint = window.setTimeout(() => setHint(false), 9000);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stopKeys();
      window.clearTimeout(hideHint);
      startMusic("menu");
      void keepAwake(false);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pointerdown", firstTouch);
      window.removeEventListener("keydown", unlockAudio);
    };
    // One run at the trail per mount or attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Skipping ahead is always allowed: the trail is there to be enjoyed, not to keep anyone from the story.
  const skip: MenuItem = { label: "Skip to the fight", onClick: () => onDone(0) };
  const leave: MenuItem = { label: "Leave story", onClick: onQuit };
  const again = () => {
    setLost(false);
    setMenu(false);
    setAttempt((n) => n + 1);
  };
  return (
    <div className={`fight trail${showTouch ? " with-touch" : ""}`}>
      <div className="arena" ref={box}>
        <canvas ref={canvas} aria-label={`${p1.name} on the way to ${p2.name}`} />
        <div className="notes top">
          {hint && !lost && (
            <p className="note hint" role="status" onClick={() => setHint(false)}>
              Reach {p2.name}. {showTouch ? "Stick up or Kick jumps" : "Up or Kick jumps"}; Peck sees off beetles and wasps, and so does landing on them. Corn fills your crow meter for the fight.
            </p>
          )}
        </div>
      </div>
      <button type="button" className="pause-button" aria-label="Pause" onClick={() => setMenu(true)}>
        <span aria-hidden="true">II</span>
      </button>
      {showTouch && <TouchControls player={0} floating={settings.stick === "floating"} haptic={settings.haptics} dead={settings.stickDead} />}
      {lost ? (
        <PauseMenu title="Knocked off the trail" note={`Out of hearts. ${p2.name} is still waiting.`} primary={{ label: "Try again", onClick: again }} items={[skip, leave]} onClose={again} />
      ) : menu ? (
        <PauseMenu
          title="Paused"
          note="The story is saved: leaving brings you back to this trail."
          primary={{ label: "Resume", onClick: () => setMenu(false) }}
          items={[{ label: "Start the trail again", onClick: again }, skip, { label: "Sound effects", on: settings.sound, onClick: () => update({ sound: !settings.sound }) }, { label: "Music", on: settings.music, onClick: () => update({ music: !settings.music }) }, leave]}
          onClose={() => setMenu(false)}
        />
      ) : null}
    </div>
  );
}
