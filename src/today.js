// today.js: which 5 puzzles make up "Today's set".
//
// The puzzles are in five groups (see GROUPS in src/app.js). Each day's set
// has one puzzle from Spelling, one from Reading, one from Everyday Math,
// and two from Numbers, the biggest group. Every third day the Maze (Just
// for Fun) takes the place of the second Numbers puzzle. Each group's
// puzzles come around in a fixed shuffled order, so none is left out.

import { createRandom, hashString } from './seed.js';

export const SET_SIZE = 5;
export const FUN_EVERY = 3; // the fun puzzle is in the set every 3rd day

/** A group's puzzles in its fixed shuffled order. */
const deck = (names, group) => createRandom(hashString(`${group}-set`)).shuffle(names);

/** The puzzle at place `n` of a deck that goes around forever. */
const at = (list, n) => list[n % list.length];

/**
 * Today's 5 puzzles, in playing order. `groups` has the names of the
 * puzzles in each group: { spelling, reading, numbers, everyday, fun }.
 * `dayNumber` counts days from a fixed start date.
 */
export function todaysSet(groups, dayNumber) {
  const numbers = deck(groups.numbers, 'numbers');
  const funDay = groups.fun.length > 0 && dayNumber % FUN_EVERY === FUN_EVERY - 1;
  // Numbers uses 2 a day, or 1 on a fun day; this is how many came before today.
  const used = 2 * dayNumber - Math.floor(dayNumber / FUN_EVERY);
  const last = funDay
    ? at(deck(groups.fun, 'fun'), Math.floor(dayNumber / FUN_EVERY))
    : at(numbers, used + 1);
  return [
    at(deck(groups.spelling, 'spelling'), dayNumber),
    at(numbers, used),
    at(deck(groups.reading, 'reading'), dayNumber),
    at(deck(groups.everyday, 'everyday'), dayNumber),
    last,
  ];
}
