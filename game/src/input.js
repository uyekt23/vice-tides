// Vice Tides — keyboard and mouse. Keys are a held-set plus a pressed-this-frame set;
// the mouse feeds a pointer-locked camera (yaw/pitch deltas) and click attacks.
// When pointer lock is unavailable (headless screenshots) the camera can be driven
// by the arrow keys instead, so the game never hard-depends on the lock.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDX = 0, mouseDY = 0, clicked = false, locked = false;

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) clicked = true; });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });

  return {
    held: (code) => held.has(code),
    /** True once per physical press; consumes the press. */
    takePressed(code) { const p = pressed.has(code); if (p) pressed.delete(code); return p; },
    peekPressed: (code) => pressed.has(code),
    takeClick() { const c = clicked; clicked = false; return c; },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    isLocked: () => locked,
    lock() { if (!locked) canvas.requestPointerLock?.(); },
    unlock() { if (locked) document.exitPointerLock?.(); },
    /** Per-frame cleanup: un-consumed presses expire so they cannot fire twice. */
    endFrame() { pressed.clear(); clicked = false; },
  };
}

/** Movement axes from WASD + arrows: {x: strafe right, z: forward} each in -1..1. */
export function moveAxes(input) {
  let x = 0, z = 0;
  if (input.held('KeyW') || input.held('ArrowUp')) z += 1;
  if (input.held('KeyS') || input.held('ArrowDown')) z -= 1;
  if (input.held('KeyA')) x -= 1;
  if (input.held('KeyD')) x += 1;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}
