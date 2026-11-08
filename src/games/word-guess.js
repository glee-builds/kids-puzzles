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
