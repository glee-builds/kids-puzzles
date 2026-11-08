// word-guess.js: guess a short word in 6 tries.
//
// After each guess, every letter gets a mark:
//   'here'      right letter, right spot
//   'elsewhere' the letter is in the word, but in a different spot
//   'none'      the letter is not in the word (or is already used up)
//
// This file holds the game's rules only. The screen comes later, in render().

import { createRandom } from '../seed.js';

export const MAX_GUESSES = 6;

/**
 * Make today's puzzle. `seed` comes from seed.js, and `words` is a flat
 * list of possible answers (for example, every word in level-1.json).
 */
export function generate(seed, words) {
  const answer = createRandom(seed).pick(words);
  return { answer, length: answer.length, maxGuesses: MAX_GUESSES };
}

/** The starting state for a puzzle: no guesses yet. */
export function start(puzzle) {
  return { puzzle, guesses: [], status: 'playing' };
}

/**
 * Mark each letter of a guess against the answer.
 * Handles repeated letters fairly: if the answer has one "m" and the guess
 * has two, only one of them gets a 'here' or 'elsewhere' mark.
 */
export function markGuess(guess, answer) {
  const marks = Array(guess.length).fill('none');
  const leftover = {};

  // First pass: letters in exactly the right spot.
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = 'here';
    } else {
      leftover[answer[i]] = (leftover[answer[i]] || 0) + 1;
    }
  }

  // Second pass: right letter, wrong spot, while that letter is still unused.
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] !== 'here' && leftover[guess[i]] > 0) {
      marks[i] = 'elsewhere';
      leftover[guess[i]] -= 1;
    }
  }

  return marks;
}

/**
 * Take one guess and return the new state. The old state is not changed.
 * status becomes 'won' when the word is found, or 'revealed' after the
 * last try (the screen then shows the word kindly; there is no penalty).
 * Any letters count as a guess; there is no "not a word" rejection.
 */
export function check(state, guess) {
  if (state.status !== 'playing') {
    throw new Error('This puzzle is already finished.');
  }
  const word = String(guess).toLowerCase();
  if (word.length !== state.puzzle.length || !/^[a-z]+$/.test(word)) {
    throw new Error(`A guess must be ${state.puzzle.length} letters.`);
  }

  const marks = markGuess(word, state.puzzle.answer);
  const guesses = [...state.guesses, { word, marks }];

  let status = 'playing';
  if (word === state.puzzle.answer) {
    status = 'won';
  } else if (guesses.length >= state.puzzle.maxGuesses) {
    status = 'revealed';
  }

  return { ...state, guesses, status };
}

/**
 * Confirm a puzzle is valid and can be solved. Returns { ok, problems }.
 * Used by the tests to check every word in every list.
 */
export function verify(puzzle) {
  const problems = [];
  const { answer, length, maxGuesses } = puzzle;

  if (typeof answer !== 'string' || !/^[a-z]{3,4}$/.test(answer)) {
    problems.push(`answer "${answer}" must be 3 or 4 lowercase letters`);
  } else if (length !== answer.length) {
    problems.push(`length ${length} does not match answer "${answer}"`);
  }
  if (maxGuesses !== MAX_GUESSES) {
    problems.push(`maxGuesses should be ${MAX_GUESSES}, got ${maxGuesses}`);
  }

  // Solvable: guessing the answer must win on the first try.
  if (problems.length === 0) {
    const result = check(start(puzzle), answer);
    if (result.status !== 'won') {
      problems.push(`guessing "${answer}" did not win`);
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * A clue for the last try. After the second-to-last guess (the 5th of 6),
 * if the word isn't found yet, show the word with one letter missing, for
 * example ['m', 'e', null, 't'] for "melt".
 *
 * The missing letter is one the player has not yet found in the right spot,
 * so there is still something to work out. Returns null when there is no clue.
 */
export function clue(state) {
  const { answer, maxGuesses } = state.puzzle;
  if (state.status !== 'playing' || state.guesses.length !== maxGuesses - 1) {
    return null;
  }

  const found = new Set();
  for (const guess of state.guesses) {
    guess.marks.forEach((mark, i) => {
      if (mark === 'here') found.add(i);
    });
  }

  const notFound = [...answer].map((_, i) => i).filter((i) => !found.has(i));
  // Every spot was found in some guess: hide the last letter anyway, so the
  // clue still asks for one letter.
  const hidden = notFound.length > 0 ? notFound[0] : answer.length - 1;

  return [...answer].map((letter, i) => (i === hidden ? null : letter));
}

// ---------------------------------------------------------------------------
// The screen: board, message line, and on-screen ABC keyboard.
// ---------------------------------------------------------------------------

// QWERTY rows, like a phone or computer keyboard. The bottom row also
// holds Go (left) and Erase (right).
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const MARK_WORDS = {
  here: 'right spot',
  elsewhere: 'in the word, different spot',
  none: 'not in the word',
};

// A mark that is better wins when coloring a keyboard key.
const MARK_RANK = { none: 1, elsewhere: 2, here: 3 };

const CHEERS = ['Good try!', 'Nice thinking!', 'Keep going!', 'Getting closer!', 'You can do it!'];

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, guesses })
 * once, when the word is found or revealed.
 */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let typed = '';

  container.replaceChildren();
  container.classList.add('wg');

  // Board: one row per try, one tile per letter.
  const board = make('div', 'wg-board');
  board.style.setProperty('--letters', puzzle.length);
  const tiles = [];
  for (let r = 0; r < puzzle.maxGuesses; r++) {
    const row = make('div', 'wg-row');
    const rowTiles = [];
    for (let c = 0; c < puzzle.length; c++) {
      const tile = make('div', 'wg-tile');
      row.append(tile);
      rowTiles.push(tile);
    }
    board.append(row);
    tiles.push(rowTiles);
  }

  const message = make('p', 'wg-message', `Find the ${puzzle.length}-letter mystery word!`);
  message.setAttribute('aria-live', 'polite');

  // Keyboard.
  const keyboard = make('div', 'wg-keyboard');
  const keys = {};
  function addKey(row, label, onTap, extraClass = '') {
    const key = make('button', `wg-key ${extraClass}`.trim(), label);
    key.type = 'button';
    key.addEventListener('click', onTap);
    row.append(key);
    return key;
  }
  KEY_ROWS.forEach((letters, index) => {
    const row = make('div', 'wg-key-row');
    const isBottom = index === KEY_ROWS.length - 1;
    if (index === 1) row.classList.add('wg-key-row-middle');
    if (isBottom) {
      const goKey = addKey(row, 'Go', submitGuess, 'wg-key-wide wg-key-go');
      goKey.setAttribute('aria-label', 'Check my word');
    }
    for (const letter of letters) keys[letter] = addKey(row, letter, () => typeLetter(letter));
    if (isBottom) {
      const backKey = addKey(row, '⌫', eraseLetter, 'wg-key-wide');
      backKey.setAttribute('aria-label', 'Erase a letter');
    }
    keyboard.append(row);
  });

  container.append(board, message, keyboard);

  function typeLetter(letter) {
    if (state.status !== 'playing' || typed.length >= puzzle.length) return;
    typed += letter;
    draw();
  }

  function eraseLetter() {
    if (state.status !== 'playing') return;
    typed = typed.slice(0, -1);
    draw();
  }

  function submitGuess() {
    if (state.status !== 'playing') return;
    if (typed.length < puzzle.length) {
      const missing = puzzle.length - typed.length;
      message.textContent = `Add ${missing} more letter${missing === 1 ? '' : 's'}.`;
      return;
    }
    state = check(state, typed);
    typed = '';
    draw();

    if (state.status === 'won') {
      message.textContent = 'You found it!';
      finish();
    } else if (state.status === 'revealed') {
      message.textContent = `The word was ${puzzle.answer.toUpperCase()}. Great trying!`;
      finish();
    } else if (clue(state)) {
      message.textContent = 'Clue: just one letter is missing!';
    } else {
      message.textContent = CHEERS[(state.guesses.length - 1) % CHEERS.length];
    }
  }

  function finish() {
    document.removeEventListener('keydown', onKeydown);
    container.classList.add('wg-finished');
    onDone({ status: state.status, guesses: state.guesses.length });
  }

  function draw() {
    const best = {};
    const hint = clue(state);
    tiles.forEach((rowTiles, r) => {
      const guess = state.guesses[r];
      const isCurrent = !guess && r === state.guesses.length && state.status === 'playing';
      const word = guess ? guess.word : isCurrent ? typed : '';
      rowTiles.forEach((tile, c) => {
        const letter = word[c] || '';
        const mark = guess ? guess.marks[c] : '';
        if (isCurrent && hint && !letter) {
          // Clue row: known letters show faintly; the missing one shows "?".
          tile.textContent = hint[c] || '?';
          tile.className = 'wg-tile wg-tile-clue' + (hint[c] ? '' : ' wg-tile-clue-missing');
          tile.setAttribute('aria-label', hint[c] ? `clue: ${hint[c]}` : 'clue: missing letter');
          return;
        }
        tile.textContent = letter;
        tile.className = 'wg-tile' + (mark ? ` mark-${mark}` : '') + (letter && !mark ? ' wg-tile-typed' : '');
        tile.setAttribute('aria-label', letter ? (mark ? `${letter}, ${MARK_WORDS[mark]}` : letter) : 'empty');
        if (mark && (MARK_RANK[mark] > (MARK_RANK[best[letter]] || 0))) best[letter] = mark;
      });
      tiles[r][0].parentElement.classList.toggle('wg-row-current', isCurrent);
    });
    for (const [letter, key] of Object.entries(keys)) {
      key.className = 'wg-key' + (best[letter] ? ` mark-${best[letter]}` : '');
      key.setAttribute('aria-label', best[letter] ? `${letter}, ${MARK_WORDS[best[letter]]}` : letter);
    }
  }

  // A computer keyboard works too, which helps when testing on a laptop.
  function onKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (/^[a-z]$/i.test(event.key)) typeLetter(event.key.toLowerCase());
    else if (event.key === 'Backspace') eraseLetter();
    else if (event.key === 'Enter') submitGuess();
  }
  document.addEventListener('keydown', onKeydown);

  draw();
}
