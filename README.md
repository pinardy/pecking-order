# Pecking Order

A barnyard fighting game. Peck, kick and crow your way to the top.

![Henrietta kicks Duke in the barnyard arena](docs/screenshot.png)

## Features

- **Eight fighters and a boss**, each with three specials, a super and a breed trait (hens flutter, roosters hop further, chicks scurry).
- **Modes:** Story, Arcade, Survival, Time attack, Boss rush, Tournament, Tag team, Versus, a Daily challenge, and Training with combo trials.
- **Online play** with a friend by invite code: peer to peer over WebRTC with rollback netcode, no server needed.
- **Replays** you can share as a code, or take over and play out yourself.
- **Made for phones:** touch controls you can move and resize, portrait and landscape, installable and works offline. Keyboards and gamepads work too.
- **No assets:** the chickens and arenas are drawn with canvas paths, and all music and sound is synthesized live.

## Controls

| | Move | Peck | Kick | Special | Crow (super) |
|---|---|---|---|---|---|
| Player 1 | W A S D | F | G | H | T |
| Player 2 | Arrows | J | K | L | I |
| Gamepad | Stick or D-pad | X / □ | A / ✕ | Y / △ | B / ○ |

Hold away from your opponent to block (crouch for low hits). Esc pauses. Keys can be changed in Settings, and the in-game tutorials cover the rest.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # engine tests (Vitest)
npm run test:e2e   # browser smoke tests (Playwright)
npm run lint
npm run build      # bundle to a single dist/index.html
```

The code is in three layers, each depending only on the one before it:

- `src/game/`: the engine. Plain, deterministic TypeScript at a fixed 60 Hz, with no DOM.
- `src/render/`: canvas drawing of the chickens, arenas and effects.
- `src/ui/`: React screens, settings and input devices.

Fighters are data in `src/game/roster.ts`, and the story script is in `src/story.ts`. `golden.test.ts` fingerprints the engine's behaviour, so a refactor must leave it untouched.
