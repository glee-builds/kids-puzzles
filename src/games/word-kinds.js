// word-kinds.js: noun, verb, or describing word?
//
//   📦 noun: a person, animal, place, or thing    🏃 verb: an action
//   🎨 describing word: tells what something is like
//
// Each day has 5 sentences from data/word-kinds.json, with two kinds of round:
//   name: one word is underlined. Pick what kind of word it is.
//   find: tap every noun (or verb, or describing word) in the sentence.
//   level 1: 5 name rounds; sentences with one noun, one verb, one describing word
//   level 2: name and find take turns; two nouns or two describing words
//   level 3: mostly find; "is", "are", and "was" are verbs too
// Sentences are dealt from a shuffled deck, so none repeats until its
// level's deck is used up.

import { nextRound } from '../rounds.js';
import { createRandom, dealForDay, forLevel } from '../seed.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';

export const KINDS = ['noun', 'verb', 'describing'];
const INFO = {
  noun: { mark: '📦', name: 'Noun', many: 'nouns', gloss: 'a person, animal, place, or thing', rule: 'A noun is a person, animal, place, or thing.' },
  verb: { mark: '🏃', name: 'Verb', many: 'verbs', gloss: 'an action', rule: 'A verb is an action.' },
  describing: { mark: '🎨', name: 'Describing word', many: 'describing words', gloss: '', rule: 'A describing word tells what something is like.' },
};
export const MAX_TRIES = 3; // tries at a find round before the words are shown
// The kinds of round at each level, in order.
export const ROUNDS = [
  ['name', 'name', 'name', 'name', 'name'],
  ['name', 'find', 'name', 'find', 'name'],
  ['find', 'name', 'find', 'name', 'find'],
];
const isBe = (word) => /^(is|are|was)$/i.test(word); // verbs that are not actions

/** Where the words of one kind are in a sentence. */
const spotsOf = (tags, kind) => tags.flatMap((tag, i) => (tag === kind ? [i] : []));
/** "noun" for one, "nouns" for more. */
const nameFor = (kind, count) => (count === 1 ? INFO[kind].name.toLowerCase() : INFO[kind].many);

/** Make today's 5 rounds from the sentences, a day number, and the level (1 to 3). */
export function generate(seed, items, dayNumber, level = 1) {
  const random = createRandom(seed);
  const kinds = forLevel(ROUNDS, level);
  level = ROUNDS.indexOf(kinds) + 1;
  const deck = items.filter((item) => item.level === level);
  const asked = random.shuffle(KINDS); // take turns, so a day asks about every kind
  const rounds = dealForDay(deck, kinds.length, dayNumber, `word-kinds-${level}`).map(({ words, kinds: tags }, i) => {
    // The kind whose turn it is, or the next one this sentence has.
    const want = [asked[i % 3], ...asked].find((kind) => tags.includes(kind));
    if (kinds[i] === 'find') return { kind: 'find', words, tags, want };
    return { kind: 'name', words, tags, target: random.pick(spotsOf(tags, want)) };
  });
  return { level, rounds };
}

/** Whether `answer` is right: a kind for a name round, a list of word places for a find round. */
export function isRight(round, answer) {
  if (round.kind === 'name') return answer === round.tags[round.target];
  const right = spotsOf(round.tags, round.want);
  return answer.length === right.length && right.every((i) => answer.includes(i));
}

/** The starting state: round 0, no tries yet. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/**
 * Answer the current round. A miss stays on the round; in a find round the
 * third miss shows the words and moves on. (A name round has only 3
 * choices, so it is never shown.)
 */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the rounds are done.');
  const round = state.puzzle.rounds[state.round];
  return nextRound(state, isRight(round, answer), { canShow: round.kind === 'find', maxTries: MAX_TRIES });
}

/** A hint after a miss: what the kind of word means. */
export function hint(round) {
  if (round.kind === 'find') {
    const spots = spotsOf(round.tags, round.want);
    const be = spots.some((i) => isBe(round.words[i])) ? ' Is, are, and was are verbs too.' : '';
    return `There ${spots.length === 1 ? 'is' : 'are'} ${spots.length} ${nameFor(round.want, spots.length)}. ${INFO[round.want].rule}${be}`;
  }
  const word = round.words[round.target].toLowerCase();
  const kind = round.tags[round.target];
  if (isBe(word)) return `Some verbs are not actions. Is, are, and was are verbs too: ${word} is a verb.`;
  const test = {
    noun: `Is "${word}" one of those? Yes: ${word} is a noun.`,
    verb: `Is "${word}" something you can do? Yes: ${word} is a verb.`,
    describing: `"${word}" does that: ${word} is a describing word.`,
  };
  return `${INFO[kind].rule} ${test[kind]}`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const kinds = forLevel(ROUNDS, level);
  if (!Array.isArray(rounds) || rounds.length !== kinds.length) return { ok: false, problems: [`needs ${kinds.length} rounds`] };
  rounds.forEach((round, i) => {
    const { words = [], tags = [] } = round;
    if (round.kind !== kinds[i]) problems.push(`round ${i + 1} should be a ${kinds[i]} round`);
    if (words.length === 0 || words.length !== tags.length) problems.push(`round ${i + 1}: every word needs a kind`);
    if (tags.some((tag) => tag !== '' && !KINDS.includes(tag))) problems.push(`round ${i + 1}: a kind that isn't noun, verb, or describing`);
    if (round.kind === 'name' && !KINDS.includes(tags[round.target])) problems.push(`round ${i + 1}: the underlined word has no kind`);
    if (round.kind === 'find' && spotsOf(tags, round.want).length === 0) problems.push(`round ${i + 1}: no ${round.want} to find`);
  });
  if (new Set(rounds.map((round) => (round.words || []).join(' '))).size !== rounds.length) problems.push('a sentence is used twice');
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is how many wrong answers were given, and
 * helped is how many find rounds had their words shown.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0; // wrong answers in the whole puzzle (state.tries starts over each round)
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round, shown: session.saved.shown || [] };
    misses = session.saved.misses;
  }
  container.replaceChildren();
  container.classList.add('wk');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'wk',
    draw: (i) => (puzzle.rounds[i].kind === 'name' ? drawName : drawFind)(puzzle.rounds[i], i),
  });
  const { question, stage, message } = frame;

  /** Judge an answer to round i. A miss wiggles `node` and gives a hint. */
  function answer(i, value, node) {
    if (state.round !== i) return null;
    state = check(state, value);
    if (!state.last.correct) misses += 1;
    if (!state.last.correct && !state.last.shown) {
      message.textContent = `Not quite. ${hint(puzzle.rounds[i])}`;
      wiggle(node);
    }
    return state.last;
  }

  const finishRound = (text) => {
    session.save?.({ round: state.round, misses, shown: state.shown });
    frame.finish(text, state.round, () => onDone({ status: state.status, misses, helped: state.shown.length }));
  };

  // One word is underlined: pick its kind.
  function drawName(round, i) {
    const word = round.words[round.target].toLowerCase();
    question.textContent = `What kind of word is "${word}"?`;
    const sentence = make('p', 'wk-sentence');
    round.words.forEach((text, j) => sentence.append(j ? ' ' : '', j === round.target ? make('span', 'wk-target', text) : text));
    sentence.append('.');
    const choices = make('div', 'wk-choices');
    for (const kind of KINDS) {
      const { mark, name, gloss } = INFO[kind];
      const choice = button('lw-button wk-choice', '', () => {
        if (!answer(i, kind, choice)?.correct) return;
        markRight(choice);
        finishRound(`✓ Yes! "${word}" is a ${name.toLowerCase()}.`);
      });
      const text = make('span', 'wk-choice-text');
      text.append(make('b', '', name));
      if (gloss) text.append(make('small', '', gloss));
      choice.append(make('span', 'wk-mark', mark), text);
      choice.setAttribute('aria-label', gloss ? `${name}: ${gloss}` : name);
      choices.append(choice);
    }
    stage.append(sentence, choices);
  }

  // Every word is a button: tap all the words of one kind, then Check.
  function drawFind(round, i) {
    const right = spotsOf(round.tags, round.want);
    const kindName = nameFor(round.want, right.length);
    question.textContent = `Tap every ${INFO[round.want].name.toLowerCase()} in this sentence.`;
    const chosen = new Set();
    const sentence = make('div', 'wk-words');
    const words = round.words.map((text, j) => {
      const word = button('wk-word', text, () => {
        if (!chosen.delete(j)) chosen.add(j);
        word.setAttribute('aria-pressed', chosen.has(j));
        message.textContent = '';
      });
      word.setAttribute('aria-pressed', 'false');
      return sentence.appendChild(word);
    });
    const checkButton = button('lw-button lw-enter wk-check', 'Check', () => {
      if (chosen.size === 0) {
        message.textContent = 'Tap a word to pick it. Tap it again to let it go.';
        return;
      }
      const result = answer(i, [...chosen], sentence);
      if (!result || (!result.correct && !result.shown)) return;
      words.forEach((word, j) => {
        word.disabled = true;
        word.setAttribute('aria-pressed', right.includes(j));
      });
      checkButton.remove();
      const found = right.map((j) => round.words[j].toLowerCase()).join(', ');
      finishRound(result.correct ? `✓ You found the ${kindName}: ${found}.` : `Here ${right.length === 1 ? 'is' : 'are'} the ${kindName}: ${found}.`);
    });
    stage.append(sentence, checkButton);
  }

  frame.begin(state.round);
}
