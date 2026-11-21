// Screenshot staging: ?shot=start|play|chase|end&seed=N puts the game into
// a fixed, deterministic scene for screenshots. The simulation is advanced
// in fixed steps with no input, so the same query always stages the same
// frame. No randomness is used anywhere in staging.

import { LEVELS } from './levels.js';
import { createWorld, updateWorld } from './engine.js';
import { TILE } from './levels.js';

const IDLE = { up: false, down: false, left: false, right: false, sneak: false, run: false };

function advance(world, seconds) {
  const step = 1 / 60;
  let t = 0;
  while (t < seconds) {
    updateWorld(world, IDLE, step);
    t += step;
  }
}

function tileXY(world, tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Returns { world, levelIndex, screen } for the requested shot, or null.
export function stageShot(shot) {
  if (shot === 'start') {
    const world = createWorld(LEVELS[0], 0);
    advance(world, 5);
    return { world, levelIndex: 0, screen: 'playing' };
  }
  if (shot === 'play') {
    const world = createWorld(LEVELS[1], 1);
    // Sable sneaking through the statue hall, one shard already taken.
    const spot = tileXY(world, 6, 9);
    world.player.x = spot.x;
    world.player.y = spot.y;
    world.player.sneaking = true;
    world.shards[0].taken = true;
    world.shardsTaken = 1;
    advance(world, 7);
    return { world, levelIndex: 1, screen: 'playing' };
  }
  if (shot === 'chase') {
    const world = createWorld(LEVELS[0], 0);
    // Sable caught in the open; the nearest guard is in full chase.
    const spot = tileXY(world, 13, 2);
    world.player.x = spot.x;
    world.player.y = spot.y;
    const g = world.guards[0];
    g.suspicion = 100;
    g.state = 'chase';
    g.lastSeen = { x: spot.x, y: spot.y };
    world.spotted = true;
    advance(world, 0.5);
    return { world, levelIndex: 0, screen: 'playing' };
  }
  if (shot === 'end') {
    const world = createWorld(LEVELS[0], 0);
    world.shards.forEach((s) => { s.taken = true; });
    world.shardsTaken = world.shardsTotal;
    world.exitOpen = true;
    world.player.x = world.exit.x;
    world.player.y = world.exit.y;
    world.cleared = true;
    world.time = 74;
    return { world, levelIndex: 0, screen: 'clear' };
  }
  return null;
}
