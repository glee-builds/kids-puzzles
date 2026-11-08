// ui.js: small screen helpers the games share.
//
// Each game draws its own screen; these are the pieces several games need
// the same way: making elements, a message line, the "not quite" wiggle,
// progress dots, finger tracing on a grid, and drag-or-tap.

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
