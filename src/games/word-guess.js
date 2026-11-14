// word-guess.js: guess a short word in 6 tries.
//
// After each guess, every letter gets a mark:
//   'here'      right letter, right spot
//   'elsewhere' the letter is in the word, but in a different spot
//   'none'      the letter is not in the word (or is already used up)
//
// This file holds the game's rules only. The screen comes later, in render().

import { dealForDay } from '../seed.js';
import { make, button, liveMessage, letterKeyboard } from '../ui.js';

export const MAX_GUESSES = 6;

/**
 * Make today's puzzle. `seed` comes from seed.js, and `words` is a flat
 * list of possible answers (for example, every word in level-1.json).
 */
// The word is dealt from a deck, one a day, so no word repeats until the
// whole list has been used. (The seed isn't needed; every game's generate
// takes one so they all work the same way.)
export function generate(seed, words, dayNumber, sentences = []) {
  const [answer] = dealForDay(words, 1, dayNumber, 'word-guess');
  // A sentence with a blank where the word goes, if there is one for this
  // word (from data/spelling.json). It's shown after a few wrong guesses.
  const sentence = sentences.find((entry) => entry.word === answer)?.sentence || null;
  return { answer, length: answer.length, maxGuesses: MAX_GUESSES, sentence };
}

export const GUESSES_BEFORE_SENTENCE = 3;

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

  if (typeof answer !== 'string' || !/^[a-z]{3,5}$/.test(answer)) {
    problems.push(`answer "${answer}" must be 3 to 5 lowercase letters`);
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

const MARK_WORDS = {
  here: 'right spot',
  elsewhere: 'in the word, different spot',
  none: 'not in the word',
};

// A mark that is better wins when coloring a keyboard key.
const MARK_RANK = { none: 1, elsewhere: 2, here: 3 };

const CHEERS = ['Good try!', 'Nice thinking!', 'Keep going!', 'Getting closer!', 'You can do it!'];

/**
 * Draw the game inside `container`. Calls
 * onDone({ status, misses, helped, guesses }) once, when the word is found
 * or revealed. misses is the wrong guesses; helped is 1 if the word had to
 * be shown, else 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let typed = '';
  const newGuesses = []; // the guesses made since the puzzle was opened (for saving a half-done puzzle)

  container.replaceChildren();
  container.classList.add('wg');

  // The color key: what each tile color (and mark) means.
  const legend = make('p', 'legend');
  for (const [mark, meaning] of [['here', 'right spot'], ['elsewhere', 'other spot'], ['none', 'not in word']]) {
    const swatch = make('span', `swatch mark-${mark}`);
    swatch.setAttribute('aria-hidden', 'true');
    const item = make('span', 'legend-item');
    item.append(swatch, meaning);
    legend.append(item);
  }

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

  const message = liveMessage('wg-message', `Find the ${puzzle.length}-letter mystery word!`);

  const { node: keyboard, keys, stop: stopKeys } = letterKeyboard(container, { onLetter: typeLetter, onErase: eraseLetter, onGo: submitGuess });

  container.append(legend, board, message, keyboard);

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
    session.save?.({ guesses: [...(session.saved?.guesses || []), ...newGuesses, typed] });
    newGuesses.push(typed);
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
    // After 3 wrong guesses, a sentence that the word fits takes the place
    // of the color key (by now the colors are familiar).
    if (state.guesses.length === GUESSES_BEFORE_SENTENCE) showSentence();
  }

  function showSentence() {
    if (state.status !== 'playing' || !puzzle.sentence) return;
    legend.className = 'wg-sentence';
    legend.textContent = `Clue: ${puzzle.sentence}`;
  }

  function finish() {
    stopKeys();
    container.classList.add('finished');
    const won = state.status === 'won';
    const guesses = state.guesses.length;
    onDone({ status: state.status, misses: won ? guesses - 1 : guesses, helped: won ? 0 : 1, guesses });
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


  // Pick up a half-done puzzle: make its saved guesses again, in order.
  // (A finished puzzle is never saved, so this always leaves it still in play.)
  for (const guess of session.saved?.guesses || []) {
    if (state.status === 'playing') state = check(state, guess);
  }
  if (state.guesses.length >= GUESSES_BEFORE_SENTENCE) showSentence();
  if (state.guesses.length) message.textContent = 'Welcome back! Keep going.';
  draw();
}
