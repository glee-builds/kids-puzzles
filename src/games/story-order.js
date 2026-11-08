// story-order.js: put the sentences of a short story in order.
//
// Each day has 2 mini-stories from data/stories.json, 4 sentences each,
// mixed up. The player taps the sentence that happens first, then next,
// and so on. When all 4 are placed, sentences in the right spot lock green
// with a check; the others go back to try again. A finished story shows
// as one paragraph to read before the next one.
//
// The stories are dealt in a fixed shuffled order, two a day, so none
// repeats until the whole bank has been used.

import { createRandom, hashString } from '../seed.js';
import { make, button, liveMessage, wiggle, progressDots } from '../ui.js';

export const STORIES_PER_DAY = 2;
export const SENTENCES = 4;
export const MAX_SENTENCE = 52; // characters: keeps each card to one or two lines

/** The two stories for a day number (days since a fixed start date). */
export function storiesForDay(stories, dayNumber) {
  const order = createRandom(hashString('story-order-deck')).shuffle(stories.map((_, i) => i));
  const n = order.length;
  const start = ((dayNumber * STORIES_PER_DAY) % n + n) % n;
  return Array.from({ length: STORIES_PER_DAY }, (_, k) => stories[order[(start + k) % n]]);
}

/** Mix up a story's sentences: never already in order. Returns positions, e.g. [2, 0, 3, 1]. */
function mixUp(random) {
  for (;;) {
    const mixed = random.shuffle([0, 1, 2, 3]);
    if (mixed.some((p, i) => p !== i)) return mixed;
  }
}

/** Make today's stories from a seed, the story bank, and the day number. */
export function generate(seed, stories, dayNumber) {
  const random = createRandom(seed);
  const items = storiesForDay(stories, dayNumber).map((story) => ({
    title: story.title,
    sentences: story.sentences,
    mixed: mixUp(random),
  }));
  return { items };
}

/** The starting state: the first story, nothing placed. */
export function start(puzzle) {
  return { puzzle, index: 0, locked: Array(SENTENCES).fill(false), hints: 0, status: 'playing', last: null };
}

export const current = (state) => state.puzzle.items[state.index];

/**
 * Try an order: an array of sentence positions, one per slot. [0, 1, 2, 3]
 * is right. Returns the new state; state.last says what happened:
 *   { result: 'right', story }   the story is in order
 *   { result: 'wrong', marks }   marks[i] is true where slot i is right;
 *                                those lock
 */
export function check(state, order) {
  if (state.status !== 'playing') throw new Error('All the stories are done.');
  if ([...order].sort().join() !== '0,1,2,3') throw new Error('An order must use each sentence once.');
  const marks = order.map((p, i) => p === i);
  if (marks.every(Boolean)) {
    const story = state.index;
    const index = state.index + 1;
    const won = index >= state.puzzle.items.length;
    return {
      ...state,
      index: won ? state.index : index,
      locked: Array(SENTENCES).fill(false),
      status: won ? 'won' : 'playing',
      last: { result: 'right', story },
    };
  }
  const locked = state.locked.map((was, i) => was || marks[i]);
  return { ...state, locked, last: { result: 'wrong', marks } };
}

/** A hint: lock the first slot that isn't locked yet. Returns { state, slot }. */
export function hint(state) {
  const slot = state.locked.indexOf(false);
  if (state.status !== 'playing' || slot === -1) return { state, slot: null };
  const locked = [...state.locked];
  locked[slot] = true;
  return { state: { ...state, locked, hints: state.hints + 1 }, slot };
}

/** Check one story from the bank. Returns a list of problems (empty if fine). */
export function storyProblems(story) {
  const problems = [];
  if (typeof story.title !== 'string' || story.title.trim() === '') problems.push('missing title');
  if (!Array.isArray(story.sentences) || story.sentences.length !== SENTENCES) {
    problems.push(`needs ${SENTENCES} sentences`);
    return problems;
  }
  for (const s of story.sentences) {
    if (s.length > MAX_SENTENCE) problems.push(`"${s}" is longer than ${MAX_SENTENCE} characters`);
    if (!/^[A-Z].*[.!?]$/.test(s)) problems.push(`"${s}" should start with a capital and end with . ! or ?`);
  }
  if (new Set(story.sentences).size !== SENTENCES) problems.push('two sentences are the same');
  return problems;
}

/** Confirm a day's stories are valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  if (puzzle.items.length !== STORIES_PER_DAY) problems.push(`there must be ${STORIES_PER_DAY} stories`);
  puzzle.items.forEach((item, i) => {
    problems.push(...storyProblems(item).map((p) => `story ${i + 1}: ${p}`));
    if ([...item.mixed].sort().join() !== '0,1,2,3') problems.push(`story ${i + 1}: mix is not 0 to 3`);
    if (item.mixed.every((p, k) => p === k)) problems.push(`story ${i + 1}: mix is already in order`);
  });
  if (puzzle.items[0] && puzzle.items[1] && puzzle.items[0].title === puzzle.items[1].title) {
    problems.push('the same story twice');
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// The screen: the story's numbered slots, the mixed-up sentence cards, and
// buttons. Tap a card to put it in the next empty slot; tap a placed card
// (not a locked one) to send it back.
// ---------------------------------------------------------------------------

const CHEERS = ['That\'s the story!', 'Great reading!', 'You got the order!'];
const ORDINALS = ['first', 'second', 'third', 'last'];

/** Draw the game inside `container`. Calls onDone({ status }) once when finished. */
export function render(container, puzzle, onDone) {
  let state = start(puzzle);
  let slots = Array(SENTENCES).fill(null); // sentence position in each slot
  let busy = false;
  let reading = false; // showing a finished story as a paragraph
  let shownIndex = 0;  // the story on screen
  let cheerCount = 0;

  container.replaceChildren();
  container.classList.add('so');

  const dots = progressDots(puzzle.items.length);
  const title = make('h2', 'so-title');
  const slotList = make('ol', 'so-slots');
  const slotNodes = Array.from({ length: SENTENCES }, (_, k) => {
    const li = make('li', 'so-slot-row');
    const number = make('span', 'so-number', String(k + 1));
    const slot = button('so-slot', '', () => sendBack(k));
    li.append(number, slot);
    slotList.append(li);
    return slot;
  });
  const pool = make('div', 'so-pool');
  const paragraph = make('p', 'so-paragraph');
  const message = liveMessage('so-message');

  const buttons = make('div', 'button-row');
  const hintButton = button('lw-button', 'Hint', giveHint);
  const nextButton = button('lw-button lw-enter', 'Next story →', () => {
    reading = false;
    shownIndex = state.index;
    slots = Array(SENTENCES).fill(null);
    draw();
  });
  buttons.append(hintButton, nextButton);

  container.append(dots.node, title, slotList, pool, paragraph, message, buttons);

  const canPlay = () => state.status === 'playing' && !busy && !reading;

  function promptText() {
    const k = slots.findIndex((s, n) => s === null && !state.locked[n]);
    if (k === -1) return '';
    return k === 0 ? 'Tap what happens first.' : k === SENTENCES - 1 ? 'Tap what happens last.' : 'Tap what happens next.';
  }

  function place(p) {
    if (!canPlay() || slots.includes(p)) return;
    const k = slots.findIndex((s, n) => s === null && !state.locked[n]);
    if (k === -1) return;
    slots[k] = p;
    message.textContent = promptText();
    draw();
    if (slots.every((s) => s !== null)) {
      busy = true;
      draw();
      setTimeout(submit, 350);
    }
  }

  function sendBack(k) {
    if (!canPlay() || slots[k] === null || state.locked[k]) return;
    slots[k] = null;
    message.textContent = promptText();
    draw();
  }

  function giveHint() {
    if (!canPlay()) return;
    const result = hint(state);
    if (result.slot === null) return;
    state = result.state;
    const k = result.slot;
    // Move the right sentence into slot k, sending back whatever was there.
    slots = slots.map((s, n) => (s === k || n === k ? null : s));
    slots[k] = k;
    message.textContent = `The ${ORDINALS[k]} sentence is in place.`;
    draw();
    if (slots.every((s) => s !== null)) {
      busy = true;
      setTimeout(submit, 350);
    }
  }

  function submit() {
    state = check(state, slots); // slots already hold sentence positions
    busy = false;
    if (state.last.result === 'right') {
      reading = true;
      message.textContent = CHEERS[cheerCount++ % CHEERS.length];
      if (state.status === 'won') {
        message.textContent = 'You put every story in order!';
        container.classList.add('finished');
        draw();
        onDone({ status: state.status });
        return;
      }
      draw();
      return;
    }
    const right = state.last.marks.filter(Boolean).length;
    slots = slots.map((s, k) => (state.locked[k] ? s : null));
    message.textContent = right > 0
      ? 'Not yet! The green ones are in the right place.'
      : 'Not yet! Think about what has to happen first.';
    wiggle(slotList);
    draw();
  }

  function draw() {
    const item = puzzle.items[shownIndex];
    title.textContent = item.title;
    dots.update((i) => i < state.index || state.status === 'won' || (reading && i === shownIndex), shownIndex);

    slotList.hidden = reading;
    pool.hidden = reading;
    paragraph.hidden = !reading;
    if (reading) {
      paragraph.textContent = item.sentences.join(' ');
    }

    slotNodes.forEach((slot, k) => {
      const p = slots[k];
      slot.textContent = p === null ? '' : item.sentences[p];
      slot.classList.toggle('so-slot-filled', p !== null);
      slot.classList.toggle('so-slot-locked', state.locked[k] && p !== null);
      slot.setAttribute('aria-label', p === null ? `Empty spot ${k + 1}` : item.sentences[p]);
    });

    pool.replaceChildren();
    for (const p of item.mixed) {
      if (slots.includes(p)) continue;
      const card = button('so-card', item.sentences[p]);
      card.disabled = !canPlay();
      card.addEventListener('click', () => place(p));
      pool.append(card);
    }

    hintButton.hidden = reading || state.status !== 'playing';
    hintButton.disabled = !canPlay();
    nextButton.hidden = !(reading && state.status === 'playing');
  }

  message.textContent = 'Tap what happens first.';
  draw();
}
