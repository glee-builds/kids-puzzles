# kids-puzzles: working rules for Claude Code

Shared rules for all coding projects are in `../CLAUDE.md`. This file adds the rules for this project. The full decision history is in `docs/decisions.md`; when a decision changes, update that file and note why.

## Working with the owner

- The owner is learning Git and GitHub through this project. Claude writes the code; the owner reviews and merges.
- Explain each change in plain language before and after making it. Name the Git or GitHub concept being used (commit, branch, pull request, merge) and what it does in one or two sentences.
- Keep changes small. One pull request does one thing.
- Ask before adding any dependency, tool, or service.
- **Never commit directly to `main`.** Phase 0 (the first commit) was the only exception. All work goes on a branch and reaches `main` through a pull request that the owner merges.

## Locked decisions

- **Platform:** web app, installable to the phone home screen as a PWA. It works offline: `sw.js` (the service worker) saves every file and uses the newest copy whenever the phone is online. No App Store.
- **Code:** plain HTML, CSS, and JavaScript ES modules. No framework, no build step, no npm packages. Every file must stay readable for a beginner.
- **Hosting:** GitHub Pages, deployed from the root of `main`.
- **Repo:** public, named `kids-puzzles`. Nothing sensitive goes in it.
- **Daily puzzles:** generated in the browser using today's date as a seed (`src/seed.js`). Same date, same puzzles. No server, no database.
- **Progress:** stored in the browser's `localStorage`. One player, no accounts.
- **Difficulty:** lives in data, not code. Hand-curated word lists by level in `data/words/` (JSON).
- **Game modules:** each game is one file in `src/games/` that exports:
  - `generate(seed, words)`: build a puzzle (word games get their word list passed in)
  - `check(state, answer)`: judge a move or answer
  - `verify(puzzle)`: confirm a puzzle is valid and solvable
  - `render(container, puzzle, onDone)`: draw it and call `onDone` when finished

  Adding a game means adding its file, its card on the home screen in `index.html`, and one line in the `GAMES` list in `src/app.js` (title, legend, and the data it needs). The game's screen is built from that line. Add any new file (game, data, image) to `FILES` in `sw.js` too, so it works offline; `tests/offline.test.js` fails if one is missing.
- **Testing:** Node's built-in test runner (`node --test`), no test libraries. One test file per game in `tests/`, plus seed tests. GitHub Actions runs the tests on every pull request and after each merge (`.github/workflows/tests.yml`); check that the pull request shows a green check before merging.

## Phone-first design rules

- Portrait layout, designed for a phone screen first. Tap targets at least 48px.
- Word games use a custom on-screen letter keyboard, never the system keyboard.
- Feedback uses color plus a shape or icon, never color alone.
- Use original names, visuals, and colors. Do not use names, logos, or color schemes from existing commercial games.
- Word games are aimed at about a 2nd to 3rd grade reading level (changed 2026-11-08; see `docs/decisions.md`). Mystery Word uses 5-letter words from `data/words/level-3.json`; Letter Scramble still uses the 3 to 4 letter lists.
- No timers and no penalties. Use encouraging messages and one celebration at the end of the daily set.
- No crosswords for now (too small on a phone). Mazes use finger tracing.

## Privacy (a child holds this phone)

- No analytics, no ads, no tracking.
- No external network requests: no CDNs, web fonts, or third-party scripts. Everything is served from this repo.
- No links out of the app.
- No child names anywhere in the repo, including code, comments, commit messages, and docs.

## Repo layout

```
index.html          home screen: the game cards, streak
styles.css
src/app.js          the GAMES list, game screens, streak, navigation
src/seed.js         date -> repeatable random numbers
src/games/          one file per game
src/ui.js           screen helpers the games share (buttons, tracing, drag-or-tap)
sw.js               service worker: offline play, newest files when online
data/words/         curated word lists by level (JSON)
tests/              one test file per game, plus seed tests; helpers.js has
                    everyDay, which checks every day for two years
docs/decisions.md   decisions log
.github/workflows/  GitHub Actions: runs the tests on every pull request
```

## Preview locally

`python3 -m http.server 8000`, then open http://localhost:8000.
