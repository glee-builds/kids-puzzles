// Tests for sw.js, the service worker that lets the app open offline.
// Run all tests with: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const sw = readFileSync(new URL('sw.js', root), 'utf8');

// The FILES list in sw.js, read as text: every quoted path between "FILES = [" and "];".
const listed = sw.slice(sw.indexOf('const FILES = ['), sw.indexOf('];', sw.indexOf('const FILES = [')))
  .match(/'[^']+'/g).map((quoted) => quoted.slice(1, -1));

test('sw.js saves every file the app needs for offline', () => {
  const needed = [
    'index.html', 'styles.css', 'manifest.webmanifest',
    ...['src/', 'data/', 'assets/'].flatMap((folder) =>
      readdirSync(new URL(folder, root), { recursive: true })
        .map((name) => `${folder}${name}`)
        .filter((path) => /\.(js|json|css|html|svg|png|woff2)$/.test(path))),
  ];
  const missing = needed.filter((path) => !listed.includes(path));
  assert.deepEqual(missing, [], `add these to FILES in sw.js: ${missing.join(', ')}`);
});

test('every file in the sw.js list exists', () => {
  const gone = listed.filter((path) => path !== './' && !existsSync(new URL(path, root)));
  assert.deepEqual(gone, [], `these are in FILES in sw.js but don't exist: ${gone.join(', ')}`);
});

// Other apps on glee-builds.github.io share this browser storage, so the
// service worker may only delete caches that start with this app's prefix.
test('sw.js deletes only old caches with this app\'s prefix', () => {
  assert.match(sw, /const PREFIX = 'lily-pad-';/, 'sw.js should define PREFIX');
  assert.match(sw, /const CACHE = PREFIX \+ 'v\d+';/, 'CACHE should be built from PREFIX');
  assert.match(sw, /names\.filter\(\(name\) => name\.startsWith\(PREFIX\) && name !== CACHE\)/,
    'the activate step should delete only this app\'s old caches');
});

test('the list has no file twice, and includes the app itself', () => {
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(listed.includes('./'));
  assert.ok(listed.includes('index.html'));
});
