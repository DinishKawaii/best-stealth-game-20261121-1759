// Entry program for "Whisper in the Marble Hall" (Node 22, standard
// library only). It hands the game in: it copies this repository's game/
// and screenshots/ into the output directory and writes dossier.json,
// the summary the judge reads, using the kit's vendored library.
//
// Run locally to check the output before submitting:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader, MAKEFUN_OUTPUT_DIR is unset and /output is used.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an empty game: both folders must exist.
for (const needed of ['game', 'screenshots']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`missing ${needed}/ beside main.ts — nothing to hand in`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

const shotsDir = join(out, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), shotsDir, { recursive: true });
}

// The caps match the scorer's own limits from the kit's RULES.txt: at most
// 4 screenshots of 256 KiB each, game/ at most 993 files and 48 MiB, and
// the dossier text budget the library is built around.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`entry written to ${out}`);

// A short summary so a local run shows what was handed in.
import { readdirSync, statSync } from 'node:fs';
const countFiles = (dir) => {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
};
console.log(
  `game/: ${countFiles(join(out, 'game'))} files, `
  + `screenshots/: ${readdirSync(join(out, 'screenshots')).length} files, `
  + `dossier.json: ${statSync(join(out, 'dossier.json')).size} bytes`,
);
