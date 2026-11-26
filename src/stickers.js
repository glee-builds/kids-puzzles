// stickers.js: the sticker book.
//
// Finishing a puzzle (the first time that day) gives a gift with a new
// sticker inside. Stickers are pictures the phone already has (emoji), so
// there is nothing to download. They are all older emoji (2019 or
// earlier), so they show up on older phones too. A gift is never a repeat:
// each one is a sticker the player doesn't have yet, until the book is full.
// After that, gifts are shiny copies: each sticker once more, with a gold
// edge and a sparkle, until every sticker is shiny. Then rainbow copies:
// each once more, with a rainbow edge, until every sticker is rainbow.

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
  // Pages added later go at the end, and stickers already here never move:
  // a sticker is saved by its page and place ("0-3"), so moving one would
  // change what a player owns (tests/stickers.test.js checks the first 16 pages).
  { name: 'The Farm', stickers: [['🐮', 'cow'], ['🐷', 'pig'], ['🐑', 'sheep'], ['🐐', 'goat'], ['🐴', 'horse'], ['🦃', 'turkey'], ['🐭', 'mouse'], ['🦙', 'llama'], ['🐂', 'ox'], ['🐔', 'hen'], ['🥛', 'milk'], ['🧀', 'cheese'], ['🍯', 'honey'], ['🍞', 'bread'], ['🧺', 'basket']] },
  { name: 'Dinosaurs and Magic', stickers: [['🦕', 'dinosaur'], ['🦖', 'T. rex'], ['🐉', 'dragon'], ['🦄', 'unicorn'], ['🧚', 'fairy'], ['🧜', 'mermaid'], ['🧙', 'wizard'], ['🧞', 'genie'], ['🦇', 'bat'], ['🐍', 'snake'], ['🗝️', 'old key'], ['💎', 'gem'], ['🔮', 'crystal ball'], ['🛡️', 'shield'], ['🧪', 'potion']] },
  { name: 'The Garden', stickers: [['🌷', 'tulip'], ['🌹', 'rose'], ['🌺', 'hibiscus'], ['🌼', 'daisy'], ['🌻', 'sunflower'], ['🌳', 'tree'], ['🌲', 'pine tree'], ['🌴', 'palm tree'], ['🌵', 'cactus'], ['🍀', 'clover'], ['🍁', 'maple leaf'], ['🍂', 'fall leaves'], ['🍄', 'mushroom'], ['🌱', 'sprout'], ['💐', 'bouquet']] },
  { name: 'Make and Build', stickers: [['🔨', 'hammer'], ['🔧', 'wrench'], ['🧰', 'toolbox'], ['✂️', 'scissors'], ['🖍️', 'crayon'], ['✏️', 'pencil'], ['📏', 'ruler'], ['🧵', 'thread'], ['🧶', 'yarn'], ['🧲', 'magnet'], ['🔦', 'flashlight'], ['💡', 'light bulb'], ['🧱', 'bricks'], ['📎', 'paper clip'], ['🖌️', 'paintbrush']] },
  { name: 'Sports', stickers: [['⚾', 'baseball'], ['🏈', 'football'], ['🎾', 'tennis ball'], ['🏐', 'volleyball'], ['🏓', 'ping-pong'], ['🏸', 'badminton'], ['🥅', 'goal'], ['⛳', 'golf flag'], ['🎳', 'bowling'], ['🥋', 'karate suit'], ['⛸️', 'ice skate'], ['🎿', 'skis'], ['🏹', 'bow and arrow'], ['🥇', 'gold medal'], ['🎯', 'bullseye']] },
  { name: 'Treats', stickers: [['🍩', 'donut'], ['🍰', 'cake'], ['🎂', 'birthday cake'], ['🍫', 'chocolate'], ['🍬', 'candy'], ['🍭', 'lollipop'], ['🍿', 'popcorn'], ['🥧', 'pie'], ['🧇', 'waffle'], ['🌮', 'taco'], ['🍔', 'burger'], ['🍟', 'fries'], ['🥪', 'sandwich'], ['🍝', 'spaghetti'], ['🍒', 'cherries']] },
  { name: 'Party and Fair', stickers: [['🎉', 'party popper'], ['🎁', 'gift'], ['🎀', 'ribbon'], ['🎊', 'confetti ball'], ['🎃', 'pumpkin'], ['⛄', 'snowman'], ['🎆', 'fireworks'], ['🎇', 'sparkler'], ['🕯️', 'candle'], ['🎭', 'masks'], ['🎟️', 'ticket'], ['🎠', 'carousel horse'], ['🎡', 'Ferris wheel'], ['🎢', 'roller coaster'], ['🎩', 'top hat']] },
  { name: 'Places', stickers: [['🏔️', 'mountain'], ['🏝️', 'island'], ['🏜️', 'desert'], ['🏕️', 'camping tent'], ['🏠', 'house'], ['🏫', 'school'], ['🗼', 'tower'], ['🗽', 'statue'], ['🌉', 'bridge'], ['⛲', 'fountain'], ['🧭', 'compass'], ['🗺️', 'map'], ['🎒', 'backpack'], ['🧳', 'suitcase'], ['🏖️', 'beach']] },
  { name: 'Wild Animals', stickers: [['🐺', 'wolf'], ['🐗', 'boar'], ['🦌', 'deer'], ['🦏', 'rhino'], ['🦛', 'hippo'], ['🐪', 'camel'], ['🦍', 'gorilla'], ['🦧', 'orangutan'], ['🐆', 'leopard'], ['🦥', 'sloth'], ['🦨', 'skunk'], ['🦡', 'badger'], ['🐃', 'water buffalo'], ['🐹', 'hamster'], ['🐾', 'paw prints']] },
  { name: 'Pets and Friends', stickers: [['🐕', 'pup'], ['🐩', 'poodle'], ['🦮', 'guide dog'], ['🐈', 'house cat'], ['🐇', 'bunny'], ['🐁', 'white mouse'], ['🐀', 'rat'], ['🐤', 'baby chick'], ['🐣', 'hatching chick'], ['🕊️', 'dove'], ['🐎', 'racehorse'], ['🐏', 'ram'], ['🐖', 'hog'], ['🐄', 'dairy cow'], ['🦴', 'bone']] },
  { name: 'Fruits and Veggies', stickers: [['🍐', 'pear'], ['🍑', 'peach'], ['🍋', 'lemon'], ['🥝', 'kiwi'], ['🥭', 'mango'], ['🍈', 'melon'], ['🥥', 'coconut'], ['🍅', 'tomato'], ['🥑', 'avocado'], ['🥦', 'broccoli'], ['🥒', 'cucumber'], ['🌶️', 'pepper'], ['🥔', 'potato'], ['🍆', 'eggplant'], ['🧅', 'onion']] },
  { name: 'Lunchtime', stickers: [['🍳', 'fried egg'], ['🥓', 'bacon'], ['🥐', 'croissant'], ['🥖', 'baguette'], ['🥯', 'bagel'], ['🌭', 'hot dog'], ['🌯', 'burrito'], ['🥗', 'salad'], ['🍜', 'noodles'], ['🍚', 'rice'], ['🍣', 'sushi'], ['🥟', 'dumpling'], ['🍤', 'fried shrimp'], ['🥣', 'cereal bowl'], ['🧃', 'juice box']] },
  { name: 'Clothes', stickers: [['👕', 'T-shirt'], ['👖', 'jeans'], ['🧦', 'socks'], ['🧤', 'gloves'], ['🧣', 'scarf'], ['🧢', 'cap'], ['👒', 'sun hat'], ['👟', 'sneaker'], ['👢', 'boot'], ['🥾', 'hiking boot'], ['👗', 'dress'], ['🧥', 'coat'], ['👓', 'glasses'], ['🕶️', 'sunglasses'], ['☂️', 'umbrella']] },
  { name: 'Music and Shows', stickers: [['🎹', 'piano'], ['🎻', 'violin'], ['🎷', 'saxophone'], ['🪕', 'banjo'], ['🎤', 'microphone'], ['🎧', 'headphones'], ['🎼', 'sheet music'], ['🎵', 'music note'], ['🔔', 'bell'], ['📻', 'radio'], ['📣', 'megaphone'], ['🎬', 'clapper board'], ['🎥', 'movie camera'], ['📺', 'TV'], ['📯', 'horn']] },
  { name: 'School', stickers: [['📚', 'books'], ['📖', 'open book'], ['📓', 'notebook'], ['🖊️', 'pen'], ['📐', 'triangle ruler'], ['🧮', 'abacus'], ['🔬', 'microscope'], ['🌡️', 'thermometer'], ['🔍', 'magnifying glass'], ['📌', 'pushpin'], ['📅', 'calendar'], ['⏰', 'alarm clock'], ['🖥️', 'computer'], ['🎓', 'graduation cap'], ['🔖', 'bookmark']] },
  { name: 'At Home', stickers: [['🛏️', 'bed'], ['🛋️', 'couch'], ['🪑', 'chair'], ['🚪', 'door'], ['🛁', 'bathtub'], ['🚿', 'shower'], ['🧼', 'soap'], ['🧽', 'sponge'], ['🧹', 'broom'], ['🔑', 'key'], ['🕰️', 'clock'], ['📷', 'camera'], ['☎️', 'telephone'], ['🖼️', 'picture frame'], ['📦', 'box']] },
  { name: 'Weather', stickers: [['🌧️', 'rain cloud'], ['⛈️', 'storm'], ['🌤️', 'sunny cloud'], ['🌪️', 'tornado'], ['🌫️', 'fog'], ['💧', 'droplet'], ['☔', 'rainy umbrella'], ['🌬️', 'wind'], ['🔥', 'fire'], ['🌞', 'smiling sun'], ['🌝', 'smiling moon'], ['🌠', 'shooting star'], ['🌄', 'sunrise'], ['🌇', 'sunset'], ['🌟', 'glowing star']] },
  { name: 'More Rides', stickers: [['🚑', 'ambulance'], ['🚓', 'police car'], ['🚕', 'taxi'], ['🚚', 'truck'], ['🚛', 'big truck'], ['🚐', 'van'], ['🏎️', 'race car'], ['🏍️', 'motorcycle'], ['🛵', 'motor scooter'], ['🚋', 'tram'], ['🚇', 'subway'], ['🚢', 'ship'], ['🛸', 'flying saucer'], ['🚦', 'traffic light'], ['🪂', 'parachute']] },
  { name: 'In Town', stickers: [['🏡', 'cottage'], ['🏢', 'office building'], ['🏥', 'hospital'], ['🏦', 'bank'], ['🏪', 'shop'], ['🏨', 'hotel'], ['🏭', 'factory'], ['🏛️', 'museum'], ['🏟️', 'stadium'], ['🚏', 'bus stop'], ['🏗️', 'crane'], ['🌆', 'city'], ['🛒', 'shopping cart'], ['📮', 'mailbox'], ['🛤️', 'railway track']] },
  { name: 'Shapes and Colors', stickers: [['❤️', 'red heart'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'], ['💙', 'blue heart'], ['💜', 'purple heart'], ['🔴', 'red circle'], ['🟠', 'orange circle'], ['🟡', 'yellow circle'], ['🟢', 'green circle'], ['🔵', 'blue circle'], ['🟣', 'purple circle'], ['🔺', 'red triangle'], ['🔷', 'blue diamond'], ['🟩', 'green square']] },
  { name: 'Funny Faces', stickers: [['😀', 'grin'], ['😂', 'laughing'], ['😎', 'cool'], ['🤩', 'star eyes'], ['🥳', 'party face'], ['😴', 'sleepy'], ['🤔', 'thinking'], ['😜', 'silly'], ['🤓', 'nerdy'], ['😇', 'angel face'], ['🤠', 'cowboy'], ['🤖', 'robot'], ['👽', 'alien'], ['👻', 'ghost'], ['😺', 'happy cat']] },
  { name: 'Treasure', stickers: [['💰', 'money bag'], ['💍', 'ring'], ['🥈', 'silver medal'], ['🥉', 'bronze medal'], ['🏅', 'sports medal'], ['🏵️', 'rosette'], ['💌', 'love letter'], ['⏳', 'hourglass'], ['🏺', 'old jar'], ['📜', 'scroll'], ['🔒', 'padlock'], ['🔱', 'trident'], ['💠', 'jewel'], ['🏮', 'lantern'], ['🎐', 'wind chime']] },
  { name: 'More Games', stickers: [['🎮', 'game controller'], ['🕹️', 'joystick'], ['♟️', 'chess pawn'], ['🎱', 'eight ball'], ['🥏', 'flying disc'], ['🏒', 'hockey stick'], ['🏑', 'field hockey'], ['🥍', 'lacrosse'], ['🏏', 'cricket bat'], ['🥊', 'boxing glove'], ['🤿', 'diving mask'], ['🎣', 'fishing pole'], ['🎽', 'running shirt'], ['🥌', 'curling stone'], ['🎏', 'fish kite']] },
  { name: 'In the Kitchen', stickers: [['🍴', 'fork and knife'], ['🥄', 'spoon'], ['🍽️', 'plate'], ['🥢', 'chopsticks'], ['🍵', 'tea'], ['☕', 'hot drink'], ['🥤', 'cup with straw'], ['🍼', 'baby bottle'], ['🧂', 'salt'], ['🧈', 'butter'], ['🥫', 'can of food'], ['🍲', 'stew'], ['🥘', 'pan'], ['🧊', 'ice cube'], ['🍱', 'lunch box']] },
];

/** Every sticker as { id, picture, name, page }. The id is "page-number". */
export const STICKERS = PAGES.flatMap((page, p) =>
  page.stickers.map(([picture, name], i) => ({ id: `${p}-${i}`, picture, name, page: p })));

// The order gifts are given in: mixed across the pages, the same for
// everyone, so the book fills in all over rather than one page at a time.
const ORDER = createRandom(hashString('sticker-gifts')).shuffle(STICKERS.map((s) => s.id));

export const stickerById = (id) => STICKERS.find((s) => s.id === id);

// The copies a sticker can be won as once the book is full, in order.
const TIERS = ['shiny', 'rainbow'];

/**
 * The next gift for someone who owns `owned` (a list of ids), with the
 * copies they have in `copies` ({ shiny: [ids], rainbow: [ids] }): a new
 * sticker; or with a full book a shiny copy ({ ...sticker, tier: 'shiny' });
 * or with those full too a rainbow copy; or null once every sticker is rainbow.
 */
export function nextSticker(owned = [], copies = {}) {
  const fresh = ORDER.find((id) => !owned.includes(id));
  if (fresh) return stickerById(fresh);
  for (const tier of TIERS) {
    const again = ORDER.find((id) => !(copies[tier] || []).includes(id));
    if (again) return { ...stickerById(again), tier };
  }
  return null;
}
