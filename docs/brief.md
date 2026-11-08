# Kids' Puzzle App: Project Brief

Read this whole file before doing anything. It is the source of truth for decisions on this project. When a decision changes, update `docs/decisions.md` in the repo and note why.

## What we are building

A daily puzzle app for an early reader, played on a parent's phone. Each day serves a short set (5 to 10 minutes) mixing simple word games with puzzles from an existing printed puzzle-pack project. Word games are inspired by the mechanics of popular daily word games but use original names, original visuals, and 3 to 4 letter words at an early-reader level. A streak counter rewards coming back each day.

Success test for Phase 1: the player comes back to it twice without being asked.

## Who is working on this

The project owner is new to Git and GitHub and is using this project to learn the professional workflow. Claude Code writes the code. The owner reviews and merges. That means:

- Explain each change in plain language before and after making it. Name the Git or GitHub concept being used (commit, branch, pull request, etc.) and what it does, in one or two sentences.
- Keep changes small. One pull request does one thing.
- Ask before adding any dependency, tool, or service.

## Locked decisions

| Area | Decision | Reason |
|---|---|---|
| Platform | Web app, installable to the phone home screen (PWA, Phase 3) | No App Store; works on iPhone and Android |
| Code | Plain HTML, CSS, JavaScript ES modules. No framework, no build step | Every file stays readable for a beginner |
| Hosting | GitHub Pages, deployed from `main` | Free, built into GitHub |
| Repo | Public, named `kids-puzzles` | Free Pages requires public. Nothing sensitive goes in |
| Daily puzzles | Generated in the browser from today's date as a seed. Same date, same puzzles | No server, no database |
| Progress | Stored in the browser's localStorage on the phone | One player, no accounts |
| Difficulty | Hand-curated word lists by level in `data/words/` | Difficulty lives in data, not code |
| Game modules | Each game is one file exporting `generate(seed)`, `check(state, answer)`, `verify(puzzle)`, and `render(container, puzzle, onDone)` | Adding a game means adding a file |
| Testing | Node's built-in test runner (`node --test`), no test libraries. GitHub Actions runs tests on every pull request (Phase 2) | Catch bad puzzles before they ship |
| Privacy | No analytics, no ads, no external network requests, no links out of the app, no child names anywhere in the repo | A child holds this phone |

## Phone-first design rules

- Portrait layout designed for a phone screen first. Tap targets at least 48px.
- Word games use a custom on-screen letter keyboard, not the system keyboard.
- Feedback uses color plus shape or icon, not color alone.
- Use original names and colors. Do not use names, logos, or color schemes from existing commercial games.
- No timers or penalties. Encouraging messages, one celebration at the end of the daily set.
- Defer crosswords (too small on a phone). Mazes work well with finger tracing.

## Repo layout

```
kids-puzzles/
  index.html          home screen: today's set, streak
  styles.css
  src/
    app.js            daily set, streak, navigation
    seed.js           date -> repeatable random numbers
    games/
      word-guess.js   guess a 3-4 letter word in 6 tries
      letter-wheel.js make words from 5-7 letters around a center letter
      tile-match.js   match pairs of tiles
      maze.js         single-solution maze, finger tracing
  data/words/         curated lists by level (JSON)
  tests/              one test file per game, plus seed tests
  docs/decisions.md   decisions log
  CLAUDE.md           working rules for Claude Code
  README.md
```

## Phases

| Phase | Build | Learn |
|---|---|---|
| 0 | Repo, README, CLAUDE.md, docs/decisions.md, "Hello" page live on GitHub Pages | Repo, commit, push, deploy |
| 1 | `seed.js` + `word-guess.js` + a level-1 word list, playable on the phone | Branch, pull request, local preview |
| 2 | Daily set screen, streak, letter-wheel and tile-match, GitHub Actions tests | Automated checks, reviewing diffs |
| 3 | Offline support and home-screen icon (PWA), maze port | Service workers, refactoring |

Gate: after Phase 1, the owner watches a real play session before Phase 2 starts. Update the plan based on what is observed.

## Phase 0 task list (do this now)

Prerequisites the owner has completed: `gh auth login` done, Git identity set.

1. Confirm `git`, `gh`, and `node` are installed and `gh auth status` shows a logged-in account. If anything is missing, stop and explain how to install it with Homebrew.
2. Create `~/Desktop/Claude/40 Code/kids-puzzles`. (The Desktop does not sync to iCloud; the owner confirmed this. Never place repos in cloud-synced folders.) `git init` with `main` as the default branch. Shared rules for all coding projects are in `../CLAUDE.md`.
3. Create:
   - `README.md`: one paragraph on what the app is, how to preview locally (`python3 -m http.server 8000`, then open http://localhost:8000), and the live URL.
   - `CLAUDE.md`: the "Who is working on this", "Locked decisions", "Phone-first design rules", and "Privacy" content from this brief, condensed into working rules. Add: after Phase 0, never commit directly to `main`; always use a branch and a pull request.
   - `docs/decisions.md`: the locked decisions table, each with a date (today) and the reason.
   - `index.html` + `styles.css`: a phone-friendly "Hello, puzzles coming soon" page.
   - `.gitignore`: `.DS_Store`, `node_modules/`.
   - `docs/brief.md`: a copy of this brief, so work started from any device (including cloud sessions from a phone) has the full plan. From then on, the repo copy is the source of truth.
4. Make the first commit. Explain what a commit is.
5. Create the public GitHub repo with `gh repo create kids-puzzles --public --source=. --push`. Explain what a remote and a push are.
6. Turn on GitHub Pages from the `main` branch root (use `gh api`). Wait for the deploy and give the owner the live URL to open on the phone.
7. Finish with a short recap: what exists now, the three Git concepts used, and what Phase 1 will teach.
