# Whisper in the Marble Hall

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/DinishKawaii/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/c/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/DinishKawaii/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/c/best-stealth-game-20261121-1759)

A top-down stealth game made for the [make.fun best stealth game bounty](https://make.fun/c/best-stealth-game-20261121-1759).

You are Sable, a quiet infiltrator slipping through a museum at night. Take
all 3 Starlight Shards on each floor, then reach the green EXIT — without a
guard ever seeing you. Guards patrol with vision cones, grow suspicious when
they half-see you, and chase you when they are sure. Shadows hide you,
crates and walls break line of sight, and running is loud.

## How to play

- **WASD / Arrow keys** — move (or click a floor tile to walk there)
- **SHIFT (hold)** — sneak: slow and quiet, much harder to spot
- **SPACE (hold)** — run: fast, but guards can hear you
- **P** — pause · **M** — mute · **R** — retry a level · **ENTER** — start / next level

3 floors, 3 guards on the first floor up to 5 on the last. Finish a floor
without ever being spotted for a GHOST bonus. A built-in autopilot
(`?autopilot=1`) plays the game by itself — it sneaks, waits for patrol
gaps, and flees when chased.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files and runs from any
static server. All art is drawn from code and all sound is synthesised with
WebAudio.

## Layout

- `game/` — the game itself (`index.html` + `src/`: levels, engine, render,
  input, audio, autopilot, shots)
- `screenshots/` — 4 screenshots taken from the game's own code
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
