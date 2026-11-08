# Decisions log

Every project decision, when it was made, and why. When a decision changes, don't delete the old row: mark it as replaced and add a new row explaining what changed and why.

| Date | Area | Decision | Reason |
|---|---|---|---|
| 2026-11-07 | Platform | Web app, installable to the phone home screen (PWA, Phase 3) | No App Store; works on iPhone and Android |
| 2026-11-07 | Code | Plain HTML, CSS, JavaScript ES modules. No framework, no build step | Every file stays readable for a beginner |
| 2026-11-07 | Hosting | GitHub Pages, deployed from `main` | Free, built into GitHub |
| 2026-11-07 | Repo | Public, named `kids-puzzles` | Free Pages requires public. Nothing sensitive goes in |
| 2026-11-07 | Daily puzzles | Generated in the browser from today's date as a seed. Same date, same puzzles | No server, no database |
| 2026-11-07 | Progress | Stored in the browser's localStorage on the phone | One player, no accounts |
| 2026-11-07 | Difficulty | Hand-curated word lists by level in `data/words/` | Difficulty lives in data, not code |
| 2026-11-07 | Game modules | Each game is one file exporting `generate(seed)`, `check(state, answer)`, `verify(puzzle)`, and `render(container, puzzle, onDone)` | Adding a game means adding a file |
| 2026-11-07 | Testing | Node's built-in test runner (`node --test`), no test libraries. GitHub Actions runs tests on every pull request (Phase 2) | Catch bad puzzles before they ship |
| 2026-11-07 | Privacy | No analytics, no ads, no external network requests, no links out of the app, no child names anywhere in the repo | A child holds this phone |
| 2026-11-07 | Workflow | After the first commit, never commit directly to `main`; every change goes through a branch and a pull request | Teaches the professional workflow and gives the owner a review step before anything goes live |
| 2026-11-08 | Game modules | `generate(seed, words)`: the page loads the word list once and passes it in, instead of each game loading files itself. Replaces `generate(seed)` above for word games | Keeps game files simple and testable in Node without a browser |
| 2026-11-08 | Word guess | Any letters of the right length count as a guess; there is no "not a real word" rejection. After 6 tries the word is shown kindly | A short answer list would wrongly reject real words a child knows; rejection discourages early readers |
