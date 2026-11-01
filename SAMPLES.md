# Crazy Raccoon: code-sample survey

Accessed 2026-11-01. No third-party code was downloaded or copied. Every sample below was read online for ideas only, and the code is written fresh or adapted from this repo's own MIT games, which are listed at the end.

| # | Sample | License | Version | Does well | Does badly | Verdict |
|---|---|---|---|---|---|---|
| 1 | [freeCodeCamp: three.js crossing-game tutorial](https://www.freecodecamp.org/news/how-to-code-a-crossy-road-game-clone-with-threejs/) (H. M. Borbély, Feb 2025) | **None stated** | article as of 2026-11-01 | Lanes as a metadata array, not as scene objects. A move queue validated against the map before it runs. A fixed 0.2 s hop on a `sin(πt)` arc. Hit tests check only the player's current row | Frame-rate-dependent movement with no fixed step. Simulation mixed into the render loop. Coarse AABBs that ignore the visual hop position. An unbounded input queue. `alert()` on game over. Scene refs stored inside the data | **Ideas only** (no license): data-driven rows, a validated queue, hop arcs, row-local collision |
| 2 | [EvanBacon/Expo-Crossy-Road](https://github.com/EvanBacon/Expo-Crossy-Road) | MIT code; the README says it is "strictly for educational purposes" and relies on another studio's IP | default branch, last push about Jan 2025 | Row-type generation with weighted chunk selection. A safe-row cadence that keeps the endless mode fair | Uses a commercial game's models and branding. React Native coupling | **Study only, never copy**. The lane-generation idea is reimplemented with a solver check |
| 3 | [KostasDimakis/frontend-nanodegree-arcade-game](https://github.com/KostasDimakis/frontend-nanodegree-arcade-game) | MIT | archived 2023-02-10 | A tiny plain Canvas2D arcade loop: entities with `update(dt)` and `render()`, and a resources preloader | The art is Udacity's. Variable dt. No tests | **Ideas only**. Our loop comes from Furious Squirrels (fixed step, render on demand) |
| 4 | [ZzFX](https://github.com/KilledByAPixel/ZzFX) (Frank Force) | MIT | 1.x | A parametric SFX generator under 1 KB | It would mean shipping a third-party file | **Not used**. Cart Racing's MIT `audio.js` primitives (`tone`, `noise`) already cover hop, splash, chomp and whip with no download |
| 5 | [MDN: anatomy of a video game](https://developer.mozilla.org/en-US/docs/Games/Anatomy) | CC-BY-SA (docs); code samples CC0 | 2026 | Fixed-timestep accumulator and `requestAnimationFrame` pacing | — | **Pattern only**, already embodied in the repo's games |

## What becomes the foundation
- **Game loop:** a 120 Hz fixed-step accumulator with render on demand, from `games/Furious Squirrels/src/js/main.js` `frame()`. It answers sample 1's frame-rate dependence.
- **Lanes as data:** each level is a JSON list of rows with lane parameters (sample 1). Gators are plain objects in one serializable state, never scene refs.
- **Move queue:** at most one buffered hop (sample 1, bounded). A move into a fence or off the board is refused with a bump. Hops last a fixed 0.15 s on a sine arc, and landing is resolved at the visual landing point.
- **Collision:** checked only on the player's row against gator segments (head, body, tail) in 1-D lane space. That is exact for this game and cheaper than AABBs.
- **Endless generation:** weighted chunk templates with a guaranteed safe row every 4–6 rows (the idea from sample 2). Every generated chunk is proven crossable by `tools/check-levels.mjs`.

## Repo code adapted (Hot Springs Games, MIT; attribution comments at each landing site)
| From | To | What |
|---|---|---|
| `games/Furious Squirrels/src/js/rng.js` | `src/js/rng.js` | mulberry32, named streams, hashStr |
| `games/Furious Squirrels/src/js/main.js` | `src/js/main.js` | fixed-step frame loop, kick and render on demand, loadArt with `decode()` |
| `games/Furious Squirrels/src/js/gfx/fx.js` | `src/js/gfx/fx.js` | pooled particles, rings, floating text, steam puffs |
| `games/Furious Squirrels/src/js/ui/screens.js` | `src/js/ui/screens.js` | DOM menu screens with real buttons and arrow-key focus |
| `games/Cart Racing/src/js/ui/input.js` | `src/js/ui/input.js` | keyboard, gamepad and touch folded into latched intents |
| `games/Cart Racing/src/js/ui/audio.js` | `src/js/ui/audio.js` | WebAudio buses, tone and noise primitives, step-sequencer music |
| `games/Cart Racing/src/js/save.js` | `src/js/save.js` | versioned localStorage with an in-memory fallback |
| `games/Cart Racing/src/js/hooks.js` | `src/js/hooks.js` | `window.__game` contract shape, FNV-1a state hash |
| `games/basketball/tools/check-facts.mjs` | `tools/check-facts.mjs` | audited-bank fact checker, extended to research facts |
| `games/Cart Racing/tools/sync-repo.mjs` | `tools/sync-repo.mjs` | one-way copy into `repos/hsg-crazy-raccoon` |
| `games/farm-sim/art-src/blender/characters.py` | `art-src/blender/` | toon material, orthographic tilted camera, foot anchors |
