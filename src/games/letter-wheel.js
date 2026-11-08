// letter-wheel.js: make words from letters around a center letter.
//
// Six letters sit in a wheel: one in the center, five around it. Tap
// letters to spell a word. Every word must use the center letter, and each
// letter tile can be used once per word. The words to find come from the
// curated word lists, so every answer is a word the owner reviewed.

import { createRandom } from '../seed.js';

export const LETTER_COUNT = 6;
export const MIN_WORDS = 4;
export const MAX_WORDS = 8;
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghklmnprstw';

/** Count each letter: "bell" -> { b: 1, e: 1, l: 2 }. */
function countLetters(text) {
  const counts = {};
  for (const letter of text) counts[letter] = (counts[letter] || 0) + 1;
  return counts;
}

/** True when `word` can be spelled from `letters` and uses `center`. */
export function canMake(word, letters, center) {
  if (!word.includes(center)) return false;
  const have = countLetters(letters.join(''));
  return Object.entries(countLetters(word)).every(([letter, n]) => (have[letter] || 0) >= n);
}

/** Every word in `words` that can be made from the wheel. */
export function wordsFor(letters, center, words) {
  return words.filter((word) => canMake(word, letters, center));
}

/**
 * Make today's wheel. `words` is every word that may be an answer (the
 * level 1 and level 2 lists together).
 */
export function generate(seed, words) {
  const random = createRandom(seed);
  const fourLetter = words.filter((w) => w.length === 4);

  for (let attempt = 0; attempt < 5000; attempt++) {
    // Start from a real four-letter word, then add one vowel and one consonant.
    const base = random.pick(fourLetter);
    const letters = [...base, random.pick([...VOWELS]), random.pick([...CONSONANTS])];
    const center = random.pick([...base]);

    const answers = wordsFor(letters, center, words);
    if (answers.length < MIN_WORDS || answers.length > MAX_WORDS) continue;

    // Put the center letter first, then the outside letters in a mixed order.
    const outside = [...letters];
    outside.splice(outside.indexOf(center), 1);
    return {
      center,
      outside: random.shuffle(outside),
      answers: [...answers].sort((a, b) => a.length - b.length || a.localeCompare(b)),
    };
  }
  throw new Error('Could not make a letter wheel for this seed.');
}

/** The starting state: no words found, no hints used. */
export function start(puzzle) {
  return { puzzle, found: [], hints: {}, status: 'playing', last: null };
}

/**
 * Try a word. Returns the new state; state.last.result is one of:
 *   'found'      a new answer
 *   'already'    found before
 *   'no-center'  doesn't use the center letter
 *   'too-short'  fewer than 3 letters
 *   'not-today'  a real spelling from the wheel, but not one of today's words
 */
export function check(state, word) {
  if (state.status !== 'playing') throw new Error('This wheel is already finished.');
  const guess = String(word).toLowerCase();
  const { puzzle } = state;
  let result;
  let found = state.found;

  if (guess.length < 3) result = 'too-short';
  else if (!guess.includes(puzzle.center)) result = 'no-center';
  else if (state.found.includes(guess)) result = 'already';
  else if (puzzle.answers.includes(guess)) {
    result = 'found';
    found = [...state.found, guess];
  } else result = 'not-today';

  const done = puzzle.answers.every((a) => found.includes(a));
  return { ...state, found, status: done ? 'won' : 'playing', last: { word: guess, result } };
}

/**
 * Show one more letter of a word not found yet: the shortest one first,
 * so hints help with the easiest word. Returns the new state.
 */
export function useHint(state) {
  const open = state.puzzle.answers.filter((a) => !state.found.includes(a));
  const target = open.find((a) => (state.hints[a] || 0) < a.length - 1) || null;
  if (!target) return state;
  return { ...state, hints: { ...state.hints, [target]: (state.hints[target] || 0) + 1 } };
}

/** Confirm a wheel is valid. Returns { ok, problems }. */
export function verify(puzzle, words) {
  const problems = [];
  const { center, outside, answers } = puzzle;
  const letters = [center, ...(outside || [])];

  if (typeof center !== 'string' || !/^[a-z]$/.test(center)) problems.push('center must be one letter');
  if (!Array.isArray(outside) || outside.length !== LETTER_COUNT - 1
    || outside.some((l) => !/^[a-z]$/.test(l))) {
    problems.push(`there must be ${LETTER_COUNT - 1} outside letters`);
  }
  if (!Array.isArray(answers) || answers.length < MIN_WORDS || answers.length > MAX_WORDS) {
    return { ok: false, problems: [...problems, `there must be ${MIN_WORDS} to ${MAX_WORDS} words`] };
  }
  for (const answer of answers) {
    if (!words.includes(answer)) problems.push(`"${answer}" is not in the word lists`);
    if (!canMake(answer, letters, center)) problems.push(`"${answer}" can't be made from the wheel`);
  }
  // Every list word the wheel can make must be an answer, so a correct
  // word is never turned away.
  for (const word of wordsFor(letters, center, words)) {
    if (!answers.includes(word)) problems.push(`"${word}" can be made but is not an answer`);
  }
  if (new Set(answers).size !== answers.length) problems.push('an answer appears twice');

  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: word slots, the typed word, the wheel, and buttons.
// ---------------------------------------------------------------------------

const MESSAGES = {
  found: ['Yes!', 'Great word!', 'You found one!', 'Nice spelling!'],
  already: 'You already found that one.',
  'no-center': (center) => `Use the middle letter, ${center.toUpperCase()}.`,
  'too-short': 'Words need at least 3 letters.',
  'not-today': "Good word! It's not one of today's.",
};

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let outside = [...puzzle.outside];
  let picked = []; // indexes into the wheel: 0 is the center, 1-5 are outside
  let foundCount = 0;

  container.replaceChildren();
  container.classList.add('lw');

  const slots = make('div', 'lw-slots');
  const slotNodes = {};
  for (const answer of puzzle.answers) {
    const slot = make('div', 'lw-slot');
    slotNodes[answer] = [...answer].map(() => {
      const box = make('span', 'lw-slot-letter');
      slot.append(box);
      return box;
    });
    slots.append(slot);
  }

  const typedLine = make('p', 'lw-typed');
  const message = make('p', 'lw-message', `Make words with the middle letter, ${puzzle.center.toUpperCase()}.`);
  message.setAttribute('aria-live', 'polite');

  const wheel = make('div', 'lw-wheel');
  const tiles = [];
  for (let i = 0; i < 1 + outside.length; i++) {
    const tile = make('button', i === 0 ? 'lw-tile lw-center' : 'lw-tile');
    tile.type = 'button';
    tile.style.setProperty('--i', i - 1);
    tile.addEventListener('click', () => pick(i));
    wheel.append(tile);
    tiles.push(tile);
  }

  const buttons = make('div', 'lw-buttons');
  const eraseButton = make('button', 'lw-button', '⌫');
  eraseButton.setAttribute('aria-label', 'Erase a letter');
  const shuffleButton = make('button', 'lw-button', 'Shuffle');
  const hintButton = make('button', 'lw-button', 'Hint');
  const enterButton = make('button', 'lw-button lw-enter', 'Enter');
  for (const b of [eraseButton, shuffleButton, hintButton, enterButton]) {
    b.type = 'button';
    buttons.append(b);
  }
  eraseButton.addEventListener('click', erase);
  shuffleButton.addEventListener('click', shuffle);
  hintButton.addEventListener('click', hint);
  enterButton.addEventListener('click', submit);

  container.append(slots, typedLine, message, wheel, buttons);

  const letterAt = (i) => (i === 0 ? puzzle.center : outside[i - 1]);

  function pick(i) {
    if (state.status !== 'playing' || picked.includes(i) || picked.length >= 4) return;
    picked.push(i);
    draw();
  }

  function erase() {
    picked.pop();
    draw();
  }

  function shuffle() {
    if (state.status !== 'playing') return;
    // A simple shuffle is fine here: it only changes the look, not the puzzle.
    const typedLetters = picked.map(letterAt);
    outside = [...outside].sort(() => Math.random() - 0.5);
    picked = [];
    // Keep what was typed by picking matching tiles again.
    for (const letter of typedLetters) {
      const i = [0, 1, 2, 3, 4, 5].find((n) => letterAt(n) === letter && !picked.includes(n));
      if (i !== undefined) picked.push(i);
    }
    draw();
  }

  function hint() {
    if (state.status !== 'playing') return;
    const before = state.hints;
    state = useHint(state);
    message.textContent = state.hints === before ? 'Each word has one letter left to find. You can do it!' : 'Here is a letter to help.';
    draw();
  }

  function submit() {
    if (state.status !== 'playing') return;
    const word = picked.map(letterAt).join('');
    if (word === '') {
      message.textContent = 'Tap letters to make a word.';
      return;
    }
    state = check(state, word);
    picked = [];
    const { result } = state.last;
    if (result === 'found') {
      message.textContent = MESSAGES.found[foundCount++ % MESSAGES.found.length];
    } else if (result === 'no-center') {
      message.textContent = MESSAGES['no-center'](puzzle.center);
    } else {
      message.textContent = MESSAGES[result];
    }
    draw();

    if (state.status === 'won') {
      message.textContent = 'You found every word!';
      document.removeEventListener('keydown', onKeydown);
      container.classList.add('lw-finished');
      onDone({ status: state.status });
    }
  }

  function draw() {
    for (const answer of puzzle.answers) {
      const isFound = state.found.includes(answer);
      const shown = state.hints[answer] || 0;
      slotNodes[answer].forEach((box, i) => {
        const visible = isFound || i < shown;
        box.textContent = visible ? answer[i] : '';
        box.className = 'lw-slot-letter' + (isFound ? ' lw-slot-found' : visible ? ' lw-slot-hint' : '');
      });
      slotNodes[answer][0].parentElement.setAttribute('aria-label',
        isFound ? `${answer}, found` : `${answer.length}-letter word, not found yet`);
    }
    typedLine.textContent = picked.map(letterAt).join('').toUpperCase() || ' ';
    tiles.forEach((tile, i) => {
      tile.textContent = letterAt(i);
      tile.disabled = picked.includes(i);
    });
  }

  // A computer keyboard works too, which helps when testing on a laptop.
  function onKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (container.closest('[hidden]')) return; // only while this game is on screen
    const letter = event.key.toLowerCase();
    if (/^[a-z]$/.test(letter)) {
      const i = [0, 1, 2, 3, 4, 5].find((n) => letterAt(n) === letter && !picked.includes(n));
      if (i !== undefined) pick(i);
    } else if (event.key === 'Backspace') erase();
    else if (event.key === 'Enter') submit();
  }
  document.addEventListener('keydown', onKeydown);

  draw();
}
