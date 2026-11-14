// word-ladder.js: change one letter at a time to turn one word into another.
//
// Each day has 2 ladders: a 3-letter one (like CAT to DOG, 3 steps) and a
// 4-letter one (4 steps). Start and end differ in every letter, so each
// step changes a letter that needs changing. The player taps the letter to change, then a new letter on the
// keyboard. Every step must be a real word. The ladder shows empty rungs
// for the steps still needed, so the player can see when a move gets
// closer (one less rung) or farther away.
//
// Ladders start and end on the level 1 and 2 phonics words, which the
// player already knows. Steps can use those, the everyday words in
// data/words/ladder.json, and a 3-letter word plus s (CATS), so a real
// word the player makes isn't turned away. Hints prefer phonics words.

import { createRandom } from '../seed.js';
import { make, button, liveMessage, wiggle, progressDots, letterKeyboard } from '../ui.js';

export const LENGTHS = [3, 4];  // one ladder of each, in this order
const ABC = 'abcdefghijklmnopqrstuvwxyz';

/** Every accepted word that differs from `word` in exactly one letter. */
function neighbors(word, accepted) {
  const found = [];
  for (let i = 0; i < word.length; i++) {
    for (const letter of ABC) {
      if (letter === word[i]) continue;
      const next = word.slice(0, i) + letter + word.slice(i + 1);
      if (accepted.has(next)) found.push(next);
    }
  }
  return found;
}

/** Steps from `from` to every word it can reach, as a Map (breadth-first search). */
function distancesFrom(from, accepted) {
  const steps = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const word = queue.shift();
    for (const next of neighbors(word, accepted)) {
      if (!steps.has(next)) {
        steps.set(next, steps.get(word) + 1);
        queue.push(next);
      }
    }
  }
  return steps;
}

/**
 * A shortest ladder from `from` to `to`, or null if there is none. When
 * there is a choice, words in `preferred` come first.
 */
export function shortestLadder(from, to, accepted, preferred = new Set()) {
  const back = distancesFrom(to, accepted);
  if (!back.has(from)) return null;
  const path = [from];
  while (path[path.length - 1] !== to) {
    const here = path[path.length - 1];
    // Any neighbor one step closer: preferred words first, then A to Z,
    // so the choice is always the same.
    const closer = neighbors(here, accepted)
      .filter((w) => back.get(w) === back.get(here) - 1)
      .sort((a, b) => (preferred.has(b) - preferred.has(a)) || a.localeCompare(b));
    path.push(closer[0]);
  }
  return path;
}

/** Steps still needed from `from` to `to` (Infinity if there is no way). */
export function stepsBetween(from, to, accepted) {
  const steps = distancesFrom(to, accepted).get(from);
  return steps === undefined ? Infinity : steps;
}

/** Every word a step may use: both lists, and 3-letter plurals. */
export function acceptedWords(ladderWords, phonicsWords = []) {
  const accepted = new Set([...ladderWords, ...phonicsWords]);
  for (const word of [...accepted]) if (word.length === 3) accepted.add(`${word}s`);
  return accepted;
}

const allDifferent = (a, b) => [...a].every((ch, i) => ch !== b[i]);

/**
 * Make today's two ladders from a seed. `ladderWords` is the list from
 * ladder.json; `phonicsWords` are the level 1 and 2 words, which the
 * ladders start and end on.
 */
export function generate(seed, ladderWords, phonicsWords) {
  const random = createRandom(seed);
  const accepted = acceptedWords(ladderWords, phonicsWords);
  const ladders = LENGTHS.map((length) => {
    const words = phonicsWords.filter((w) => w.length === length);
    for (const start of random.shuffle(words)) {
      const steps = distancesFrom(start, accepted);
      // A step for each letter, and every letter changes.
      const ends = words.filter((w) => steps.get(w) === length && allDifferent(start, w));
      if (ends.length) return { start, end: random.pick(ends), best: length };
    }
    throw new Error(`No ${length}-letter ladder found`);
  });
  return { ladders, ladderWords, phonicsWords };
}

/** Confirm each ladder takes one step per letter. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const accepted = acceptedWords(puzzle.ladderWords, puzzle.phonicsWords);
  const listed = new Set(puzzle.phonicsWords);
  if (puzzle.ladders.length !== LENGTHS.length) problems.push(`there must be ${LENGTHS.length} ladders`);
  puzzle.ladders.forEach(({ start, end, best }, i) => {
    if (start.length !== LENGTHS[i] || end.length !== LENGTHS[i]) problems.push(`ladder ${i + 1} should use ${LENGTHS[i]}-letter words`);
    if (!listed.has(start) || !listed.has(end)) problems.push(`ladder ${i + 1}: ${start} or ${end} is not a phonics word`);
    if (!allDifferent(start, end)) problems.push(`ladder ${i + 1}: ${start} and ${end} share a letter in the same spot`);
    const steps = stepsBetween(start, end, accepted);
    if (steps !== best || best !== start.length) problems.push(`ladder ${i + 1}: ${start} to ${end} takes ${steps} steps, not ${start.length}`);
  });
  return { ok: problems.length === 0, problems };
}

/** The starting state: on the first ladder, at its start word. */
export function start(puzzle) {
  return {
    puzzle,
    accepted: acceptedWords(puzzle.ladderWords, puzzle.phonicsWords),
    preferred: new Set(puzzle.phonicsWords),
    index: 0,
    chain: [puzzle.ladders[0].start],
    solved: [],
    hints: 0,
    hintFor: null,
    status: 'playing',
    last: null,
  };
}

export const current = (state) => state.chain[state.chain.length - 1];
export const ladder = (state) => state.puzzle.ladders[state.index];

/** Steps still needed on the ladder being climbed. */
export const stepsLeft = (state) => stepsBetween(current(state), ladder(state).end, state.accepted);

/**
 * Change the letter at `position` to `letter`. Returns the new state;
 * state.last.result:
 *   'step'     a new word: the ladder grows
 *   'solved'   reached the end word (status is 'won' after the last ladder)
 *   'same'     that letter is already there
 *   'unknown'  not a word in the lists
 *   'used'     a word already on this ladder
 */
export function change(state, position, letter) {
  if (state.status !== 'playing') return state;
  const word = current(state);
  const next = word.slice(0, position) + letter + word.slice(position + 1);
  if (next === word) return { ...state, last: { result: 'same', word } };
  if (!state.accepted.has(next)) return { ...state, last: { result: 'unknown', word: next } };
  if (state.chain.includes(next)) return { ...state, last: { result: 'used', word: next } };

  const chain = [...state.chain, next];
  if (next !== ladder(state).end) {
    return { ...state, chain, hintFor: null, last: { result: 'step', word: next, position } };
  }
  const solved = [...state.solved, chain];
  const index = state.index + 1;
  const won = index >= state.puzzle.ladders.length;
  return {
    ...state,
    solved,
    index: won ? state.index : index,
    chain: won ? chain : [state.puzzle.ladders[index].start],
    hintFor: null,
    status: won ? 'won' : 'playing',
    last: { result: 'solved', word: next, position, chain },
  };
}

/** Go back one step (the start word always stays). */
export function back(state) {
  if (state.status !== 'playing' || state.chain.length < 2) return state;
  return { ...state, chain: state.chain.slice(0, -1), hintFor: null, last: { result: 'back' } };
}

/**
 * A hint, stronger each time for the same word:
 *   1st: which letter to change (returned as `position`)
 *   2nd: makes the move (returned as `word`)
 * From a word with no way to the end, `stuck` is true: go back.
 * Returns { state, position, word, stuck }.
 */
export function hint(state) {
  if (state.status !== 'playing') return { state, position: null, word: null, stuck: false };
  const here = current(state);
  const path = shortestLadder(here, ladder(state).end, state.accepted, state.preferred);
  if (!path) return { state: { ...state, hints: state.hints + 1 }, position: null, word: null, stuck: true };
  const next = path[1];
  const position = [...here].findIndex((ch, i) => ch !== next[i]);
  const counted = { ...state, hints: state.hints + 1 };
  if (state.hintFor !== here) {
    return { state: { ...counted, hintFor: here }, position, word: null, stuck: false };
  }
  return { state: change(counted, position, next[position]), position, word: next, stuck: false };
}

// ---------------------------------------------------------------------------
// The screen: the ladder (start word, steps so far, the word to change,
// empty rungs, and the end word), a message, the letter keyboard, and
// buttons.
// ---------------------------------------------------------------------------

const ORDINALS = ['first', 'second', 'third', 'fourth'];

/** One rung: a word as a row of small letter tiles. `changed` marks the new letter. */
function rung(word, className, changed = -1) {
  const row = make('div', `wl-rung ${className}`.trim());
  [...word].forEach((ch, i) => row.append(make('span', i === changed ? 'wl-tile wl-tile-new' : 'wl-tile', ch)));
  row.setAttribute('aria-label', word);
  return row;
}

const changedAt = (before, after) => [...after].findIndex((ch, i) => ch !== before[i]);

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many letter changes were turned away
 * (not a word, or a word already on the ladder) and helped is how many
 * times Hint was pressed.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let selected = null;  // which letter of the current word is picked
  let reading = false;  // showing a finished ladder before the next one
  let shownIndex = 0;
  let misses = 0; // words turned away, counted across both ladders
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    const { index, chain, solved, hints } = session.saved;
    state = { ...state, index, chain, solved, hints };
    misses = session.saved.misses;
    reading = session.saved.reading;
    shownIndex = reading ? index - 1 : index; // while reading, the ladder just finished is on screen
  }
  const keep = () => {
    if (state.status !== 'playing') return; // a finished puzzle has nothing to pick up
    session.save?.({ index: state.index, chain: state.chain, solved: state.solved, hints: state.hints, misses, reading });
  };

  container.replaceChildren();
  container.classList.add('wl');

  const dots = progressDots(puzzle.ladders.length);
  const goal = make('p', 'wl-goal');
  const rungs = make('div', 'wl-rungs');
  const message = liveMessage('wl-message');

  const { node: keyboard } = letterKeyboard(container, { onLetter: typeLetter }, 'wl-keyboard');

  const buttons = make('div', 'button-row');
  const backButton = button('lw-button', '↩ Back', () => {
    state = back(state);
    selected = null;
    message.textContent = 'Back one step.';
    keep();
    draw();
  });
  const hintButton = button('lw-button', 'Hint', giveHint);
  const nextButton = button('lw-button lw-enter', 'Next ladder →', () => {
    reading = false;
    shownIndex = state.index;
    selected = null;
    message.textContent = intro();
    keep();
    draw();
  });
  buttons.append(backButton, hintButton, nextButton);

  container.append(dots.node, goal, rungs, message, keyboard, buttons);

  const canPlay = () => state.status === 'playing' && !reading;
  const big = (word) => word.toUpperCase();
  function intro() {
    const { start: from, end } = ladder(state);
    return `Change one letter at a time to turn ${big(from)} into ${big(end)}.`;
  }

  function typeLetter(letter) {
    if (!canPlay()) return;
    if (selected === null) {
      message.textContent = 'First tap the letter you want to change.';
      return;
    }
    const before = stepsLeft(state);
    state = change(state, selected, letter);
    const { result, word } = state.last;
    if (result === 'step') {
      selected = null;
      const after = stepsLeft(state);
      message.textContent = after < before
        ? `${big(word)}! ${after === 1 ? 'One more step!' : 'Keep going.'}`
        : after === Infinity
          ? `${big(word)} is a word, but there's no way to the end from it. Tap Back.`
          : `${big(word)} is a word, but it's farther away. Try another, or tap Back.`;
    } else if (result === 'solved') {
      selected = null;
      reading = true;
      message.textContent = state.status === 'won' ? 'You climbed both ladders!' : `You made ${big(word)}!`;
    } else if (result === 'unknown') {
      misses += 1;
      message.textContent = `${big(word)} isn't a word I know. Try another letter.`;
      wiggle(rungs);
    } else if (result === 'used') {
      misses += 1;
      message.textContent = `${big(word)} is already on the ladder. Try another letter.`;
      wiggle(rungs);
    }
    keep();
    draw();
    if (state.status === 'won') {
      container.classList.add('finished');
      onDone({ status: state.status, misses, helped: state.hints });
    }
  }

  function giveHint() {
    if (!canPlay()) return;
    const result = hint(state);
    const before = state;
    state = result.state;
    if (result.stuck) {
      message.textContent = 'There\'s no way to the end from here. Tap Back.';
    } else if (result.word === null) {
      selected = result.position;
      message.textContent = `Change the ${ORDINALS[result.position]} letter.`;
    } else {
      selected = null;
      if (state.last?.result === 'solved') {
        reading = true;
        message.textContent = state.status === 'won' ? 'You climbed both ladders!' : `You made ${big(result.word)}!`;
      } else {
        message.textContent = `${big(current(before))} becomes ${big(result.word)}.`;
      }
    }
    keep();
    draw();
    if (state.status === 'won') {
      container.classList.add('finished');
      onDone({ status: state.status, misses, helped: state.hints });
    }
  }

  function draw() {
    const { start: from, end } = puzzle.ladders[shownIndex];
    goal.textContent = `${big(from)} → ${big(end)}`;
    dots.update((i) => i < state.solved.length, shownIndex);

    rungs.replaceChildren();
    const chain = reading ? state.solved[shownIndex] : state.chain;
    chain.forEach((word, i) => {
      const isCurrent = !reading && i === chain.length - 1;
      if (!isCurrent) {
        const className = i === 0 ? 'wl-rung-start' : i === chain.length - 1 ? 'wl-rung-end' : '';
        rungs.append(rung(word, className, i === 0 ? -1 : changedAt(chain[i - 1], word)));
        return;
      }
      // The word to change: big tiles to tap.
      const row = make('div', 'wl-rung wl-rung-now');
      [...word].forEach((ch, k) => {
        const tile = button('wl-tile wl-tile-big' + (k === selected ? ' wl-tile-picked' : ''), ch);
        tile.setAttribute('aria-label', `${ORDINALS[k]} letter, ${ch}`);
        tile.setAttribute('aria-pressed', String(k === selected));
        tile.addEventListener('click', () => {
          if (!canPlay()) return;
          selected = selected === k ? null : k;
          message.textContent = selected === null ? 'Tap the letter you want to change.' : 'Now tap a new letter on the keyboard.';
          draw();
        });
        row.append(tile);
      });
      rungs.append(row);
    });

    if (!reading) {
      const left = stepsLeft(state);
      const empty = Number.isFinite(left) ? Math.max(0, left - 1) : 0;
      for (let i = 0; i < empty; i++) rungs.append(rung(' '.repeat(end.length), 'wl-rung-empty'));
      if (current(state) !== end) rungs.append(rung(end, 'wl-rung-end'));
    }

    keyboard.hidden = reading || state.status !== 'playing';
    backButton.hidden = reading || state.status !== 'playing';
    hintButton.hidden = reading || state.status !== 'playing';
    backButton.disabled = state.chain.length < 2;
    nextButton.hidden = !(reading && state.status === 'playing');
  }

  message.textContent = reading ? `You made ${big(puzzle.ladders[shownIndex].end)}!` : intro();
  draw();
}
