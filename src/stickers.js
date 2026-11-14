// stickers.js: the sticker book.
//
// Finishing a puzzle (the first time that day) gives a gift with a new
// sticker inside. Stickers are pictures the phone already has (emoji), so
// there is nothing to download. They are all older emoji (2019 or
// earlier), so they show up on older phones too. A gift is never a repeat:
// each one is a sticker the player doesn't have yet, until the book is full.

import { createRandom, hashString } from './seed.js';

// The book's pages. Each sticker is [picture, name].
export const PAGES = [
  { name: 'The Pond', stickers: [['🐸', 'frog'], ['🦆', 'duck'], ['🐢', 'turtle'], ['🐟', 'fish'], ['🦢', 'swan'], ['🐌', 'snail'], ['🦎', 'lizard'], ['🌸', 'blossom'], ['🌾', 'reeds'], ['🦦', 'otter'], ['🐿️', 'chipmunk'], ['🦝', 'raccoon'], ['🐊', 'crocodile'], ['🦩', 'flamingo'], ['🌿', 'fern']] },
  { name: 'Animals', stickers: [['🐶', 'dog'], ['🐱', 'cat'], ['🐰', 'rabbit'], ['🦊', 'fox'], ['🐻', 'bear'], ['🐼', 'panda'], ['🐨', 'koala'], ['🦁', 'lion'], ['🐯', 'tiger'], ['🐘', 'elephant'], ['🦒', 'giraffe'], ['🦓', 'zebra'], ['🐵', 'monkey'], ['🦘', 'kangaroo'], ['🦔', 'hedgehog']] },
  { name: 'The Sea', stickers: [['🐳', 'whale'], ['🐬', 'dolphin'], ['🦈', 'shark'], ['🐙', 'octopus'], ['🦀', 'crab'], ['🦞', 'lobster'], ['🐠', 'tropical fish'], ['🐡', 'puffer fish'], ['🦑', 'squid'], ['🐚', 'shell'], ['🦐', 'shrimp'], ['🐧', 'penguin'], ['🐋', 'blue whale'], ['⚓', 'anchor'], ['⛵', 'sailboat']] },
  { name: 'Bugs and Birds', stickers: [['🦋', 'butterfly'], ['🐝', 'bee'], ['🐞', 'ladybug'], ['🐛', 'caterpillar'], ['🐜', 'ant'], ['🦗', 'cricket'], ['🕷️', 'spider'], ['🦉', 'owl'], ['🦜', 'parrot'], ['🦅', 'eagle'], ['🐦', 'bird'], ['🦚', 'peacock'], ['🐥', 'chick'], ['🥚', 'egg'], ['🐓', 'rooster']] },
  { name: 'Yummy', stickers: [['🍎', 'apple'], ['🍌', 'banana'], ['🍓', 'strawberry'], ['🍉', 'watermelon'], ['🍇', 'grapes'], ['🍊', 'orange'], ['🍍', 'pineapple'], ['🥕', 'carrot'], ['🌽', 'corn'], ['🍕', 'pizza'], ['🥞', 'pancakes'], ['🧁', 'cupcake'], ['🍪', 'cookie'], ['🍦', 'ice cream'], ['🥨', 'pretzel']] },
  { name: 'Sky and Space', stickers: [['☀️', 'sun'], ['🌙', 'moon'], ['⭐', 'star'], ['🌈', 'rainbow'], ['☁️', 'cloud'], ['⚡', 'lightning'], ['❄️', 'snowflake'], ['🌍', 'Earth'], ['🪐', 'planet'], ['🚀', 'rocket'], ['🛰️', 'satellite'], ['☄️', 'comet'], ['🔭', 'telescope'], ['🌋', 'volcano'], ['🌊', 'wave']] },
  { name: 'On the Go', stickers: [['🚲', 'bike'], ['🛴', 'scooter'], ['🚗', 'car'], ['🚌', 'bus'], ['🚂', 'train'], ['🚜', 'tractor'], ['🚒', 'fire truck'], ['🚁', 'helicopter'], ['✈️', 'airplane'], ['🎈', 'balloon'], ['🛶', 'canoe'], ['🚤', 'speedboat'], ['🛷', 'sled'], ['🚠', 'cable car'], ['🛹', 'skateboard']] },
  { name: 'Play', stickers: [['⚽', 'soccer ball'], ['🏀', 'basketball'], ['🪁', 'kite'], ['🎨', 'paint'], ['🎸', 'guitar'], ['🥁', 'drum'], ['🎺', 'trumpet'], ['🧩', 'puzzle piece'], ['🪀', 'yo-yo'], ['🎲', 'dice'], ['🧸', 'teddy bear'], ['🎪', 'circus tent'], ['🏰', 'castle'], ['👑', 'crown'], ['🏆', 'trophy']] },
];

/** Every sticker as { id, picture, name, page }. The id is "page-number". */
export const STICKERS = PAGES.flatMap((page, p) =>
  page.stickers.map(([picture, name], i) => ({ id: `${p}-${i}`, picture, name, page: p })));

// The order gifts are given in: mixed across the pages, the same for
// everyone, so the book fills in all over rather than one page at a time.
const ORDER = createRandom(hashString('sticker-gifts')).shuffle(STICKERS.map((s) => s.id));

export const stickerById = (id) => STICKERS.find((s) => s.id === id);

/** The next sticker for someone who owns `owned` (a list of ids), or null if the book is full. */
export function nextSticker(owned = []) {
  const id = ORDER.find((candidate) => !owned.includes(candidate));
  return id ? stickerById(id) : null;
}
