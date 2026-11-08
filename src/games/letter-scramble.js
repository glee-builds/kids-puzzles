// letter-scramble.js: put mixed-up letters back in order to spell a word.
//
// Each day has 4 words from the word lists: two 3-letter words, then two
// 4-letter words. The letters are shuffled so they never already spell a
// word. The player drags (or taps) the letters into the boxes. Letters in
// the right box stay and turn green with a check; the others go back to
// try again. If the letters spell a different real word from the lists
// (TEN for NET), that counts too.

import { createRandom } from '../seed.js';

export const PLAN = [3, 3, 4, 4]; // word lengths, in order
const SORTED = (word) => [...word].sort().join('');

/** Every word in the lists that uses exactly the letters of `word`. */
export function wordsWithLetters(word, words) {
  const key = SORTED(word);
  return words.filter((w) => w.length === word.length && SORTED(w) === key);
}

/** Shuffle `word`'s letters until they don't spell any listed word. */
function scramble(random, word, words) {
  const taken = new Set(wordsWithLetters(word, words));
  for (let attempt = 0; attempt < 50; attempt++) {
    const mixed = random.shuffle([...word]).join('');
    if (!taken.has(mixed)) return mixed;
  }
  return null; // every order is a word (or the word is all one letter)
}

/** Make today's 4 words from a seed and the word lists. */
export function generate(seed, words) {
  const random = createRandom(seed);
  const items = [];
  for (const length of PLAN) {
    const choices = random.shuffle(words.filter((w) => w.length === length));
    for (const word of choices) {
      if (items.some((item) => SORTED(item.word) === SORTED(word))) continue;
      const mixed = scramble(random, word, words);
      if (mixed) {
        items.push({ word, mixed });
        break;
      }
    }
  }
  return { items, words };
}

/** The starting state: the first word, nothing placed. */
export function start(puzzle) {
  return {
    puzzle,
    index: 0,
    locked: Array(puzzle.items[0].word.length).fill(false),
    solved: [],
    hints: 0,
    status: 'playing',
    last: null,
  };
}

export const current = (state) => state.puzzle.items[state.index];

function nextWord(state, spelled) {
  const solved = [...state.solved, spelled];
  const index = state.index + 1;
  if (index >= state.puzzle.items.length) {
    return { ...state, solved, status: 'won' };
  }
  const length = state.puzzle.items[index].word.length;
  return { ...state, solved, index, locked: Array(length).fill(false) };
}

/**
 * Try a spelling (a string as long as the word). Returns the new state;
 * state.last says what happened:
 *   { result: 'right', spelled }          a listed word with these letters
 *   { result: 'wrong', marks }            marks[i] is true where the letter
 *                                         is in the right box; those lock
 */
export function check(state, spelled) {
  if (state.status !== 'playing') throw new Error('All the words are done.');
  const { word } = current(state);
  if (spelled.length !== word.length || SORTED(spelled) !== SORTED(word)) {
    throw new Error(`"${spelled}" doesn't use the letters of this word.`);
  }
  if (wordsWithLetters(word, state.puzzle.words).includes(spelled)) {
    return { ...nextWord(state, spelled), last: { result: 'right', spelled } };
  }
  const marks = [...spelled].map((letter, i) => letter === word[i]);
  const locked = state.locked.map((was, i) => was || marks[i]);
  return { ...state, locked, last: { result: 'wrong', marks } };
}

/**
 * A hint: lock the first letter that isn't locked yet. Returns
 * { state, position } (position is null when nothing is left to give).
 */
export function hint(state) {
  const position = state.locked.indexOf(false);
  if (state.status !== 'playing' || position === -1) return { state, position: null };
  const locked = [...state.locked];
  locked[position] = true;
  return { state: { ...state, locked, hints: state.hints + 1 }, position };
}

/** Confirm a day's words are valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { items, words } = puzzle;
  if (items.length !== PLAN.length) {
    return { ok: false, problems: [`there must be ${PLAN.length} words`] };
  }
  items.forEach(({ word, mixed }, i) => {
    if (!words.includes(word)) problems.push(`${word} is not in the word lists`);
    if (word.length !== PLAN[i]) problems.push(`word ${i + 1} should have ${PLAN[i]} letters`);
    if (SORTED(mixed) !== SORTED(word)) problems.push(`${mixed} is not a mix of ${word}`);
    if (words.includes(mixed)) problems.push(`${mixed} is already a word`);
  });
  const keys = items.map(({ word }) => SORTED(word));
  if (new Set(keys).size !== keys.length) problems.push('two words use the same letters');
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: solved words, the boxes, the mixed-up letters, and buttons.
//
// Letters move from the tray into the boxes by dragging or tapping (a
// tapped letter goes into the first empty box). Tapping a letter in a box
// sends it back, unless it's locked in the right place.
// ---------------------------------------------------------------------------

const CHEERS = ['You spelled it!', 'Yes!', 'Great reading!', 'You got it!'];
const PAUSE = 900; // ms to show a spelled word before the next one
const DRAG_START = 8; // px a finger moves before a tap becomes a drag

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let boxes = [];   // tray index in each box, or null
  let busy = false; // true while a spelling is being judged
  let drag = null;
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('ls');

  const found = make('div', 'ls-found');
  const foundNodes = puzzle.items.map(({ word }) => {
    const slot = make('span', 'ls-found-word', '·'.repeat(word.length));
    found.append(slot);
    return slot;
  });

  const boxRow = make('div', 'ls-boxes');
  const tray = make('div', 'ls-tray');
  const message = make('p', 'ls-message', 'Drag the letters into the boxes to spell a word.');
  message.setAttribute('aria-live', 'polite');

  const buttons = make('div', 'ls-buttons');
  const clearButton = make('button', 'lw-button', 'Clear');
  clearButton.type = 'button';
  clearButton.addEventListener('click', () => {
    if (busy || state.status !== 'playing') return;
    boxes = boxes.map((b, k) => (state.locked[k] ? b : null));
    draw();
  });
  const hintButton = make('button', 'lw-button', 'Hint');
  hintButton.type = 'button';
  hintButton.addEventListener('click', giveHint);
  buttons.append(clearButton, hintButton);

  container.append(found, boxRow, tray, message, buttons);

  let boxNodes = [];
  let tiles = [];

  // ---------- Setting up each word ----------

  function setUpWord() {
    const { mixed } = current(state);
    boxes = Array(mixed.length).fill(null);
    boxRow.replaceChildren();
    tray.replaceChildren();
    boxNodes = [...mixed].map((_, k) => {
      const box = make('button', 'ls-box');
      box.type = 'button';
      box.addEventListener('click', () => sendBack(k));
      boxRow.append(box);
      return box;
    });
    tiles = [...mixed].map((letter, i) => {
      const tile = make('button', 'ls-tile', letter);
      tile.type = 'button';
      tile.addEventListener('pointerdown', (event) => startDrag(event, i));
      tile.addEventListener('pointermove', moveDrag);
      tile.addEventListener('pointerup', endDrag);
      tile.addEventListener('pointercancel', cancelDrag);
      tile.addEventListener('click', (event) => { if (event.detail === 0) placeFirstEmpty(i); });
      tray.append(tile);
      return tile;
    });
    draw();
  }

  // The tray index of an unused tile showing `letter` (for hints and locks).
  function freeTileWith(letter, except = []) {
    return tiles.findIndex((tile, i) => tile.textContent === letter && !except.includes(i));
  }

  // ---------- Moving letters ----------

  const canPlay = () => state.status === 'playing' && !busy;

  function place(i, k) {
    if (!canPlay() || state.locked[k]) return;
    boxes = boxes.map((b) => (b === i ? null : b));
    boxes[k] = i;
    draw();
    if (boxes.every((b) => b !== null)) {
      busy = true;
      setTimeout(submit, 250);
    }
  }

  function placeFirstEmpty(i) {
    if (boxes.includes(i)) return;
    const k = boxes.findIndex((b, n) => b === null && !state.locked[n]);
    if (k !== -1) place(i, k);
  }

  function sendBack(k) {
    if (!canPlay() || boxes[k] === null || state.locked[k]) return;
    boxes[k] = null;
    draw();
  }

  function boxAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const box = hit && hit.closest('.ls-box');
    return box && boxNodes.includes(box) ? box : null;
  }

  function startDrag(event, i) {
    if (!canPlay() || boxes.includes(i)) return;
    event.preventDefault();
    drag = { i, x: event.clientX, y: event.clientY, id: event.pointerId, moved: false, ghost: null };
    try { tiles[i].setPointerCapture(event.pointerId); } catch { /* fine without it */ }
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START) return;
      drag.moved = true;
      drag.ghost = make('div', 'ls-ghost', tiles[drag.i].textContent);
      document.body.append(drag.ghost);
      tiles[drag.i].classList.add('ls-tile-lifted');
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const over = boxAt(event.clientX, event.clientY);
    boxNodes.forEach((box) => box.classList.toggle('ls-box-over', box === over));
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const { i, moved } = drag;
    cancelDrag();
    if (!moved) {
      placeFirstEmpty(i);
      return;
    }
    const box = boxAt(event.clientX, event.clientY);
    if (box) place(i, boxNodes.indexOf(box));
  }

  function cancelDrag() {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    tiles[drag.i].classList.remove('ls-tile-lifted');
    boxNodes.forEach((box) => box.classList.remove('ls-box-over'));
    drag = null;
  }

  // ---------- Hints and judging ----------

  function giveHint() {
    if (!canPlay()) return;
    const result = hint(state);
    if (result.position === null) return;
    state = result.state;
    const k = result.position;
    const letter = current(state).word[k];
    // Free the box, then put the right letter in it (from wherever it is).
    const lockedTiles = boxes.filter((b, n) => b !== null && state.locked[n] && n !== k);
    const i = freeTileWith(letter, lockedTiles);
    boxes = boxes.map((b, n) => (b === i || n === k ? null : b));
    boxes[k] = i;
    message.textContent = `The letter ${letter.toUpperCase()} goes there.`;
    draw();
    if (boxes.every((b) => b !== null)) {
      busy = true;
      setTimeout(submit, 250);
    }
  }

  function submit() {
    const spelled = boxes.map((i) => tiles[i].textContent).join('');
    const indexBefore = state.index;
    state = check(state, spelled);
    const { result } = state.last;

    if (result === 'right') {
      const { word } = puzzle.items[indexBefore];
      message.textContent = spelled === word
        ? CHEERS[cheerCount++ % CHEERS.length]
        : `${spelled.toUpperCase()} is a word too! Nice!`;
      boxRow.classList.add('ls-boxes-right');
      foundNodes[indexBefore].textContent = spelled;
      foundNodes[indexBefore].classList.add('ls-found-done');
      draw(true);
      setTimeout(() => {
        boxRow.classList.remove('ls-boxes-right');
        busy = false;
        if (state.status === 'won') {
          message.textContent = 'You unscrambled every word!';
          container.classList.add('ls-finished');
          draw(true);
          onDone({ status: state.status });
          return;
        }
        message.textContent = 'Next word! Drag the letters into the boxes.';
        setUpWord();
      }, PAUSE);
      return;
    }

    // Wrong: letters in the right box lock; the rest go back to the tray.
    const placed = state.locked.filter(Boolean).length;
    message.textContent = placed > 0
      ? 'Not yet! The green letters are in the right place.'
      : 'Not yet! Try a different order.';
    boxes = boxes.map((b, k) => (state.locked[k] ? b : null));
    boxRow.classList.remove('np-wiggle');
    void boxRow.offsetWidth; // restart the wiggle
    boxRow.classList.add('np-wiggle');
    busy = false;
    draw();
  }

  // ---------- Drawing ----------

  function draw(allRight = false) {
    boxNodes.forEach((box, k) => {
      const filled = boxes[k] !== null;
      const locked = !allRight && state.status === 'playing' && state.locked[k];
      box.textContent = filled ? tiles[boxes[k]].textContent : '';
      box.classList.toggle('ls-box-filled', filled);
      box.classList.toggle('ls-box-locked', locked || allRight);
      box.setAttribute('aria-label', filled ? tiles[boxes[k]].textContent : 'Empty box');
    });
    tiles.forEach((tile, i) => {
      tile.classList.toggle('ls-tile-used', boxes.includes(i));
      tile.disabled = !canPlay() || boxes.includes(i);
    });
    foundNodes.forEach((node, n) => {
      node.classList.toggle('ls-found-now', n === state.index && state.status === 'playing');
    });
    clearButton.disabled = !canPlay();
    hintButton.disabled = !canPlay();
  }

  setUpWord();
}
