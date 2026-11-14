// word-clues.js: learn "rich" words like furious or enormous from a story.
//
// Each day has 2 words from data/rich-words.json. For each word, the player
// reads a short story that uses it and works out what it means from the
// clues (picking one of 3 meanings). Then, after both stories, the player
// uses each word again: picking which word fits a new sentence.
// Reading a word in a story and then using it again is how new words stick.
//
// The words are dealt in a fixed shuffled order, two a day, so none
// repeats until the whole list has been used.

import { createRandom, dealForDay } from '../seed.js';
import { make, button, liveMessage } from '../ui.js';

export const WORDS_PER_DAY = 2;
export const SENTENCES = 3;
export const MAX_SENTENCE = 60; // characters
export const MAX_USE = 70;

/** The words for a day number (days since a fixed start date). */
export const wordsForDay = (words, dayNumber) => dealForDay(words, WORDS_PER_DAY, dayNumber, 'word-clues');

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (word) => new RegExp(`\\b${escape(word)}\\b`, 'gi');

/** Problems with one entry of the word list. An empty list means it's fine. */
export function entryProblems(entry, allWords = []) {
  const problems = [];
  const { word, story, meaning, wrong, use, notFit } = entry;
  if (!/^[a-z]+$/.test(word || '')) problems.push('word must be lowercase letters');
  if (!Array.isArray(story) || story.length !== SENTENCES) {
    problems.push(`story must have ${SENTENCES} sentences`);
  } else {
    for (const s of story) {
      if (s.length > MAX_SENTENCE) problems.push(`sentence over ${MAX_SENTENCE} characters: ${s}`);
      if (!/^[A-Z].*[.!?]$/.test(s)) problems.push(`sentence needs a capital and an end mark: ${s}`);
    }
    const uses = story.join(' ').match(wholeWord(word))?.length || 0;
    if (uses !== 1) problems.push(`the story uses "${word}" ${uses} times, not once`);
  }
  if (!meaning || !Array.isArray(wrong) || wrong.length !== 2
    || new Set([meaning, ...wrong]).size !== 3) problems.push('needs a meaning and two different wrong meanings');
  if (typeof use !== 'string' || use.split('___').length !== 2) problems.push('use needs exactly one ___');
  else if (use.length > MAX_USE) problems.push(`use sentence over ${MAX_USE} characters`);
  if (!Array.isArray(notFit) || notFit.length !== 2 || notFit.includes(word)
    || new Set(notFit).size !== 2) problems.push('notFit needs two other words');
  else if (allWords.length && notFit.some((w) => !allWords.includes(w))) {
    problems.push('notFit words must come from the word list');
  }
  return problems;
}

/** Make today's steps from a seed, the word list, and the day number. */
export function generate(seed, words, dayNumber) {
  const random = createRandom(seed);
  const today = wordsForDay(words, dayNumber);
  const entries = today.map(({ word, story, meaning, wrong, use, notFit }) =>
    ({ word, story, meaning, wrong, use, notFit }));
  const steps = [
    ...entries.map((_, i) => ({ type: 'meaning', word: i, options: random.shuffle([entries[i].meaning, ...entries[i].wrong]) })),
    ...entries.map((_, i) => ({ type: 'use', word: i, options: random.shuffle([entries[i].word, ...entries[i].notFit]) })),
  ];
  return { entries, steps };
}

/** The right choice for a step. */
export function answerFor(puzzle, step) {
  const entry = puzzle.entries[step.word];
  return step.type === 'meaning' ? entry.meaning : entry.word;
}

/** Confirm a day is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  if (!Array.isArray(puzzle.entries) || puzzle.entries.length !== WORDS_PER_DAY) {
    return { ok: false, problems: [`there must be ${WORDS_PER_DAY} words`] };
  }
  puzzle.entries.forEach((e, i) => problems.push(...entryProblems(e).map((p) => `word ${i + 1}: ${p}`)));
  if (puzzle.entries[0].word === puzzle.entries[1].word) problems.push('the same word twice');
  for (const step of puzzle.steps) {
    if (step.options.length !== 3 || !step.options.includes(answerFor(puzzle, step))) {
      problems.push(`a ${step.type} step is missing its answer`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Playing: pick a choice; a wrong one is crossed off, so it never gets stuck.
// ---------------------------------------------------------------------------

export function start(puzzle) {
  return { puzzle, index: 0, tried: [], done: false, status: 'playing', last: null };
}

export const currentStep = (state) => state.puzzle.steps[state.index];

/** Pick a choice. Returns the new state; state.last says what happened. */
export function check(state, choice) {
  if (state.status !== 'playing') throw new Error('Today\'s words are finished.');
  if (state.done) throw new Error('This step is already done.');
  const step = currentStep(state);
  if (!step.options.includes(choice) || state.tried.includes(choice)) {
    throw new Error(`"${choice}" is not a choice now.`);
  }
  if (choice === answerFor(state.puzzle, step)) {
    return { ...state, done: true, last: { choice, correct: true } };
  }
  return { ...state, tried: [...state.tried, choice], last: { choice, correct: false } };
}

/** Move to the next step. The last one finishes the game. */
export function next(state) {
  if (!state.done) throw new Error('Pick the right choice first.');
  const index = state.index + 1;
  if (index >= state.puzzle.steps.length) return { ...state, status: 'won' };
  return { ...state, index, tried: [], done: false, last: null };
}

/** A hint after a wrong choice. */
export function hint(state) {
  const step = currentStep(state);
  const { word } = state.puzzle.entries[step.word];
  return step.type === 'meaning'
    ? `Read the story again. What clues tell you about "${word}"?`
    : 'Read the sentence with each word. Which one makes sense?';
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

const CHEERS = ['You used the clues!', 'Word detective!', 'You got it!', 'Great reading!'];

/** Text with one word marked, as nodes. */
function markWord(text, word) {
  const out = [];
  let last = 0;
  for (const match of text.matchAll(wholeWord(word))) {
    out.push(text.slice(last, match.index), make('mark', 'wc-word', match[0]));
    last = match.index + match[0].length;
  }
  out.push(text.slice(last));
  return out;
}

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong choices were picked.
 * helped is always 0: there is no Hint button and no answer is shown.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let cheerCount = 0;
  let misses = 0; // wrong choices, counted across every step
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    const { index, tried, done } = session.saved;
    state = { ...state, index, tried, done };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ index: state.index, tried: state.tried, done: state.done, misses });

  container.replaceChildren();
  container.classList.add('wc');

  const count = make('p', 'count-line');
  const card = make('div', 'wc-card');
  const ask = make('p', 'wc-ask');
  const choices = make('div', 'wc-choices');
  const message = liveMessage('wc-message');
  const nextButton = button('button next-button', '', goNext);

  container.append(count, card, ask, choices, message, nextButton);

  function choose(choice) {
    if (state.done) return;
    state = check(state, choice);
    if (!state.last.correct) misses += 1;
    keep();
    message.textContent = state.last.correct ? `✓ ${CHEERS[cheerCount++ % CHEERS.length]}` : `↺ Not that one. ${hint(state)}`;
    draw();
  }

  function goNext() {
    state = next(state);
    if (state.status === 'won') {
      message.textContent = `You learned "${puzzle.entries[0].word}" and "${puzzle.entries[1].word}" today!`;
      nextButton.hidden = true;
      onDone({ status: state.status, misses, helped: 0 });
      return;
    }
    keep();
    message.textContent = '';
    draw();
  }

  function draw() {
    const step = currentStep(state);
    const entry = puzzle.entries[step.word];
    count.textContent = step.type === 'meaning'
      ? `Story ${step.word + 1} of ${puzzle.entries.length}`
      : `Use it! ${step.word + 1} of ${puzzle.entries.length}`;

    card.replaceChildren();
    card.className = `wc-card wc-card-${step.type}`;
    if (step.type === 'meaning') {
      for (const sentence of entry.story) {
        const node = make('span', 'wc-sentence');
        node.append(...markWord(sentence, entry.word));
        card.append(node, ' ');
      }
      ask.replaceChildren('What does ', make('mark', 'wc-word', entry.word), ' mean?');
    } else {
      const [before, after] = entry.use.split('___');
      const blank = make('span', state.done ? 'wc-blank wc-filled' : 'wc-blank', state.done ? entry.word : '');
      card.append(before, blank, after);
      ask.textContent = 'Which word fits?';
    }

    choices.replaceChildren();
    for (const option of step.options) {
      const choice = button('wc-choice', option);
      const right = state.done && option === answerFor(puzzle, step);
      if (right) {
        choice.classList.add('wc-right');
        choice.prepend('✓ ');
      } else if (state.tried.includes(option)) {
        choice.classList.add('wc-tried');
        choice.prepend('↺ ');
      }
      choice.disabled = state.done || state.tried.includes(option);
      choice.addEventListener('click', () => choose(option));
      choices.append(choice);
    }

    nextButton.hidden = !state.done;
    nextButton.textContent = state.index === puzzle.steps.length - 1 ? 'Finish ✓' : 'Next →';
  }

  draw();
}
