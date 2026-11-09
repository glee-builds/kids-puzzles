// sw.js: the service worker. It lets Lily Pad open without internet, and
// keeps the phone from mixing old and new files after an update.
//
// A service worker is a small script the phone keeps between the app and
// the internet. This one works like this:
//   - Online: always ask for the newest copy of each file (so an update
//     shows up right away, all at once), and save that copy.
//   - Offline: use the saved copy.
//   - When it's first installed, it saves every file in FILES, so every
//     game works offline even before it has been opened.
//
// When you add a file the app needs (a new game, a data file, an image),
// add it to FILES. tests/offline.test.js fails if one is missing.

const CACHE = 'lily-pad-v1';

// Every file the app needs, relative to this file. './' is the app itself.
const FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'src/app.js',
  'src/pond.js',
  'src/progress.js',
  'src/seed.js',
  'src/ui.js',
  'src/games/fact-families.js',
  'src/games/find-the-mistake.js',
  'src/games/fix-sentence.js',
  'src/games/letter-scramble.js',
  'src/games/magic-square.js',
  'src/games/maze.js',
  'src/games/number-line.js',
  'src/games/number-pyramid.js',
  'src/games/story-order.js',
  'src/games/word-clues.js',
  'src/games/word-guess.js',
  'src/games/word-ladder.js',
  'src/games/word-problems.js',
  'src/games/word-search.js',
  'data/fix-sentences.json',
  'data/rich-words.json',
  'data/search-themes.json',
  'data/stories.json',
  'data/word-problems.json',
  'data/words/ladder.json',
  'data/words/level-1.json',
  'data/words/level-2.json',
  'data/words/level-3.json',
  'assets/apple-touch-icon.png',
  'assets/frog.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon.svg',
  'assets/fonts/andika-latin-400-normal.woff2',
  'assets/fonts/andika-latin-700-normal.woff2',
];

// First install: save every file. `cache: 'reload'` skips the browser's own
// short-term copies, so the saved set is all from the same version.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

// Clear out saved files from any older version of this worker, and start
// looking after the app right away.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

/** Ask the internet for the newest copy and save it; if that fails, use the saved copy. */
async function newestOrSaved(request) {
  const cache = await caches.open(CACHE);
  try {
    // `no-cache` checks with GitHub every time (a quick "has this changed?"),
    // instead of using a copy the browser kept for up to 10 minutes.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(request, { ignoreSearch: true })
      // Opening the app itself (any address) offline: show the saved app.
      ?? (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only this app's own files. (The app makes no other requests anyway.)
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(newestOrSaved(request));
});
