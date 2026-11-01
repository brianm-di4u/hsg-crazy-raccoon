# Crazy Raccoon: Gator Farm Dash

An original lane-crossing arcade game set at the Arkansas Alligator Farm and Petting Zoo on Whittington Avenue in
Hot Springs, Arkansas, a working farm since 1902. **Bandit**, a fictional raccoon, sneaks across the pens, hopping on
the backs of swimming alligators, to raid snacks and carry them home to his den. Part of the open-source (MIT)
**Hot Springs Games** collection.

Bandit, Old Ruthless and the farm layout are made up, and the game is not affiliated with the farm. The farm's
history and the gator and raccoon facts on the fact cards are real, and each card shows its source.

## Play
Open `index.html` (it works from `file://` too).
- **Hop:** arrow keys or WASD, swipe, or tap to hop forward. Gamepad: d-pad or stick, A hops up.
- **Lure:** Space or E, or the Lure button. It tosses a drumstick two rows ahead, and the gators in that row rush to it.
- **Pause:** Esc or P, the pause button, or Start.

The gator cast:
- **Paddlers** carry you across the water, but their heads bite when the jaws open (a "!" badge warns first).
- **Whippers** fling you two rows.
- **Hatchlings** shove you sideways.
- **Baskers** gape on the sand.
- **Sleepers** in the winter barn lunge when they wake.
- **Old Ruthless** is the finale.

Carry up to three snacks home. Dunk them in a steaming spring stone first to wash them for double points, the way
raccoons do. Lives are the rings on Bandit's tail.

Modes:
- **Campaign:** 15 levels in 5 zones (Front Pits, Hatchling Nursery, Noon Feeding Show, Winter Barn, Midnight
  Raid), with three stars each and a hidden "lost 1918 home-run ball" in every level.
- **Moonlight Run:** an endless mode with seeded chunks and a rising lantern beam. It unlocks after level 6 and
  keeps a top-10 table.
- **Assist:** an option that slows the gators and adds rings.

## Build
```bash
npm run setup                    # once: test-harness dependencies and Chromium
npm run check                    # solve every level (time-expanded BFS), set par times; --endless 500 proves the generator
npm run balance                  # human-like bot plays the real sim; clear rates per zone
npm run facts                    # every fact card is checked and sourced
node tools/build-art.mjs         # painted art (art-src/*.png, git-ignored) → seamless strips, keyed sprites → assets/*.webp
npm run build                    # src/ → index.html (single file, data and manifest inlined)
npm run sim                      # Node tests: kinds, items, levels, facts, endless, determinism, fuzz
npm test                         # Playwright tests (--milestone final for everything; --gpu for real frame cost)
```
Art pipeline: Blender pose block-outs (`art-src/blender/sprites.py --ref`), painted over with Codex image
generation against the approved style pilot. Prompts are logged in `art-src/PROMPTS-*.md`.

Only `index.html` and `assets/` ship to the website.

## Layout
| Path | What |
|---|---|
| `src/js/sim/` | deterministic rules: world and gator kinds, player, run, endless generator, solver, bot (no DOM; Node tools import it) |
| `src/js/gfx/` | Canvas2D renderer, painted-art loader, vector fallback art, FX |
| `src/js/ui/` | screens, HUD, input (keyboard, touch, gamepad), synthesized audio |
| `data/` | `levels.json` (15 levels with par times and solver plans), `facts.json` |
| `tools/` | level checker and solver, balance bot, fact checker, art build, repo sync |
| `tests/`, `tests-node/` | Playwright milestone suites and review captures; Node logic tests |
| `reviews/` | the visual review loop (rubric, protocol, five loop records, history) |
| `research/` | town content for this game (the shared Hot Springs research lives in the parent repo) |
| `PRD.md`, `MECHANICS.md`, `DEV-PLAN.md`, `SAMPLES.md`, `REPORT.md` | design, plan, results |

## Credits
Code, music and sound made for this game. Sound is synthesized in the browser. Engine pieces are shared from other
Hot Springs Games titles (Tub Rally, Furious Squirrels). Sprites and backdrops were painted for this game with Codex
over Blender block-outs. MIT licensed (see `LICENSE`).
