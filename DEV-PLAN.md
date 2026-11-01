# Crazy Raccoon: development plan

## Milestones
| M | Goal | Tasks | Exit |
|---|---|---|---|
| M0 | Research and docs | Expand `research/` (alligator-farm.md etc.); town-content, SAMPLES, MECHANICS, PRD, this plan | Docs written |
| M1 | Foundation | Scaffold (package.json, shared/, LICENSE, .gitignore, launch.json), `src/` shell, loop, save, input, audio, screens (title/help/settings/credits/pause), hooks, vector renderer for rows | `--milestone m1` green |
| M2 | Core loop | sim: rows, gators (paddler), hop/queue, ride, splash, chomp, swept, respawn, goal, score; levels 1–3; `tools/check-levels.mjs` solver; Node determinism test | m2 green, solver proves L1–3 |
| M3 | Full content | All kinds, items, wash, lure, feeds, beams, boss; 15 levels; endless + beam + scores; map, results, notebook, facts; `tools/balance.mjs`; `tools/check-facts.mjs` | m3 green, solver proves all |
| M4 | Art, audio, a11y | Style pilot → Blender sprites → Codex tiles/backgrounds → art-pack; FX juice; SFX/music; reduced motion, text scale, live region, touch polish | m4 green, art reviewed |
| M5 | Test campaign, review, perf, release | Fuzzers + interaction sweep (TEST-CAMPAIGN.md); visual review loops (reviews/); perf; REPORT.md; repo + site PR | `--milestone final` green, REPORT |

## `window.__game` hooks
See MECHANICS §13 (the contract). `getState()` is the only thing tests assert on, together with screenshots.

## Test matrix
Browser tests run at desktop (1280×800) and mobile (390×844 touch) unless they are marked node. The shots are named per milestone.

| AC | Test (file › name) | Shots |
|---|---|---|
| AC1 | `m1.test.mjs` › boots to title; `m1` › offline file:// boot | `m1-title`, `m1-fileurl` |
| AC2 | `m1` › boots to title (labels, fiction line, brand) | `m1-title` |
| AC3 | `m1` › keyboard-only menus (Tab/arrows/Enter/Esc through every screen) | `m1-help`, `m1-settings`, `m1-credits` |
| AC4 | every shot test calls `t.checkLayout()`; `m4` › touch target sizes | all |
| AC5 | `m2` › hop grid and buffer; `m2` › bump on blocked | `m2-hop-mid` |
| AC6 | `m2` › splash in water; `m2` › ride a paddler | `m2-ride`, `m2-splash` |
| AC7 | `m2` › chomp on open jaws; `m2` › telegraph ≥ 0.5 s | `m2-tele`, `m2-chomp` |
| AC8 | `m2` › swept off edge | — |
| AC9 | `m2` › respawn at checkpoint, treats return | `m2-respawn` |
| AC10 | `m2` › clear level 1 by solver replay | `m2-results` |
| AC11 | `m2` › camera follows; mobile board width | `m2-play` |
| AC12 | `tests-node/levels.test.mjs` (node) › all levels solvable, par set | — |
| AC13 | `tests-node/kinds.test.mjs` (node) › each kind; `m3` › kinds gallery per zone | `m3-zone1`…`m3-zone5`, `m3-boss` |
| AC14 | `tests-node/items.test.mjs` › carry/bank/wash; `m3` › wash fx | `m3-wash` |
| AC15 | `tests-node/items.test.mjs` › lure surge; `m3` › lure keyboard + button | `m3-lure` |
| AC16 | `tests-node/kinds.test.mjs` › feed shadow before surge | `m3-feed` |
| AC17 | `tests-node/kinds.test.mjs` › beam spots | `m3-beam` |
| AC18 | `tests-node/items.test.mjs` › streak mult; `m3` › HUD mult | `m3-hud` |
| AC19 | `m3` › stars persist across reload | `m3-map` |
| AC20 | `m3` › ball badge + merman card | `m3-notebook` |
| AC21 | `tests-node/endless.test.mjs` › 500 seeds; `m3` › endless runs and beam | `m3-endless` |
| AC22 | `m3` › initials entry and scores table | `m3-scores` |
| AC23 | `tests-node/facts.test.mjs` (runs check-facts) | `m3-fact` |
| AC24 | `m4` › art manifest loads, no 404; `?art=0` fallback | `m4-art`, `m4-noart` |
| AC25 | `m4` › mid-hop squash frame (clock freeze), FX counts | `m4-hop-squash`, `m4-splash-fx` |
| AC26 | `m4` › audio state toggles | — |
| AC27 | `m4` › reduced motion | `m4-reduced` |
| AC28 | `m4` › text scale 150% | `m4-text150` |
| AC29 | `m4` › HUD contrast report | `m4-hud` |
| AC30 | `m4` › blur pauses; pause button | `m4-pause` |
| AC31 | `m4` › touch swipe ×4, tap, lure, pause (mobile) | — |
| AC32 | `m4` › gamepad via injected `navigator.getGamepads` | — |
| AC33 | `m1` › storage throws; `m3` › reload keeps progress | — |
| AC34 | `tests-node/determinism.test.mjs`; `m2` › browser hash = node hash | — |
| AC35 | `tests-node/fuzz.test.mjs`; `m5` › state fuzz + interaction sweep | `m5-fuzz-*` |
| AC36 | `m5` › perf frameCost + sizes + load | — |
| AC37 | `tools/balance.mjs` report → REPORT.md | — |

## Art pipeline (M4)
1. **Style pilot:** one Codex key-art painting (Bandit and a paddler at a concrete-lipped pit, ¾ top-down, thick outlines, soft gradients) plus one Blender test render of the gator with an outline. Approve both, then log them in `art-src/PROMPTS-pilot.md`.
2. **Blender** (`art-src/blender/*.py`, headless, deterministic): the raccoon (4 facings × idle/hop/fall), gators (paddler, whipper, basker, sleeper, hatchling, boss) × swim/jaw/whip frames, plus props. Toon ramp, rim light and an inverted-hull outline. Ortho camera at the game tilt. Writes `art-src/sprites/*.png` and `art-src/sprites/atlas.json`.
3. **Codex** (batches of ≤ 12 images, pilot attached): tileable water, sand, grass, boardwalk and straw tiles, the pool stone, the pool lip, fence, side panels (wall, barn, aviary, gift shop, pens), ridges, title art.
4. **Pack:** `node shared/test-harness/art-pack.mjs .` → `assets/*.webp` + `manifest.json` + `art-src/sheet.png` (review).

## Defect log
| # | Found | Milestone | Description | Fix | Test |
|---|---|---|---|---|---|
| 1 | 2026-11-01 | M2 | Level data: a cap on a water row with no pool stone (l6), balls on a sleeper body (l10) and on a block (l11) | Moved; `check-levels` now validates item tiles and reachability | `tools/check-levels.mjs` |
| 2 | 2026-11-01 | M2 | Dead-end pockets: l10 rows 2, 6, 11 and l11 row 8 trapped Bandit between sleepers and blocks (bot stuck 7/20 runs) | Re-laid sleepers; validator rejects pockets in stacked static rows | `check-levels` pocket check, `balance` stuck count |
| 3 | 2026-11-01 | M1 | Crash at boot when the pane is 0×0: row height 0 made the camera NaN | Layout clamps to a 160 px minimum | m1 boots |
| 4 | 2026-11-01 | M1 | `act('replay')` raced the live loop (steps ran before `pause()`), so plans desynced | Replay restarts the level at step 0 | m1 storage test, m2 replay |
| 5 | 2026-11-01 | M2 | `.pill` `display:flex` overrode `[hidden]` (empty beam pill showed) | `[hidden]{display:none!important}` | m2 shots |
| 6 | 2026-11-01 | M2 | Hint overlapped Bandit and never cleared | Moved under the HUD; clears on first hop | m2 shots |
| 7 | 2026-11-01 | M2 | Portrait showed the whole level at 43 px tiles | 6.5 visible columns with horizontal follow, taller rows | m2 camera assertion |
| 8 | 2026-11-01 | M3 | Night overlay darkened Bandit and snacks; barn lamps blew out the frame | Bandit and items redrawn after the night pass; lamp glow halved | m3 zone shots |
| 9 | 2026-11-01 | M3 | Notebook cards one column on phones | Grid min 140 px | m3-notebook |
| 10 | 2026-11-01 | M3 | Endless seed 465 uncrossable: two stacked same-direction, same-speed water lanes phase-locked with offset gators (499/500 seeds passed) | Stacked water lanes alternate direction | `check-levels --endless 500` |
| 11 | 2026-11-01 | M4 | Gamepad could not drive menus or unpause: the frame loop sleeps when nothing animates, so pads were never polled | Loop keeps polling once a pad has been seen | m4 gamepad |
| 12 | 2026-11-01 | M4 | Game-local harness served the game at `//index.html`, so `assets/…` became a protocol-relative host (every asset 404) | Local run.mjs builds the URL without the empty segment (harness request filed) | m4 art |
| 13 | 2026-11-01 | M5 | Frame cost 16–19 ms under the software rasterizer: large painted sprites and tile strips were resampled every frame | Per-size pre-scaled canvas cache (1:1 blits); now ~11 ms software, ~2 ms on GPU | m5 performance (`--gpu` too) |
| 14 | 2026-11-01 | M5 | Interaction sweep turned Assist on, so the test `scene('win')` replay (planned with Assist off) never finished and `levelDone` read a null result | Test scene pins Assist off; `levelDone` ignores unfinished runs | m5 sweep |
| 15 | 2026-11-01 | M5 | Margin props sometimes drew the flat vector hay box: `(hash >> 3) % 4` went negative for hashes ≥ 2^31, so the prop name was undefined | Unsigned shift (`>>>`) | review r08 (visual) |
| 16 | 2026-11-01 | M5 | Software frame cost rose to 25–35 ms after the loop-1 lighting pass: a full-screen `soft-light` noon grade (~12 ms), `multiply` rafter shadows and lamp glows filled 6×6-tile squares | Plain alpha overlays, lamp fills sized to the lit disc | m5 › performance; m5 › frame cost in every zone theme (new) |
| 17 | 2026-11-01 | M5 | Review capture r11 showed Bandit standing: the scripted hop hit a basker's closed mouth and bumped | Hop from the start row; the test asserts the mid-hop state | review › r11 assertion |
| 18 | 2026-11-01 | M5 | Desktop: the checkpoint-row highlight spanned only the board, leaving hard vertical seams; at night the moonlit rim pass redrew each gator's shadow and wash, boxing every gator | Full-width highlight; the rim pass draws the sprite only | review r05, r09 (visual) |
| 19 | 2026-11-01 | M5 | Mobile boss level: Old Ruthless's head sat cropped at the screen edge | Portrait camera leans toward the boss head when it is just ahead | review r10 (visual) |
| 20 | 2026-11-01 | M5 | Esc/P paused on the next frame, not on the key: `keyboard-only menus` failed 2 runs in 5 when the state was read straight after the key | The key handler pauses at once | m1 › keyboard-only menus (6/6 on repeat) |
| 21 | 2026-11-01 | M5 | Software raster cost crept up through the review loops: a full-screen sky under the board, a day grade, per-row overlays and about 140 separate strokes per frame | Sky drawn only above the den row, day grade dropped, lane overlays baked into the cached strips, strokes batched into one path per row or gator, night tint and darkness merged into one gradient. Day frame: fills from 3.15 to 1.1 screens, strokes from 139 to 52 | m5 › frame cost in every zone theme (`--gpu` enforced) |

## Balance log
`node tools/balance.mjs --src --runs 30` (casual bot, real Run code):
- First pass: zones 1–5 all ≥ 90% clear; a flat curve. Added `TUNE` (speed ×, jaw cycle, thinned lanes, sleeper cycles) and rings per zone (5/5/5/4/3).
- Current: z1 100%, z2 100%, z3 87–93%, z4 77–100% (l10 is the barn tutorial), z5 73–80%; deaths per run rise from 0.4 (z1) to about 1.3–2.5 (z3–z5). Endless median 5 chunks. The bot plans with a perturbed look-ahead, so it is likely stronger than a casual human; zone-5 targets were set accordingly (PRD AC37 amended).

## Art log
- Style pilot `art-src/pilot-keyart.png` (Codex, PROMPTS-pilot.md): approved 2026-11-01 as the style reference. It is polished and readable, more painterly than flat-vector, which fits the "2.5D detail level" brief.
- First Blender pass (procedural toon sprites at the 53° board camera, `art-src/blender/sprites.py`) rejected: too top-down and too primitive next to the pilot. Kept as the pose block-out generator (`--ref`, 28° camera) whose renders guide the Codex paint-overs in `art-src/ref/`.
