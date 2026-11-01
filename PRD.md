# Crazy Raccoon: Gator Farm Dash — product requirements

## 1. Vision
A bright, chunky, cartoon 2.5D arcade game. Bandit, a made-up raccoon, sneaks through the real Arkansas Alligator Farm and Petting Zoo in Hot Springs, hopping across lanes of swimming, basking, whipping and snoozing alligators to carry snacks home to his den. Easy to start, tense to master, readable on a phone.

**Pillars**
1. **Every death is fair:** every hazard telegraphs by shape, motion and badge, never by colour alone, and every level is proven crossable.
2. **Gators are the playground:** the same animals are platform, obstacle and tool (ride, dodge, fling, lure).
3. **Juicy cartoon look:** thick outlines, soft gradients, squash and stretch, splashes and steam.
4. **Real place, light touch:** real farm facts on fact cards; everything else is clearly game fiction.

**Target players:** casual players of all ages on phone and desktop, and score-chasers in the endless mode.

## 2. Modes
- **Campaign:** 15 levels in 5 zones: Front Pits (1–3), Hatchling Nursery (4–6), Noon Feeding Show (7–9), Winter Barn (10–12), Midnight Raid (13–15, with the boss on 15). Levels unlock in order. Each has 3 stars, a par time, treats, caps and a hidden 1918 ball.
- **Moonlight Run (endless):** unlocks after clearing level 6. A seeded procedural crossing with a rising keeper's beam, 3 rings and a top-10 table.
- **Assist** (setting): slower gators, longer telegraphs, +2 rings.

## 3. Rules
As specified in `MECHANICS.md` §2–§8. Those numbers are the contract, and `tools/balance.mjs` may tune them, recording each change in DEV-PLAN.

## 4. Hot Springs content map
| Where | Content |
|---|---|
| Title / credits | "A made-up raccoon caper at a real Hot Springs landmark. Not affiliated with the farm." · Hot Springs Games · MIT License |
| Level 1 | Start at the farm wall on Whittington Ave.; ridges of West Mountain and Sugarloaf behind |
| Zone 1 | Concrete-lipped pits and a pond (c. 1924 photo look) |
| Zone 2 | Banded-mouth hatchlings (harmless); fact: restocking from Louisiana |
| Zone 3 | Noon feeding surges, keeper chicken tosses, "Aw-aw!" call as a sound motif (not a voiced character) |
| Zone 4 | Wintering barn: heat-lamp glow, sleeping gators, straw floor |
| Zone 5 | Night: eyeshine gators, flashlight beams; boss "Old Ruthless" (game fiction) |
| Collectibles | Lost 1918 home-run ball (hs-0183, hs-0195); Merman ticket (hs-0484, legend) |
| Fact cards | `research/town-content.md` §2 (bank and research facts, each with its source line) |

## 5. Screens and UX flow
Title → (Play: farm map with 15 level nodes | Moonlight Run | How to Play | Farm Notebook | Settings | Credits).
Level intro card (name, zone, goal, one fact) → play → Pause (Resume / Restart / Map / Settings / Help) → Results (stars, score breakdown, fact card, Next / Retry / Map) or Out of Rings (Retry / Map). Endless: Game over → initials entry if a top-10 score → Scores.

## 6. Art direction
- **Palettes:** `linen-postcard` sky and title, `ouachita-forest` ridges, `thermal-water` pools, gator greens near icon #40, and night blues.
- **Style:**
  - Thick dark outline (2–4 px at phone scale).
  - Soft top-lit gradient with a rim highlight.
  - Soft drop shadows and parallax.
  - Saturated near, paler far.
  - Original character designs: no borrowed characters or logos.
- **Sources:** painted backgrounds and tiles (Codex), Blender toon-outlined sprites, and a vector fallback.

## 7. Audio direction
Synthesized only (WebAudio):
- **SFX:** hop "bip", splash, chomp clack, whip crack, pickup chime, wash fizz, lure whoosh, bump, star fanfare.
- **Music:** an original banjo-and-bass jaunt by day, a sleepy barn waltz, a night creep.
- Quiet by default, with separate sound and music toggles.

## 8. Accessibility
Keyboard-only play (menus and game), gamepad, touch. Text contrast ≥ 4.5:1 (3:1 large). Telegraphs use shape plus badge plus motion. `prefers-reduced-motion` honoured, with a setting override. Text scale 100/125/150%. Live region announcements (level start, death cause, level clear). Focus visible.

## 9. Mobile and touch
Portrait-first at 390×844: the 9 columns fill the width. Swipe or tap to hop, a 76 px Lure button and a 48 px Pause button, with every target ≥ 44 px. Safe-area insets respected. No text selection or long-press menus. Landscape works with side scenery.

## 10. Performance budgets
60 fps target on a mid-range laptop (`frameCost.taskMs` ≤ 8 ms desktop, ≤ 12 ms at 4× CPU throttle on mobile). `index.html` ≤ 2 MB, `assets/` ≤ 6 MB. Interactive (hooks ready) ≤ 2 s. JS heap ≤ 60 MB.

## 11. Save/load
`localStorage` key `hsg-crazy-raccoon-v1` (MECHANICS §12). The game works when storage throws.

## 12. Acceptance criteria
**Boot and shell**
- AC1 Boots to the title within 2 s with no console errors and no network requests (http and file://).
- AC2 The title shows the game name, "Hot Springs Games", the fiction/non-affiliation line and the menu buttons: Play, Moonlight Run, How to Play, Farm Notebook, Settings, Credits.
- AC3 Every menu is reachable and operable by keyboard alone; Esc goes back.
- AC4 Layout has no overflow or clipped controls at 1280×800 and 390×844, and touch targets are ≥ 44 px on mobile.

**Core loop**
- AC5 Hops move exactly one tile in four directions, take 0.15 s, and buffer at most one move; invalid moves bump without moving.
- AC6 Landing in water without support splashes (−1 ring); standing on a gator's back rides with it.
- AC7 A gator head with open jaws chomps; jaws telegraph for ≥ 0.5 s before opening, with a "!" badge.
- AC8 Being carried off the board edge counts as swept (−1 ring).
- AC9 Death respawns on the last checkpoint with brief invulnerability; unbanked treats return to their tiles.
- AC10 Reaching the den clears the level and shows Results with stars and a score breakdown.
- AC11 The camera follows Bandit with look-ahead; on portrait phones about 6.5 of the 9 columns show and the view pans sideways with Bandit (tiles ≈ 60 px at 390 px wide).

**Content**
- AC12 15 campaign levels in 5 zones load from `data/levels.json`, and each is proven crossable by `tools/check-levels.mjs` (with par times set from the solver).
- AC13 Gator kinds behave per MECHANICS §3: paddler, conga, whipper (fling), hatchling (nudge, no chomp), basker (bump or chomp), sleeper (stir → lunge), boss.
- AC14 Treats carry (max 3), bank at checkpoints and the den, and wash ×2 on pool stones.
- AC15 Lure: Space or the button tosses a drumstick, the target row surges for 2 s, and lures are counted (max 3).
- AC16 Feeding-show surges are telegraphed by a falling shadow 1 s ahead.
- AC17 Flashlight beams (zone 5) spot Bandit (−1 ring) and are visible and predictable.
- AC18 The streak multiplier rises with rhythmic forward hops and shows in the HUD.
- AC19 Stars: clear, all treats, par. The best stars and score per level persist.
- AC20 Each level has a hidden ball; collecting it persists a Notebook badge. The L9 Merman ticket unlocks the legend card.
- AC21 Moonlight Run unlocks after L6, generates seeded chunks forever (500 seeds × 12 chunks proven crossable by `tools/check-levels.mjs --endless 500`; 25 seeds × 8 chunks in `npm run sim`), and has a rising beam and 3 rings.
- AC22 The endless top 10 is saved with initials entry.
- AC23 Fact cards show only checked facts (`tools/check-facts.mjs` passes), each with its source.

**Presentation**
- AC24 Painted and Blender art loads from `assets/` (manifest only, no 404s); `?art=0` vector fallback works; `isIdle` is false while art loads.
- AC25 The 2.5D look: y-sorted actors, ellipse shadows, outlined sprites, parallax, squash and stretch on hops, splash/dust/steam FX.
- AC26 Audio starts on first input, toggles for sound and music, and is quiet by default.
- AC27 Reduced motion removes shake and parallax drift and softens the hop arc.
- AC28 Text scale 125% and 150% keeps menus and HUD readable without overflow.
- AC29 The HUD shows rings (tail), score, multiplier, treats carried/banked, lures, the level timer and pause; contrast ≥ 4.5:1.
- AC30 The game pauses on blur or visibility change; Pause works with P/Esc/Start and the touch button.

**Input**
- AC31 Touch swipe in each direction hops; tap hops up; the Lure and Pause buttons work (pointerup).
- AC32 Gamepad d-pad, stick and buttons work in game and menus.

**Robustness and quality**
- AC33 Saves survive reload; the game runs when `localStorage` throws.
- AC34 Determinism: the same seed and input replay give the same hash in Node and the browser.
- AC35 Fuzzers (random input on every level, random state jumps) find no crash, no NaN and no stuck state.
- AC36 Performance budgets in §10 are met (`t.frameCost`, file sizes, load time).
- AC37 Balance: the casual bot (`tools/balance.mjs`) clears zone-1 levels ≥ 85% and zone-5 levels 40–80% (amended at M3: the bot plans with look-ahead and is stronger than a casual player), deaths per run rise by zone, endless median ≥ 4 chunks.

## 13. Out of scope
Online leaderboards, accounts, analytics, in-app purchases, multiplayer, level editor UI, voice acting, localization beyond English, real farm staff or owners as characters, farm logos or signage.
