#!/usr/bin/env node
/**
 * Inscrit la version du build dans l'artefact front.
 *
 * Pourquoi c'est necessaire : l'archive du front ne contient que le contenu de
 * `dist/landing` (sortie du build Angular), et Angular n'y copie pas le
 * package.json. Sans ce fichier, rien dans l'artefact deploye n'indique quelle
 * version tourne — contrairement au back, dont l'archive embarque son
 * package.json.
 *
 * Le fichier atterrit dans la sortie navigateur, donc il est servi tel quel par
 * le `express.static` de server.ts : la version est lisible sur
 * https://www.moze.fr/version.json, sans toucher au serveur.
 *
 * Lance automatiquement apres `npm run build:prod` (hook `postbuild:prod`).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'dist', 'landing', 'browser');

if (!existsSync(target)) {
  console.error(`  [stamp-version] ${target} introuvable : build absent ?`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const stamp = {
  name: pkg.name,
  version: pkg.version,
  // Horodatage du build, pour distinguer deux constructions d'un meme numero
  // (c'est le meme repere que le suffixe du nom de l'archive).
  builtAt: new Date().toISOString(),
};

writeFileSync(join(target, 'version.json'), `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`  [stamp-version] version.json ecrit : v${stamp.version}`);
