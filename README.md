# kids-puzzles

A daily puzzle app for an early reader, played on a parent's phone. Each day serves a short set of puzzles (5 to 10 minutes) mixing simple 3 to 4 letter word games with mazes and matching puzzles, plus a streak counter for coming back each day. It is a plain HTML, CSS, and JavaScript web app with no framework, no build step, no accounts, and no network requests. Puzzles are generated in the browser from today's date, and progress is saved on the phone.

**Live:** https://glee-builds.github.io/kids-puzzles/

## Preview locally

From this folder, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser. Press `Ctrl+C` in the terminal to stop the server.

### On a phone, before it goes live

1. Start the server as above, on the Mac.
2. Connect the phone to the same Wi-Fi as the Mac.
3. On the phone, open `http://<mac-name>.local:8000`. Find the Mac's name in System Settings → General → Sharing → Local hostname (for example `Mac-mini.local`).
4. If macOS asks whether Python may accept incoming connections, click **Allow**.

## Run the tests

From this folder, run:

```bash
node --test
```

This uses Node's built-in test runner. It finds every `*.test.js` file in `tests/` and reports which checks pass.
