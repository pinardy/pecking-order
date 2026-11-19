import { NO_INPUT, advanceTrial, trialHit, type Cpu, type FighterDef, type GameEvent, type Input, type Match, type Trial } from "../../game";
import { announce, punch } from "../../announcer";
import { play } from "../../sounds";
import { inputGlyphs, pack } from "../input";
import type { LessonStep } from "../lesson";
import { vibrate, type Settings } from "../settings";
import type { Replay } from "./sources";

// Things that watch a fight without taking part in it: sound, the recorder, the combo trials,
// the tutorial and the input display. Each is a Listener the fight screen plugs into the loop.

export interface Listener {
  inputs?(a: Input, b: Input, m: Match): void;
  event?(e: GameEvent, m: Match): void;
  tick?(m: Match): void;
}

/** Sound effects, the announcer and vibration. `mine` is the side this device plays. */
export function soundListener(settings: () => Settings, o: { solo: boolean; mine: 0 | 1; quiet: boolean }): Listener {
  const felt = (side: 0 | 1) => !o.solo || side === o.mine;
  return {
    event(e, m) {
      switch (e.type) {
        case "hit":
          play(e.power === 0 ? "peck" : e.power === 1 ? "thump" : "wallop");
          if (felt(e.side)) vibrate(18 + e.power * 14, settings());
          break;
        case "block": case "tech": play("guard"); break;
        case "guardBreak":
          play("crack");
          if (felt(e.side)) vibrate(60, settings());
          break;
        case "dizzy": play("dizzy"); break;
        case "swing": play(e.heavy ? "swingHeavy" : "swing"); break;
        case "dash": play("swing"); break;
        case "jump": play("jump"); break;
        case "land": play("land"); break;
        case "down": play("down"); break;
        case "shot": play(e.kind === "crow" ? "crow" : "egg"); break;
        case "splat": play("splat"); break;
        case "throw": play("throw"); break;
        case "super":
          play("super");
          play("gasp");
          break;
        case "pickup": play("pick"); break;
        case "burst":
          play("crack");
          play("gasp");
          break;
        case "phase":
          play("bell3");
          play("crowd");
          if (!o.quiet) announce(punch(m.banner?.text ?? "Here we go!"));
          break;
        case "tag":
          play("pick");
          break;
        case "round":
          play("round");
          if (!o.quiet && m.banner) announce(`${m.banner.text}!`);
          break;
        case "fight":
          play("fight");
          play("bell");
          if (!o.quiet) announce(punch("Peck!"));
          break;
        case "ko":
          play("ko");
          play("bell3");
          play("crowd");
          announce(punch("Knockout!"));
          vibrate([70, 40, 140], settings());
          break;
        case "timeup":
          play("timeup");
          play("bell3");
          announce(punch("Time!"));
          break;
        case "roundWon":
          if (e.side !== null) play(o.solo && e.side !== o.mine ? "lose" : "win");
          if (e.side === null) setTimeout(() => announce("It’s a draw!"), 900);
          else {
            // The round goes to someone; the last one is called the way a ring announcer calls a winner.
            const name = m.f[e.side].def.name;
            const over = m.f[e.side].wins >= m.rules.rounds;
            if (over) play("crowd");
            setTimeout(() => {
              if (over) announce(e.perfect ? "A perfect round! And your winner," : "And your winner,", punch(`${name}!`));
              else announce(e.perfect ? "A perfect round, to" : "The round goes to", punch(`${name}!`));
            }, 1100);
          }
          break;
      }
    },
  };
}

/** Keeps every input, so the match can be watched again. */
export function recorder(setup: Omit<Replay, "inputs">): { listener: Listener; replay: Replay } {
  const replay: Replay = { ...setup, inputs: [] };
  return { replay, listener: { inputs: (a, b) => void replay.inputs.push(pack(a), pack(b)) } };
}

/** Combo trials: watches player 1's hits and reports how far through the current trial they are. */
export function trialTracker(trials: Trial[], on: () => boolean, report: (index: number, at: number) => void): Listener {
  let index = 0;
  let at = 0;
  return {
    event(e, m) {
      const hit = trialHit(e);
      if (!hit || !on()) return;
      const steps = trials[index].steps;
      at = advanceTrial(steps, at, hit);
      if (at >= steps.length) {
        play("win");
        m.banner = { text: "Combo!", sub: trials[index].name, t: 0, life: 70 };
        index = (index + 1) % trials.length;
        at = 0;
      }
      report(index, at);
    },
    tick(m) {
      // A dropped combo sends the trial back to its first step.
      if (at > 0 && m.f[1].comboTaken === 0) {
        at = 0;
        report(index, at);
      }
    },
  };
}

/** The tutorial: checks off each step as it sees it done, and tells the sparring partner how to behave for the next. */
export function lessonTracker(steps: LessonStep[], p1: FighterDef, brain: () => Cpu | null, report: (step: number) => void): Listener {
  let at = 0;
  let held = 0;
  const specials = new Set([...p1.specials.map((s) => s.id), p1.air.id]);
  const pass = (m: Match) => {
    play("pick");
    at++;
    m.banner = { text: at >= steps.length ? "Lesson complete" : "Good", t: 0, life: 50 };
    const cpu = brain();
    if (cpu) cpu.mode = steps[at]?.dummy ?? "stand";
    report(at);
  };
  return {
    event(e, m) {
      const id = steps[at]?.id;
      if (e.type === "word") {
        if (id === "counter" && e.text === "Counter!" && m.f[1].state === "hit") pass(m);
        else if (id === "perfect" && e.text === "Perfect!" && m.f[0].state === "block") pass(m);
        return;
      }
      if (e.type === "hit" && e.side === 1) {
        if (id === "peck" && (e.move === "sLight" || e.move === "cLight" || e.move === "jLight")) pass(m);
        else if (id === "kick" && (e.move === "sHeavy" || e.move === "cHeavy" || e.move === "jHeavy")) pass(m);
        else if (id === "special" && specials.has(e.move)) pass(m);
      } else if (id === "block" && e.type === "block" && e.side === 0) pass(m);
      else if (id === "throw" && e.type === "throw" && e.side === 0) pass(m);
      else if (id === "dash" && e.type === "dash") pass(m);
      else if (id === "crow" && e.type === "super" && e.side === 0) pass(m);
    },
    tick(m) {
      const id = steps[at]?.id;
      const me = m.f[0];
      if ((id === "walk" && Math.abs(me.x - m.f[1].x) < 90) || (id === "jump" && me.state === "air")) pass(m);
      else if (id === "charged" && me.state === "attack" && me.move?.charged) pass(m);
      else if (id === "roll" && me.state === "getup" && me.rollDir !== 0) pass(m);
      else if (id === "flutter") {
        // A quarter of a second of slowed fall counts.
        held = me.state === "air" && me.inp.y > 0 && me.vy < -1.5 && me.vy > -2.9 ? held + 1 : 0;
        if (held >= 15) pass(m);
      }
    },
  };
}

/** Player 1's recent inputs as symbols, newest first, for the training display. */
export function inputHistory(on: () => boolean): { listener: Listener; list: string[] } {
  const list: string[] = [];
  const neutral = pack(NO_INPUT);
  let last = neutral;
  return {
    list,
    listener: {
      inputs(a) {
        if (!on()) return;
        const p = pack(a);
        if (p !== last && p !== neutral) {
          list.unshift(inputGlyphs(a));
          if (list.length > 9) list.pop();
        }
        last = p;
      },
    },
  };
}

/** Watches one player for the first moment each one-time hint would be useful, and offers it. */
export function hintWatcher(side: 0 | 1, offer: (id: "charged" | "roll" | "perfect") => void): Listener {
  let blocks = 0;
  let was = "";
  return {
    tick(m) {
      if (m.phase !== "fight") return;
      const me = m.f[side];
      if (me.state === "block" && was !== "block") blocks++;
      was = me.state;
      if (me.meter >= 50 && me.meter < 100 && (me.state === "idle" || me.state === "walk")) offer("charged");
      else if (me.state === "down") offer("roll");
      else if (blocks >= 4 && me.state === "idle") offer("perfect");
    },
  };
}
