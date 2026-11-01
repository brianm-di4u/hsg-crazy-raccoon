# Batch 1 image prompts

Tool used: Codex built-in image_gen.imagegen (no API key). One generation per asset; open pairs edited from their closed asset. No regenerations or post-processing.

Pixel size: 1536x1024 PNG for every image, verified from saved files.

Each result was visually inspected after generation for white background, right-facing direction, full uncropped silhouette and absence of text. All passed direction, cropping and text checks. Backgrounds appeared white visually, but subsequent pixel sampling found near-white corners (channels 253-255), so the strict flat #FFFFFF requirement is not met. No background correction or regeneration was performed. Style match is approximate: glossy highlights are stronger than the pilot and proportions/camera are not exact. Far-side legs frequently remain occluded. Only requested assets and this log were written in the art-src folder.

## gator-paddler-closed.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-closed.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Standard friendly-mischievous olive-green paddler alligator, jaws closed, small sly smile.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white background, right-facing, uncropped, no text; pilot-like olive colouring and rounded ridges. Limitations: only two near-side legs clearly visible; silhouette longer than 3.3:1.

## gator-paddler-open.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/gator-paddler-closed.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Edit the attached gator-paddler-closed.png as the SAME character. Preserve body, tail, colour, scale pattern, camera and placement. Hinge upper jaw upward about 35 degrees, pink mouth interior and white teeth, grumpy brows. Keep lower jaw low. Show all four legs if possible.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; pair identity strongly preserved, pink mouth and teeth. Limitations: far legs hidden; brows mildly grumpy.

## gator-whipper-closed.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-closed.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Whipper alligator, same species as pilot but lighter khaki-olive, exactly three bold golden-yellow bands around its tail, tail tip curled upward a little; jaws closed. Small sly smile. Ensure far-side feet are visible beyond body.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; three golden tail bands and raised tip, khaki olive. Limitations: two legs clearly visible; somewhat longer than requested ratio.

## gator-whipper-open.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/gator-whipper-closed.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Edit attached gator-whipper-closed.png into its open pair. Preserve same character, khaki olive colour, exact three golden-yellow tail bands, curled tip, body, camera and placement. Upper jaw hinges upward about 35 degrees revealing pink mouth and white teeth, grumpy brows.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; identity and three bands preserved, open pink mouth. Limitations: far legs hidden; small scale-pattern drift.

## gator-basker-closed.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-closed.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Basker: sunbathing alligator lying flat as if resting, but no ground drawn. Four legs splayed sideways, relaxed half-closed sleepy-smug eyes, dusty sandy olive colour, jaws closed. Body total length 3.3x height. All four feet should peek beyond silhouette.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; sleepy-smug eyes and resting pose. Limitations: colour more golden than dusty sandy; only near legs visible, limited splay, longer silhouette.

## gator-basker-open.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/gator-basker-closed.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Edit attached gator-basker-closed.png as the same basker, preserving colour, body, tail, ridges, camera and placement. Wide relaxed basking gape: hinge upper jaw upward, show pink mouth and white teeth. Eyes now open. Legs splayed sideways in restful pose.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; matching basker with open eyes and wide pink gape. Limitations: golden rather than dusty colour, far legs hidden and limited splay.

## gator-sleeper-closed.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-closed.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Sleeper: shorter stockier alligator, total length about 2.4 times total height, body curled slightly, eyes fully shut, peaceful sleeping expression, faded grey-green colour, jaws closed. Rounded thick torso and gently curved tail. Four feet visible.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; shut eyes, stocky body and curved tail. Limitations: olive rather than faded grey-green, ratio nearer 3.2:1, far legs hidden.

## gator-sleeper-open.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/gator-sleeper-closed.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/gator-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Edit attached gator-sleeper-closed.png into same sleeper awake: wide eyes, lunging forward RIGHT with open jaws, upper jaw hinged up showing pink mouth and white teeth. Preserve same stocky character, colour, ridge design and gently curved tail. Length about 2.4x height. Keep entire character within white canvas.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; same curled tail, awake wide eyes, pink open jaws. Limitations: lunge subtle and reads mostly stationary; olive colour, far legs hidden.

## gator-hatchling.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/hatchling.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Hatchling: tiny very cute baby alligator, oversized head and enormous round eyes, bright lime green. Red rubber band wrapped around its CLOSED snout, clearly encircling upper and lower jaws. Total length about 2.6 times height. Follow attached hatchling block-out proportions, fully painted like pilot. All four short legs visible.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; cute large eyes, lime green, closed snout wrapped in red band. Limitations: three feet visible, fourth hidden; silhouette about 3:1 rather than 2.6:1.

## gator-boss-closed.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/boss-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Boss Old Ruthless: enormous old alligator, darker deep green, very thick powerful body, battle scars on head, heavy scowling brows, a clearly chipped tooth visible at closed jaw edge. Jaws closed. Length about 3 times total height. Match boss block-out mass and camera but mouth closed. Four short legs tucked close, far feet visible. No text naming him.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; thick darker body, scars, scowl and chipped tooth. Limitations: silhouette longer than 3:1; far legs hidden; margins narrow but complete.

## gator-boss-open.png

References attached:
- C:/Video Game Projects/games/Crazy Raccoon/art-src/pilot-keyart.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/gator-boss-closed.png
- C:/Video Game Projects/games/Crazy Raccoon/art-src/ref/boss-open.png

Exact prompt:
```text
Create one 1536x1024 PNG game character asset for Crazy Raccoon: Gator Farm Dash. Match the attached pilot-keyart.png painting style exactly: polished cartoon mobile-game painting, soft top-lit gradients, crisp dark outlines, saturated colours, bumpy ridged alligator back and big round eyes on top of head. Other attached block-out is ONLY camera/pose/proportion reference, never its crude rendering. One single alligator centred, isolated on pure flat #FFFFFF white. No ground, water, background shadow, text, letters, numbers, logos or watermark. Face RIGHT, snout toward right edge. Slightly-above three-quarter side view, 25-30 degrees above horizon. Entire body and whole tail visible with generous white margins; four short legs visible tucked close unless specified otherwise. Long low body, total length about 3.3 times total height unless specified. Lighter cream-green belly band along lower side. Edit attached gator-boss-closed.png into the SAME Old Ruthless boss roaring with jaws wide open. Hinge upper jaw upward, show pink mouth and white teeth including chipped tooth. Preserve deep-green thick body, exact head scars, heavy scowling brows, ridge pattern, tail, camera and placement. Length about 3x height. Full body uncropped.
```

Match / limitations: Background limitation for this image: visually white but sampled corner is near-white, not exact #FFFFFF. Match: visually white, right-facing, uncropped, no text; matching thick scarred boss with scowl, chipped tooth and roaring pink gape. Limitations: scars shift slightly, far legs hidden, narrow right margin.


