// word-builder.js: beginnings and endings that change what a word means.
//
// Put "un" in front of "kind" and it means not kind. Put "ful" after "hope"
// and it means full of hope. Each day has 4 rounds from data/word-builder.json,
// of two kinds that take turns:
//   meaning  the two pieces are shown joining ("un" + "kind" = "unkind");
//            pick what the new word means from 3 choices
//   part     the meaning is given ("not kind") and the word has a gap;
//            pick the part that fills it from 3 choices
//
//   level 1: un-, re-, -ful, -less
//   level 2: -er, -est, -ly too
//   level 3: pre-, mis-, dis- too
//
// The words are dealt in a fixed shuffled order, 4 a day, so none repeats
// until every word of the level has been used.

import { createRandom, forLevel, dealForDay } from '../seed.js';
import { nextRound } from '../rounds.js';
import { make, button, wiggle, roundFrame, markRight } from '../ui.js';

export const ROUNDS = 4;
export const KINDS = ['meaning', 'part']; // round 1 is a meaning round, round 2 a part round, and so on

// Every part: where it goes on the base word, and what it means.
export const PARTS = {
  un: { where: 'start', means: 'not' },
  re: { where: 'start', means: 'again' },
  ful: { where: 'end', means: 'full of' },
  less: { where: 'end', means: 'without' },
  er: { where: 'end', means: 'more, or a person who' },
  est: { where: 'end', means: 'most' },
  ly: { where: 'end', means: 'in that way' },
  pre: { where: 'start', means: 'before' },
  mis: { where: 'start', means: 'wrongly' },
  dis: { where: 'start', means: 'not, or the opposite of' },
};
// The parts each level uses: every level keeps the ones before it.
const FIRST = ['un', 're', 'ful', 'less'];
const SECOND = [...FIRST, 'er', 'est', 'ly'];
export const LEVELS = [FIRST, SECOND, [...SECOND, 'pre', 'mis', 'dis']];
const partsFor = (level) => forLevel(LEVELS, level);

/** A part the way it is written alone: "un-" goes in front, "-ful" goes after. */
export const partLabel = (part) => (PARTS[part].where === 'start' ? `${part}-` : `-${part}`);

// un- and dis- both mean "not", so one is never a wrong choice for the other:
// "Which one means not kind?" must have only one right answer.
const clash = (a, b) => a === b || [a, b].sort().join() === 'dis,un';

/** Problems with one item of the word list. An empty list means it's fine. */
export function itemProblems(item) {
  const { base, part, where, word, means, wrong, level } = item;
  if (![base, part, where, word, means].every((text) => typeof text === 'string' && text)) return ['a field is missing'];
  if (!PARTS[part]) return [`"${part}" is not a part this puzzle knows`];
  const problems = [];
  if (where !== PARTS[part].where) problems.push(`${part} goes at the ${PARTS[part].where}`);
  if (!(where === 'start' ? word.startsWith(part) : word.endsWith(part))) problems.push(`"${word}" needs "${part}" at its ${where}`);
  // The base may lose or change its last letter (happy + ly = happily), so its last letter is not checked.
  if (word === base || !word.includes(base.slice(0, -1))) problems.push(`"${word}" is not built from "${base}"`);
  if (!Array.isArray(wrong) || wrong.length !== 2 || new Set([means, ...wrong]).size !== 3) problems.push('needs a meaning and two different wrong meanings');
  if (level !== LEVELS.findIndex((parts) => parts.includes(part)) + 1) problems.push(`${part} belongs to another level`);
  return problems;
}

/** Make today's 4 rounds from a seed, the word list, the day number, and a level (1 to 3). */
export function generate(seed, items, dayNumber, level = 1) {
  const random = createRandom(seed);
  const parts = partsFor(level);
  const deck = items.filter((item) => parts.includes(item.part));
  const rounds = dealForDay(deck, ROUNDS, dayNumber, `word-builder-${level}`).map((item, i) => {
    const kind = KINDS[i % KINDS.length];
    let choices = [item.means, ...item.wrong];
    if (kind === 'part') {
      const others = random.shuffle(parts.filter((part) => !clash(part, item.part)));
      // Wrong parts that go on the same side come first, so the side of the gap gives less away.
      const sameSide = (part) => PARTS[part].where === item.where;
      choices = [item.part, ...others.filter(sameSide), ...others.filter((part) => !sameSide(part))].slice(0, 3);
    }
    return { ...item, kind, answer: choices[0], choices: random.shuffle(choices) };
  });
  return { level, rounds };
}

/** The starting state: round 0. */
export function start(puzzle) {
  return { puzzle, round: 0, tries: 0, shown: [], status: 'playing', last: null };
}

/** Answer the current round: a meaning, or a part like "un". A miss stays on the round. */
export function check(state, answer) {
  if (state.status !== 'playing') throw new Error('All the words are built.');
  // The answer is never shown: with 3 choices, the third try is always right.
  return nextRound(state, answer === state.puzzle.rounds[state.round].answer, { canShow: false });
}

const partMeans = (part) => `${partLabel(part)} means ${PARTS[part].means}.`;

/** A hint after a miss: what this word's part means, or (in a part round) what the part just picked means. */
export function hint(round, answer) {
  return round.kind === 'meaning' ? partMeans(round.part) : `${partMeans(answer)} Try another one.`;
}

/** What a finished round says: "un- means not. Unkind means not kind." */
export function explain({ part, word, means }) {
  return `${partMeans(part)} ${word[0].toUpperCase()}${word.slice(1)} means ${means}.`;
}

/** Confirm a puzzle is valid. Returns { ok, problems }. */
export function verify(puzzle) {
  const problems = [];
  const { rounds, level = 1 } = puzzle;
  const parts = partsFor(level);
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) return { ok: false, problems: [`there must be ${ROUNDS} rounds`] };
  if (new Set(rounds.map((round) => round.word)).size !== ROUNDS) problems.push('a word comes up twice');
  rounds.forEach((round, i) => {
    const where = `round ${i + 1}`;
    const { kind, part, means, wrong, answer, choices } = round;
    const found = itemProblems(round);
    problems.push(...found.map((problem) => `${where}: ${problem}`));
    if (found.length) return;
    if (kind !== KINDS[i % KINDS.length]) problems.push(`${where} should be a "${KINDS[i % KINDS.length]}" round`);
    if (!parts.includes(part)) problems.push(`${where}: ${part} is not a level ${level} part`);
    if (choices?.length !== 3 || new Set(choices).size !== 3 || !choices.includes(answer)) {
      problems.push(`${where} needs 3 different choices, one right`);
    } else if (kind === 'meaning') {
      if (answer !== means || !wrong.every((text) => choices.includes(text))) problems.push(`${where}: the choices must be the meaning and its two wrong meanings`);
    } else {
      if (answer !== part) problems.push(`${where}: the answer must be the word's own part`);
      if (!choices.every((choice) => parts.includes(choice))) problems.push(`${where}: a choice is not a level ${level} part`);
      // A wrong part that means the same as the right one would be a second right answer.
      else if (choices.some((choice) => choice !== part && clash(choice, part))) problems.push(`${where}: a wrong part means the same as the right one`);
    }
  });
  return { ok: problems.length === 0, problems };
}

// ---------- The screen ----------

/**
 * Draw the game inside `container`. Calls onDone({ status, misses, helped })
 * once when finished: misses is the wrong picks; helped is always 0.
 */
export function render(container, puzzle, onDone, session = {}) {
  let state = start(puzzle);
  let misses = 0;
  // Pick up where a half-done puzzle left off (see "Half-done puzzles" in src/app.js).
  if (session.saved) {
    state = { ...state, round: session.saved.round };
    misses = session.saved.misses;
  }
  const keep = () => session.save?.({ round: state.round, misses });
  container.replaceChildren();
  container.classList.add('wb');

  const frame = roundFrame(container, {
    count: puzzle.rounds.length,
    prefix: 'wb',
    draw(i) {
      const round = puzzle.rounds[i];
      const isMeaning = round.kind === 'meaning';
      if (isMeaning) question.append('What does ', make('strong', 'wb-word', round.word), ' mean?');
      else question.textContent = `Which one makes a word that means "${round.means}"?`;

      // The pieces joining: un + kind = unkind. In a part round the part and the whole word are "?" until it's solved.
      const partTile = make('span', `wb-tile wb-part${isMeaning ? '' : ' wb-gap'}`, isMeaning ? round.part : '?');
      const baseTile = make('span', 'wb-tile', round.base);
      const whole = make('strong', 'wb-word', isMeaning ? round.word : '?');
      const tiles = make('div', 'wb-tiles');
      tiles.append(...(round.where === 'start' ? [partTile, '+', baseTile] : [baseTile, '+', partTile]), '=', whole);

      const row = make('div', `wb-choices${isMeaning ? ' wb-meanings' : ''}`);
      for (const value of round.choices) {
        const choice = row.appendChild(button('lw-button wb-choice', isMeaning ? value : partLabel(value), () => {
          if (state.round !== i) return;
          state = check(state, value);
          if (!state.last.correct) {
            misses += 1;
            message.textContent = `Not quite. ${hint(round, value)}`;
            wiggle(choice);
            return;
          }
          markRight(choice);
          partTile.textContent = round.part;
          partTile.classList.remove('wb-gap');
          whole.textContent = round.word;
          keep();
          frame.finish(`✓ ${explain(round)}`, state.round, () => onDone({ status: state.status, misses, helped: 0 }));
        }));
      }
      stage.append(tiles, row);
    },
  });
  const { question, stage, message } = frame;
  frame.begin(state.round);
}
