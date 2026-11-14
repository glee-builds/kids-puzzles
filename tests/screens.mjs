// screens.mjs: open every screen in a real browser and check it draws.
//
// The other tests check puzzle logic. This one checks the screens: it
// starts the app, opens the home screen and every puzzle at phone size
// (today's and yesterday's), and fails if a screen doesn't draw, shows the
// "Oops" message, logs an error, or (for a puzzle) doesn't fit the screen.
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

// ---------- The checks ----------

const problems = [];
let checked = 0;

async function checkScreen(label, address, { ready, fits }) {
  checked++;
  const ok = await open(address, ready);
  await sleep(150); // let anything late (fonts, a first draw) settle
  const found = [];
  if (!ok) found.push('did not finish drawing in 10 seconds');
  const text = await evaluate('document.querySelector(".view:not([hidden])")?.innerText || ""');
  if (text.includes('Oops, the puzzle could not load')) found.push('shows the "Oops, the puzzle could not load" message');
  if (text.trim().length < 10) found.push('is nearly empty');
  if (fits) {
    const height = await evaluate('document.documentElement.scrollHeight');
    if (height > PHONE.height) found.push(`is ${height}px tall, taller than a ${PHONE.height}px phone screen`);
  }
  for (const error of errors) found.push(`logged an error: ${String(error).split('\n')[0]}`);
  if (found.length) problems.push(`${label}: ${found.join('; ')}`);
  console.log(`${found.length ? '✗' : '✓'} ${label}`);
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
      await checkScreen(label, `${day}#${game}`, { ready, fits: true });
    }
  }
  await checkScreen('Sticker book', '#stickers', { ready: 'document.querySelectorAll(".sb-sticker").length > 100' });
  await checkScreen('For grown-ups', '#grown-ups', { ready: 'document.querySelectorAll(".gu-day").length === 28' });
  await checkScreen('Yesterday home', '?day=yesterday', { ready: 'document.getElementById("today-title").textContent.includes("Yesterday")' });

  // More days, if asked for: does each puzzle still fit the screen?
  for (let offset = 1; offset < DAYS; offset++) {
    await setDay(offset);
    for (const game of games) {
      if (ONLY && game !== ONLY) continue;
      const ready = `!document.querySelector('#game-${game} .loading') && document.querySelector('#game-${game}').children.length > 0`;
      await checkScreen(`${game} (day +${offset})`, `#${game}`, { ready, fits: true });
    }
  }
} finally {
  socket.close();
  chrome.kill();
  server.close();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold a file; the folder is temporary */ }
}

if (problems.length) {
  console.error(`\n${problems.length} of ${checked} screens have a problem:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll ${checked} screens draw, fit a phone, and log no errors.`);
