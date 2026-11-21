// Entry point: wires input, audio, simulation and rendering together and
// runs the game loop. Also exposes a small handle on window.__game for
// headless testing, and stages screenshots (?shot=...) and autopilot
// play (?autopilot=1 / ?demo=1).

import { LEVELS, TILE } from './levels.js';
import { createWorld, updateWorld, findPath, playerTile } from './engine.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { drawGame, CANVAS_W, CANVAS_H, BOARD_X, BOARD_Y } from './render.js';
import { createAutopilot, autopilotInput } from './autopilot.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const input = createInput();
const audio = createAudio();
const bot = createAutopilot();

let levelIndex = 0;
let world = createWorld(LEVELS[0], 0);
let screen = 'title'; // title | playing | paused | caught | clear | done
let totalTime = 0;
let ghostCount = 0;
let levelResults = [];
let clickPath = null;
let buttonRect = null;
let lastFrame = performance.now();
let simTime = 0;

const autoMode = params.get('autopilot') === '1' || params.get('demo') === '1';
const autoResult = { done: false, levelsCleared: 0, totalTime: 0, ghostCount: 0, caught: false, perLevel: [] };

// Screenshot staging takes over the world and screen.
const staged = params.get('shot') ? stageShot(params.get('shot')) : null;
if (staged) {
  world = staged.world;
  levelIndex = staged.levelIndex;
  screen = staged.screen;
  totalTime = staged.screen === 'clear' ? world.time : 0;
  if (staged.screen === 'clear') ghostCount = world.spotted ? 0 : 1;
}

function startLevel(i) {
  levelIndex = i;
  world = createWorld(LEVELS[i], i);
  clickPath = null;
  screen = 'playing';
}

function toBoard(px, py) {
  return { x: px - BOARD_X, y: py - BOARD_Y };
}

input.attachClick(canvas, toBoard);

function boardClickIsInside(bx, by) {
  return bx >= 0 && by >= 0 && bx < LEVELS[0].map[0].length * TILE && by < LEVELS[0].map.length * TILE;
}

function handleClick() {
  const c = input.click;
  input.click = null;
  if (!c) return;
  audio.unlock();
  if (screen !== 'playing') {
    if (buttonRect && c.x >= buttonRect.x && c.x <= buttonRect.x + buttonRect.w
      && c.y >= buttonRect.y && c.y <= buttonRect.y + buttonRect.h) {
      advanceScreen();
    }
    return;
  }
  // Click-to-move: pathfind to the clicked tile and walk there.
  if (!boardClickIsInside(c.board.x, c.board.y)) return;
  const to = {
    x: Math.floor(c.board.x / TILE),
    y: Math.floor(c.board.y / TILE),
  };
  const from = playerTile(world.L, world.player);
  clickPath = findPath(world.L, from, to);
}

function advanceScreen() {
  if (screen === 'title') {
    totalTime = 0;
    ghostCount = 0;
    levelResults = [];
    startLevel(0);
  } else if (screen === 'paused') {
    screen = 'playing';
  } else if (screen === 'caught') {
    startLevel(levelIndex);
  } else if (screen === 'clear') {
    if (levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
    else screen = 'done';
  } else if (screen === 'done') {
    totalTime = 0;
    ghostCount = 0;
    levelResults = [];
    startLevel(0);
  }
}

function finishLevel() {
  const ghost = !world.spotted;
  if (ghost) ghostCount++;
  levelResults.push({ level: levelIndex, time: world.time, ghost });
  audio.clear();
  screen = 'clear';
}

function failLevel() {
  audio.caught();
  screen = 'caught';
}

function frame(now) {
  // ?fixeddt=1 steps the simulation at exactly 1/60 s per frame, so the
  // autopilot plays identically in the browser and in headless tests.
  // Without it, the step follows the real frame time (clamped).
  const dt = params.get('fixeddt') === '1'
    ? 1 / 60
    : Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  simTime += dt;

  // Autopilot / demo mode plays by itself, including starting the game.
  if (autoMode && (screen === 'title' || screen === 'paused')) {
    advanceScreen();
  }

  // One-shot keys.
  if (input.wasPressed('Enter')) {
    if (screen !== 'playing') advanceScreen();
  }
  if (input.wasPressed('KeyP')) {
    if (screen === 'playing') screen = 'paused';
    else if (screen === 'paused') screen = 'playing';
  }
  if (input.wasPressed('KeyM')) audio.toggleMute();
  if (input.wasPressed('KeyR')) {
    if (screen === 'playing' || screen === 'caught') startLevel(levelIndex);
  }
  handleClick();

  if (screen === 'playing') {
    // Choose this frame's input: autopilot, click-path, or keyboard.
    let frameInput;
    if (autoMode) {
      frameInput = autopilotInput(bot, world, dt);
    } else if (clickPath && clickPath.length) {
      frameInput = { up: false, down: false, left: false, right: false, sneak: false, run: false };
      const next = clickPath[0];
      const p = world.player;
      const dx = next.x - p.x;
      const dy = next.y - p.y;
      if (Math.hypot(dx, dy) < 6) {
        clickPath.shift();
      } else {
        if (dx > 4) frameInput.right = true;
        if (dx < -4) frameInput.left = true;
        if (dy > 4) frameInput.down = true;
        if (dy < -4) frameInput.up = true;
      }
    } else {
      frameInput = input;
    }
    // Any movement key cancels a click-path.
    if (frameInput === input && (input.up || input.down || input.left || input.right)) {
      clickPath = null;
    }

    const eventsBefore = world.events.length;
    updateWorld(world, frameInput, dt);
    totalTime += dt;
    if (world.player.moving) audio.step(simTime);
    for (let i = eventsBefore; i < world.events.length; i++) {
      const ev = world.events[i];
      if (ev.kind === 'pickup') audio.pickup();
      if (ev.kind === 'alarm') audio.alarm();
    }
    if (world.cleared) {
      finishLevel();
      if (autoMode) {
        autoResult.levelsCleared++;
        autoResult.perLevel.push({ level: levelIndex, time: world.time, ghost: !world.spotted });
        if (levelIndex + 1 < LEVELS.length) {
          startLevel(levelIndex + 1);
        } else {
          autoResult.done = true;
          autoResult.totalTime = totalTime;
          autoResult.ghostCount = ghostCount;
          screen = 'done';
        }
      }
    } else if (world.caught) {
      if (autoMode) {
        autoResult.caught = true;
        autoResult.done = true;
        autoResult.totalTime = totalTime;
        autoResult.ghostCount = ghostCount;
      }
      failLevel();
    }
  }

  buttonRect = drawGame(ctx, {
    world, screen, levelIndex, totalTime, ghostCount,
    muted: audio.muted, time: simTime,
  });
  input.clearPressed();
  requestAnimationFrame(frame);
}

window.__game = {
  get world() { return world; },
  get screen() { return screen; },
  get levelIndex() { return levelIndex; },
  get totalTime() { return totalTime; },
  get ghostCount() { return ghostCount; },
  autoResult,
  startLevel,
  advanceScreen,
};
if (staged) window.__shotReady = true;

requestAnimationFrame(frame);
