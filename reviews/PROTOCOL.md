# Visual review loop: protocol

A scaled-down version of `games/Cart Racing/reviews/PROTOCOL.md` (Hot Springs Games). It keeps that protocol's
blindness and two-model critique, and drops the prosecutor, advocate and A/B coin flip to fit this smaller
2D game.

## Loop N
1. `npm run build`, then `node shared/test-harness/run.mjs . --milestone final`: all tests must be green.
2. `node shared/test-harness/run.mjs . --file review --milestone review-N`, then
   `node shared/test-harness/sheets.mjs . --milestone review-N`. The developer opens every capture.
3. The developer writes `loop-N/CHANGES.md` (facts only: what changed since the last loop).
4. **Blind critics, in parallel:**
   - Critic A: a Claude subagent.
   - Critic B: Codex (GPT-6.1 Sol), via `codex:codex-rescue`.

   Each sees only this loop's sheets and single captures, `RUBRIC.md` and `CHANGES.md`. They never see prior
   scores or the other critic. Each returns JSON: `{scores: {key: n}, gaps: [{category, severity 1-5, capture,
   issue, fix}]}`. Saved as `loop-N/critic-claude.json` and `loop-N/critic-codex.json`.
5. **Judge** (a Claude subagent): sees both critiques, the captures and `HISTORY.md`. It resolves disagreements
   against the captures and writes `loop-N/judge.json`: `{scores, backlog: [top 6 fixes by expected gain ÷ effort]}`.
6. The developer builds the backlog, logs it in `HISTORY.md`, and starts loop N+1.

## Stop rule
Stop when every category meets its gate and a loop brings no new best total, or after two loops with no new best
total, or at loop 5.
