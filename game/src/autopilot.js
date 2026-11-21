// A deterministic autopilot that plays the game: it walks to the nearest
// Starlight Shard, then to the exit, always sneaking, and waits whenever
// the next step would be seen. If a guard's cone sweeps onto the spot it
// is standing on, it slips away to the nearest unseen tile instead of
// waiting to be spotted. It exists so the game can be tested headlessly —
// and as a demo mode (?demo=1). No randomness anywhere.

import { guardSees, hasLineOfSight, playerTile, tileCenter } from './engine.js';
import { TILE, isWalkable } from './levels.js';

export function createAutopilot() {
  return {
    path: null, // list of {x, y} pixel points
    targetKey: '',
    replanIn: 0,
    fleeing: false,
    evading: false,
    cornered: false,
    waitStart: -1,
    dashing: false,
  };
}

function pointDangerous(world, x, y) {
  const fake = { x, y };
  for (const g of world.guards) {
    if (guardSees(world.L, g, fake, 'sneak') > 0) return true;
    if (Math.hypot(g.x - x, g.y - y) < 70) return true;
  }
  return false;
}

// Is this tile part of any guard's patrol route? A bot must never *wait*
// on a patrol lane: a guard walks straight through it.
function onPatrolLane(world, tx, ty) {
  for (const g of world.def.guards) {
    const wps = g.waypoints;
    for (let i = 0; i < wps.length; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      if (a[0] === b[0] && tx === a[0] && ty >= Math.min(a[1], b[1]) && ty <= Math.max(a[1], b[1])) return true;
      if (a[1] === b[1] && ty === a[1] && tx >= Math.min(a[0], b[0]) && tx <= Math.max(a[0], b[0])) return true;
    }
  }
  return false;
}

// Is this tile next to any guard's patrol route?
function nearPatrolLane(world, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (onPatrolLane(world, tx + dx, ty + dy)) return true;
    }
  }
  return false;
}

// Breadth-first search for the nearest tile that is a good hiding spot:
// behind a wall or crate (no guard has a line of sight to it at all), or
// a shadow tile well away from every guard. A spot that is merely outside
// a cone right now is not good enough: a walking guard sweeps its cone
// onto it a moment later. Falls back to the nearest merely-unseen tile
// when no good spot is near.
function nearestSafeTile(world) {
  const L = world.L;
  const start = playerTile(L, world.player);
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start.x, start.y), null);
  let fallback = null;

  function goodSpot(cx, cy) {
    // Unseen by every guard right now.
    const spot = { x: cx, y: cy };
    if (world.guards.some((g) => guardSees(L, g, spot, 'sneak') > 0)) return false;
    // Behind cover from the nearest guard (the one that spotted us), or a
    // shadow tile well away from every guard. Guards far away, facing
    // elsewhere, do not make a spot bad: only the threat matters.
    let nearest = null;
    let nearestD = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - cx, g.y - cy);
      if (d < nearestD) { nearestD = d; nearest = g; }
    }
    if (nearest && !hasLineOfSight(L, nearest.x, nearest.y, cx, cy)) return true;
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor(cy / TILE);
    return L.grid[ty][tx] === 'S' && nearestD >= 150;
  }

  function pathTo(node) {
    const path = [];
    let n = node;
    while (n) {
      path.unshift(tileCenter(n.x, n.y));
      n = prev.get(key(n.x, n.y));
    }
    return path;
  }

  while (queue.length) {
    const cur = queue.shift();
    if (!(cur.x === start.x && cur.y === start.y)) {
      const c = tileCenter(cur.x, cur.y);
      if (!pointDangerous(world, c.x, c.y)) {
        if (!fallback) fallback = cur;
        if (!onPatrolLane(world, cur.x, cur.y) && goodSpot(c.x, c.y)) {
          return pathTo(cur);
        }
      }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
      if (!isWalkable(L.grid[ny][nx])) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      const c = tileCenter(nx, ny);
      // Do not route through a watched tile (the start tile is exempt).
      if (pointDangerous(world, c.x, c.y)) continue;
      prev.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return fallback ? pathTo(fallback) : null;
}

// Dijkstra pathfinding where walking along a patrol lane, or through a
// watched tile, costs extra: the bot crosses lanes at right angles and
// prefers cover instead of strolling down a guard's route.
function findSafePath(world, fromTile, toTile) {
  const L = world.L;
  const key = (x, y) => `${x},${y}`;
  const dist = new Map([[key(fromTile.x, fromTile.y), 0]]);
  const prev = new Map([[key(fromTile.x, fromTile.y), null]]);
  const open = [{ x: fromTile.x, y: fromTile.y, cost: 0 }];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].cost < open[bi].cost) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === toTile.x && cur.y === toTile.y) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift(tileCenter(node.x, node.y));
        node = prev.get(key(node.x, node.y));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
      if (!isWalkable(L.grid[ny][nx])) continue;
      const c = tileCenter(nx, ny);
      let step = 1;
      if (onPatrolLane(world, nx, ny)) step += 6;
      else if (nearPatrolLane(world, nx, ny)) step += 3;
      if (pointDangerous(world, c.x, c.y)) step += 10;
      const nd = cur.cost + step;
      const k = key(nx, ny);
      if (dist.has(k) && dist.get(k) <= nd) continue;
      dist.set(k, nd);
      prev.set(k, cur);
      open.push({ x: nx, y: ny, cost: nd });
    }
  }
  return null;
}

// Nearest tile that is not on any patrol lane and not currently watched.
function nearestOffLaneTile(world) {
  const L = world.L;
  const start = playerTile(L, world.player);
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start.x, start.y), null);
  while (queue.length) {
    const cur = queue.shift();
    if (!(cur.x === start.x && cur.y === start.y)) {
      const c = tileCenter(cur.x, cur.y);
      if (!onPatrolLane(world, cur.x, cur.y) && !pointDangerous(world, c.x, c.y)) {
        const path = [];
        let node = cur;
        while (node) {
          path.unshift(tileCenter(node.x, node.y));
          node = prev.get(key(node.x, node.y));
        }
        return path;
      }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= L.cols || ny >= L.rows) continue;
      if (!isWalkable(L.grid[ny][nx])) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

function fleeTarget(world) {
  // The walkable tile farthest from the nearest chasing guard.
  const chaser = world.guards.find((g) => g.state === 'chase');
  if (!chaser) return null;
  let best = null;
  let bestD = -1;
  for (let y = 1; y < world.L.rows - 1; y++) {
    for (let x = 1; x < world.L.cols - 1; x++) {
      const ch = world.L.grid[y][x];
      if (ch !== '.' && ch !== 'S') continue;
      const c = tileCenter(x, y);
      const d = Math.hypot(c.x - chaser.x, c.y - chaser.y);
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function steer(out, p, next) {
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  if (dx > 4) out.right = true;
  if (dx < -4) out.left = true;
  if (dy > 4) out.down = true;
  if (dy < -4) out.up = true;
}

export function autopilotInput(bot, world, dt) {
  const out = { up: false, down: false, left: false, right: false, sneak: true, run: false };
  if (world.cleared || world.caught) return out;
  const p = world.player;

  bot.replanIn -= dt;
  const chaser = world.guards.find((g) => g.state === 'chase');
  const wantFlee = Boolean(chaser) && Math.hypot(chaser.x - p.x, chaser.y - p.y) < 260;

  // A guard's cone is on us: slip away to the nearest unseen tile.
  if (!wantFlee && pointDangerous(world, p.x, p.y)) {
    if (!bot.evading || bot.replanIn <= 0) {
      bot.path = nearestSafeTile(world);
      bot.evading = true;
      bot.replanIn = 0.5;
    }
    if (bot.path && bot.path.length) {
      while (bot.path.length > 1 && Math.hypot(bot.path[0].x - p.x, bot.path[0].y - p.y) < 8) {
        bot.path.shift();
      }
      steer(out, p, bot.path[0]);
      return out;
    }
    // Cornered with no unseen tile nearby: run straight away from the
    // nearest guard instead of standing still in the open.
    bot.evading = false;
    bot.cornered = true;
    let nearest = null;
    let nearestD = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < nearestD) { nearestD = d; nearest = g; }
    }
    if (nearest) {
      const dx = p.x - nearest.x;
      const dy = p.y - nearest.y;
      const d = Math.hypot(dx, dy) || 1;
      if (dx / d > 0.3) out.right = true;
      if (dx / d < -0.3) out.left = true;
      if (dy / d > 0.3) out.down = true;
      if (dy / d < -0.3) out.up = true;
      out.sneak = false;
      out.run = true;
      return out;
    }
  } else {
    bot.evading = false;
    bot.cornered = false;
  }

  // Pick a target: flee, else nearest shard, else the exit.
  let target = null;
  if (wantFlee) {
    target = fleeTarget(world);
    bot.fleeing = true;
  } else {
    bot.fleeing = false;
    const remaining = world.shards.filter((s) => !s.taken);
    if (remaining.length) {
      let best = null;
      let bestLen = Infinity;
      const from = playerTile(world.L, p);
      for (const s of remaining) {
        const path = findSafePath(world, from, { x: Math.floor(s.x / TILE), y: Math.floor(s.y / TILE) });
        if (path && path.length < bestLen) {
          bestLen = path.length;
          best = s;
        }
      }
      if (best) target = { x: Math.floor(best.x / TILE), y: Math.floor(best.y / TILE) };
    } else {
      target = { x: Math.floor(world.exit.x / TILE), y: Math.floor(world.exit.y / TILE) };
    }
  }
  if (!target) return out;

  const targetKey = `${target.x},${target.y},${bot.fleeing ? 'flee' : 'go'}`;
  if (!bot.path || bot.replanIn <= 0 || targetKey !== bot.targetKey || bot.evading) {
    const from = playerTile(world.L, p);
    bot.path = findSafePath(world, from, target);
    bot.targetKey = targetKey;
    bot.replanIn = 0.4;
  }
  if (!bot.path || bot.path.length === 0) return out;

  // Drop path points already reached.
  while (bot.path.length > 1 && Math.hypot(bot.path[0].x - p.x, bot.path[0].y - p.y) < 8) {
    bot.path.shift();
  }
  const next = bot.path[0];
  if (!next) return out;
  if (!pointDangerous(world, next.x, next.y)) bot.waitStart = -1;

  // Wait if the next step is watched — but never forever: after 2.5 s of
  // waiting, dash (run) through the watched stretch instead. A dash is
  // loud, but crossing quickly beats standing in the open. (When fleeing
  // or cornered, keep moving anyway. And never wait on a patrol lane:
  // step back off it first.)
  if (!bot.fleeing && !bot.cornered && pointDangerous(world, next.x, next.y)) {
    if (bot.waitStart < 0) bot.waitStart = world.time;
    const here = playerTile(world.L, p);
    if (onPatrolLane(world, here.x, here.y)) {
      // Step back: retreat to the nearest tile off every patrol lane.
      const back = nearestOffLaneTile(world);
      if (back) {
        bot.path = back;
        bot.targetKey = '';
        bot.waitStart = -1;
        while (bot.path.length > 1 && Math.hypot(bot.path[0].x - p.x, bot.path[0].y - p.y) < 8) {
          bot.path.shift();
        }
        steer(out, p, bot.path[0]);
        return out;
      }
    }
    if (world.time - bot.waitStart > 2.5) {
      // Dash: run along the path until clear of the watched stretch.
      bot.dashing = true;
      bot.waitStart = -1;
    } else {
      return out;
    }
  }
  if (bot.dashing) {
    const here = playerTile(world.L, p);
    if (!pointDangerous(world, p.x, p.y) && !onPatrolLane(world, here.x, here.y)
      && !nearPatrolLane(world, here.x, here.y)) {
      bot.dashing = false;
    }
  }

  const dx = next.x - p.x;
  const dy = next.y - p.y;
  if (Math.hypot(dx, dy) < 6) {
    bot.path.shift();
    return out;
  }
  steer(out, p, next);
  if (bot.dashing) {
    out.sneak = false;
    out.run = true;
  }
  return out;
}
