// ui.js: small screen helpers the games share.
//
// Each game draws its own screen; these are the pieces several games need
// the same way: making elements, a message line, the "not quite" wiggle,
// progress dots, the number pad, the letter keyboard, finger tracing on a
// grid, and drag-or-tap.

/** A new element, e.g. make('p', 'ws-message', 'Hello'). */
export function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A button that calls `onClick` when pressed. */
export function button(className, text, onClick) {
  const node = make('button', className, text);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}

/** A message line (styled by .message) that screen readers announce when it changes. */
export function liveMessage(className, text) {
  const node = make('p', `message ${className}`, text);
  node.setAttribute('aria-live', 'polite');
  return node;
}

/** Play the "not quite" wiggle on `node`, even if it just played. */
export function wiggle(node) {
  node.classList.remove('np-wiggle');
  void node.offsetWidth; // makes the browser notice the class was removed
  node.classList.add('np-wiggle');
}

/**
 * A row of dots, one per part of the day's puzzle (stories, ladders).
 * Call update(isDone, now): isDone(i) says if part i is finished, and
 * `now` is the part on screen.
 */
export function progressDots(count) {
  const node = make('div', 'so-dots');
  const dots = Array.from({ length: count }, () => node.appendChild(make('span', 'so-dot')));
  function update(isDone, now) {
    dots.forEach((dot, i) => {
      dot.className = 'so-dot' + (isDone(i) ? ' so-dot-done' : i === now ? ' so-dot-now' : '');
    });
  }
  return { node, update };
}

/**
 * Call `onKey(event)` for computer-keyboard presses, but only while
 * `container` is on screen. (Handy for testing on a laptop; phones use the
 * on-screen keys.) Returns a function that stops listening.
 */
export function onKeys(container, onKey) {
  const listener = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (container.closest('[hidden]')) return;
    onKey(event);
  };
  document.addEventListener('keydown', listener);
  return () => document.removeEventListener('keydown', listener);
}

/**
 * The number pad: 1 to 9, erase, 0, and Check. A computer keyboard's
 * digits, Backspace, and Enter work too while `container` is on screen.
 * Returns { node, stop }; call stop() when the game is finished.
 */
export function numberPad(container, { onDigit, onErase, onCheck }, extraClass = '') {
  const node = make('div', `np-pad ${extraClass}`.trim());
  for (const label of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Check']) {
    const key = button('np-key', label);
    if (label === 'Check') {
      key.classList.add('np-key-check');
      key.addEventListener('click', onCheck);
    } else if (label === '⌫') {
      key.setAttribute('aria-label', 'Erase a digit');
      key.addEventListener('click', onErase);
    } else {
      key.addEventListener('click', () => onDigit(label));
    }
    node.append(key);
  }
  const stop = onKeys(container, (event) => {
    if (/^[0-9]$/.test(event.key)) onDigit(event.key);
    else if (event.key === 'Backspace') onErase();
    else if (event.key === 'Enter') onCheck();
  });
  return { node, stop };
}

// QWERTY rows, like a phone or computer keyboard.
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

/**
 * The on-screen letter keyboard. With onGo and onErase, the bottom row also
 * has Go (left) and Erase (right). A computer keyboard's letters (and
 * Backspace and Enter) work too while `container` is on screen.
 * Returns { node, keys, stop }: keys[letter] is each letter's button, and
 * stop() ends the computer-keyboard listening.
 */
export function letterKeyboard(container, { onLetter, onErase, onGo }, extraClass = '') {
  const node = make('div', `wg-keyboard ${extraClass}`.trim());
  const keys = {};
  KEY_ROWS.forEach((letters, index) => {
    const row = make('div', 'wg-key-row' + (index === 1 ? ' wg-key-row-middle' : ''));
    const isBottom = index === KEY_ROWS.length - 1;
    if (isBottom && onGo) {
      const goKey = row.appendChild(button('wg-key wg-key-wide wg-key-go', 'Go', onGo));
      goKey.setAttribute('aria-label', 'Check my word');
    }
    for (const letter of letters) keys[letter] = row.appendChild(button('wg-key', letter, () => onLetter(letter)));
    if (isBottom && onErase) {
      const eraseKey = row.appendChild(button('wg-key wg-key-wide', '⌫', onErase));
      eraseKey.setAttribute('aria-label', 'Erase a letter');
    }
    node.append(row);
  });
  const stop = onKeys(container, (event) => {
    if (/^[a-z]$/i.test(event.key)) onLetter(event.key.toLowerCase());
    else if (event.key === 'Backspace') onErase?.();
    else if (event.key === 'Enter') onGo?.();
  });
  return { node, keys, stop };
}

/**
 * Finger (or mouse) tracing over a grid whose squares have data-r and
 * data-c. Calls:
 *   onStart(square)  when a finger goes down on a square; return true to
 *                    start tracing
 *   onMove(square)   each time the traced finger is over a square
 *   onEnd()          when the finger lifts
 * A square is [row, column].
 */
export function trace(grid, { onStart, onMove, onEnd = () => {} }) {
  let tracing = false;

  function squareAt(event) {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-r]');
    return cell && grid.contains(cell) ? [Number(cell.dataset.r), Number(cell.dataset.c)] : null;
  }

  grid.addEventListener('pointerdown', (event) => {
    const square = squareAt(event);
    if (!square || !onStart(square)) return;
    event.preventDefault();
    tracing = true;
    // Keep getting finger moves even if the finger slides off the grid.
    try { grid.setPointerCapture(event.pointerId); } catch { /* fine without it */ }
    onMove(square);
  });
  grid.addEventListener('pointermove', (event) => {
    const square = tracing && squareAt(event);
    if (square) onMove(square);
  });
  const stop = () => {
    if (!tracing) return;
    tracing = false;
    onEnd();
  };
  grid.addEventListener('pointerup', stop);
  grid.addEventListener('pointercancel', stop);
  return { stop };
}

const DRAG_START = 8; // px a finger moves before a tap becomes a drag

/**
 * Let `tile` be dragged onto one of the target boxes, or tapped.
 *   canStart()      true if the tile can move now
 *   targets()       the boxes it can be dropped on
 *   onDrop(index)   dropped on targets()[index]
 *   onTap()         tapped (or pressed with a keyboard)
 *   classes         { ghost, lifted }: extra classes for the copy that
 *                   follows the finger (.drag-ghost), and for the tile
 *                   while it's away. A box under the finger gets .drop-over.
 */
export function dragOrTap(tile, { canStart, targets, onDrop, onTap, classes }) {
  let drag = null;

  const targetAt = (event) => {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    return targets().findIndex((box) => box.contains(hit));
  };

  function stop() {
    if (!drag) return;
    drag.ghost?.remove();
    tile.classList.remove(classes.lifted);
    for (const box of targets()) box.classList.remove('drop-over');
    drag = null;
  }

  tile.addEventListener('pointerdown', (event) => {
    if (!canStart()) return;
    event.preventDefault();
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, ghost: null };
    try { tile.setPointerCapture(event.pointerId); } catch { /* fine without it */ }
  });

  tile.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START) return;
      drag.ghost = document.body.appendChild(make('div', `drag-ghost ${classes.ghost}`, tile.textContent));
      tile.classList.add(classes.lifted);
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    const over = targetAt(event);
    targets().forEach((box, k) => box.classList.toggle('drop-over', k === over));
  });

  tile.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dragged = drag.ghost !== null;
    const over = targetAt(event);
    stop();
    if (!dragged) onTap();
    else if (over !== -1) onDrop(over);
  });

  tile.addEventListener('pointercancel', stop);
  // A keyboard press (no pointer) counts as a tap.
  tile.addEventListener('click', (event) => { if (event.detail === 0) onTap(); });
}
