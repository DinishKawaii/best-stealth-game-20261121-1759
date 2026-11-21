// Keyboard + mouse input. Keys are tracked by their `code` so WASD and the
// arrow keys both work; the game reads a plain object each frame.

export function createInput() {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false,
    sneak: false, run: false,
    pressed: new Set(), // codes pressed since last consume
    click: null, // {x, y} in canvas pixels, consumed by the game
  };

  function sync() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.run = keys.has('Space');
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    keys.add(e.code);
    sync();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    sync();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    sync();
  });

  input.attachClick = (canvas, toBoard) => {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      input.click = { x: px, y: py, board: toBoard(px, py) };
    });
  };

  input.wasPressed = (code) => {
    if (input.pressed.has(code)) {
      input.pressed.delete(code);
      return true;
    }
    return false;
  };

  input.clearPressed = () => input.pressed.clear();

  return input;
}
