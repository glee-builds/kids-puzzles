// word-search.js: find hidden words in a grid of letters.
//
// Each day has one theme from data/search-themes.json (dealt in a fixed
// shuffled order, so none repeats until all have been used) and 10 of its
// words, hidden in a 15x15 grid. Words run across (left to right) or down
// (top to bottom). The player traces a word with a finger, in either
// direction. Found words turn teal in the grid and get a check in the list.
//
// The other squares are filled with letters from the day's words. A grid
// is only used if every word appears exactly once, and if the filler
// doesn't spell anything from SKIP by accident.

import { createRandom, hashString } from '../seed.js';
import { make, button, liveMessage, trace } from '../ui.js';

export const SIZE = 15;
export const WORDS_PER_DAY = 10;
export const MIN_WORD = 3;
export const MAX_WORD = 8;

// Words to place: across (row stays, column grows) or down.
const PLACE = [[0, 1], [1, 0]];
// Every straight line in the grid, for checking what can be read in it.
const LINES = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
// Words the random filler must not spell, in any direction.
const SKIP = ['ass', 'butt', 'crap', 'damn', 'dumb', 'fart', 'hell', 'kill', 'poop', 'sexy', 'shit', 'fuck', 'piss', 'dead', 'die', 'gun', 'hate', 'ugly', 'fat'];

const key = (r, c) => `${r}-${c}`;
const reverse = (text) => [...text].reverse().join('');

/** The theme for a day number (days since a fixed start date). */
export function themeForDay(themes, dayNumber) {
  const order = createRandom(hashString('word-search-deck')).shuffle(themes.map((_, i) => i));
  const n = order.length;
  return themes[order[((dayNumber % n) + n) % n]];
}

/** Every place `word` can be read along a straight line, as lists of cells. */
function findAll(grid, word, directions) {
  const spots = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      for (const [dr, dc] of directions) {
        const cells = [];
        for (let i = 0; i < word.length; i++) {
          const rr = r + dr * i;
          const cc = c + dc * i;
          if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || grid[rr][cc] !== word[i]) break;
          cells.push([rr, cc]);
        }
        if (cells.length === word.length) spots.push(cells);
      }
    }
  }
  return spots;
}

/** How many different sets of squares spell `word` across, down, or backward. */
function countSpots(grid, word) {
  const seen = new Set();
  for (const cells of findAll(grid, word, LINES.slice(0, 4))) {
    seen.add(cells.map(([r, c]) => key(r, c)).sort().join(' '));
  }
  return seen.size;
}

/** True if one word is inside the other, either way round ("star" in "starfish"). */
const overlaps = (a, b) => a.includes(b) || b.includes(a) || a.includes(reverse(b)) || b.includes(reverse(a));

/** Try to hide the words in an empty grid. Returns { grid, placed } or null. */
function layOut(random, words) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const placed = [];
  for (const word of words) {
    let done = false;
    for (let attempt = 0; attempt < 200 && !done; attempt++) {
      const [dr, dc] = random.pick(PLACE);
      const r = random.int(0, SIZE - 1 - dr * (word.length - 1));
      const c = random.int(0, SIZE - 1 - dc * (word.length - 1));
      const cells = [...word].map((_, i) => [r + dr * i, c + dc * i]);
      if (cells.every(([rr, cc], i) => grid[rr][cc] === null || grid[rr][cc] === word[i])) {
        cells.forEach(([rr, cc], i) => { grid[rr][cc] = word[i]; });
        placed.push({ word, cells });
        done = true;
      }
    }
    if (!done) return null;
  }
  return { grid, placed };
}

/** Make today's puzzle from a seed, the themes, and the day number. */
export function generate(seed, themes, dayNumber) {
  const random = createRandom(seed);
  const theme = themeForDay(themes, dayNumber);

  for (let round = 0; round < 100; round++) {
    // Pick 10 words, none hiding inside another.
    const words = [];
    for (const word of random.shuffle(theme.words)) {
      if (words.length < WORDS_PER_DAY && !words.some((w) => overlaps(w, word))) words.push(word);
    }
    // Longest first: they are the hardest to fit.
    const layout = layOut(random, [...words].sort((a, b) => b.length - a.length));
    if (!layout) continue;

    const letters = words.join('');
    for (let fill = 0; fill < 20; fill++) {
      const grid = layout.grid.map((row) => row.map((ch) => ch ?? random.pick(letters)));
      const puzzle = { theme: theme.name, words, grid, placed: layout.placed };
      if (verify(puzzle).ok) return puzzle;
    }
  }
  throw new Error(`Could not make a word search for ${theme.name}`);
}

/** Confirm a puzzle is valid: every word hidden exactly once, nothing unkind. */
export function verify(puzzle) {
  const problems = [];
  const { words, grid, placed } = puzzle;
  if (words.length !== WORDS_PER_DAY) problems.push(`there must be ${WORDS_PER_DAY} words`);
  if (grid.length !== SIZE || grid.some((row) => row.length !== SIZE)) problems.push(`grid must be ${SIZE}x${SIZE}`);
  if (grid.flat().some((ch) => !/^[a-z]$/.test(ch ?? ''))) problems.push('every square needs a letter');
  for (const word of words) {
    if (word.length < MIN_WORD || word.length > MAX_WORD) problems.push(`${word} is not ${MIN_WORD} to ${MAX_WORD} letters`);
    if (!placed.some((p) => p.word === word)) problems.push(`${word} was not placed`);
    const count = countSpots(grid, word);
    if (count !== 1) problems.push(`${word} appears ${count} times`);
  }
  // A SKIP word inside a hidden word is fine ("hell" in "shell"); one the
  // filler made is not.
  const inOneWord = (spot) => placed.some((p) => {
    const mine = new Set(p.cells.map(([r, c]) => key(r, c)));
    return spot.every(([r, c]) => mine.has(key(r, c)));
  });
  for (const bad of SKIP) {
    if (findAll(grid, bad, LINES).some((spot) => !inOneWord(spot))) problems.push(`the filler spells ${bad}`);
  }
  return { ok: problems.length === 0, problems };
}

/** The starting state: nothing found yet. */
export function start(puzzle) {
  return { puzzle, found: [], hints: 0, hinted: null, status: 'playing', last: null };
}

/** The squares along a straight line from `from` toward `to` (across or down only). */
export function lineBetween(from, to) {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  const across = Math.abs(dc) >= Math.abs(dr);
  const length = (across ? Math.abs(dc) : Math.abs(dr)) + 1;
  const step = Math.sign(across ? dc : dr);
  return Array.from({ length }, (_, i) => (across ? [from[0], from[1] + step * i] : [from[0] + step * i, from[1]]));
}

/**
 * The player traced `cells`. Returns the new state; state.last.result:
 *   'found'  the letters spell a word not found yet (either direction)
 *   'again'  a word already found
 *   'miss'   not a word in the list
 */
export function check(state, cells) {
  if (state.status !== 'playing') return state;
  const { puzzle } = state;
  const letters = cells.map(([r, c]) => puzzle.grid[r][c]).join('');
  const word = puzzle.words.find((w) => w === letters || w === reverse(letters));
  if (!word || cells.length < MIN_WORD) return { ...state, last: { result: 'miss', letters } };
  if (state.found.includes(word)) return { ...state, last: { result: 'again', word } };
  const found = [...state.found, word];
  const won = found.length === puzzle.words.length;
  return {
    ...state,
    found,
    hinted: state.hinted === word ? null : state.hinted,
    status: won ? 'won' : 'playing',
    last: { result: 'found', word },
  };
}

/**
 * A hint: the first word in the list that isn't found yet. The first hint
 * for a word lights its first letter; the next lights the whole word.
 * Returns { state, word, cells }.
 */
export function hint(state) {
  if (state.status !== 'playing') return { state, word: null, cells: [] };
  const word = state.puzzle.words.find((w) => !state.found.includes(w));
  const { cells } = state.puzzle.placed.find((p) => p.word === word);
  const again = state.hinted === word;
  return {
    state: { ...state, hints: state.hints + 1, hinted: word },
    word,
    cells: again ? cells : [cells[0]],
  };
}

// ---------------------------------------------------------------------------
// The screen: the theme, the letter grid, the word list, and a Hint button.
// Trace across or down with a finger; the trace snaps to a straight line.
// ---------------------------------------------------------------------------

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let anchor = null;   // the square the trace started on
  let picked = [];     // squares in the current trace
  let glow = [];       // squares lit by a hint

  container.replaceChildren();
  container.classList.add('ws');

  const title = make('h2', 'ws-theme', puzzle.theme);
  const message = liveMessage('ws-message', 'Trace a word across or down.');

  const grid = make('div', 'ws-grid');
  const cells = puzzle.grid.map((row, r) => row.map((ch, c) => {
    const cell = make('div', 'ws-cell', ch.toUpperCase());
    cell.dataset.r = r;
    cell.dataset.c = c;
    grid.append(cell);
    return cell;
  }));

  const list = make('ul', 'ws-words');
  const items = Object.fromEntries(puzzle.words.map((word) => {
    const li = make('li', 'ws-word', word.toUpperCase());
    list.append(li);
    return [word, li];
  }));

  const hintButton = button('lw-button hint-button', 'Hint', () => {
    const result = hint(state);
    if (!result.word) return;
    state = result.state;
    glow = result.cells;
    message.textContent = result.cells.length === 1
      ? `Look for ${result.word.toUpperCase()}. It starts at the glowing letter.`
      : `${result.word.toUpperCase()} is glowing. Trace it!`;
    draw();
  });

  container.append(title, message, grid, list, hintButton);

  trace(grid, {
    onStart(square) {
      if (state.status !== 'playing') return false;
      anchor = square;
      return true;
    },
    onMove(square) {
      picked = lineBetween(anchor, square);
      draw();
    },
    onEnd: finishTrace,
  });

  function finishTrace() {
    if (!anchor) return;
    const traced = picked;
    anchor = null;
    picked = [];
    if (traced.length > 1) {
      state = check(state, traced);
      const { result } = state.last;
      if (result === 'found') {
        if (!state.hinted) glow = []; // the hinted word was found
        message.textContent = state.status === 'won'
          ? 'You found every word!'
          : `You found ${state.last.word.toUpperCase()}! ${puzzle.words.length - state.found.length} to go.`;
      } else if (result === 'again') {
        message.textContent = `You already found ${state.last.word.toUpperCase()}.`;
      } else {
        message.textContent = 'Not one of the words. Keep looking!';
      }
    }
    draw();
    if (state.status === 'won') {
      container.classList.add('finished');
      onDone({ status: state.status });
    }
  }

  function draw() {
    const foundCells = new Set();
    for (const word of state.found) {
      for (const [r, c] of puzzle.placed.find((p) => p.word === word).cells) foundCells.add(key(r, c));
    }
    const pickedCells = new Set(picked.map(([r, c]) => key(r, c)));
    const glowCells = new Set(glow.map(([r, c]) => key(r, c)));
    cells.forEach((row, r) => row.forEach((cell, c) => {
      cell.classList.toggle('ws-found', foundCells.has(key(r, c)));
      cell.classList.toggle('ws-pick', pickedCells.has(key(r, c)));
      cell.classList.toggle('ws-glow', glowCells.has(key(r, c)));
    }));
    for (const [word, li] of Object.entries(items)) {
      const done = state.found.includes(word);
      li.classList.toggle('ws-word-found', done);
      li.setAttribute('aria-label', done ? `${word}, found` : word);
    }
    hintButton.disabled = state.status !== 'playing';
  }

  draw();
}
