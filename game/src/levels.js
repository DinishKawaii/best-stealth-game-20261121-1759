// Level definitions for "Whisper in the Marble Hall".
// Tile legend: '#' wall, '.' floor, 'S' shadow floor (hides the player),
// 'B' crate (blocks movement and sight), 'P' player start, 'E' exit,
// '*' a Starlight Shard to collect. Guards patrol the waypoint lists;
// every waypoint sits on a walkable tile, and every patrol leg runs
// along open floor (no wall or crate in a straight line between two
// consecutive waypoints). All rows are 28 tiles wide, 16 rows tall.

export const TILE = 40;

export const LEVELS = [
  {
    name: 'Lantai 1 — Serambi',
    tip: 'Bayangan menyembunyikanmu. Jalan pelan (SHIFT) di dekat penjaga.',
    shards: 3,
    map: [
      '############################',
      '#P....S....B.....S......*..#',
      '#.................#........#',
      '#........#........#........#',
      '#........#........#.B......#',
      '#..S.....#........#........#',
      '#........#....S............#',
      '#......................E...#',
      '#...#####...........B......#',
      '#.....S...............S....#',
      '#...........B..............#',
      '#..................#####...#',
      '#...............S..........#',
      '#..*.....................*.#',
      '#....B...............B.....#',
      '############################',
    ],
    guards: [
      { waypoints: [[3, 2], [16, 2]], speed: 62, pause: 0.9 },
      { waypoints: [[13, 4], [13, 13]], speed: 58, pause: 1.1 },
      { waypoints: [[5, 12], [25, 12]], speed: 66, pause: 0.7 },
    ],
  },
  {
    name: 'Lantai 2 — Aula Patung',
    tip: 'Patung (B) memutus pandangan. Lari (SPASI) terdengar sampai jauh.',
    shards: 3,
    map: [
      '############################',
      '#P....S..................*.#',
      '#........#.................#',
      '#....B...#...B.............#',
      '#........#............B....#',
      '#........#..S..............#',
      '#...................#####..#',
      '#....................S...E.#',
      '#................#.........#',
      '#.....B..........#.........#',
      '#................#......B..#',
      '#..S.............#.........#',
      '#...#####..................#',
      '#.*...............S......*.#',
      '#..............B...........#',
      '############################',
    ],
    guards: [
      { waypoints: [[12, 1], [24, 1]], speed: 70, pause: 0.8 },
      { waypoints: [[14, 7], [14, 14]], speed: 68, pause: 1.0 },
      { waypoints: [[3, 10], [16, 10]], speed: 72, pause: 0.6 },
      { waypoints: [[5, 13], [24, 13]], speed: 64, pause: 1.2 },
    ],
  },
  {
    name: 'Lantai 3 — Ruang Harta',
    tip: 'Lantai terakhir: lima penjaga. Sabar menunggu celah patroli.',
    shards: 3,
    map: [
      '############################',
      '#P....S..................*.#',
      '#.......#..................#',
      '#....B..#...S..............#',
      '#.......#.............B..*.#',
      '#...........B..............#',
      '#.................S........#',
      '#...####............####...#',
      '#..........................#',
      '#..S...............#.......#',
      '#.....B..####.S....#B......#',
      '#..................#.......#',
      '#..............B...#.S.....#',
      '#.*.....................B..#',
      '#........................E.#',
      '############################',
    ],
    guards: [
      { waypoints: [[10, 1], [24, 1]], speed: 76, pause: 0.7 },
      { waypoints: [[11, 2], [11, 6]], speed: 74, pause: 0.9 },
      { waypoints: [[3, 8], [25, 8]], speed: 78, pause: 0.6 },
      { waypoints: [[16, 9], [16, 13]], speed: 72, pause: 1.0 },
      { waypoints: [[5, 13], [23, 13]], speed: 75, pause: 0.8 },
    ],
  },
];

// Walkable tiles: floor, shadow, start, exit, shard.
export function isWalkable(ch) {
  return ch === '.' || ch === 'S' || ch === 'P' || ch === 'E' || ch === '*';
}

// Blocks a guard's line of sight: walls and crates.
export function blocksSight(ch) {
  return ch === '#' || ch === 'B';
}

export function parseLevel(def) {
  const rows = def.map.length;
  const cols = def.map[0].length;
  const grid = def.map.map((row) => row.split(''));
  let start = null;
  let exit = null;
  const shardSpots = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = grid[y][x];
      if (ch === 'P') start = { x, y };
      if (ch === 'E') exit = { x, y };
      if (ch === '*') shardSpots.push({ x, y });
    }
  }
  return { def, rows, cols, grid, start, exit, shardSpots };
}
