import { useEffect, useRef, useState } from "react";
import { ACHIEVEMENTS, newlyEarned, type Achievement, type Feat } from "./achievements";
import { afterBonus, afterFight, isFinal, nextStep, rivalAt, startRun, type Run } from "./arcade";
import { dailyFor, type Daily } from "./daily";
import { startMusic, stopMusic } from "./music";
import { afterBonusScene, aftermathScene, between, defeat, ending, finale, opening, resumed, twistFor, type Choice, type Scene } from "./story";
import { AchievementsSheet, EarnedToast } from "./ui/Achievements";
import { Chapters } from "./ui/Chapters";
import { StoryHub } from "./ui/StoryHub";
import { Cutscene } from "./ui/Cutscene";
import { BOSS, ROSTER, SCARECROW, fighterById, type CpuLevel, type FighterDef, type Rules } from "./game";
import { STAGES } from "./render/stage";
import { play, unlockAudio } from "./sounds";
import { ControlEditor } from "./ui/ControlEditor";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { Fight, type FightResult, type Replay } from "./ui/Fight";
import { tipFor } from "./ui/fight/stats";
import { HowTo } from "./ui/HowTo";
import { Online } from "./ui/Online";
import { ReplaySheet } from "./ui/ReplaySheet";
import { startPadNav } from "./ui/padNav";
import { needsIosInstallHint, useInstallPrompt, useUpdateNotice } from "./ui/pwa";
import { Result } from "./ui/Result";
import { Select } from "./ui/Select";
import { SettingsModal } from "./ui/SettingsModal";
import { LEVEL_NAMES, SettingsProvider, useSettings } from "./ui/settings";
import { loadEarned, loadRun, loadStats, saveEarned, recordClear, recordDaily, recordFight, recordBossRush, recordChapter, recordScore, recordStory, recordSurvival, recordTimeAttack, saveRun } from "./ui/stats";
import { Title, type Mode } from "./ui/Title";
import { Tournament } from "./ui/Tournament";
import { Versus } from "./ui/Versus";

/** One match and everything needed to start it again or move on from it. */
interface Bout {
  mode: Mode | "bonus" | "daily";
  p1: FighterDef;
  p2: FighterDef;
  /** CPU level for player 2, or null for a second person (or a scarecrow). */
  cpu: CpuLevel | null;
  stage: number;
  /** Arcade and its bonus round: the run this bout belongs to, as it stood going in. */
  run?: Run;
  /** Versus: matches won by each side across rematches. */
  series?: [number, number];
  /** Survival and time attack: one opponent after another. */
  gauntlet?: Gauntlet;
  /** Which sides wear their alternate feathers. */
  alts?: [boolean, boolean];
  /** The daily challenge this bout is. */
  daily?: Daily;
  /** Rules beyond the arena's own, with a line for the pairing card saying what they are. */
  extraRules?: Partial<Rules>;
  maxSep?: number;
  twist?: string;
  /** Tag team: each side's partner. */
  partners?: [FighterDef, FighterDef];
}

/** A run of single-round fights: how many are won, the health carried between them (survival), and the time taken so far. */
interface Gauntlet {
  kind: "survival" | "timeattack" | "bossrush";
  wins: number;
  hp: number;
  ticks: number;
}

const TIME_ATTACK_FIGHTS = 5;

/** The boss rush: everyone else in the yard, one after another, and then the top of the barn at Champion level. */
function bossRushOrder(p1: FighterDef): FighterDef[] {
  const top = p1.id === BOSS.id ? fighterById("duke") : BOSS;
  return [...ROSTER.filter((f) => f.id !== p1.id && f.id !== top.id), top];
}

/** The next opponent in a gauntlet. Survival gets harder every second win; time attack stays at Hen level. */
function gauntletBout(p1: FighterDef, g: Gauntlet, alts?: [boolean, boolean], level: CpuLevel = 1): Bout {
  if (g.kind === "bossrush") {
    const order = bossRushOrder(p1);
    const last = g.wins === order.length - 1;
    // Health carries over, as in survival. The last fight is the boss, at Champion level, in his second phase when it comes.
    return { mode: g.kind, p1, p2: order[g.wins], cpu: last ? 3 : level, stage: last ? 2 : g.wins % STAGES.length, gauntlet: g, alts, extraRules: last && order[g.wins].id === BOSS.id ? { boss: 1 } : undefined };
  }
  const others = ROSTER.filter((f) => f.id !== p1.id);
  return {
    mode: g.kind, p1, p2: others[Math.floor(Math.random() * others.length)],
    cpu: g.kind === "survival" ? (Math.min(2, Math.floor(g.wins / 2)) as CpuLevel) : 1,
    stage: Math.floor(Math.random() * STAGES.length), gauntlet: g, alts,
  };
}

/**
 * The rival fight after the player has chosen how to answer: fired up, the twist stands and they start
 * with a full crow meter; calm, it is a fair fight with no twist at all.
 */
function answered(next: Extract<Screen, { name: "versus" }>, choice: Choice): Screen {
  const b = next.bout;
  const boss = b.extraRules?.boss !== undefined ? { boss: b.extraRules.boss } : {};
  if (choice === "calm") return { ...next, bout: { ...b, extraRules: boss, maxSep: undefined, twist: "Kept civil: a fair fight, no twist" } };
  return { ...next, bout: { ...b, extraRules: { ...b.extraRules, meters: [100, b.extraRules?.startMeter ?? 0] }, twist: `Fired up: you start with a full meter. ${b.twist ?? ""}`.trim() } };
}

/** Ticks as minutes, seconds and tenths. */
function clockText(ticks: number): string {
  const s = ticks / 60;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}

type Screen =
  | { name: "title" }
  | { name: "select"; mode: Mode }
  | { name: "versus"; bout: Bout }
  | { name: "fight"; bout: Bout; id: number }
  | { name: "result"; bout: Bout; result: FightResult }
  | { name: "replay"; replay: Replay; labels: [string, string]; back: Screen }
  | { name: "tutorial"; level: "basic" | "advanced" }
  | { name: "tournament" }
  | { name: "chapters" }
  | { name: "storyhub" }
  /** A story scene between arcade fights, then wherever the run goes next. */
  | { name: "story"; scene: Scene; next: Screen; n: number }
  | { name: "online"; invite?: string };

// An invite link carries its code after #join=. Read it once, then tidy the address.
const INVITE = (() => {
  const code = location.hash.match(/^#join=(.+)$/)?.[1];
  if (code) history.replaceState(null, "", location.pathname + location.search);
  return code;
})();

const KEY_HINT_SOLO = "Keys: W A S D to move, F to peck, G to kick, H for specials, T to crow. Esc pauses.";
const KEY_HINT_DUO = "Player 1: W A S D and F G H T. Player 2: arrow keys and J K L I.";

const labelsFor = (b: Bout): [string, string] =>
  b.mode === "training" ? ["You", "Dummy"] : b.mode === "bonus" ? ["You", ""] : b.cpu === null ? ["P1", "P2"] : ["You", "CPU"];
const points = (n: number) => `${n.toLocaleString("en")} points`;
const tally = (s?: [number, number]) => (s && s[0] + s[1] > 0 ? `${s[0]} – ${s[1]}` : undefined);

/** Where an arcade win's points came from, in words. */
function breakdown(p: FightResult["points"]): string {
  const parts = [`hits ${p.hits.toLocaleString("en")}`];
  if (p.time) parts.push(`time left ${p.time.toLocaleString("en")}`);
  if (p.perfect) parts.push(`no damage taken ${p.perfect.toLocaleString("en")}`);
  return `This fight: ${parts.join(", ")}.`;
}

/** The bout a run calls for next: the bonus round, or the opponent on the next rung. */
function boutFor(run: Run): Bout {
  const step = nextStep(run);
  const p1 = fighterById(run.p1);
  const alts: [boolean, boolean] = [!!run.alt, false];
  if (step.kind === "bonus") return { mode: "bonus", p1, p2: SCARECROW, cpu: null, stage: 0, run, alts };
  // Old Spur, at the top of the ladder, has a second phase. A story rival fight plays by a rule of its own.
  const twist = twistFor(run);
  const boss = step.opponent.id === BOSS.id ? { boss: 1 as const } : {};
  return { mode: run.story ? "story" : "arcade", p1, p2: step.opponent, cpu: step.cpu, stage: step.stage, run, alts, extraRules: { ...boss, ...twist?.rules }, maxSep: twist?.maxSep, twist: twist?.label };
}

/** A finished match as achievements see it. Player 1 is the person at this device. */
function featOf(b: Bout, r: FightResult): Feat {
  const mine = r.stats?.sides[0];
  return {
    mode: b.mode, won: r.winner === 0, fighter: b.p1.id, opponent: b.p2.id,
    // The scarecrow is nobody: its round counts for the bonus only.
    cpu: b.mode === "bonus" ? null : b.cpu,
    health: r.hp / b.p1.hp, perfect: r.points.perfect > 0, smashed: b.mode === "bonus" && r.points.bonus > 0,
    bestCombo: mine?.bestCombo ?? 0, throws: mine?.throws ?? 0, counters: mine?.counters ?? 0,
  };
}

let fightCount = 0;

function Game() {
  const [settings, update] = useSettings();
  const [screen, setScreen] = useState<Screen>(INVITE ? { name: "online", invite: INVITE } : { name: "title" });
  const [stats, setStats] = useState(loadStats);
  const [run, setRun] = useState(() => loadRun(false));
  const [story, setStory] = useState(() => loadRun(true));
  const [sheet, setSheet] = useState<"howto" | "settings" | "arrange" | "replays" | "achievements" | null>(null);
  // Achievements: what is held (anything the record already earns is granted quietly at start-up), and those just earned, waiting to be shown.
  const [earned, setEarned] = useState(() => {
    const held = loadEarned();
    const late = newlyEarned(held, loadStats(), null);
    return late.length ? saveEarned(late.map((a) => a.id)) : held;
  });
  const [fresh, setFresh] = useState<Achievement[]>([]);
  /** Checks the record as it now stands, and this match if there was one, for anything newly earned. */
  const celebrate = (feat: Feat | null) => {
    const now = loadStats();
    setStats(now);
    const won = newlyEarned(loadEarned(), now, feat);
    if (!won.length) return;
    setEarned(saveEarned(won.map((a) => a.id)));
    setFresh((list) => [...list, ...won]);
  };
  // The replay sheet for the match just played: what to play, and where to come back to afterwards.
  const [sharing, setSharing] = useState<{ replay: Replay; labels: [string, string]; back: Screen } | null>(null);
  const install = useInstallPrompt();
  const [newVersion, dismissUpdate] = useUpdateNotice();
  // For handlers that outlive a render: where the player is now, and whether the spare history entry is in place.
  const where = useRef({ screen, sheet });
  where.current = { screen, sheet };
  const armed = useRef(false);

  useEffect(() => {
    // Every button gets a soft tap sound, and the first tap unlocks audio.
    const click = (e: MouseEvent) => {
      unlockAudio();
      if ((e.target as Element).closest?.("button")) play("tap");
    };
    // Escape (and with it a gamepad's B and the device's Back button) leaves the screens that have nothing of their own to step back through.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const { screen, sheet } = where.current;
      if (sheet === "arrange") setSheet("settings");
      else if (!sheet && (screen.name === "versus" || screen.name === "result")) setScreen({ name: "title" });
    };
    // The device's Back button: one spare history entry is kept while there is somewhere in the app to go back to,
    // so Back comes here first and is treated as Escape. On the title screen there is none, and Back leaves as usual.
    const pop = () => {
      const { screen, sheet } = where.current;
      armed.current = false;
      if (screen.name === "title" && !sheet) return;
      history.pushState({ po: true }, "");
      armed.current = true;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
    };
    document.addEventListener("click", click);
    window.addEventListener("keydown", escape);
    window.addEventListener("popstate", pop);
    const stopPad = startPadNav();
    return () => {
      document.removeEventListener("click", click);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("popstate", pop);
      stopPad();
    };
  }, []);

  const home = screen.name === "title" && !sheet;
  useEffect(() => {
    if (!home && !armed.current) {
      history.pushState({ po: true }, "");
      armed.current = true;
    } else if (home && armed.current) {
      // Back on the title screen by some other route: give the spare entry back.
      history.back();
    }
  }, [home]);

  // The menu theme plays everywhere but the fights (which play their arena's loop) and the pairing card (a moment of quiet).
  const quiet = screen.name === "fight" || screen.name === "replay" || screen.name === "versus";
  useEffect(() => {
    if (!quiet) startMusic("menu");
    else if (screen.name === "versus") stopMusic();
  }, [quiet, screen.name]);
  const toTitle = () => setScreen({ name: "title" });
  const today = dailyFor(new Date());
  const announce = (bout: Bout) => setScreen({ name: "versus", bout });
  const fight = (bout: Bout) => setScreen({ name: "fight", bout, id: ++fightCount });

  /** Saves where an arcade run stands (null once it is over), so it survives closing the app. */
  const keep = (r: Run | null, isStory = !!r?.story) => {
    // A chapter played again is not a story in progress: nothing is saved.
    if (r?.chapter) return;
    saveRun(r, isStory);
    (isStory ? setStory : setRun)(r);
  };
  /**
   * Carries a run on from wherever it stands. `how` says how it got here, which decides the story
   * scene played first: the opening, picking up a saved run, after a win, or after the bonus round.
   */
  const climb = (r: Run, how: "start" | "resume" | "won" | "bonus") => {
    keep(r);
    const bout = boutFor(r);
    const go: Screen = bout.mode === "bonus" ? { name: "fight", bout, id: ++fightCount } : { name: "versus", bout };
    // Arcade is just the fights; story mode tells the climb in scenes between them.
    const scene = !r.story ? null
      : how === "start" ? opening(r, bout.stage)
      : how === "won" ? between(r, bout.stage, r.ladder[r.rung - 1])
      : bout.mode === "bonus" ? null
      : how === "bonus" ? afterBonusScene(r, bout.stage)
      : resumed(r, bout.stage);
    setScreen(scene ? { name: "story", scene, next: go, n: ++fightCount } : go);
  };

  const start = (mode: Mode, p1: FighterDef, p2: FighterDef | null, vsCpu: boolean, stage: number | null, alts: [boolean, boolean], partners?: [FighterDef, FighterDef]) => {
    if (mode === "arcade" || mode === "story") return climb({ ...startRun(p1, settings.level), alt: alts[0], story: mode === "story" }, "start");
    if (mode === "survival" || mode === "timeattack" || mode === "bossrush") return announce(gauntletBout(p1, { kind: mode, wins: 0, hp: p1.hp, ticks: 0 }, alts, settings.level));
    const bout: Bout = {
      mode, p1, p2: p2 ?? p1, cpu: mode === "training" ? 1 : vsCpu ? settings.level : null, stage: stage ?? Math.floor(Math.random() * STAGES.length), alts,
      ...(mode === "tag" && partners ? { partners, extraRules: { tag: true, seconds: 75 }, twist: `${p1.name} and ${partners[0].name} against ${p2?.name} and ${partners[1].name}` } : {}),
    };
    // Training goes straight in: there is nobody to announce.
    if (mode === "training") fight(bout);
    else announce(bout);
  };

  /** A match is over: settle it (records, the run, where to go next), then see what it earned. */
  const finish = (bout: Bout, result: FightResult) => {
    settle(bout, result);
    celebrate(featOf(bout, result));
  };
  const settle = (bout: Bout, result: FightResult) => {
    // The bonus round only adds to the score; the ladder carries straight on.
    // A chapter played again: its aftermath (or ending) if won, the winner's word if lost, then back to the chapters.
    if (bout.run?.chapter) {
      const won = result.winner === 0;
      setStats(recordFight(won, bout.p1.id));
      const scene = !won ? defeat(bout.run, bout.stage) : isFinal(bout.run) ? finale(bout.run, bout.stage) : aftermathScene(bout.run, bout.stage, bout.p2.id);
      return setScreen({ name: "story", scene, next: { name: "chapters" }, n: ++fightCount });
    }
    // A story fight won unlocks its chapter, to be played again.
    if (bout.run?.story && bout.mode !== "bonus" && result.winner === 0) recordChapter(bout.p1.id, bout.run.rung, bout.p2.id);
    if (bout.mode === "bonus" && bout.run) return climb(afterBonus(bout.run, result.score), "bonus");
    if (bout.gauntlet) {
      const g = bout.gauntlet;
      if (result.winner === 0) {
        // A win in survival gives a fifth of your health back.
        const next: Gauntlet = { ...g, wins: g.wins + 1, ticks: g.ticks + result.ticks, hp: Math.min(bout.p1.hp, result.hp + Math.round(bout.p1.hp * 0.2)) };
        if (g.kind === "bossrush") {
          if (next.wins < bossRushOrder(bout.p1).length) return announce(gauntletBout(bout.p1, next, bout.alts, settings.level));
          setStats(recordBossRush(next.wins, true));
          return setScreen({ name: "result", bout: { ...bout, gauntlet: next }, result });
        }
        if (g.kind === "survival" || next.wins < TIME_ATTACK_FIGHTS) return announce(gauntletBout(bout.p1, next, bout.alts));
        setStats(recordTimeAttack(next.ticks));
        return setScreen({ name: "result", bout: { ...bout, gauntlet: next }, result });
      }
      if (g.kind === "survival") setStats(recordSurvival(g.wins));
      if (g.kind === "bossrush") setStats(recordBossRush(g.wins, false));
      return setScreen({ name: "result", bout, result });
    }
    if (bout.cpu !== null) {
      const won = result.winner === 0;
      let s = recordFight(won, bout.p1.id);
      if (bout.daily && won) s = recordDaily(bout.daily.date);
      if (bout.run) {
        const next = afterFight(bout.run, won, result.score);
        const told = !!bout.run.story;
        if (!next && told) s = recordStory(bout.p1.id);
        else if (!next) recordClear(bout.run.level, bout.p1.id);
        if (!told && (!next || !won)) s = recordScore(result.score);
        keep(next, told);
        setStats(s);
        // The top of the barn, in story mode: the ending scene, then the result.
        if (!next && told) return setScreen({ name: "story", scene: finale(bout.run, bout.stage), next: { name: "result", bout, result }, n: ++fightCount });
        // Beaten, in story mode: the winner has a word to say about it first.
        if (!won && told) return setScreen({ name: "story", scene: defeat(bout.run, bout.stage), next: { name: "result", bout, result }, n: ++fightCount });
      }
      setStats(s);
    }
    // Versus keeps count across rematches.
    const series: [number, number] | undefined = bout.mode === "versus" ? [(bout.series?.[0] ?? 0) + (result.winner === 0 ? 1 : 0), (bout.series?.[1] ?? 0) + (result.winner === 1 ? 1 : 0)] : undefined;
    setScreen({ name: "result", bout: { ...bout, series }, result });
  };

  let view;
  switch (screen.name) {
    case "title":
      view = (
        <Title
          stats={stats}
          run={run}
          nudge={!settings.tutorialDone && stats.fights === 0 && !run}
          daily={today}
          dailyDone={stats.daily.last === today.date}
          advanced={settings.tutorialDone}
          onDaily={() => announce({ mode: "daily", p1: today.you, p2: today.them, cpu: today.twist.cpu, stage: today.stage, daily: today, extraRules: today.twist.rules, maxSep: today.twist.maxSep })}
          onAdvanced={() => setScreen({ name: "tutorial", level: "advanced" })}
          onReplays={() => setSheet("replays")}
          onMode={(mode) => setScreen({ name: "select", mode })}
          onContinue={() => run && climb(run, "resume")}
          story={story}
          onContinueStory={() => setScreen({ name: "storyhub" })}
          onTutorial={() => setScreen({ name: "tutorial", level: "basic" })}
          onOnline={() => setScreen({ name: "online" })}
          onTournament={() => setScreen({ name: "tournament" })}
          onHowTo={() => setSheet("howto")}
          onSettings={() => setSheet("settings")}
          achievements={`${ACHIEVEMENTS.filter((a) => a.id in earned).length} of ${ACHIEVEMENTS.length}`}
          onAchievements={() => setSheet("achievements")}
        />
      );
      break;
    case "select":
      view = <Select key={screen.mode} mode={screen.mode} onBack={toTitle} stats={stats} onStart={(p1, p2, vsCpu, stage, alts, partners) => start(screen.mode, p1, p2, vsCpu, stage, alts, partners)} />;
      break;
    case "story": {
      const { scene, next } = screen;
      view = <Cutscene key={screen.n} scene={scene} last={next.name === "versus" || next.name === "fight" ? "Fight" : next.name === "result" ? "Finish" : "The end"} onDone={(choice) => setScreen(choice && next.name === "versus" ? answered(next, choice) : next)} />;
      break;
    }
    case "storyhub":
      view = (
        <StoryHub
          stats={stats}
          story={story}
          onBack={toTitle}
          onContinue={() => story && climb(story, "resume")}
          onNew={() => setScreen({ name: "select", mode: "story" })}
          onChapters={() => setScreen({ name: "chapters" })}
          onBossRush={() => setScreen({ name: "select", mode: "bossrush" })}
          onEnding={(id) => setScreen({ name: "story", scene: ending(id, 3), next: { name: "storyhub" }, n: ++fightCount })}
        />
      );
      break;
    case "chapters":
      view = (
        <Chapters
          stats={stats}
          onBack={() => setScreen({ name: "storyhub" })}
          onPlay={(fighter, rung, ladder) => {
            const r: Run = { p1: fighter, ladder, rung, level: settings.level, score: 0, bonus: false, story: true, chapter: true };
            const b = boutFor(r);
            setScreen({ name: "story", scene: rung === 0 ? opening(r, b.stage) : resumed(r, b.stage), next: { name: "versus", bout: b }, n: ++fightCount });
          }}
        />
      );
      break;
    case "tournament":
      view = <Tournament onExit={toTitle} />;
      break;
    case "online":
      view = <Online invite={screen.invite} onExit={toTitle} onMatch={(feat) => celebrate(feat)} />;
      break;
    case "tutorial":
      view = (
        <Fight
          key={screen.level}
          p1={fighterById("henrietta")}
          p2={fighterById("rusty")}
          cpu={1}
          kind="training"
          stage={0}
          labels={["You", "Coach"]}
          lesson={screen.level}
          onLessonDone={() => update({ tutorialDone: true })}
          onEnd={toTitle}
          onQuit={toTitle}
        />
      );
      break;
    case "versus": {
      const b = screen.bout;
      const g = b.gauntlet;
      const caption = b.run?.chapter ? `Chapter ${b.run.rung + 1}` : b.run ? (isFinal(b.run) ? "Final fight" : rivalAt(b.run) ? `Fight ${b.run.rung + 1} of ${b.run.ladder.length}: your rival` : `Fight ${b.run.rung + 1} of ${b.run.ladder.length}`)
        : g?.kind === "survival" ? `Survival: fight ${g.wins + 1}`
        : g?.kind === "bossrush" ? `Boss rush: fight ${g.wins + 1} of ${bossRushOrder(b.p1).length}`
        : g ? `Time attack: fight ${g.wins + 1} of ${TIME_ATTACK_FIGHTS}`
        : b.daily ? "Daily challenge"
        : "Versus";
      const cpuNote = b.cpu !== null ? `, ${LEVEL_NAMES[b.cpu]} CPU` : "";
      const onKeys = !window.matchMedia?.("(pointer: coarse)").matches;
      view = <Versus key={`${b.p2.id}${b.run?.rung ?? ""}`} p1={b.p1} p2={b.p2} labels={labelsFor(b)} caption={caption} series={tally(b.series)} place={b.daily ? b.daily.twist.label : b.twist ?? `${STAGES[b.stage].name}${cpuNote}`} hint={onKeys ? (b.cpu === null ? KEY_HINT_DUO : KEY_HINT_SOLO) : undefined} onGo={() => fight(b)} />;
      break;
    }
    case "fight": {
      const b = screen.bout;
      view = (
        <Fight
          key={screen.id}
          p1={b.p1}
          p2={b.p2}
          cpu={b.cpu}
          kind={b.mode === "training" ? "training" : b.mode === "bonus" ? "bonus" : "match"}
          stage={b.stage}
          labels={labelsFor(b)}
          startScore={b.run && !b.run.story ? b.run.score : undefined}
          startHp={b.gauntlet?.kind === "survival" || b.gauntlet?.kind === "bossrush" ? b.gauntlet.hp : b.daily && b.daily.twist.health < 1 ? Math.round(b.p1.hp * b.daily.twist.health) : undefined}
          rounds={b.gauntlet ? 1 : b.daily?.twist.rounds}
          alts={b.alts}
          extraRules={b.extraRules}
          maxSep={b.maxSep}
          partners={b.partners}
          onEnd={(r) => finish(b, r)}
          onQuit={toTitle}
        />
      );
      break;
    }
    case "replay": {
      const { replay, labels, back } = screen;
      const leave = () => setScreen(back);
      view = <Fight key="replay" p1={fighterById(replay.p1)} p2={fighterById(replay.p2)} cpu={null} stage={replay.stage} labels={labels} replay={replay} onEnd={leave} onQuit={leave} />;
      break;
    }
    case "result": {
      const { bout: b, result } = screen;
      const won = result.winner === 0;
      const champ = won ? b.p1 : b.p2;
      // The winner is drawn in whatever feathers they fought in.
      const alt = won ? !!b.alts?.[0] : b.p1.id === b.p2.id ? !b.alts?.[0] : !!b.alts?.[1];
      const [tagA, tagB] = labelsFor(b);
      const sides: [string, string] = b.p1.id === b.p2.id ? [tagA, tagB] : [b.p1.name, b.p2.name];
      // Advice only for someone who just lost to the CPU.
      const tip = !won && b.cpu !== null && result.stats ? tipFor(result.stats, 0, b.p2) : undefined;
      const extras = (
        <>
          {result.replay && <button type="button" className="ghost" onClick={() => setSharing({ replay: result.replay!, labels: labelsFor(b), back: screen })}>Replay</button>}
        </>
      );
      if (b.gauntlet) {
        const g = b.gauntlet;
        const again = <button type="button" onClick={() => setScreen({ name: "select", mode: g.kind })}>Play again</button>;
        const total = bossRushOrder(b.p1).length;
        const best = g.kind === "bossrush" ? (stats.bossRush.cleared ? "You have cleared the boss rush." : `Your best is ${stats.bossRush.best} of ${total}.`) : g.kind === "survival" ? `Your best is ${stats.survival}.` : stats.timeAttack ? `Your best is ${clockText(stats.timeAttack)}.` : "";
        view = (
          <Result
            onBack={toTitle}
            winner={champ}
            cheer={won}
            headline={g.kind === "bossrush" ? (g.wins >= total ? "Boss rush cleared" : `${g.wins} of ${total} beaten`) : g.kind === "survival" ? `Survived ${g.wins} ${g.wins === 1 ? "fight" : "fights"}` : won ? `Five down in ${clockText(g.ticks)}` : `${champ.name} wins`}
            note={g.kind === "timeattack" && !won ? `Stopped at fight ${g.wins + 1} of ${TIME_ATTACK_FIGHTS}. No time set. ${best}` : best}
            stats={result.stats}
            sides={sides}
            tip={tip}
          >
            {again}
            {extras}
          </Result>
        );
      } else if (b.run) {
        const r = b.run;
        const next = afterFight(r, won, result.score);
        const left = r.ladder.length - r.rung - 1;
        view = (
          <Result
            onBack={toTitle}
            winner={champ}
            cheer={won}
            alt={alt}
            headline={next ? `${champ.name} wins` : "Top of the pecking order"}
            ending={next || r.story ? undefined : b.p1.ending}
            stats={result.stats}
            sides={sides}
            tip={tip}
            note={r.story ? (!next ? `Story finished on ${LEVEL_NAMES[r.level]}. The ending is kept under More.` : won ? `${left} ${left === 1 ? "fight" : "fights"} to go.` : `Knocked back at fight ${r.rung + 1} of ${r.ladder.length}. Try again.`) : !next ? `${points(result.score)} on ${LEVEL_NAMES[r.level]}. ${breakdown(result.points)}` : won ? `${points(result.score)}. ${breakdown(result.points)} ${left} ${left === 1 ? "fight" : "fights"} to go.` : `Knocked off the ladder at fight ${r.rung + 1} of ${r.ladder.length} with ${points(result.score)}.`}
          >
            {!next ? (
              <button type="button" onClick={() => setScreen({ name: "select", mode: r.story ? "story" : "arcade" })}>Play again</button>
            ) : won ? (
              <button type="button" onClick={() => climb(next, "won")}>{r.story ? "Continue" : next.bonus ? "Bonus round" : "Next fight"}</button>
            ) : (
              <button type="button" onClick={() => announce(b)}>Play again</button>
            )}
            {extras}
          </Result>
        );
      } else {
        view = (
          <Result
            onBack={toTitle}
            winner={champ}
            cheer={b.cpu === null || won}
            alt={alt}
            headline={`${champ.name} wins`}
            note={b.daily ? (won ? `Daily challenge won${stats.daily.streak > 1 ? `, ${stats.daily.streak} days running` : ""}. A new one arrives tomorrow.` : "It is the same fight all day. Have another go.") : tally(b.series) && `Series: ${tally(b.series)}`}
            stats={result.stats}
            sides={sides}
            tip={tip}
          >
            {(!b.daily || !won) && <button type="button" onClick={() => announce(b)}>{b.daily ? "Play again" : "Rematch"}</button>}
            {!b.daily && <button type="button" className="ghost" onClick={() => setScreen({ name: "select", mode: "versus" })}>Choose fighters</button>}
            {extras}
          </Result>
        );
      }
      break;
    }
  }

  const inFight = screen.name === "fight" || screen.name === "tutorial" || screen.name === "replay";
  return (
    <>
      {view}
      {sheet === "howto" && <HowTo onClose={() => setSheet(null)} />}
      {sheet === "settings" && <SettingsModal onClose={() => setSheet(null)} onArrange={() => setSheet("arrange")} onInstall={install} iosHint={needsIosInstallHint()} />}
      {sheet === "arrange" && <ControlEditor onClose={() => setSheet("settings")} />}
      {sheet === "replays" && (
        <ReplaySheet
          onClose={() => setSheet(null)}
          onWatch={(replay) => {
            setSheet(null);
            setScreen({ name: "replay", replay, labels: ["P1", "P2"], back: { name: "title" } });
          }}
        />
      )}
      {sharing && (
        <ReplaySheet
          replay={sharing.replay}
          onClose={() => setSharing(null)}
          onWatch={(replay) => {
            setSharing(null);
            setScreen({ name: "replay", replay, labels: sharing.labels, back: sharing.back });
          }}
        />
      )}
      {sheet === "achievements" && <AchievementsSheet earned={earned} stats={stats} onClose={() => setSheet(null)} />}
      {/* One notice at a time along the bottom: achievements first, then word of a new version. */}
      {fresh.length > 0 && !inFight ? (
        <EarnedToast achievement={fresh[0]} onDone={() => setFresh((list) => list.slice(1))} />
      ) : newVersion && !inFight ? (
        <div className="toast" role="status">
          A new version is ready.
          <button type="button" onClick={() => location.reload()}>Reload</button>
          <button type="button" className="link" onClick={dismissUpdate}>Later</button>
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Game />
      </SettingsProvider>
    </ErrorBoundary>
  );
}
