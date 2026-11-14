// screens.mjs: open every screen in a real browser and check it draws.
//
// The other tests check puzzle logic. This one checks the screens: it
// starts the app, opens the home screen and every puzzle at phone size
// (today's and yesterday's), and fails if a screen doesn't draw, shows the
// "Oops" message, logs an error, or (for a puzzle) doesn't fit the screen.
// At the end it turns its web server off and opens every screen again, to
// prove the app works with no internet.
// Some puzzles (see PLAYS below) are also played all the way to the end.
//
// The check always plays the same date (2026-11-13), so it gives the same
// result every day. To look at other days too (only whether each puzzle
// fits the screen), add how many:  node tests/screens.mjs --days=30
// and, to look at one puzzle only on those days:  --only=maze
//
// Run it with:  node tests/screens.mjs
// It needs Google Chrome (GitHub's test computers have it) and nothing else.
// It is not a *.test.js file, so "node --test" doesn't run it.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PHONE = { width: 375, height: 667 };
const FIRST_DAY = [2026, 10, 13]; // year, month (0 = January), day
const ONLY = process.argv.find((arg) => arg.startsWith('--only='))?.split('=')[1]; // with --days: just this puzzle
const DAYS = Number(process.argv.find((arg) => arg.startsWith('--days='))?.split('=')[1] || 1);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

// ---------- A tiny web server for the app's files ----------

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------- Start Chrome and talk to it ----------

const chromePath = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path) => path && existsSync(path));
if (!chromePath) {
  console.error('Could not find Google Chrome. Set CHROME to its path.');
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), 'lily-pad-screens-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox', 'about:blank',
]);
const wsUrl = await new Promise((resolve, reject) => {
  let text = '';
  chrome.stderr.on('data', (chunk) => {
    text += chunk;
    const found = text.match(/DevTools listening on (ws:\/\/\S+)/);
    if (found) resolve(found[1]);
  });
  chrome.on('exit', () => reject(new Error(`Chrome stopped early:\n${text}`)));
  setTimeout(() => reject(new Error('Chrome did not start in 20 seconds')), 20000);
});

const socket = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let nextId = 1;
const waiting = new Map();
const listeners = [];
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && waiting.has(message.id)) {
    const { resolve, reject } = waiting.get(message.id);
    waiting.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  } else {
    for (const listener of listeners) listener(message);
  }
};
/** Send Chrome a command and wait for its answer. */
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = nextId++;
  waiting.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, sessionId }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
await page('Page.enable');
await page('Runtime.enable');
await page('Emulation.setDeviceMetricsOverride', { ...PHONE, deviceScaleFactor: 2, mobile: true });

/** Make every page think today is `offset` days after the first day (10 in the morning). */
let dateScript = null;
async function setDay(offset) {
  if (dateScript) await page('Page.removeScriptToEvaluateOnNewDocument', { identifier: dateScript });
  const [year, month, day] = FIRST_DAY;
  const source = `(() => {
    const Real = Date;
    const shift = new Real(${year}, ${month}, ${day + offset}, 10).getTime() - Real.now();
    window.Date = class extends Real {
      constructor(...args) { if (args.length) super(...args); else super(Real.now() + shift); }
      static now() { return Real.now() + shift; }
    };
  })();`;
  dateScript = (await page('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
}
await setDay(0);

// Errors the page logs or throws while a screen is open.
let errors = [];
listeners.push((message) => {
  if (message.method === 'Runtime.exceptionThrown') {
    const details = message.params.exceptionDetails;
    errors.push(details.exception?.description || details.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  }
});

/** Run JavaScript in the page and get its value back. */
async function evaluate(expression) {
  const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Open an address fresh, and wait until `ready` (a JavaScript test) is true. */
async function open(address, ready) {
  errors = [];
  await page('Page.navigate', { url: 'about:blank' });
  await page('Page.navigate', { url: `${origin}/${address}` });
  for (let tries = 0; tries < 100; tries++) {
    await sleep(100);
    try {
      if (await evaluate(`Boolean(window.lilyPadStarted) && (${ready})`)) return true;
    } catch { /* the page is still loading */ }
  }
  return false;
}

// ---------- Playing a puzzle to the end ----------

// Each of these runs inside the page and plays one puzzle until it is
// finished, the way a player would: tapping buttons and typing. `G` is the
// puzzle's area on the screen. Puzzles not listed here are only opened.
const HELPERS = `
  const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  const type = async (text) => { for (const ch of String(text)) key(ch); key('Enter'); await wait(); };
  const message = () => G.querySelector('.message')?.textContent || '';
  const next = async () => { G.querySelector('.next-button:not([hidden])')?.click(); await wait(); };
  // Tap each of these buttons until one is right (the message starts with a check mark).
  const tapUntilRight = async (selector) => {
    for (const choice of G.querySelectorAll(selector)) {
      if (choice.disabled) continue;
      choice.click();
      await wait();
      if (message().startsWith('✓')) return;
    }
  };
  const seed = await import('/src/seed.js');
  const today = seed.dateKey();
  const dayNumber = Math.round((new Date(today) - new Date('2026-01-01')) / 86400000);
`;
const PLAYS = {
  'number-line': `
    const game = await import('/src/games/number-line.js');
    const spots = game.positions(game.generate(seed.seedFor(today, 'number-line')));
    for (const spot of spots.slice(1)) await type(spot);`,
  'mystery-word': `
    for (let guess = 0; guess < 6; guess++) {
      await type('zzzzz'); await wait(350);
      // After the third wrong guess the clue sentence shows, and the screen must still fit.
      if (guess === 2) {
        if (!G.querySelector('.wg-sentence')) throw new Error('no clue sentence after 3 wrong guesses');
        // Try the longest sentence in the list too.
        G.querySelector('.wg-sentence').textContent = 'Clue: The ___ moved slowly across the leaf, leaving a shiny line.';
        await wait();
        if (document.documentElement.scrollHeight > innerHeight) throw new Error('the clue sentence makes the screen ' + (document.documentElement.scrollHeight - innerHeight) + 'px too tall');
      }
    }`,
  'clock-time': `
    for (let clock = 0; clock < 5; clock++) { await tapUntilRight('.ct-choice'); await next(); }`,
  'coin-count': `
    const game = await import('/src/games/coin-count.js');
    const rounds = game.generate(seed.seedFor(today, 'coin-count')).rounds;
    await type(99); await type(98);          // two misses on the first handful
    for (const round of rounds) { await type(round.total); await next(); }`,
  'bug-groups': `
    await tapUntilRight('.grp-picture'); await next();
    for (const pad of G.querySelectorAll('button.grp-pad')) pad.click();
    await wait();
    await tapUntilRight('.grp-choice'); await next();
    const [, pads, bugs] = G.querySelector('.grp-ask').textContent.match(/(\\d+) × (\\d+)/);
    const more = G.querySelectorAll('[aria-label^="More"]');
    for (let i = 1; i < Number(pads); i++) more[0].click();
    for (let i = 1; i < Number(bugs); i++) more[1].click();
    G.querySelector('.grp-check').click();`,
  'garden-rows': `
    for (const row of G.querySelectorAll('button.gr-row')) row.click();
    await wait();
    await tapUntilRight('.grp-choice'); await next();
    G.querySelector('.gr-turn').click(); await wait(900);
    await tapUntilRight('.grp-choice'); await next();
    await tapUntilRight('.grp-choice');`,
  'spell-it': `
    const game = await import('/src/games/spell-it.js');
    const { words } = await (await fetch('/data/spelling.json')).json();
    const rounds = game.generate(seed.seedFor(today, 'spell-it'), words, dayNumber).rounds;
    for (const round of rounds) {
      if (round.kind === 'spell') { await type('zzzzz'); await type(round.word); } // one miss, then right
      else await tapUntilRight('.sp-choice');
      await next();
    }`,
  'end-marks': `
    for (let round = 0; round < 3; round++) { await tapUntilRight('.em-mark'); await next(); }
    for (let tries = 0; tries < 3; tries++) {            // three misses: the answer is shown
      G.querySelector('.em-spot:not(:disabled)')?.click();
      G.querySelector('.em-check')?.click(); await wait();
      G.querySelector('.em-spot-on:not(:disabled)')?.click();
    }
    await next();
    for (let tries = 0; tries < 3 && G.querySelector('.em-check'); tries++) {
      for (const line of G.querySelectorAll('.em-line')) line.querySelector('button').click();
      G.querySelector('.em-check').click(); await wait();
    }`,
};

// Short pokes at puzzles that aren't played to the end: do something a
// player might, and let the error check catch a crash.
const POKES = {
  // Change each letter of the first word to q, x, and z: most are not words,
  // which makes the ladder wiggle and say so.
  'word-ladder': `
    for (const letter of 'qxz') {
      for (let k = 0; k < 3; k++) {
        G.querySelectorAll('button.wl-tile')[k]?.click(); await wait(40);
        key(letter); await wait(60);
      }
    }
    if (!message()) throw new Error('typing letters did nothing');`,
};

// The puzzles that have levels. Each is also opened at its top level.
// (A saved level above a puzzle's top is treated as its top.)
const TOP_LEVELS = ['clock-time', 'coin-count', 'letter-scramble', 'word-search', 'spell-it', 'end-marks', 'number-pyramid', 'magic-square', 'fact-families', 'bug-groups', 'garden-rows', 'maze'];

// How each played puzzle should be rated, given how PLAYS plays it.
const EXPECTED = {
  'number-line': 'easy',   // every answer right the first time
  'mystery-word': 'hard',  // never found: the word is shown
  'end-marks': 'hard',     // two rounds are shown after 3 misses
  'coin-count': 'ok',      // two misses, no totals shown
};

// ---------- The checks ----------

const problems = [];
let checked = 0;
let serverIsOff = false;

async function checkScreen(label, address, { ready, fits, play, poke, tip }) {
  checked++;
  const ok = await open(address, ready);
  await sleep(150); // let anything late (fonts, a first draw) settle
  const found = [];
  if (!ok) found.push('did not finish drawing in 10 seconds');
  // A puzzle opened for the first time shows "How to play" first.
  if (ok && tip) {
    const lines = await evaluate('document.querySelectorAll(".view:not([hidden]) .how-line").length');
    if (lines < 2) found.push('did not show its "How to play" card');
    await evaluate('document.querySelector(".view:not([hidden]) .how-ok")?.click()');
    await sleep(100);
    if (await evaluate('Boolean(document.querySelector(".view:not([hidden]) .how-to"))')) found.push('"Got it!" did not close the card');
  }
  const text = await evaluate('document.querySelector(".view:not([hidden])")?.innerText || ""');
  if (text.includes('Oops, the puzzle could not load')) found.push('shows the "Oops, the puzzle could not load" message');
  if (text.trim().length < 10) found.push('is nearly empty');
  if (fits) {
    const height = await evaluate('document.documentElement.scrollHeight');
    if (height > PHONE.height) found.push(`is ${height}px tall, taller than a ${PHONE.height}px phone screen`);
  }
  if (ok && play) {
    try {
      await evaluate(`(async () => { const G = document.getElementById('game-${play}'); ${HELPERS} ${PLAYS[play]} })()`);
      await sleep(900); // the celebration card comes up a moment after the last answer
      if (await evaluate('document.getElementById("done").hidden')) found.push('was played to the end, but the celebration card did not appear');
      else if (await evaluate('document.getElementById("gift").hidden')) found.push('finished, but there was no gift');
      else {
        // How it went (easy, ok, or hard) should be saved for the grown-up page and levels.
        const saved = await evaluate(`JSON.parse(localStorage.getItem('kids-puzzles.progress')).results?.['${play}']?.[0]?.score || ''`);
        if (!['easy', 'ok', 'hard'].includes(saved)) found.push('finished, but how it went was not saved');
        else if (EXPECTED[play] && saved !== EXPECTED[play]) found.push(`was saved as "${saved}", but the way it was played should be "${EXPECTED[play]}"`);
      }
    } catch (error) {
      found.push(`could not be played: ${String(error.message).split('\n')[0]}`);
    }
  }
  if (ok && POKES[poke]) {
    try {
      await evaluate(`(async () => { const G = document.getElementById('game-${poke}'); ${HELPERS} ${POKES[poke]} })()`);
    } catch (error) {
      found.push(`broke when poked: ${String(error.message).split('\n')[0]}`);
    }
  }
  for (const error of errors) found.push(`logged an error: ${String(error).split('\n')[0]}`);
  if (found.length) problems.push(`${label}: ${found.join('; ')}`);
  console.log(`${found.length ? '✗' : '✓'} ${label}${play ? ' (played to the end)' : ''}`);
}

try {
  // The home screen lists every puzzle, so the list of puzzles comes from it.
  await checkScreen('Home', '', { ready: 'document.querySelectorAll("#today-list a").length === 5' });
  const games = await evaluate('[...document.querySelectorAll("a.card-play")].map((card) => card.getAttribute("href").slice(1))');
  if (games.length < 10) problems.push(`Home: only ${games.length} puzzle cards`);

  for (const day of ['', '?day=yesterday']) {
    for (const game of games) {
      const label = `${game}${day ? ' (yesterday)' : ''}`;
      // Drawn means: the "Getting today's puzzle" line is gone and something replaced it.
      const ready = `!document.querySelector('#game-${game} .loading') && document.querySelector('#game-${game}').children.length > 0`;
      await checkScreen(label, `${day}#${game}`, { ready, fits: true, play: !day && PLAYS[game] ? game : null, poke: day ? null : game, tip: !day });
    }
  }
  await checkScreen('Sticker book', '#stickers', { ready: 'document.querySelectorAll(".sb-sticker").length > 100' });
  await checkScreen('For grown-ups', '#grown-ups', { ready: 'document.querySelectorAll(".gu-day").length === 28' });
  await checkScreen('Yesterday home', '?day=yesterday', { ready: 'document.getElementById("today-title").textContent.includes("Yesterday")' });

  // Puzzles with levels, at their top level: do they still draw and fit?
  const levels = Object.fromEntries(TOP_LEVELS.map((game) => [game, { now: 9, was: 9, since: null }]));
  await evaluate(`(() => {
    const progress = JSON.parse(localStorage.getItem('kids-puzzles.progress'));
    localStorage.setItem('kids-puzzles.progress', JSON.stringify({ ...progress, levels: ${JSON.stringify(levels)} }));
  })()`);
  for (const game of TOP_LEVELS) {
    const ready = `!document.querySelector('#game-${game} .loading') && document.querySelector('#game-${game}').children.length > 0`;
    await checkScreen(`${game} (top level)`, `#${game}`, { ready, fits: true });
  }
  await evaluate(`(() => {
    const progress = JSON.parse(localStorage.getItem('kids-puzzles.progress'));
    localStorage.setItem('kids-puzzles.progress', JSON.stringify({ ...progress, levels: {} }));
  })()`);

  // Offline: wait until the service worker has saved every file, turn the
  // web server off, and open every screen again. Nothing can come from the
  // network now, so each screen has to come from what was saved.
  await open('', 'true');
  const saved = await evaluate(`(async () => {
    await navigator.serviceWorker.ready;
    for (let tries = 0; tries < 100; tries++) {
      const names = await caches.keys();
      const count = names.length ? (await (await caches.open(names[0])).keys()).length : 0;
      if (count >= 40) return count;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return 0;
  })()`);
  if (!saved) problems.push('Offline: the service worker did not save the app\'s files');
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  serverIsOff = true;
  await checkScreen('Home (offline)', '', { ready: 'document.querySelectorAll("#today-list a").length === 5' });
  for (const game of games) {
    const ready = `!document.querySelector('#game-${game} .loading') && document.querySelector('#game-${game}').children.length > 0`;
    await checkScreen(`${game} (offline)`, `#${game}`, { ready });
  }
  await checkScreen('Sticker book (offline)', '#stickers', { ready: 'document.querySelectorAll(".sb-sticker").length > 100' });

  // More days, if asked for: does each puzzle still fit the screen?
  // (They are served from what the service worker saved, since the server is off.)
  for (let offset = 1; offset < DAYS; offset++) {
    await setDay(offset);
    for (const game of games) {
      if (ONLY && game !== ONLY) continue;
      const ready = `!document.querySelector('#game-${game} .loading') && document.querySelector('#game-${game}').children.length > 0`;
      await checkScreen(`${game} (day +${offset})`, `#${game}`, { ready, fits: true, tip: false });
    }
  }
} finally {
  socket.close();
  chrome.kill();
  if (!serverIsOff) server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file; the folder is temporary */ }
}

if (problems.length) {
  console.error(`\n${problems.length} of ${checked} screens have a problem:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${checked} screens draw, fit a phone, and log no errors.`);
