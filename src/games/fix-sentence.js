// fix-sentence.js: the frog wrote some sentences, and one word in each is
// wrong. Tap the wrong word, then pick the word that fixes it.
//
// Each day has 4 sentences from data/fix-sentences.json. Mistakes are
// things a 2nd to 3rd grader can catch: "Yesterday I run", "the dogs runs",
// "two/too", "a apple", or a word that doesn't make sense. After the fix,
// a short reason says how you can tell.
//
// The sentences are dealt in a fixed shuffled order, four a day, so none
// repeats until the whole list has been used.

import { createRandom, hashString } from '../seed.js';

export const PER_DAY = 4;
export const FIND_TRIES = 2; // after this many wrong taps the wrong word is shown
export const MAX_SENTENCE = 55; // characters
export const MAX_WHY = 60;

/** The sentences for a day number (days since a fixed start date). */
export function sentencesForDay(items, dayNumber) {
  const order = createRandom(hashString('fix-sentence-deck')).shuffle(items.map((_, i) => i));
  const n = order.length;
  const start = ((dayNumber * PER_DAY) % n + n) % n;
  return Array.from({ length: PER_DAY }, (_, k) => items[order[(start + k) % n]]);
}

export const words = (item) => item.sentence.split(' ');

/** The sentence with the fix in place. */
export function fixedSentence(item) {
  return words(item).map((w, i) => (i === item.wrong ? item.fix : w)).join(' ');
}

/** Problems with one sentence from the list. An empty list means it's fine. */
export function itemProblems(item) {
  const problems = [];
  const { sentence, wrong, fix, options, why } = item;
  if (typeof sentence !== 'string' || sentence.length > MAX_SENTENCE) problems.push(`sentence over ${MAX_SENTENCE} characters`);
  if (!/^[A-Z][^,"]*[.!?]$/.test(sentence || '')) problems.push('sentence needs a capital, an end mark, and no commas or quotes');
  if (/ {2}/.test(sentence)) problems.push('two spaces in a row');
  const list = words(item);
  if (list.length < 5 || list.length > 10) problems.push('sentence must have 5 to 10 words');
  if (!Number.isInteger(wrong) || wrong < 0 || wrong >= list.length) problems.push('wrong is not a word position');
  else if (!/^[A-Za-z]+$/.test(list[wrong])) problems.push('the wrong word must be letters only');
  if (!/^[A-Za-z]+$/.test(fix || '') || fix === list[wrong]) problems.push('fix must be a different word, letters only');
  if (!Array.isArray(options) || options.length !== 3 || new Set(options).size !== 3
    || !options.includes(fix) || options.some((o) => !/^[A-Za-z]+$/.test(o))) {
    problems.push('options must be 3 different words including the fix');
  }
  if (typeof why !== 'string' || why.length > MAX_WHY || !why.endsWith('.')) problems.push(`why must end with a period, ${MAX_WHY} characters at most`);
  return problems;
}

/** Make today's sentences from a seed, the list, and the day number. */
export function generate(seed, items, dayNumber) {
  const random = createRandom(seed);
  return {
    items: sentencesForDay(items, dayNumber).map((item) => ({ ...item, options: random.shuffle(item.options) })),
  };
}

/** Confirm a day is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  if (!Array.isArray(puzzle.items) || puzzle.items.length !== PER_DAY) {
    return { ok: false, problems: [`there must be ${PER_DAY} sentences`] };
  }
  const problems = puzzle.items.flatMap((item, i) => itemProblems(item).map((p) => `sentence ${i + 1}: ${p}`));
  if (new Set(puzzle.items.map((i) => i.sentence)).size !== PER_DAY) problems.push('a sentence repeats');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Playing: find the wrong word, then pick its fix.
// ---------------------------------------------------------------------------

export function start(puzzle, index = 0) {
  return { puzzle, index, phase: 'find', fine: [], findMisses: 0, shown: false, tried: [], status: 'playing', last: null };
}

export const current = (state) => state.puzzle.items[state.index];

/**
 * A move is { tap: wordPosition } while finding, or { pick: word } while
 * fixing. Returns the new state; state.last says what happened.
 */
export function check(state, move) {
  if (state.status !== 'playing') throw new Error('Today\'s sentences are finished.');
  const item = current(state);

  if ('tap' in move) {
    if (state.phase !== 'find') throw new Error('The wrong word is already found.');
    if (move.tap === item.wrong) return { ...state, phase: 'fix', last: { tap: move.tap, correct: true } };
    const findMisses = state.findMisses + 1;
    const shown = findMisses >= FIND_TRIES;
    return {
      ...state,
      phase: shown ? 'fix' : 'find',
      fine: [...state.fine, move.tap],
      findMisses,
      shown,
      last: { tap: move.tap, correct: false, shown },
    };
  }

  if (state.phase !== 'fix') throw new Error('Find the wrong word first.');
  if (!item.options.includes(move.pick) || state.tried.includes(move.pick)) {
    throw new Error(`"${move.pick}" is not a choice now.`);
  }
  if (move.pick === item.fix) return { ...state, phase: 'fixed', last: { pick: move.pick, correct: true } };
  return { ...state, tried: [...state.tried, move.pick], last: { pick: move.pick, correct: false } };
}

/** Move on to the next sentence. The last one finishes the game. */
export function next(state) {
  if (state.phase !== 'fixed') throw new Error('Fix this sentence first.');
  const index = state.index + 1;
  if (index >= state.puzzle.items.length) return { ...state, status: 'won' };
  return start(state.puzzle, index);
}

/** A hint after a miss. */
export function hint(state) {
  if (state.phase === 'find') return 'That word is fine ✓. Read the sentence out loud. What sounds wrong?';
  return 'Try each word in the sentence. Which one sounds right?';
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

const CHEERS = ['You fixed it!', 'Sharp eyes!', 'Great editing!', 'You got it!'];

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('fs');

  const talk = make('div', 'fm-talk');
  const frog = make('img', 'fm-frog');
  frog.src = 'assets/frog.svg';
  frog.alt = '';
  const bubble = make('p', 'fm-bubble');
  talk.append(frog, bubble);

  const count = make('p', 'fs-count');
  const line = make('div', 'fs-words');
  const ask = make('p', 'fs-ask');
  const choices = make('div', 'fs-choices');
  const message = make('p', 'fs-message');
  message.setAttribute('aria-live', 'polite');
  const nextButton = make('button', 'button fs-next');
  nextButton.type = 'button';
  nextButton.addEventListener('click', goNext);

  container.append(talk, count, line, ask, choices, message, nextButton);

  function tap(position) {
    if (state.phase !== 'find' || state.fine.includes(position)) return;
    state = check(state, { tap: position });
    if (state.last.correct) message.textContent = 'You found it! Now pick the right word.';
    else if (state.last.shown) message.textContent = 'That word is fine ✓. Here\'s the wrong one. Pick the right word.';
    else message.textContent = hint(state);
    draw();
  }

  function pick(word) {
    if (state.phase !== 'fix') return;
    state = check(state, { pick: word });
    message.textContent = state.last.correct
      ? `✓ ${CHEERS[cheerCount++ % CHEERS.length]} ${current(state).why}`
      : `↺ Not that one. ${hint(state)}`;
    draw();
  }

  function goNext() {
    state = next(state);
    if (state.status === 'won') {
      bubble.textContent = 'Thank you for fixing my sentences!';
      message.textContent = 'You fixed every sentence!';
      nextButton.hidden = true;
      onDone({ status: state.status });
      return;
    }
    message.textContent = '';
    draw();
  }

  function draw() {
    const item = current(state);
    bubble.textContent = state.phase === 'fixed'
      ? 'Oops! Thanks for fixing it.'
      : 'One word in my sentence is wrong. Can you find it?';
    count.textContent = `Sentence ${state.index + 1} of ${puzzle.items.length}`;

    line.replaceChildren();
    words(item).forEach((word, i) => {
      const isWrong = i === item.wrong && state.phase !== 'find';
      let text = word;
      let className = 'fs-word';
      let label = word;
      if (isWrong && state.phase === 'fixed') {
        text = item.fix;
        className += ' fs-fixed';
        label = `${item.fix}, fixed`;
      } else if (isWrong) {
        className += ' fs-wrong';
        label = `${word}, the wrong word`;
      } else if (state.fine.includes(i)) {
        className += ' fs-fine';
        label = `${word}, fine`;
      }
      const tile = make(state.phase === 'find' ? 'button' : 'span', className, text);
      if (state.phase === 'find') {
        tile.type = 'button';
        tile.disabled = state.fine.includes(i);
        tile.addEventListener('click', () => tap(i));
      }
      if (isWrong && state.phase === 'fixed') tile.prepend(make('s', 'fs-old', word), ' ');
      tile.setAttribute('aria-label', label);
      line.append(tile);
    });

    ask.textContent = state.phase === 'find'
      ? 'Tap the wrong word.'
      : state.phase === 'fix' ? 'Which word fixes it?' : '';
    ask.hidden = state.phase === 'fixed';

    choices.replaceChildren();
    if (state.phase !== 'find') {
      for (const option of item.options) {
        const button = make('button', 'wc-choice', option);
        button.type = 'button';
        if (state.phase === 'fixed' && option === item.fix) {
          button.classList.add('wc-right');
          button.prepend('✓ ');
        } else if (state.tried.includes(option)) {
          button.classList.add('wc-tried');
          button.prepend('↺ ');
        }
        button.disabled = state.phase === 'fixed' || state.tried.includes(option);
        button.addEventListener('click', () => pick(option));
        choices.append(button);
      }
    }

    nextButton.hidden = state.phase !== 'fixed';
    nextButton.textContent = state.index === puzzle.items.length - 1 ? 'Finish ✓' : 'Next sentence →';
  }

  draw();
}
