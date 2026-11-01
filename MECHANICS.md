# Crazy Raccoon: mechanics foundation

The rules live in `src/js/sim/` with no DOM, so Node tools (`tools/check-levels.mjs`, `tools/balance.mjs`, `tests-node/`) import the same code the browser runs.

## 1. Loop and timing
- Fixed step `DT = 1/120` s, with an accumulator in `frame()` capped at 12 steps per frame. Adapted from `games/Furious Squirrels/src/js/main.js`.
- The render loop runs while a level is in play and is not paused. Menus render on demand (`kick()`).
- The loop guards against re-entry: `inFrame` prevents a doubled rAF (LESSONS).
- Hop timing, invulnerability and streak windows run on sim time, which is deterministic. Wall-clock time is used only for UI toasts.
- `step(n)` advances the sim exactly `n` ticks. The same seed and the same input log give the same `hashRun()` in Node and in Chromium.

## 2. World model
- **Board:** 9 columns of `T = 64` world units, so `W = 576`. Column `c` is centred at `x = c·T + T/2`.
- **Rows:** `r = 0` (start) up to `N−1` (the den). A level is 18–40 rows.
- **Lane span:** gators wrap in `[−3T, W + 3T)`, a span of 960, so they enter and leave off-board.
- **Row types:**

| type | ground | notes |
|---|---|---|
| `start`, `grass`, `path`, `boardwalk`, `straw` | safe | may hold `blocks` (posts, hay bales, the tombstone), land gators, items and `pools` |
| `water` | **deadly** unless standing on a gator or a `pools` stone | pits, the pond, barn troughs |
| `fence` | blocked except `gaps` columns | walking only through gaps |
| `goal` | safe | the den; landing here clears the level |

- **Checkpoint rows** (`check: true`, always safe and gator-free) are "stash" spots. Reaching one banks carried treats and sets the respawn row.
- **Pools** are thermal-spring stones, safe tiles in any row. Landing on one with unwashed treats washes them, worth ×2.

## 3. Gators (one serializable list)
`{ id, row, kind, len, x, dir, v, jawT, jawCycle, jawOpen, jawTele, state, off }`
- `x` is the **nose**. The body covers `[x − len·T, x]` when facing right (`dir = +1`), mirrored for left.
- Segments: the **head** is the front 0.75 T, the **tail** the rear 0.9 T, and the **back** is everything between.
- Motion: `x += dir · v · T · mult(t) · DT`, wrapped into the span. `mult` is 1, except during a feeding surge or lure (§6).
- **Jaw cycle** (seconds, per gator, with a phase offset): `closed → tele (warning, "!" badge, jaws parting) → open (deadly) → closing`. During `tele` the head is still safe but clearly marked. The telegraph is never shorter than 0.5 s.

| kind | where | behaviour |
|---|---|---|
| `paddler` | water | Rideable back. The head chomps on the jaw cycle |
| `conga` | water | Data shorthand for 3–4 paddlers 0.1 T apart, forming a moving bridge |
| `whipper` | water | Landing on its **tail** starts a 0.35 s wind-up (tail raised), then **flings** Bandit `fling` rows (default +2) in a 0.55 s arc. The landing resolves normally. Hopping off during the wind-up cancels it |
| `hatchling` | land or water | `len 1`, banded mouth, **never chomps**. On land, contact nudges Bandit one column in its direction. In water it is too small to stand on |
| `basker` | land | Slow (0–0.6 tiles/s), with a long gaping jaw cycle. The body blocks hops. The head on contact: open → chomp, closed → bump back one row |
| `sleeper` | land (barn) | Stationary. Asleep, then `stir` (0.8 s telegraph: eye opens, Zzz stops), then a **lunge** one tile forward with open jaws over 0.25 s, then it settles back |
| `boss` | water (L15) | "Old Ruthless", `len 6`, `rows 2` (occupies `row` and `row+1`). Bounces between board edges. A head cycle like a paddler's, plus a tail slap that sends a wave pushing riders in the next lane 0.5 T |

Eyeshine (zone 5) is a **rendering** mode, not a kind: gators draw dark with glowing eyes, and flashlight beams light them.

## 4. The player (Bandit)
`{ row, x, col, state: 'idle'|'hop'|'fling'|'bump'|'dead'|'won', hopT, from, to, facing, on: gatorId|null, queue, invT, carried: [...], streak, lastFwdT }`
- **Hop:** 0.15 s on a `sin(πu)` arc with peak 0.45 T. Each landing applies squash and stretch in the renderer. One move is buffered while a hop is in flight, and extra presses are dropped.
- **Validity before a hop:** off-board columns, fence posts or `blocks`, and a land-gator body are refused with a 0.12 s "bump" wiggle. Nothing else happens.
- **Hop target:** up and down keep `x` (continuous). After landing on ground, `x` snaps to the nearest column. Left and right move `x ± T`.
- **Landing resolution** at `u = 1`, in this order:
  1. `goal` row → won.
  2. A pool stone → safe. Wash treats.
  3. Water row: on a gator body → ride (`on = id`). On its head with jaws open → **chomp**. Otherwise → **splash**.
  4. Land row: a gator head with jaws open → **chomp**; closed → **bump** (pushed back one row). Hatchling → nudge. Otherwise safe.
  5. Items on the landed tile are picked up.
- **Riding:** each step Bandit moves with the gator (`x += dir·v·T·mult·DT`). Carried past `x < 0.2T` or `x > W − 0.2T`, Bandit is **swept** off the board. If the jaw opens while Bandit is on the head → **chomp**.
- **Moving land gators** whose head reaches Bandit apply rule 4, every step.
- **Flashlight beams** (zone 5, data `beams`): a beam is a horizontal band over a row range, sweeping `x` on a sine. Bandit inside it → **spotted**.
- **Death** (chomp, splash, swept, spotted, or caught by the endless beam) costs one tail ring. Carried (unbanked) treats return to their tiles, Bandit respawns on the last checkpoint with 1.2 s of invulnerability, and the streak resets.
- **Streak:** a forward landing within 0.5 s of the previous forward landing adds 1. The multiplier is `min(4, 1 + floor(streak/4))`, and it resets after 1.0 s without forward progress.

## 5. Items
| item | effect |
|---|---|
| `pecan`, `berry` (treats) | Carried, up to 3 ("paws full"). Banked at checkpoints and the den. 100 points, or 200 washed |
| `cap` (bottle cap) | 25 points |
| `drum` (drumstick) | +1 lure, up to 3 |
| `ball` (lost 1918 ball, one per level) | 500 points and a Notebook badge |
| `ticket` (Merman ticket, L9 only) | Unlocks the Merman card (labelled legend) |

## 6. Surges: feeding show and lure
- **Feeding show** (zone 3, data `feeds: [{t0, period, row, col}]`): a drumstick shadow appears 1.0 s before it lands. Gators in that row then surge toward its `x` (shortest signed distance in the span) at ×2.5 for 2.0 s, with jaws forced open. These are timed events, so the world stays independent of the player.
- **Lure** (player, Space or the Lure button, `lures > 0`): Bandit tosses a drumstick 2 rows ahead, at the current column plus `3 × lastHorizontalFacing` (0 if the last move was vertical), clamped to the board. That row then surges for 2.0 s, as above.
  - In water, the lure pulls a ride to you.
  - On land, it pulls baskers away from your path.
  - Lures are the only player-caused change to the world. The solver plays without them.

## 7. Scoring, stars and rings
- **Points:**
  - +10 × multiplier for each new highest row reached.
  - Banked treats (§5), caps and the ball.
  - On clear: +1000, plus `max(0, par − t) × 20`, plus 500 if Bandit never died.
- **Stars:** ★ clear · ★ bank every treat in the level · ★ clear in `t ≤ par`.
- **Rings:** 5 per level in zones 1–3, 4 in the Winter Barn, 3 on the Midnight Raid (+2 with Assist). At 0 rings the level fails (Retry or Map).
- **Assist** (settings): gator speed ×0.75, telegraphs ×1.5, extra rings. With Assist on, the results screen shows "Assist" and par stars are not awarded.

## 8. Endless "Moonlight Run"
- Built from 6-row **chunks**: one checkpoint row followed by 5 hazard rows, drawn from weighted templates by difficulty `d = chunkIndex`.
  - Speeds rise and gaps shrink with `d`. New kinds enter at `d` 2, 4 and 6.
- The seeded generator (`sim/endless.js`) produces chunks lazily, 3 ahead of Bandit. `tools/check-levels.mjs --endless 500` proves 500 seeds' first 12 chunks crossable.
- **Keeper's beam:** a band rises from row −4 at `0.30 + 0.012·d` rows/s, and Bandit is never more than 9 rows ahead of it (it catches up). Caught → lose a ring, then respawn on the checkpoint above the beam with the beam pushed back 3 rows.
- 3 rings. The score is rows, items and multiplier. The top 10 (`{initials, score, rows, date}`) are kept in the save.

## 9. Input
| action | keyboard | gamepad | touch |
|---|---|---|---|
| hop ↑↓←→ | Arrows / WASD | D-pad, left stick (edge), A = ↑ | swipe ≥ 24 px in a direction; a short tap on the board = ↑ |
| lure | Space, E | X, B, LB | Lure button (bottom right, 64 px) |
| pause | P, Esc | Start | Pause button (top right, 48 px) |

Touch acts on `pointerup` (LESSONS). Swipe direction is the dominant axis of the drag. Menus use real `<button>`s with arrow-key and d-pad focus. Keys repeat-guard: one hop per keydown, with `e.repeat` ignored.

## 10. Rendering (Canvas2D, 2.5D)
- **Projection:** a ¾ top-down camera. A row is `RH = 0.80 T` tall on screen. Objects stand upright at full height `T`, anchored at their foot point. Draw order:
  1. Sky and parallax ridges (0.25, 0.55).
  2. Ground strips by row, back to front.
  3. Water surface, with a front "lip" (the concrete pool edge) drawn 0.18 T below each water row.
  4. Items, shadows (soft ellipses) and actors, y-sorted by row then x, with Bandit lifted by the hop arc.
  5. Foreground occluders (cattails, posts, steam).
  6. FX.
  7. HUD (DOM).
- **Scale:** on portrait phones 6.5 of the 9 columns show (390 px → tile ≈ 60 px), rows are 0.9 tile tall, and the camera pans sideways with Bandit. On wide screens the board is height-fitted to show about 13 rows, and the dimmed sides continue the lanes with farm scenery.
- **Camera:** follows Bandit's row with 62% of the view above him, eased with a lerp of 0.12 per 60 Hz frame. A snap on respawn.
- **Sprites:** painted and Blender-rendered WebP sheets (`assets/manifest.json`) baked into per-DPR caches. `?art=0` and loading failures fall back to vector drawings with the same silhouettes.
- **Juice:**
  - Squash and stretch on take-off and landing.
  - Splash rings and droplets, dust puffs, and chomp "teeth" stars.
  - Steam curls over pools, and a lure arc.
  - Screen shake on chomp (off with reduced motion).
- **Reduced motion:** no shake, a gentler hop arc, fewer particles, and no parallax drift.

## 11. RNG
mulberry32 (`src/js/rng.js`). Streams: `sim` (level jaw phase offsets when unspecified, and endless generation) and `fx` (cosmetic only). The seed comes from `seed(n)`, then from the level id hash (campaign levels are fixed for a given level), then from `Date.now()` for endless.

## 12. Save (`hsg-crazy-raccoon-v1`)
`{ v:1, settings:{sound,music,volume,reducedMotion,textScale,assist,controlsHint}, progress:{ [levelId]: {stars:[b,b,b], best, bestT, ball:bool} }, unlocked: n, notebook: [factIds], merman: bool, endless: { unlocked, top:[{initials,score,rows,date}] }, stats:{hops,chomps,splashes,treats} }`. Stored in `localStorage` inside try/catch with an in-memory fallback (adapted from `games/Cart Racing/src/js/save.js`).

## 13. `window.__game` hooks
| hook | behaviour |
|---|---|
| `seed(n)` | sets the next run's seed |
| `getState()` | `{scene, screen, ready, paused, mode, level:{id,n,zone,rows,par}, run:{t,score,rings,streak,mult,carried,banked,washed,lures,caps,ball,deaths,maxRow,phase,stars,beam}, player:{row,x,col,state,on,facing,hopT,invT}, gators:[{id,row,kind,x,dir,len,jaw}] (rows near Bandit), camera:{row}, settings, save:{unlocked, endlessUnlocked, top}}` |
| `setState(s)` | `{player:{row,x}, rings, lures, carried, t, settings}`: teleports to a safe test position and redraws |
| `isIdle()` | `ready && loading == 0 && !screens.trans && (scene != 'play' \|\| paused \|\| testPaused)` |
| `step(n)`, `pause()`, `resume()` | fixed ticks while paused; freeze and unfreeze |
| `scene(name)` | `title`, `map`, `play`/`game`, `help`, `settings`, `pause`, `win`, `fail`, `endless`, `scores`, `notebook`, `credits` |
| `newGame(opts)` | `{level: id \| n, mode: 'campaign' \| 'endless', seed, assist}` |
| `act(name, …)` | `'hop', dir` · `'lure'` · `'input', dir` (held, for the solver's replay) · `'replay', moves` · `'hash'` · `'clock', ms` (freeze the render clock for shots) · `'solve'` (the solver's plan for this level) · `'unlockAll'` · `'clearSave'` · `'hud', bool` · `'fxCount'` · `'gatorAt', row` |
