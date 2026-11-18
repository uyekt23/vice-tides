// Vice Tides — Palmera Bay: the hand-in program for the make.fun gta6-01 bounty.
// (Node 22, standard library only.) The game itself is the game/ folder beside this
// file: plain static files — game/index.html plus its ES modules and one vendored
// three.js build — that a desktop browser plays offline with no network request.
//
// What this program does: copy game/ and screenshots/ into the output directory
// (MAKEFUN_OUTPUT_DIR locally, /output in the grader) and write dossier.json there
// with buildDossier from the vendored make.fun library, so the dossier the judge
// reads is exactly the one the scorer recomputes. Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The whole game tree and the screenshots travel together; the output directory
// is created fresh by the grader, but locally it may already hold an older run,
// so each piece is copied over whatever is there.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below are the scorer's own (see the kit's gate): passing them makes
// this program refuse exactly the entries the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 entries or 48 MiB under game/,
// or a game path over 1000 bytes. Only text_max_bytes shapes the dossier bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
