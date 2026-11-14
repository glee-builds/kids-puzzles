// today.js: which 5 puzzles make up "Today's set".
//
// Each day's set mixes word and number puzzles: 3 of one kind and 2 of the
// other, swapping each day. The puzzles are dealt from two shuffled decks
// (words and numbers), so every puzzle comes around every 3 to 4 days and
// none is left out.

import { createRandom, hashString } from './seed.js';

export const SET_SIZE = 5;

const shuffled = (list, name) => createRandom(hashString(`${name}-set`)).shuffle(list);

/** `count` items from a deck that goes around forever, starting at `from`. */
const deal = (deck, from, count) => Array.from({ length: count }, (_, k) => deck[(from + k) % deck.length]);

/**
 * Today's 5 puzzles, in playing order (the kinds take turns).
 * `words` and `numbers` are the names of every word and number puzzle;
 * `dayNumber` counts days from a fixed start date.
 */
export function todaysSet(words, numbers, dayNumber) {
  const pairs = Math.floor(dayNumber / 2);
  const odd = dayNumber % 2 === 1;
  // Even days: 2 words and 3 numbers. Odd days: 3 words and 2 numbers.
  // Every 2 days uses 5 of each, so each deck keeps its own place.
  const wordPicks = deal(shuffled(words, 'words'), pairs * SET_SIZE + (odd ? 2 : 0), odd ? 3 : 2);
  const numberPicks = deal(shuffled(numbers, 'numbers'), pairs * SET_SIZE + (odd ? 3 : 0), odd ? 2 : 3);
  const [more, fewer] = odd ? [wordPicks, numberPicks] : [numberPicks, wordPicks];
  return [more[0], fewer[0], more[1], fewer[1], more[2]];
}
