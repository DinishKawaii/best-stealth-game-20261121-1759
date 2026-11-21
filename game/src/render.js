// Canvas rendering for "Whisper in the Marble Hall". Everything is drawn
// from code: no image files. The board is 28x16 tiles of 40 px, centred on
// a 1280x800 canvas with a HUD bar above and a hint bar below.

import { TILE, blocksSight } from './levels.js';
import { VIEW_DIST, VIEW_HALF_ANGLE } from './engine.js';

export const CANVAS_W = 1280;
export const CANVAS_H = 800;
export const BOARD_X = 80;
export const BOARD_Y = 90;

const FLOOR_A = '#20263a';
const FLOOR_B = '#1d2334';
const SHADOW_FLOOR = '#12172a';
const WALL_FILL = '#3a4157';
const WALL_TOP = '#565e78';
const CRATE_FILL = '#6b4f2a';
const CRATE_EDGE = '#8a6a3d';

function conePolygon(L, gx, gy, facing, dist) {
  const pts = [{ x: gx, y: gy }];
  const step = 0.09;
  for (let a = facing - VIEW_HALF_ANGLE; a <= facing + VIEW_HALF_ANGLE + 0.001; a += step) {
    let d = 12;
    let ex = gx;
    let ey = gy;
    while (d < dist) {
      const nx = gx + Math.cos(a) * d;
      const ny = gy + Math.sin(a) * d;
      const tx = Math.floor(nx / TILE);
      const ty = Math.floor(ny / TILE);
      const ch = tx < 0 || ty < 0 || tx >= L.cols || ty >= L.rows ? '#' : L.grid[ty][tx];
      if (blocksSight(ch)) break;
      ex = nx;
      ey = ny;
      d += 9;
    }
    pts.push({ x: ex, y: ey });
  }
  return pts;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBoard(ctx, world, time) {
  const { L } = world;
  const ox = BOARD_X;
  const oy = BOARD_Y;

  ctx.save();
  ctx.translate(ox, oy);

  // Floor.
  for (let y = 0; y < L.rows; y++) {
    for (let x = 0; x < L.cols; x++) {
      const ch = L.grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === 'S') {
        ctx.fillStyle = SHADOW_FLOOR;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(120,150,255,0.10)';
        ctx.beginPath();
        ctx.moveTo(px + 6, py + TILE - 6);
        ctx.lineTo(px + TILE - 6, py + 6);
        ctx.stroke();
      } else if (ch === '#' || ch === 'B') {
        // drawn below (walls/crates on top of floor)
        ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(px, py, TILE, TILE);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B;
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }

  // Exit doorway.
  const ex = world.exit;
  const pulse = 0.55 + 0.35 * Math.sin(time * 2.4);
  ctx.save();
  ctx.globalAlpha = world.exitOpen ? 0.85 + 0.15 * pulse : 0.5;
  ctx.fillStyle = world.exitOpen ? '#2fd07a' : '#5c6b5e';
  ctx.shadowColor = world.exitOpen ? '#2fd07a' : 'transparent';
  ctx.shadowBlur = world.exitOpen ? 22 : 0;
  ctx.fillRect(ex.x - 17, ex.y - 17, 34, 34);
  ctx.restore();
  ctx.fillStyle = '#062b16';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.exitOpen ? 'EXIT' : 'LOCK', ex.x, ex.y);
  if (!world.exitOpen) {
    ctx.fillStyle = '#d8c26a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('🔒', ex.x, ex.y - 26);
  }

  // Shards.
  for (const s of world.shards) {
    if (s.taken) continue;
    const glow = 0.6 + 0.4 * Math.sin(time * 3 + s.x);
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#6fe3ff';
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 12);
    ctx.lineTo(s.x + 8, s.y);
    ctx.lineTo(s.x, s.y + 12);
    ctx.lineTo(s.x - 8, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Walls and crates.
  for (let y = 0; y < L.rows; y++) {
    for (let x = 0; x < L.cols; x++) {
      const ch = L.grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === '#') {
        ctx.fillStyle = WALL_FILL;
        ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = WALL_TOP;
        ctx.fillRect(px + 1, py + 1, TILE - 2, 4);
      } else if (ch === 'B') {
        ctx.fillStyle = CRATE_FILL;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = CRATE_EDGE;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.beginPath();
        ctx.moveTo(px + 4, py + 4);
        ctx.lineTo(px + TILE - 4, py + TILE - 4);
        ctx.moveTo(px + TILE - 4, py + 4);
        ctx.lineTo(px + 4, py + TILE - 4);
        ctx.stroke();
      }
    }
  }

  // Vision cones (under the guards, above the floor).
  for (const g of world.guards) {
    const chasing = g.state === 'chase';
    const suspicious = g.state === 'suspect' || g.suspicion >= 45;
    const poly = conePolygon(L, g.x, g.y, g.facing, VIEW_DIST);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle = chasing
      ? 'rgba(255,70,70,0.20)'
      : suspicious
        ? 'rgba(255,180,60,0.16)'
        : 'rgba(255,220,90,0.11)';
    ctx.fill();
  }

  // Noise rings while running.
  const p = world.player;
  if (p.running && p.moving) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26 + 10 * Math.sin(time * 9), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Guards.
  for (const g of world.guards) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = g.state === 'chase' ? '#c22f2f' : '#2b3a67';
    ctx.strokeStyle = '#d8c26a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#d8c26a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(g.facing) * (g.r + 7), Math.sin(g.facing) * (g.r + 7));
    ctx.stroke();
    // Suspicion mark.
    if (g.state === 'chase') {
      ctx.fillStyle = '#ff5b5b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('!', 0, -g.r - 10);
    } else if (g.suspicion >= 10) {
      ctx.fillStyle = '#ffc94d';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('?', 0, -g.r - 10);
    }
    // Suspicion arc.
    if (g.suspicion > 0 && g.suspicion < 100) {
      ctx.strokeStyle = g.suspicion >= 45 ? '#ffc94d' : '#e8e8e8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, g.r + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.suspicion) / 100);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Player: a hooded figure in a dark cloak.
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.sneaking) ctx.globalAlpha = 0.85;
  ctx.rotate(p.facing);
  ctx.fillStyle = '#3d2b52';
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-13, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#241a33';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8d27a';
  ctx.beginPath();
  ctx.arc(4, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Thin suspicion bar above the player when anyone is half-sure.
  const worst = Math.max(0, ...world.guards.map((g) => g.suspicion));
  if (worst > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 22, p.y - 30, 44, 6);
    ctx.fillStyle = worst >= 100 ? '#ff5b5b' : worst >= 45 ? '#ffc94d' : '#e8e8e8';
    ctx.fillRect(p.x - 21, p.y - 29, 42 * (worst / 100), 4);
  }

  ctx.restore();
}

function drawTopBar(ctx, world, levelIndex, totalTime, ghostCount) {
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, 0, CANVAS_W, 64);
  ctx.fillStyle = '#d8c26a';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.def.name, 24, 26);
  ctx.fillStyle = '#9aa3c0';
  ctx.font = '15px sans-serif';
  ctx.fillText(world.def.tip, 24, 48);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 17px sans-serif';
  const shardText = `◆ ${world.shardsTaken}/${world.shardsTotal}`;
  ctx.fillText(shardText, CANVAS_W - 300, 26);
  ctx.fillStyle = world.exitOpen ? '#2fd07a' : '#9aa3c0';
  ctx.fillText(world.exitOpen ? 'EXIT TERBUKA' : 'EXIT TERKUNCI', CANVAS_W - 150, 26);
  ctx.fillStyle = '#9aa3c0';
  ctx.font = '15px sans-serif';
  const mm = String(Math.floor(totalTime / 60)).padStart(2, '0');
  const ss = String(Math.floor(totalTime % 60)).padStart(2, '0');
  ctx.fillText(`Waktu ${mm}:${ss}   GHOST ×${ghostCount}`, CANVAS_W - 24, 48);
  ctx.textAlign = 'left';
}

function drawBottomBar(ctx, muted) {
  ctx.fillStyle = '#10142a';
  ctx.fillRect(0, CANVAS_H - 56, CANVAS_W, 56);
  ctx.fillStyle = '#9aa3c0';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'WASD / Panah — gerak   ·   SHIFT (tahan) — menyelinap   ·   SPASI (tahan) — lari (berisik!)   ·   Klik lantai — jalan ke sana   ·   P — jeda   ·   M — suara ' + (muted ? 'mati' : 'nyala') + '   ·   R — ulang lantai',
    CANVAS_W / 2,
    CANVAS_H - 28,
  );
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, buttonLabel) {
  ctx.fillStyle = 'rgba(8,10,24,0.78)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#d8c26a';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, CANVAS_W / 2, 220);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '19px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, 300 + i * 32);
  });
  let button = null;
  if (buttonLabel) {
    const bw = 260;
    const bh = 58;
    const bx = CANVAS_W / 2 - bw / 2;
    const by = 560;
    ctx.fillStyle = '#d8c26a';
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1430';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(buttonLabel, CANVAS_W / 2, by + bh / 2 + 1);
    button = { x: bx, y: by, w: bw, h: bh };
  }
  ctx.textAlign = 'left';
  return button;
}

// Draws one frame. Returns the clickable button rect of the current
// overlay, or null when the game is being played.
export function drawGame(ctx, ui) {
  const { world, screen, levelIndex, totalTime, ghostCount, muted, time } = ui;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#0b0e1d';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawTopBar(ctx, world, levelIndex, totalTime, ghostCount);
  drawBoard(ctx, world, time);
  drawBottomBar(ctx, muted);

  if (screen === 'title') {
    return overlay(ctx, 'WHISPER IN THE MARBLE HALL', [
      'Kamu Sable, pencuri yang menyelinap ke museum di malam hari.',
      'Ambil semua Starlight Shard di tiap lantai, lalu capai EXIT hijau.',
      'Penjaga berpatroli dengan kerucut pandang. Bayangan gelap menyembunyikanmu.',
      'Jalan pelan itu aman; lari itu cepat tapi berisik dan mudah terlihat.',
      'Selesaikan lantai tanpa pernah ketahuan untuk bonus GHOST.',
    ], 'MULAI MENYELINAP');
  }
  if (screen === 'paused') {
    return overlay(ctx, 'JEDA', ['Istirahat sebentar. Penjaga tidak bergerak saat jeda.'], 'LANJUTKAN');
  }
  if (screen === 'caught') {
    return overlay(ctx, 'KETAHUAN!', [
      'Seorang penjaga menangkapmu.',
      'Coba lagi — perhatikan arah kerucut pandang dan tunggu celahnya.',
    ], 'COBA LAGI');
  }
  if (screen === 'clear') {
    const ghost = world.spotted ? '' : '  ·  GHOST! Tidak pernah ketahuan.';
    return overlay(ctx, 'LANTAI SELESAI', [
      `${world.def.name} dilewati dalam ${formatTime(world.time)}.${ghost}`,
      'Lantai berikutnya lebih ramai penjaganya.',
    ], 'LANTAI BERIKUTNYA');
  }
  if (screen === 'done') {
    return overlay(ctx, 'SEMUA LANTAI SELESAI!', [
      `Total waktu ${formatTime(totalTime)}  ·  Bonus GHOST di ${ghostCount} dari 3 lantai.`,
      'Sable menghilang ke malam dengan semua Starlight Shard.',
      'Terima kasih sudah bermain.',
    ], 'MAIN LAGI');
  }
  return null;
}

export function formatTime(t) {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
}
