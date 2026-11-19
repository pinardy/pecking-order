# Pecking Order

A barnyard brawler for your phone. Two chickens, three rounds, one coop. Peck, kick and crow your way to the top.

The chickens are drawn in the style of [Exploding Chickens](https://github.com/pinardy/exploding-chickens): flat shapes, no outlines, the same barn-brown, straw and cream palette.

## Features

- **Eight fighters and a boss:** hens Henrietta, Dot and Goldie; roosters Rusty, Duke and Ziggy; chicks Pip and Shelly. Each has three specials (and charged versions of them), an air special, a super, a peck or kick of their own, and a breed trait: hens flutter, roosters hop further, chicks scurry while crouched. Goldie is a grappler with a throw that cannot be blocked; Shelly lays mines. Old Spur waits at the top of the ladder.
- **Arcade:** three opponents, your rival, and then Old Spur, against the CPU at four levels (Chick, Hen, Rooster, Champion), with a scarecrow bonus round after the second win, a running score, and an ending for each fighter. Lose twice to the same opponent and they ease off a level.
- **Survival and time attack:** one health bar against opponents who keep getting harder, or five fights against the clock. Bests are saved.
- **Tournament:** a knockout bracket for four or eight people passing one device.
- **Tag team:** two birds a side, against the CPU or a friend. Peck and Kick together swaps; Kick and Special together calls the partner in to charge across once (on a cooldown). Tag rounds are 75 seconds and hits land 25% harder, so they are not twice as long.
- **Versus:** two players on one keyboard, two gamepads or one touch screen (a set of controls in each bottom corner; best on a tablet), or pick your own CPU opponent. In a mirror match, player 2 wears different feathers.
- **Online:** play a friend by invite code. No server: one player hosts and sends a code, the other sends a reply code back, and the two browsers connect directly.
- **Training:** a dummy that stands still, blocks or fights back; combo trials for every fighter; a hit box overlay. Health and the crow meter refill.
- **Two lessons:** a nine-step tutorial offered first on a new device, and an advanced one for breed traits, charged specials, counters, perfect blocks and get-up rolls.
- **Assists:** auto-block and easy combos, for playing the CPU. Off by default, and off in two-player and online matches.
- **Things to earn:** clearing arcade unlocks Old Spur as a fighter, and alternate feathers for whoever cleared it. Records are kept per fighter.
- **Daily challenge:** one fight a day with a twist (half health, sudden death, no throws, full meters, a cramped space, short rounds and more), the same for everyone, worked out from the date.
- **Teaches as you play:** a failed block says why ("Block low!", "Block standing!", "Throw!"), and losing to the CPU ends with one piece of advice drawn from what actually beat you.
- **Fighter select:** a line on how each fighter plays and how hard they are, moves you can tap to watch (run through the real engine), arena thumbnails, and your last picks remembered.
- **After the match:** damage, longest combo, blocks and throws for both sides; a score breakdown in arcade; a running series tally in Versus and online.
- **Replays:** watch the match you just played, or share it as a code or a file that plays back on any copy of the same version. Pause a replay and choose Take over from here to play it out yourself against the CPU.
- **Picks up where you left off:** an unfinished arcade run is saved after every fight.
- **Made for phones:** portrait and landscape; a fixed or floating stick; an optional Block button; drag every control where you want it (saved per orientation); size and opacity sliders; left-handed layout; vibration; fullscreen; keeps the screen awake during a fight.
- **Installs and updates:** an Install button where the browser offers one, works offline (the font is bundled), and says when a new version is ready.
- **Gamepads everywhere:** the D-pad or stick moves through the menus, A selects, B goes back.
- **Back means back:** the device's Back button steps back through the app, opens the pause menu mid-fight, and only leaves from the title screen. Quitting a fight asks first.
- **Comfort options:** less flashing, larger names and counters (sized automatically for small screens), a low-health bar that is striped and labelled as well as coloured, a tick under the thumb on each press, and stick sensitivity.
- **Four arenas that play differently** (this can be turned off): corn and worms drop into the barnyard and the cornfield, and the walls bounce in the henhouse and on the roof. Each has spectators, drifting clouds or swinging lanterns, and its own music loop. Sound effects, music and the announcer have separate switches.
- **Story mode:** its own mode, beside Arcade, with its own saved progress. The climb up the barn is told in scenes between the fights, and each fighter has their own story: an opening with Old Spur calling down from the roof, a word from every opponent before and after you fight them, thoughts at the halfway mark, a scene with their rival (always the fourth fight), a showdown with Old Spur, and an epilogue. The speaker's head is shown in the dialogue box, on their side, talking; losers slump and winners hop. Scenes can be skipped, and each finished story leaves its ending under More. Every story fight won becomes a chapter that can be played again, scenes and all, from More → Chapters, without touching the story in progress. All the writing is in `src/story.ts`. Old Spur has a second phase: at half health, once a round, he gets serious (faster, harder-hitting, a full meter). Rival fights play by a rule of their own: 40-second rounds for Rusty and Ziggy, no throws for Henrietta and Dot, full meters for Shelly and Goldie, a cramped space for Pip and Duke. Losing gets a scene too.
- **Story choices:** in each rival scene you choose how to answer. Fired up, you start the fight with a full meter and the twist stands; kept civil, it is a fair fight with no twist.
- **Screen readers:** the big calls during a fight (the round, a knockout, who won) are read out as they appear.
- **Boss rush:** unlocked by finishing a story. Everyone else in the yard, one after another with your health carried over, then the top of the barn at Champion level.
- **The Story button** opens a page of its own: continue, start again, chapters, the boss rush and the endings earned.
- **Arcade:** the same climb as plain fights, for points.
- **Music:** each arena has its own band (a fiddle barn dance, a swung flute in the cornfield, a music box over a heartbeat in the henhouse, chiptune on the roof) and the menus have a quieter theme of their own. All of it is synthesized live; there are no audio files.
- **A ring bell and a crowd** at the start and end of rounds, synthesised like the rest of the sound. The rounds and the winner are called on screen; there is no synthesised voice. A hosted copy can add a ring announcer from recorded clips (below).

## How to fight

| | |
|---|---|
| Peck | Quick. Changes when you crouch or jump. |
| Kick | Slower, hits harder. Crouching, it sweeps the legs. |
| Block | Hold away from your opponent, or hold the Block button if you have turned it on (LT or RT on a gamepad). Crouch to block low hits; stand to block anything from the air. |
| Guard | Blocking wears your guard down (the thin bar under your health). If it empties, you are left wide open. |
| Throw | Next to a blocking opponent, hold toward or away and press Kick. Press Kick while grabbed to shake it off. |
| Dash | Tap toward twice. Tapping away twice hops back and slips through attacks for a moment. |
| Special | Three moves per fighter: Special alone, with toward, with down. In the air, Special is a dive. |
| Crow | The super. Hitting and being hit fills the meter; press Crow on its own when it is full. A special that lands can be cancelled into it. |
| Charged special | With half a meter, Crow with a direction: toward or down for those specials, away for the plain one. Quicker, stronger, and briefly untouchable. |
| Counter | Hit someone out of their own attack for a fifth more damage and longer stun. |
| Perfect block | Raise your guard just before a kick, special or shot lands: no chip, no wear on your guard, and you recover first. Pecks are too quick for it. |
| Getting up | On the floor, hold a direction to roll that way as you rise, or down to rise late. |
| Air throw | In the air, next to a bird also in the air: toward and Kick. On the ground, hold away while throwing to throw behind you. |
| Launcher | Down + Toward + Kick pops the opponent up; jump after them for a hit in the air. |
| Burst | Caught in a combo with a full meter: Crow breaks out, once a round. |
| Comeback | Below a quarter of your health, the crow meter fills half as fast again. |
| Tag | In Tag team, Peck and Kick together swaps in your partner. A partner tagged out wins back half of what it had lost while it rests; a knocked-out bird is replaced, and the round is lost when both are out. |
| Dizzy | Take too many hits in a row and you are knocked flat, then left seeing stars. |

A peck that lands can be cancelled straight into a special.

| | Move | Peck | Kick | Special | Crow |
|---|---|---|---|---|---|
| Keys | W A S D | F | G | H | T |
| Keys, player 2 | Arrows | J | K | L | I |
| Gamepad | Stick or D-pad | X / □ | A / ✕ | Y / △ | B / ○ |

With one player, either set of keys works. Esc pauses. Keys can be changed in Settings.

## Online play

Online play is peer to peer over WebRTC, with the invite and reply codes carrying the connection details that a signalling server would normally pass along. A public STUN server (`stun.l.google.com`) helps two players behind home routers find each other; on one network it is not needed. Networks that block direct connections (some mobile and office networks) will not connect, since there is no relay.

Codes are the connection description, deflated and base64-encoded (about 540 characters). When the game is hosted at its own address, the host can also send an invite link (`#join=…`) or show it as a QR code; opening it fills in the join step.

During a fight the round trip is shown and refreshed every few seconds. If the link goes quiet the game says so and waits; after twelve seconds it is treated as dropped. Reconnect goes back to swapping codes, and if both devices still hold the match, it picks up from the last checkpoint they agreed on (at most two seconds back). Online matches are recorded from the inputs both devices confirmed, so they have stats and a replay too; a match that was resumed after a drop does not.

Online play uses rollback. Both devices run the same deterministic engine and exchange only inputs. Each plays on immediately, guessing that the other player is still holding what they held last; when the real input arrives and the guess was wrong, the last few ticks are replayed with the truth inside a single frame. Inputs take effect one to three ticks after they are pressed (set from the measured round trip), and a device waits rather than run more than ten ticks ahead of the other. Checkpoints of confirmed state are compared every two seconds, and the game says so if they ever disagree.

In development, `?speed=10` added to the address runs the game clock ten times as fast (the browser tests use it to play whole matches in seconds), and `?lag=120` holds every outgoing input back by that many milliseconds, to see rollback at work.

## Performance

- **Sharpness** (Settings, Display) is Auto by default: the canvas starts at the screen's pixel density (up to 3x) and steps down by half a step whenever two consecutive 90-frame stretches average under about 48 fps. Full and Low pin it.
- **Show frame time** prints frames per second, milliseconds of work per frame and the current render scale in a corner of the fight.
- Arena layers, the lanterns' glow and the spectators' perches are painted once per resize. Colours derived from a palette, and font strings, are cached. The engine reuses its hit-test rectangles and its event list from tick to tick.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # engine and arcade tests (Vitest)
npm run lint        # ESLint: recommended JavaScript and TypeScript rules, and React's rules of hooks
npm run typecheck   # TypeScript, for the game and for the browser tests
npm run balance     # win rates, CPU against CPU (set GAMES=20 for more matches per pairing)
npm run test:e2e   # browser smoke tests (Playwright; first time: npx playwright install chromium)
npm run build      # type-check and bundle to a single dist/index.html
```

`npm run build` also writes `dist/standalone.html`, the same page with the manifest and icons inlined, for hosting as one file.

In development only, adding `?auto` to the address makes a Rooster-level CPU play your side, which is handy for watching a whole arcade run or testing online play in two windows. The browser tests use it too.

### How the code is laid out

Three layers, each depending only on the one before it: `game` (the rules), `render` (drawing), `ui` (screens and devices).

```
src/game/        the engine: plain TypeScript, no React, no DOM, fixed 60 Hz ticks
  types.ts         everything the engine knows about
  rules.ts         what makes a duel, training and the bonus round different
  rounds.ts        createMatch and step: one tick of a match, and the rounds around it
  fighter.ts       one fighter for one tick: stick, buttons, state machine, movement
  combat.ts        what happens when an attack connects; throws; knockouts
  shots.ts         projectiles
  target.ts        the bonus round's scarecrow
  geometry.ts      hit boxes
  state.ts         small shared pieces, and the cues the engine sends the renderer
  roster.ts        the fighters as data: stats, palettes, moves, endings
  ai.ts            the CPU, which plays through the same Input as a person
  trials.ts        combo trials for training
  assist.ts        auto-block and easy combos, applied to inputs before the engine sees them
  items.ts         pickups
  snapshot.ts      saving and restoring a match
  rollback.ts      rollback for online play (no network code: inputs in, by tick)
  pack.ts          an input as a number
src/arcade.ts    the arcade ladder as pure functions over a saveable Run
src/daily.ts     the daily challenge, worked out from the date
src/story.ts     the story mode script, and its scenes
src/ui/Chapters.tsx  chapter select
src/codec.ts     text squeezed into pasteable codes (invites, replays)
src/palette.ts   the colours, in one place
src/render/      canvas drawing
  chicken.ts       the chicken rig (body, head, comb, beak, wing, legs)
  pose.ts          engine state -> pose; attacks aim the beak or foot at the hit box
  stage.ts         the arenas: painted layers plus the live crowd, clouds and lanterns
  particles.ts     sparks, feathers, dust and call-outs, made from the engine's cues
  text.ts          the font, and drawing text on the canvas
  scene.ts         one frame: stage, fighters, shots, particles, HUD
src/ui/          React screens, settings, stats, input devices
  Fight.tsx        the fight screen: puts the pieces below together
  fight/runner.ts    the game loop (no React)
  fight/sources.ts   where inputs come from: this device, a replay, or the network
  fight/listeners.ts sound, recorder, combo trials, tutorial, input display
  fight/stats.ts     match stats, and the advice given after a loss
  fight/arena.ts     the canvas: sizing, drawing, auto sharpness
  fight/Panels.tsx   pause menu, trial and lesson panels
  padNav.ts        gamepad navigation of the menus
  pwa.ts           install prompt and update notice
  store.ts         everything saved on the device, with a version number
  replayCode.ts    replays as shareable codes
  ErrorBoundary.tsx  the screen shown if something breaks
  screen.ts        fullscreen, orientation lock, wake lock
src/styles/      one stylesheet per part of the app, imported in order by index.css
src/sounds.ts    synthesized sound effects
src/music.ts     music loops
src/announcer.ts the ring announcer: the device's speech voice, chosen and tuned to sound the part
src/net.ts       the peer-to-peer link for online play
e2e/             browser smoke tests
public/          PWA manifest, icons, service worker
```

A few things worth knowing before changing anything:

- **The engine has no modes.** A match is created with a `Rules` object (`duel(2)`, `TRAINING`, `BONUS`), and the engine reads the rules rather than asking what kind of match it is.
- **The engine draws nothing.** When something visual happens it emits an `fx` event; `render/particles.ts` decides what that looks like. Nothing random is left in the engine.
- **A fight's inputs come from an `InputSource`.** Local play, replays and online play differ only in which source the loop is given.
- **The CPU plays each fighter to a plan** (`plan` on the fighter: all-rounder, zoner, rush or heavy), notices a move you repeat, and cannot react to a peck every time.
- **Saved data is versioned** (`ui/store.ts`). If you change the shape of something saved, bump its version and give `read` an upgrade function.
- **Replays only play on the rules they were recorded with.** Each shared code carries a fingerprint of the engine's code, worked out at build time (`vite.config.ts`), so a code from a build with different engine code is refused. Nothing needs bumping by hand.
- **The fight is only repainted when something has changed.** The runner tells the frame hook how many ticks it played; with none (paused, waiting online, or every other refresh of a 120 Hz screen) the canvas is left alone. Menu animations are timed by the clock, run at thirty frames a second, and stop when scrolled out of view.
- **Between rounds, time can be hurried** (a tap or a fresh press of an attack): the runner plays four ticks per tick until the fighting resumes. The match itself is unchanged, so replays are unaffected. Not online.
- **One-time hints** (`ui/hints.ts`) are offered by a listener the first time each would help, and remembered per device.
- **`golden.test.ts` is a fingerprint of the engine's behaviour**, recorded over eight CPU matches, two bonus rounds and a training session. A refactor must leave it untouched. A deliberate rules change will break it: check nothing else moved, then paste in the new numbers.

Apart from the bundled Fredoka font (SIL Open Font License, `src/assets/Fredoka-OFL.txt`), there are no image or audio assets. The chickens and arenas are drawn with canvas paths, and all sound is synthesized with Web Audio.

### Adding a fighter

Add an entry to `ROSTER` in `src/game/roster.ts`: a breed (which sets the body), stats, a palette, quotes, an ending, a kit built from the move helpers (`projectile`, `dash`, `rising`, `pound`, `flurry`, `dive`), and an `ender` (the id of the special a landed peck cancels into). The select screen, the CPU, the move list and the combo trials pick everything up from the data, and `npm test` will play the new fighter against everyone and check its trials. Expect `golden.test.ts` to need new numbers only if you changed an existing fighter.

## Recorded announcer clips

To add a ring announcer, put MP3 files in `public/voice/` with an `index.json` listing their names (without `.mp3`), then build. A Ring announcer switch then appears in Settings → Sound. A line is only said if every piece of it has a clip; otherwise it is left to the on-screen banner. (Clips work on a hosted copy, not in the single-file preview.)

The names are the words of each line in lower case, joined with hyphens:

| Clip | Says |
|---|---|
| `round-1` … `round-5` | "Round 1!" and so on |
| `peck` | "Peck!" (the start of each round) |
| `knockout`, `time`, `its-a-draw` | "Knockout!", "Time!", "It's a draw!" |
| `the-round-goes-to`, `a-perfect-round-to` | said before a round winner's name |
| `and-your-winner`, `a-perfect-round-and-your-winner` | said before the match winner's name |
| `versus` | between the two names on the pairing card |
| `henrietta`, `rusty`, `pip`, `dot`, `shelly`, `duke`, `goldie`, `ziggy`, `old-spur` | each fighter's name |

Example `public/voice/index.json`: `["round-1", "peck", "knockout", "henrietta", "rusty"]`.
