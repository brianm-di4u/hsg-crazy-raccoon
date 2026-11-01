# Crazy Raccoon: town content

Every place, fact, name, colour and story the game uses, with its source. Facts shown to players come from two places only:
1. **Audited trivia bank** `games/trivia/data/questions.json` (ids below, all `confidence: confirmed`), checked by `tools/check-facts.mjs`.
2. **Research corpus** `research/alligator-farm.md` (added 2026-11-01 for this game), each fact with the URL it cites. The checker confirms the URL appears in that file.

Everything else is labelled game fiction on screen ("game rules", "made-up raccoon").

## 1. Setting
| Use in game | Content | Source |
|---|---|---|
| Whole game | The Arkansas Alligator Farm and Petting Zoo, 847 Whittington Ave., south side of the avenue, northwest edge of Hot Springs | `research/alligator-farm.md` → Identity (RoadsideAmerica, EoA) |
| Level 1 start row | A wall along Whittington Ave. (with the Babe Ruth trail marker outside it) | `research/other-attractions.md` → Alligator Farm, Address row |
| Parallax ridges | Whittington valley between West Mountain (~1,419 ft) and Sugarloaf (~1,129 ft); oak-hickory and shortleaf pine forest | `research/baseball-spring-training.md` L147–148; `research/fish-and-wildlife.md` → Plants and forests |
| Water lanes | Outdoor gator pits and a pond; the c. 1924 photo's curved white concrete pool lip and basking bank | `research/alligator-farm.md` → Grounds and layout |
| Zone 2 | Banded-mouth small gators held for photos; hatchlings restocked from Louisiana | `research/alligator-farm.md` → Alligators at the farm |
| Zone 3 | Noon feeding shows (Thu/Sat/Sun, May–Oct), ~200 lb of chicken, the keeper's "Aw-aw! Come on boy!" call | `research/alligator-farm.md` → Feeding shows, Feeding call |
| Zone 4 | Wintering barn, about six months a year, gators in a sleepy mass under heat lamps | `research/alligator-farm.md` → Wintering |
| Zone 5 | Night: raccoons are nocturnal | `research/alligator-farm.md` → Raccoon natural history (NWF) |
| Props | 1906 dog tombstone (prop only, no scene); parakeet aviary; gift shop; petting pens (pygmy goats, donkeys, emu, peacocks) as non-interactive scenery | `research/alligator-farm.md` → Grounds, Other animals |
| Secret | The Merman: "the sign says" it was caught ~500 miles off Hong Kong **[LEGEND]** | `research/alligator-farm.md` → The Merman |
| Collectible | Babe Ruth's March 17, 1918 home run landed in the farm (a pond); the ball was never found; the owner joked a gator swallowed it **[LEGEND]** | trivia `hs-0183`, `hs-0195`; `research/alligator-farm.md` → Babe Ruth's ball |
| Hero | Bandit, a made-up raccoon. Nod: the farm added raccoons in 1965; the IQ Zoo (380 Whittington Ave.) trained raccoons. No source says raccoons live at the farm today, so Bandit is a visitor | `research/alligator-farm.md` → History (1965); `research/other-attractions.md` → IQ Zoo |
| Boss | "Old Ruthless", a made-up giant gator, game fiction. Inspired by, but not named after, the farm's real gators (Jaws, d. 1988; an 18 ft 11 in gator) | game fiction; `research/alligator-farm.md` |
| Mechanics flavour | Food "washing" in thermal pools is a game rule (the behaviour is **[DISPUTED]**); tail rings = lives (raccoon tails have 4–6 rings) | `research/alligator-farm.md` → Raccoon natural history |

## 2. Fact cards (loading screens, level results, the Farm Notebook)
Bank facts (`data/facts.json` → `bank`):
- `hs-0399` founded 1902 · `hs-0298` H. L. Campbell · `hs-0483` gators from the Florida Everglades · `hs-0493` Hot Springs Gator Farm under Danny Older (~1929) · `hs-0484` the "Merman" · `hs-0183` Ruth's homer landed in the farm · `hs-0195` hit at Whittington Park.

Research facts (`data/facts.json` → `research`), text kept close to the source:
- Alligators: 74–80 teeth at a time, up to 3,000 in a lifetime; nest temperature sets sex; 35–50 eggs, ~65 days; average female 8.2 ft, male 11.2 ft; gator holes up to 65 ft (Smithsonian's National Zoo).
- Arkansas: protected in 1961; 2,841 Louisiana alligators released 1972–1984; delisted to recovered in 1987 (AGFC); "as many as 4,000" in state waters (ADG 2013).
- Farm: about 200 adult and baby alligators; restocked with 12–15 Louisiana hatchlings every 10–15 years (EoA); feeding shows at noon Thu/Sat/Sun May–Oct, ~200 lb of chicken (ADG 2013); six months in the wintering barn under heat lamps (RoadsideAmerica); ~50 parakeets fed with seed sticks (EoA); 1965 raccoons, monkeys, loggerhead turtles and the gift shop (EoA).
- Raccoons: 4–6 black tail rings; "nimble, almost handlike paws"; nocturnal; up to 16 years in the wild, ~5 on average (NWF).

## 3. Colours (estimates, from `research/visual-style-guide.md` and `shared/design/tokens.css`)
- `linen-postcard` sky and title; `ouachita-forest` ridges and pines; `thermal-water` steaming pools (tufa cream, algae green fringe); gator green near icon #40 `#3E5A3A` (estimate), lightened for cartoon readability; night blues toward `deco-neon`.

## 4. Cautions
- Private business: no logo, no real signage text, no staff or owners as characters, nothing implying endorsement. Title screen: "A made-up raccoon caper at a real Hot Springs landmark. Not affiliated with the farm."
- Hours and prices are unverified for 2026 and never shown.
- No animal harm beyond a cartoon chomp, splash and respawn; the tombstone is scenery only.
- Original game: no names, layouts or assets from commercial lane-crossing games.

## 5. Gaps (designed around)
- No source describes today's paths, fences, colours or signs, so all layouts are fictional and labelled "farm layout imagined for the game".
- The current animal list beyond EoA is unknown; petting-pen animals are background only.
