// Core simulation for "Whisper in the Marble Hall": movement, collision,
// line of sight, guard senses and guard AI. Pure logic, no drawing, no DOM,
// so the same code runs in the browser and in headless tests.
// All positions are in pixels; the board's top-left corner is (0, 0) here
// and the renderer adds the screen offset.

import { TILE, parseLevel, isWalkable, blocksSight } from './levels.js';

export const WALK_SPEED = 132;
export const SNEAK_SPEED = 72;
export const RUN_SPEED = 212;
export const VIEW_DIST = 285;
export const VIEW_HALF_ANGLE = 0.66; // ~38 degrees each side
export const HEAR_DIST = 150;
export const CATCH_DIST = 26;

function tileAt(L, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= L.cols || ty >= L.rows) return '#';
  return L.grid[ty][tx];
}

function circleHitsWall(L, x, y, r) {
  for (let ty = Math.floor((y - r) / TILE); ty <= Math.floor((y + r) / TILE); ty++) {
    for (let tx = Math.floor((x - r) / TILE); tx <= Math.floor((x + r) / TILE); tx++) {
      const ch = tx < 0 || ty < 0 || tx >= L.cols || ty >= L.rows ? '#' : L.grid[ty][tx];
      if (isWalkable(ch)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

function moveCircle(L, ent, dx, dy) {
  const nx = ent.x + dx;
  if (!circleHitsWall(L, nx, ent.y, ent.r)) ent.x = nx;
  const ny = ent.y + dy;
  if (!circleHitsWall(L, ent.x, ny, ent.r)) ent.y = ny;
}

// True when no wall or crate stands between two points.
export function hasLineOfSight(L, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(tileAt(L, x0 + dx * t, y0 + dy * t))) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function createWorld(def, levelIndex) {
  const L = parseLevel(def);
  const start = tileCenter(L.start.x, L.start.y);
  const exit = tileCenter(L.exit.x, L.exit.y);
  const world = {
    def,
    levelIndex,
    L,
    time: 0,
    player: {
      x: start.x, y: start.y, r: 14,
      facing: 0, moving: false, sneaking: false, running: false,
      noise: 0,
    },
    guards: def.guards.map((g) => {
      const first = tileCenter(g.waypoints[0][0], g.waypoints[0][1]);
      return {
        waypoints: g.waypoints.map(([wx, wy]) => tileCenter(wx, wy)),
        speed: g.speed,
        pause: g.pause,
        x: first.x, y: first.y, r: 14,
        wp: 1, pauseLeft: 0, scanDir: 1,
        facing: 0, suspicion: 0,
        state: 'patrol', // patrol | suspect | chase | return
        lastSeen: null, loseTimer: 0, investigate: null,
      };
    }),
    shards: L.shardSpots.map((s) => ({ ...tileCenter(s.x, s.y), taken: false })),
    exit,
    exitOpen: false,
    shardsTaken: 0,
    shardsTotal: L.shardSpots.length,
    spotted: false, // any guard reached full suspicion this level
    caught: false,
    cleared: false,
    events: [], // {kind, at} for sounds / tests
  };
  return world;
}

// How well a guard can see the player right now, 0..1 (0 = not seen).
export function guardSees(L, guard, player, stance) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  let view = VIEW_DIST;
  if (stance === 'sneak') view *= 0.62;
  if (stance === 'run') view *= 1.15;
  if (tileAt(L, player.x, player.y) === 'S') view *= 0.55;
  if (dist > view) return 0;
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, guard.facing)) > VIEW_HALF_ANGLE) return 0;
  if (!hasLineOfSight(L, guard.x, guard.y, player.x, player.y)) return 0;
  // Closer and more centred = seen faster.
  const closeness = 1 - dist / view;
  const centred = 1 - Math.abs(angleDiff(ang, guard.facing)) / VIEW_HALF_ANGLE;
  return Math.min(1, 0.35 + 0.65 * (0.5 * closeness + 0.5 * centred));
}

export function playerTile(L, player) {
  return { x: Math.floor(player.x / TILE), y: Math.floor(player.y / TILE) };
}

export function updateWorld(world, input, dt) {
  const { L, player } = world;
  world.time += dt;
  const p = player;

  // --- player movement ---
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
  }
  const stance = input.sneak ? 'sneak' : input.run ? 'run' : 'walk';
  const speed = stance === 'sneak' ? SNEAK_SPEED : stance === 'run' ? RUN_SPEED : WALK_SPEED;
  p.sneaking = stance === 'sneak';
  p.running = stance === 'run';
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) p.facing = Math.atan2(my, mx);
  moveCircle(L, p, mx * speed * dt, my * speed * dt);
  p.noise = Math.max(0, p.noise - dt * 2);
  if (p.running && p.moving) p.noise = 1;

  // --- pickups ---
  for (const s of world.shards) {
    if (!s.taken && Math.hypot(s.x - p.x, s.y - p.y) < 26) {
      s.taken = true;
      world.shardsTaken++;
      world.events.push({ kind: 'pickup', at: world.time });
    }
  }
  world.exitOpen = world.shardsTaken >= world.shardsTotal;
  if (world.exitOpen && Math.hypot(world.exit.x - p.x, world.exit.y - p.y) < 28) {
    world.cleared = true;
    world.events.push({ kind: 'clear', at: world.time });
  }

  // --- guards ---
  for (const g of world.guards) {
    const seen = guardSees(L, g, p, stance);
    if (seen > 0) {
      g.lastSeen = { x: p.x, y: p.y };
      g.loseTimer = 0;
      // Suspicion rises faster the clearer the view.
      g.suspicion = Math.min(100, g.suspicion + seen * 95 * dt);
      if (g.suspicion >= 100 && g.state !== 'chase') {
        g.state = 'chase';
        world.spotted = true;
        world.events.push({ kind: 'alarm', at: world.time });
      } else if (g.suspicion >= 45 && g.state === 'patrol') {
        g.state = 'suspect';
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - 30 * dt);
      if (g.state === 'suspect' && g.suspicion < 10) g.state = 'patrol';
    }

    // Loud running is heard nearby, even unseen.
    if (p.running && p.moving) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < HEAR_DIST && hasLineOfSight(L, g.x, g.y, p.x, p.y) === false) {
        // Heard through a wall: only a nudge, they come to look.
        g.suspicion = Math.min(99, g.suspicion + 30 * dt);
        if (g.state === 'patrol' && g.suspicion >= 45) g.state = 'suspect';
        g.investigate = { x: p.x, y: p.y };
      } else if (d < HEAR_DIST) {
        g.suspicion = Math.min(100, g.suspicion + 45 * dt);
      }
    }

    // --- guard movement by state ---
    if (g.state === 'chase' && g.lastSeen) {
      const dx = g.lastSeen.x - g.x;
      const dy = g.lastSeen.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const sp = g.speed * 2.15;
        g.facing = Math.atan2(dy, dx);
        moveCircle(L, g, (dx / d) * sp * dt, (dy / d) * sp * dt);
      }
      if (seen === 0) {
        g.loseTimer += dt;
        if (g.loseTimer > 2.5) {
          g.state = 'suspect';
          g.investigate = { ...g.lastSeen };
          g.suspicion = 60;
        }
      } else {
        g.loseTimer = 0;
      }
      if (Math.hypot(p.x - g.x, p.y - g.y) < CATCH_DIST) {
        world.caught = true;
        world.events.push({ kind: 'caught', at: world.time });
      }
    } else if ((g.state === 'suspect' || g.state === 'return') && g.investigate) {
      const t = g.investigate;
      const dx = t.x - g.x;
      const dy = t.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const sp = g.speed * 1.35;
        g.facing = Math.atan2(dy, dx);
        moveCircle(L, g, (dx / d) * sp * dt, (dy / d) * sp * dt);
      } else {
        // Looked, found nothing: stand, scan, then back to patrol.
        g.investigate = null;
        g.pauseLeft = 1.2;
        g.state = 'patrol';
      }
    } else {
      // Patrol: walk the waypoint loop, pausing and scanning at each stop.
      if (g.pauseLeft > 0) {
        g.pauseLeft -= dt;
        g.facing += g.scanDir * 0.55 * dt;
      } else {
        const target = g.waypoints[g.wp];
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d < 5) {
          g.wp = (g.wp + 1) % g.waypoints.length;
          g.pauseLeft = g.pause;
          g.scanDir = -g.scanDir;
        } else {
          g.facing = Math.atan2(dy, dx);
          moveCircle(L, g, (dx / d) * g.speed * dt, (dy / d) * g.speed * dt);
        }
      }
    }
  }
  return world;
}

// Breadth-first path over walkable tiles; returns tile centres, or null.
export function findPath(L, fromTile, toTile) {
  const key = (x, y) => `${x},${y}`;
  const prev = new Map();
  const queue = [fromTile];
  prev.set(key(fromTile.x, fromTile.y), null);
  while (queue.length) {
    const cur = queue.shift();
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
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}
