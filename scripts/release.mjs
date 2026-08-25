#!/usr/bin/env node
/**
 * Release : deduit le prochain numero de version a partir des commits, puis
 * l'applique (package.json + commit + tag git).
 *
 * Le meme script est utilise dans landingMoze (front) et landingMoze-back.
 * Les regles de versionnage sont documentees dans VERSIONING.md, a la racine.
 *
 * Usage :
 *   node scripts/release.mjs --dry-run       # analyse seule, ne touche a rien
 *   node scripts/release.mjs                 # analyse, puis demande confirmation
 *   node scripts/release.mjs --yes           # analyse et applique sans demander
 *   node scripts/release.mjs --level=minor   # force le niveau, court-circuite l'analyse
 *
 * Pourquoi Node et pas bash : meme raison que sync-remotes.mjs, le `bash` du PATH
 * de ce poste est celui de WSL et ne voit pas le meme disque.
 *
 * Le tag git fait foi sur "ce qui est publie" : le prochain numero se calcule a
 * partir du dernier tag, jamais du package.json (qui peut avoir ete edite a la
 * main entre deux releases).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ORDER = ['none', 'patch', 'minor', 'major'];

const LABEL = {
  major: 'MAJEUR (rupture)',
  minor: 'MINEUR (fonctionnalite)',
  patch: 'CORRECTIF',
  none: 'SANS EFFET (technique : lint, doc, refactor)',
};

/**
 * Regles de classification, de la plus forte a la plus faible : la premiere qui
 * matche gagne, donc un commit "ajout + fix" compte comme MINEUR.
 *
 * Deux partis pris :
 *  - le MAJEUR n'est jamais deduit d'un mot francais. "Refonte admin blog" ne
 *    casse pas le contrat d'API, et un majeur pose a tort laisse un trou
 *    definitif dans la numerotation : il faut un marqueur explicite.
 *  - les commits purement techniques sont reconnus par le DEBUT du message,
 *    sinon "Lint : passe eslint --fix" compterait comme un correctif a cause
 *    du "--fix".
 */
const RULES = [
  { level: 'none', test: /^(chore|docs?|style|refactor|test|ci|build|lint|format|prettier)\b/i, why: 'technique' },

  { level: 'major', test: /(^|\n)BREAKING[ -]CHANGE/i, why: 'BREAKING CHANGE' },
  { level: 'major', test: /^[a-z]+(\([^)]*\))?!:/i, why: 'marqueur "!"' },
  { level: 'major', test: /\[major\]/i, why: 'marqueur [major]' },

  { level: 'minor', test: /^feat(\([^)]*\))?:/i, why: 'prefixe feat:' },
  { level: 'minor', test: /\[minor\]/i, why: 'marqueur [minor]' },
  { level: 'minor', test: /\b(ajout|ajoute|ajouts|nouveau|nouvelle|nouveaux|nouvelles|feature|mise en place|implementation|implemente)\b/i, why: 'ajout de fonctionnalite' },

  { level: 'patch', test: /^fix(\([^)]*\))?:/i, why: 'prefixe fix:' },
  { level: 'patch', test: /\[patch\]/i, why: 'marqueur [patch]' },
  { level: 'patch', test: /\b(fix|corrige|corrigee|correction|corrections|patch|bug|bugs|hotfix|repare)\b/i, why: 'correction' },
];

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function git(args, { allowFail = false } = {}) {
  const res = spawnSync('git', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    if (allowFail) return null;
    fail(`git ${args.join(' ')} a echoue :\n${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

/**
 * `shell: true` n'est pas une facilite : sous Windows, npm est un `.cmd`, et depuis les
 * correctifs de securite de Node (18.20 / 20.12 / 22, CVE-2024-27980) `spawn` refuse d'executer
 * un `.cmd` sans shell — il echoue en `EINVAL`, sans rien lancer. C'est le shell qui resout
 * l'extension. Les arguments sont fixes et sans espace, aucune surface d'injection.
 */
function npm(args) {
  // Commande passee en UNE chaine : avec `shell: true`, fournir un tableau d'arguments separe
  // est deprecie par Node (ils ne sont que concatenes, jamais echappes) et emet un avertissement.
  const res = spawnSync(`npm ${args.join(' ')}`, { stdio: 'inherit', shell: true });
  // `error` couvre l'echec de lancement (binaire absent, EINVAL) ; `status` l'echec de la
  // commande elle-meme. Les deux doivent etre distingues, sinon le diagnostic est illisible.
  if (res.error) fail(`npm ${args.join(' ')} n a pas pu etre lance : ${res.error.message}`);
  if (res.status !== 0) fail(`npm ${args.join(' ')} a echoue (code ${res.status}).`);
}

function repoRoot() {
  const root = git(['rev-parse', '--show-toplevel']);
  if (!root || !existsSync(join(root, 'package.json'))) {
    fail('package.json introuvable a la racine du depot.');
  }
  return root;
}

function requireCleanTree() {
  const dirty = git(['status', '--porcelain']);
  if (dirty) {
    fail(
      'Arbre de travail non propre : commitez (ou remisez) avant de publier.\n' +
        'Un tag doit designer exactement ce qui part en production.\n\n' +
        dirty,
    );
  }
}

function classify(message) {
  for (const rule of RULES) {
    if (rule.test.test(message)) return { level: rule.level, why: rule.why };
  }
  // Non reconnu : on retient le niveau le plus BAS qui declenche quand meme une
  // release. Sous-evaluer se rattrape au correctif suivant ; surevaluer laisse
  // un numero perdu pour toujours.
  return { level: 'patch', why: 'non classe, correctif par defaut' };
}

function bump(version, level) {
  const [maj, min, pat] = version.split('.').map((n) => parseInt(n, 10) || 0);
  if (level === 'major') return `${maj + 1}.0.0`;
  if (level === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

async function confirm(question, skip) {
  if (skip) return;
  if (!process.stdin.isTTY) {
    // npm ne transmet pas toujours un terminal interactif au sous-processus, selon le terminal
    // depuis lequel la commande est lancee. Sans ce repli, la release s'arrete ici sans rien
    // faire — et, enchainee a la construction, aucun artefact ne sort.
    fail(
      'Pas de terminal interactif : la confirmation ne peut pas etre demandee.\n' +
        '  Apercu   : npm run release:dry\n' +
        '  Publier  : npm run release -- --yes\n' +
        '  Ou tout  : npm run release:prod-win  (release + artefact, sans confirmation)',
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`  ${question} [o/N] `)).trim().toLowerCase();
  rl.close();
  if (!['o', 'oui', 'y', 'yes'].includes(answer)) fail('Annule : rien n a ete modifie.');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const yes = args.includes('--yes') || args.includes('-y');
  const forced = (args.find((a) => a.startsWith('--level=')) ?? '').split('=')[1];

  if (forced && !['patch', 'minor', 'major'].includes(forced)) {
    fail(`--level attend patch, minor ou major (recu : "${forced}").`);
  }

  const root = repoRoot();

  // Verifie AVANT toute analyse : demander de confirmer un numero, puis refuser a cause de
  // fichiers non commites, laisse croire que la release est passee alors que rien n'a eu lieu —
  // et, enchainee a la construction de l'artefact, la coupe sans que la raison saute aux yeux.
  if (!dryRun) requireCleanTree();

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const tag = git(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'], { allowFail: true });

  console.log(`\n  ${pkg.name} - package.json : ${pkg.version}`);

  // Premiere release : aucun tag n'existe encore. Le numero du package.json est
  // celui prepare a la main (cf. VERSIONING.md) ; on le pose tel quel plutot que
  // de l'incrementer, sinon la version preparee serait sautee pour rien.
  if (!tag) {
    console.log('  Aucun tag dans ce depot : premiere release.');
    console.log(`  -> le tag v${pkg.version} sera pose sur le commit courant, sans incrementer.\n`);
    if (dryRun) {
      console.log('  (--dry-run : rien n a ete modifie)\n');
      return;
    }

    await confirm(`Poser le tag v${pkg.version} ?`, yes);
    git(['tag', '-a', `v${pkg.version}`, '-m', `v${pkg.version}`]);
    console.log(`\n  Tag v${pkg.version} pose. Reste a faire : git push && git push --tags\n`);
    return;
  }

  const base = tag.replace(/^v/, '');
  const raw = git(['log', `${tag}..HEAD`, '--pretty=format:%s%x1f%b%x1e']);
  const commits = raw
    .split('\x1e')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [subject, body = ''] = chunk.split('\x1f');
      return { subject: subject.trim(), message: `${subject}\n${body}`.trim() };
    });

  console.log(`  Dernier tag    : ${tag}`);

  if (!commits.length) fail(`Aucun commit depuis ${tag} : rien a publier.`);

  console.log(`  Commits depuis : ${commits.length}\n`);

  const classified = commits.map((c) => ({ ...c, ...classify(c.message) }));
  for (const level of ['major', 'minor', 'patch', 'none']) {
    const group = classified.filter((c) => c.level === level);
    if (!group.length) continue;
    console.log(`  ${LABEL[level]}`);
    for (const c of group) console.log(`    - ${c.subject}   (${c.why})`);
    console.log('');
  }

  const detected = classified.reduce(
    (max, c) => (ORDER.indexOf(c.level) > ORDER.indexOf(max) ? c.level : max),
    'none',
  );

  if (detected === 'none' && !forced) {
    fail(
      'Que des commits techniques depuis le dernier tag : rien a publier.\n' +
        'Pour publier quand meme : npm run release -- --level=patch',
    );
  }

  const level = forced ?? detected;
  const target = bump(base, level);

  if (forced && forced !== detected) {
    console.log(`  Niveau detecte : ${detected}, force a ${forced} par --level.`);
  }
  console.log(`  => ${LABEL[level]} : ${base} -> ${target}\n`);

  if (dryRun) {
    console.log('  (--dry-run : rien n a ete modifie)\n');
    return;
  }

  await confirm(`Publier la version ${target} ?`, yes);

  if (pkg.version === target) {
    // package.json deja au bon numero : il ne reste que le tag a poser.
    git(['tag', '-a', `v${target}`, '-m', `v${target}`]);
  } else {
    // npm ecrit package.json + package-lock.json, commit et tag en une passe.
    npm(['version', target]);
  }

  console.log(`\n  Version ${target} publiee. Reste a faire : git push && git push --tags\n`);
}

main().catch((error) => fail(error?.stack ?? String(error)));
